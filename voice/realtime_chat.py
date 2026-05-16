# ============================================================
# 语音版 Claude Code (桌宠语音层 MVP, 2026-04-24)
# ------------------------------------------------------------
# 功能:
#   1. VAD 连续对话: 静默监听 → 检测到连续 300ms 人声才录 → 静音 3 秒停
#   2. STT: faster-whisper small 本地跑，三层幻觉防御（RMS 预检/
#      no_speech_threshold=0.8/黑名单过滤"点赞订阅转发"）
#   3. LLM: 调 claude.cmd CLI（用 Max 订阅不花 API 钱），opus-4-6 模型，
#      stdin 传 prompt 绕开 Windows cmd 8191 字符限制
#   4. 上下文: Python 端维护 6 轮 chat_history + 启动时预加载 memory.md 全文
#      和 log.md 尾部 40 行，Claude 无需发起 Read 工具调用
#   5. TTS: MiniMax speech-2.8-hd，分段并行下载顺序播放，
#      language_boost=auto 中英混合正常
#   6. 主动说话桥: 后台线程监听 voice/speak_queue.txt，外部写入即 TTS 播放，
#      播放期间暂停录音避回音，播完自动记入 chat_history
#   7. 噪音阈值自动校准: 启动时录 1 秒环境噪音，自适应 silence_threshold
#
# 配套:
#   - voice/speak_queue.txt: 主动说话文件桥
#   - voice/pet_log.md: 桌宠 cron 行为日志
#   - cron: /loop 10m 在 Claude Code 里起 CronCreate，触发时桌宠自主选动作
#
# 依赖: sounddevice, faster-whisper, soundfile, scipy, pygame, requests
# 运行: python realtime_chat.py
# 退出: 录音/等待时按 q
# ============================================================

import sounddevice as sd
import numpy as np
from faster_whisper import WhisperModel
import tempfile
import soundfile as sf
import os
from scipy import signal
import subprocess
import requests
import pygame
import time
import msvcrt
import threading

# ===== 配置（使用前请填写） =====
RECORD_DEVICE = 0
RECORD_SAMPLE_RATE = 44100
WHISPER_SAMPLE_RATE = 16000
CHANNELS = 2
DURATION = 5

# MiniMax TTS — 请替换为你自己的 key
MINIMAX_API_KEY = "YOUR_MINIMAX_API_KEY"
MINIMAX_GROUP_ID = "YOUR_MINIMAX_GROUP_ID"
TTS_VOICE_ID = "YOUR_TTS_VOICE_ID"

# Python 端对话历史（只保留最近 N 轮，避免 prompt 太长）
chat_history = []
MAX_HISTORY = 6

# 启动时预加载 memory 和 log 尾部，避免 Claude 每次发起 Read 工具调用
# 请改成你自己的路径
MEMORY_PATH = r"path/to/your/memory.md"
LOG_PATH = r"path/to/your/log.md"

def load_memory_and_log():
    memory = ""
    log_tail = ""
    try:
        with open(MEMORY_PATH, 'r', encoding='utf-8') as f:
            memory = f.read()
    except Exception as e:
        print(f"读 memory.md 失败: {e}")
    try:
        with open(LOG_PATH, 'r', encoding='utf-8') as f:
            lines = f.readlines()
        log_tail = "".join(lines[-40:])
    except Exception as e:
        print(f"读 log.md 失败: {e}")
    return memory, log_tail

MEMORY_CONTENT, LOG_TAIL = load_memory_and_log()

# 环境噪音自动校准后的阈值（启动时会被覆盖）
AUTO_THRESHOLD = 0.01

def calibrate_noise(duration=1.0, factor=2.5, min_thr=0.003, max_thr=0.05):
    global AUTO_THRESHOLD
    print(f"校准环境噪音中（{duration} 秒，请保持安静）...")
    try:
        audio = sd.rec(int(duration * RECORD_SAMPLE_RATE), samplerate=RECORD_SAMPLE_RATE,
                       channels=CHANNELS, dtype='float32')
        sd.wait()
        if len(audio.shape) > 1:
            mono = audio.mean(axis=1)
        else:
            mono = audio
        noise_rms = float(np.sqrt(np.mean(mono ** 2)))
        threshold = max(min_thr, min(max_thr, noise_rms * factor))
        AUTO_THRESHOLD = threshold
        print(f"  环境噪音 RMS = {noise_rms:.4f} -> silence_threshold = {threshold:.4f}\n")
    except Exception as e:
        print(f"  校准失败（{e}），使用默认阈值 {AUTO_THRESHOLD}\n")

# 主动说话桥接：外部往 speak_queue.txt 写一行文本，voice 脚本自动播放
SPEAK_QUEUE_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "speak_queue.txt")
speaking_state = {"speaking": False}

def speak_queue_watcher():
    try:
        with open(SPEAK_QUEUE_FILE, 'w', encoding='utf-8') as f:
            f.write("")
    except Exception:
        pass

    while True:
        try:
            if os.path.exists(SPEAK_QUEUE_FILE):
                with open(SPEAK_QUEUE_FILE, 'r', encoding='utf-8') as f:
                    text = f.read().strip()
                if text:
                    with open(SPEAK_QUEUE_FILE, 'w', encoding='utf-8') as f:
                        f.write("")
                    speaking_state["speaking"] = True
                    print(f"\n主动说话: {text}")
                    try:
                        text_to_speech_and_play(text)
                    except Exception as e:
                        print(f"主动说话 TTS 失败: {e}")
                    speaking_state["speaking"] = False
                    chat_history.append(("(无用户输入，我主动开口了)", text))
                    if len(chat_history) > MAX_HISTORY:
                        chat_history.pop(0)
                    print("静默监听中（说话即开始录音，q 退出）...")
        except Exception as e:
            print(f"speak_queue 监听错误: {e}")
        time.sleep(1)

# 设置录音设备
sd.default.device = RECORD_DEVICE

# 初始化pygame
pygame.mixer.init()

# Whisper 模型路径 — 请改成你自己的
WHISPER_MODEL_DIR = "models/"

print("加载Whisper small模型...")
whisper_model = WhisperModel(
    "small",
    device="cpu",
    compute_type="int8",
    download_root=WHISPER_MODEL_DIR
)
print("模型加载完成！")

def record_audio(duration=5):
    print(f"录音中 ({duration}秒)...")
    audio = sd.rec(int(duration * RECORD_SAMPLE_RATE), samplerate=RECORD_SAMPLE_RATE, channels=CHANNELS, dtype='float32')
    sd.wait()
    print("录音结束")

    if len(audio.shape) > 1:
        audio = audio.mean(axis=1)

    num_samples = int(len(audio) * WHISPER_SAMPLE_RATE / RECORD_SAMPLE_RATE)
    audio_resampled = signal.resample(audio, num_samples)

    return audio_resampled.astype(np.float32)

def record_until_silent(silence_threshold=None, silence_duration=3.0, max_duration=60.0, voice_start_duration=0.3):
    if silence_threshold is None:
        silence_threshold = AUTO_THRESHOLD

    print("静默监听中（说话即开始录音，q 退出）...")

    chunk_duration = 0.1
    chunk_size = int(RECORD_SAMPLE_RATE * chunk_duration)
    audio_chunks = []
    silence_chunks = 0
    required_silence_chunks = int(silence_duration / chunk_duration)
    max_chunks = int(max_duration / chunk_duration)
    voice_start_chunks = max(1, int(voice_start_duration / chunk_duration))

    consecutive_voice = 0
    recent_chunks = []
    started = False
    quit_requested = False

    while speaking_state["speaking"]:
        time.sleep(0.1)

    stream = sd.InputStream(
        samplerate=RECORD_SAMPLE_RATE,
        channels=CHANNELS,
        dtype='float32',
        blocksize=chunk_size
    )
    stream.start()
    try:
        while True:
            if speaking_state["speaking"]:
                stream.stop()
                while speaking_state["speaking"]:
                    time.sleep(0.1)
                stream.start()
                started = False
                consecutive_voice = 0
                recent_chunks.clear()
                audio_chunks.clear()
                silence_chunks = 0
                continue

            if msvcrt.kbhit():
                key = msvcrt.getch()
                if key.lower() == b'q':
                    quit_requested = True
                    break

            chunk, _ = stream.read(chunk_size)

            if len(chunk.shape) > 1:
                mono = chunk.mean(axis=1)
            else:
                mono = chunk
            rms = float(np.sqrt(np.mean(mono ** 2)))

            if not started:
                if rms > silence_threshold:
                    consecutive_voice += 1
                    recent_chunks.append(chunk)
                    if len(recent_chunks) > voice_start_chunks:
                        recent_chunks.pop(0)
                    if consecutive_voice >= voice_start_chunks:
                        started = True
                        audio_chunks.extend(recent_chunks)
                        silence_chunks = 0
                        print("检测到说话，录音中...")
                else:
                    consecutive_voice = 0
                    recent_chunks.clear()
            else:
                audio_chunks.append(chunk)
                if rms > silence_threshold:
                    silence_chunks = 0
                else:
                    silence_chunks += 1
                    if silence_chunks >= required_silence_chunks:
                        break
                if len(audio_chunks) >= max_chunks:
                    print("（超过最长时限，强制停止）")
                    break
    finally:
        stream.stop()
        stream.close()

    if quit_requested:
        return None, True
    if not audio_chunks or not started:
        return None, False

    print("录音结束")
    audio = np.concatenate(audio_chunks, axis=0)
    if len(audio.shape) > 1:
        audio = audio.mean(axis=1)

    num_samples = int(len(audio) * WHISPER_SAMPLE_RATE / RECORD_SAMPLE_RATE)
    audio_resampled = signal.resample(audio, num_samples)
    return audio_resampled.astype(np.float32), False

# Whisper 常见幻觉文本（中文视频字幕训练数据残留）
HALLUCINATION_PATTERNS = [
    "请不吝点赞", "订阅", "转发", "打赏", "明镜", "点点栏目",
    "字幕组", "字幕由", "感谢观看", "下次再见", "喜欢记得",
    "关注我", "不要忘记", "MBC", "中文字幕", "Amara.org",
]

def is_hallucination(text):
    if not text or not text.strip():
        return True
    clean = text.strip()
    if len(clean) < 2:
        return True
    for pat in HALLUCINATION_PATTERNS:
        if pat in text:
            return True
    return False

def speech_to_text(audio, min_rms=0.003):
    rms = float(np.sqrt(np.mean(audio ** 2)))
    if rms < min_rms:
        return ""

    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
        temp_path = f.name
        sf.write(temp_path, audio, WHISPER_SAMPLE_RATE)

    try:
        segments, _ = whisper_model.transcribe(
            temp_path,
            language="zh",
            initial_prompt="以下是普通话的句子，使用简体中文。",
            beam_size=7,
            best_of=3,
            vad_filter=True,
            vad_parameters={"min_silence_duration_ms": 500},
            condition_on_previous_text=False,
            no_speech_threshold=0.8,
            log_prob_threshold=-1.0,
        )
        result = "".join([seg.text for seg in segments])

        if is_hallucination(result):
            return ""
        return result
    finally:
        os.unlink(temp_path)

def call_claude(prompt):
    try:
        context_block = ""
        if MEMORY_CONTENT:
            context_block += f"【长期记忆 memory.md（人设与偏好）】\n{MEMORY_CONTENT}\n\n"
        if LOG_TAIL:
            context_block += f"【最近日志 log.md 尾部（最近几天发生的事）】\n{LOG_TAIL}\n\n"

        history_text = ""
        if chat_history:
            history_text = "【本次语音对话历史】\n"
            for u, c in chat_history[-MAX_HISTORY:]:
                history_text += f"用户: {u}\n你: {c}\n"
            history_text += "\n"

        full_prompt = f"{context_block}{history_text}【新问题】\n{prompt}\n\n（这是语音对话，请用1-3句话直接回答上面的新问题。硬性规则：上方已提供 memory 和 log 内容，不要再发起文件读取；不要markdown格式；英文单词尽量用中文代替）"

        # Windows 下用 claude.cmd，其他系统直接用 claude
        claude_cmd = "claude"
        if os.name == 'nt':
            claude_cmd = os.path.join(os.environ.get("APPDATA", ""), "npm", "claude.cmd")

        result = subprocess.run(
            [claude_cmd, "-p", "--model", "claude-opus-4-6"],
            input=full_prompt.encode('utf-8'),
            capture_output=True,
            timeout=120,
        )

        stdout = result.stdout.decode('utf-8', errors='replace') if result.stdout else ''
        stderr = result.stderr.decode('utf-8', errors='replace') if result.stderr else ''

        if result.returncode == 0:
            response = stdout.strip()
            import re
            response = re.sub(r'\x1b\[[0-9;]*m', '', response)
            return response
        else:
            print(f"Claude 错误 (returncode={result.returncode}): {stderr[:300]}")
            return "Claude 执行出错了"

    except subprocess.TimeoutExpired:
        return "命令执行超时了"
    except Exception as e:
        print(f"调用 Claude 失败: {e}")
        return f"出错了：{str(e)}"

def tts_single(text):
    url = f"https://api.minimax.chat/v1/t2a_v2?GroupId={MINIMAX_GROUP_ID}"
    headers = {
        "Authorization": f"Bearer {MINIMAX_API_KEY}",
        "Content-Type": "application/json"
    }
    data = {
        "model": "speech-2.8-hd",
        "text": text,
        "voice_setting": {
            "voice_id": TTS_VOICE_ID,
            "speed": 1.15,
            "vol": 1.0,
            "pitch": 0
        },
        "audio_setting": {
            "sample_rate": 32000,
            "format": "mp3"
        },
        "language_boost": "auto"
    }

    try:
        resp = requests.post(url, headers=headers, json=data, timeout=30)
        result = resp.json()
        if "audio" in result.get("data", {}):
            audio_hex = result["data"]["audio"]
            audio_bytes = bytes.fromhex(audio_hex)
            temp_path = tempfile.mktemp(suffix=".mp3")
            with open(temp_path, "wb") as f:
                f.write(audio_bytes)
            return temp_path
        else:
            print(f"TTS错误: {result}")
            return None
    except Exception as e:
        print(f"TTS请求失败: {e}")
        return None

def split_text(text, max_len=200):
    import re
    sentences = re.split(r'([。！？\n]+)', text)
    merged = []
    for i in range(0, len(sentences), 2):
        s = sentences[i]
        if i + 1 < len(sentences):
            s += sentences[i+1]
        if s.strip():
            merged.append(s.strip())

    chunks = []
    for s in merged:
        if len(s) <= max_len:
            chunks.append(s)
        else:
            parts = re.split(r'([，,；;]+)', s)
            buf = ""
            for j in range(0, len(parts), 2):
                piece = parts[j]
                if j + 1 < len(parts):
                    piece += parts[j+1]
                if len(buf) + len(piece) <= max_len:
                    buf += piece
                else:
                    if buf:
                        chunks.append(buf)
                    buf = piece
            if buf:
                chunks.append(buf)
    return chunks

def text_to_speech_and_play(text):
    from concurrent.futures import ThreadPoolExecutor
    chunks = split_text(text, max_len=200)
    if not chunks:
        return

    with ThreadPoolExecutor(max_workers=min(len(chunks), 6)) as executor:
        futures = [executor.submit(tts_single, c) for c in chunks]
        for fut in futures:
            path = fut.result()
            if path:
                play_audio(path)

def play_audio(file_path):
    pygame.mixer.music.load(file_path)
    pygame.mixer.music.play()
    while pygame.mixer.music.get_busy():
        time.sleep(0.1)
    pygame.mixer.music.unload()
    time.sleep(0.1)
    try:
        os.unlink(file_path)
    except:
        pass

def main():
    print("\n=== 语音版 Claude Code (连续对话模式) ===")
    print("按回车开始，之后自动循环：")
    print("  - 说话结束自动识别，Claude 回复后继续等你")
    print("  - 静音 3 秒自动停止录音")
    print("  - 录音/等待时按 q 退出")
    print(f"  - 主动说话桥: 写入 {SPEAK_QUEUE_FILE} 会触发 TTS 播放\n")

    calibrate_noise()

    threading.Thread(target=speak_queue_watcher, daemon=True).start()

    input("按回车开始对话: ")
    print()

    while True:
        try:
            audio, quit_requested = record_until_silent()
            if quit_requested:
                break
            if audio is None:
                continue

            print("正在识别...")
            t0 = time.time()
            user_text = speech_to_text(audio)
            print(f"你说: {user_text}  [识别 {time.time()-t0:.1f}s]")

            if not user_text.strip():
                print("没听清，请再说一次\n")
                continue

            print("Claude 处理中...")
            t0 = time.time()
            response = call_claude(user_text)
            print(f"Claude: {response}  [Claude {time.time()-t0:.1f}s]")

            chat_history.append((user_text, response))
            if len(chat_history) > MAX_HISTORY:
                chat_history.pop(0)

            print("播放中...")
            t0 = time.time()
            text_to_speech_and_play(response)
            print(f"  [TTS+播放 {time.time()-t0:.1f}s]")
            print()

        except KeyboardInterrupt:
            print("\n\n被中断")
            break
        except Exception as e:
            print(f"出错了: {e}\n")
            continue

    print("结束")
    pygame.mixer.quit()

if __name__ == "__main__":
    main()

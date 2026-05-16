# 实时语音识别测试 v4
# 按回车开始录音（固定3秒），自动识别

import sounddevice as sd
import numpy as np
from faster_whisper import WhisperModel
import tempfile
import soundfile as sf
import os
from scipy import signal

# 录音参数
RECORD_DEVICE = 0
RECORD_SAMPLE_RATE = 44100
WHISPER_SAMPLE_RATE = 16000
CHANNELS = 2
DURATION = 3

# Whisper 模型路径 — 请改成你自己的
WHISPER_MODEL_DIR = "models/"

sd.default.device = RECORD_DEVICE

print("加载Whisper模型...")
model = WhisperModel(
    "tiny",
    device="cpu",
    compute_type="int8",
    download_root=WHISPER_MODEL_DIR
)
print("模型加载完成！")

def record_audio(duration=3):
    print(f"开始录音 ({duration}秒)...")
    audio = sd.rec(int(duration * RECORD_SAMPLE_RATE), samplerate=RECORD_SAMPLE_RATE, channels=CHANNELS, dtype='float32')
    sd.wait()
    print("录音结束")

    if len(audio.shape) > 1:
        audio = audio.mean(axis=1)

    num_samples = int(len(audio) * WHISPER_SAMPLE_RATE / RECORD_SAMPLE_RATE)
    audio_resampled = signal.resample(audio, num_samples)

    return audio_resampled.astype(np.float32)

def transcribe(audio):
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
        temp_path = f.name
        sf.write(temp_path, audio, WHISPER_SAMPLE_RATE)

    try:
        segments, info = model.transcribe(temp_path, language="zh")
        result = "".join([seg.text for seg in segments])
        return result
    finally:
        os.unlink(temp_path)

def main():
    print("\n=== 实时语音识别测试 v4 ===")
    print("使用 Whisper tiny 模型")
    print("按回车开始录音（3秒）")
    print("输入 q 退出\n")

    while True:
        cmd = input("按回车开始录音，输入q退出: ")
        if cmd.lower() == 'q':
            break

        audio = record_audio(DURATION)

        if audio is not None and len(audio) > 0:
            print("正在识别...")
            text = transcribe(audio)
            print(f"\n识别结果: {text}\n")

    print("测试结束")

if __name__ == "__main__":
    main()

"""
Pety 语音服务 — 本地HTTP server
- POST /stt  : 接收音频文件 → 腾讯云ASR识别 → 返回文字
- POST /tts  : 接收文字 → MiniMax TTS → 返回音频
- GET  /health : 健康检查
"""
import os
import json
import time
import base64
import tempfile
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse

# 腾讯云 ASR config
TENCENT_SECRET_ID = os.environ.get("TENCENT_SECRET_ID", "")
TENCENT_SECRET_KEY = os.environ.get("TENCENT_SECRET_KEY", "")

# Whisper model (lazy load, fallback)
_whisper_model = None
WHISPER_MODEL_DIR = os.environ.get("WHISPER_MODEL_DIR") or os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "voice", "models")

# MiniMax TTS config
MINIMAX_API_KEY = os.environ.get("MINIMAX_API_KEY", "")
TTS_VOICE_ID = os.environ.get("TTS_VOICE_ID", "moss_audio_fd2620f9-bef3-11f0-8647-a697af11f3d9")

# STT engine: "tencent" or "whisper"
STT_ENGINE = os.environ.get("STT_ENGINE", "tencent" if TENCENT_SECRET_ID else "whisper")


def _convert_to_wav(audio_bytes, fmt):
    """Convert audio to 16kHz mono WAV for Tencent Cloud ASR."""
    if fmt == "wav":
        return audio_bytes, "wav"
    try:
        import static_ffmpeg
        static_ffmpeg.add_paths()
    except ImportError:
        pass
    from pydub import AudioSegment
    import io
    seg = AudioSegment.from_file(io.BytesIO(audio_bytes), format=fmt)
    seg = seg.set_frame_rate(16000).set_channels(1).set_sample_width(2)
    buf = io.BytesIO()
    seg.export(buf, format="wav")
    return buf.getvalue(), "wav"


def transcribe_tencent(audio_bytes, fmt="webm"):
    from tencentcloud.common import credential
    from tencentcloud.asr.v20190614 import asr_client, models

    if fmt not in ("wav", "pcm", "mp3", "m4a", "aac", "amr"):
        audio_bytes, fmt = _convert_to_wav(audio_bytes, fmt)

    fmt_map = {"ogg": "ogg-opus", "wav": "wav", "mp3": "mp3", "m4a": "m4a", "pcm": "pcm"}
    voice_format = fmt_map.get(fmt, fmt)

    cred = credential.Credential(TENCENT_SECRET_ID, TENCENT_SECRET_KEY)
    client = asr_client.AsrClient(cred, "ap-guangzhou")

    req = models.SentenceRecognitionRequest()
    req.EngSerViceType = "16k_zh"
    req.SourceType = 1
    req.VoiceFormat = voice_format
    req.Data = base64.b64encode(audio_bytes).decode("utf-8")
    req.DataLen = len(audio_bytes)
    req.HotwordId = "b33bf897511611f1a444a4ae11f66ba3"
    req.ReinforceHotword = 1

    t0 = time.time()
    resp = client.SentenceRecognition(req)
    elapsed = time.time() - t0
    return {"text": resp.Result.strip(), "time": round(elapsed, 2)}


def get_whisper():
    global _whisper_model
    if _whisper_model is None:
        from faster_whisper import WhisperModel
        print(f"Loading whisper medium model from {WHISPER_MODEL_DIR}...")
        _whisper_model = WhisperModel("medium", device="cpu", compute_type="int8", download_root=WHISPER_MODEL_DIR)
        print("Whisper model loaded!")
    return _whisper_model


def transcribe_whisper(audio_bytes, fmt="webm"):
    model = get_whisper()
    suffix = f".{fmt}" if fmt else ".webm"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as f:
        f.write(audio_bytes)
        temp_path = f.name
    try:
        t0 = time.time()
        segments, info = model.transcribe(
            temp_path, beam_size=5,
            vad_filter=True, no_speech_threshold=0.5,
            initial_prompt="以下是普通话的句子，使用简体中文。",
            vad_parameters={"speech_pad_ms": 800, "threshold": 0.3},
        )
        text = "".join([seg.text for seg in segments]).strip()
        elapsed = time.time() - t0
        return {"text": text, "time": round(elapsed, 2)}
    finally:
        os.unlink(temp_path)


def transcribe(audio_bytes, fmt="webm"):
    if STT_ENGINE == "tencent" and TENCENT_SECRET_ID:
        try:
            return transcribe_tencent(audio_bytes, fmt)
        except Exception as e:
            print(f"[WARNING] Tencent ASR failed: {e}, falling back to whisper")
    return transcribe_whisper(audio_bytes, fmt)

def tts_generate(text):
    import requests
    if not MINIMAX_API_KEY or not TTS_VOICE_ID:
        return None, "TTS not configured"

    url = "https://api.minimaxi.com/v1/t2a_v2"
    headers = {
        "Authorization": f"Bearer {MINIMAX_API_KEY}",
        "Content-Type": "application/json"
    }
    data = {
        "model": "speech-2.8-hd",
        "text": text,
        "stream": False,
        "voice_setting": {
            "voice_id": TTS_VOICE_ID,
            "speed": 1,
            "vol": 1,
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
        if "data" in result and "audio" in result["data"]:
            audio_bytes = bytes.fromhex(result["data"]["audio"])
            return audio_bytes, None
        return None, f"TTS error: {result}"
    except Exception as e:
        return None, str(e)


class VoiceHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/health":
            self.send_json({"status": "ok", "stt_engine": STT_ENGINE, "tencent": bool(TENCENT_SECRET_ID), "whisper": _whisper_model is not None})
        else:
            self.send_error(404)

    def do_POST(self):
        path = urlparse(self.path).path
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length) if content_length > 0 else b""

        if path == "/stt":
            content_type = self.headers.get("Content-Type", "")
            fmt = "webm"
            if "ogg" in content_type:
                fmt = "ogg"
            elif "wav" in content_type:
                fmt = "wav"
            elif "mp3" in content_type:
                fmt = "mp3"
            try:
                result = transcribe(body, fmt)
                self.send_json(result)
            except Exception as e:
                self.send_json({"error": str(e)}, 500)

        elif path == "/tts":
            try:
                req = json.loads(body.decode("utf-8"))
                text = req.get("text", "")
                if not text:
                    self.send_json({"error": "no text"}, 400)
                    return
                audio, err = tts_generate(text)
                if audio:
                    self.send_response(200)
                    self.send_header("Content-Type", "audio/mp3")
                    self.send_header("Content-Length", str(len(audio)))
                    self.send_header("Access-Control-Allow-Origin", "*")
                    self.end_headers()
                    self.wfile.write(audio)
                else:
                    self.send_json({"error": err}, 500)
            except Exception as e:
                self.send_json({"error": str(e)}, 500)

        else:
            self.send_error(404)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def send_json(self, data, code=200):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format, *args):
        print(f"[voice] {args[0]}")


if __name__ == "__main__":
    port = 9800
    print(f"Pety Voice Server starting on http://localhost:{port}")
    print(f"  STT engine: {STT_ENGINE}")
    print(f"  STT: POST /stt (audio body)")
    print(f"  TTS: POST /tts (json {{text}})")

    # Check TTS config
    if not MINIMAX_API_KEY:
        print(f"[WARNING] MINIMAX_API_KEY is empty — TTS (语音合成) will be unavailable.")
        print(f"  Please configure minimax_api_key in voice_config.json.")

    # Check STT config and degrade gracefully
    if STT_ENGINE == "tencent" and (not TENCENT_SECRET_ID or not TENCENT_SECRET_KEY):
        print(f"[WARNING] STT engine is 'tencent' but TENCENT_SECRET_ID/KEY is empty.")
        print(f"  Falling back to whisper. Configure tencent keys in voice_config.json.")
        STT_ENGINE = "whisper"

    if STT_ENGINE == "whisper" or not TENCENT_SECRET_ID:
        try:
            get_whisper()
        except Exception as e:
            print(f"[WARNING] Whisper model failed to load: {e}")
            print(f"  STT will be unavailable, but TTS still works!")
    else:
        # Verify Tencent SDK is importable before declaring ready
        try:
            from tencentcloud.common import credential
            from tencentcloud.asr.v20190614 import asr_client, models
            print(f"  Tencent Cloud ASR ready (whisper available as fallback)")
        except ImportError as e:
            print(f"  Tencent SDK import failed: {e}")
            print(f"  Falling back to whisper")
            STT_ENGINE = "whisper"
            try:
                get_whisper()
            except Exception as e2:
                print(f"[WARNING] Whisper model also failed: {e2}")
                print(f"  STT will be unavailable, but TTS still works!")
    HTTPServer.allow_reuse_address = True
    try:
        server = HTTPServer(("127.0.0.1", port), VoiceHandler)
    except OSError as e:
        print(f"[ERROR] Cannot bind port {port}: {e}")
        print(f"  Another voice server may already be running.")
        import sys
        sys.exit(1)
    print(f"Ready!")
    server.serve_forever()

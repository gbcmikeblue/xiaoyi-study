"""临时自测：生成 63 段正弦波 + 2 秒静音的模拟录音，用于验证 split_pinyin.py 的切分。"""
import math
import struct
import wave
from pathlib import Path

SR = 16000
SEG_COUNT = 63
VOICE_SEC = 0.4
GAP_SEC = 2.0

frames = []
for i in range(SEG_COUNT):
    freq = 300 + i * 6
    for t in range(int(SR * VOICE_SEC)):
        frames.append(int(9000 * math.sin(2 * math.pi * freq * t / SR)))
    for _ in range(int(SR * GAP_SEC)):
        frames.append(0)

out = Path(__file__).resolve().parent.parent / "recordings" / "incoming" / "selftest.wav"
out.parent.mkdir(parents=True, exist_ok=True)
with wave.open(str(out), "wb") as w:
    w.setnchannels(1)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(struct.pack("<%dh" % len(frames), *frames))

print(f"已生成 {out}  时长 {len(frames) / SR:.1f}s  段数 {SEG_COUNT}")

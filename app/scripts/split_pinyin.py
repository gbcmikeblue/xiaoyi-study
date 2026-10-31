"""把一段连续录制的拼音朗读切成单个拼音的音频文件。

用法：
    python scripts/split_pinyin.py --input rec.wav
    python scripts/split_pinyin.py --input rec.wav --dry-run     # 只看切分结果，不写文件
    python scripts/split_pinyin.py --input rec.wav --out public/content/yw-1a/pinyin

原理：按短时能量检测语音段，相邻语音段之间超过 min-silence 的静音才视为分隔点。
清单顺序与音频顺序一一对应，段数不一致会直接报错并给出诊断，不会写错文件。

只依赖 Python 标准库；输入须为 16-bit PCM 的 wav（手机录音常是 m4a，需先转码）。
"""

from __future__ import annotations

import argparse
import json
import math
import struct
import sys
import wave
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_LIST = ROOT / "scripts" / "pinyin-list.json"
DEFAULT_OUT = ROOT / "public" / "content" / "yw-1a" / "pinyin"


# ------------------------------------------------------------------ 读取
def read_wav(path: Path) -> tuple[list[float], int]:
    with wave.open(str(path), "rb") as w:
        channels = w.getnchannels()
        width = w.getsampwidth()
        rate = w.getframerate()
        frames = w.getnframes()
        raw = w.readframes(frames)

    if width != 2:
        raise SystemExit(f"只支持 16-bit PCM，当前是 {width * 8}-bit。请先转成 16-bit wav。")

    total = frames * channels
    samples = struct.unpack("<%dh" % total, raw)

    if channels > 1:
        mono = []
        for i in range(0, total, channels):
            mono.append(sum(samples[i : i + channels]) / channels)
        return mono, rate
    return list(samples), rate


# ------------------------------------------------------------------ 分段
def frame_levels(samples: list[float], rate: int, win_ms: int = 20, hop_ms: int = 10):
    win = max(1, int(rate * win_ms / 1000))
    hop = max(1, int(rate * hop_ms / 1000))
    levels = []
    for start in range(0, max(1, len(samples) - win), hop):
        chunk = samples[start : start + win]
        energy = sum(v * v for v in chunk) / win
        rms = math.sqrt(energy)
        db = 20 * math.log10(rms / 32768) if rms > 0 else -120.0
        levels.append((start, db))
    return levels, win


def find_voices(levels, threshold_db: float):
    segments = []
    in_voice = False
    start = 0
    for pos, db in levels:
        if db >= threshold_db and not in_voice:
            in_voice = True
            start = pos
        elif db < threshold_db and in_voice:
            in_voice = False
            segments.append([start, pos])
    if in_voice:
        segments.append([start, levels[-1][0]])
    return segments


def merge_gaps(segments, max_gap: float):
    merged = []
    for seg in segments:
        if merged and seg[0] - merged[-1][1] <= max_gap:
            merged[-1][1] = seg[1]
        else:
            merged.append(seg)
    return merged


# ------------------------------------------------------------------ 主流程
def main() -> int:
    parser = argparse.ArgumentParser(description="把连续拼音朗读切成单个拼音音频")
    parser.add_argument("--input", required=True, help="录制好的 wav 文件")
    parser.add_argument("--list", default=str(DEFAULT_LIST), help="拼音清单 json")
    parser.add_argument("--out", default=str(DEFAULT_OUT), help="输出目录")
    parser.add_argument("--threshold-db", type=float, default=-40.0, help="静音判定阈值，默认 -40 dBFS")
    parser.add_argument("--min-silence", type=float, default=0.45, help="判定为分隔的最短静音，秒")
    parser.add_argument("--merge-gap", type=float, default=0.22, help="小于此值的间隙视为同一音节内部，秒")
    parser.add_argument("--min-voice", type=float, default=0.10, help="短于此值的片段丢弃，秒")
    parser.add_argument("--padding", type=float, default=0.06, help="每段前后保留的留白，秒")
    parser.add_argument("--dry-run", action="store_true", help="只输出切分诊断，不写文件")
    args = parser.parse_args()

    src = Path(args.input)
    if not src.exists():
        raise SystemExit(f"找不到音频：{src}")
    if src.suffix.lower() != ".wav":
        raise SystemExit(
            f"只支持 wav，当前是 {src.suffix}。"
            "可用 ffmpeg 转换：ffmpeg -i input.m4a -ac 1 -ar 16000 -acodec pcm_s16le out.wav"
        )

    spec = json.loads(Path(args.list).read_text(encoding="utf-8"))
    items = [item for group in spec["groups"] for item in group["items"]]

    samples, rate = read_wav(src)
    duration = len(samples) / rate
    levels, win = frame_levels(samples, rate)

    raw_segments = find_voices(levels, args.threshold_db)
    merged = merge_gaps(raw_segments, args.merge_gap * rate)
    segments = [s for s in merged if (s[1] - s[0]) / rate >= args.min_voice]

    print(f"音频时长 {duration:.2f}s，采样率 {rate}Hz")
    print(f"检测到语音段 {len(segments)} 个，清单需求 {len(items)} 个")

    if len(segments) != len(items):
        print("\n段数与清单不一致，未写任何文件。逐段诊断如下：")
        for i, (s, e) in enumerate(segments, 1):
            print(f"  #{i:02d}  {s / rate:6.2f}s → {e / rate:6.2f}s   时长 {(e - s) / rate:.2f}s")
        print(
            "\n常见原因：\n"
            "  1. 某两个拼音之间停顿太短，被合并成一段（调大 --min-silence 无效，应重录时停顿更久）\n"
            "  2. 漏读或多读（对照清单核对）\n"
            "  3. 首尾有杂音被当成语音（裁掉开头再试）\n"
            "  4. 环境噪声过大导致静音段未识别（降低 --threshold-db，如 -35）"
        )
        return 1

    if args.dry_run:
        print("\n--dry-run：切分结果预览")
        for item, (s, e) in zip(items, segments):
            print(f"  {item['file']:<10} {item['label']:<6} {(e - s) / rate:5.2f}s")
        return 0

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)
    pad = int(rate * args.padding)

    for item, (s, e) in zip(items, segments):
        start = max(0, s - pad)
        end = min(len(samples), e + pad)
        chunk = [int(max(-32768, min(32767, v))) for v in samples[start:end]]
        target = out_dir / f"{item['file']}.wav"
        with wave.open(str(target), "wb") as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(rate)
            w.writeframes(struct.pack("<%dh" % len(chunk), *chunk))

    print(f"\n已输出 {len(items)} 个文件到 {out_dir}")
    print("下一步：在课时 JSON 的 audio 区块里用 src 指向这些文件，例如")
    print('  { "type": "audio", "src": "/content/yw-1a/pinyin/09-g.wav", "text": "g", "caption": "听 g 的音" }')
    return 0


if __name__ == "__main__":
    sys.exit(main())

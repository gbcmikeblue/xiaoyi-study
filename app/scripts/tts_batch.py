"""TTS 批量生成脚本（基线 Q11=A）。

扫描内容 JSON，把需要朗读的文本批量合成音频，并写入 audio-manifest.json。
前端按文本自动查表播放，因此新增音频不需要修改课时 JSON。

三种引擎：
  comfy  ComfyUI + 开源 TTS 节点（推荐）。通过 HTTP API 提交工作流、轮询结果、下载音频
  sapi   Windows 内置语音（离线兜底，零配置）。输出 16 kHz wav
  edge   edge-tts 在线接口（当前微软返回 403，基本不可用，仅作历史保留）

用法：
  python scripts/tts_batch.py --dry-run
  python scripts/tts_batch.py --engine comfy --config scripts/tts_config.json
  python scripts/tts_batch.py --engine comfy --limit 3
  python scripts/tts_batch.py --engine sapi
"""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CONTENT = ROOT / "public" / "content"
MANIFEST = CONTENT / "audio-manifest.json"
DEFAULT_CONFIG = ROOT / "scripts" / "tts_config.json"
DEFAULT_SAPI_VOICE = "Microsoft Huihui Desktop"
DEFAULT_SAPI_VOICE_EN = "Microsoft Zira Desktop"
AUDIO_EXTS = (".wav", ".mp3", ".flac", ".ogg", ".m4a")

# 界面反馈语：不写在课时 JSON 里，但同样需要固定音色
UI_TEXTS = ["答对了", "再试一次", "太棒了", "完成啦"]


# ---------------------------------------------------------------- 内容扫描
def collect_texts(lesson: dict) -> list[str]:
    texts: list[str] = []
    for block in lesson.get("blocks", []):
        if block.get("type") == "chars":
            for item in block.get("items", []):
                if item.get("char"):
                    texts.append(item["char"])
                if item.get("word"):
                    texts.append(item["word"])
        elif block.get("type") == "words":
            for item in block.get("items", []):
                if item.get("text"):
                    texts.append(item["text"])
        elif block.get("type") == "audio":
            if block.get("text"):
                texts.append(block["text"])
    for exercise in lesson.get("exercises", []):
        if exercise.get("speakText"):
            texts.append(exercise["speakText"])
    return texts


def build_index(suffix: str) -> tuple[dict[str, str], dict[str, list[str]], dict[str, str]]:
    volumes = json.loads((CONTENT / "index.json").read_text(encoding="utf-8"))
    ready = {v["id"] for v in volumes if v.get("ready")}
    subject_of = {v["id"]: v.get("subject", "chinese") for v in volumes}

    index: dict[str, str] = {}
    sources: dict[str, list[str]] = {}
    subjects: dict[str, str] = {}

    for volume_id in sorted(ready):
        volume_dir = CONTENT / volume_id
        if not volume_dir.exists():
            continue
        for lesson_file in sorted(volume_dir.glob("*.json")):
            if lesson_file.name == "units.json":
                continue
            lesson = json.loads(lesson_file.read_text(encoding="utf-8"))
            for text in collect_texts(lesson):
                text = text.strip()
                if not text:
                    continue
                name = hashlib.md5(text.encode("utf-8")).hexdigest()[:12]
                index[text] = f"{volume_id}/audio/{name}{suffix}"
                sources.setdefault(text, []).append(lesson_file.stem)
                subjects.setdefault(text, subject_of.get(volume_id, "chinese"))

    # 界面反馈语单独放在 ui/ 目录，与教材内容解耦
    for text in UI_TEXTS:
        name = hashlib.md5(text.encode("utf-8")).hexdigest()[:12]
        index[text] = f"ui/audio/{name}{suffix}"
        sources.setdefault(text, []).append("ui")
        subjects.setdefault(text, "chinese")

    return index, sources, subjects


def pending(index: dict[str, str], limit: int | None, force: bool) -> list[tuple[str, str]]:
    todo = [(t, p) for t, p in index.items() if force or not (CONTENT / p).exists()]
    return todo[:limit] if limit else todo


# ---------------------------------------------------------------- SAPI
def synthesize_sapi(index, subjects, voice, en_voice, rate, limit, force) -> tuple[int, dict[str, str]]:
    todo = pending(index, limit, force)
    if not todo:
        print("没有需要生成的条目")
        return 0, index

    lines = [
        "Add-Type -AssemblyName System.Speech",
        "$s = New-Object System.Speech.Synthesis.SpeechSynthesizer",
        f"$s.Rate = {rate}",
        "$s.Volume = 100",
    ]
    current_voice = None
    for text, rel in todo:
        # 英语册用英文音色，避免中腔英读
        want = en_voice if subjects.get(text) == "english" else voice
        if want != current_voice:
            lines.append(f'$s.SelectVoice("{want}")')
            current_voice = want
        out = CONTENT / rel
        out.parent.mkdir(parents=True, exist_ok=True)
        lines.append(f'$s.SetOutputToWaveFile("{out}")')
        lines.append(f'$s.Speak("{text.replace(chr(34), chr(96) + chr(34))}")')
        lines.append("$s.SetOutputToNull()")
        print(f"  queue  {text}  ->  {rel}")
    lines.append("$s.Dispose()")

    with tempfile.NamedTemporaryFile("w", suffix=".ps1", delete=False, encoding="utf-8-sig") as fh:
        fh.write("\n".join(lines))
        script = fh.name

    result = subprocess.run(
        ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", script],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        print(result.stdout)
        print(result.stderr)
        raise SystemExit("SAPI 合成失败")

    made = sum(1 for _, rel in todo if (CONTENT / rel).exists())
    return made, index


# ---------------------------------------------------------------- Edge
def synthesize_edge(index, voice, rate, limit, force):
    try:
        import asyncio

        import edge_tts
    except ImportError:
        raise SystemExit("缺少依赖： pip install edge-tts")

    todo = pending(index, limit, force)

    async def run() -> int:
        sem = asyncio.Semaphore(4)
        count = 0

        async def one(text: str, rel: str) -> None:
            nonlocal count
            out = CONTENT / rel
            out.parent.mkdir(parents=True, exist_ok=True)
            async with sem:
                await edge_tts.Communicate(text, voice, rate=rate).save(str(out))
                count += 1

        await asyncio.gather(*(one(t, p) for t, p in todo))
        return count

    return asyncio.run(run()), index


# ---------------------------------------------------------------- ComfyUI
def parse_skill_json(raw: str) -> dict:
    """skill 输出可能是缩进 JSON，也可能夹带日志，取最外层 {} 再解析。"""
    text = (raw or "").strip()
    if not text:
        return {}
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    start = text.find("{")
    end = text.rfind("}")
    if start >= 0 and end > start:
        try:
            return json.loads(text[start : end + 1])
        except json.JSONDecodeError:
            pass
    raise SystemExit(f"无法解析 ComfyUI 输出：{text[:300]}")


def synthesize_comfy(index, subjects, config, limit, force) -> tuple[int, dict[str, str]]:
    """经 comfyui-local skill 的 CLI 逐条生成，复用其工作流转换、参数绑定与产物下载。"""
    skill_py = Path(str(config.get("skill_comfy_py", "")))
    if not skill_py.exists():
        raise SystemExit(
            "找不到 comfyui-local 的 comfy.py，请在 scripts/tts_config.json 中配置 skill_comfy_py"
        )

    alias = str(config.get("alias", "ming"))
    voice_zh = config.get("voice_zh", DEFAULT_SAPI_VOICE)
    voice_en = config.get("voice_en", DEFAULT_SAPI_VOICE_EN)
    param_text = str(config.get("param_text", "text"))
    param_voice = config.get("param_voice", "voice")
    extra = config.get("extra_params") or {}
    timeout = int(config.get("timeout", 300))

    todo = pending(index, limit, force)
    if not todo:
        print("没有需要生成的条目")
        return 0, index

    made = 0
    for text, rel in todo:
        voice = voice_en if subjects.get(text) == "english" else voice_zh
        with tempfile.TemporaryDirectory() as tmp:
            cmd = [sys.executable, str(skill_py), "run", alias, "-p", f"{param_text}={text}"]
            if param_voice:
                cmd += ["-p", f"{param_voice}={voice}"]
            for key, value in extra.items():
                cmd += ["-p", f"{key}={value}"]
            cmd += ["--out", tmp, "--json"]
            try:
                res = subprocess.run(
                    cmd,
                    capture_output=True,
                    text=True,
                    encoding="utf-8",
                    errors="replace",
                    timeout=timeout,
                )
            except subprocess.TimeoutExpired:
                raise SystemExit(f"ComfyUI 调用超时（{timeout}s）：{text}")

            if res.returncode != 0:
                detail = (res.stderr or res.stdout or "").strip()[:400]
                raise SystemExit(f"ComfyUI 调用失败（{text}）：{detail}")

            data = parse_skill_json(res.stdout)

            audio = next((f for f in data.get("files", []) if f.get("kind") == "audio"), None)
            if not audio:
                raise SystemExit(f"ComfyUI 未返回音频：{text}")

            ext = Path(audio["path"]).suffix.lower() or ".flac"
            target_rel = str(Path(rel).with_suffix(ext))
            target = CONTENT / target_rel
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(audio["path"], target)

            if target_rel != rel:
                index[text] = target_rel
            made += 1
            print(f"  ok  {text}  ->  {target_rel}  ({audio.get('bytes', 0)} B)")
    return made, index


# ---------------------------------------------------------------- 入口
def load_config(path: Path) -> dict:
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    example = ROOT / "scripts" / "tts_config.example.json"
    if example.exists():
        print(f"未找到 {path.name}，已回退到示例配置 {example.name}（请先复制并修改）")
        return json.loads(example.read_text(encoding="utf-8"))
    return {}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--engine", choices=["comfy", "sapi", "edge"], default="comfy")
    parser.add_argument("--config", default=str(DEFAULT_CONFIG))
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--voice", default=None)
    parser.add_argument("--voice-en", default=None, help="英语册使用的音色")
    parser.add_argument("--rate", default=None)
    args = parser.parse_args()

    suffix = ".mp3" if args.engine == "edge" else (".flac" if args.engine == "comfy" else ".wav")
    index, sources, subjects = build_index(suffix)
    total_chars = sum(len(t) for t in index)

    print(f"引擎 {args.engine}｜待合成 {len(index)} 条，共 {total_chars} 字")
    for text, origin in list(sources.items())[:5]:
        print(f"  示例: {text!r} <- {', '.join(sorted(set(origin)))}")

    if args.dry_run:
        print(f"\n--dry-run：其中 {len(pending(index, args.limit, args.force))} 条缺少音频")
        return 0

    if args.engine == "comfy":
        config = load_config(Path(args.config))
        made, index = synthesize_comfy(index, subjects, config, args.limit, args.force)
    elif args.engine == "sapi":
        voice = args.voice or DEFAULT_SAPI_VOICE
        voice_en = args.voice_en or DEFAULT_SAPI_VOICE_EN
        rate = int(args.rate) if args.rate is not None else -2
        made, index = synthesize_sapi(
            index, subjects, voice, voice_en, rate, args.limit, args.force
        )
    else:
        made, index = synthesize_edge(
            index, args.voice or "zh-CN-XiaoxiaoNeural", args.rate or "-8%", args.limit, args.force
        )

    MANIFEST.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST.write_text(json.dumps(index, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n生成 {made} 条，清单写入 {MANIFEST.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

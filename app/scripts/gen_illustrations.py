"""按 illustration-prompts.json 批量生成课时插图。

用法：
    python scripts/gen_illustrations.py --vol yw-1a            # 生成该册缺图的课时
    python scripts/gen_illustrations.py --vol yw-1a --limit 8  # 只做前 8 张
    python scripts/gen_illustrations.py --vol yw-1a --dry-run  # 只看会生成哪些
"""
import argparse
import json
import pathlib
import subprocess
import sys
import time

ROOT = pathlib.Path(__file__).resolve().parent.parent
CONTENT = ROOT / "public" / "content"
OUT_DIR = ROOT / "public" / "assets" / "lessons"
PROMPTS = ROOT / "scripts" / "illustration-prompts.json"
COMFY = pathlib.Path.home() / ".codebuddy" / "skills" / "comfyui-local" / "scripts" / "comfy.py"
FFMPEG = pathlib.Path(r"D:\tools\ffmpeg-9.0.2-essentials_build\bin\ffmpeg.exe")

STYLE = (
    " Flat vector illustration for a first-grade school textbook, {scene}."
    " Pure flat color blocks, no outlines, no gradients, no texture,"
    " rounded geometric shapes, simple composition,"
    " warm palette of orange #F5871F, teal #1F8A8A, cream #FAF7F0, brown #6B4A2F,"
    " generous negative space, children textbook style, absolutely no text or letters."
)


def lessons_without_image(vol: str) -> list[tuple[str, str]]:
    """缺图的课时：既没有 image 块，也没有落盘好的 webp。"""
    d = CONTENT / vol
    img_dir = d / "img"
    units = json.loads((d / "units.json").read_text(encoding="utf-8"))
    out = []
    for u in units:
        for lesson in u["lessons"]:
            lid = lesson["id"]
            f = d / f"{lid}.json"
            if not f.exists():
                continue
            if (img_dir / f"{lid}.webp").exists():
                continue
            data = json.loads(f.read_text(encoding="utf-8"))
            if any(b.get("type") == "image" for b in data.get("blocks", [])):
                continue
            out.append((lid, lesson["title"]))
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--vol", required=True, help="册 id，如 yw-1a")
    ap.add_argument("--limit", type=int, default=0, help="本次最多生成几张")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    prompts = json.loads(PROMPTS.read_text(encoding="utf-8"))
    todo = lessons_without_image(args.vol)
    if args.limit:
        todo = todo[: args.limit]

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    made, skipped = 0, []

    for lid, title in todo:
        scene = prompts.get(lid)
        if not scene:
            skipped.append(f"{lid} {title}（无 prompt）")
            continue
        png = OUT_DIR / f"{lid}.png"
        if png.exists():
            print(f"跳过（已存在）：{lid}")
            continue
        if args.dry_run:
            print(f"[dry] {lid} | {title} | {scene[:60]}")
            continue

        before = {p.name for p in OUT_DIR.glob("*.png")}
        cmd = [
            sys.executable,
            str(COMFY),
            "t2i",
            STYLE.format(scene=scene),
            "--width",
            "1024",
            "--height",
            "1024",
            "--seed",
            "42",
            "--out",
            str(OUT_DIR),
            "--json",
        ]
        t0 = time.time()
        r = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")
        if r.returncode != 0:
            print(f"失败：{lid} -> {(r.stderr or '')[:180]}")
            continue

        new = [p for p in OUT_DIR.glob("*.png") if p.name not in before]
        if not new:
            print(f"失败：{lid} 没有产物")
            continue
        new[0].rename(png)

        # 顺手转 WebP 并删 PNG
        vol_dir = CONTENT / args.vol / "img"
        vol_dir.mkdir(parents=True, exist_ok=True)
        webp = vol_dir / f"{lid}.webp"
        subprocess.run(
            [str(FFMPEG), "-y", "-loglevel", "error", "-i", str(png), "-quality", "82", str(webp)],
            capture_output=True,
        )
        png.unlink(missing_ok=True)
        made += 1
        print(f"完成 {made}: {lid} {title}  {webp.stat().st_size // 1024} KB  {time.time() - t0:.0f}s")

    print(f"\n本次生成 {made} 张")
    if skipped:
        print("缺 prompt：")
        for s in skipped:
            print(f"  {s}")


if __name__ == "__main__":
    main()

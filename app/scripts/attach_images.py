"""把课时插图以 image 块插入到 blocks 首位。

用法：python scripts/attach_images.py
插图文件约定：public/content/<volume>/img/<lessonId>.webp
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CONTENT = ROOT / "public" / "content"

CAPTIONS = {
    "yw-1a-u1-l01": ("三个人站在天地之间，上方是一轮太阳", "天在上，地在下，人在中间"),
    "yw-1a-u5-l01": ("树叶从树上落下，天空有一群大雁往南飞", "秋天到了，树叶黄了，大雁往南飞"),
    "yw-1a-u7-l01": ("一个孩子坐在月牙形的小船里，漂浮在星空", "弯弯的月儿小小的船"),
    "sx-1a-u1-l01": ("村口有两座房子、一棵树和三只小鸡", "数一数，村里有几座房子、几只小鸡"),
    "yy-1a-u1-l01": ("爸爸、妈妈和孩子站在一起", "This is my family"),
}


def main() -> None:
    attached = 0
    for vol_dir in sorted(CONTENT.iterdir()):
        if not vol_dir.is_dir() or vol_dir.name in {"ui", "audio-manifest.json"}:
            continue
        img_dir = vol_dir / "img"
        if not img_dir.is_dir():
            continue
        for webp in sorted(img_dir.glob("*.webp")):
            lesson_id = webp.stem
            lesson_file = vol_dir / f"{lesson_id}.json"
            if not lesson_file.exists():
                print(f"跳过（无课时文件）：{webp.name}")
                continue

            data = json.loads(lesson_file.read_text(encoding="utf-8"))
            blocks = data.get("blocks", [])
            if blocks and blocks[0].get("type") == "image":
                print(f"已有图，跳过：{lesson_id}")
                continue

            alt, caption = CAPTIONS.get(lesson_id, (data.get("title", ""), ""))
            block = {
                "type": "image",
                "src": f"/content/{vol_dir.name}/img/{webp.name}",
                "alt": alt,
            }
            if caption:
                block["caption"] = caption
            blocks.insert(0, block)
            data["blocks"] = blocks

            lesson_file.write_text(
                json.dumps(data, ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
            )
            attached += 1
            print(f"已接入：{lesson_id} ← {webp.name}")

    print(f"\n共接入 {attached} 张插图")


if __name__ == "__main__":
    main()

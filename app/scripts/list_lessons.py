"""列出各册课时内容摘要，用于为插图写场景描述。"""
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
CONTENT = ROOT / "public" / "content"

target = sys.argv[1] if len(sys.argv) > 1 else None

index = json.loads((CONTENT / "index.json").read_text(encoding="utf-8"))
for vol in index:
    if target and vol["id"] != target:
        continue
    d = CONTENT / vol["id"]
    units_file = d / "units.json"
    if not units_file.exists():
        continue
    units = json.loads(units_file.read_text(encoding="utf-8"))
    print(f"\n##### {vol['id']}  {vol['title']}")
    for u in units:
        print(f"== {u['title']}")
        for lesson in u["lessons"]:
            f = d / f"{lesson['id']}.json"
            if not f.exists():
                continue
            data = json.loads(f.read_text(encoding="utf-8"))
            has_img = any(b.get("type") == "image" for b in data.get("blocks", []))
            body = ""
            for b in data.get("blocks", []):
                if b.get("type") == "text":
                    body = (b.get("content") or "").replace("\n", " ")[:60]
                    break
                if b.get("type") == "chars":
                    chars = "".join(i.get("char", "") for i in b.get("items", []))
                    body = f"生字：{chars}"
                    break
                if b.get("type") == "words":
                    words = "、".join(i.get("text", "") for i in b.get("items", []))
                    body = f"单词：{words}"
                    break
            flag = "[有图]" if has_img else "      "
            print(f"  {flag} {lesson['id']} | {lesson['title']} | {body}")

"""内容校验脚本（基线 Q33=C）。

检查 content 目录下的课时 JSON：
  1. 必填字段与类型
  2. 题目答案必须落在选项内
  3. 单选题只能有一个答案、多选题至少两个
  4. 选项 id 唯一、题目 id 唯一
  5. 拼音与汉字是否匹配（需要 pypinyin，缺失时跳过并提示）
  6. units.json 引用的课时文件是否存在

用法：
  python scripts/validate_content.py
  python scripts/validate_content.py --strict   # 拼音缺失也视为错误
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CONTENT = ROOT / "public" / "content"

try:
    from pypinyin import Style, lazy_pinyin

    HAS_PYPINYIN = True
except ImportError:  # pragma: no cover
    HAS_PYPINYIN = False

TONE_MARKS = "āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ"

errors: list[str] = []
warnings: list[str] = []


def err(msg: str) -> None:
    errors.append(msg)


def warn(msg: str) -> None:
    warnings.append(msg)


def load(path: Path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:  # noqa: BLE001
        err(f"{path.relative_to(ROOT)} 无法解析: {exc}")
        return None


def check_pinyin(char: str, pinyin: str, where: str) -> None:
    if not HAS_PYPINYIN:
        return
    got = pinyin.replace(" ", "").lower()
    has_tone = any(ch in TONE_MARKS for ch in got)
    style = Style.TONE if has_tone else Style.NORMAL
    expect = "".join(lazy_pinyin(char, style=style)).lower()
    if expect != got:
        err(f"{where}: 拼音不符，{char} 应为 {expect}，实际 {got}")
    elif not has_tone:
        warn(f"{where}: {char} 的拼音 {got} 未标声调，建议补全")


def check_lesson(path: Path) -> None:
    data = load(path)
    if not isinstance(data, dict):
        return
    rel = path.relative_to(ROOT)

    for key in ("id", "unitId", "volumeId", "title", "objectives", "blocks", "exercises"):
        if key not in data:
            err(f"{rel}: 缺少字段 {key}")
    if path.stem != data.get("id"):
        err(f"{rel}: 文件名与 id 不一致（{data.get('id')}）")

    for i, block in enumerate(data.get("blocks", [])):
        btype = block.get("type")
        if btype == "text" and not block.get("content"):
            err(f"{rel}: 第 {i + 1} 个区块为 text 但缺少 content")
        if btype == "chars":
            items = block.get("items") or []
            if not items:
                err(f"{rel}: 第 {i + 1} 个区块为 chars 但 items 为空")
            for item in items:
                check_pinyin(item.get("char", ""), item.get("pinyin", ""), f"{rel} 区块{i + 1}")
        if btype == "words":
            items = block.get("items") or []
            if not items:
                err(f"{rel}: 第 {i + 1} 个区块为 words 但 items 为空")
            for item in items:
                if not (item.get("text") or "").strip():
                    err(f"{rel}: 第 {i + 1} 个区块存在空单词")
        if btype == "audio" and not block.get("text") and not block.get("src"):
            err(f"{rel}: 第 {i + 1} 个区块为 audio 但既无 text 也无 src")

    seen: set[str] = set()
    for ex in data.get("exercises", []):
        ex_id = ex.get("id", "")
        if ex_id in seen:
            err(f"{rel}: 题目 id 重复 {ex_id}")
        seen.add(ex_id)

        options = ex.get("options") or []
        opt_ids = [o.get("id") for o in options]
        if len(set(opt_ids)) != len(opt_ids):
            err(f"{rel}/{ex_id}: 选项 id 重复")
        for o in options:
            if not o.get("label"):
                err(f"{rel}/{ex_id}: 选项 {o.get('id')} 缺少 label")

        answer = ex.get("answer") or []
        missing = [a for a in answer if a not in opt_ids]
        if missing:
            err(f"{rel}/{ex_id}: 答案 {missing} 不在选项内")

        ex_type = ex.get("type")
        if ex_type in ("single", "listen") and len(answer) != 1:
            err(f"{rel}/{ex_id}: {ex_type} 题必须且只能有 1 个答案，实际 {len(answer)}")
        if ex_type == "multi" and len(answer) < 2:
            err(f"{rel}/{ex_id}: 多选题至少 2 个答案，实际 {len(answer)}")
        if ex_type == "listen" and not ex.get("speakText"):
            warn(f"{rel}/{ex_id}: 听力题缺少 speakText")


def check_units(path: Path) -> None:
    units = load(path)
    if not isinstance(units, list):
        return
    rel = path.relative_to(ROOT)
    for unit in units:
        for lesson in unit.get("lessons", []):
            lesson_file = path.parent / f"{lesson.get('id')}.json"
            if not lesson_file.exists():
                err(f"{rel}: 单元「{unit.get('title')}」引用的课时 {lesson.get('id')} 文件不存在")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--strict", action="store_true", help="拼音校验不可用时视为错误")
    args = parser.parse_args()

    if not CONTENT.exists():
        print(f"内容目录不存在: {CONTENT}")
        return 1

    volumes = load(CONTENT / "index.json") or []
    ready_ids = {v.get("id") for v in volumes if v.get("ready")}

    for volume_dir in sorted(p for p in CONTENT.iterdir() if p.is_dir()):
        units_file = volume_dir / "units.json"
        if units_file.exists():
            check_units(units_file)
        if volume_dir.name not in ready_ids:
            continue
        for lesson_file in sorted(volume_dir.glob("*.json")):
            if lesson_file.name == "units.json":
                continue
            check_lesson(lesson_file)

    if not HAS_PYPINYIN:
        msg = "未安装 pypinyin，已跳过拼音校验（pip install pypinyin 后重跑）"
        if args.strict:
            err(msg)
        else:
            warn(msg)

    for w in warnings:
        print(f"[warn]  {w}")
    for e in errors:
        print(f"[error] {e}")

    total = len(errors)
    print(f"\n检查完成：{total} 个错误，{len(warnings)} 个警告")
    return 0 if total == 0 else 1


if __name__ == "__main__":
    sys.exit(main())

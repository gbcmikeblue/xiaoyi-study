"""从 pinyin-list.json 生成照读稿，便于打印或投屏朗读。

用法：python scripts/make_pinyin_sheet.py
输出：docs/pinyin-recording-sheet.md
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SPEC = ROOT / "scripts" / "pinyin-list.json"
OUT = ROOT / "docs" / "pinyin-recording-sheet.md"

PER_LINE = 4


def render_group(name: str, items: list[dict]) -> str:
    lines = []
    for i in range(0, len(items), PER_LINE):
        row = items[i : i + PER_LINE]
        cells = []
        for item in row:
            cells.append(f"{item['seq']:02d}  {item['label']:<5}{item['hint']}")
        lines.append("    ".join(cells).rstrip())
    return "\n".join(lines)


def main() -> int:
    spec = json.loads(SPEC.read_text(encoding="utf-8"))
    groups = spec["groups"]
    total = sum(len(g["items"]) for g in groups)
    pause = spec.get("pauseSeconds", 2)

    parts = [
        "# 拼音录制稿",
        "",
        f"> 共 **{total} 项**，从头到尾连续读一遍，全程约 {total * (0.4 + pause) / 60:.1f} 分钟（含停顿）。",
        f"> **每读完一个停顿 {pause} 秒**（心里默数“一、二”）。",
        "> 后面那个汉字是帮助发音的提示，**不要念出来**。",
        "> 只读音，第一声，平而稳；读错不要停，整段重录比剪辑可靠。",
        "> 录音格式：WAV（16-bit PCM），采样率 16 kHz 以上。",
        "",
        "---",
        "",
    ]

    for group in groups:
        parts.append(f"## {group['name']}（{group['range']}）")
        parts.append("")
        parts.append("```")
        parts.append(render_group(group["name"], group["items"]))
        parts.append("```")
        parts.append("")

    parts += [
        "---",
        "",
        "## 读完自检",
        "",
        "| 检查 | 正常表现 | 异常处理 |",
        "|---|---|---|",
        f"| 总时长 | 约 {total * 2.4 / 60:.1f} 分钟 | 明显偏短说明读快或漏读 |",
        "| 间隔 | 每个之间 2 秒 | 偏短会让拆分时两段连成一段 |",
        "| 环境 | 无空调声、无回声 | 换小房间重录 |",
        "",
        "## 下一步",
        "",
        "```powershell",
        "cd d:\\project\\sz-grade1-h5-edu-research\\app",
        "# 1. 把录音放进 recordings\\incoming\\",
        "# 2. 预览切分",
        "python scripts/split_pinyin.py --dry-run",
        "# 3. 正式拆分（成功后原录音自动归档）",
        "python scripts/split_pinyin.py",
        "```",
        "",
    ]

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text("\n".join(parts), encoding="utf-8")
    print(f"已生成 {OUT}（{total} 项，{len(groups)} 组）")
    return 0


if __name__ == "__main__":
    sys.exit(main())

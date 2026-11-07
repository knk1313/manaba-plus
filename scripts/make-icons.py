"""拡張機能のアイコン（icons/icon-{16,32,48,128}.png）を作る。

DADS のキーカラー（blue-900）の地に、白い時間割の表。今のコマを黄色（yellow-300）で示す。
大きく描いてから縮めて、縁をなめらかにする。16px と 32px は、潰れないよう簡単な形にする。
実行：python3 scripts/make-icons.py（Pillow が要る）
"""
from pathlib import Path

from PIL import Image, ImageDraw

BLUE = (0x00, 0x17, 0xC1, 255)
WHITE = (255, 255, 255, 255)
YELLOW = (0xFF, 0xD4, 0x3D, 255)
OUT = Path(__file__).resolve().parent.parent / "icons"
S = 1024  # 描くときの大きさ


def draw(simple: bool) -> Image.Image:
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    pad = 32
    d.rounded_rectangle([pad, pad, S - pad, S - pad], radius=220, fill=BLUE)

    if simple:
        # 16・32px：白いカード、青い見出しの線、黄色のコマ 1 つだけ
        left, top, right, bottom = 190, 220, S - 190, S - 190
        d.rounded_rectangle([left, top, right, bottom], radius=80, fill=WHITE)
        d.rectangle([left, top + 170, right, top + 290], fill=BLUE)
        cell = 210
        d.rectangle([right - 110 - cell, bottom - 110 - cell, right - 110, bottom - 110], fill=YELLOW)
        return img

    # 48・128px：時間割の表（3 × 3）。今のコマを黄色にする
    left, top, right, bottom = 200, 230, S - 200, S - 210
    line = 40
    d.rounded_rectangle([left, top, right, bottom], radius=56, fill=WHITE)
    header = top + 130
    inner = [left + line, header, right - line, bottom - line]
    d.rectangle(inner, fill=BLUE)
    cols = rows = 3
    cw = (inner[2] - inner[0] - line * (cols - 1)) / cols
    rh = (inner[3] - inner[1] - line * (rows - 1) - line) / rows
    for r in range(rows):
        for c in range(cols):
            x0 = inner[0] + c * (cw + line)
            y0 = inner[1] + line + r * (rh + line)
            d.rectangle([x0, y0, x0 + cw, y0 + rh], fill=YELLOW if (r, c) == (1, 1) else WHITE)

    # カレンダーの留め具
    ring_w = 44
    for cx in (left + (right - left) * 0.3, left + (right - left) * 0.7):
        d.rounded_rectangle([cx - ring_w / 2, top - 70, cx + ring_w / 2, top + 70], radius=ring_w / 2, fill=WHITE)
        d.rounded_rectangle([cx - ring_w / 2 + 14, top - 56, cx + ring_w / 2 - 14, top + 30], radius=ring_w / 2, fill=BLUE)
    return img


def main() -> None:
    OUT.mkdir(exist_ok=True)
    detailed = draw(simple=False)
    simple = draw(simple=True)
    for size in (16, 32, 48, 128):
        src = simple if size <= 32 else detailed
        src.resize((size, size), Image.LANCZOS).save(OUT / f"icon-{size}.png")


if __name__ == "__main__":
    main()

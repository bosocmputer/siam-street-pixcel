"""Draw the character spec sheet (front and side views with every joint and socket) from
packages/rpg-core/config/rig.json, for the creator to attach to the Gemini prompt.

    python3 newgame/tools/character_spec.py   ->  newgame/refs/character_spec.png
"""

import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
RIG = json.loads((ROOT / "packages/rpg-core/config/rig.json").read_text())
OUT = ROOT / "newgame/refs/character_spec.png"
FONT = "/usr/share/fonts/opentype/tlwg/Loma.otf"
BOLD = "/usr/share/fonts/opentype/tlwg/Loma-Bold.otf"

W, H = 2440, 1100
PX = 480  # pixels per metre
GROUND = 1000  # y pixel of the ground
INK, GRID, BODY, EDGE = "#22262b", "#e3dfd6", "#d9c7ae", "#7a6a55"
JOINT, SOCKET = "#c8402a", "#1f8a5a"

img = Image.new("RGB", (W, H), "#fbf8f2")
d = ImageDraw.Draw(img)
f = lambda s, b=False: ImageFont.truetype(BOLD if b else FONT, s)


def view(cx: int, title: str, axis: int, flip: bool) -> None:
    """Draw one view centred at pixel x `cx`; `axis` is 0 for x (front) or 2 for z (side)."""
    sx = lambda v: cx + (-v if flip else v) * PX
    sy = lambda y: GROUND - y * PX
    for i in range(0, 19):
        y = sy(i / 10)
        d.line([(cx - 260, y), (cx + 260, y)], fill=GRID, width=1)
    d.line([(cx - 280, GROUND), (cx + 280, GROUND)], fill=INK, width=3)
    d.text((cx, 40), title, font=f(34, True), fill=INK, anchor="mt")
    # far side first so the near side draws over it
    parts = sorted(RIG["parts"], key=lambda p: p["from"][0] if axis == 2 else 0)
    for p in parts:
        w = p["box"][axis]
        h = p["box"][1]
        c = p["from"][axis]
        y0 = p["from"][1]
        d.rectangle([sx(c - w / 2), sy(y0 + h), sx(c + w / 2), sy(y0)], fill=BODY, outline=EDGE, width=2)
    # labels sit in a column on each side, spread out so none overlap, with a line to the joint
    columns: dict[bool, list[tuple[float, float, str, bool]]] = {False: [], True: []}
    for j in RIG["joints"] + RIG["sockets"]:
        x, y = sx(j["at"][axis]), sy(j["at"][1])
        sock = j["name"].startswith("Socket")
        if sock:
            d.polygon([(x, y - 9), (x + 9, y), (x, y + 9), (x - 9, y)], fill=SOCKET)
        else:
            d.ellipse([x - 7, y - 7, x + 7, y + 7], fill=JOINT)
        if axis == 2 and j["name"].endswith("_R"):
            continue  # the right side hides behind the left in the side view
        if axis == 0:
            right = j["at"][0] > 0 or (j["at"][0] == 0 and j["name"] in ("Chest", "Head", "Root"))
        else:
            right = True
        columns[right].append((y, x, f'{j["name"]}  {j["at"][1]:.2f}', sock))
    for right, items in columns.items():
        items.sort()
        last = -1e9
        for y, x, label, sock in items:
            ly = max(y, last + 22)
            last = ly
            lx = cx + 300 if right else cx - 300
            color = SOCKET if sock else JOINT
            d.line([(x, y), (lx + (-8 if right else 8), ly)], fill=color, width=1)
            d.text((lx, ly), label, font=f(17), fill=color, anchor="lm" if right else "rm")


# height ruler
d.line([(70, GROUND), (70, GROUND - 1.8 * PX)], fill=INK, width=2)
for i in range(0, 19):
    y = GROUND - i / 10 * PX
    d.line([(64, y), (76, y)], fill=INK, width=2)
    if i % 2 == 0:
        d.text((58, y), f"{i / 10:.1f}", font=f(16), fill=INK, anchor="rm")
d.text((70, GROUND - 1.8 * PX - 22), "ม.", font=f(18), fill=INK, anchor="mm")

view(640, "ด้านหน้า (มองจาก +Z)", 0, False)
view(1330, "ด้านข้าง (หน้าไปทาง +Z ทางขวา)", 2, False)

# what the numbers mean
tx = 1880
lines = [
    ("สเปกตัวละคร Character_Base.glb", 30, True, INK),
    ("หน่วยเมตร · แกน Y ชี้ขึ้น · หันหน้าไป +Z", 20, False, INK),
    ("มือซ้ายของตัวละครอยู่ฝั่ง +X", 20, False, INK),
    ("ฝ่าเท้าอยู่ที่ y = 0 · สูง 1.70 ม. (ไม่รวมหมวก)", 20, False, INK),
    ("", 10, False, INK),
    ("ข้อต่อ (ชื่อ + ความสูง y)", 22, True, JOINT),
    ("ทุกข้อต่อ: ไม่หมุน (rotation 0) scale 1", 19, False, INK),
    ("จุดหมุนอยู่ตรงข้อจริง", 19, False, INK),
    ("", 10, False, INK),
    ("จุดเสียบของ (Object3D เปล่า)", 22, True, SOCKET),
    ("Socket_Head  บนกระหม่อม (วางหมวก)", 19, False, INK),
    ("Socket_Hand_L/R  กลางฝ่ามือ", 19, False, INK),
    ("แกน +Z ของ socket = ทางที่ของในมือชี้", 19, False, INK),
    ("", 10, False, INK),
    ("ชิ้นร่างกาย Body_*", 22, True, EDGE),
    ("กล่องแสดงขนาดโดยประมาณ ปั้นให้", 19, False, INK),
    ("โค้งมนได้ แต่ข้อต่อต้องอยู่ที่เดิม", 19, False, INK),
    ("", 10, False, INK),
    ("งบ: ไม่เกิน 6,000 สามเหลี่ยม · ไม่เกิน 4 วัสดุ", 20, True, INK),
    ("ไฟล์ไม่เกิน 1 MB · ไม่มี animation", 20, True, INK),
    ("ไม่มีไฟ กล้อง หรือพื้น", 20, True, INK),
]
y = 70
for text, size, bold, color in lines:
    if text.startswith("ข้อต่อ"):
        d.ellipse([tx - 26, y + 6, tx - 12, y + 20], fill=JOINT)
    elif text.startswith("จุดเสียบ"):
        d.polygon([(tx - 19, y + 4), (tx - 10, y + 13), (tx - 19, y + 22), (tx - 28, y + 13)], fill=SOCKET)
    elif text.startswith("ชิ้นร่างกาย"):
        d.rectangle([tx - 28, y + 5, tx - 10, y + 21], fill=BODY, outline=EDGE, width=2)
    d.text((tx, y), text, font=f(size, bold), fill=color)
    y += size + 14

OUT.parent.mkdir(parents=True, exist_ok=True)
img.save(OUT)
print(OUT)

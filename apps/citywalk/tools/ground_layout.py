"""Draw the ground around Tha Phae Gate from the map data, in the gate model's own frame.

The gate model has its origin in the middle of the gate opening, on the ground; +X runs along the wall
to the north, +Z points out of the city (east), Y is up. The picture is a top-down view with +X to the
right and +Z down, so it can be attached to a prompt for whoever builds the ground model.

    python3 tools/ground_layout.py [out.png]
"""

import json
import math
import os
import sys

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
WORLD = os.path.join(HERE, "..", "public", "world.json")
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "thaphae_ground_layout.png")

S = 7  # pixels per metre
X0, X1, Z0, Z1 = -135, 108, -40, 62
MX, MY = 40, 96
MAP_BOTTOM = MY + (Z1 - Z0) * S
W, H = MX * 2 + (X1 - X0) * S, MAP_BOTTOM + 120

FONT = "/usr/share/fonts/opentype/tlwg/Loma.otf"
FONT_B = "/usr/share/fonts/opentype/tlwg/Loma-Bold.otf"
f14, f16, f20 = (ImageFont.truetype(FONT, n) for n in (14, 16, 20))
f18b, f26b = ImageFont.truetype(FONT_B, 18), ImageFont.truetype(FONT_B, 26)

world = json.load(open(WORLD, encoding="utf-8"))
gate = next(m for m in world["landmarks"] if m["name"] == "ประตูท่าแพ")


def model_frame():
    near = [
        f
        for f in world["forts"]
        if any(math.hypot(f[i] - gate["x"], f[i + 1] - gate["z"]) < 40 for i in range(0, len(f), 2))
    ]
    pts = [(f[i], f[i + 1]) for f in near for i in range(0, len(f), 2)]
    cx = sum(p[0] for p in pts) / len(pts)
    cz = sum(p[1] for p in pts) / len(pts)
    sxx = sum((p[0] - cx) ** 2 for p in pts)
    szz = sum((p[1] - cz) ** 2 for p in pts)
    sxz = sum((p[0] - cx) * (p[1] - cz) for p in pts)
    a = 0.5 * math.atan2(2 * sxz, sxx - szz)
    ax, az = math.cos(a), math.sin(a)
    ox, oz = -az, ax
    if ox * gate["x"] + oz * gate["z"] < 0:
        ax, az, ox, oz = -ax, -az, -ox, -oz
    t = lambda x, z: (x - cx) * ax + (z - cz) * az
    tg = t(gate["x"], gate["z"])
    ts = [t(f[i], f[i + 1]) for f in near for i in range(0, len(f), 2)]
    mid = (max(v for v in ts if v <= tg) + min(v for v in ts if v > tg)) / 2
    px, pz = cx + ax * mid, cz + az * mid
    return lambda x, z: ((x - px) * ax + (z - pz) * az, (x - px) * ox + (z - pz) * oz)


M = model_frame()
P = lambda x, z: (MX + (x - X0) * S, MY + (z - Z0) * S)

# the road edge nearest the wall, for every X (outer face of the wall is at Z ~ 2)
segs = []
for r in world["roads"]:
    if r[1] > 1 or r[2] == 1:
        continue
    pp = [M(r[i], r[i + 1]) for i in range(3, len(r), 2)]
    for (x0, z0), (x1, z1) in zip(pp, pp[1:]):
        segs.append((x0, z0, x1, z1, r[0] / 2))


def road_edge(x):
    best = None
    for x0, z0, x1, z1, h in segs:
        if x0 != x1 and (x0 - x) * (x1 - x) <= 0:
            z = z0 + (z1 - z0) * (x - x0) / (x1 - x0)
            if z > 3 and (best is None or z - h < best):
                best = z - h
    return best


img = Image.new("RGB", (W, H), (236, 230, 216))
d = ImageDraw.Draw(img, "RGBA")


def text(xy, s, font=f16, fill=(30, 30, 30), anchor="la", bg=None):
    if bg:
        b = d.textbbox(xy, s, font=font, anchor=anchor)
        d.rectangle((b[0] - 3, b[1] - 2, b[2] + 3, b[3] + 2), fill=bg)
    d.text(xy, s, font=font, fill=fill, anchor=anchor)


# 10 m grid
for x in range(-130, 108, 10):
    d.line([P(x, Z0), P(x, Z1)], fill=(0, 0, 0, 22 if x % 50 else 60), width=1)
    if x % 20 == 0:
        text((P(x, Z1)[0], P(x, Z1)[1] + 6), f"{x:+d}", f14, (90, 90, 90), "ma")
for z in range(-10, 62, 10):
    d.line([P(X0, z), P(X1, z)], fill=(0, 0, 0, 22 if z % 50 else 60), width=1)
    text((P(X0, z)[0] - 6, P(X0, z)[1]), f"{z:+d}", f14, (90, 90, 90), "rm")

# plaza as it is in the map: from the wall to the road edge
prof = []
last = 26.0
for xi in range(-110, 77, 2):
    e = road_edge(xi)
    last = e if e is not None else last
    prof.append((xi, min(last - 0.5, 60)))
poly = [P(-110, 1.9)] + [P(x, z) for x, z in prof] + [P(76, 1.9)]
d.polygon(poly, fill=(236, 178, 120, 120), outline=(190, 110, 50, 255))
# the rectangle that fits everywhere
d.rectangle([P(-110, 1.9), P(76, 26)], outline=(170, 70, 20, 255), width=3)

# water (moat)
for q in world["water"]:
    pp = [M(q[i], q[i + 1]) for i in range(0, len(q), 2)]
    xs = [p[0] for p in pp]
    zs = [p[1] for p in pp]
    if max(xs) > X0 - 200 and min(xs) < X1 + 200 and min(zs) < Z1 and max(zs) > Z0:
        d.polygon([P(*p) for p in pp], fill=(80, 150, 205, 235), outline=(40, 100, 160, 255))

# roads from the map (the game already draws these)
for r in world["roads"]:
    if r[1] > 1 or r[2] == 1:
        continue
    pp = [P(*M(r[i], r[i + 1])) for i in range(3, len(r), 2)]
    d.line(pp, fill=(95, 98, 105, 255) if r[1] == 0 else (140, 142, 146, 255), width=max(2, int(r[0] * S)), joint="curve")

# wall wings and gate pillars (the model)
d.rectangle([P(-97.6, -0.9), P(-4.9, 1.6)], fill=(168, 80, 50, 255))
d.rectangle([P(4.9, -0.9), P(68.6, 1.6)], fill=(168, 80, 50, 255))
for sx in (-1, 1):
    d.rectangle([P(min(sx * 2.6, sx * 4.9), -1.9), P(max(sx * 2.6, sx * 4.9), 1.9)], fill=(120, 52, 30, 255))
d.rectangle([P(-2.6, -1.9), P(2.6, 1.9)], fill=(200, 140, 100, 255))  # the model's own passage floor
d.ellipse([P(0, 0)[0] - 5, P(0, 0)[1] - 5, P(0, 0)[0] + 5, P(0, 0)[1] + 5], fill=(255, 255, 255, 255), outline=(0, 0, 0, 255))


def arrow(a, b, label, side=-1, off=14, font=f16):
    (x0, y0), (x1, y1) = a, b
    d.line([a, b], fill=(20, 20, 20, 255), width=2)
    for (x, y), (u, v) in (((x0, y0), (x1 - x0, y1 - y0)), ((x1, y1), (x0 - x1, y0 - y1))):
        n = math.hypot(u, v) or 1
        u, v = u / n, v / n
        d.polygon([(x, y), (x + u * 11 - v * 5, y + v * 11 + u * 5), (x + u * 11 + v * 5, y + v * 11 - u * 5)], fill=(20, 20, 20, 255))
    mx, my = (x0 + x1) / 2, (y0 + y1) / 2
    text((mx, my + off * side), label, font, (20, 20, 20), "mm", (255, 255, 255, 220))


def guide(x, za, zb):
    d.line([P(x, za), P(x, zb)], fill=(20, 20, 20, 110), width=1)


for gx in (-110, 76):
    guide(gx, -34, 26)
for gx in (-97.6, -2.6, 2.6, 68.6):
    guide(gx, -27, 0)
arrow(P(-110, -34), P(76, -34), "ลานท่าแพ ยาว 186 ม. (X -110 ถึง +76) = ช่วงที่ข้อมูลแผนที่ไม่มีน้ำในคูเมือง", 1, -16, f18b)
arrow(P(-97.6, -27), P(-2.6, -27), "ปีกใต้ 95 ม.", 1, -14)
arrow(P(2.6, -27), P(68.6, -27), "ปีกเหนือ 66 ม.", 1, -14)
arrow(P(-2.6, -19), P(2.6, -19), "ช่องประตู 5.2 ม.", 1, -14)
arrow(P(100, 1.9), P(100, 26), "ลึก 24.1 ม.", 1, 0)
d.line([P(96, 26), P(104, 26)], fill=(20, 20, 20, 255), width=2)
d.line([P(96, 1.9), P(104, 1.9)], fill=(20, 20, 20, 255), width=2)
arrow(P(-124, 1.9), P(-124, 4.0), "", 1, 0)
text(P(-133, 9), "กำแพงห่างน้ำ 2.1 ม.", f14, (20, 60, 110), "la", (255, 255, 255, 220))

text(P(76, 46), "คูน้ำเริ่มที่ X = +76", f16, (20, 60, 110), "la", (255, 255, 255, 200))
text(P(-110, 46), "คูน้ำสิ้นสุดที่ X = -110", f16, (20, 60, 110), "ra", (255, 255, 255, 200))
text(P(-20, 55), "ถนนหลักจากแผนที่ (กว้าง 10 ม.) เกมวาดให้อยู่แล้ว ไม่ต้องทำในโมเดล", f16, (40, 40, 45), "ma", (255, 255, 255, 220))
text(P(-60, 33), "ลานเว้าลึกถึง ~48 ม. เพราะถนนถอยห่างออกไป", f16, (130, 60, 10), "ma", (255, 255, 255, 220))

d.rectangle([0, 0, W, 78], fill=(40, 44, 52, 255))
text((18, 10), "ลานประตูท่าแพ ตามข้อมูลแผนที่จริง (มองจากด้านบน มาตราส่วน 1 ตารางเล็ก = 10 ม.)", f26b, (255, 255, 255))
text((18, 46), "จุดขาว = จุดกำเนิด (0,0,0) กลางช่องประตู · ขวา = +X ทิศเหนือ · ลง = +Z ด้านนอกเมือง (ตะวันออก) · Y ชี้ขึ้น", f16, (220, 220, 220))

d.rectangle([0, MAP_BOTTOM + 28, W, H], fill=(255, 255, 255, 255))
ly = MAP_BOTTOM + 44
items = [
    ((236, 178, 120, 255), "พื้นลานที่ควรมีตามแผนที่ (จากกำแพงถึงขอบถนน)"),
    ((255, 255, 255, 255), "กรอบส้มเข้ม = สี่เหลี่ยมที่พอดีทุกจุด: X -110..+76, Z 1.9..26"),
    ((168, 80, 50, 255), "ปีกกำแพงและเสาประตู (โมเดลของคุณ)"),
    ((80, 150, 205, 255), "คูน้ำ (จากข้อมูลแผนที่)"),
    ((95, 98, 105, 255), "ถนน (จากข้อมูลแผนที่)"),
]
for i, (c, label) in enumerate(items):
    x = MX + (i % 3) * 560
    y = ly + (i // 3) * 30
    d.rectangle([x, y, x + 22, y + 16], fill=c, outline=(170, 70, 20, 255) if i == 1 else (0, 0, 0, 255), width=3 if i == 1 else 1)
    text((x + 32, y + 8), label, f16, (20, 20, 20), "lm")

img.save(OUT)
print("saved", OUT, img.size)

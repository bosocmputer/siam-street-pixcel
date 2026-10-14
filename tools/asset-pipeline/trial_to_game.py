"""Turn the approved PixelLab trial art (assets/trial) into game-ready files (apps/web/public/assets).

Offline and free: no PixelLab calls. Needs Pillow:  python3 -m pip install pillow
Run from the repo root:  python3 tools/asset-pipeline/trial_to_game.py

What it does
- slime_b.png            copied as is (48x48 canvas, body 20x18)
- slime_b_noeyes.png     the same slime with the original face painted over, so the game can draw
                         the other eye styles the player can pick in the creator
- hat_ngob.png           the generated hat is wider than the slime (24 px vs 20 px) and does not survive shrinking,
                         so a 16 px hat is redrawn by hand with the same colours
- monster_brick_imp.png, basket_kratip.png   copied as is
- manifest.json          lists the files for apps/web/src/art (keys: body:b, body:b_noeyes, hat:ngob, ...)
"""
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "assets" / "trial"
OUT = ROOT / "apps" / "web" / "public" / "assets"
OUT.mkdir(parents=True, exist_ok=True)

BODY_BOX = (14, 15, 34, 33)  # where the 20x18 body sits inside the 48x48 canvas


def alpha_bbox(im: Image.Image):
    return im.getchannel("A").point(lambda a: 255 if a > 8 else 0).getbbox()


def snap_to_palette(im: Image.Image, palette: list[tuple[int, int, int]]) -> Image.Image:
    out = im.copy()
    px = out.load()
    for y in range(out.height):
        for x in range(out.width):
            r, g, b, a = px[x, y]
            if a < 128:
                px[x, y] = (0, 0, 0, 0)
                continue
            best = min(palette, key=lambda c: (c[0] - r) ** 2 + (c[1] - g) ** 2 + (c[2] - b) ** 2)
            px[x, y] = (*best, 255)
    return out


def main() -> None:
    slime = Image.open(SRC / "slime_b.png").convert("RGBA")
    slime.save(OUT / "slime_b.png")

    # paint over the face: eyes live in two small boxes of the 20x18 body, body colour there is #8edc93
    body = slime.crop(BODY_BOX)
    body_px = body.load()
    fill = (0x8E, 0xDC, 0x93, 255)
    for box in ((4, 6, 9, 11), (12, 6, 17, 11)):  # x0, y0, x1, y1 (exclusive)
        for y in range(box[1], box[3]):
            for x in range(box[0], box[2]):
                body_px[x, y] = fill
    noeyes = slime.copy()
    noeyes.paste(body, BODY_BOX[:2])
    noeyes.save(OUT / "slime_b_noeyes.png")

    # The generated hat is wider than the slime and lost its shape when shrunk, so it is redrawn by hand
    # at the right size with the colours of the generated one (it is a stand-in until a new hat is made).
    rows = [
        ".......BB.......",
        "......BHYB......",
        ".....BHYYYB.....",
        "....BHYTYYYB....",
        "...BHYYTYYTYB...",
        "..BHYTYYTYYTYB..",
        ".BHYYTYYYTYYYTB.",
        "BBTTTTTTTTTTTTBB",
        ".BBBBBBBBBBBBBB.",
    ]
    colours = {"B": (0x4A, 0x2A, 0x10), "H": (0xFF, 0xE9, 0xA8), "Y": (0xF0, 0xCC, 0x7A), "T": (0xC1, 0x90, 0x3A)}
    canvas = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch in colours:
                canvas.putpixel((x, y + 3), (*colours[ch], 255))
    canvas.save(OUT / "hat_ngob.png")

    for name in ("monster_brick_imp.png", "basket_kratip.png"):
        Image.open(SRC / name).convert("RGBA").save(OUT / name)

    manifest = {
        "images": {
            "body:b": "slime_b.png",
            "body:b_noeyes": "slime_b_noeyes.png",
            "hat:ngob": "hat_ngob.png",
            "monster:brick_imp": "monster_brick_imp.png",
            "ui:kratip": "basket_kratip.png",
        }
    }
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print("wrote", sorted(p.name for p in OUT.iterdir()))


if __name__ == "__main__":
    main()

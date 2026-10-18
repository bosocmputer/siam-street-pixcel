#!/usr/bin/env python3
"""Pack pixel-art frames (for example a character exported from PixelLab) into a sprite sheet
the game reads: one picture per animation, a row per direction, a column per frame, and a
sheet.json describing them. List the sheet in apps/citywalk/public/assets.json under "sprites"
to use it in place of the sprite the game draws from the model (see
newgame/prompts/sprite_import.md).

Input folder layout (PixelLab's character export has this shape):

    <in>/animations/<anim>/<direction>/<frame>.png   frames in name order
    <in>/rotations/<direction>.png                   one still per direction (used as "idle"
                                                     when there is no idle animation)

Directions: south (facing the viewer), south-east, east (facing screen right), north-east,
north, north-west, west, south-west. With all eight the sheet has 8 rows; otherwise 5 (the
left-facing ones are mirrored in the game). A missing direction takes the nearest one there is.

Animation names: the game plays idle, walk, run, cast, hurt, down, ride (hero) or the model's
clip names (monsters: Idle, Jumping, Squishing, Attacking ...). Rename with --name old=new.

    python3 pack.py <in> <out-folder> --height 1.7 [--fps walk=10] [--once cast,hurt,down]
"""

import argparse
import json
import sys
from pathlib import Path

from PIL import Image

DIRS = ["south", "south-east", "east", "north-east", "north", "north-west", "west", "south-west"]
ALIASES = {
    "s": "south", "front": "south", "down": "south",
    "se": "south-east", "south_east": "south-east", "southeast": "south-east",
    "e": "east", "right": "east",
    "ne": "north-east", "north_east": "north-east", "northeast": "north-east",
    "n": "north", "back": "north", "up": "north",
    "nw": "north-west", "north_west": "north-west", "northwest": "north-west",
    "w": "west", "left": "west",
    "sw": "south-west", "south_west": "south-west", "southwest": "south-west",
}


def direction(name: str):
    n = name.lower()
    n = ALIASES.get(n, n)
    return n if n in DIRS else None


def read_frames(folder: Path):
    """{anim: {direction: [Image]}} from the export folder."""
    anims = {}
    adir = folder / "animations"
    if adir.is_dir():
        for a in sorted(p for p in adir.iterdir() if p.is_dir()):
            for d in sorted(p for p in a.iterdir() if p.is_dir()):
                k = direction(d.name)
                if not k:
                    print(f"skipped {d}: not a direction", file=sys.stderr)
                    continue
                frames = [Image.open(f).convert("RGBA") for f in sorted(d.glob("*.png"))]
                if frames:
                    anims.setdefault(a.name, {})[k] = frames
    rdir = folder / "rotations"
    if rdir.is_dir():
        still = {}
        for f in sorted(rdir.glob("*.png")):
            k = direction(f.stem)
            if k:
                still[k] = [Image.open(f).convert("RGBA")]
        if still and "idle" not in {a.lower() for a in anims}:
            anims["idle"] = still
    return anims


def nearest(have: dict, want: str):
    i = DIRS.index(want)
    for step in (0, 1, -1, 2, -2, 3, -3, 4):
        k = DIRS[(i + step) % 8]
        if k in have:
            return have[k], step != 0
    raise ValueError("no directions")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("src", type=Path)
    ap.add_argument("out", type=Path)
    ap.add_argument("--height", type=float, default=1.7, help="how tall the character stands, metres")
    ap.add_argument("--fps", default="", help="frames a second per animation, e.g. walk=10,idle=4 (default 8)")
    ap.add_argument("--once", default="cast,hurt,down", help="animations that play once, not loop")
    ap.add_argument("--name", action="append", default=[], help="rename an animation: old=new")
    o = ap.parse_args()

    anims = read_frames(o.src)
    for r in o.name:
        old, new = r.split("=", 1)
        if old in anims:
            anims[new] = anims.pop(old)
    if "idle" not in anims:
        sys.exit("there is no idle animation and no rotations/ folder to make one from")
    fps = {k: float(v) for k, v in (p.split("=") for p in o.fps.split(",") if p)}
    once = {a for a in o.once.split(",") if a}

    used = {k for a in anims.values() for k in a}
    dirs = 8 if len(used) == 8 else 5
    for a, by in anims.items():
        filled = [d for d in DIRS[:dirs] if d not in by]
        if filled:
            print(f"{a}: {', '.join(filled)} taken from the nearest direction", file=sys.stderr)

    # one frame size for the whole sheet: the biggest picture, frames centred, feet on the line
    fw = max(f.width for a in anims.values() for fs in a.values() for f in fs)
    fh = max(f.height for a in anims.values() for fs in a.values() for f in fs)
    # where the feet are (the lowest drawn row) and the top of the head, in the "south" idle
    idle = nearest(anims["idle"], "south")[0][0]
    box = idle.getbbox()
    if not box:
        sys.exit("the idle picture is empty")
    oy = fh - idle.height
    feet, top = box[3] + oy, box[1] + oy
    ppm = round((feet - top) / o.height, 2)

    o.out.mkdir(parents=True, exist_ok=True)
    meta = {"frame": [fw, fh], "anchor": [fw // 2, feet], "ppm": ppm, "dirs": dirs, "anims": {}, "pages": []}
    for page, (name, by) in enumerate(anims.items()):
        n = max(len(fs) for fs in by.values())
        sheet = Image.new("RGBA", (n * fw, dirs * fh))
        for row, d in enumerate(DIRS[:dirs]):
            frames, _ = nearest(by, d)
            for col in range(n):
                f = frames[col % len(frames)]
                sheet.paste(f, (col * fw + (fw - f.width) // 2, row * fh + fh - f.height))
        file = f"{name}.png"
        sheet.save(o.out / file)
        meta["pages"].append(file)
        meta["anims"][name] = {
            "page": page,
            "row": 0,
            "frames": n,
            "fps": fps.get(name, 8),
            "loop": name not in once,
        }
    (o.out / "sheet.json").write_text(json.dumps(meta, indent=2) + "\n")
    print(f"{o.out / 'sheet.json'}: {len(anims)} animations, {dirs} directions, {fw}x{fh} frames, {ppm} px/m")


if __name__ == "__main__":
    main()

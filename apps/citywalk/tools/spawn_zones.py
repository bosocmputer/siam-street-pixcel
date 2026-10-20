"""Place monsters and rest points on the real map and write packages/rpg-core/config/spawns.json.

Zones follow newgame/playtest_mmo.md: levels rise with the distance from the start at Tha Phae
Gate, the moat ring is the last zone before its boss at the Si Phum corner. Every monster stands
on a road, clear of buildings and water, at least `templeClear` metres from a temple's grounds and
clear of every rest point. Same input, same output (a fixed seed).

    python3 apps/citywalk/tools/spawn_zones.py
"""
import json
import math
import random
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
WORLD = ROOT / "apps/citywalk/public/world.json"
OUT = ROOT / "packages/rpg-core/config/spawns.json"

TEMPLE_CLEAR = 40
REST_RADIUS = 20
ACTIVE_RANGE = 90
SPACING = 28
# the start, in front of Tha Phae Gate (map metres; the gate frame's [0, 20])
START = (803.9, 71.4)

# hand-placed on the square in front of Tha Phae Gate (gate frame: x along the wall, z out); the
# square narrows towards its ends, where the moat comes close, so these keep to its middle
# (apps/citywalk/src/zones.test.ts checks them against the water)
PLAZA = [
    ("slime_water", (-30, 24), 1),
    ("slime_water", (30, 15), 1),
    ("slime_fire", (-60, 16), 1),
    ("slime_mini", (42, 12), 1),
    ("slime_water", (-45, 14), 2),
    ("slime_fire", (55, 10), 2),
]

# zone id: area test, levels, kinds in turn
def rect(x0, x1, z0, z1):
    return lambda x, z: x0 <= x <= x1 and z0 <= z <= z1

CORNERS = [(-707, -789), (813, -744), (728, 781), (-824, 736)]


def seg_dist(px, pz, ax, az, bx, bz):
    dx, dz = bx - ax, bz - az
    t = max(0.0, min(1.0, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz or 1)))
    return math.hypot(px - ax - t * dx, pz - az - t * dz)


def ring_dist(x, z):
    return min(
        seg_dist(x, z, *CORNERS[i], *CORNERS[(i + 1) % 4]) for i in range(4)
    )


ZONES = [
    ("tha_phae_road", rect(860, 1170, 20, 130), (1, 3), 6,
     ["slime_water", "slime_mini", "slime_water", "slime_fire"]),
    ("ratchadamnoen", rect(150, 740, 30, 110), (3, 6), 8,
     ["slime_water", "slime_fire", "slime_mini", "slime_water", "slime_fire"]),
    ("old_city_se", rect(150, 720, 140, 700), (5, 8), 10,
     ["slime_fire", "slime_water", "slime_giant", "slime_mini", "slime_fire", "slime_water"]),
    ("moat", lambda x, z: ring_dist(x, z) <= 60, (8, 12), 16,
     ["slime_water", "slime_fire", "slime_mini", "slime_giant"]),
]


def polys(flat_list, skip=0):
    out = []
    for f in flat_list:
        pts = f[skip:]
        out.append([(pts[i], pts[i + 1]) for i in range(0, len(pts) - 1, 2)])
    return out


def inside(x, z, poly):
    hit = False
    j = len(poly) - 1
    for i in range(len(poly)):
        xi, zi = poly[i]
        xj, zj = poly[j]
        if (zi > z) != (zj > z) and x < (xj - xi) * (z - zi) / (zj - zi) + xi:
            hit = not hit
        j = i
    return hit


def edge_dist(x, z, poly):
    return min(
        seg_dist(x, z, *poly[i], *poly[(i + 1) % len(poly)]) for i in range(len(poly))
    )


def bbox(poly, pad):
    xs = [p[0] for p in poly]
    zs = [p[1] for p in poly]
    return (min(xs) - pad, max(xs) + pad, min(zs) - pad, max(zs) + pad)


def main():
    w = json.loads(WORLD.read_text())
    temples = [(p, bbox(p, TEMPLE_CLEAR)) for p in polys(w["temples"])]
    buildings = [(p, bbox(p, 8)) for p in polys(w["buildings"], 2)]
    water = [(p, bbox(p, 3)) for p in polys(w["water"])]
    gates = {m["name"]: (m["x"], m["z"]) for m in w["landmarks"] if m["kind"] == "gate"}

    def near_any(x, z, items, clear, solid):
        for poly, (x0, x1, z0, z1) in items:
            if not (x0 <= x <= x1 and z0 <= z <= z1):
                continue
            if (solid and inside(x, z, poly)) or edge_dist(x, z, poly) < clear:
                return True
        return False

    def free(x, z, building_clear=1.5):
        return (
            not near_any(x, z, temples, TEMPLE_CLEAR, True)
            and not near_any(x, z, buildings, building_clear, True)
            and not near_any(x, z, water, 3, True)
        )

    # points along every road, a few metres apart
    road_points = []
    for r in w["roads"]:
        pts = [(r[i], r[i + 1]) for i in range(3, len(r) - 1, 2)]
        for (ax, az), (bx, bz) in zip(pts, pts[1:]):
            n = max(1, int(math.hypot(bx - ax, bz - az) // 6))
            for k in range(n):
                road_points.append((ax + (bx - ax) * k / n, az + (bz - az) * k / n))

    # rest points: Tha Phae is the start; the other gates get the nearest free road spot 15-40 m
    # inside the city
    rest = [{"id": "tha_phae", "frame": "gate", "at": [0, 20]}]
    rest_map = [START]
    for gid, name in [("chiang_mai", "ประตูเชียงใหม่"), ("suan_dok", "ประตูสวนดอก"),
                      ("chang_phueak", "ประตูช้างเผือก"), ("saen_pung", "ประตูแสนปุง")]:
        gx, gz = gates[name]
        l = math.hypot(gx, gz)
        want = (gx - gx / l * 30, gz - gz / l * 30)
        best = min(
            (p for p in road_points
             if 15 <= math.hypot(p[0] - gx, p[1] - gz) <= 45 and math.hypot(p[0], p[1]) < l
             and free(*p, 3)),
            key=lambda p: math.hypot(p[0] - want[0], p[1] - want[1]),
        )
        rest.append({"id": gid, "frame": "map", "at": [round(best[0], 1), round(best[1], 1)]})
        rest_map.append(best)

    def clear_of_rest(x, z):
        return all(math.hypot(x - rx, z - rz) >= REST_RADIUS + 12 for rx, rz in rest_map)

    rng = random.Random(7)
    taken = []
    zones = {"plaza": {"frame": "gate", "spawns": [
        {"species": s, "at": list(at), "level": lv} for s, at, lv in PLAZA]}}
    for zid, area, (lo, hi), count, kinds in ZONES:
        pts = [p for p in road_points if area(*p) and math.hypot(p[0] - START[0], p[1] - START[1]) > 70]
        rng.shuffle(pts)
        chosen = []
        for p in pts:
            if len(chosen) == count:
                break
            if any(math.hypot(p[0] - q[0], p[1] - q[1]) < SPACING for q in taken + chosen):
                continue
            if not clear_of_rest(*p) or not free(*p):
                continue
            chosen.append(p)
        # nearer the start, lower; further, higher
        chosen.sort(key=lambda p: math.hypot(p[0] - START[0], p[1] - START[1]))
        spawns = []
        for i, p in enumerate(chosen):
            level = lo + round((hi - lo) * i / max(1, len(chosen) - 1))
            spawns.append({"species": kinds[i % len(kinds)], "at": [round(p[0], 1), round(p[1], 1)], "level": level})
        taken += chosen
        zones[zid] = {"frame": "map", "spawns": spawns}
        print(zid, len(spawns), "of", count)

    # the moat's boss at the Si Phum corner, on open ground
    corner = (813, -744)
    boss = min(
        (p for p in road_points
         if math.hypot(p[0] - corner[0], p[1] - corner[1]) < 90 and free(*p, 6) and clear_of_rest(*p)),
        key=lambda p: math.hypot(p[0] - 770, p[1] - (-700)),
    )
    zones["si_phum"] = {"frame": "map", "spawns": [
        {"species": "boss_tide_regent", "at": [round(boss[0], 1), round(boss[1], 1)], "level": 12}]}

    book = {
        "about": "Where monsters live and where players rest. Written by apps/citywalk/tools/spawn_zones.py from the map (run it again after changing the map or the zones there). zones: each with a frame, `gate` (metres in the Tha Phae Gate frame: x along the wall, z out onto the square; the player starts at [0, 20]) or `map` (metres on the city map), and its spawns: species, at [x, z] and level (monsters.json `levels`). Levels rise away from the start: the square 1-2, Tha Phae Road 1-3, Ratchadamnoen 3-6, the old city's south-east 5-8, round the moat 8-12, and the moat's boss at the Si Phum corner 12. rest: where a player who goes down gets up (the nearest one); within restRadius metres of one, monsters leave the player alone and none live. templeClear: metres round a temple's grounds with no monsters (temples are background only). activeRange: monsters further than this from the player stand still and are not drawn.",
        "activeRange": ACTIVE_RANGE,
        "restRadius": REST_RADIUS,
        "templeClear": TEMPLE_CLEAR,
        "rest": rest,
        "zones": zones,
    }
    OUT.write_text(json.dumps(book, ensure_ascii=False, indent=2) + "\n")
    print("rest", rest)
    print("boss", zones["si_phum"])


if __name__ == "__main__":
    main()

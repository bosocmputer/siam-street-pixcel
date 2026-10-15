"""Convert the OpenFreeMap z14 tiles saved in roblox/world/source/openfreemap/ into roblox/world/OldCityRoads.luau
(Chiang Mai old city: moat rectangle + ~400 m around it). ROADS ONLY for now.

Usage: python -I tools/roblox/gen_oldcity_roads.py
Input : roblox/world/source/openfreemap/14_{x}_{y}.pbf   (OpenFreeMap vector tiles, (c) OpenMapTiles, data from OpenStreetMap, ODbL)
Output: roblox/world/OldCityRoads.luau   (metres; X east, Z south; origin = centre of the moat rectangle, ESTIMATED)

MAPPED: road centre lines (class from the tile), moat water polygons. ESTIMATED: road widths, origin, everything else.
Tile edges: every tile carries a buffer, so each line is clipped to the tile core (segment midpoint inside the tile) to
avoid duplicate roads where tiles overlap.
"""
import gzip, json, math, pathlib

root = pathlib.Path(__file__).resolve().parents[2]
src = root / 'roblox/world/source/openfreemap'
Z = 14
LAT0, LON0 = 18.7885, 98.98565  # centre of the moat rectangle, estimated from OpenFreeMap water polygons
KX = 111320 * math.cos(math.radians(LAT0)); KZ = 110950
HALF = 1250.0  # metres around the origin
KEEP = ('trunk', 'primary', 'secondary', 'tertiary', 'minor', 'service')
CODE = {'trunk': 't', 'primary': 'p', 'secondary': 's', 'tertiary': 'r', 'minor': 'm', 'service': 'v'}


def varint(b, i):
    r = 0; s = 0
    while True:
        c = b[i]; i += 1
        r |= (c & 0x7F) << s
        if not c & 0x80:
            return r, i
        s += 7


def fields(b):
    i = 0
    while i < len(b):
        k, i = varint(b, i); f, w = k >> 3, k & 7
        if w == 0:
            v, i = varint(b, i)
        elif w == 2:
            l, i = varint(b, i); v = b[i:i + l]; i += l
        elif w == 1:
            v = b[i:i + 8]; i += 8
        elif w == 5:
            v = b[i:i + 4]; i += 4
        else:
            raise ValueError(w)
        yield f, w, v


def zz(n):
    return (n >> 1) ^ -(n & 1)


def unpack(b):
    r = []; i = 0
    while i < len(b):
        v, i = varint(b, i); r.append(v)
    return r


def geom(ints):
    out = []; cur = []; x = y = 0; i = 0
    while i < len(ints):
        cmd = ints[i]; i += 1; op, cnt = cmd & 7, cmd >> 3
        if op in (1, 2):
            for _ in range(cnt):
                x += zz(ints[i]); y += zz(ints[i + 1]); i += 2
                if op == 1:
                    if cur: out.append(cur)
                    cur = []
                cur.append((x, y))
        elif op == 7:
            if cur: cur.append(cur[0])
    if cur: out.append(cur)
    return out


def decode(buf):
    layers = {}
    for f, w, v in fields(buf):
        if f != 3: continue
        name = None; extent = 4096; keys = []; vals = []; feats = []
        for ff, ww, vv in fields(v):
            if ff == 1: name = vv.decode()
            elif ff == 2: feats.append(vv)
            elif ff == 3: keys.append(vv.decode())
            elif ff == 4:
                for f4, w4, v4 in fields(vv):
                    vals.append(v4.decode() if f4 == 1 else (bool(v4) if f4 == 7 else v4))
            elif ff == 5: extent = vv
        parsed = []
        for fb in feats:
            gt = 0; tags = []; g = []
            for f2, w2, v2 in fields(fb):
                if f2 == 3: gt = v2
                elif f2 == 2: tags = unpack(v2)
                elif f2 == 4: g = unpack(v2)
            props = {}
            for a in range(0, len(tags), 2):
                props[keys[tags[a]]] = vals[tags[a + 1]] if tags[a + 1] < len(vals) else None
            parsed.append((gt, props, geom(g)))
        layers[name] = (extent, parsed)
    return layers


def to_local(tx, ty, px, py, extent):
    lon = (tx + px / extent) / 2 ** Z * 360 - 180
    n = math.pi - 2 * math.pi * (ty + py / extent) / 2 ** Z
    lat = math.degrees(math.atan(math.sinh(n)))
    return ((lon - LON0) * KX, -(lat - LAT0) * KZ)


def simplify(pts, tol):
    if len(pts) < 3: return pts
    a, b = pts[0], pts[-1]
    dx, dz = b[0] - a[0], b[1] - a[1]
    L = math.hypot(dx, dz)
    far, fi = -1.0, 0
    for i in range(1, len(pts) - 1):
        p = pts[i]
        d = math.hypot(p[0] - a[0], p[1] - a[1]) if L == 0 else abs(dx * (a[1] - p[1]) - (a[0] - p[0]) * dz) / L
        if d > far: far, fi = d, i
    if far <= tol: return [a, b]
    return simplify(pts[:fi + 1], tol)[:-1] + simplify(pts[fi:], tol)


tiles = sorted((int(p.stem.split('_')[1]), int(p.stem.split('_')[2])) for p in src.glob('14_*.pbf'))
roads, water = [], []
for tx, ty in tiles:
    buf = (src / f'14_{tx}_{ty}.pbf').read_bytes()
    try: buf = gzip.decompress(buf)
    except OSError: pass
    L = decode(buf)
    ext, tr = L.get('transportation', (4096, []))
    for gt, pr, g in tr:
        cls = pr.get('class')
        if cls not in KEEP: continue
        for line in g:
            run = []
            for a, b in zip(line, line[1:]):
                mx, my = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2
                if 0 <= mx < ext and 0 <= my < ext:
                    if not run: run = [a]
                    run.append(b)
                else:
                    if len(run) > 1: roads.append((cls, [to_local(tx, ty, px, py, ext) for px, py in run]))
                    run = []
            if len(run) > 1: roads.append((cls, [to_local(tx, ty, px, py, ext) for px, py in run]))
    ext, wt = L.get('water', (4096, []))
    for gt, pr, g in wt:
        if pr.get('class') not in ('lake', 'river', 'pond'): continue
        for ring in g:
            pts = [to_local(tx, ty, px, py, ext) for px, py in ring]
            cx = sum(p[0] for p in pts) / len(pts); cz = sum(p[1] for p in pts) / len(pts)
            # keep only water inside the box and inside this tile core (centroid in core) to avoid duplicates
            if abs(cx) <= HALF and abs(cz) <= HALF:
                inside = all(0 <= v < ext for v in ((sum(px for px, _ in ring) / len(ring)), (sum(py for _, py in ring) / len(ring))))
                if inside: water.append((pr.get('class'), pts))

out_roads = []
for cls, pts in roads:
    if not any(abs(x) <= HALF and abs(z) <= HALF for x, z in pts): continue
    pts = simplify(pts, 0.6)
    if len(pts) < 2: continue
    if sum(math.hypot(b[0] - a[0], b[1] - a[1]) for a, b in zip(pts, pts[1:])) < 2: continue
    out_roads.append((cls, pts))

def flat(pts): return ','.join(f'{x:.1f},{z:.1f}' for x, z in pts)

lines = [
    '--!strict',
    '-- GENERATED by tools/roblox/gen_oldcity_roads.py. Do not edit by hand.',
    '-- Source: OpenFreeMap vector tiles z14 (version path in roblox/world/source/openfreemap/README.md), (c) OpenMapTiles, data from OpenStreetMap contributors (ODbL-1.0)',
    f'-- Local metres: X east, Z south (north = -Z), origin = centre of the moat rectangle (ESTIMATED) lat {LAT0}, lon {LON0}',
    '-- MAPPED: road centre lines (class from tile), moat water shapes. ESTIMATED: widths, origin. ROADS ONLY: no footpaths yet.',
    '-- rightsStatus: pending-review (ODbL + OpenMapTiles attribution required before any publishing)',
    'return {',
    f'\thalf = {HALF},',
    '\t-- c: t=trunk p=primary s=secondary r=tertiary m=minor v=service; p = x1,z1,x2,z2,...',
    '\troads = {',
]
for cls, pts in out_roads:
    lines.append(f'\t\t{{c="{CODE[cls]}",p={{{flat(pts)}}}}},')
lines += ['\t},', '\twater = {']
for cls, pts in water:
    lines.append(f'\t\t{{k="{cls}",p={{{flat(pts)}}}}},')
lines += ['\t},', '}', '']
(root / 'roblox/world/OldCityRoads.luau').write_text('\n'.join(lines), encoding='utf-8')

from collections import Counter
c = Counter(CODE[k] for k, _ in out_roads)
tot = Counter()
for k, pts in out_roads: tot[CODE[k]] += sum(math.hypot(b[0] - a[0], b[1] - a[1]) for a, b in zip(pts, pts[1:]))
segs = sum(len(p) - 1 for _, p in out_roads)
print('tiles', tiles)
print('roads', len(out_roads), 'polylines,', segs, 'segments;', {k: f'{v} lines / {tot[k]/1000:.1f} km' for k, v in c.items()})
print('water shapes in box', len(water))
print('wrote roblox/world/OldCityRoads.luau', (root / 'roblox/world/OldCityRoads.luau').stat().st_size // 1024, 'KB')

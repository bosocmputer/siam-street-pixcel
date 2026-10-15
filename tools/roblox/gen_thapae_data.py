"""Convert the raw OSM snapshot (Overpass, `out geom tags`) into ThapaeData.luau for the Roblox graybox builder.

Usage: python -I tools/roblox/gen_thapae_data.py [half_size_m]   (default 105)
Input : roblox/world/source/osm_thapae_2026-10-15_rel.json   (OpenStreetMap contributors, ODbL-1.0)
Output: roblox/world/ThapaeData.luau   (metres; X east, Z south, origin = Thapae Gate node 1017379824)
Footprints, road/sidewalk/crossing lines, moat, wall and tree positions are MAPPED data.
Heights, facades, roof shapes, lane widths and street furniture are decided later by the builder and are ESTIMATED.
"""
import json, math, pathlib, sys

root = pathlib.Path(__file__).resolve().parents[2]
half = float(sys.argv[1]) if len(sys.argv) > 1 else 105.0
raw = json.load(open(root / 'roblox/world/source/osm_thapae_2026-10-15_rel.json', encoding='utf-8'))
LAT0, LON0 = 18.78775, 98.99327  # Thapae Gate (node 1017379824), rounded
KX = 111320 * math.cos(math.radians(LAT0)); KZ = 110950

def loc(p):
    return ((p['lon'] - LON0) * KX, -(p['lat'] - LAT0) * KZ)

def near(pts, m=0.0):
    return any(abs(x) <= half + m and abs(z) <= half + m for x, z in pts)

def flat(pts):
    return ','.join(f'{x:.2f},{z:.2f}' for x, z in pts)

def inside(x, z, poly):
    ins = False; j = len(poly) - 1
    for i in range(len(poly)):
        xi, zi = poly[i]; xj, zj = poly[j]
        if (zi > z) != (zj > z) and x < (xj - xi) * (z - zi) / (zj - zi) + xi:
            ins = not ins
        j = i
    return ins

els = raw['elements']
ways = [e for e in els if e['type'] == 'way']
nodes = [e for e in els if e['type'] == 'node']
poi_nodes = [(loc(n), n['tags']) for n in nodes if any(k in n.get('tags', {}) for k in ('shop', 'amenity', 'tourism'))]

def lua_val(v):
    return str(v) if isinstance(v, (int, float)) else '"' + str(v).replace('"', '') + '"'

buildings, roads, sidewalks, crossings, water, walls, areas = [], [], [], [], [], [], []
for w in ways:
    t = w.get('tags', {}); pts = [loc(p) for p in w['geometry']]
    closed = w['geometry'][0] == w['geometry'][-1]
    if 'building' in t and closed:
        poly = pts[:-1]
        cx = sum(p[0] for p in poly) / len(poly); cz = sum(p[1] for p in poly) / len(poly)
        if not near([(cx, cz)]): continue
        poi = sum(1 for (px, pz), _ in poi_nodes if inside(px, pz, poly))
        f = [f'id={w["id"]}', f'k="{t["building"]}"', f'poi={poi}']
        if 'building:levels' in t:
            try: f.append(f'lv={int(float(t["building:levels"]))}')
            except ValueError: pass
        if 'height' in t:
            try: f.append(f'h={float(str(t["height"]).split()[0])}')
            except (ValueError, IndexError): pass
        buildings.append('{' + ','.join(f) + f',pts={{{flat(poly)}}}}}')
    elif t.get('natural') == 'water' and closed:
        if near(pts, 60): water.append(f'{{id={w["id"]},pts={{{flat(pts[:-1])}}}}}')
    elif t.get('barrier') == 'city_wall' and closed:
        walls.append(f'{{id={w["id"]},pts={{{flat(pts[:-1])}}}}}')
    elif t.get('highway') == 'pedestrian' and t.get('area') == 'yes' and closed:
        if near(pts): areas.append(f'{{id={w["id"]},k="{"plaza" if t.get("name:en") else "paving"}",s="{t.get("surface", "paving_stones")}",pts={{{flat(pts[:-1])}}}}}')
    elif t.get('amenity') == 'place_of_worship' and closed:
        if near(pts, 60): areas.append(f'{{id={w["id"]},k="temple",name="{t.get("name:en", "")}",pts={{{flat(pts[:-1])}}}}}')
    elif t.get('leisure') == 'swimming_pool' and closed:
        if near(pts): areas.append(f'{{id={w["id"]},k="pool",pts={{{flat(pts[:-1])}}}}}')
    elif t.get('amenity') == 'parking' and closed:
        if near(pts): areas.append(f'{{id={w["id"]},k="parking",pts={{{flat(pts[:-1])}}}}}')
    elif 'highway' in t and not closed or ('highway' in t and closed):
        if not near(pts, 10): continue
        if t.get('footway') == 'crossing':
            crossings.append(f'{{id={w["id"]},marked={1 if t.get("crossing") == "marked" or t.get("crossing:markings") == "ladder" else 0},pts={{{flat(pts)}}}}}')
        elif t.get('footway') == 'sidewalk':
            sidewalks.append(f'{{id={w["id"]},s="{t.get("surface", "paved")}",pts={{{flat(pts)}}}}}')
        else:
            f = [f'id={w["id"]}', f'hw="{t["highway"]}"', f'lanes={t.get("lanes", 0)}', f'oneway={1 if t.get("oneway") == "yes" else 0}', f's="{t.get("surface", "asphalt")}"']
            if 'width' in t:
                try: f.append(f'w={float(t["width"])}')
                except ValueError: pass
            for key, tag in (('nm', 'name:th'), ('en', 'name:en')):
                v = t.get(tag) or (t.get('name') if key == 'nm' else None)
                if v:
                    f.append(f'{key}="' + str(v).replace('\\', '').replace('"', '') + '"')
            roads.append('{' + ','.join(f) + f',pts={{{flat(pts)}}}}}')

wall_height = 6.0
for rel in els:
    if rel['type'] != 'relation' or rel.get('tags', {}).get('type') != 'multipolygon':
        continue
    t = rel['tags']
    if t.get('historic') == 'citywalls' and 'height' in t:
        try: wall_height = float(str(t['height']).split()[0])
        except ValueError: pass
    if 'building' not in t:
        continue
    holes = sum(1 for m in rel['members'] if m['role'] == 'inner')
    for m in rel['members']:
        g = m.get('geometry')
        if m['role'] != 'outer' or not g or g[0] != g[-1]:
            continue
        poly = [loc(p) for p in g][:-1]
        cx = sum(p[0] for p in poly) / len(poly); cz = sum(p[1] for p in poly) / len(poly)
        if not near([(cx, cz)]): continue
        poi = sum(1 for (px, pz), _ in poi_nodes if inside(px, pz, poly)) + (1 if ('tourism' in t or 'shop' in t or 'amenity' in t) else 0)
        f = [f'id={rel["id"]}', f'k="{t["building"]}"', f'poi={poi}', f'holes={holes}']
        if 'building:levels' in t:
            try: f.append(f'lv={int(float(t["building:levels"]))}')
            except ValueError: pass
        if 'height' in t:
            try: f.append(f'h={float(str(t["height"]).split()[0])}')
            except (ValueError, IndexError): pass
        buildings.append('{' + ','.join(f) + f',pts={{{flat(poly)}}}}}')

trees = [loc(n) for n in nodes if n.get('tags', {}).get('natural') == 'tree']
trees = [p for p in trees if near([p])]
props = []
for (x, z), t in poi_nodes:
    if not near([(x, z)]): continue
    a = t.get('amenity')
    if a in ('post_box', 'fountain', 'toilets'): props.append(f'{{k="{a}",x={x:.2f},z={z:.2f}}}')
lamps_lit = [r for r in roads]

out = ['--!strict',
       '-- GENERATED by tools/roblox/gen_thapae_data.py. Do not edit by hand.',
       f'-- Source: OpenStreetMap contributors (ODbL-1.0), Overpass snapshot {raw["osm3s"]["timestamp_osm_base"]}',
       '-- Local metres: X east, Z south (north = -Z), origin = Thapae Gate node 1017379824 at lat 18.78775, lon 98.99327 (rounded)',
       '-- MAPPED: footprints, road/sidewalk/crossing lines, moat, wall, tree and POI positions. Everything else is estimated by the builder.',
       '-- rightsStatus: pending-review (ODbL attribution required before any publishing)',
       'return {', f'\thalf = {half},', f'\twallHeight = {wall_height},',
       '\tbuildings = {' + ',\n\t'.join(buildings) + '},',
       '\troads = {' + ',\n\t'.join(roads) + '},',
       '\tsidewalks = {' + ',\n\t'.join(sidewalks) + '},',
       '\tcrossings = {' + ',\n\t'.join(crossings) + '},',
       '\twater = {' + ',\n\t'.join(water) + '},',
       '\twalls = {' + ',\n\t'.join(walls) + '},',
       '\tareas = {' + ',\n\t'.join(areas) + '},',
       '\ttrees = {' + ','.join(f'{{{x:.2f},{z:.2f}}}' for x, z in trees) + '},',
       '\tprops = {' + ','.join(props) + '},', '}']
text = '\n'.join(out) + '\n'
(root / 'roblox/world/ThapaeData.luau').write_text(text, encoding='utf-8', newline='\n')
print(f'buildings={len(buildings)} roads={len(roads)} sidewalks={len(sidewalks)} crossings={len(crossings)} water={len(water)} walls={len(walls)} areas={len(areas)} trees={len(trees)} props={len(props)} bytes={len(text.encode())}')

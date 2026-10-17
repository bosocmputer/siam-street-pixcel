"""Turn the raw OpenStreetMap tiles (tools/raw/*.osm) into the small world.json the game loads.

Coordinates become metres around the centre of the moat: x to the east, z to the south (three.js
ground plane). Only what the walk test needs is kept. Data © OpenStreetMap contributors, ODbL.

    python3 tools/osm_to_world.py
"""

import glob
import json
import math
import os
import xml.etree.ElementTree as ET
import zlib

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "public", "world.json")

# centre of the old city, roughly between the four gates
LAT0, LON0 = 18.7884, 98.9858
# keep features inside this box (the moat plus about 250 m around it)
BOX = (18.7780, 98.9750, 18.7985, 98.9970)
KX = math.cos(math.radians(LAT0)) * 111320.0
KZ = 110574.0

ROAD_WIDTH = {
    "trunk": 14, "primary": 12, "secondary": 10, "tertiary": 8, "unclassified": 6,
    "residential": 6, "living_street": 5, "service": 4, "pedestrian": 4,
    "footway": 2, "path": 2, "steps": 2, "cycleway": 2, "track": 3,
}
ROAD_CLASS = {"trunk": 0, "primary": 0, "secondary": 0, "tertiary": 1, "unclassified": 1,
              "residential": 1, "living_street": 1, "service": 2, "pedestrian": 3,
              "footway": 3, "path": 3, "steps": 3, "cycleway": 3, "track": 2}
TYPE_HEIGHT = {"house": 6, "detached": 6, "terrace": 7, "roof": 4, "retail": 8, "commercial": 9,
               "school": 10, "hotel": 12, "apartments": 15, "hospital": 14, "office": 12,
               "temple": 9, "university": 12, "residential": 9, "garage": 3, "shed": 3}
# building kinds the renderer colours differently
KIND = {"normal": 0, "temple": 1, "historic": 2}
GATE_NAMES = {"ประตูท่าแพ", "ประตูช้างเผือก", "ประตูสวนดอก", "ประตูแสนปุง", "ประตูเชียงใหม่"}


def xz(lat, lon):
    return (round((lon - LON0) * KX, 1), round(-(lat - LAT0) * KZ, 1))


def inside_box(lat, lon, pad=0.0):
    return BOX[0] - pad <= lat <= BOX[2] + pad and BOX[1] - pad <= lon <= BOX[3] + pad


def load():
    nodes, ways = {}, {}
    for f in sorted(glob.glob(os.path.join(HERE, "raw", "*.osm"))):
        root = ET.parse(f).getroot()
        for n in root.iter("node"):
            tags = {t.get("k"): t.get("v") for t in n.findall("tag")}
            nodes[n.get("id")] = (float(n.get("lat")), float(n.get("lon")), tags)
        for w in root.iter("way"):
            refs = [x.get("ref") for x in w.findall("nd")]
            tags = {t.get("k"): t.get("v") for t in w.findall("tag")}
            ways[w.get("id")] = (refs, tags)
    return nodes, ways


def coords(refs, nodes):
    pts = [nodes[r] for r in refs if r in nodes]
    if len(pts) != len(refs):
        return None
    return [(p[0], p[1]) for p in pts]


def flat(latlons):
    out = []
    for lat, lon in latlons:
        x, z = xz(lat, lon)
        out += [x, z]
    return out


def closed(refs):
    return len(refs) >= 4 and refs[0] == refs[-1]


def centroid(latlons):
    return (sum(p[0] for p in latlons) / len(latlons), sum(p[1] for p in latlons) / len(latlons))


def point_in(lat, lon, poly):
    inside = False
    j = len(poly) - 1
    for i in range(len(poly)):
        yi, xi = poly[i]
        yj, xj = poly[j]
        if (yi > lat) != (yj > lat) and lon < (xj - xi) * (lat - yi) / (yj - yi) + xi:
            inside = not inside
        j = i
    return inside


def height_of(way_id, tags):
    if "height" in tags:
        try:
            return max(3.0, float(tags["height"].split()[0]))
        except ValueError:
            pass
    if "building:levels" in tags:
        try:
            return max(3.0, float(tags["building:levels"]) * 3.2)
        except ValueError:
            pass
    base = TYPE_HEIGHT.get(tags.get("building", "yes"))
    if base:
        return float(base)
    # unknown buildings: a stable pseudo-random height between 5 and 10 m from the way id
    return 5.0 + (zlib.crc32(way_id.encode()) % 50) / 10.0


def main():
    nodes, ways = load()
    temples = []  # temple grounds as lat/lon polygons
    for wid, (refs, tags) in ways.items():
        if tags.get("amenity") == "place_of_worship" and closed(refs):
            ll = coords(refs, nodes)
            if ll and inside_box(*centroid(ll)):
                temples.append(ll)

    world = {
        "attribution": "© OpenStreetMap contributors",
        "origin": [LAT0, LON0],
        "bounds": list(xz(BOX[2], BOX[1])) + list(xz(BOX[0], BOX[3])),
        "buildings": [], "roads": [], "water": [], "green": [], "temples": [],
        "walls": [], "forts": [], "landmarks": [],
    }
    for wid, (refs, tags) in ways.items():
        ll = coords(refs, nodes)
        if not ll:
            continue
        c = centroid(ll)
        if "building" in tags and closed(refs):
            if not inside_box(*c):
                continue
            kind = KIND["normal"]
            if tags.get("building") == "temple" or tags.get("amenity") == "place_of_worship" or any(
                point_in(c[0], c[1], t) for t in temples
            ):
                kind = KIND["temple"]
            if "historic" in tags:
                kind = KIND["historic"]
            world["buildings"].append([round(height_of(wid, tags), 1), kind] + flat(ll[:-1]))
        elif "highway" in tags and tags["highway"] in ROAD_WIDTH:
            if not any(inside_box(*p) for p in ll):
                continue
            hw = tags["highway"]
            width = ROAD_WIDTH[hw]
            if "width" in tags:
                try:
                    width = max(1.5, min(20.0, float(tags["width"].split()[0])))
                except ValueError:
                    pass
            world["roads"].append([width, ROAD_CLASS[hw], 1 if tags.get("bridge") else 0] + flat(ll))
        elif tags.get("natural") == "water" and closed(refs):
            if inside_box(*c, pad=0.002):
                world["water"].append(flat(ll[:-1]))
        elif (tags.get("leisure") in ("park", "garden") or tags.get("landuse") in ("grass", "recreation_ground")) and closed(refs):
            if inside_box(*c):
                world["green"].append(flat(ll[:-1]))
        elif tags.get("barrier") == "city_wall":
            if not inside_box(*c, pad=0.002):
                continue
            if closed(refs):
                world["forts"].append(flat(ll[:-1]))
            else:
                world["walls"].append(flat(ll))
            name = tags.get("name", "")
            if name.startswith("แจ่ง"):
                x, z = xz(*c)
                world["landmarks"].append({"name": name, "en": tags.get("name:en", ""), "kind": "corner", "x": x, "z": z})

    for t in temples:
        world["temples"].append(flat(t[:-1]))

    for nid, (lat, lon, tags) in nodes.items():
        name = tags.get("name", "")
        if tags.get("historic") == "city_gate" and name in GATE_NAMES and inside_box(lat, lon):
            x, z = xz(lat, lon)
            world["landmarks"].append({"name": name, "en": tags.get("name:en", ""), "kind": "gate", "x": x, "z": z})

    # the corners come as several wall pieces; keep one label per name
    seen, marks = set(), []
    for m in world["landmarks"]:
        if m["name"] not in seen:
            seen.add(m["name"])
            marks.append(m)
    world["landmarks"] = marks

    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(world, f, ensure_ascii=False, separators=(",", ":"))
    print(
        f"buildings {len(world['buildings'])}, roads {len(world['roads'])}, water {len(world['water'])}, "
        f"green {len(world['green'])}, temples {len(world['temples'])}, walls {len(world['walls'])}, "
        f"forts {len(world['forts'])}, landmarks {[m['name'] for m in marks]}, "
        f"{os.path.getsize(OUT) // 1024} KB"
    )


if __name__ == "__main__":
    main()

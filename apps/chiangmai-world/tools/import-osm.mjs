// One bounded request, cached on disk. The running app never queries Overpass.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const bbox = [18.7778, 98.974, 18.8012, 98.996];
const origin = [98.985, 18.7895];
const bounds = bbox.join(',');
const query = `[out:json][timeout:120];(
  way[building](${bounds});relation[building][type=multipolygon](${bounds});
  way[highway](${bounds});way[waterway](${bounds});
  way[natural=water](${bounds});relation[natural=water][type=multipolygon](${bounds});
  way[landuse](${bounds});way[leisure](${bounds});
  way[amenity=place_of_worship](${bounds});
  way[barrier](${bounds});way[historic](${bounds});
  node[amenity](${bounds});node[tourism](${bounds});node[historic](${bounds});
  node[natural=tree](${bounds});node[highway=street_lamp](${bounds});
);out geom;`;

await mkdir(path.join(root, '.cache'), { recursive: true });
const cache = path.join(root, '.cache', 'old-city-osm.json');
let raw;
try {
  raw = JSON.parse(await readFile(cache, 'utf8'));
  console.log('Using cached OSM extract.');
} catch {
  const endpoint =
    process.env.OSM_ENDPOINT || 'https://maps.mail.ru/osm/tools/overpass/api/interpreter';
  console.log(`Fetching one Old City extract from ${endpoint}`);
  const response = await fetch(endpoint, {
    method: 'POST',
    body: new URLSearchParams({ data: query }),
    headers: {
      'User-Agent': 'ChiangMaiOldCityWalk/0.1 (local prototype; cached geographic extract)',
    },
    signal: AbortSignal.timeout(150_000),
  });
  if (!response.ok) throw new Error(`Overpass returned ${response.status}`);
  raw = await response.json();
  if (raw.remark) throw new Error(raw.remark);
  if (!raw.elements?.length) throw new Error('Empty OSM extract');
  await writeFile(cache, JSON.stringify(raw));
}

const project = ({ lon, lat }) => [
  Math.round((lon - origin[0]) * 111_320 * Math.cos((origin[1] * Math.PI) / 180) * 100) / 100,
  Math.round((origin[1] - lat) * 111_320 * 100) / 100,
];
const keep = new Set([
  'name',
  'name:th',
  'name:en',
  'building',
  'building:levels',
  'height',
  'min_height',
  'roof:shape',
  'roof:height',
  'roof:colour',
  'building:colour',
  'highway',
  'lanes',
  'width',
  'surface',
  'oneway',
  'bridge',
  'tunnel',
  'access',
  'foot',
  'natural',
  'water',
  'waterway',
  'landuse',
  'leisure',
  'amenity',
  'tourism',
  'historic',
  'barrier',
  'religion',
  'denomination',
  'shop',
  'colour',
  'type',
]);
const tags = (e) => Object.fromEntries(Object.entries(e.tags || {}).filter(([k]) => keep.has(k)));
const isClosed = (ring) =>
  ring.length > 3 && Math.hypot(ring[0][0] - ring.at(-1)[0], ring[0][1] - ring.at(-1)[1]) < 0.1;
function joinRings(parts) {
  const remaining = parts.filter((p) => p.length > 1).map((p) => [...p]);
  const rings = [];
  const same = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]) < 0.1;
  while (remaining.length) {
    let ring = remaining.pop();
    let changed = true;
    while (!isClosed(ring) && changed) {
      changed = false;
      for (let i = 0; i < remaining.length; i++) {
        const next = remaining[i];
        if (same(ring.at(-1), next[0])) ring.push(...next.slice(1));
        else if (same(ring.at(-1), next.at(-1))) ring.push(...next.slice(0, -1).reverse());
        else if (same(ring[0], next.at(-1))) ring.unshift(...next.slice(0, -1));
        else if (same(ring[0], next[0])) ring.unshift(...next.slice(1).reverse());
        else continue;
        remaining.splice(i, 1);
        changed = true;
        break;
      }
    }
    if (isClosed(ring)) rings.push(ring);
  }
  return rings;
}
const categories = { buildings: [], roads: [], water: [], land: [], barriers: [], points: [] };
const relationWays = new Set(
  raw.elements
    .filter((e) => e.type === 'relation' && e.tags?.building)
    .flatMap((e) => e.members.filter((m) => m.type === 'way').map((m) => m.ref)),
);
for (const e of raw.elements) {
  if (e.type === 'node') {
    categories.points.push({ id: `n${e.id}`, p: project(e), tags: tags(e) });
    continue;
  }
  const t = tags(e);
  let rings = [];
  let holes = [];
  if (e.type === 'relation') {
    rings = joinRings(
      e.members
        .filter((m) => m.role !== 'inner' && m.geometry)
        .map((m) => m.geometry.filter(Boolean).map(project)),
    );
    holes = joinRings(
      e.members
        .filter((m) => m.role === 'inner' && m.geometry)
        .map((m) => m.geometry.filter(Boolean).map(project)),
    );
  } else if (e.geometry) rings = [e.geometry.filter(Boolean).map(project)];
  if (!rings.length) continue;
  for (let i = 0; i < rings.length; i++) {
    const ring = rings[i];
    if (ring.length < 2) continue;
    const feature = { id: `${e.type[0]}${e.id}${i ? `-${i}` : ''}`, points: ring, tags: t };
    if (holes.length) feature.holes = holes;
    if (t.building && t.building !== 'no' && isClosed(ring) && !relationWays.has(e.id))
      categories.buildings.push(feature);
    else if (t.highway && t.highway !== 'construction' && !['private', 'no'].includes(t.access))
      categories.roads.push(feature);
    else if (t.natural === 'water' || t.waterway) categories.water.push(feature);
    else if (t.landuse || t.leisure || t.amenity === 'place_of_worship')
      categories.land.push(feature);
    else if (t.barrier || t.historic) categories.barriers.push(feature);
  }
}
const data = {
  meta: {
    source: 'OpenStreetMap contributors',
    license: 'ODbL-1.0',
    attribution: '© OpenStreetMap contributors',
    sourceUrl: 'https://www.openstreetmap.org/copyright',
    osmTimestamp: raw.osm3s?.timestamp_osm_base,
    importedAt: new Date().toISOString(),
    bbox,
    origin,
    coordinates: 'Local equirectangular metres: X east, Z south; Y up',
    notes:
      'Street/building footprints are mapped. Missing heights and all facade details are estimated. No satellite imagery is bundled.',
    counts: Object.fromEntries(Object.entries(categories).map(([k, v]) => [k, v.length])),
  },
  ...categories,
};
if (data.roads.length < 100 || data.buildings.length < 100)
  throw new Error('Extract incomplete; refusing to replace data');
await mkdir(path.join(root, 'public/data'), { recursive: true });
await writeFile(path.join(root, 'public/data/old-city.json'), JSON.stringify(data));
console.log(JSON.stringify(data.meta, null, 2));

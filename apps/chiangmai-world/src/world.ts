import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  buildingHeight,
  centroid,
  displayName,
  hash,
  inside,
  polygonArea,
  roadWidth,
  type CityData,
  type Feature,
  type Point,
} from './geo';

const Y = new THREE.Vector3(0, 1, 0);
const v = new THREE.Vector3();
const q = new THREE.Quaternion();
const matrix = new THREE.Matrix4();
const colors = ['#ded2bc', '#cbbfac', '#ede2cc', '#b7bcad', '#d8c6ad', '#e5d5bf', '#c9bbab'];
const roofs = ['#a85d42', '#8c4d3c', '#985f49', '#686d68', '#b57c58', '#81827b'];

export interface Landmark {
  id: string;
  name: string;
  en: string;
  position: Point;
  spawn: Point;
  description: string;
}
export function landmarksFromData(data: CityData): Landmark[] {
  const definitions = [
    {
      id: 'thaphae',
      osm: 'n1017379824',
      name: 'ประตูท่าแพ',
      en: 'THA PHAE GATE',
      offset: [20, -1],
      description: 'เริ่มเดินจากลานประตูฝั่งตะวันออก แล้วเข้าถนนราชดำเนินสู่ใจกลางเมือง',
    },
    {
      id: 'chediluang',
      osm: 'w93413945',
      name: 'วัดเจดีย์หลวง',
      en: 'WAT CHEDI LUANG',
      offset: [48, -38],
      description: 'เจดีย์อิฐกลางเมืองเก่า เชื่อมกับถนนพระปกเกล้าและตรอกด้านใน',
    },
    {
      id: 'phrasingh',
      osm: 'w378271855',
      name: 'วัดพระสิงห์',
      en: 'WAT PHRA SINGH',
      offset: [93, 8],
      description: 'จุดหมายฝั่งตะวันตกของถนนราชดำเนิน ใกล้ประตูสวนดอก',
    },
    {
      id: 'threekings',
      osm: 'n1619287904',
      name: 'อนุสาวรีย์สามกษัตริย์',
      en: 'THREE KINGS MONUMENT',
      offset: [0, 24],
      description: 'ลานกลางเมืองบนถนนพระปกเกล้า และทางเชื่อมถนนอินทวโรรส',
    },
    {
      id: 'chiangman',
      osm: 'w98070869',
      name: 'วัดเชียงมั่น',
      en: 'WAT CHIANG MAN',
      offset: [28, 75],
      description: 'ย่านตอนเหนือของเมืองเก่า ใกล้ถนนราชภาคินัยและถนนศรีภูมิ',
    },
    {
      id: 'park',
      osm: 'w23973788',
      name: 'สวนบวกหาด',
      en: 'NONG BUAK HAAD PARK',
      offset: [45, -25],
      description: 'พื้นที่สีเขียวด้านตะวันตกเฉียงใต้ มีทางเดินและบึงตามข้อมูลแผนที่',
    },
    {
      id: 'changphueak',
      osm: 'n11229077788',
      name: 'ประตูช้างเผือก',
      en: 'CHANG PHUEAK GATE',
      offset: [5, 30],
      description: 'ประตูด้านเหนือของคูเมือง ตามแนวถนนศรีภูมิ',
    },
    {
      id: 'suandok',
      osm: 'n6717438786',
      name: 'ประตูสวนดอก',
      en: 'SUAN DOK GATE',
      offset: [22, 0],
      description: 'ประตูด้านตะวันตก เชื่อมถนนอารักษ์และถนนสิงหราช',
    },
    {
      id: 'saenpung',
      osm: 'n11226724529',
      name: 'ประตูแสนปุง',
      en: 'SAEN PUNG GATE',
      offset: [0, -18],
      description: 'แนวกำแพงและคูเมืองฝั่งใต้ บนถนนบำรุงบุรี',
    },
  ];
  return definitions.flatMap((definition) => {
    const node = data.points.find((p) => p.id === definition.osm);
    const feature = [...data.buildings, ...data.land].find((p) => p.id === definition.osm);
    const position = node?.p || (feature ? centroid(feature.points) : undefined);
    if (!position) return [];
    return [
      {
        ...definition,
        position,
        spawn: [position[0] + definition.offset[0], position[1] + definition.offset[1]] as Point,
      },
    ];
  });
}

function texture(kind: 'brick' | 'plaster' | 'roof' | 'stone' | 'asphalt'): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const c = canvas.getContext('2d')!;
  const base = {
    brick: '#a5785a',
    plaster: '#e3ddd0',
    roof: '#b69b84',
    stone: '#d6cfc0',
    asphalt: '#626667',
  }[kind];
  c.fillStyle = base;
  c.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 7000; i++) {
    const n = hash(`${kind}${i}`);
    c.fillStyle = `rgba(${n % 2 ? '255,255,255' : '0,0,0'},${0.02 + (n % 8) / 100})`;
    c.fillRect(n % 256, (n >>> 8) % 256, 1 + (n % 2), 1 + (n % 3));
  }
  if (kind === 'brick' || kind === 'stone') {
    const height = kind === 'brick' ? 22 : 64;
    const width = kind === 'brick' ? 63 : 64;
    c.lineWidth = kind === 'brick' ? 2.2 : 1.5;
    c.strokeStyle = kind === 'brick' ? '#615249' : '#a29d91';
    for (let z = 0; z <= 256; z += height) {
      c.beginPath();
      c.moveTo(0, z);
      c.lineTo(256, z);
      c.stroke();
      for (let x = z % (height * 2) ? -width / 2 : 0; x < 256; x += width) {
        c.beginPath();
        c.moveTo(x, z);
        c.lineTo(x, z + height);
        c.stroke();
      }
    }
  }
  if (kind === 'roof') {
    for (let z = 0; z < 256; z += 18) {
      c.fillStyle = '#6a5c4d';
      c.fillRect(0, z, 256, 2);
      for (let x = 0; x < 256; x += 16) {
        c.strokeStyle = '#d3bfa7';
        c.beginPath();
        c.moveTo(x, z + 2);
        c.lineTo(x, z + 18);
        c.stroke();
      }
    }
  }
  const result = new THREE.CanvasTexture(canvas);
  result.wrapS = result.wrapT = THREE.RepeatWrapping;
  result.colorSpace = THREE.SRGBColorSpace;
  result.anisotropy = 4;
  return result;
}

function shapeOf(feature: Feature): THREE.Shape {
  const shape = new THREE.Shape(feature.points.map(([x, z]) => new THREE.Vector2(x, -z)));
  for (const hole of feature.holes || [])
    shape.holes.push(new THREE.Path(hole.map(([x, z]) => new THREE.Vector2(x, -z))));
  return shape;
}
function flat(feature: Feature, y: number): THREE.BufferGeometry {
  const geometry = new THREE.ShapeGeometry(shapeOf(feature));
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, y, 0);
  const positions = geometry.getAttribute('position');
  const uv = geometry.getAttribute('uv');
  for (let i = 0; i < positions.count; i++)
    uv.setXY(i, positions.getX(i) / 4, positions.getZ(i) / 4);
  return geometry;
}
export function ribbon(points: Point[], width: number, y: number): THREE.BufferGeometry {
  const vertices: number[] = [];
  const uvs: number[] = [];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1],
      b = points[i];
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (length < 0.05) continue;
    const nx = (((b[1] - a[1]) / length) * width) / 2;
    const nz = ((-(b[0] - a[0]) / length) * width) / 2;
    vertices.push(
      a[0] - nx,
      y,
      a[1] - nz,
      b[0] + nx,
      y,
      b[1] + nz,
      a[0] + nx,
      y,
      a[1] + nz,
      a[0] - nx,
      y,
      a[1] - nz,
      b[0] - nx,
      y,
      b[1] - nz,
      b[0] + nx,
      y,
      b[1] + nz,
    );
  }
  // Overlapping segments at junctions must sample identical texels in world space.
  for (let i = 0; i < vertices.length; i += 3) uvs.push(vertices[i] / 4, vertices[i + 2] / 4);
  const result = new THREE.BufferGeometry();
  result.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  result.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  result.computeVertexNormals();
  return result;
}

class Batches {
  private geometries = new Map<
    string,
    { material: THREE.Material; items: THREE.BufferGeometry[] }
  >();
  private instances = new Map<
    string,
    { geometry: THREE.BufferGeometry; material: THREE.Material; transforms: THREE.Matrix4[] }
  >();
  readonly boxes = new THREE.BoxGeometry(1, 1, 1);
  readonly spheres = new THREE.IcosahedronGeometry(1, 1);
  private cell(x: number, z: number): string {
    return `${Math.floor(x / 320)},${Math.floor(z / 320)}`;
  }
  geometry(geometry: THREE.BufferGeometry, material: THREE.Material, x: number, z: number): void {
    const g = geometry.index ? geometry.toNonIndexed() : geometry;
    if (g !== geometry) geometry.dispose();
    const key = `${material.uuid}/${this.cell(x, z)}`;
    if (!this.geometries.has(key)) this.geometries.set(key, { material, items: [] });
    this.geometries.get(key)!.items.push(g);
  }
  instance(
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
    angle = 0,
  ): void {
    const key = `${geometry.uuid}/${material.uuid}/${this.cell(x, z)}`;
    if (!this.instances.has(key)) this.instances.set(key, { geometry, material, transforms: [] });
    q.setFromAxisAngle(Y, angle);
    matrix.compose(v.set(x, y, z), q, new THREE.Vector3(sx, sy, sz));
    this.instances.get(key)!.transforms.push(matrix.clone());
  }
  box(
    material: THREE.Material,
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
    angle = 0,
  ): void {
    this.instance(this.boxes, material, x, y, z, sx, sy, sz, angle);
  }
  flush(group: THREE.Group): void {
    for (const { material, items } of this.geometries.values()) {
      const combined = mergeGeometries(items, false);
      items.forEach((item) => item.dispose());
      if (!combined) continue;
      combined.computeBoundingSphere();
      const mesh = new THREE.Mesh(combined, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    }
    for (const { geometry, material, transforms } of this.instances.values()) {
      const mesh = new THREE.InstancedMesh(geometry, material, transforms.length);
      transforms.forEach((transform, i) => mesh.setMatrixAt(i, transform));
      mesh.computeBoundingSphere();
      mesh.userData.detail = !!material.userData.detail;
      mesh.castShadow = geometry === this.spheres;
      mesh.receiveShadow = true;
      group.add(mesh);
    }
    this.geometries.clear();
    this.instances.clear();
  }
}

export interface World {
  group: THREE.Group;
  landmarks: Landmark[];
  water: THREE.MeshStandardMaterial;
  labels: { name: string; position: THREE.Vector3; kind: string }[];
}

export function buildingWalls(feature: Feature, height: number): THREE.BufferGeometry {
  const extruded = new THREE.ExtrudeGeometry(shapeOf(feature), {
    depth: height,
    bevelEnabled: false,
    steps: 1,
  });
  // ExtrudeGeometry includes a top cap. The separate roof used to fight that cap
  // at city-view distances, so retain only the side-wall group.
  const sides = extruded.groups.find((group) => group.materialIndex === 1)!;
  const geometry = new THREE.BufferGeometry();
  for (const [name, attribute] of Object.entries(extruded.attributes)) {
    geometry.setAttribute(
      name,
      new THREE.BufferAttribute(
        attribute.array.slice(
          sides.start * attribute.itemSize,
          (sides.start + sides.count) * attribute.itemSize,
        ),
        attribute.itemSize,
      ),
    );
  }
  extruded.dispose();
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}
export async function buildWorld(
  data: CityData,
  progress: (value: string) => void,
): Promise<World> {
  const group = new THREE.Group();
  const batch = new Batches();
  const matte = (color: string, map?: THREE.Texture) =>
    new THREE.MeshStandardMaterial({ color, ...(map ? { map } : {}), roughness: 0.92 });
  const plaster = texture('plaster');
  const tile = texture('roof');
  const brick = texture('brick');
  const stone = texture('stone');
  const wallMaterials = colors.map((color) => matte(color, plaster));
  const roofMaterials = roofs.map((color) => matte(color, tile));
  roofMaterials.forEach((material) => {
    material.side = THREE.DoubleSide;
  });
  const sidewalk = matte('#b4b2a5', stone);
  const asphalt = matte('#e3e3db', texture('asphalt'));
  const pathMaterial = matte('#ac9b82', stone);
  const garden = matte('#80916e');
  const templeGround = matte('#cbbca1', stone);
  const water = new THREE.MeshStandardMaterial({
    color: '#528e82',
    roughness: 0.3,
    metalness: 0.2,
  });
  const bankMaterial = matte('#a2a28c', stone);
  const brickMaterial = matte('#b69376', brick);
  const gold = new THREE.MeshStandardMaterial({
    color: '#c59b42',
    metalness: 0.55,
    roughness: 0.43,
  });
  const cream = matte('#efe4c9', plaster);
  const glass = new THREE.MeshStandardMaterial({
    color: '#355d63',
    metalness: 0.18,
    roughness: 0.26,
  });
  const wood = matte('#63503d');
  const windowFrame = matte('#63503d');
  const windowCross = matte('#dfd7c2');
  windowFrame.userData.detail = true;
  windowCross.userData.detail = true;
  glass.userData.detail = true;
  const dark = matte('#3c4b48');
  const leafMaterials = ['#58734a', '#6b8551', '#425f42', '#829158'].map((c) => matte(c));
  const lineMaterial = matte('#e3d8a4');
  const awnings = ['#8f4c37', '#4d7870', '#b29a69'].map((c) => matte(c));
  awnings.forEach((material) => {
    material.userData.detail = true;
  });

  // World-space UVs keep brick size constant on differently-sized wall instances.
  brickMaterial.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      '#include <common>\nvarying vec3 vMasonryPosition;\nvarying vec3 vMasonryNormal;',
    );
    shader.vertexShader = shader.vertexShader.replace(
      '#include <worldpos_vertex>',
      `#include <worldpos_vertex>
      vec4 masonryPosition = vec4(transformed, 1.0);
      vec3 masonryNormal = objectNormal;
      #ifdef USE_INSTANCING
        masonryPosition = instanceMatrix * masonryPosition;
        masonryNormal = mat3(instanceMatrix) * masonryNormal;
      #endif
      vMasonryPosition = (modelMatrix * masonryPosition).xyz;
      vMasonryNormal = normalize(mat3(modelMatrix) * masonryNormal);`,
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      '#include <common>\nvarying vec3 vMasonryPosition;\nvarying vec3 vMasonryNormal;',
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <map_fragment>',
      `
      vec3 masonryBlend = pow(abs(normalize(vMasonryNormal)), vec3(8.0));
      masonryBlend /= max(dot(masonryBlend, vec3(1.0)), 0.0001);
      vec4 masonryColor = texture2D(map, vMasonryPosition.zy) * masonryBlend.x
        + texture2D(map, vMasonryPosition.xz) * masonryBlend.y
        + texture2D(map, vMasonryPosition.xy) * masonryBlend.z;
      diffuseColor *= masonryColor;`,
    );
  };

  // The local world is flat. No DEM survey or terrain-height accuracy is claimed.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(9000, 9000),
    matte('#89947b', texture('plaster')),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);
  progress('กำลังวางคูเมือง พื้นที่สีเขียว และถนนจริง');
  for (const f of data.land) {
    if (f.points.length < 4 || polygonArea(f.points) < 12) continue;
    const p = centroid(f.points);
    const green =
      ['park', 'garden', 'playground', 'recreation_ground'].includes(f.tags.leisure) ||
      ['grass', 'forest', 'meadow', 'recreation_ground', 'village_green', 'cemetery'].includes(
        f.tags.landuse,
      );
    if (green || f.tags.amenity === 'place_of_worship')
      batch.geometry(flat(f, green ? 0.025 : 0.045), green ? garden : templeGround, ...p);
  }
  for (const f of data.water) {
    const p = centroid(f.points);
    if (f.tags.natural === 'water' && f.points.length > 3) {
      batch.geometry(flat(f, 0.07), water, ...p);
      batch.geometry(ribbon(f.points, 0.8, 0.11), bankMaterial, ...p);
    } else batch.geometry(ribbon(f.points, parseFloat(f.tags.width) || 2, 0.06), water, ...p);
  }
  for (const f of data.roads) {
    const width = roadWidth(f.tags);
    const p = centroid(f.points);
    const foot = ['path', 'footway', 'pedestrian', 'steps', 'cycleway'].includes(f.tags.highway);
    const height = f.tags.bridge === 'yes' ? 0.32 : foot ? 0.23 : 0.18;
    const closedArea =
      f.points.length > 3 &&
      Math.hypot(f.points[0][0] - f.points.at(-1)![0], f.points[0][1] - f.points.at(-1)![1]) <
        0.1 &&
      ['pedestrian', 'footway'].includes(f.tags.highway);
    if (closedArea) {
      batch.geometry(flat(f, 0.27), sidewalk, ...p);
      continue;
    }
    if (!foot) batch.geometry(ribbon(f.points, width + 1.5, height - 0.045), sidewalk, ...p);
    batch.geometry(ribbon(f.points, width, height), foot ? pathMaterial : asphalt, ...p);
    if (width > 6 && !foot) {
      for (let i = 1; i < f.points.length; i++) {
        const a = f.points[i - 1],
          b = f.points[i];
        const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
        const angle = Math.atan2(b[0] - a[0], b[1] - a[1]);
        for (let step = 3; step < length - 2; step += 8) {
          const t = step / length;
          batch.box(
            lineMaterial,
            a[0] + (b[0] - a[0]) * t,
            height + 0.012,
            a[1] + (b[1] - a[1]) * t,
            0.12,
            0.018,
            Math.min(3, length - step),
            angle,
          );
        }
      }
    }
  }
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  progress('กำลังขึ้นรูปอาคารจริง และเพิ่มหลังคา หน้าต่าง กันสาด');
  const custom = new Set(['w93413945', 'w378271855']);
  const templeSites = data.land.filter(
    (f) => f.tags.amenity === 'place_of_worship' && f.tags.religion === 'buddhist',
  );
  const labels: World['labels'] = [];
  for (const f of data.buildings) {
    if (f.points.length < 4 || polygonArea(f.points) < 3 || custom.has(f.id)) continue;
    const p = centroid(f.points);
    const seed = hash(f.id);
    const { height } = buildingHeight(f);
    const temple =
      f.tags.building === 'temple' || templeSites.some((site) => inside(p, site.points));
    const wall = wallMaterials[seed % wallMaterials.length];
    const geometry = buildingWalls(f, height);
    const uv = geometry.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 3.5, uv.getY(i) / 3.5);
    batch.geometry(geometry, wall, ...p);
    batch.geometry(flat(f, height), roofMaterials[seed % roofMaterials.length], ...p);

    let longEdge = { a: f.points[0], b: f.points[1], length: 0 };
    for (let i = 1; i < f.points.length; i++) {
      const a = f.points[i - 1],
        b = f.points[i];
      const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (length > longEdge.length) longEdge = { a, b, length };
      if (length < 2.8 || length > 80) continue;
      const dx = (b[0] - a[0]) / length,
        dz = (b[1] - a[1]) / length;
      let nx = -dz,
        nz = dx;
      const mid: Point = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      if (inside([mid[0] + nx * 0.2, mid[1] + nz * 0.2], f.points)) {
        nx *= -1;
        nz *= -1;
      }
      const rotation = Math.atan2(-dz, dx);
      const floors = Math.min(5, Math.max(1, Math.floor(height / 3.1)));
      for (let floor = 0; floor < floors; floor++) {
        const count = Math.min(14, Math.floor(length / 3.2));
        for (let k = 1; k <= count; k++) {
          const t = k / (count + 1);
          const x = a[0] + (b[0] - a[0]) * t + nx * 0.035;
          const z = a[1] + (b[1] - a[1]) * t + nz * 0.035;
          const y = 1.7 + floor * 3.1;
          batch.box(windowFrame, x, y, z, 1.34, 1.65, 0.12, rotation);
          batch.box(glass, x + nx * 0.08, y, z + nz * 0.08, 1.12, 1.43, 0.05, rotation);
          batch.box(windowCross, x + nx * 0.11, y, z + nz * 0.11, 0.065, 1.43, 0.035, rotation);
          if (floor === 0 && seed % 4 === 0)
            batch.box(
              awnings[seed % 3],
              x + nx * 0.55,
              2.9,
              z + nz * 0.55,
              2.2,
              0.14,
              1.6,
              rotation,
            );
        }
      }
      // One entrance per sufficiently long facade; visual only, interiors are out of scope.
      if (length > 5)
        batch.box(
          windowFrame,
          mid[0] + nx * 0.04,
          1.13,
          mid[1] + nz * 0.04,
          1.25,
          2.25,
          0.12,
          rotation,
        );
    }
    const rectangular = f.points.length <= 7 && polygonArea(f.points) < (temple ? 5000 : 1500);
    if (rectangular && longEdge.length > 4) {
      const a = longEdge.a,
        b = longEdge.b;
      const length = longEdge.length;
      const area = polygonArea(f.points);
      const width = area / length;
      const roofHeight = temple ? 5 : Math.min(3.2, width * 0.32);
      const roof = new THREE.BufferGeometry();
      const angle = Math.atan2(-(b[1] - a[1]), b[0] - a[0]);
      const l = length / 2 + 0.4,
        w = width / 2 + 0.4;
      roof.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(
          [
            -l,
            0,
            -w,
            l,
            0,
            -w,
            l,
            roofHeight,
            0,
            -l,
            0,
            -w,
            l,
            roofHeight,
            0,
            -l,
            roofHeight,
            0,
            -l,
            roofHeight,
            0,
            l,
            roofHeight,
            0,
            l,
            0,
            w,
            -l,
            roofHeight,
            0,
            l,
            0,
            w,
            -l,
            0,
            w,
            -l,
            0,
            w,
            -l,
            0,
            -w,
            -l,
            roofHeight,
            0,
            l,
            0,
            -w,
            l,
            0,
            w,
            l,
            roofHeight,
            0,
          ],
          3,
        ),
      );
      roof.setAttribute(
        'uv',
        new THREE.Float32BufferAttribute(
          [
            0,
            0,
            length / 3,
            0,
            length / 3,
            width / 6,
            0,
            0,
            length / 3,
            width / 6,
            0,
            width / 6,
            0,
            0,
            length / 3,
            0,
            length / 3,
            width / 6,
            0,
            0,
            length / 3,
            width / 6,
            0,
            width / 6,
            0,
            0,
            1,
            0,
            0.5,
            1,
            0,
            0,
            1,
            0,
            0.5,
            1,
          ],
          2,
        ),
      );
      roof.computeVertexNormals();
      if (temple && length > 8 && width > 4) {
        const upper = roof.clone();
        upper.scale(0.72, 0.85, 0.72);
        upper.rotateY(angle);
        upper.translate(p[0], height + 2.5, p[1]);
        batch.geometry(upper, roofMaterials[0], ...p);
        const ridgeAngle = angle + Math.PI / 2;
        batch.box(
          gold,
          p[0],
          height + roofHeight + 2.8,
          p[1],
          0.13,
          0.16,
          length * 0.7,
          ridgeAngle,
        );
        for (const end of [-1, 1]) {
          const x = p[0] + Math.cos(angle) * length * 0.36 * end;
          const z = p[1] - Math.sin(angle) * length * 0.36 * end;
          const finial = new THREE.ConeGeometry(0.25, 2.4, 5);
          finial.translate(x, height + roofHeight + 3.6, z);
          batch.geometry(finial, gold, ...p);
        }
      }
      roof.rotateY(angle);
      roof.translate(p[0], height, p[1]);
      batch.geometry(roof, roofMaterials[(temple ? 0 : seed) % roofMaterials.length], ...p);
    }
    if (displayName(f.tags) && polygonArea(f.points) > 80)
      labels.push({
        name: displayName(f.tags),
        position: new THREE.Vector3(p[0], height + 3, p[1]),
        kind: 'building',
      });
  }
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  progress('กำลังเพิ่มกำแพงเมือง วัด และรายละเอียดริมถนน');

  // Historic walls follow OSM geometry; the brickwork and crenellation are stylized.
  for (const f of data.barriers) {
    const historic = f.tags.barrier === 'city_wall' || f.tags.historic === 'citywalls';
    if (!historic && !['wall', 'fence'].includes(f.tags.barrier)) continue;
    const height = historic ? 4.6 : f.tags.barrier === 'fence' ? 1.3 : 1.8;
    for (let i = 1; i < f.points.length; i++) {
      const a = f.points[i - 1],
        b = f.points[i];
      const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (length < 0.2 || length > 500) continue;
      const angle = Math.atan2(b[0] - a[0], b[1] - a[1]);
      batch.box(
        historic ? brickMaterial : cream,
        (a[0] + b[0]) / 2,
        height / 2,
        (a[1] + b[1]) / 2,
        historic ? 1.8 : 0.3,
        height,
        length,
        angle,
      );
      if (historic) {
        for (let j = 1; j < length; j += 2.7) {
          const t = j / length;
          batch.box(
            brickMaterial,
            a[0] + (b[0] - a[0]) * t,
            height + 0.45,
            a[1] + (b[1] - a[1]) * t,
            1.9,
            0.9,
            1.25,
            angle,
          );
        }
      }
    }
  }

  const landmarks = landmarksFromData(data);
  for (const landmark of landmarks) {
    const [x, z] = landmark.position;
    labels.push({ name: landmark.name, position: new THREE.Vector3(x, 16, z), kind: 'landmark' });
    if (landmark.id === 'chediluang') {
      const ruinsMaterial = matte('#ead2af', brick);
      ruinsMaterial.onBeforeCompile = brickMaterial.onBeforeCompile;
      for (let i = 0; i < 7; i++) {
        batch.box(ruinsMaterial, x, 1.5 + i * 2.4, z, 45 - i * 4.2, 3, 45 - i * 4.2);
        batch.box(ruinsMaterial, x, 3.05 + i * 2.4, z, 45.6 - i * 4.2, 0.28, 45.6 - i * 4.2);
      }
      batch.box(ruinsMaterial, x, 23, z, 20, 13, 20);
      const broken = new THREE.CylinderGeometry(5.5, 10, 11, 8);
      broken.translate(x, 34, z);
      batch.geometry(broken, ruinsMaterial, x, z);
      for (let side = 0; side < 4; side++) {
        const angle = (side * Math.PI) / 2;
        for (let step = 0; step < 24; step++) {
          const distance = 24 - step * 0.58;
          batch.box(
            ruinsMaterial,
            x + Math.sin(angle) * distance,
            step * 0.54,
            z + Math.cos(angle) * distance,
            5.6,
            0.6,
            1.2,
            angle,
          );
        }
        batch.box(
          dark,
          x + Math.sin(angle) * 10.1,
          22,
          z + Math.cos(angle) * 10.1,
          4.5,
          6.5,
          0.2,
          angle,
        );
        for (const along of [-11, -6, 6, 11]) {
          const ex = x + Math.sin(angle) * 18 + Math.cos(angle) * along;
          const ez = z + Math.cos(angle) * 18 - Math.sin(angle) * along;
          batch.instance(batch.spheres, ruinsMaterial, ex, 5.6, ez, 1, 1.3, 1.8, angle);
          batch.instance(
            batch.spheres,
            ruinsMaterial,
            ex + Math.sin(angle),
            5.9,
            ez + Math.cos(angle),
            0.8,
            0.9,
            0.8,
            angle,
          );
          batch.box(
            ruinsMaterial,
            ex + Math.sin(angle) * 1.8,
            5.2,
            ez + Math.cos(angle) * 1.8,
            0.35,
            1.7,
            0.4,
            angle,
          );
        }
      }
    } else if (landmark.id === 'phrasingh') {
      for (let i = 0; i < 4; i++)
        batch.box(cream, x, 1 + i * 1.1, z, 24 - i * 3.5, 1.4, 24 - i * 3.5);
      const bell = new THREE.SphereGeometry(6.7, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2);
      bell.translate(x, 6, z);
      batch.geometry(bell, gold, x, z);
      for (let i = 0; i < 9; i++) {
        const ring = new THREE.CylinderGeometry(4 - i * 0.4, 4.4 - i * 0.4, 0.95, 20);
        ring.translate(x, 12.5 + i * 0.9, z);
        batch.geometry(ring, gold, x, z);
      }
      const spire = new THREE.ConeGeometry(1, 10, 12);
      spire.translate(x, 25, z);
      batch.geometry(spire, gold, x, z);
    } else if (landmark.id === 'threekings') {
      batch.box(cream, x, 0.7, z, 10, 1.4, 5.5);
      batch.box(dark, x, 1.6, z, 8, 0.4, 3.8);
      for (let i = -1; i <= 1; i++) {
        batch.box(dark, x + i * 2, 3.2, z, 1, 2.5, 0.6);
        batch.instance(batch.spheres, dark, x + i * 2, 5, z, 0.43, 0.5, 0.43);
        batch.box(dark, x + i * 2 - 0.25, 1.95, z, 0.3, 1, 0.3);
        batch.box(dark, x + i * 2 + 0.25, 1.95, z, 0.3, 1, 0.3);
      }
    }
  }

  function tree(x: number, z: number, seed: number) {
    const height = 5 + (seed % 6);
    batch.box(wood, x, height / 2, z, 0.35, height, 0.35);
    batch.instance(
      batch.spheres,
      leafMaterials[seed % 4],
      x,
      height,
      z,
      2.1 + (seed % 3),
      2.7 + (seed % 2),
      2.4 + (seed % 3),
    );
    batch.instance(
      batch.spheres,
      leafMaterials[(seed + 1) % 4],
      x + 1.1,
      height - 1.3,
      z + 0.8,
      1.9,
      2.1,
      1.9,
    );
  }
  for (const point of data.points) {
    const [x, z] = point.p;
    if (point.tags.natural === 'tree') tree(x, z, hash(point.id));
    if (point.tags.amenity === 'bench') {
      batch.box(wood, x, 0.52, z, 1.8, 0.15, 0.55);
      batch.box(wood, x, 0.96, z + 0.25, 1.8, 0.7, 0.12);
      for (const dx of [-0.65, 0.65]) batch.box(dark, x + dx, 0.25, z, 0.08, 0.5, 0.4);
    }
    const name = displayName(point.tags);
    if (name && (point.tags.amenity || point.tags.tourism))
      labels.push({ name, position: new THREE.Vector3(x, 4, z), kind: 'place' });
  }
  // Decorative roadside planting/lamps are deterministic, not surveyed objects.
  const placed = new Set<string>();
  for (const road of data.roads) {
    const width = roadWidth(road.tags);
    if (width < 6 || road.tags.bridge === 'yes') continue;
    for (let i = 1; i < road.points.length; i++) {
      const a = road.points[i - 1],
        b = road.points[i];
      const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (length < 14) continue;
      const dx = (b[0] - a[0]) / length,
        dz = (b[1] - a[1]) / length;
      for (let step = 12; step < length; step += 34) {
        for (const side of [-1, 1]) {
          const x = a[0] + dx * step - dz * (width / 2 + 1.5) * side;
          const z = a[1] + dz * step + dx * (width / 2 + 1.5) * side;
          const key = `${Math.round(x / 12)},${Math.round(z / 12)}`;
          if (placed.has(key)) continue;
          placed.add(key);
          const seed = hash(key);
          const occupied = data.buildings.some(
            (f) =>
              Math.abs(f.points[0][0] - x) < 90 &&
              Math.abs(f.points[0][1] - z) < 90 &&
              inside([x, z], f.points),
          );
          if (occupied) continue;
          if (seed % 3) tree(x, z, seed);
          else {
            batch.box(dark, x, 3.3, z, 0.13, 6.6, 0.13);
            batch.box(dark, x + 0.6, 6.5, z, 1.3, 0.12, 0.15);
            batch.box(cream, x + 1.1, 6.42, z, 0.6, 0.1, 0.4);
          }
        }
      }
    }
  }
  // Extra park planting stays inside mapped park polygons.
  for (const f of data.land.filter((f) => ['park', 'garden'].includes(f.tags.leisure))) {
    const p = centroid(f.points);
    for (let i = 0; i < 70; i++) {
      const seed = hash(`${f.id}${i}`);
      const x = p[0] + (seed % 300) - 150,
        z = p[1] + ((seed >>> 9) % 300) - 150;
      if (inside([x, z], f.points) && !data.water.some((water) => inside([x, z], water.points)))
        tree(x, z, seed);
    }
  }
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  progress('กำลังจัดแสงและเตรียมเมืองให้เดินสำรวจ');
  batch.flush(group);
  // A distant, illustrative westward mountain silhouette, not surveyed elevation.
  const mountain = new THREE.PlaneGeometry(5000, 9500, 30, 40);
  mountain.rotateX(-Math.PI / 2);
  mountain.translate(-5200, 0, 0);
  const positions = mountain.getAttribute('position');
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i),
      z = positions.getZ(i);
    const height =
      Math.exp(-Math.pow((x + 4700) / 1300, 2)) *
      (680 + 250 * Math.sin(z / 1100) + 130 * Math.cos(z / 570));
    positions.setY(i, height);
  }
  mountain.computeVertexNormals();
  group.add(new THREE.Mesh(mountain, matte('#627c70')));
  return { group, landmarks, water, labels };
}

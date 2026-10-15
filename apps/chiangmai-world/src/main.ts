import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  CityCollision,
  displayName,
  distanceToLine,
  project,
  unproject,
  type CityData,
  type Point,
} from './geo';
import { buildWorld, type Landmark } from './world';
import { Minimap } from './minimap';
import './style.css';

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `
  <main id="world" aria-label="โลกสามมิติเมืองเก่าเชียงใหม่"></main>
  <div id="loading" role="status"><div class="loading-mark">เชียงใหม่</div><p id="loading-text">กำลังเปิดแผนที่เมืองเก่า</p><div class="loading-line"></div></div>
  <header class="topbar">
    <div class="identity"><span class="city-symbol" aria-hidden="true">▤</span><div><h1>เชียงใหม่<span>OLD CITY WALK</span></h1><p>เมืองเก่า · โลก 3 มิติ</p></div></div>
    <div class="tools"><button id="time" title="เปลี่ยนแสงในเมือง">◷ <span id="time-label">09:00</span></button><button id="quality" title="เปลี่ยนคุณภาพภาพ">ภาพละเอียด</button><button id="help" aria-label="วิธีควบคุม">?</button><button id="fullscreen" aria-label="เต็มหน้าจอ">⛶</button></div>
  </header>
  <aside class="place-panel">
    <div class="panel-top"><span class="live-dot"></span><span id="mode-caption">สำรวจจากมุมสูง</span><span class="province">THAILAND</span></div>
    <h2 id="place-title">ภายในคูเมือง</h2>
    <p id="place-description">ถนน ซอย และรูปทรงอาคารจากแผนที่จริง เลือกจุดหมายแล้วลงไปเดินสำรวจได้เลย</p>
    <label for="destination">เลือกจุดเริ่มสำรวจ</label><div class="destination-row"><select id="destination" aria-label="เลือกจุดสำคัญ"></select><button id="go" aria-label="เดินที่จุดหมายที่เลือก">↗</button></div>
    <button id="start-walking" class="primary">ลงไปเดินที่ประตูท่าแพ <span>↗</span></button>
    <div class="place-bottom"><span id="street-name">เมืองเก่าเชียงใหม่</span><span id="coordinates">18.7895° N · 98.9850° E</span></div>
  </aside>
  <div class="compass" aria-label="เข็มทิศ"><span>W</span><span id="heading">N</span><span>E</span><div class="compass-notch"></div></div>
  <section class="map-panel" aria-label="แผนที่นำทาง"><div class="map-top"><span>แผนที่เมืองเก่า</span><button id="expand-map" aria-label="ขยายแผนที่" aria-expanded="false">⤢</button></div><canvas id="minimap" aria-label="แผนที่ถนนจริงและตำแหน่งของคุณ"></canvas><div class="map-bottom"><span>↑ N</span><span id="map-hint">คูเมืองเชียงใหม่</span><span>200 m</span></div></section>
  <nav class="view-switch" aria-label="มุมมอง"><button id="view-overview" class="active" aria-pressed="true">◈ มุมสูง</button><button id="view-walk" aria-pressed="false">♙ เดินสำรวจ</button></nav>
  <div class="keyboard-hint" id="hint">ลากเพื่อหมุน · เลื่อนเพื่อซูม · คลิกขวาลากเพื่อเลื่อน</div>
  <div class="reticle" aria-hidden="true"></div>
  <div id="scene-labels" aria-hidden="true"></div>
  <div id="touch-controls"><div id="joystick" aria-label="ลากเพื่อเดิน"><div id="stick"></div></div><button id="touch-run" aria-label="วิ่ง" aria-pressed="false">วิ่ง</button><span>ลากฝั่งขวาเพื่อมอง</span></div>
  <div class="attribution"><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a><button id="data-info">เกี่ยวกับฉากนี้</button></div>
  <div id="toast" role="status" aria-live="polite"></div>
  <dialog id="help-dialog"><button class="close-dialog" aria-label="ปิด">×</button><h2>ออกไปเดินเล่นกัน</h2><p>เลือกจุดหมายแล้วกด “ลงไปเดิน” เพื่อสำรวจเมืองในระดับสายตา</p><dl><dt>W A S D / ลูกศร</dt><dd>เดินหน้า ถอยหลัง และเดินด้านข้าง</dd><dt>ลากเมาส์บนฉาก</dt><dd>หันมองรอบตัว</dd><dt>คลิกบนฉาก</dt><dd>ล็อกเมาส์ให้มองได้อิสระ · กด Esc เพื่อปล่อย</dd><dt>Shift</dt><dd>วิ่ง</dd><dt>M</dt><dd>เปิดหรือย่อแผนที่ · คลิกแผนที่ที่ขยายเพื่อย้ายจุด</dd><dt>V</dt><dd>สลับมุมสูงกับเดิน</dd><dt>R</dt><dd>กลับจุดเริ่มเดิน</dd></dl><p>มือถือ: ลากวงกลมซ้ายเพื่อเดิน และลากฝั่งขวาของฉากเพื่อหันมอง</p><label class="check"><input type="checkbox" id="bob" /> ขยับกล้องตามจังหวะเดิน</label><button class="primary close-action">เริ่มสำรวจ</button></dialog>
  <dialog id="data-dialog"><button class="close-dialog" aria-label="ปิด">×</button><h2>สร้างเมืองจากแผนที่จริง</h2><p>ถนน ทางเดิน คูน้ำ รูปทรงอาคาร และตำแหน่งสถานที่ นำเข้าจาก OpenStreetMap พร้อมเก็บ snapshot ในตัวแอป</p><div id="data-stats"></div><p>อาคารส่วนใหญ่ไม่มีข้อมูลความสูง จึงประเมินจำนวนชั้นและสร้างหลังคา หน้าต่าง ประตู และกันสาดเสริม โมเดลวัดและกำแพงเป็นการจำลองรูปแบบ ไม่ใช่โมเดลสแกนจากสถานที่จริง</p><p>ต้นไม้ริมถนนบางส่วน เสาไฟ และภูเขาฉากหลังสร้างเพื่อบรรยากาศ พื้นฉากยังเป็นระนาบ ไม่มีข้อมูลระดับความสูงที่สำรวจจริง ภายในอาคารยังเข้าไม่ได้</p><p>ฉากนี้เป็นต้นแบบเดินคนเดียวบนคอม/มือถือ ยังไม่มีผู้เล่นออนไลน์หรือระบบ MMORPG</p><p id="data-date"></p><a href="/data/old-city.json" download="chiangmai-old-city-odbl.json">ดาวน์โหลดข้อมูลแผนที่ ODbL</a><button class="primary close-action">กลับไปสำรวจ</button></dialog>
`;

function element<T extends HTMLElement = HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}
const loadingText = element('loading-text');
const sceneHost = element('world');
const buttons = [
  'time',
  'quality',
  'help',
  'fullscreen',
  'go',
  'start-walking',
  'expand-map',
  'view-overview',
  'view-walk',
  'data-info',
];
buttons.forEach((id) => {
  element<HTMLButtonElement>(id).disabled = true;
});

async function boot(): Promise<void> {
  const response = await fetch(`${import.meta.env.BASE_URL}data/old-city.json`);
  if (!response.ok) throw new Error(`ไม่สามารถโหลดข้อมูลเมืองได้ (${response.status})`);
  const data: CityData = await response.json();
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#b3d5d9');
  scene.fog = new THREE.Fog('#c6d8d2', 1600, 6500);
  const camera = new THREE.PerspectiveCamera(48, innerWidth / innerHeight, 0.3, 16000);
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: 'high-performance',
    logarithmicDepthBuffer: true,
  });
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.tabIndex = 0;
  renderer.domElement.setAttribute(
    'aria-label',
    'ฉากเชียงใหม่ 3 มิติ ลากเพื่อหมุนมอง และใช้ WASD เพื่อเดิน',
  );
  sceneHost.appendChild(renderer.domElement);
  const hemi = new THREE.HemisphereLight('#e4f2ee', '#8f876d', 1.8);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#fff0d1', 2.4);
  sun.position.set(-650, 950, 400);
  sun.castShadow = false;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, {
    left: -110,
    right: 110,
    top: 110,
    bottom: -110,
    near: 10,
    far: 2400,
  });
  sun.shadow.bias = -0.00025;
  sun.shadow.normalBias = 0.15;
  scene.add(sun, sun.target);
  const world = await buildWorld(data, (value) => {
    loadingText.textContent = value;
  });
  scene.add(world.group);
  const collision = new CityCollision(data);
  const map = new Minimap(element<HTMLCanvasElement>('minimap'), data, world.landmarks);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 45;
  controls.maxDistance = 8000;
  controls.maxPolarAngle = Math.PI * 0.485;
  controls.target.set(65, 0, 85);
  const initialFit = Math.max(1, 0.9 / camera.aspect);
  camera.position.set(65 + 25 * initialFit, 2500 * initialFit, 85 + 1365 * initialFit);
  controls.update();

  let mode: 'walk' | 'overview' = 'overview';
  let position: Point = collision.nearestWalkable(world.landmarks[0].spawn);
  let yaw = Math.PI / 2;
  let pitch = 0;
  let lastSpawn = [...position] as Point;
  let selected = world.landmarks[0];
  let expanded = false;
  let golden = false;
  let highQuality = true;
  let bob = false;
  let running = false;
  let walked = 0;
  const keys = new Set<string>();
  const touches = { x: 0, y: 0 };
  let frames = 0;
  let fps = 0;
  let lastFpsTime = performance.now();
  let lastFrame = performance.now();
  let lastUi = 0;
  let toastTimer: ReturnType<typeof setTimeout>;

  const destination = element<HTMLSelectElement>('destination');
  for (const [index, landmark] of world.landmarks.entries()) {
    const option = document.createElement('option');
    option.value = landmark.id;
    option.textContent = `${index + 1}. ${landmark.name}`;
    destination.appendChild(option);
  }
  const labelElements = world.landmarks.map((landmark) => {
    const div = document.createElement('div');
    div.className = 'landmark-label';
    const dot = document.createElement('span');
    dot.className = 'landmark-dot';
    const text = document.createElement('span');
    text.textContent = landmark.name;
    div.append(dot, text);
    element('scene-labels').append(div);
    return { landmark, div };
  });

  function notify(message: string): void {
    element('toast').textContent = message;
    element('toast').classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => element('toast').classList.remove('visible'), 3500);
  }
  function setMode(next: typeof mode): void {
    mode = next;
    document.body.classList.toggle('walking', mode === 'walk');
    controls.enabled = mode === 'overview';
    element('view-overview').classList.toggle('active', mode === 'overview');
    element('view-walk').classList.toggle('active', mode === 'walk');
    element('view-overview').setAttribute('aria-pressed', String(mode === 'overview'));
    element('view-walk').setAttribute('aria-pressed', String(mode === 'walk'));
    element('mode-caption').textContent = mode === 'walk' ? 'เดินสำรวจเมือง' : 'สำรวจจากมุมสูง';
    element('hint').textContent =
      mode === 'walk'
        ? 'W A S D เดิน · ลากเพื่อมอง · Shift วิ่ง · Esc ปล่อยเมาส์'
        : 'ลากเพื่อหมุน · เลื่อนเพื่อซูม · คลิกขวาลากเพื่อเลื่อน';
    sun.castShadow = mode === 'walk' && highQuality;
    if (mode === 'overview') {
      if (document.pointerLockElement) document.exitPointerLock();
      controls.target.set(position[0], 0, position[1]);
      camera.position.set(position[0] + 600, 1000, position[1] + 850);
      controls.update();
      (scene.fog as THREE.Fog).near = 1600;
      (scene.fog as THREE.Fog).far = 6500;
    } else {
      (scene.fog as THREE.Fog).near = 450;
      (scene.fog as THREE.Fog).far = 2200;
    }
  }
  function showPlace(landmark: Landmark): void {
    selected = landmark;
    element('place-title').textContent = landmark.name;
    element('place-description').textContent = landmark.description;
    element('start-walking').firstChild!.textContent = `ลงไปเดินที่${landmark.name} `;
    destination.value = landmark.id;
  }
  function teleport(point: Point, landmark?: Landmark): void {
    const min = project(data.meta.bbox[1], data.meta.bbox[2], data.meta.origin);
    const max = project(data.meta.bbox[3], data.meta.bbox[0], data.meta.origin);
    const bounded: Point = [
      Math.max(min[0] + 4, Math.min(max[0] - 4, point[0])),
      Math.max(min[1] + 4, Math.min(max[1] - 4, point[1])),
    ];
    position = collision.nearestWalkable(bounded);
    lastSpawn = [...position];
    yaw =
      landmark?.id === 'thaphae'
        ? Math.PI / 2
        : landmark
          ? Math.atan2(position[0] - landmark.position[0], position[1] - landmark.position[1])
          : yaw;
    pitch = landmark && ['chediluang', 'phrasingh'].includes(landmark.id) ? 0.26 : 0;
    if (landmark) showPlace(landmark);
    setMode('walk');
    notify(landmark ? `เริ่มสำรวจที่${landmark.name}` : 'ย้ายไปจุดที่เลือกบนแผนที่แล้ว');
  }
  element('start-walking').addEventListener('click', () => teleport(selected.spawn, selected));
  element('go').addEventListener('click', () => teleport(selected.spawn, selected));
  destination.addEventListener('change', () => {
    const landmark = world.landmarks.find((p) => p.id === destination.value)!;
    showPlace(landmark);
    if (mode === 'overview') {
      controls.target.set(
        ...([landmark.position[0], 0, landmark.position[1]] as [number, number, number]),
      );
      camera.position.set(landmark.position[0] + 150, 260, landmark.position[1] + 270);
      controls.update();
    }
  });
  element('view-overview').addEventListener('click', () => {
    if (mode !== 'overview') setMode('overview');
  });
  element('view-walk').addEventListener('click', () => {
    if (mode !== 'walk') teleport(lastSpawn, selected);
  });
  map.onTeleport = (point) => {
    teleport(point);
    toggleMap(false);
  };
  function toggleMap(value = !expanded): void {
    expanded = value;
    document.body.classList.toggle('map-expanded', expanded);
    element('expand-map').setAttribute('aria-expanded', String(expanded));
    element('expand-map').textContent = expanded ? '×' : '⤢';
    element('map-hint').textContent = expanded ? 'คลิกบนแผนที่เพื่อย้ายจุด' : 'คูเมืองเชียงใหม่';
    map.setExpanded(expanded);
    if (expanded && document.pointerLockElement) document.exitPointerLock();
  }
  element('expand-map').addEventListener('click', () => toggleMap());
  function showDialog(id: string): void {
    if (document.pointerLockElement) document.exitPointerLock();
    keys.clear();
    touches.x = touches.y = 0;
    element<HTMLDialogElement>(id).showModal();
  }
  element('help').addEventListener('click', () => showDialog('help-dialog'));
  element('data-info').addEventListener('click', () => showDialog('data-dialog'));
  document.querySelectorAll<HTMLButtonElement>('.close-dialog, .close-action').forEach((button) => {
    button.addEventListener('click', () => button.closest('dialog')!.close());
  });
  element<HTMLInputElement>('bob').addEventListener('change', (e) => {
    bob = (e.target as HTMLInputElement).checked;
  });
  element('fullscreen').addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      notify('อุปกรณ์นี้ไม่รองรับเต็มหน้าจอ ใช้โหมดแนวนอนเพื่อเห็นเมืองกว้างขึ้นได้');
    }
  });
  element('time').addEventListener('click', () => {
    golden = !golden;
    element('time-label').textContent = golden ? '17:30' : '09:00';
    sun.color.set(golden ? '#ffc086' : '#fff0d1');
    hemi.color.set(golden ? '#ddd8d2' : '#e4f2ee');
    sun.intensity = golden ? 2.8 : 2.4;
    scene.background = new THREE.Color(golden ? '#d8bda2' : '#b3d5d9');
    (scene.fog as THREE.Fog).color.set(golden ? '#d6c1a6' : '#c6d8d2');
  });
  element('quality').addEventListener('click', () => {
    highQuality = !highQuality;
    renderer.setPixelRatio(Math.min(devicePixelRatio, highQuality ? 1.5 : 0.85));
    sun.castShadow = mode === 'walk' && highQuality;
    element('quality').textContent = highQuality ? 'ภาพละเอียด' : 'ภาพประหยัด';
    notify(
      highQuality ? 'เปิดภาพละเอียดและเงาในโหมดเดิน' : 'ลดความละเอียดภาพเพื่อให้เดินได้ลื่นขึ้น',
    );
  });

  document.addEventListener('keydown', (e) => {
    if (
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLSelectElement ||
      document.querySelector('dialog[open]')
    )
      return;
    const key = e.key.toLowerCase();
    if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(key))
      e.preventDefault();
    keys.add(key);
    if (e.repeat) return;
    if (key === 'm') toggleMap();
    if (key === 'escape' && expanded) toggleMap(false);
    if (key === 'v') setMode(mode === 'walk' ? 'overview' : 'walk');
    if (key === 'r') teleport(lastSpawn);
  });
  document.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
  window.addEventListener('blur', () => {
    keys.clear();
    touches.x = touches.y = 0;
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      keys.clear();
      touches.x = touches.y = 0;
    }
  });
  const look = (dx: number, dy: number) => {
    yaw -= dx * 0.0027;
    pitch = Math.max(-1.24, Math.min(1.24, pitch - dy * 0.0027));
  };
  let drag: { x: number; y: number; moved: boolean; id: number } | undefined;
  renderer.domElement.addEventListener('pointerdown', (e) => {
    if (mode !== 'walk' || (e.pointerType === 'touch' && e.clientX < innerWidth * 0.35)) return;
    drag = { x: e.clientX, y: e.clientY, moved: false, id: e.pointerId };
    renderer.domElement.setPointerCapture(e.pointerId);
  });
  renderer.domElement.addEventListener('pointermove', (e) => {
    if (
      mode !== 'walk' ||
      document.pointerLockElement === renderer.domElement ||
      !drag ||
      drag.id !== e.pointerId
    )
      return;
    const dx = e.clientX - drag.x,
      dy = e.clientY - drag.y;
    if (Math.abs(dx) + Math.abs(dy) > 1) drag.moved = true;
    look(dx, dy);
    drag.x = e.clientX;
    drag.y = e.clientY;
  });
  renderer.domElement.addEventListener('pointerup', (e) => {
    if (drag && !drag.moved && e.pointerType === 'mouse' && mode === 'walk') {
      try {
        const request = renderer.domElement.requestPointerLock();
        if (request && typeof request.catch === 'function')
          request.catch(() => notify('ลากเมาส์บนฉากเพื่อหันมองได้'));
      } catch {
        notify('ลากเมาส์บนฉากเพื่อหันมองได้');
      }
    }
    drag = undefined;
  });
  renderer.domElement.addEventListener('pointercancel', () => {
    drag = undefined;
  });
  document.addEventListener('mousemove', (e) => {
    if (mode === 'walk' && document.pointerLockElement === renderer.domElement)
      look(e.movementX, e.movementY);
  });
  const joystick = element('joystick'),
    stick = element('stick');
  let joystickId: number | null = null;
  function moveStick(e: PointerEvent): void {
    const rect = joystick.getBoundingClientRect();
    const dx = e.clientX - rect.left - rect.width / 2,
      dy = e.clientY - rect.top - rect.height / 2;
    const length = Math.hypot(dx, dy),
      max = 35,
      scale = Math.min(1, max / Math.max(1, length));
    touches.x = (dx * scale) / max;
    touches.y = (dy * scale) / max;
    stick.style.transform = `translate(${dx * scale}px, ${dy * scale}px)`;
  }
  joystick.addEventListener('pointerdown', (e) => {
    joystickId = e.pointerId;
    joystick.setPointerCapture(e.pointerId);
    moveStick(e);
  });
  joystick.addEventListener('pointermove', (e) => {
    if (joystickId === e.pointerId) moveStick(e);
  });
  const resetStick = () => {
    joystickId = null;
    touches.x = touches.y = 0;
    stick.style.transform = '';
  };
  joystick.addEventListener('pointerup', resetStick);
  joystick.addEventListener('pointercancel', resetStick);
  element('touch-run').addEventListener('click', () => {
    running = !running;
    element('touch-run').setAttribute('aria-pressed', String(running));
  });

  element('data-stats').textContent =
    `${data.meta.counts.buildings.toLocaleString()} รูปทรงอาคาร · ${data.meta.counts.roads.toLocaleString()} ช่วงถนน/ทางเดิน · ${data.meta.counts.water} แหล่งน้ำ`;
  element('data-date').textContent =
    `ข้อมูลแผนที่ ณ ${new Date(data.meta.osmTimestamp).toLocaleDateString('th-TH')} · ขอบเขตรวมแนวถนนรอบนอกคูเมือง`;
  const boundsMin = project(data.meta.bbox[1], data.meta.bbox[2], data.meta.origin);
  const boundsMax = project(data.meta.bbox[3], data.meta.bbox[0], data.meta.origin);
  const projected = new THREE.Vector3();
  const clockPosition = new THREE.Vector3();

  function updateLabels(): void {
    for (const { landmark, div } of labelElements) {
      const distance = Math.hypot(
        camera.position.x - landmark.position[0],
        camera.position.z - landmark.position[1],
      );
      projected.set(
        landmark.position[0],
        landmark.id === 'chediluang' ? 45 : 20,
        landmark.position[1],
      );
      const facing =
        projected.clone().sub(camera.position).dot(camera.getWorldDirection(new THREE.Vector3())) >
        0;
      projected.project(camera);
      const visible =
        facing &&
        projected.z < 1 &&
        (mode === 'overview' || distance < 190) &&
        Math.abs(projected.x) < 0.95 &&
        Math.abs(projected.y) < 0.85;
      div.style.display = visible ? 'flex' : 'none';
      if (visible)
        div.style.transform = `translate(${(projected.x * 0.5 + 0.5) * innerWidth}px, ${(-projected.y * 0.5 + 0.5) * innerHeight}px) translate(-50%, -100%)`;
    }
  }
  function updateHud(now: number): void {
    if (now - lastUi < 120) return;
    lastUi = now;
    const p: Point = mode === 'walk' ? position : [controls.target.x, controls.target.z];
    const ll = unproject(...p, data.meta.origin);
    element('coordinates').textContent = `${ll[1].toFixed(5)}° N · ${ll[0].toFixed(5)}° E`;
    const viewYaw =
      mode === 'walk'
        ? yaw
        : Math.atan2(camera.position.x - controls.target.x, camera.position.z - controls.target.z);
    const degrees = ((((-viewYaw * 180) / Math.PI) % 360) + 360) % 360;
    element('heading').textContent = `${Math.round(degrees)}°`;
    map.draw(p, viewYaw);
    updateLabels();
    if (mode === 'walk') {
      let nearest = { distance: 35, name: 'ตรอกในเมืองเก่า' };
      for (const road of data.roads) {
        const name = displayName(road.tags);
        if (!name) continue;
        const distance = distanceToLine(position, road.points);
        if (distance < nearest.distance) nearest = { distance, name };
      }
      element('street-name').textContent = nearest.name;
    }
    // Read-only diagnostics for tests and profiling; no mutation/debug commands are exposed.
    document.documentElement.dataset.mode = mode;
    document.documentElement.dataset.position = `${position[0].toFixed(3)},${position[1].toFixed(3)}`;
    document.documentElement.dataset.walked = walked.toFixed(2);
    document.documentElement.dataset.fps = String(fps);
    document.documentElement.dataset.drawcalls = String(renderer.info.render.calls);
    document.documentElement.dataset.triangles = String(renderer.info.render.triangles);
    document.documentElement.dataset.depthBuffer = renderer.capabilities.logarithmicDepthBuffer
      ? 'logarithmic'
      : 'standard';
  }
  function frame(now: number): void {
    const dt = Math.min((now - lastFrame) / 1000, 0.1);
    lastFrame = now;
    frames++;
    if (now - lastFpsTime > 1000) {
      fps = Math.round((frames * 1000) / (now - lastFpsTime));
      frames = 0;
      lastFpsTime = now;
    }
    const paused = !!document.querySelector('dialog[open]') || expanded || document.hidden;
    if (mode === 'walk') {
      if (!paused) {
        let forward =
          Number(keys.has('w') || keys.has('arrowup')) -
          Number(keys.has('s') || keys.has('arrowdown')) -
          touches.y;
        let strafe =
          Number(keys.has('d') || keys.has('arrowright')) -
          Number(keys.has('a') || keys.has('arrowleft')) +
          touches.x;
        const length = Math.hypot(forward, strafe);
        if (length > 1) {
          forward /= length;
          strafe /= length;
        }
        const speed = keys.has('shift') || running ? 8.4 : 3.2;
        const dx = (-Math.sin(yaw) * forward + Math.cos(yaw) * strafe) * speed * dt;
        const dz = (-Math.cos(yaw) * forward - Math.sin(yaw) * strafe) * speed * dt;
        // Substeps prevent crossing thin mapped walls during slow frames or sprinting.
        const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.12));
        for (let i = 0; i < steps; i++) {
          const nextX: Point = [
            Math.max(boundsMin[0] + 2, Math.min(boundsMax[0] - 2, position[0] + dx / steps)),
            position[1],
          ];
          if (!collision.blocked(nextX)) {
            walked += Math.abs(nextX[0] - position[0]);
            position[0] = nextX[0];
          }
          const nextZ: Point = [
            position[0],
            Math.max(boundsMin[1] + 2, Math.min(boundsMax[1] - 2, position[1] + dz / steps)),
          ];
          if (!collision.blocked(nextZ)) {
            walked += Math.abs(nextZ[1] - position[1]);
            position[1] = nextZ[1];
          }
        }
        if (length > 0 && !bob) clockPosition.y = 0;
        else clockPosition.y = bob && length > 0 ? Math.sin(now * 0.011) * 0.035 : 0;
      }
      camera.position.set(position[0], 1.78 + clockPosition.y, position[1]);
      camera.rotation.order = 'YXZ';
      camera.rotation.set(pitch, yaw, 0);
      sun.position.set(position[0] - 650, golden ? 460 : 950, position[1] + 400);
      sun.target.position.set(position[0], 0, position[1]);
    } else controls.update();
    for (const child of world.group.children) {
      if (child.userData.detail && child instanceof THREE.InstancedMesh && child.boundingSphere) {
        const center = child.boundingSphere.center;
        child.visible =
          mode === 'walk' &&
          Math.hypot(center.x - position[0], center.z - position[1]) <
            (highQuality ? 340 : 170) + child.boundingSphere.radius;
      }
    }
    renderer.render(scene, camera);
    updateHud(now);
  }
  window.addEventListener('resize', () => {
    const oldFit = Math.max(1, 0.9 / camera.aspect);
    camera.aspect = innerWidth / innerHeight;
    if (mode === 'overview') {
      const ratio = Math.max(1, 0.9 / camera.aspect) / oldFit;
      camera.position.sub(controls.target).multiplyScalar(ratio).add(controls.target);
    }
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });
  renderer.domElement.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    notify('การแสดงผล 3D หยุดชั่วคราว กรุณาโหลดหน้าใหม่');
  });
  buttons.forEach((id) => {
    element<HTMLButtonElement>(id).disabled = false;
  });
  element('loading').remove();
  renderer.setAnimationLoop(frame);
  document.documentElement.dataset.ready = 'true';
}

boot().catch((error: unknown) => {
  console.error(error);
  loadingText.textContent = error instanceof Error ? error.message : 'เปิดโลก 3D ไม่สำเร็จ';
  const retry = document.createElement('button');
  retry.className = 'primary';
  retry.textContent = 'ลองเปิดเมืองอีกครั้ง';
  retry.addEventListener('click', () => location.reload());
  element('loading').appendChild(retry);
  const note = document.createElement('p');
  note.textContent = 'ลองใช้ Chrome หรือ Safari รุ่นปัจจุบันที่เปิดการเร่งกราฟิก 3D';
  element('loading').appendChild(note);
});

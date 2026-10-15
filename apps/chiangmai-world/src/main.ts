import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CityCollision, project, type CityData, type Point } from './geo';
import { buildWorld } from './world';
import { Minimap } from './minimap';
import { CombatSimulation, SPIRIT_WAVE, type CombatPose } from './combat';
import { CombatView } from './combat-view';
import { CrowdSimulation } from './crowd';
import { CrowdView } from './crowd-view';
import { CrowdBenchmark, summarizeFrames, type FrameSample } from './frame-profiler';
import './style.css';
import './combat.css';
import './crowd.css';

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `
  <main id="world" aria-label="โลกสามมิติเมืองเก่าเชียงใหม่"></main>
  <div id="loading" role="status"><div class="loading-mark">เชียงใหม่</div><p id="loading-text">กำลังเปิดแผนที่เมืองเก่า</p><div class="loading-line"></div></div>
  <header class="topbar">
    <div class="identity"><span class="city-symbol" aria-hidden="true">⚔</span><div><h1>OLD CITY<span>SWORDSMAN PROTOTYPE</span></h1><p>นักดาบ · มุมมองบุคคลที่หนึ่ง</p></div></div>
    <div class="tools"><button id="time" title="เปลี่ยนแสงในเมือง">◷ <span id="time-label">09:00</span></button><button id="quality" title="เปลี่ยนคุณภาพภาพ">ภาพละเอียด</button><button id="help" aria-label="วิธีควบคุม">?</button><button id="fullscreen" aria-label="เต็มหน้าจอ">⛶</button></div>
  </header>
  <aside class="quest"><span>ฝึกฝนนักดาบ</span><strong>ปราบสไลม์ <b id="kill-count">0 / 3</b></strong><small id="quest-note">เข้าใกล้ · เล็ง · ฟันดาบ</small></aside>
  <div class="compass" aria-label="เข็มทิศ"><span>W</span><span id="heading">N</span><span>E</span><div class="compass-notch"></div></div>
  <section class="map-panel" aria-label="แผนที่นำทาง"><div class="map-top"><span>แผนที่โลก</span><button id="expand-map" aria-label="ขยายแผนที่" aria-expanded="false">⤢</button></div><canvas id="minimap" aria-label="แผนที่เส้นทางและตำแหน่งของคุณ"></canvas><div class="map-bottom"><span>↑ N</span><span id="map-hint">M เปิดแผนที่</span><span>200 m</span></div></section>
  <nav class="view-switch" aria-label="มุมมอง"><button id="view-overview" aria-pressed="false">◈ มุมสูง</button><button id="view-walk" class="active" aria-pressed="true">⚔ กลับไปเล่น</button></nav>
  <div class="keyboard-hint" id="hint">ลากเพื่อหมุน · เลื่อนเพื่อซูม · คลิกขวาลากเพื่อเลื่อน</div>
  <div class="reticle" id="reticle" aria-hidden="true"></div>
  <div id="combat-labels" aria-hidden="true"></div><div id="damage-overlay" aria-hidden="true"></div><div id="spirit-flash" aria-hidden="true"></div>
  <section class="player-status" aria-label="สถานะนักดาบ"><div><strong id="player-level">นักดาบ Lv.1</strong><span id="hp-text">100 / 100</span></div><div class="meter health"><i id="hp-bar"></i></div><div class="meter stamina"><i id="stamina-bar"></i></div><div class="status-bottom"><span>พลังวิญญาณ</span><span id="spirit-text">100 / 100</span></div><div class="meter spirit"><i id="spirit-bar"></i></div><div class="status-bottom"><span>ประสบการณ์</span><span id="xp-text">0 / 60 XP</span></div><div class="meter experience"><i id="xp-bar"></i></div></section>
  <div class="combat-actions"><button id="block" aria-pressed="false"><span>ตั้งรับ</span><kbd>Q / คลิกขวาค้าง</kbd></button><button id="attack"><span>ฟันดาบ</span><kbd>F / คลิกซ้าย</kbd></button><button id="spirit-skill" aria-label="จันทร์ผ่าวิญญาณ ใช้สกิล E"><span>จันทร์ผ่าวิญญาณ</span><small id="skill-state">พร้อมใช้ · 35 พลัง</small><kbd>E</kbd></button></div>
  <div id="skill-charge" hidden role="status"><span>กำลังรวมพลังวิญญาณ</span><div class="meter spirit"><i id="charge-bar"></i></div></div>
  <div id="start-panel" class="battle-screen"><div><span class="eyebrow">FIRST-PERSON COMBAT</span><h2>จับดาบ แล้วออกไปลุย</h2><p>สไลม์ 3 ตัวรออยู่ด้านหน้า<br>เข้าใกล้เพื่อฟัน ถอยหลบตอนตัวมันเปลี่ยนเป็นสีเหลือง</p><p class="control-summary">WASD เดิน · Shift วิ่ง · ลากเมาส์มอง<br>F ฟันดาบ · Q ค้างเพื่อตั้งรับ<br>E ชาร์จและปล่อยคลื่นดาบระยะไกล</p><button id="start-game" class="primary">เริ่มต่อสู้ →</button><small>ต้นแบบเล่นคนเดียว · ยังไม่มีระบบออนไลน์</small></div></div>
  <div id="death-panel" class="battle-screen" hidden><div><span class="eyebrow">TRY AGAIN</span><h2>นักดาบล้มลงแล้ว</h2><p>รอจังหวะฟัน แล้วถอยหลบก่อนสไลม์กระโดด</p><button id="restart" class="primary">เริ่มใหม่ →</button></div></div>
  <button id="pause" aria-pressed="false">พักเกม</button>
  <div id="touch-controls"><div id="joystick" aria-label="ลากเพื่อเดิน"><div id="stick"></div></div><button id="touch-run" aria-label="วิ่ง" aria-pressed="false">วิ่ง</button><span>ลากฝั่งขวาเพื่อมอง</span></div>
  <div class="attribution"><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a><button id="data-info">เกี่ยวกับฉากนี้</button></div>
  <div id="toast" role="status" aria-live="polite"></div>
  <button id="crowd-toggle">จำลองนักดาบ 10 คน</button>
  <aside id="farm-panel" hidden aria-label="ทดสอบประสิทธิภาพ"><div class="farm-heading"><strong>ลานฝึก · จำลองผู้เล่น</strong><span id="farm-population">10 นักดาบ / 30 สไลม์</span></div><p>เดินหาเป้าหมาย ฟัน ใช้คลื่นดาบ และเกิดใหม่<br>จำลองบนเครื่อง · ยังไม่ใช่การทดสอบเซิร์ฟเวอร์</p><div class="farm-buttons"><button id="farm-one">1 คน</button><button id="farm-ten">10 คน</button><button id="farm-benchmark">วัดเทียบ 1 ↔ 10 คน</button></div><strong id="farm-live">กำลังวัดเฟรม…</strong><div id="farm-metrics"></div><div id="farm-activity"></div><p id="benchmark-status" role="status">พร้อมวัด · อุ่นฉาก 3s + เก็บ 10s × 4 รอบ</p><div id="benchmark-results"></div><button id="export-benchmark" hidden>ดาวน์โหลดผล JSON</button></aside>
  <dialog id="help-dialog"><button class="close-dialog" aria-label="ปิด">×</button><h2>วิถีนักดาบ</h2><dl><dt>W A S D / ลูกศร</dt><dd>เดิน · Shift วิ่ง</dd><dt>F / คลิกซ้าย</dt><dd>ฟันดาบในระยะประมาณ 3 เมตร เล็งกลางจอไปที่สไลม์</dd><dt>E / ปุ่มจันทร์ผ่าวิญญาณ</dt><dd>รวมพลัง 0.9 วินาทีแล้วปล่อยคลื่นแนวราบตามทิศมอง ระยะ 30 เมตร ใช้พลังวิญญาณ 35 คูลดาวน์ 5 วินาที คลื่นหยุดเมื่อชนกำแพง</dd><dt>Q / คลิกขวาค้าง</dt><dd>ตั้งรับด้านหน้า ใช้ความอึดและลดความเสียหาย</dd><dt>ลากเมาส์ / คลิกฉาก</dt><dd>หันมอง / ล็อกเมาส์ · Esc ปล่อยและพักเกม</dd><dt>M / V / P</dt><dd>แผนที่ / มุมสูง / พักเกม</dd></dl><p>สไลม์สีเหลืองกำลังเตรียมโจมตี ถอยออกให้ทัน! ชนะแล้วได้ XP และเลเวล สไลม์จะเกิดใหม่ใน 8 วินาที</p><p>มือถือ: จอยซ้ายเดิน ลากฝั่งขวาหันมอง ปุ่มฟันและตั้งรับอยู่ด้านล่าง</p><label class="check"><input type="checkbox" id="bob" /> ขยับกล้องตามจังหวะเดิน</label><button class="primary close-action">กลับไปเล่น</button></dialog>
  <dialog id="data-dialog"><button class="close-dialog" aria-label="ปิด">×</button><h2>สร้างเมืองจากแผนที่จริง</h2><p>ถนน ทางเดิน คูน้ำ รูปทรงอาคาร และตำแหน่งสถานที่ นำเข้าจาก OpenStreetMap พร้อมเก็บ snapshot ในตัวแอป</p><div id="data-stats"></div><p>อาคารส่วนใหญ่ไม่มีข้อมูลความสูง จึงประเมินจำนวนชั้นและสร้างหลังคา หน้าต่าง ประตู และกันสาดเสริม โมเดลวัดและกำแพงเป็นการจำลองรูปแบบ ไม่ใช่โมเดลสแกนจากสถานที่จริง</p><p>ต้นไม้ริมถนนบางส่วน เสาไฟ และภูเขาฉากหลังสร้างเพื่อบรรยากาศ พื้นฉากยังเป็นระนาบ ไม่มีข้อมูลระดับความสูงที่สำรวจจริง ภายในอาคารยังเข้าไม่ได้</p><p>ฉากนี้เป็นต้นแบบต่อสู้นักดาบกับสไลม์ในเครื่องคนเดียว ยังไม่มีผู้เล่นออนไลน์หรือการบันทึกความคืบหน้า</p><p id="data-date"></p><a href="/data/old-city.json" download="chiangmai-old-city-odbl.json">ดาวน์โหลดข้อมูลแผนที่ ODbL</a><button class="primary close-action">กลับไปเล่น</button></dialog>
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
  const map = new Minimap(element<HTMLCanvasElement>('minimap'), data);
  const spawn = collision.nearestWalkable(world.landmarks[0].spawn);
  const blocked = (point: Point, radius?: number) => collision.blocked(point, radius);
  const combat = new CombatSimulation(
    [
      [886, 192],
      [884, 185],
      [885, 200],
    ].map((p) => collision.nearestWalkable(p as Point)),
  );
  const combatView = new CombatView(scene, camera, combat, element('combat-labels'));
  const crowd = new CrowdSimulation([891, 192], (point) => collision.nearestWalkable(point));
  crowd.configure(10);
  const crowdView = new CrowdView(scene, camera, crowd, element('combat-labels'));
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
  let position: Point = [...spawn];
  let yaw = Math.PI / 2;
  let pitch = -0.16;
  let battleStarted = false;
  let manualPause = false;
  let mouseBlocking = false;
  let touchBlocking = false;
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
  let farmActive = false;
  const liveSamples: FrameSample[] = [];
  const benchmark = new CrowdBenchmark((count) => {
    crowd.configure(count);
    liveSamples.length = 0;
  });
  const environment = () => ({
    userAgent: navigator.userAgent,
    viewport: [innerWidth, innerHeight],
    devicePixelRatio,
    renderPixelRatio: renderer.getPixelRatio(),
    quality: highQuality ? 'high' : 'economy',
    camera: [914, 18, 209],
    shadows: sun.castShadow,
    mapTimestamp: data.meta.osmTimestamp,
    timing: 'rAF wall time; CPU timings exclude asynchronous GPU execution',
    scenario: '1 vs 10 local AI swordsmen; 30 shared slimes; skills enabled; no network/server',
  });
  let measuredEnvironment: ReturnType<typeof environment> | null = null;
  const report = () => ({
    capturedAt: new Date().toISOString(),
    environment: measuredEnvironment ?? environment(),
    results: benchmark.results,
  });
  function enterFarm(count: 1 | 10 = 10): void {
    benchmark.cancel('เปลี่ยนจำนวน');
    crowd.configure(count);
    liveSamples.length = 0;
    farmActive = true;
    combat.reset();
    crowdView.setVisible(true);
    position = [914, 209];
    yaw = Math.atan2(23, 17);
    pitch = -0.55;
    battleStarted = true;
    element('start-panel').hidden = true;
    element('death-panel').hidden = true;
    document.body.classList.add('farming');
    element('farm-panel').hidden = false;
    element('crowd-toggle').textContent = 'กลับไปเล่นนักดาบ';
    toggleMap(false);
    setMode('walk');
    setPaused(false);
  }
  element('crowd-toggle').addEventListener('click', () =>
    farmActive ? startBattle() : enterFarm(),
  );
  element('farm-one').addEventListener('click', () => enterFarm(1));
  element('farm-ten').addEventListener('click', () => enterFarm(10));
  element('farm-benchmark').addEventListener('click', () => {
    enterFarm(1);
    measuredEnvironment = environment();
    benchmark.start();
  });
  element('export-benchmark').addEventListener('click', () => {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(report(), null, 2)], { type: 'application/json' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = 'old-city-crowd-benchmark.json';
    link.click();
    URL.revokeObjectURL(url);
  });

  const pose = (): CombatPose => ({
    position,
    yaw,
    pitch,
    blocking: combat.chargingAt === null && (keys.has('q') || mouseBlocking || touchBlocking),
  });
  const paused = () =>
    manualPause ||
    !battleStarted ||
    expanded ||
    mode !== 'walk' ||
    document.hidden ||
    !!document.querySelector('dialog[open]');
  function setPaused(value: boolean): void {
    manualPause = value;
    if (value) benchmark.cancel('พักเกมหรือออกจากหน้าจอ');
    keys.clear();
    mouseBlocking = touchBlocking = false;
    touches.x = touches.y = 0;
    element('pause').textContent = value ? 'เล่นต่อ ▶' : 'พักเกม';
    element('pause').setAttribute('aria-pressed', String(value));
    document.body.classList.toggle('battle-paused', value);
    if (value && document.pointerLockElement) document.exitPointerLock();
  }
  function attack(): void {
    if (!paused() && !farmActive) combat.attack(pose(), blocked);
  }
  function castSkill(): void {
    if (paused() || farmActive) return;
    if (!combat.castSkill(pose())) {
      if (combat.chargingAt !== null) return;
      notify(
        pose().blocking
          ? 'ปล่อยตั้งรับก่อนใช้สกิล'
          : combat.player.spirit < SPIRIT_WAVE.cost
            ? 'พลังวิญญาณไม่พอ รอฟื้นพลังสักครู่'
            : 'สกิลยังไม่พร้อม รอจังหวะดาบหรือคูลดาวน์',
      );
    }
  }
  function startBattle(): void {
    benchmark.cancel('กลับไปเล่น');
    farmActive = false;
    crowdView.setVisible(false);
    document.body.classList.remove('farming');
    element('farm-panel').hidden = true;
    element('crowd-toggle').textContent = 'จำลองนักดาบ 10 คน';
    combat.reset();
    combatView.reset();
    position = [...spawn];
    yaw = Math.PI / 2;
    pitch = -0.16;
    battleStarted = true;
    element('start-panel').hidden = true;
    element('death-panel').hidden = true;
    toggleMap(false);
    setMode('walk');
    setPaused(false);
  }
  element('start-game').addEventListener('click', startBattle);
  element('restart').addEventListener('click', startBattle);
  element('attack').addEventListener('click', attack);
  element('spirit-skill').addEventListener('click', castSkill);
  element('block').addEventListener('click', () => {
    if (!paused()) touchBlocking = !touchBlocking;
  });
  element('pause').addEventListener('click', () => setPaused(!manualPause));

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
    camera.fov = mode === 'walk' ? 68 : 48;
    camera.updateProjectionMatrix();
    element('hint').textContent =
      mode === 'walk'
        ? 'WASD เดิน · F ฟัน · E คลื่นดาบ · Q ตั้งรับ · P พัก'
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
  function teleport(point: Point): void {
    const min = project(data.meta.bbox[1], data.meta.bbox[2], data.meta.origin);
    const max = project(data.meta.bbox[3], data.meta.bbox[0], data.meta.origin);
    const bounded: Point = [
      Math.max(min[0] + 4, Math.min(max[0] - 4, point[0])),
      Math.max(min[1] + 4, Math.min(max[1] - 4, point[1])),
    ];
    position = collision.nearestWalkable(bounded);
    setMode('walk');
    notify('ย้ายไปจุดที่เลือกบนแผนที่แล้ว');
  }
  element('view-overview').addEventListener('click', () => {
    if (mode !== 'overview') setMode('overview');
  });
  element('view-walk').addEventListener('click', () => {
    if (mode !== 'walk') setMode('walk');
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
    element('map-hint').textContent = expanded ? 'คลิกเพื่อย้ายจุด · พักการต่อสู้' : 'M เปิดแผนที่';
    map.setExpanded(expanded);
    if (expanded && document.pointerLockElement) document.exitPointerLock();
  }
  element('expand-map').addEventListener('click', () => toggleMap());
  function showDialog(id: string): void {
    benchmark.cancel('เปิดหน้าต่างข้อมูล');
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
    benchmark.cancel('เปลี่ยนแสง');
    golden = !golden;
    element('time-label').textContent = golden ? '17:30' : '09:00';
    sun.color.set(golden ? '#ffc086' : '#fff0d1');
    hemi.color.set(golden ? '#ddd8d2' : '#e4f2ee');
    sun.intensity = golden ? 2.8 : 2.4;
    scene.background = new THREE.Color(golden ? '#d8bda2' : '#b3d5d9');
    (scene.fog as THREE.Fog).color.set(golden ? '#d6c1a6' : '#c6d8d2');
  });
  element('quality').addEventListener('click', () => {
    benchmark.cancel('เปลี่ยนคุณภาพภาพ');
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
    if (key === 'm' && !farmActive) toggleMap();
    if (key === 'escape') {
      if (expanded) toggleMap(false);
      else setPaused(true);
    }
    if (key === 'p') setPaused(!manualPause);
    if (key === 'f') attack();
    if (key === 'e') castSkill();
    if (key === 'v' && !farmActive) setMode(mode === 'walk' ? 'overview' : 'walk');
  });
  document.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
  window.addEventListener('blur', () => {
    if (battleStarted) setPaused(true);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (battleStarted) setPaused(true);
    }
  });
  const look = (dx: number, dy: number) => {
    if (farmActive) return;
    yaw -= dx * 0.0027;
    pitch = Math.max(-1.24, Math.min(1.24, pitch - dy * 0.0027));
  };
  let drag: { x: number; y: number; moved: boolean; id: number } | undefined;
  renderer.domElement.addEventListener('pointerdown', (e) => {
    if (
      paused() ||
      combat.player.hp <= 0 ||
      (e.pointerType === 'touch' && e.clientX < innerWidth * 0.35)
    )
      return;
    if (e.button === 2) {
      mouseBlocking = true;
      return;
    }
    if (document.pointerLockElement === renderer.domElement) {
      attack();
      return;
    }
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
    if (e.button === 2) mouseBlocking = false;
    if (drag && !drag.moved && e.pointerType === 'mouse' && !paused()) {
      attack();
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
    mouseBlocking = false;
  });
  renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('pointerup', (e) => {
    if (e.button === 2) mouseBlocking = false;
  });
  document.addEventListener('mousemove', (e) => {
    if (mode === 'walk' && document.pointerLockElement === renderer.domElement)
      look(e.movementX, e.movementY);
  });
  let hadPointerLock = false;
  document.addEventListener('pointerlockchange', () => {
    const locked = document.pointerLockElement === renderer.domElement;
    if (hadPointerLock && !locked && battleStarted) setPaused(true);
    hadPointerLock = locked;
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
  const clockPosition = new THREE.Vector3();
  function updateHud(now: number): void {
    if (now - lastUi < 120) return;
    lastUi = now;
    const p: Point = mode === 'walk' ? position : [controls.target.x, controls.target.z];
    const viewYaw =
      mode === 'walk'
        ? yaw
        : Math.atan2(camera.position.x - controls.target.x, camera.position.z - controls.target.z);
    const degrees = ((((-viewYaw * 180) / Math.PI) % 360) + 360) % 360;
    element('heading').textContent = `${Math.round(degrees)}°`;
    map.draw(p, viewYaw);
    if (farmActive) {
      const live = summarizeFrames(liveSamples);
      element('farm-population').textContent =
        `${crowd.bots.length} นักดาบ / 30 สไลม์ (${crowd.world.slimes.filter((s) => s.hp > 0).length} มีชีวิต)`;
      element('farm-live').textContent = live
        ? `${live.fps.toFixed(1)} FPS · p95 ${live.p95FrameMs.toFixed(1)} ms`
        : 'กำลังเก็บเฟรม…';
      element('farm-metrics').textContent = live
        ? `CPU จำลอง ${live.simulationMs.toFixed(2)} · ภาพ ${live.viewMs.toFixed(2)} · ส่งเรนเดอร์ ${live.renderSubmitMs.toFixed(2)} ms\nDraw calls ${Math.round(live.drawcalls)} · ${(live.triangles / 1e6).toFixed(2)}M triangles`
        : '';
      element('farm-activity').textContent =
        `ฟัน ${crowd.totals.swings} · สกิล ${crowd.totals.casts} · สังหาร ${crowd.totals.kills} · ตาย ${crowd.totals.deaths}`;
      element('benchmark-status').textContent = benchmark.status;
      element('benchmark-results').innerHTML = benchmark.results
        .map(
          (r) =>
            `<div>${r.bots} คน · รอบ ${r.round}<strong>${r.stats.fps.toFixed(1)} FPS</strong><span>p95 ${r.stats.p95FrameMs.toFixed(1)} ms</span></div>`,
        )
        .join('');
      element('export-benchmark').hidden = benchmark.results.length === 0;
      element<HTMLButtonElement>('farm-one').disabled = benchmark.active;
      element<HTMLButtonElement>('farm-ten').disabled = benchmark.active;
      element<HTMLButtonElement>('farm-benchmark').disabled = benchmark.active;
    }
    const player = combat.player;
    element('player-level').textContent = `นักดาบ Lv.${player.level}`;
    element('hp-text').textContent = `${player.hp} / ${player.maxHp}`;
    element('hp-bar').style.width = `${(player.hp / player.maxHp) * 100}%`;
    element('stamina-bar').style.width = `${player.stamina}%`;
    element('spirit-bar').style.width = `${player.spirit}%`;
    element('spirit-text').textContent = `${Math.floor(player.spirit)} / 100`;
    const charging = combat.chargingAt !== null;
    const skillCooldown = Math.max(0, SPIRIT_WAVE.cooldown - combat.time + combat.lastSkillAt);
    element('skill-state').textContent = charging
      ? 'กำลังรวมพลัง…'
      : skillCooldown > 0
        ? `รอ ${skillCooldown.toFixed(1)} วินาที`
        : player.spirit < SPIRIT_WAVE.cost
          ? 'พลังไม่พอ'
          : 'พร้อมใช้ · 35 พลัง';
    element('spirit-skill').classList.toggle('charging', charging);
    element('spirit-skill').classList.toggle('cooldown', !charging && skillCooldown > 0);
    element('skill-charge').hidden = !charging || mode !== 'walk' || expanded;
    element('charge-bar').style.width = charging
      ? `${((combat.time - combat.chargingAt!) / SPIRIT_WAVE.charge) * 100}%`
      : '0%';
    element('xp-bar').style.width = `${(player.xp / (player.level * 60)) * 100}%`;
    element('xp-text').textContent = `${player.xp} / ${player.level * 60} XP`;
    element('kill-count').textContent = `${Math.min(3, combat.kills)} / 3`;
    element('quest-note').textContent =
      combat.kills >= 3 ? 'สำเร็จ! ฝึกต่อเพื่อเพิ่มเลเวลได้' : 'เข้าใกล้ · เล็ง · ฟันดาบ';
    element('reticle').classList.toggle('in-range', !!combat.target(pose(), blocked));
    element('block').setAttribute('aria-pressed', String(pose().blocking));
    element('attack').classList.toggle('cooldown', combat.time - combat.lastSwingAt < 0.6);
    element('death-panel').hidden = player.hp > 0;
    // Read-only diagnostics for tests and profiling; no mutation/debug commands are exposed.
    document.documentElement.dataset.mode = mode;
    document.documentElement.dataset.position = `${position[0].toFixed(3)},${position[1].toFixed(3)}`;
    document.documentElement.dataset.walked = walked.toFixed(2);
    document.documentElement.dataset.hp = String(player.hp);
    document.documentElement.dataset.kills = String(combat.kills);
    document.documentElement.dataset.paused = String(paused());
    document.documentElement.dataset.spirit = player.spirit.toFixed(1);
    document.documentElement.dataset.charging = String(charging);
    document.documentElement.dataset.waves = JSON.stringify(
      combat.waves.map(({ id, position, travelled }) => ({ id, position, travelled })),
    );
    document.documentElement.dataset.slimes = JSON.stringify(
      combat.slimes.map(({ id, hp, mode, position }) => ({ id, hp, mode, position })),
    );
    document.documentElement.dataset.fps = String(fps);
    document.documentElement.dataset.farmActive = String(farmActive);
    document.documentElement.dataset.farmBots = String(crowd.bots.length);
    document.documentElement.dataset.farmActivity = JSON.stringify(crowd.totals);
    document.documentElement.dataset.benchmark = JSON.stringify(report());
    document.documentElement.dataset.benchmarkActive = String(benchmark.active);
    document.documentElement.dataset.drawcalls = String(renderer.info.render.calls);
    document.documentElement.dataset.triangles = String(renderer.info.render.triangles);
    document.documentElement.dataset.depthBuffer = renderer.capabilities.logarithmicDepthBuffer
      ? 'logarithmic'
      : 'standard';
  }
  function frame(now: number): void {
    const frameMs = now - lastFrame;
    const dt = Math.min(frameMs / 1000, 0.1);
    lastFrame = now;
    frames++;
    if (now - lastFpsTime > 1000) {
      fps = Math.round((frames * 1000) / (now - lastFpsTime));
      frames = 0;
      lastFpsTime = now;
    }
    const isPaused = paused() || combat.player.hp <= 0;
    let moving = false;
    if (mode === 'walk') {
      if (!isPaused && !farmActive) {
        let forward =
          Number(keys.has('w') || keys.has('arrowup')) -
          Number(keys.has('s') || keys.has('arrowdown')) -
          touches.y;
        let strafe =
          Number(keys.has('d') || keys.has('arrowright')) -
          Number(keys.has('a') || keys.has('arrowleft')) +
          touches.x;
        const length = Math.hypot(forward, strafe);
        moving = length > 0;
        if (length > 1) {
          forward /= length;
          strafe /= length;
        }
        const speed = combat.chargingAt !== null ? 1.2 : keys.has('shift') || running ? 8.4 : 3.2;
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
      camera.position.set(position[0], farmActive ? 18 : 1.78 + clockPosition.y, position[1]);
      camera.rotation.order = 'YXZ';
      camera.rotation.set(pitch, yaw, 0);
      sun.position.set(position[0] - 650, golden ? 460 : 950, position[1] + 400);
      sun.target.position.set(position[0], 0, position[1]);
    } else controls.update();
    const simulationStart = performance.now();
    if (!isPaused) {
      if (farmActive) crowd.step(dt, blocked);
      else combat.step(dt, pose(), blocked);
    }
    const simulationMs = performance.now() - simulationStart;
    const events = combat.drainEvents();
    combatView.handle(events, now / 1000);
    for (const event of events) {
      if (event.kind === 'level')
        notify(`เลเวล ${combat.player.level}! ดาบแรงขึ้นและพลังชีวิตเพิ่ม`);
      if (event.kind === 'kill' && combat.kills === 3)
        notify('ปราบสไลม์ครบ 3 ตัวแล้ว! ฝึกต่อเพื่อเพิ่มเลเวลได้');
    }
    if (combat.player.hp <= 0 && document.pointerLockElement) document.exitPointerLock();
    camera.updateMatrixWorld();
    const viewStart = performance.now();
    combatView.update(dt, now / 1000, pose(), !farmActive && mode === 'walk' && !expanded, moving);
    combatView.enemies.visible = !farmActive;
    if (farmActive) crowdView.update();
    const viewMs = performance.now() - viewStart;
    for (const child of world.group.children) {
      if (child.userData.detail && child instanceof THREE.InstancedMesh && child.boundingSphere) {
        const center = child.boundingSphere.center;
        child.visible =
          mode === 'walk' &&
          Math.hypot(center.x - position[0], center.z - position[1]) <
            (highQuality ? 340 : 170) + child.boundingSphere.radius;
      }
    }
    const renderStart = performance.now();
    renderer.render(scene, camera);
    if (farmActive && !isPaused) {
      const sample: FrameSample = {
        frameMs,
        simulationMs,
        viewMs,
        renderMs: performance.now() - renderStart,
        drawcalls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
        geometries: renderer.info.memory.geometries,
        textures: renderer.info.memory.textures,
      };
      liveSamples.push(sample);
      if (liveSamples.length > 120) liveSamples.shift();
      benchmark.record(sample, crowd.totals);
    }
    updateHud(now);
  }
  window.addEventListener('resize', () => {
    benchmark.cancel('ขนาดหน้าจอเปลี่ยน');
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
  setMode('walk');
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

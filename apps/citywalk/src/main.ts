import * as THREE from 'three';
import { Collider } from './collide';
import { Input } from './input';
import { Minimap } from './minimap';
import { TH } from './th';
import type { Landmark, WorldData } from './types';
import { loadModel, placeModel, type PlacedModel } from './gateModel';
import { buildWorld, gateTowers } from './world';
import './style.css';

type Mode = 'walk' | 'run' | 'bike';
/** screen speed in metres per second, whatever the city scale */
const SPEED: Record<Mode, number> = { walk: 4, run: 8, bike: 16 };
const SCALES = [1, 0.5, 1 / 3];
const RADIUS = 0.4;
const SKY = 0xbfd8ea;
const HAZE = 0xb9b2a4;
const DEBUG = new URLSearchParams(location.search).has('debug');

const $ = <T extends HTMLElement>(sel: string) => document.querySelector(sel) as T;

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls: string,
  text = '',
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = cls;
  e.textContent = text;
  return e;
}

function makeWalker(): { body: THREE.Group; bike: THREE.Group } {
  const body = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color: 0xe0773a });
  const skin = new THREE.MeshLambertMaterial({ color: 0xe9c09a });
  const dark = new THREE.MeshLambertMaterial({ color: 0x2b2f36 });
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.33, 0.7, 4, 10), shirt);
  torso.position.y = torso.userData.y = 0.95;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 12), skin);
  head.position.y = head.userData.y = 1.62;
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.06, 0.22), dark);
  cap.position.set(0, 1.79, -0.12); // the brim shows which way the walker faces
  cap.userData.y = 1.79;
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.55, 20),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22 }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;
  body.add(torso, head, cap, shadow);

  const bike = new THREE.Group();
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.45, 1.7), dark);
  frame.position.y = 0.55;
  const wheelGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.14, 16);
  for (const z of [-0.7, 0.7]) {
    const w = new THREE.Mesh(wheelGeo, dark);
    w.rotation.z = Math.PI / 2;
    w.position.set(0, 0.32, z);
    bike.add(w);
  }
  bike.add(frame);
  bike.visible = false;
  body.add(bike);
  return { body, bike };
}

function moatLapMetres(marks: Landmark[]): number {
  const corners = marks.filter((m) => m.kind === 'corner');
  if (corners.length < 3) return 6400;
  corners.sort((a, b) => Math.atan2(a.z, a.x) - Math.atan2(b.z, b.x));
  let d = 0;
  corners.forEach((c, i) => {
    const n = corners[(i + 1) % corners.length]!;
    d += Math.hypot(n.x - c.x, n.z - c.z);
  });
  return d;
}

async function start(): Promise<void> {
  const loading = $('#loading');
  // the gate model is optional: without it the gate keeps its simple stand-in towers
  const model = loadModel('./models/thaphae_gate.glb').catch((err) => {
    console.error(err);
    return null;
  });
  let world: WorldData;
  try {
    const res = await fetch('./world.json');
    if (!res.ok) throw new Error(String(res.status));
    world = (await res.json()) as WorldData;
  } catch {
    loading.textContent = TH.loadFailed;
    return;
  }

  const gateModel = await model;
  const thaPhaeGate = world.landmarks.find((m) => m.name === 'ประตูท่าแพ');
  let placed: PlacedModel | null = null;
  if (gateModel && thaPhaeGate) placed = placeModel(gateModel, thaPhaeGate, world.forts);
  if (placed) world = { ...world, forts: placed.forts };
  const modelled = new Set(placed && thaPhaeGate ? [thaPhaeGate.name] : []);

  const towers = world.landmarks
    .filter((m) => m.kind === 'gate' && !modelled.has(m.name))
    .flatMap((m) => gateTowers(m.x, m.z));
  const collider = new Collider(world, [...towers, ...(placed?.solids ?? [])]);
  const lap = moatLapMetres(world.landmarks);

  const renderer = new THREE.WebGLRenderer({ antialias: window.devicePixelRatio < 2 });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.setSize(window.innerWidth, window.innerHeight);
  const canvas = renderer.domElement;
  canvas.id = 'view';
  document.body.prepend(canvas);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(SKY);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xb3a68c, 2.6));
  const sun = new THREE.DirectionalLight(0xfff1dc, 1.6);
  sun.position.set(-250, 500, 300);
  scene.add(sun);

  const city = buildWorld(world, modelled);
  if (placed) city.add(placed.object);
  scene.add(city);
  const { body: walker, bike } = makeWalker();
  scene.add(walker);

  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.3, 2500);

  // start on the square in front of Tha Phae Gate, facing the gate
  const state = {
    x: (thaPhaeGate?.x ?? 0) + 45,
    z: thaPhaeGate?.z ?? 0,
    yaw: Math.PI / 2,
    pitch: 0.24,
    heading: Math.PI / 2,
    mode: 'walk' as Mode,
    scale: 1,
    labels: true,
    haze: false,
  };

  // HUD
  const hud = $('#hud');
  const near = el('div', 'near');
  const chips = el('div', 'chips');
  const modes = el('div', 'modes');
  const toast = el('div', 'toast');
  const credit = el('a', 'credit', TH.credit);
  credit.href = 'https://www.openstreetmap.org/copyright';
  credit.target = '_blank';
  credit.rel = 'noopener';
  const top = el('div', 'top');
  top.append(el('div', 'title', TH.title), near, chips);
  hud.append(top, modes, toast, credit);

  let toastTimer = 0;
  const say = (text: string) => {
    toast.textContent = text;
    toast.classList.add('show');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove('show'), 2600);
  };
  const lapText = () =>
    TH.lap(Math.max(1, Math.round((lap * state.scale) / SPEED[state.mode] / 60)));

  const modeButtons = (Object.keys(SPEED) as Mode[]).map((m) => {
    const b = el('button', 'mode', TH.modes[m]);
    b.type = 'button';
    b.dataset.mode = m;
    b.addEventListener('click', () => setMode(m));
    modes.append(b);
    return b;
  });
  const setMode = (m: Mode) => {
    state.mode = m;
    bike.visible = m === 'bike';
    for (const b of modeButtons) b.setAttribute('aria-pressed', String(b.dataset.mode === m));
    say(lapText());
  };

  const chip = (label: string, value: () => string, onClick: () => void) => {
    const b = el('button', 'chip');
    b.type = 'button';
    const paint = () => (b.innerHTML = `<span>${label}</span> <b>${value()}</b>`);
    b.addEventListener('click', () => {
      onClick();
      paint();
    });
    paint();
    chips.append(b);
    return b;
  };
  chip(
    TH.scale,
    () => `1:${Math.round(1 / state.scale)}`,
    () => {
      state.scale = SCALES[(SCALES.indexOf(state.scale) + 1) % SCALES.length]!;
      city.scale.setScalar(state.scale);
      say(lapText());
    },
  ).dataset.chip = 'scale';
  chip(
    TH.labels,
    () => (state.labels ? TH.on : TH.off),
    () => (state.labels = !state.labels),
  ).dataset.chip = 'labels';
  chip(
    TH.haze,
    () => (state.haze ? TH.on : TH.off),
    () => {
      state.haze = !state.haze;
      applySky();
    },
  ).dataset.chip = 'haze';

  const applySky = () => {
    const c = state.haze ? HAZE : SKY;
    (scene.background as THREE.Color).setHex(c);
    scene.fog = state.haze ? new THREE.Fog(c, 15, 190) : new THREE.Fog(c, 450, 1600);
  };
  applySky();

  // landmark name tags that float over the gates and corners
  const tags = world.landmarks.map((m) => {
    const t = el('div', 'tag', m.name);
    hud.append(t);
    return { m, t };
  });

  const minimap = new Minimap(world);
  hud.append(minimap.canvas);

  const input = new Input(canvas, TH.stickHint);
  const visited = new Set<string>();

  const step = (dt: number, forward: number, right: number) => {
    const fx = -Math.sin(state.yaw),
      fz = -Math.cos(state.yaw);
    const rx = Math.cos(state.yaw),
      rz = -Math.sin(state.yaw);
    const dx = fx * forward + rx * right,
      dz = fz * forward + rz * right;
    if (dx === 0 && dz === 0) return;
    const dist = (SPEED[state.mode] * dt) / state.scale; // map metres
    [state.x, state.z] = collider.move(state.x, state.z, dx * dist, dz * dist, RADIUS);
    state.heading = Math.atan2(-dx, -dz);
  };

  let phase = 0;
  const bob = (dt: number, moving: boolean) => {
    phase = moving ? phase + dt * (state.mode === 'walk' ? 9 : 14) : 0;
    const body = walker.children;
    const lift = moving && state.mode !== 'bike' ? Math.abs(Math.sin(phase)) * 0.12 : 0;
    for (const c of body.slice(0, 3)) c.position.y = (c.userData.y as number) + lift;
  };

  const target = new THREE.Vector3();
  const place = () => {
    const s = state.scale;
    walker.position.set(state.x * s, 0.3, state.z * s);
    // turn the walker smoothly towards where it is going
    let d = state.heading - walker.rotation.y;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    walker.rotation.y += d * 0.25;

    target.set(walker.position.x, 2.1, walker.position.z);
    let dist = state.mode === 'bike' ? 10 : 7.5;
    // pull the camera in when a building stands between it and the walker
    const bx = Math.sin(state.yaw) * Math.cos(state.pitch),
      bz = Math.cos(state.yaw) * Math.cos(state.pitch);
    for (let t = 0.8; t <= dist; t += 0.4) {
      if (collider.solid((target.x + bx * t) / s, (target.z + bz * t) / s)) {
        dist = Math.max(1.2, t - 0.5);
        break;
      }
    }
    camera.position.set(
      target.x + bx * dist,
      target.y + Math.sin(state.pitch) * dist,
      target.z + bz * dist,
    );
    camera.lookAt(target);
  };

  const v = new THREE.Vector3();
  const updateHud = () => {
    // name tags stay below the buttons and the minimap at the top of the screen
    const hudBottom =
      Math.max(top.getBoundingClientRect().bottom, minimap.canvas.getBoundingClientRect().bottom) +
      30;
    let best: Landmark | null = null;
    let bestD = Infinity;
    for (const { m, t } of tags) {
      const d = Math.hypot(m.x - state.x, m.z - state.z);
      if (d < bestD) {
        bestD = d;
        best = m;
      }
      v.set(m.x * state.scale, 7 * Math.max(state.scale, 0.5), m.z * state.scale).project(camera);
      const sy = ((1 - v.y) / 2) * window.innerHeight;
      const show = state.labels && v.z < 1 && d * state.scale < 450 && sy > hudBottom;
      t.hidden = !show;
      if (show)
        t.style.transform = `translate(-50%, -100%) translate(${((v.x + 1) / 2) * window.innerWidth}px, ${sy}px)`;
      if (d < 25 && !visited.has(m.name)) {
        visited.add(m.name);
        if (state.labels) say(TH.arrived(m.name));
      } else if (d > 70) visited.delete(m.name);
    }
    near.hidden = !state.labels || !best;
    if (best) near.textContent = TH.near(best.name, Math.round(bestD / 10) * 10);
    minimap.draw(state.x, state.z, state.heading, state.labels);
  };

  let last = performance.now();
  let lastTick = last;
  const tick = () => {
    // use our own clock: some in-app browsers hand requestAnimationFrame a different time base
    const now = performance.now();
    const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
    last = now;
    lastTick = now;
    try {
      for (const [code, m] of [
        ['Digit1', 'walk'],
        ['Digit2', 'run'],
        ['Digit3', 'bike'],
      ] as const)
        if (input.pressed(code)) setMode(m);
      const [tx, ty] = input.takeTurn();
      state.yaw -= tx * 0.006;
      state.pitch = Math.min(1.25, Math.max(0.12, state.pitch + ty * 0.004));
      const { forward, right } = input.read();
      step(dt, forward, right);
      bob(dt, forward !== 0 || right !== 0);
      place();
      renderer.render(scene, camera);
      updateHud();
    } catch (err) {
      // one bad frame should not freeze the game
      console.error(err);
    }
  };
  const frame = () => {
    tick();
    requestAnimationFrame(frame);
  };
  // if the browser stops sending animation frames (some app views do), keep the game ticking
  window.setInterval(() => {
    if (performance.now() - lastTick > 120) tick();
  }, 33);

  window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  });

  setMode('walk');
  toast.classList.remove('show');
  walker.rotation.y = state.heading;
  loading.hidden = true;
  const intro = $('#intro');
  intro.hidden = false;
  $('#intro-go').addEventListener('click', () => {
    intro.hidden = true;
    say(lapText());
  });
  requestAnimationFrame(frame);

  if (DEBUG) {
    (window as unknown as { __walk: unknown }).__walk = {
      state: () => ({ ...state }),
      teleport: (x: number, z: number) => {
        state.x = x;
        state.z = z;
      },
      setYaw: (y: number) => (state.yaw = y),
      /** walk with a fixed input for a number of seconds, in 1/30 s steps */
      simulate: (forward: number, right: number, seconds: number) => {
        for (let t = 0; t < seconds; t += 1 / 30) step(1 / 30, forward, right);
      },
      blocked: (x: number, z: number) => collider.blocked(x, z, RADIUS),
      gateModel: placed
        ? {
            scale: placed.scale,
            solids: placed.solids.length,
            meshes: placed.object.children[0]!.children.length,
            opening: placed.object.children[0]!.userData.opening as number,
            forts: world.forts.length,
          }
        : null,
      drawCalls: () => renderer.info.render.calls,
      landmarks: world.landmarks,
    };
  }
}

function setupText(): void {
  document.title = TH.title;
  $('#loading').textContent = TH.loading;
  $('#intro-title').textContent = TH.title;
  $('#intro-text').textContent = TH.intro;
  $('#intro-desktop').textContent = TH.howDesktop;
  $('#intro-touch').textContent = TH.howTouch;
  $('#intro-go').textContent = TH.start;
}

setupText();
void start();

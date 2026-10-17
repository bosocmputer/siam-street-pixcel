import * as THREE from 'three';
import { Collider } from './collide';
import { Input } from './input';
import { Minimap } from './minimap';
import { TH } from './th';
import type { Landmark, WorldData } from './types';
import { frameToMap, gateFrame, loadModel, placeModel, type PlacedModel } from './gateModel';
import { buildPlaza } from './plaza';
import { SlimeHerd, loadSlime } from './slime';
import { pointInPolygon } from './geo';
import { buildWorld, gateTowers } from './world';
import { Combat } from './combat';
import { Fx } from './fx';
import { SKILLS, type Element, type Vec3 } from './skills';
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
  const slimeModel = loadSlime('./models/slime_aquanaut.glb').catch((err) => {
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
  const gateAt = thaPhaeGate ? gateFrame(thaPhaeGate, world.forts) : null;
  if (gateModel && gateAt) placed = placeModel(gateModel, gateAt, world.forts);
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
  // the paved square in front of Tha Phae Gate, shaped from the map (no model needed)
  const plaza = gateAt ? buildPlaza(world, gateAt) : null;
  if (plaza) city.add(plaza.object);

  // slimes wander on the square; they stay on it and bump into walls like the walker does
  const slimeTemplate = await slimeModel;
  let herd: SlimeHerd | null = null;
  if (slimeTemplate && plaza && gateAt) {
    const homes = (
      [
        [-2, 10],
        [2.5, 7],
        [-30, 24],
        [-60, 16],
        [30, 15],
        [55, 10],
      ] as const
    ).map(([fx, fz]) => frameToMap(gateAt, fx, fz));
    herd = new SlimeHerd(slimeTemplate, homes, {
      wander: 8,
      move: (x, z, dx, dz) => collider.move(x, z, dx, dz, 0.45),
      allowed: (x, z) => pointInPolygon(x, z, plaza.outline),
    });
    city.add(herd.object);
  }
  // skill effects and shots live in the city too, so they shrink with it
  const fx = new Fx();
  city.add(fx.object);
  const combat = herd ? new Combat(fx, herd, collider, city) : null;
  scene.add(city);
  const { body: walker, bike } = makeWalker();
  scene.add(walker);

  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.3, 2500);

  // start on the square in front of Tha Phae Gate, 20 m out, facing the gate
  const [startX, startZ] = gateAt
    ? frameToMap(gateAt, 0, 20)
    : [(thaPhaeGate?.x ?? 0) + 20, thaPhaeGate?.z ?? 0];
  const startYaw = gateAt ? Math.atan2(gateAt.ox, gateAt.oz) : Math.PI / 2;
  const state = {
    x: startX,
    z: startZ,
    yaw: startYaw,
    pitch: 0.24,
    heading: startYaw,
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

  // skill buttons (a test layout, to try the effects) and the target's health bar
  const skills = el('div', 'skills');
  const skillButtons = new Map<Element, HTMLButtonElement>();
  if (combat) {
    for (const e of ['fire', 'water'] as const) {
      const b = el('button', `skill skill-${e}`);
      b.type = 'button';
      b.dataset.skill = e;
      b.append(el('span', 'skill-orb'), el('span', 'skill-name', TH.skills[e]));
      b.addEventListener('click', () => {
        castSkill(e);
        b.blur(); // keep the keyboard for walking
      });
      skills.append(b);
      skillButtons.set(e, b);
    }
    hud.append(skills);
  }
  const hpBar = el('div', 'hpbar');
  const hpFill = el('div', 'hpfill');
  hpBar.append(hpFill);
  hpBar.hidden = true;
  hud.append(hpBar);
  const numbers: { e: HTMLElement; at: Vec3; t: number }[] = [];

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
  if (plaza) minimap.addArea(plaza.outline, '#d8b48c');
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
      v.set(m.x * state.scale, 5.5 * Math.max(state.scale, 0.5), m.z * state.scale).project(camera);
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
    minimap.draw(state.x, state.z, state.heading, state.labels, herd?.dots());
  };

  /** the camera's forward direction as a heading (0 = +z), which is where "in front" is */
  const lookHeading = () => Math.atan2(-Math.sin(state.yaw), -Math.cos(state.yaw));
  /** which way to throw (map x, z, length 1): at the target if there is one, else ahead */
  const throwDir = (): [number, number] => {
    const aim = combat?.facing();
    if (aim) {
      const d = Math.hypot(aim[0] - state.x, aim[2] - state.z) || 1;
      return [(aim[0] - state.x) / d, (aim[2] - state.z) / d];
    }
    const h = lookHeading();
    return [Math.sin(h), Math.cos(h)];
  };
  /** the walker's right hand, held out a little to the side so the camera behind can see it */
  const hand = (): Vec3 => {
    const s = state.scale;
    const fx = -Math.sin(walker.rotation.y),
      fz = -Math.cos(walker.rotation.y);
    return [
      (walker.position.x + fx * 0.35 - fz * 0.5) / s,
      1.45 / s,
      (walker.position.z + fz * 0.35 + fx * 0.5) / s,
    ];
  };
  const castSkill = (e: Element) => {
    if (!combat || combat.gathering || combat.cooldowns[e] > 0) return;
    const me = { x: state.x, z: state.z, heading: lookHeading() };
    combat.ensureTarget(me);
    // turn to the target (or keep looking ahead) and gather the ball in the right hand
    const [fx, fz] = throwDir();
    state.heading = Math.atan2(-fx, -fz);
    walker.rotation.y = state.heading;
    combat.cast(e, hand, { ...me, heading: Math.atan2(fx, fz) });
  };

  /** pick the slime nearest to a tap on the screen, if one is close enough */
  const tapSlime = (sx: number, sy: number) => {
    if (!herd || !combat) return;
    let best: number | null = null;
    let bestD = Math.max(48, Math.min(window.innerWidth, window.innerHeight) * 0.12);
    for (let i = 0; i < herd.count; i++) {
      const p = screenOf(herd.aimPoint(i));
      if (!p) continue;
      const d = Math.hypot(p[0] - sx, p[1] - sy);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    if (best !== null) combat.target = best;
  };
  const screenOf = (p: Vec3 | null): [number, number] | null => {
    if (!p) return null;
    v.set(p[0] * state.scale, p[1] * state.scale, p[2] * state.scale).project(camera);
    if (v.z > 1) return null;
    return [((v.x + 1) / 2) * window.innerWidth, ((1 - v.y) / 2) * window.innerHeight];
  };

  // a hit stops time for a blink and shakes the camera, so it feels heavy
  let freeze = 0;
  let shake = 0;
  let paused = false;
  const fight = (dt: number) => {
    herd?.update(dt, state);
    for (const n of numbers) n.t += dt;
    for (const h of combat?.update(dt) ?? []) {
      freeze = Math.max(freeze, h.element === 'fire' ? 0.08 : 0.04);
      shake = Math.max(shake, h.element === 'fire' ? 0.22 : 0.09);
      // numbers pop out above the slime, a little to one side so they do not stack up
      const top = (herd?.height ?? 0.9) + 0.35;
      const side = (Math.random() - 0.5) * 0.8;
      const n = el('div', `dmg dmg-${h.element}`, String(h.damage));
      hud.append(n);
      numbers.push({ e: n, at: [h.at[0] + side, top, h.at[2]], t: 0 });
      if (h.defeated) {
        const m = el('div', 'dmg dmg-melt', TH.melted);
        hud.append(m);
        numbers.push({ e: m, at: [h.at[0], top + 0.5, h.at[2]], t: -0.15 });
      }
    }
    fx.update(dt, camera, canvas.height, state.scale);
  };

  const updateCombatHud = () => {
    if (!combat || !herd) return;
    for (const [e, b] of skillButtons) {
      const left = combat.cooldowns[e] / SKILLS[e].cooldown;
      b.style.setProperty('--cd', left.toFixed(3));
      b.dataset.ready = String(left === 0);
    }
    const t = combat.target;
    const top = t !== null ? herd.aimPoint(t) : null;
    const at = top ? screenOf([top[0], herd.height + 1.35, top[2]]) : null;
    hpBar.hidden = !at;
    if (at && t !== null) {
      hpBar.style.transform = `translate(-50%, -100%) translate(${at[0]}px, ${at[1]}px)`;
      hpFill.style.width = `${herd.hp(t)}%`;
    }
    for (let i = numbers.length - 1; i >= 0; i--) {
      const n = numbers[i]!;
      const k = Math.max(0, n.t) / 0.9;
      const p = screenOf([n.at[0], n.at[1] + k * 1.2, n.at[2]]);
      if (k >= 1 || !p) {
        n.e.remove();
        numbers.splice(i, 1);
        continue;
      }
      n.e.style.opacity = n.t < 0 ? '0' : String(Math.min(1, (1 - k) * 2.5));
      n.e.style.transform = `translate(-50%, -50%) translate(${p[0]}px, ${p[1]}px) scale(${1 + Math.max(0, 0.25 - k) * 2})`;
    }
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
      if (input.pressed('KeyQ')) castSkill('fire');
      if (input.pressed('KeyE')) castSkill('water');
      if (input.pressed('Tab'))
        combat?.cycleTarget({ x: state.x, z: state.z, heading: lookHeading() });
      for (const [sx, sy] of input.takeTaps()) tapSlime(sx, sy);
      const [tx, ty] = input.takeTurn();
      state.yaw -= tx * 0.006;
      state.pitch = Math.min(1.25, Math.max(0.12, state.pitch + ty * 0.004));
      const { forward, right } = input.read();
      step(dt, forward, right);
      bob(dt, forward !== 0 || right !== 0);
      if (combat?.gathering) {
        // keep facing the target while the ball is gathered
        const [fx, fz] = throwDir();
        state.heading = Math.atan2(-fx, -fz);
      }
      const worldDt = paused ? 0 : freeze > 0 ? dt * 0.08 : dt;
      freeze = Math.max(0, freeze - dt);
      fight(worldDt);
      place();
      if (shake > 0.002) {
        camera.position.x += (Math.random() - 0.5) * shake;
        camera.position.y += (Math.random() - 0.5) * shake;
        shake *= Math.exp(-dt * 12);
      }
      renderer.render(scene, camera);
      updateHud();
      updateCombatHud();
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
      slimes: () => herd?.state() ?? [],
      /** run the slimes for a number of seconds, in 1/30 s steps */
      simulateSlimes: (seconds: number) => {
        for (let t = 0; t < seconds; t += 1 / 30) herd?.update(1 / 30, state);
      },
      /** slimes, shots and effects together for a number of seconds, in 1/30 s steps */
      simulateFight: (seconds: number) => {
        for (let t = 0; t < seconds; t += 1 / 30) fight(1 / 30);
      },
      cast: (e: Element) => castSkill(e),
      combat: () =>
        combat
          ? { target: combat.target, cooldowns: { ...combat.cooldowns }, inFlight: combat.inFlight }
          : null,
      setTarget: (i: number | null) => combat && (combat.target = i),
      /** where slime i is on the screen, in CSS pixels */
      slimeOnScreen: (i: number) => screenOf(herd?.aimPoint(i) ?? null),
      /** stop the world (not the camera) so a screenshot catches a moment */
      pause: (p: boolean) => (paused = p),
      slimeTriangles: slimeTemplate?.triangles ?? 0,
      plaza: plaza ? { area: Math.round(plaza.area), span: plaza.span } : null,
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

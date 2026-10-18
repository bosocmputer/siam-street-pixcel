import * as THREE from 'three';
import {
  ATTR,
  CAMERA,
  CAMERA_MODES,
  DEFAULT_CAMERA,
  ITEMS,
  PLAYER,
  SAVE_VERSION,
  SOUNDS,
  SPAWNS,
  addItem,
  attrBonus,
  defaultLook,
  leaning,
  advance,
  advanceSteps,
  countOf,
  gainExp,
  hurt,
  lockYaw,
  maxEnergy,
  maxHp,
  monster,
  newClock,
  newCombo,
  newStepClock,
  newStats,
  nextCombo,
  nextScreen,
  rigFor,
  sideMetres,
  seeded,
  skill,
  sound as soundRecipe,
  spend,
  stepStats,
  worldRuns,
  type CameraMode,
  type Attrs,
  type Inventory,
  type Look,
  type MoveMode,
  type PlayerStats,
  type SaveData,
  type Screen,
  type ScreenEvent,
  type Vec3,
} from '@newgame/rpg-core';
import { loadAssets, missingClips } from './assets';
import { Sound } from './audio/engine';
import { openLab } from './audio/soundLab';
import { renderSound } from './audio/synth';
import { stats as soundStats } from './audio/analyze';
import { Collider } from './collide';
import { Combat } from './combat';
import { heroFromLook } from './lookModel';
import { Creator } from './ui/creator';
import { StatsPanel } from './ui/statsPanel';
import { Fx } from './fx';
import { frameToMap, gateFrame, loadModel, placeModel, type PlacedModel } from './gateModel';
import { pointInPolygon } from './geo';
import { Input } from './input';
import { loadItemModels } from './itemModels';
import { Minimap } from './minimap';
import { buildPlaza } from './plaza';
import { PickupField } from './pickups';
import { SlimeHerd, loadSlime, type SlimeTemplate } from './slime';
import { clearSave, readPrefs, readSave, writePrefs, writeSave } from './storage';
import { TH } from './th';
import type { Landmark, WorldData } from './types';
import { CombatHud } from './ui/combatHud';
import { $ } from './ui/dom';
import { Hud } from './ui/hud';
import { PlayerHud } from './ui/playerHud';
import { makeWalker, type Walker } from './walker';
import { loadHero, makeHero, type HeroTemplate } from './hero';
import { buildWorld, gateTowers } from './world';
import { artMode, breathe } from './sprites/art';
import { bakeHero } from './sprites/heroSprites';
import { bakeMonster } from './sprites/monsterSprites';
import { loadSheet, sheetFromBaked, type SpriteSheet } from './sprites/sheet';
import { makeSpriteHero } from './sprites/spriteHero';
import './style.css';

/** screen speed in metres per second, whatever the city scale */
const SPEED: Record<MoveMode, number> = { walk: 4, run: 8, bike: 16 };
const SCALES = [1, 0.5, 1 / 3];
const RADIUS = 0.4;
const SKY = 0xbfd8ea;
const HAZE = 0xb9b2a4;
/** the skills on the two buttons (Q and E), in order, from config/player.json */
const SLOTS = PLAYER.slots;
/** height of the paved square */
const GROUND = 0.04;
/** seconds between automatic saves while playing */
const AUTOSAVE = 5;
const DEBUG = new URLSearchParams(location.search).has('debug');

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
  // screens: loading → intro → play (⇄ paused while the page is hidden)
  let screen: Screen = 'loading';
  const loading = $('#loading');
  const intro = $('#intro');
  const go = (event: ScreenEvent) => {
    screen = nextScreen(screen, event);
    loading.hidden = screen !== 'loading' && screen !== 'failed';
    intro.hidden = screen !== 'intro';
  };

  let assets;
  try {
    assets = await loadAssets((done, total) => (loading.textContent = TH.loadingStep(done, total)));
  } catch (err) {
    console.error(err);
    go('loadFailed');
    loading.textContent = TH.loadFailed;
    return;
  }
  let world: WorldData = assets.world;
  const entry = (id: string) => assets.manifest.models.find((m) => m.id === id);
  const parse = async <T>(id: string, f: (b: ArrayBuffer) => Promise<T>): Promise<T | null> => {
    const bytes = assets.models.get(id);
    if (!bytes) return null;
    try {
      return await f(bytes);
    } catch (err) {
      console.error(`model ${id} could not be read:`, err);
      return null;
    }
  };
  // the gate model is optional: without it the gate keeps its simple stand-in towers
  // the player's body is built from the look chosen on the character screen; a model from
  // another program listed as "hero" in assets.json takes its place instead
  const [gateModel, slimeTemplate, bossTemplate, heroTemplate] = await Promise.all([
    parse('gate', loadModel),
    parse<SlimeTemplate>('slime', loadSlime),
    parse<SlimeTemplate>('tide_regent', loadSlime),
    parse<HeroTemplate>('hero', (b) => loadHero(b, entry('hero')!)),
  ]);
  for (const [id, t] of [
    ['slime', slimeTemplate],
    ['tide_regent', bossTemplate],
  ] as const) {
    const lacking = missingClips(entry(id), t?.clips ?? []);
    if (t && lacking.length) console.warn(`${id} model lacks clips:`, lacking);
  }
  // the boss model is drawn large; its size next to the plain slime sets its hit box and voice
  if (slimeTemplate && bossTemplate) bossTemplate.size = bossTemplate.height / slimeTemplate.height;
  const templates: Record<string, SlimeTemplate> = {};
  if (slimeTemplate) templates.slime = slimeTemplate;
  if (bossTemplate) templates.tide_regent = bossTemplate;

  // characters and monsters as pixel sprites: sheets listed in assets.json, the rest drawn from
  // their models here (once, while loading)
  const art = artMode();
  const sheets: Record<string, SpriteSheet> = {};
  if (art === 'pixel') {
    loading.textContent = TH.drawing;
    await breathe();
    for (const [id, url] of Object.entries(assets.manifest.sprites ?? {}))
      try {
        sheets[id] = await loadSheet(`./${url}`);
      } catch (err) {
        console.error(`sprite sheet ${id} skipped:`, err);
      }
    for (const id of new Set((SPAWNS.plaza ?? []).map((sp) => sp.species))) {
      const spec = monster(id);
      const t = templates[spec.model];
      if (sheets[id] || !t) continue;
      await breathe();
      try {
        sheets[id] = sheetFromBaked(bakeMonster(t, spec));
      } catch (err) {
        console.error(`${id} could not be drawn as a sprite:`, err);
      }
    }
  }

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
  let herd: SlimeHerd | null = null;
  if (slimeTemplate && plaza && gateAt) {
    const homes = SPAWNS.plaza!.map((sp) => {
      const [x, z] = frameToMap(gateAt, sp.at[0], sp.at[1]);
      return { spec: monster(sp.species), x, z };
    });
    herd = new SlimeHerd(
      templates,
      homes,
      {
        move: (x, z, dx, dz, r) => collider.move(x, z, dx, dz, r),
        allowed: (x, z) => pointInPolygon(x, z, plaza.outline),
      },
      1,
      sheets,
    );
    city.add(herd.object);
  }
  // skill effects and shots live in the city too, so they shrink with it
  const fx = new Fx();
  city.add(fx.object);
  // what monsters leave behind: shown as the item's model if there is one, else a glowing gem.
  // The dice use a seed (?seed=N in the address for repeatable runs, else the clock).
  const itemModels = await loadItemModels(assets.models);
  const seedParam = Number(new URLSearchParams(location.search).get('seed'));
  const pickups = new PickupField(itemModels, seeded(seedParam || Date.now() >>> 0));
  city.add(pickups.object);
  // what the player carries
  const bag: Inventory = {};
  // the player's health, energy and level
  const stats: PlayerStats = newStats();
  // sound: nothing plays until the first tap (phones insist); then it follows the player's settings
  const prefs = readPrefs();
  const sound = new Sound(prefs);
  const combat = herd
    ? new Combat(
        fx,
        herd,
        collider,
        city,
        () => stats.level,
        (id, o) => sound.play(id, o),
        (id) => sound.hold(id),
        () => attrBonus(stats.attrs).power,
      )
    : null;
  scene.add(city);
  const saved = readSave();
  // the character as made on the character screen (an older save without one gets the default)
  let look: Look = saved?.look ?? defaultLook('m');
  const bodyFor = (l: Look): Walker => {
    if (sheets.hero) return makeSpriteHero(sheets.hero);
    if (heroTemplate) return makeHero(heroTemplate);
    if (art === 'pixel')
      try {
        return makeSpriteHero(sheetFromBaked(bakeHero(l)));
      } catch (err) {
        console.error('the character could not be drawn as a sprite:', err);
      }
    try {
      return makeHero(heroFromLook(l));
    } catch (err) {
      console.error('the character could not be built:', err);
      return makeWalker();
    }
  };
  let walker = bodyFor(look);
  scene.add(walker.body);
  /** put on a new look: the body is rebuilt where the old one stood */
  const setLook = (l: Look) => {
    look = l;
    // a body from a file does not change with the look
    if (heroTemplate || sheets.hero) return;
    const next = bodyFor(l);
    next.body.position.copy(walker.body.position);
    next.body.rotation.copy(walker.body.rotation);
    next.bike.visible = walker.bike.visible;
    scene.remove(walker.body);
    walker = next;
    scene.add(walker.body);
  };

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
    pitch: CAMERA.pitch.start,
    heading: startYaw,
    mode: 'walk' as MoveMode,
    scale: 1,
    labels: true,
    haze: false,
    camera: DEFAULT_CAMERA as CameraMode,
  };

  const input = new Input(canvas, TH.stickHint);
  const lapText = () =>
    TH.lap(Math.max(1, Math.round((lap * state.scale) / SPEED[state.mode] / 60)));
  const applySky = () => {
    const c = state.haze ? HAZE : SKY;
    (scene.background as THREE.Color).setHex(c);
    scene.fog = state.haze ? new THREE.Fog(c, 15, 190) : new THREE.Fog(c, 450, 1600);
  };
  const applyScale = () => city.scale.setScalar(state.scale);

  const hud = new Hud($('#hud'), world.landmarks, (m) => input.trigger(m), [
    {
      id: 'scale',
      label: TH.scale,
      value: () => `1:${Math.round(1 / state.scale)}`,
      onClick: () => {
        state.scale = SCALES[(SCALES.indexOf(state.scale) + 1) % SCALES.length]!;
        applyScale();
        hud.say(lapText());
      },
    },
    {
      id: 'labels',
      label: TH.labels,
      value: () => (state.labels ? TH.on : TH.off),
      onClick: () => (state.labels = !state.labels),
    },
    {
      id: 'haze',
      label: TH.haze,
      value: () => (state.haze ? TH.on : TH.off),
      onClick: () => {
        state.haze = !state.haze;
        applySky();
      },
    },
    {
      id: 'sound',
      label: TH.sound,
      value: () => (sound.muted ? TH.off : TH.on),
      onClick: () => {
        sound.unlock();
        sound.setMuted(!sound.muted);
        writePrefs({ muted: sound.muted, volume: sound.volume });
      },
    },
    {
      id: 'camera',
      label: TH.camera,
      value: () => TH.cameraModes[state.camera] ?? state.camera,
      onClick: () => {
        state.camera =
          CAMERA_MODES[(CAMERA_MODES.indexOf(state.camera) + 1) % CAMERA_MODES.length]!;
      },
    },
  ]);
  hud.onTap = () => sound.play('ui.click');
  const combatHud = combat
    ? new CombatHud(hud.root, SLOTS, (i) => input.trigger(i === 0 ? 'skill1' : 'skill2'))
    : null;
  const playerHud = new PlayerHud(hud.top);
  // the status window: tap the player panel; the world waits while it is open
  const status = new StatsPanel(
    () => ({ name: look.name, level: stats.level, exp: stats.exp, attrs: stats.attrs }),
    (a: Attrs) => {
      stats.attrs = a;
      save();
    },
    () => sound.play('ui.click'),
  );
  document.body.append(status.root);
  status.onClose = () => go('close');
  playerHud.onOpen = () => {
    if (screen !== 'play') return;
    sound.play('ui.click');
    go('menu');
    status.open();
  };
  const minimap = new Minimap(world);
  if (plaza) minimap.addArea(plaza.outline, '#d8b48c');
  hud.root.append(minimap.canvas);

  const setMode = (m: MoveMode, announce = true) => {
    state.mode = m;
    walker.bike.visible = m === 'bike';
    hud.showMode(m);
    if (announce) hud.say(lapText());
  };

  // saving: where the walker is and the settings, on this device
  const snapshot = (): SaveData => ({
    version: SAVE_VERSION,
    savedAt: Date.now(),
    player: { x: state.x, z: state.z, heading: state.heading },
    settings: {
      mode: state.mode,
      scale: state.scale,
      labels: state.labels,
      haze: state.haze,
      camera: state.camera,
    },
    stats: { level: stats.level, exp: stats.exp, hp: stats.hp, energy: stats.energy },
    items: { ...bag },
    look,
    attrs: { ...stats.attrs },
  });
  const save = () =>
    screen === 'play' || screen === 'menu' || screen === 'paused' ? writeSave(snapshot()) : false;
  const restore = (d: SaveData) => {
    // a save inside something solid (the map changed since) puts the walker back at the start
    if (!collider.blocked(d.player.x, d.player.z, RADIUS)) {
      state.x = d.player.x;
      state.z = d.player.z;
      state.heading = d.player.heading;
      state.yaw = d.player.heading;
    }
    Object.assign(state, d.settings);
    // a save made while lying down comes back standing, with a little health
    stats.level = Math.min(d.stats.level, PLAYER.maxLevel);
    stats.attrs = { ...d.attrs };
    stats.exp = d.stats.exp;
    stats.hp = Math.min(maxHp(stats.level, undefined, stats.attrs), Math.max(1, d.stats.hp));
    stats.energy = Math.min(maxEnergy(stats.level, undefined, stats.attrs), d.stats.energy);
    for (const id of Object.keys(bag)) delete bag[id];
    Object.assign(bag, d.items);
    applyScale();
    applySky();
    hud.paintChips();
  };

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

  const target = new THREE.Vector3();
  // how far behind and to the side the camera is now; they ease towards the view's numbers so
  // switching views glides instead of jumping
  let camBack = CAMERA[state.camera].distance;
  let camSide = 0;
  const place = (dt: number) => {
    const s = state.scale;
    walker.body.position.set(state.x * s, walker.lift, state.z * s);
    // turn the walker smoothly towards where it is going
    let d = state.heading - walker.body.rotation.y;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    walker.body.rotation.y += d * 0.25;

    const rig = rigFor(state.camera, state.mode === 'bike');
    // to the player's right (the way "right" walks)
    const rx = Math.cos(state.yaw),
      rz = -Math.sin(state.yaw);
    // keep the camera out of a wall at the player's side
    let side = sideMetres(rig.side, camBack, camera.fov, camera.aspect);
    while (
      side > 0.05 &&
      collider.solid(
        (walker.body.position.x + rx * side) / s,
        (walker.body.position.z + rz * side) / s,
      )
    )
      side *= 0.6;
    if (side <= 0.05) side = 0;
    const glide = 1 - Math.exp(-dt * 9);
    camSide += (side - camSide) * glide;
    camBack += (rig.distance - camBack) * glide;

    target.set(
      walker.body.position.x + rx * camSide,
      CAMERA.targetHeight,
      walker.body.position.z + rz * camSide,
    );
    let dist = camBack;
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
  const screenOf = (p: Vec3 | null): [number, number] | null => {
    if (!p) return null;
    v.set(p[0] * state.scale, p[1] * state.scale, p[2] * state.scale).project(camera);
    if (v.z > 1) return null;
    return [((v.x + 1) / 2) * window.innerWidth, ((1 - v.y) / 2) * window.innerHeight];
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
  const handAt = new THREE.Vector3();
  const hand = (): Vec3 => {
    const s = state.scale;
    if (walker.hand) {
      const h = walker.hand(handAt);
      return [h.x / s, h.y / s, h.z / s];
    }
    const r = walker.body.rotation.y;
    const fx = -Math.sin(r),
      fz = -Math.cos(r);
    return [
      (walker.body.position.x + fx * 0.35 - fz * 0.5) / s,
      1.45 / s,
      (walker.body.position.z + fz * 0.35 + fx * 0.5) / s,
    ];
  };
  const castSkill = (id: string) => {
    if (!combat || stats.down > 0 || combat.gathering || (combat.cooldowns[id] ?? 0) > 0) return;
    if (!spend(stats, skill(id).cost)) {
      combatHud?.refuse(id);
      sound.play('ui.deny');
      hud.say(TH.noEnergy, true);
      return;
    }
    const me = { x: state.x, z: state.z, heading: lookHeading() };
    combat.ensureTarget(me);
    // turn to the target (or keep looking ahead) and gather the ball in the right hand
    const [fx, fz] = throwDir();
    state.heading = Math.atan2(-fx, -fz);
    walker.body.rotation.y = state.heading;
    combat.cast(id, hand, { ...me, heading: Math.atan2(fx, fz) });
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

  // a hit stops time for a blink and shakes the camera, so it feels heavy
  let freeze = 0;
  let shake = 0;
  /** debug: stop the world (not the walker or camera) so a screenshot catches a moment */
  let held = false;
  /** slimes and shots for one step of game time */
  const fight = (dt: number) => {
    const s = state.scale;
    const blows = herd?.update(dt, { x: state.x, z: state.z, down: stats.down > 0 }) ?? [];
    for (const b of blows) {
      const result = hurt(stats, b.damage);
      if (result === 'ignored') continue;
      walker.hurt?.();
      // knocked back a little, away from the slime
      const dx = state.x - b.from[0],
        dz = state.z - b.from[1];
      const d = Math.hypot(dx, dz) || 1;
      [state.x, state.z] = collider.move(state.x, state.z, (dx / d) * 0.6, (dz / d) * 0.6, RADIUS);
      fx.playerHit([state.x - (dx / d) * 0.3, 1.1 / s, state.z - (dz / d) * 0.3]);
      playerHud.hurt();
      shake = Math.max(shake, 0.18);
      sound.play(result === 'down' ? 'player.down' : 'player.hurt');
      if (result === 'down') {
        hud.say(TH.down, true);
        if (combat) combat.target = null;
      }
    }
    if (stepStats(stats, dt) === 'up') {
      // back on their feet at the rest point in front of the gate, nothing lost
      Object.assign(state, { x: startX, z: startZ, yaw: startYaw, heading: startYaw });
      walker.body.rotation.y = startYaw;
      sound.play('player.up');
      hud.say(TH.up, true);
    }
    combatHud?.age(dt);
    for (const h of combat?.update(dt) ?? []) {
      freeze = Math.max(freeze, h.element === 'fire' ? 0.08 : 0.04);
      shake = Math.max(shake, h.element === 'fire' ? 0.22 : 0.09);
      combatHud?.hit(h);
      // a hit on a weakness rings out; a hit on something that resists falls dull
      const where = { at: { x: h.at[0], z: h.at[2] } };
      if (h.takes > 1) sound.play('hit.weak', where);
      else if (h.takes < 1) sound.play('hit.resist', where);
      if (!h.defeated) continue;
      const kind = monster(h.species);
      // it melts and leaves its drops lying round the puddle
      const dropped = pickups.drop(kind.drops, { x: h.at[0], z: h.at[2] }, (x, z, dx, dz) =>
        collider.move(x, z, dx, dz, 0.2),
      );
      if (dropped.length > 0) sound.play('item.drop', { at: { x: h.at[0], z: h.at[2] } });
      if (gainExp(stats, kind.exp) > 0) {
        sound.play('player.levelup');
        // at a few levels the system hints which way the player is leaning
        const hint = ATTR.hintLevels.includes(stats.level)
          ? ` · ${TH.hint(TH.attrs[leaning(stats.attrs)]!)}`
          : '';
        hud.say(TH.levelUp(stats.level) + hint, true);
        fx.levelUp([state.x, 0, state.z], GROUND);
        save();
      }
    }
    // walk over a drop (or near it) to pick it up
    for (const p of pickups.update(dt, { x: state.x, z: state.z, down: stats.down > 0 })) {
      const put = addItem(bag, p.item, p.count);
      if (put === 0) continue;
      const name = TH.items[p.item] ?? p.item;
      hud.say(TH.picked(name, put, countOf(bag, p.item)));
      fx.glint([p.x, 0.8, p.z], ITEMS[p.item]!.color);
      // picking things up one after another climbs in pitch
      sound.play('item.pickup', { pitch: nextCombo(combo, performance.now() / 1000) });
    }
    // what the slimes did this step (landed, noticed us, struck, got hurt, melted, grew back)
    for (const e of herd?.takeSounds() ?? [])
      sound.play(e.id, { at: { x: e.x, z: e.z }, pitch: e.pitch });
    // a boss's ground slam: a ring runs out over the ground and the whole screen shakes
    for (const k of herd?.takeShocks() ?? []) {
      fx.slam([k.x, 0, k.z], GROUND, k.radius);
      shake = Math.max(
        shake,
        Math.max(0.12, 0.5 - 0.03 * Math.hypot(k.x - state.x, k.z - state.z)),
      );
      freeze = Math.max(freeze, 0.06);
    }
  };
  const effects = (dt: number) => fx.update(dt, camera, canvas.height, state.scale);

  /** commands from keys and buttons, once per frame */
  let lastTurn = -1e9;
  const commands = (dt: number) => {
    // off the game (a window open, the intro): drop what was pressed so it does not fire later
    if (screen !== 'play') {
      for (const a of ['walk', 'run', 'bike', 'skill1', 'skill2', 'target'] as const)
        input.pressed(a);
      input.takeTaps();
      input.takeTurn();
      return;
    }
    for (const m of ['walk', 'run', 'bike'] as const) if (input.pressed(m)) setMode(m);
    if (input.pressed('skill1')) castSkill(SLOTS[0]!);
    if (input.pressed('skill2')) castSkill(SLOTS[1]!);
    if (input.pressed('target'))
      combat?.cycleTarget({ x: state.x, z: state.z, heading: lookHeading() });
    for (const [sx, sy] of input.takeTaps()) tapSlime(sx, sy);
    const [tx, ty] = input.takeTurn();
    if (tx !== 0 || ty !== 0) lastTurn = performance.now();
    state.yaw -= tx * 0.006;
    state.pitch = Math.min(CAMERA.pitch.max, Math.max(CAMERA.pitch.min, state.pitch + ty * 0.004));
    // in shoulder view the camera eases round to the chosen slime while the player stands still or
    // casts, unless they have just turned it by hand
    const aim = combat?.target != null && herd ? herd.aimPoint(combat.target) : null;
    if (aim && state.camera === 'shoulder' && screen === 'play' && stats.down === 0) {
      const { forward, right } = input.read();
      const standing = forward === 0 && right === 0;
      const handsOff = (performance.now() - lastTurn) / 1000 > CAMERA.lock.idle;
      if ((standing || combat?.gathering) && handsOff)
        state.yaw = lockYaw(state.yaw, state, { x: aim[0], z: aim[2] }, dt);
    }
  };

  const combo = newCombo();
  const stepClock = newStepClock();
  /** one fixed step of the game: walking, then the world */
  const simStep = (dt: number): number => {
    // lying down after running out of health: no walking until back up
    const { forward, right } = stats.down > 0 ? { forward: 0, right: 0 } : input.read();
    step(dt, forward, right);
    // footsteps keep the beat of walking, running or riding
    for (let n = advanceSteps(stepClock, dt, forward !== 0 || right !== 0, state.mode); n > 0; n--)
      sound.play(`step.${state.mode}`);
    if (combat?.gathering) {
      // keep facing the target while the ball is gathered
      const [fx, fz] = throwDir();
      state.heading = Math.atan2(-fx, -fz);
    }
    const worldDt = held ? 0 : freeze > 0 ? dt * 0.08 : dt;
    freeze = Math.max(0, freeze - dt);
    fight(worldDt);
    return worldDt;
  };

  // the game moves in fixed 1/60 s steps; drawing happens once per frame
  const clock = newClock();
  let phase = 0;
  let speed = 0,
    lastX = state.x * state.scale,
    lastZ = state.z * state.scale;
  let sinceSave = 0;
  let last = performance.now();
  let lastTick = last;
  const tick = () => {
    // use our own clock: some in-app browsers hand requestAnimationFrame a different time base
    const now = performance.now();
    const dt = Math.max(0, Math.min(0.25, (now - last) / 1000));
    last = now;
    lastTick = now;
    try {
      commands(dt);
      let worldTime = 0;
      if (worldRuns(screen)) {
        const steps = advance(clock, dt);
        for (let i = 0; i < steps; i++) worldTime += simStep(clock.step);
        sinceSave += dt;
        if (sinceSave > AUTOSAVE) {
          sinceSave = 0;
          save();
        }
      } else clock.carry = 0;
      effects(worldTime);
      // how fast the body really moved over the ground this frame, smoothed: a phone can draw
      // more frames than the game takes steps, so some frames move nothing at all
      const sx = state.x * state.scale,
        sz = state.z * state.scale;
      const raw = dt > 0 ? Math.hypot(sx - lastX, sz - lastZ) / dt : 0;
      lastX = sx;
      lastZ = sz;
      // a jump (a teleport, getting up at the rest point) is not a step
      speed += ((raw > 40 ? 0 : raw) - speed) * Math.min(1, dt * 12);
      const moving = speed > 0.3;
      phase = moving ? phase + dt * (state.mode === 'walk' ? 9 : 14) : 0;
      walker.bob(phase, moving, state.mode === 'bike');
      walker.animate?.(dt, {
        mode: state.mode,
        speed,
        casting: combat?.gathering ?? false,
        down: stats.down > 0,
      });
      // fall over while down, stand up again after
      const lie = stats.down > 0 ? 1.45 : 0;
      if (!walker.fallsItself)
        walker.body.rotation.z += (lie - walker.body.rotation.z) * Math.min(1, dt * 8);
      place(dt);
      if (shake > 0.002) {
        camera.position.x += (Math.random() - 0.5) * shake;
        camera.position.y += (Math.random() - 0.5) * shake;
        shake *= Math.exp(-dt * 12);
      }
      walker.draw?.(camera);
      herd?.draw(camera);
      renderer.render(scene, camera);
      // name tags never cover the panel and buttons at the top or the minimap
      const covered = [
        ...Array.from(hud.top.querySelectorAll('.title, .player, .near, .chip')),
        minimap.canvas,
      ].map((e) => e.getBoundingClientRect());
      hud.landmarks(state, state.scale, state.labels, camera, covered, screen === 'play');
      minimap.draw(state.x, state.z, state.heading, state.labels, herd?.dots());
      sound.hear(state.x, state.z, state.yaw);
      if (combat && herd) combatHud?.draw(combat, herd, screenOf, stats.energy);
      playerHud.draw(stats);
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
  // stop while the page is hidden, and save on the way out
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) save();
    if (document.hidden) sound.suspend();
    else sound.resume();
    go(document.hidden ? 'hide' : 'show');
  });
  window.addEventListener('pagehide', () => save());

  setMode('walk', false);
  if (saved) {
    restore(saved);
    setMode(state.mode, false);
  }
  walker.body.rotation.y = state.heading;
  go('loaded');
  const goButton = $('#intro-go');
  const newButton = $('#intro-new');
  goButton.textContent = saved ? TH.resume : TH.start;
  newButton.hidden = !saved;
  // a new game makes the character first; the system then speaks, and the walk begins
  const creator = new Creator(
    (l) => {
      setLook(l);
      go('start');
      hud.say(lapText());
      save();
    },
    defaultLook('m'),
    () => sound.play('ui.click'),
  );
  document.body.append(creator.root);
  const create = () => {
    go('create');
    creator.open();
  };
  goButton.addEventListener('click', () => {
    sound.unlock();
    if (saved) {
      go('start');
      hud.say(lapText());
    } else create();
  });
  newButton.addEventListener('click', () => {
    sound.unlock();
    clearSave();
    Object.assign(stats, newStats());
    for (const id of Object.keys(bag)) delete bag[id];
    Object.assign(state, { x: startX, z: startZ, yaw: startYaw, heading: startYaw });
    walker.body.rotation.y = startYaw;
    create();
  });
  // the listening page, over the intro card
  const labButton = $('#intro-lab');
  const showLab = () => {
    intro.hidden = true;
    openLab(sound, {
      unlock: () => sound.unlock(),
      onChange: () => {
        writePrefs({ muted: sound.muted, volume: sound.volume });
        hud.paintChips();
      },
      onClose: () => (intro.hidden = screen !== 'intro'),
    });
  };
  labButton.addEventListener('click', showLab);
  if (location.hash === '#sounds') showLab();
  // sound can only start from a tap; the buttons above do it, and this catches any other first tap
  window.addEventListener('pointerdown', () => sound.unlock(), { once: true });
  requestAnimationFrame(frame);

  if (DEBUG) {
    (window as unknown as { __walk: unknown }).__walk = {
      state: () => ({ ...state }),
      screen: () => screen,
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
        for (let t = 0; t < seconds; t += 1 / 30) {
          fight(1 / 30);
          effects(1 / 30);
        }
      },
      cast: (id: string) => castSkill(id),
      inventory: () => ({ ...bag }),
      grant: (id: string, n: number) => addItem(bag, id, n),
      sound: {
        ready: () => sound.ready,
        muted: () => sound.muted,
        ids: () => Object.keys(SOUNDS),
        log: () => [...sound.log],
        clear: () => (sound.log.length = 0),
        /** how a sound comes out when made without playing it: loudness, length, clipping */
        measure: async (id: string, stretch = 1) => {
          const spec = soundRecipe(id);
          const buf = await renderSound(spec, { stretch }, () => 0.5);
          const d = buf.getChannelData(0);
          // loudness every 50 ms, to see the shape of a sound (a boom, then crackles)
          const step = Math.round(buf.sampleRate * 0.05);
          const shape: number[] = [];
          for (let i = 0; i < d.length; i += step) {
            let peak = 0;
            for (let j = i; j < Math.min(d.length, i + step); j++)
              peak = Math.max(peak, Math.abs(d[j]!));
            shape.push(Math.round(peak * 100) / 100);
          }
          return { ...soundStats(d, buf.sampleRate), recipe: spec.length, shape };
        },
      },
      pickups: () =>
        pickups.all.map((p) => ({ item: p.item, count: p.count, x: p.x, z: p.z, age: p.age })),
      setCamera: (m: CameraMode) => (state.camera = m),
      /** where the walker is on the screen, in CSS pixels */
      walkerOnScreen: () => screenOf([state.x, 1.2, state.z]),
      stats: () => ({ ...stats }),
      look: () => ({ ...look }),
      /** how characters are drawn, and whether the player is a sprite now */
      art: () => ({
        mode: art,
        heroSprite: !!walker.draw,
        anim: walker.showing?.() ?? null,
        sheets: Object.keys(sheets),
      }),
      /** pixel sheets drawn from the models, as pictures (to look at while tuning them) */
      bakePreview: async () => {
        const { bakeHero } = await import('./sprites/heroSprites');
        const { bakeMonster } = await import('./sprites/monsterSprites');
        const out: Record<string, { pages: string[]; meta: unknown }> = {};
        const keep = (b: { pages: HTMLCanvasElement[]; meta: unknown }) => ({
          pages: b.pages.map((c) => c.toDataURL()),
          meta: b.meta,
        });
        out.hero = keep(bakeHero(look));
        if (slimeTemplate) out.slime = keep(bakeMonster(slimeTemplate, monster('slime_fire')));
        if (bossTemplate) out.boss = keep(bakeMonster(bossTemplate, monster('boss_tide_regent')));
        return out;
      },
      creatorChoice: () => creator.choice,
      status: () => ({ open: status.isOpen, pending: status.pending }),
      /** where a joint of the player's body is, world metres (null for the stand-in) */
      heroJoint: (name: string) => {
        const v = walker.joint?.(name, new THREE.Vector3());
        return v ? [v.x, v.y, v.z] : null;
      },
      setStats: (patch: Partial<PlayerStats>) => Object.assign(stats, patch),
      combat: () =>
        combat
          ? { target: combat.target, cooldowns: { ...combat.cooldowns }, inFlight: combat.inFlight }
          : null,
      setTarget: (i: number | null) => combat && (combat.target = i),
      /** where slime i is on the screen, in CSS pixels */
      slimeOnScreen: (i: number) => screenOf(herd?.aimPoint(i) ?? null),
      pause: (p: boolean) => (held = p),
      save: () => save(),
      slimeTriangles: slimeTemplate?.triangles ?? 0,
      plaza: plaza ? { area: Math.round(plaza.area), span: plaza.span } : null,
      /** is this spot (in the gate's frame: x along the wall, z out onto the square) on the paved square? */
      onPlaza: (fx: number, fz: number) => {
        if (!plaza || !gateAt) return false;
        const [x, z] = frameToMap(gateAt, fx, fz);
        return pointInPolygon(x, z, plaza.outline);
      },
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
  $('#intro-new').textContent = TH.restart;
  $('#intro-lab').textContent = TH.lab.link;
}

setupText();
void start();

import {
  defaultConfig as cfg,
  getForm,
  getItemDef,
  getMonster,
  getSkill,
  type Element,
  type PlayerState,
  type Rarity,
} from '@slimehood/game-core';
import {
  ANCHORS,
  RARITY_COLORS,
  SLIME,
  ctxOf,
  drawBoss,
  drawHat,
  drawIconFrame,
  drawMaterial,
  drawMonster,
  drawPart,
  drawPartAt,
  drawSlimeBody,
  drawWeapon,
  makeCanvas,
  ELEMENT_COLORS,
  SKIN_COLORS,
} from './draw';
import { drawCrest, drawEyes, recolour, targetFor } from './bodyB';
import { basketFallback } from './ui';

// ---------- optional PNG overrides (PixelLab) ----------
// public/assets/manifest.json: { "images": { "form:slime_brick": "slime_brick.png", "hat:ngob": "ngob.png" } }
const overrides = new Map<string, HTMLImageElement>();
const cache = new Map<string, HTMLCanvasElement>();

export async function loadArtOverrides(base = 'assets/'): Promise<void> {
  try {
    const res = await fetch(`${base}manifest.json`);
    if (!res.ok) return;
    const m = (await res.json()) as { images?: Record<string, string> };
    await Promise.all(
      Object.entries(m.images ?? {}).map(
        ([key, path]) =>
          new Promise<void>((resolve) => {
            const img = new Image();
            img.onload = () => {
              overrides.set(key, img);
              resolve();
            };
            img.onerror = () => resolve();
            img.src = `${base}${path}`;
          }),
      ),
    );
    cache.clear();
  } catch {
    /* no manifest: placeholders are fine */
  }
}

function override(
  c: CanvasRenderingContext2D,
  key: string,
  x: number,
  y: number,
  w: number,
  h: number,
): boolean {
  const img = overrides.get(key);
  if (!img) return false;
  c.drawImage(img, x, y, w, h);
  return true;
}

/** True once the approved PixelLab slime has been loaded (public/assets/manifest.json). */
export function hasBodyArt(): boolean {
  return overrides.has('body:b') && overrides.has('body:b_noeyes');
}

const bodyData = new Map<string, ImageData>();

function sourceData(key: 'body:b' | 'body:b_noeyes'): ImageData | null {
  const hit = bodyData.get(key);
  if (hit) return hit;
  const img = overrides.get(key);
  if (!img) return null;
  const c = makeCanvas(SLIME);
  const g = ctxOf(c);
  g.drawImage(img, 0, 0, SLIME, SLIME);
  const d = g.getImageData(0, 0, SLIME, SLIME);
  bodyData.set(key, d);
  return d;
}

/** The PixelLab slime in the player's colour / form colours, with the chosen eyes. Returns false if not loaded. */
function drawBody(
  g: CanvasRenderingContext2D,
  o: { color: string; eyes: number; element: Element | null; tier: number; skin?: string | null },
): boolean {
  const src = sourceData(o.eyes === 0 ? 'body:b' : 'body:b_noeyes');
  if (!src) return false;
  const out = recolour(src, targetFor(o));
  const tmp = makeCanvas(SLIME);
  ctxOf(tmp).putImageData(out, 0, 0);
  g.drawImage(tmp, 0, 0);
  if (o.eyes !== 0) drawEyes(g, o.eyes);
  if (o.tier > 0) {
    const pal = o.element ? ELEMENT_COLORS[o.element] : { body: '#7ee0b0', line: '#1e5a46' };
    drawCrest(g, o.tier, pal.body, pal.line);
  }
  return true;
}

// Placeholder equipment and growth parts were drawn for a bigger slime, so they are drawn on a scratch
// canvas and scaled down to sit on the PixelLab body (20x18 px in the 48x48 canvas).
const LEGACY_SCALE = 0.6;
const LEGACY_AT = { x: 10, y: 5, size: Math.round(SLIME * LEGACY_SCALE) };

function drawLegacyScaled(g: CanvasRenderingContext2D, fn: (t: CanvasRenderingContext2D) => void) {
  const t = makeCanvas(SLIME);
  fn(ctxOf(t));
  g.drawImage(t, 0, 0, SLIME, SLIME, LEGACY_AT.x, LEGACY_AT.y, LEGACY_AT.size, LEGACY_AT.size);
}

// ---------- composed sprites ----------

export function slimeSignature(state: PlayerState): string {
  const inst = (uid: string | undefined) => state.items.find((i) => i.uid === uid);
  const head = inst(state.equipment.head);
  const weapon = inst(state.equipment.weapon);
  const skin = inst(state.equipment.skin);
  const parts = [...state.activeSkills, ...state.passiveSkills]
    .map((id) => (id && (state.skills[id]?.level ?? 0) > 0 ? id : '-'))
    .join(',');
  return [
    state.formId,
    head?.defId,
    weapon?.defId,
    skin?.defId,
    parts,
    state.look?.color,
    state.look?.eyes,
  ].join('|');
}

/** The slime with everything it wears and grows, as a 48x48 canvas. */
export function slimeCanvas(state: PlayerState): HTMLCanvasElement {
  const sig = `slime:${slimeSignature(state)}`;
  const hit = cache.get(sig);
  if (hit) return hit;
  const form = getForm(cfg, state.formId);
  const c = makeCanvas(SLIME);
  const g = ctxOf(c);
  const instOf = (uid: string | undefined) => state.items.find((i) => i.uid === uid);
  const skin = instOf(state.equipment.skin);
  const useB = !overrides.has(`form:${form.id}`) && hasBodyArt();
  if (useB) {
    drawBody(g, {
      color: state.look?.color ?? 'mint',
      eyes: state.look?.eyes ?? 0,
      element: form.element,
      tier: form.tier,
      skin: skin ? (SKIN_COLORS[skin.defId] ?? null) : null,
    });
    // growth parts and weapon (placeholder art, scaled to the body)
    drawLegacyScaled(g, (t) => {
      [...state.activeSkills, ...state.passiveSkills].forEach((id, slot) => {
        if (!id || (state.skills[id]?.level ?? 0) < 1) return;
        drawPart(t, getSkill(cfg, id).tags, getSkill(cfg, id).element, slot);
      });
      const w = instOf(state.equipment.weapon);
      if (w) drawWeapon(t, getItemDef(cfg, w.defId).style ?? 'sword', w.defId);
      const h = instOf(state.equipment.head);
      if (h && !overrides.has(`hat:${h.defId}`)) drawHat(t, h.defId);
    });
    const h = instOf(state.equipment.head);
    const hatImg = h ? overrides.get(`hat:${h.defId}`) : undefined;
    if (hatImg) g.drawImage(hatImg, 16, 6, 16, 16);
    cache.set(sig, c);
    return c;
  }
  if (!override(g, `form:${form.id}`, 0, 0, SLIME, SLIME)) {
    drawSlimeBody(g, {
      element: form.element,
      tier: form.tier,
      skin: skin?.defId,
      look: state.look,
    });
  }
  [...state.activeSkills, ...state.passiveSkills].forEach((id, slot) => {
    if (!id || (state.skills[id]?.level ?? 0) < 1) return;
    const sk = getSkill(cfg, id);
    const a = ANCHORS.parts[slot];
    if (!a) return;
    if (!override(g, `part:${sk.part}`, a.x - 8, a.y - 8, 16, 16))
      drawPart(g, sk.tags, sk.element, slot);
  });
  const weapon = instOf(state.equipment.weapon);
  if (weapon) {
    const def = getItemDef(cfg, weapon.defId);
    if (!override(g, `weapon:${def.id}`, ANCHORS.weapon.x - 10, ANCHORS.weapon.y - 14, 20, 24)) {
      drawWeapon(g, def.style ?? 'sword', def.id);
    }
  }
  const head = instOf(state.equipment.head);
  if (head) {
    if (!override(g, `hat:${head.defId}`, ANCHORS.head.x - 14, ANCHORS.head.y - 14, 28, 20)) {
      drawHat(g, head.defId);
    }
  }
  cache.set(sig, c);
  return c;
}

/** Just the plain slime with a chosen look (the creator preview and its choice buttons). */
export function lookCanvas(look: { color: string; eyes: number }): HTMLCanvasElement {
  const sig = `look:${look.color}:${look.eyes}`;
  const hit = cache.get(sig);
  if (hit) return hit;
  const c = makeCanvas(SLIME);
  const g = ctxOf(c);
  if (!drawBody(g, { color: look.color, eyes: look.eyes, element: null, tier: 0 }))
    drawSlimeBody(g, { element: null, tier: 0, look });
  cache.set(sig, c);
  return c;
}

/** A form on its own (used on the evolve cards). */
export function formCanvas(formId: string, color = 'mint'): HTMLCanvasElement {
  const sig = color === 'mint' ? `form:${formId}` : `form:${formId}:${color}`;
  const hit = cache.get(sig);
  if (hit) return hit;
  const form = getForm(cfg, formId);
  const c = makeCanvas(SLIME);
  const g = ctxOf(c);
  if (
    !override(g, `form:${formId}`, 0, 0, SLIME, SLIME) &&
    !drawBody(g, { color, eyes: 0, element: form.element, tier: form.tier })
  )
    drawSlimeBody(g, { element: form.element, tier: form.tier });
  cache.set(sig, c);
  return c;
}

export function hasMonsterArt(id: string): boolean {
  return overrides.has(`monster:${id}`);
}

export function monsterCanvas(id: string): HTMLCanvasElement {
  const sig = `monster:${id}`;
  const hit = cache.get(sig);
  if (hit) return hit;
  const m = getMonster(cfg, id);
  const c = makeCanvas(SLIME);
  const g = ctxOf(c);
  if (!override(g, sig, 0, 0, SLIME, SLIME)) {
    if (hasBodyArt()) {
      // placeholder monsters were drawn big: scale them down next to the PixelLab slime
      const t = makeCanvas(SLIME);
      drawMonster(ctxOf(t), id, m.element);
      g.drawImage(t, 0, 0, SLIME, SLIME, 8, 9, 31, 31);
    } else drawMonster(g, id, m.element);
  }
  cache.set(sig, c);
  return c;
}

export function bossCanvas(id: string): HTMLCanvasElement {
  const sig = `boss:${id}`;
  const hit = cache.get(sig);
  if (hit) return hit;
  const boss = cfg.bosses.find((b) => b.id === id);
  const c = makeCanvas(SLIME);
  const g = ctxOf(c);
  if (!override(g, sig, 0, 0, SLIME, SLIME)) drawBoss(g, boss?.element ?? 'earth');
  cache.set(sig, c);
  return c;
}

// ---------- icons (32x32) ----------

export function itemIcon(defId: string, rarity: Rarity, frame = true): HTMLCanvasElement {
  const sig = `item:${defId}:${rarity}:${frame ? 'f' : 'b'}`;
  const hit = cache.get(sig);
  if (hit) return hit;
  const def = getItemDef(cfg, defId);
  const c = makeCanvas(32);
  const g = ctxOf(c);
  if (frame) drawIconFrame(g, RARITY_COLORS[rarity]);
  g.save();
  switch (def.slot) {
    case 'head':
      g.translate(16 - ANCHORS.head.x * 0.9, 20 - ANCHORS.head.y * 0.9);
      g.scale(0.9, 0.9);
      drawHat(g, def.id);
      break;
    case 'weapon':
      g.translate(16 - ANCHORS.weapon.x * 0.8, 16 - ANCHORS.weapon.y * 0.8 + 1);
      g.scale(0.8, 0.8);
      drawWeapon(g, def.style ?? 'sword', def.id);
      break;
    case 'skin': {
      const color = SKIN_COLORS[def.id] ?? ELEMENT_COLORS.water.body;
      g.translate(5, 4);
      g.scale(0.45, 0.45);
      drawSlimeBody(g, { element: null, tier: 0, skin: def.id });
      void color;
      break;
    }
    default: {
      // charm: a little coin with a mark
      g.fillStyle = '#ffd15c';
      g.beginPath();
      g.arc(16, 16, 8, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#b8862a';
      g.fillRect(14, 11, 4, 10);
    }
  }
  g.restore();
  cache.set(sig, c);
  return c;
}

export function skillIcon(skillId: string): HTMLCanvasElement {
  const sig = `skill:${skillId}`;
  const hit = cache.get(sig);
  if (hit) return hit;
  const sk = getSkill(cfg, skillId);
  const c = makeCanvas(32);
  const g = ctxOf(c);
  drawIconFrame(g, ELEMENT_COLORS[sk.element].body);
  g.save();
  g.translate(16, 16);
  g.scale(1.6, 1.6);
  g.translate(-16, -16);
  drawPartAt(g, sk.tags, sk.element, 16, 16);
  g.restore();
  cache.set(sig, c);
  return c;
}

export function materialIcon(id: string): HTMLCanvasElement {
  const sig = `mat:${id}`;
  const hit = cache.get(sig);
  if (hit) return hit;
  const c = makeCanvas(32);
  drawMaterial(ctxOf(c), id);
  cache.set(sig, c);
  return c;
}

/** A small portrait of the slime's head for the status bar (hat included). */
export function faceCanvas(state: PlayerState): HTMLCanvasElement {
  const sig = `face:${slimeSignature(state)}`;
  const hit = cache.get(sig);
  if (hit) return hit;
  const c = makeCanvas(24);
  ctxOf(c).drawImage(slimeCanvas(state), 9, 6, 30, 30, 0, 0, 24, 24);
  cache.set(sig, c);
  return c;
}

/** The loot basket (kratip). */
export function basketCanvas(fill = 0): HTMLCanvasElement {
  const sig = `basket:${fill}`;
  const hit = cache.get(sig);
  if (hit) return hit;
  const c = makeCanvas(32);
  const g = ctxOf(c);
  if (!override(g, 'ui:kratip', 0, 0, 32, 32)) g.drawImage(basketFallback(fill), 0, 0);
  cache.set(sig, c);
  return c;
}

const urls = new WeakMap<HTMLCanvasElement, string>();
export function dataUrl(c: HTMLCanvasElement): string {
  let u = urls.get(c);
  if (!u) {
    u = c.toDataURL('image/png');
    urls.set(c, u);
  }
  return u;
}

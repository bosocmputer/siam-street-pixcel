import {
  defaultConfig as cfg,
  getForm,
  getItemDef,
  getMonster,
  getSkill,
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
  drawSlimeBody(ctxOf(c), { element: null, tier: 0, look });
  cache.set(sig, c);
  return c;
}

/** A form on its own (used on the evolve cards). */
export function formCanvas(formId: string): HTMLCanvasElement {
  const sig = `form:${formId}`;
  const hit = cache.get(sig);
  if (hit) return hit;
  const form = getForm(cfg, formId);
  const c = makeCanvas(SLIME);
  const g = ctxOf(c);
  if (!override(g, sig, 0, 0, SLIME, SLIME))
    drawSlimeBody(g, { element: form.element, tier: form.tier });
  cache.set(sig, c);
  return c;
}

export function monsterCanvas(id: string): HTMLCanvasElement {
  const sig = `monster:${id}`;
  const hit = cache.get(sig);
  if (hit) return hit;
  const m = getMonster(cfg, id);
  const c = makeCanvas(SLIME);
  const g = ctxOf(c);
  if (!override(g, sig, 0, 0, SLIME, SLIME)) drawMonster(g, id, m.element);
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

export function itemIcon(defId: string, rarity: Rarity): HTMLCanvasElement {
  const sig = `item:${defId}:${rarity}`;
  const hit = cache.get(sig);
  if (hit) return hit;
  const def = getItemDef(cfg, defId);
  const c = makeCanvas(32);
  const g = ctxOf(c);
  drawIconFrame(g, RARITY_COLORS[rarity]);
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

const urls = new WeakMap<HTMLCanvasElement, string>();
export function dataUrl(c: HTMLCanvasElement): string {
  let u = urls.get(c);
  if (!u) {
    u = c.toDataURL('image/png');
    urls.set(c, u);
  }
  return u;
}

// Things that can be picked up and carried (config/items.json), and the bag that holds them.

import itemsJson from '../config/items.json';
import { ConfigError, num, obj } from './config';

export interface ItemSpec {
  id: string;
  kind: 'material';
  /** colour of the placeholder gem, 0xrrggbb */
  color: number;
  /** width on the ground in metres */
  size: number;
  /** id of a model in the app's asset list, or null to draw the placeholder */
  model: string | null;
}

export interface PickupSpec {
  life: number;
  popTime: number;
  magnetRange: number;
  collectRange: number;
  magnetSpeed: number;
  scatter: number;
}

/** "#rrggbb" to a number; anything else is a mistake in the config. */
export function hexColor(v: unknown, where: string): number {
  if (typeof v !== 'string' || !/^#[0-9a-f]{6}$/i.test(v))
    throw new ConfigError(`${where}: expected a colour like "#38d8f0", got ${JSON.stringify(v)}`);
  return parseInt(v.slice(1), 16);
}

export function readItems(raw: unknown): {
  items: Record<string, ItemSpec>;
  pickup: PickupSpec;
  maxStack: number;
} {
  const root = obj(raw, 'items.json');
  const list = obj(root.items, 'items.json items');
  const items: Record<string, ItemSpec> = {};
  for (const id of Object.keys(list)) {
    const w = `items.${id}`;
    const o = obj(list[id], w);
    if (o.kind !== 'material') throw new ConfigError(`${w}.kind: expected "material"`);
    if (o.model !== null && typeof o.model !== 'string')
      throw new ConfigError(`${w}.model: expected a model id or null`);
    items[id] = {
      id,
      kind: 'material',
      color: hexColor(o.color, `${w}.color`),
      size: num(o, 'size', w, 0.05),
      model: o.model,
    };
  }
  if (Object.keys(items).length === 0) throw new ConfigError('items.json: no items');
  const p = obj(root.pickup, 'items.json pickup');
  const w = 'items.pickup';
  return {
    items,
    pickup: {
      life: num(p, 'life', w, 1),
      popTime: num(p, 'popTime', w),
      magnetRange: num(p, 'magnetRange', w, 0.1),
      collectRange: num(p, 'collectRange', w, 0.1),
      magnetSpeed: num(p, 'magnetSpeed', w, 0.1),
      scatter: num(p, 'scatter', w),
    },
    maxStack: num(root, 'maxStack', 'items.json', 1),
  };
}

const CONFIG = readItems(itemsJson);
export const ITEMS: Readonly<Record<string, ItemSpec>> = CONFIG.items;
export const PICKUP: PickupSpec = CONFIG.pickup;
export const MAX_STACK = CONFIG.maxStack;

/** One item by id; an id that is not in the config is a mistake in the code or config. */
export function item(id: string): ItemSpec {
  const s = ITEMS[id];
  if (!s) throw new ConfigError(`unknown item: ${id}`);
  return s;
}

/** What the player carries: how many of each item, by id. */
export type Inventory = Record<string, number>;

export const countOf = (inv: Inventory, id: string): number => inv[id] ?? 0;

/**
 * Put `count` of an item in the bag, up to the most one stack holds. Returns how many went in
 * (less than asked when the stack is full).
 */
export function addItem(inv: Inventory, id: string, count: number, max = MAX_STACK): number {
  item(id);
  const room = Math.max(0, max - countOf(inv, id));
  const put = Math.min(Math.max(0, Math.floor(count)), room);
  if (put > 0) inv[id] = countOf(inv, id) + put;
  return put;
}

import { create } from 'zustand';
import { defaultConfig as cfg, type ClaimReport, type PlayerState } from '@slimehood/game-core';
import type { Action, Backend } from './backend';
import { LocalBackend } from './local';

export type Page = 'farm' | 'slime' | 'skills' | 'bag' | 'map';

export interface Toast {
  id: number;
  text: string;
  tone: 'good' | 'info' | 'bad';
}

interface GameStore {
  ready: boolean;
  player: PlayerState | null;
  page: Page;
  intro: boolean; // true while the first-minute tutorial is still on screen
  report: ClaimReport | null; // shown in the "while you were away" dialog
  toasts: Toast[];
  busy: boolean;
  backend: Backend;
  boot(): Promise<void>;
  createPlayer(home: string): Promise<void>;
  dispatch(a: Action): Promise<{ ok: boolean; reason?: string; info?: Record<string, unknown> }>;
  setPage(p: Page): void;
  endIntro(): void;
  closeReport(): void;
  toast(text: string, tone?: Toast['tone']): void;
  newGame(): Promise<void>;
}

let toastId = 0;

export const useGame = create<GameStore>((set, get) => ({
  ready: false,
  player: null,
  page: 'farm',
  intro: false,
  report: null,
  toasts: [],
  busy: false,
  backend: new LocalBackend(),

  async boot() {
    const player = await get().backend.load();
    set({ player, ready: true });
  },

  async createPlayer(home) {
    const player = await get().backend.create(home);
    set({ player, page: 'farm', intro: true });
  },

  async dispatch(a) {
    const { player, backend } = get();
    if (!player) return { ok: false, reason: 'noPlayer' };
    set({ busy: true });
    const r = await backend.exec(player, a);
    set({ busy: false });
    if (!r.ok) return { ok: false, reason: r.reason };
    set({ player: r.state, ...(r.report ? { report: r.report } : {}) });
    return { ok: true, info: r.info };
  },

  setPage(page) {
    set({ page });
  },

  endIntro() {
    set({ intro: false, page: 'farm' });
  },

  closeReport() {
    set({ report: null });
  },

  toast(text, tone = 'info') {
    const id = ++toastId;
    set((s) => ({ toasts: [...s.toasts, { id, text, tone }].slice(-3) })); // never more than 3 on screen
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 2600);
  },

  async newGame() {
    await get().backend.reset();
    set({ player: null, page: 'farm', report: null, intro: false });
  },
}));

export const config = cfg;

// Test hook: lets browser tests move the clock and read the state. Only with ?debug=1 or in dev.
if (
  typeof window !== 'undefined' &&
  (import.meta.env.DEV || window.location.search.includes('debug=1'))
) {
  (window as unknown as { __slime: unknown }).__slime = {
    get state() {
      return useGame.getState().player;
    },
    /** Put an item into the bag (tests need a known hat without waiting for a lucky drop). */
    grant(defId: string, rarity = 'common') {
      const p = useGame.getState().player;
      if (!p) return;
      const uid = `dbg${p.counters.item + 1}`;
      useGame.setState({
        player: {
          ...p,
          items: [...p.items, { uid, defId, rarity: rarity as 'common', upgrade: 0 }],
          counters: { item: p.counters.item + 1 },
        },
      });
    },
    advance(seconds: number) {
      const b = useGame.getState().backend as LocalBackend;
      b.offsetSeconds += seconds;
    },
    store: useGame,
  };
}

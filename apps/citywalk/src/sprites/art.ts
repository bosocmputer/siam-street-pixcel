// Which way the game is drawn: pixel 3D (the default, chosen by the creator 19 Oct 2569: the whole
// scene, people and monsters as 3D models, drawn in big pixels), pixel sprites in a smooth city,
// or plain 3D. `?art=pixel3d`, `?art=pixel` or `?art=3d` in the address picks one and remembers it.

export type Art = 'pixel3d' | 'pixel' | '3d';
const ARTS: readonly string[] = ['pixel3d', 'pixel', '3d'];
const isArt = (a: string | null): a is Art => a !== null && ARTS.includes(a);
const KEY = 'citywalk.art';

export function artMode(search = location.search): Art {
  const asked = new URLSearchParams(search).get('art');
  try {
    if (isArt(asked)) localStorage.setItem(KEY, asked);
    const kept = localStorage.getItem(KEY);
    if (isArt(kept)) return kept;
  } catch {
    // no storage (a private window): only the address counts
    if (isArt(asked)) return asked;
  }
  return 'pixel3d';
}

/** Let the page show a message before a long piece of work blocks it. */
export const breathe = (): Promise<void> => new Promise((ok) => setTimeout(ok, 30));

// Which way characters and monsters are drawn: as pixel sprites (the default) or as the 3D models
// they are made from. `?art=3d` or `?art=pixel` in the address picks one and remembers it.

export type Art = 'pixel' | '3d';
const KEY = 'citywalk.art';

export function artMode(search = location.search): Art {
  const asked = new URLSearchParams(search).get('art');
  try {
    if (asked === 'pixel' || asked === '3d') localStorage.setItem(KEY, asked);
    const kept = localStorage.getItem(KEY);
    if (kept === 'pixel' || kept === '3d') return kept;
  } catch {
    // no storage (a private window): only the address counts
    if (asked === 'pixel' || asked === '3d') return asked;
  }
  return 'pixel';
}

/** Let the page show a message before a long piece of work blocks it. */
export const breathe = (): Promise<void> => new Promise((ok) => setTimeout(ok, 30));

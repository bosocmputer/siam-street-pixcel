import { describe, expect, it } from 'vitest';
import { ICONS, gridPaths, pxIcon, pxRing } from './pixelIcons';

describe('pixel icons', () => {
  it('every picture is a rectangle of known colours', () => {
    for (const [name, rows] of Object.entries(ICONS)) {
      const w = rows[0]!.length;
      for (const r of rows) expect(r.length, name).toBe(w);
      expect(rows.join('')).toMatch(/^[.#kroywbclWRgp]+$/);
    }
  });

  it('runs of a colour become one rectangle each', () => {
    const p = gridPaths(['##.#', '.kk.']);
    expect(p.get('#')).toBe('M0 0h2v1h-2zM3 0h1v1h-1z');
    expect(p.get('k')).toBe('M1 1h2v1h-2z');
  });

  it('a one-colour icon follows the text colour, a coloured one keeps its own', () => {
    expect(pxIcon('close')).toContain('fill="currentColor"');
    expect(pxIcon('fire')).toContain('#f77622');
    expect(pxIcon('close', 'x')).toContain('class="x"');
  });

  it('a ring is round and hollow', () => {
    const r = pxRing(12, 2);
    expect(r).toHaveLength(12);
    expect(r[6]![0]).toBe('#');
    expect(r[6]![6]).toBe('.');
  });
});

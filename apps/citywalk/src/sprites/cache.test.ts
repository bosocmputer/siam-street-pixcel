import { describe, expect, it } from 'vitest';
import { signature } from './cache';

describe('signature', () => {
  it('is the same for the same things and changes when any of them changes', () => {
    const bytes = new Uint8Array([1, 2, 3]).buffer;
    const a = signature('slime_fire', '{"scale":1}', bytes);
    expect(signature('slime_fire', '{"scale":1}', new Uint8Array([1, 2, 3]).buffer)).toBe(a);
    expect(signature('slime_fire', '{"scale":1.1}', bytes)).not.toBe(a);
    expect(signature('slime_fire', '{"scale":1}', new Uint8Array([1, 2, 4]).buffer)).not.toBe(a);
    expect(signature('slime_fire', '{"scale":1}', undefined)).not.toBe(a);
  });

  it('tells Thai text apart', () => {
    expect(signature('ทรงผม ก')).not.toBe(signature('ทรงผม ข'));
    expect(signature('a', 'b')).toHaveLength(16);
  });
});

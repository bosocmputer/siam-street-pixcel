// Types for designs.js.
export interface Design {
  label: string;
  build: object;
  headSize: number;
  headH: number;
  sharp: number;
  skin: string;
  hair: string;
  hairStyle: string;
  ears: boolean;
  face: Record<string, number | string | boolean>;
  outfit: Record<string, string>;
}

export const DESIGNS: Record<'m' | 'f', Design>;

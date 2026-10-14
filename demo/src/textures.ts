import Phaser from 'phaser';

type Painter = (g: Phaser.GameObjects.Graphics) => void;

// Placeholder art. Any key listed in public/assets/manifest.json is loaded
// from a PNG instead and these painters are skipped.
const PAINTERS: Record<string, { w: number; h: number; paint: Painter }> = {
  player: {
    w: 32,
    h: 40,
    paint: (g) => {
      g.fillStyle(0x000000, 0.25).fillEllipse(16, 36, 24, 8);
      g.fillStyle(0x3b82f6).fillRoundedRect(7, 14, 18, 22, 5);
      g.fillStyle(0xfcd9b0).fillCircle(16, 11, 9);
      g.fillStyle(0x1e3a8a).fillRect(7, 3, 18, 6);
    },
  },
  boss: {
    w: 120,
    h: 130,
    paint: (g) => {
      g.fillStyle(0x000000, 0.3).fillEllipse(60, 118, 90, 20);
      g.fillStyle(0x7f1d1d).fillRoundedRect(20, 30, 80, 85, 16);
      g.fillStyle(0xb91c1c).fillCircle(60, 40, 34);
      g.fillStyle(0xfef08a).fillCircle(46, 38, 7).fillCircle(74, 38, 7);
      g.fillStyle(0x111827).fillCircle(46, 38, 3).fillCircle(74, 38, 3);
      g.fillStyle(0x450a0a).fillTriangle(34, 14, 44, 4, 48, 20).fillTriangle(86, 14, 76, 4, 72, 20);
    },
  },
  shot: {
    w: 20,
    h: 20,
    paint: (g) => {
      g.fillStyle(0xf97316).fillCircle(10, 10, 9);
      g.fillStyle(0xfde68a).fillCircle(10, 10, 4);
    },
  },
  orb: {
    w: 40,
    h: 40,
    paint: (g) => {
      g.fillStyle(0x7c3aed).fillCircle(20, 20, 18);
      g.fillStyle(0xc4b5fd).fillCircle(20, 20, 9);
      g.lineStyle(2, 0xffffff, 0.8).strokeCircle(20, 20, 18);
    },
  },
  bolt: {
    w: 18,
    h: 18,
    paint: (g) => {
      g.fillStyle(0x38bdf8).fillCircle(9, 9, 8);
      g.fillStyle(0xe0f2fe).fillCircle(9, 9, 3);
    },
  },
  wall: {
    w: 104,
    h: 104,
    paint: (g) => {
      g.fillStyle(0x22d3ee, 0.35).fillCircle(52, 52, 50);
      g.lineStyle(4, 0xa5f3fc, 0.95).strokeCircle(52, 52, 48);
      g.lineStyle(2, 0xffffff, 0.7).strokeCircle(52, 52, 34);
    },
  },
  pillar: {
    w: 96,
    h: 96,
    paint: (g) => {
      g.fillStyle(0x22d3ee, 0.25).fillCircle(48, 48, 46);
      g.fillStyle(0x64748b).fillRoundedRect(30, 22, 36, 60, 6);
      g.fillStyle(0xa5f3fc).fillRect(36, 28, 24, 6);
      g.lineStyle(3, 0xa5f3fc, 0.9).strokeCircle(48, 48, 44);
    },
  },
};

export function makeMissingTextures(scene: Phaser.Scene): void {
  for (const [key, def] of Object.entries(PAINTERS)) {
    if (scene.textures.exists(key)) continue;
    const g = scene.add.graphics();
    def.paint(g);
    g.generateTexture(key, def.w, def.h);
    g.destroy();
  }
}

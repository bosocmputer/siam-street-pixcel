// A page for working on the hero's moves (not part of the game): ?anims=walk,run draws the pixel
// sheet rows for those animations; add &mode=3d for smooth renders from five sides instead
// (&n= frames). The screenshot tool in this folder captures it.

import * as THREE from 'three';
import { SPRITES, defaultLook } from '@newgame/rpg-core';
import { makeHero } from '../../src/hero';
import { buildLook } from '../../src/lookModel';
import { bakeHero } from '../../src/sprites/heroSprites';
import { cartoon } from '../../src/sprites/bake';

const q = new URLSearchParams(location.search);
const anims = (q.get('anims') ?? 'idle,walk,run,strike1,strike2,strike3,dash,guard').split(',');
const look = defaultLook((q.get('body') as 'm' | 'f') ?? 'm');
const label = (text: string) => {
  const d = document.createElement('div');
  d.textContent = text;
  d.style.padding = '6px 4px 2px';
  document.body.append(d);
};

if (q.get('mode') === '3d') {
  const n = Number(q.get('n') ?? 6);
  const size = 200;
  const views = [0, 45, 90, 135, 180];
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(size * n, size * views.length);
  renderer.setClearColor(0x39404f);
  renderer.setScissorTest(true);
  const scene = new THREE.Scene();
  scene.add(new THREE.AmbientLight(0xffffff, 1.2), new THREE.DirectionalLight(0xffffff, 2));
  const grid = new THREE.GridHelper(4, 8, 0x667, 0x556);
  scene.add(grid);
  const w = makeHero(
    { scene: buildLook(look).root, entry: { id: 'hero', file: '' } },
    { outline: true, shadow: true, proportions: SPRITES.hero.proportions },
  );
  cartoon(w.body);
  scene.add(w.body);
  // the body faces -z in the game; turn it to face +z here
  w.body.rotation.y = Math.PI;
  const cam = new THREE.OrthographicCamera(-1.1, 1.1, 1.1, -1.1, 0.1, 20);
  for (const anim of anims) {
    label(anim);
    renderer.clear();
    for (let i = 0; i < n; i++) {
      const loops = SPRITES.hero.anims[anim]?.loop ?? false;
      w.posed(anim, loops ? i / n : n === 1 ? 0 : (i + 0.5) / n);
      views.forEach((deg, r) => {
        const a = (deg * Math.PI) / 180;
        cam.position.set(Math.sin(a) * 5, 0.95 + 5 * Math.tan(SPRITES.elevation), Math.cos(a) * 5);
        cam.lookAt(0, 0.95, 0);
        const y = (views.length - 1 - r) * size;
        renderer.setViewport(i * size, y, size, size);
        renderer.setScissor(i * size, y, size, size);
        renderer.render(scene, cam);
      });
    }
    const c = document.createElement('canvas');
    c.width = size * n;
    c.height = size * views.length;
    c.getContext('2d')!.drawImage(renderer.domElement, 0, 0);
    document.body.append(c);
  }
} else {
  const zoom = Number(q.get('zoom') ?? 3);
  const specs = Object.entries(SPRITES.hero.anims).filter(([k]) => anims.includes(k));
  const baked = bakeHero(look, SPRITES, specs);
  (window as unknown as { out: unknown }).out = {
    pages: baked.pages.map((c) => c.toDataURL()),
    meta: baked.meta,
  };
  baked.pages.forEach((page, i) => {
    label(specs[i]?.[0] ?? '');
    const c = document.createElement('canvas');
    c.width = page.width * zoom;
    c.height = page.height * zoom;
    const g = c.getContext('2d')!;
    g.imageSmoothingEnabled = false;
    g.fillStyle = '#4a5468';
    g.fillRect(0, 0, c.width, c.height);
    g.drawImage(page, 0, 0, c.width, c.height);
    document.body.append(c);
  });
}
(window as unknown as { ready: boolean }).ready = true;

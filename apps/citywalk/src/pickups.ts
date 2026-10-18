import * as THREE from 'three';
import {
  ITEMS,
  PICKUP,
  rollDrops,
  spawnPickups,
  stepPickups,
  type Drop,
  type DropSpec,
  type Pickup,
} from '@newgame/rpg-core';

// Drops lying on the ground: they fly out where a monster fell, bob and spin, drift towards the
// player once close, and blink before they vanish. What they do is in rpg-core (drops.ts); this
// draws them. A drop shows its item's model if one is loaded, else a small glowing gem.

/** seconds before a drop vanishes that it starts to blink */
const BLINK = 5;

function glowTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,0.9)');
  grad.addColorStop(0.4, 'rgba(255,255,255,0.35)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

interface Visual {
  root: THREE.Group;
  /** the part that spins and bobs */
  body: THREE.Object3D;
}

export class PickupField {
  readonly object = new THREE.Group();
  private list: Pickup[] = [];
  private visuals = new Map<number, Visual>();
  private uid = 1;
  private time = 0;
  private gem = new THREE.OctahedronGeometry(0.5);
  private glow = glowTexture();
  private mats = new Map<string, { gem: THREE.Material; halo: THREE.SpriteMaterial }>();

  constructor(
    private models: ReadonlyMap<string, THREE.Object3D>,
    private rng: () => number,
  ) {
    this.object.name = 'Pickups';
  }

  get all(): readonly Pickup[] {
    return this.list;
  }

  /** Roll a monster's drops and lay them out round where it fell. */
  drop(
    table: readonly DropSpec[],
    at: { x: number; z: number },
    /** keeps a drop out of walls: the position it can really reach moving by (dx, dz) */
    move: (x: number, z: number, dx: number, dz: number) => [number, number],
  ): Drop[] {
    const drops = rollDrops(table, this.rng);
    const made = spawnPickups(drops, at, this.rng, this.uid);
    this.uid += made.length;
    for (const p of made) {
      [p.x, p.z] = move(at.x, at.z, p.x - at.x, p.z - at.z);
      this.list.push(p);
      this.visuals.set(p.uid, this.makeVisual(p));
    }
    return drops;
  }

  private materials(item: string) {
    let m = this.mats.get(item);
    if (!m) {
      const color = ITEMS[item]!.color;
      m = {
        gem: new THREE.MeshStandardMaterial({
          color,
          emissive: color,
          emissiveIntensity: 0.55,
          roughness: 0.3,
          flatShading: true,
        }),
        halo: new THREE.SpriteMaterial({
          map: this.glow,
          color,
          transparent: true,
          opacity: 0.8,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      };
      this.mats.set(item, m);
    }
    return m;
  }

  private makeVisual(p: Pickup): Visual {
    const spec = ITEMS[p.item]!;
    const mats = this.materials(p.item);
    const root = new THREE.Group();
    const body = new THREE.Group();
    const model = this.models.get(p.item);
    if (model) {
      body.add(model.clone(true));
    } else {
      const gem = new THREE.Mesh(this.gem, mats.gem);
      gem.scale.set(spec.size, spec.size * 1.25, spec.size);
      gem.position.y = spec.size * 0.6;
      body.add(gem);
    }
    // a bigger stack is a bit bigger on the ground
    body.scale.setScalar(1 + Math.min(0.6, 0.15 * (p.count - 1)));
    const halo = new THREE.Sprite(mats.halo);
    halo.scale.setScalar(spec.size * 3.2);
    halo.position.y = spec.size * 0.6;
    halo.renderOrder = 5;
    root.add(body, halo);
    this.object.add(root);
    return { root, body };
  }

  /**
   * Move the drops on by dt of game time and return the ones the player just collected. Positions
   * are map metres; the player's chest is about a metre up.
   */
  update(dt: number, player: { x: number; z: number; down?: boolean }): Pickup[] {
    this.time += dt;
    const { left, got } = stepPickups(this.list, dt, player);
    this.list = left;
    const forget = (p: Pickup) => {
      const v = this.visuals.get(p.uid);
      if (!v) return;
      this.object.remove(v.root);
      this.visuals.delete(p.uid);
    };
    for (const p of got) forget(p);
    // anything that vanished by lying too long
    for (const uid of [...this.visuals.keys()])
      if (!left.some((p) => p.uid === uid) && !got.some((p) => p.uid === uid)) {
        const v = this.visuals.get(uid)!;
        this.object.remove(v.root);
        this.visuals.delete(uid);
      }
    for (const p of left) {
      const v = this.visuals.get(p.uid);
      if (!v) continue;
      const pop = Math.min(1, p.age / PICKUP.popTime);
      const ease = 1 - (1 - pop) * (1 - pop);
      const x = p.fromX + (p.x - p.fromX) * ease;
      const z = p.fromZ + (p.z - p.fromZ) * ease;
      let y = 0.1 + Math.sin(Math.PI * pop) * 0.9;
      if (pop >= 1) {
        const d = Math.hypot(player.x - p.x, player.z - p.z);
        // hover and bob, rising towards the player's chest as it gets drawn in
        const draw = player.down ? 0 : Math.max(0, 1 - d / PICKUP.magnetRange);
        y = 0.25 + Math.sin(this.time * 3 + p.uid) * 0.06 + draw * 0.8;
      }
      v.root.position.set(x, y, z);
      v.body.rotation.y = this.time * 2 + p.uid;
      v.root.visible = PICKUP.life - p.age > BLINK || Math.floor(p.age * 6) % 2 === 0;
    }
    return got;
  }
}

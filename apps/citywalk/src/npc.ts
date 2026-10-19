// People standing in the city to talk to (config/quests.json npcs): a body made the same way as
// the player's (from a look, as a sprite or posed 3D), turning to face the player when near, and
// for Pa Saeng her khao soi stall, built in code until there is a model (gdd.md asset list).

import * as THREE from 'three';
import type { Walker } from './walker';

const lambert = (color: number) => new THREE.MeshLambertMaterial({ color });

/** A street stall: a table with a big pot, two stools and an orange umbrella. */
export function makeStall(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'Stall';
  const wood = lambert(0x8a5a3c);
  const top = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.08, 0.8), wood);
  top.position.y = 0.86;
  g.add(top);
  for (const [x, z] of [
    [-0.78, -0.34],
    [0.78, -0.34],
    [-0.78, 0.34],
    [0.78, 0.34],
  ] as const) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.86, 0.06), wood);
    leg.position.set(x, 0.43, z);
    g.add(leg);
  }
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.22, 0.34, 12), lambert(0xb8c2cc));
  pot.position.set(-0.4, 1.07, 0);
  g.add(pot);
  const soup = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.23, 0.02, 12), lambert(0xe08a2c));
  soup.position.set(-0.4, 1.23, 0);
  g.add(soup);
  for (let i = 0; i < 3; i++) {
    const bowl = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.06, 0.07, 10),
      lambert(i % 2 ? 0xf4f4f4 : 0x2b6fb0),
    );
    bowl.position.set(0.15 + i * 0.22, 0.94, 0.12 - i * 0.08);
    g.add(bowl);
  }
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.3, 6), lambert(0x5a6988));
  pole.position.set(0.7, 1.15, -0.3);
  g.add(pole);
  // an umbrella in orange and cream panels
  const shade = new THREE.Group();
  for (let i = 0; i < 8; i++) {
    const panel = new THREE.Mesh(
      new THREE.ConeGeometry(1.25, 0.45, 8, 1, true, (i * Math.PI) / 4, Math.PI / 4),
      new THREE.MeshLambertMaterial({ color: i % 2 ? 0xf77622 : 0xead4aa, side: THREE.DoubleSide }),
    );
    shade.add(panel);
  }
  shade.position.set(0.7, 2.35, -0.3);
  g.add(shade);
  for (const x of [-0.5, 0.5]) {
    const stool = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.16, 0.45, 10),
      lambert(0xe43b44),
    );
    stool.position.set(x, 0.225, 0.85);
    g.add(stool);
  }
  g.traverse((o) => {
    if (o instanceof THREE.Mesh) o.castShadow = false;
  });
  return g;
}

export class Npc {
  private heading: number;

  constructor(
    readonly id: string,
    readonly walker: Walker,
    /** where they stand, map metres */
    readonly x: number,
    readonly z: number,
    /** which way they face when nobody is near, radians (0 = +z) */
    rest: number,
  ) {
    this.heading = rest;
    walker.body.name = `Npc_${id}`;
    walker.body.rotation.y = rest + Math.PI;
  }

  /** Stand, breathe, and turn to the player when they come close. */
  update(dt: number, player: { x: number; z: number }, scale: number): void {
    const w = this.walker;
    w.body.position.set(this.x * scale, w.lift, this.z * scale);
    const dx = player.x - this.x,
      dz = player.z - this.z;
    if (Math.hypot(dx, dz) < 9) this.heading = Math.atan2(dx, dz);
    // the body faces -z, so it turns the opposite way
    let d = this.heading + Math.PI - w.body.rotation.y;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    w.body.rotation.y += d * Math.min(1, dt * 6);
    w.animate?.(dt, { mode: 'walk', speed: 0, casting: false, down: false });
  }

  draw(camera: THREE.Camera): void {
    this.walker.draw?.(camera);
  }

  distance(player: { x: number; z: number }): number {
    return Math.hypot(player.x - this.x, player.z - this.z);
  }
}

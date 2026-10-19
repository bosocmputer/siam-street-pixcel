// The red warnings on the ground before a monster's blow lands (vfx_sound.md: telegraph_circle and
// telegraph_line): a sharp red edge round where it will hit, filling in red from the middle (a ring)
// or from the monster's end (a lane) until the moment it lands. This red is used for nothing else.

import * as THREE from 'three';
import type { Warning } from '@newgame/rpg-core';

const RED = 0xff3b30;
/** a little above the paving, under everything else */
const LIFT = 0.06;
/** the width of the sharp edge, metres */
const EDGE = 0.12;

interface Mark {
  group: THREE.Group;
  /** a ring's edge */
  ring: THREE.Mesh;
  /** a lane's four edges */
  sides: THREE.Mesh[];
  /** the red filling in */
  fill: THREE.Mesh;
}

const flat = (geo: THREE.BufferGeometry) => geo.rotateX(-Math.PI / 2);

export class Warnings {
  readonly object = new THREE.Group();
  private marks: Mark[] = [];
  private edge = new THREE.MeshBasicMaterial({
    color: RED,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -6,
    polygonOffsetUnits: -6,
  });
  private filler = new THREE.MeshBasicMaterial({
    color: RED,
    transparent: true,
    opacity: 0.32,
    depthWrite: false,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -5,
    polygonOffsetUnits: -5,
  });
  /** a ring 1 m across the middle of its edge; scaled to each warning's radius */
  private ringGeo = flat(new THREE.RingGeometry(1 - EDGE / 2, 1 + EDGE / 2, 40));
  private discGeo = flat(new THREE.CircleGeometry(1, 40));
  /** a 1 × 1 square from 0 to 1 along z, so it grows out from the monster */
  private stripGeo = flat(new THREE.PlaneGeometry(1, 1)).translate(0, 0, 0.5);

  constructor() {
    this.object.name = 'Warnings';
  }

  private mark(i: number): Mark {
    let m = this.marks[i];
    if (m) return m;
    const group = new THREE.Group();
    const ring = new THREE.Mesh(this.ringGeo, this.edge);
    const sides = [0, 1, 2, 3].map(() => new THREE.Mesh(this.stripGeo, this.edge));
    const fill = new THREE.Mesh(this.discGeo, this.filler);
    for (const o of [ring, fill, ...sides]) o.renderOrder = 1;
    group.add(ring, fill, ...sides);
    this.object.add(group);
    m = { group, ring, sides, fill };
    this.marks.push(m);
    return m;
  }

  /** Show these warnings (map metres; `ground` is the height of the paving). */
  update(list: readonly Warning[], ground: number): void {
    list.forEach((w, i) => {
      const m = this.mark(i);
      m.group.visible = true;
      m.group.position.set(w.x, ground + LIFT, w.z);
      m.group.rotation.y = w.heading;
      const fill = Math.max(0.02, Math.min(1, w.fill));
      if (w.length === 0) {
        m.ring.visible = true;
        m.ring.scale.set(w.radius, 1, w.radius);
        for (const s of m.sides) s.visible = false;
        m.fill.geometry = this.discGeo;
        m.fill.scale.set(w.radius * fill, 1, w.radius * fill);
        return;
      }
      // a lane: two long edges, a short one at each end, and red running out along it
      m.ring.visible = false;
      const [left, right, near, far] = m.sides as [THREE.Mesh, THREE.Mesh, THREE.Mesh, THREE.Mesh];
      for (const s of m.sides) s.visible = true;
      left.position.set(-w.radius, 0, 0);
      right.position.set(w.radius, 0, 0);
      left.scale.set(EDGE, 1, w.length);
      right.scale.set(EDGE, 1, w.length);
      near.position.set(0, 0, 0);
      far.position.set(0, 0, w.length - EDGE);
      near.scale.set(w.radius * 2 + EDGE, 1, EDGE);
      far.scale.set(w.radius * 2 + EDGE, 1, EDGE);
      m.fill.geometry = this.stripGeo;
      m.fill.scale.set(w.radius * 2, 1, w.length * fill);
    });
    for (let i = list.length; i < this.marks.length; i++) this.marks[i]!.group.visible = false;
  }

  /** warnings on the ground now (for tests) */
  get showing(): number {
    return this.marks.filter((m) => m.group.visible).length;
  }
}

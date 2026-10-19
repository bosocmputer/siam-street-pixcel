// The guide line (approved first-minute mockup, step 3): orange squares on the ground from the
// player to where the quest leads, running towards it. Straight across the square for now; along
// the real streets once there is a path finder (systems_design.md section 19).

import * as THREE from 'three';

/** the guide's own orange, the colour of the system window */
const ORANGE = 0xff9500;
/** metres between squares, and the most squares drawn */
const GAP = 0.9;
const MOST = 48;

export class Guide {
  readonly object: THREE.InstancedMesh;
  private m = new THREE.Matrix4();
  private time = 0;

  constructor() {
    const geo = new THREE.PlaneGeometry(0.34, 0.34).rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
      color: ORANGE,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -6,
      polygonOffsetUnits: -6,
    });
    this.object = new THREE.InstancedMesh(geo, mat, MOST);
    this.object.name = 'Guide';
    this.object.frustumCulled = false;
    this.object.count = 0;
  }

  /**
   * Lay the squares from `from` towards `to` (map metres, x and z), stopping short of it; null
   * hides the line. `ground` is the height of the paving.
   */
  update(dt: number, from: [number, number], to: [number, number] | null, ground: number): void {
    this.time += dt;
    if (!to) {
      this.object.count = 0;
      return;
    }
    const dx = to[0] - from[0],
      dz = to[1] - from[1];
    const d = Math.hypot(dx, dz);
    // start a little ahead of the feet, stop before the goal; the squares slide towards it
    const start = 1.2,
      end = d - 1.6;
    const shift = (this.time * 1.6) % GAP;
    let n = 0;
    for (let t = start + shift; t < end && n < MOST; t += GAP, n++) {
      const k = t / d;
      this.m.makeRotationY(Math.atan2(dx, dz));
      this.m.setPosition(from[0] + dx * k, ground + 0.07, from[1] + dz * k);
      this.object.setMatrixAt(n, this.m);
    }
    this.object.count = n;
    this.object.instanceMatrix.needsUpdate = true;
  }

  /** squares on the ground now (for tests) */
  get shown(): number {
    return this.object.count;
  }
}

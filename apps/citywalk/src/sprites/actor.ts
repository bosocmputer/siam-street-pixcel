// One sprite in the world: a flat picture that always faces the camera, standing on its feet,
// showing the frame of its animation for the way it faces (mirrored for the left-facing ones).

import * as THREE from 'three';
import { frameAt, spriteDirection, type SheetAnim } from '@newgame/rpg-core';
import type { SpriteSheet } from './sheet';

const tmpQ = new THREE.Quaternion();
const tmpP = new THREE.Vector3();
const tmpC = new THREE.Vector3();

export class SpriteActor {
  readonly object: THREE.Mesh;
  private material: THREE.MeshBasicMaterial;
  private pages: THREE.Texture[];
  private anim: string;
  private time = 0;
  private speed = 1;
  /** play a looping animation once and stop on its last frame */
  private once = false;
  /** a frame chosen by the caller (a walk following distance) instead of time */
  private held: number | null = null;
  private flashU = { value: new THREE.Vector4(1, 1, 1, 0) };

  constructor(private sheet: SpriteSheet) {
    const m = sheet.meta;
    const [fw, fh] = m.frame;
    const [ax, ay] = m.anchor;
    // a plane the size of a frame in metres, with the feet at the origin
    const geo = new THREE.PlaneGeometry(fw / m.ppm, fh / m.ppm).translate(
      (fw / 2 - ax) / m.ppm,
      (ay - fh / 2) / m.ppm,
      0,
    );
    // each sprite reads its own part of the pictures, so it has its own copies of the textures
    this.pages = sheet.pages.map((t) => {
      const c = t.clone();
      c.needsUpdate = true;
      return c;
    });
    this.material = new THREE.MeshBasicMaterial({ map: this.pages[0]!, alphaTest: 0.5 });
    // a hit flashes the picture towards a colour
    this.material.onBeforeCompile = (shader) => {
      shader.uniforms.uFlash = this.flashU;
      shader.fragmentShader = shader.fragmentShader
        .replace('void main() {', 'uniform vec4 uFlash;\nvoid main() {')
        .replace(
          '#include <opaque_fragment>',
          'outgoingLight = mix(outgoingLight, uFlash.rgb, uFlash.a);\n#include <opaque_fragment>',
        );
    };
    this.object = new THREE.Mesh(geo, this.material);
    this.object.name = 'Sprite';
    this.anim = 'idle' in m.anims ? 'idle' : Object.keys(m.anims)[0]!;
  }

  has(anim: string): boolean {
    return anim in this.sheet.meta.anims;
  }

  /**
   * Start an animation, from its first frame unless it is already playing and loops. `once` plays
   * even a looping one once, stopping on its last frame.
   */
  play(anim: string, speed = 1, once = false): void {
    if (!this.has(anim)) return;
    this.speed = speed;
    this.held = null;
    if (anim === this.anim && !once && !this.once) return;
    this.anim = anim;
    this.once = once;
    this.time = 0;
  }

  private get loops(): boolean {
    return this.sheet.meta.anims[this.anim]!.loop && !this.once;
  }

  /** Show frame `i` of an animation, for frames that follow distance rather than time. */
  hold(anim: string, i: number): void {
    if (!this.has(anim)) return;
    this.anim = anim;
    this.once = false;
    this.held = i;
  }

  /** Has an animation that does not loop reached its last frame? */
  get done(): boolean {
    const a = this.sheet.meta.anims[this.anim]!;
    return !this.loops && this.time * a.fps >= a.frames;
  }

  get playing(): string {
    return this.anim;
  }

  /** Light the picture up in `color` by k (0..1). */
  flash(color: THREE.Color, k: number): void {
    this.flashU.value.set(color.r, color.g, color.b, k);
  }

  update(dt: number): void {
    this.time += dt * this.speed;
  }

  /**
   * Turn to face the camera and show the right frame for the way the sprite faces (`facing`, an
   * angle on the ground: atan2(x, z) of its forward direction in world space).
   */
  draw(camera: THREE.Camera, facing: number): void {
    const o = this.object;
    // face the camera: the camera's turn, undoing the parents' turn
    o.parent?.getWorldQuaternion(tmpQ).invert();
    o.quaternion.copy(tmpQ.multiply(camera.quaternion));
    o.getWorldPosition(tmpP);
    camera.getWorldPosition(tmpC);
    const m = this.sheet.meta;
    const a = m.anims[this.anim] as SheetAnim;
    const { row, mirror } = spriteDirection(
      facing,
      Math.atan2(tmpC.x - tmpP.x, tmpC.z - tmpP.z),
      m.dirs,
    );
    const col = this.held ?? frameAt({ ...a, loop: this.loops }, this.time);
    const tex = this.pages[a.page]!;
    if (this.material.map !== tex) {
      this.material.map = tex;
      this.material.needsUpdate = true;
    }
    const img = tex.image as { width: number; height: number };
    const u = m.frame[0] / img.width,
      v = m.frame[1] / img.height;
    tex.repeat.set(mirror ? -u : u, v);
    tex.offset.set((col + (mirror ? 1 : 0)) * u, 1 - (a.row + row + 1) * v);
  }
}

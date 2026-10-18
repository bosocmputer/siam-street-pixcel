// Effects as pixel art: skill effects and drops are drawn on their own into a small picture (one
// pixel for every few on screen), behind the city as it stands, then laid over the screen with
// hard edges, a checker pattern where they fade, and a few steps of each colour. The sprites are
// pixels already; only the city stays smooth.

import * as THREE from 'three';

const FX_LAYER = 1;

const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

const FRAG = /* glsl */ `
uniform sampler2D map;
uniform vec2 res;
uniform float steps;
varying vec2 vUv;
// a 4x4 ordered pattern, 0..1: where a fading effect keeps or drops each pixel
float bayer(vec2 p) {
  vec2 q = mod(p, 4.0);
  int i = int(q.x) + int(q.y) * 4;
  int m[16] = int[16](0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5);
  return (float(m[i]) + 0.5) / 16.0;
}
void main() {
  vec4 c = texture2D(map, vUv);
  // glows add light without covering much; their brightness counts as cover
  float lum = max(c.r, max(c.g, c.b));
  float cover = max(c.a, lum * 0.85);
  if (cover < 0.04 || cover < bayer(floor(vUv * res)) * 0.85) discard;
  vec3 col = c.rgb / max(cover, 0.001);
  col = pow(clamp(col, 0.0, 1.0), vec3(1.0 / 2.2));
  col = floor(col * steps + 0.5) / steps;
  gl_FragColor = vec4(col, 1.0);
}`;

export class PixelPass {
  private target = new THREE.WebGLRenderTarget(1, 1, {
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    depthBuffer: true,
  });
  private depthOnly = new THREE.MeshBasicMaterial({ colorWrite: false });
  private quad: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  private flat = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  /** `pixel`: how many screen pixels one effect pixel covers */
  constructor(
    private renderer: THREE.WebGLRenderer,
    private pixel: number,
  ) {
    this.quad = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: FRAG,
        uniforms: {
          map: { value: this.target.texture },
          res: { value: new THREE.Vector2(1, 1) },
          steps: { value: 7 },
        },
        transparent: true,
        depthTest: false,
        depthWrite: false,
      }),
    );
    this.quad.frustumCulled = false;
  }

  /** Match the screen (its size in device pixels). */
  resize(width: number, height: number): void {
    const k = this.pixel * this.renderer.getPixelRatio();
    const w = Math.max(1, Math.ceil(width / k)),
      h = Math.max(1, Math.ceil(height / k));
    this.target.setSize(w, h);
    this.quad.material.uniforms.res!.value.set(w, h);
  }

  /** How tall the effects picture is, pixels (point sizes are worked out from it). */
  get height(): number {
    return this.target.height;
  }

  /**
   * Draw the frame: the scene without `pixelated` (and its children) to the screen, then those
   * in pixels over it. `hideFromDepth` are left out of what hides effects (flat sprites, whose
   * empty corners would cut holes in them).
   */
  render(
    scene: THREE.Scene,
    camera: THREE.Camera,
    pixelated: THREE.Object3D[],
    hideFromDepth: THREE.Object3D[],
  ): void {
    const r = this.renderer;
    for (const o of pixelated) o.traverse((c) => c.layers.set(FX_LAYER));
    camera.layers.set(0);
    r.render(scene, camera);

    // the city's depth, small, so effects behind a wall stay hidden
    const background = scene.background;
    const auto = r.autoClear;
    const shown = hideFromDepth.map((o) => o.visible);
    scene.background = null;
    r.setRenderTarget(this.target);
    r.setClearColor(0x000000, 0);
    r.clear();
    hideFromDepth.forEach((o) => (o.visible = false));
    scene.overrideMaterial = this.depthOnly;
    r.autoClear = false;
    r.render(scene, camera);
    scene.overrideMaterial = null;
    hideFromDepth.forEach((o, i) => (o.visible = shown[i]!));
    // then the effects alone
    camera.layers.set(FX_LAYER);
    r.render(scene, camera);
    camera.layers.set(0);
    r.setRenderTarget(null);
    r.render(this.quad, this.flat);
    r.autoClear = auto;
    scene.background = background;
  }
}

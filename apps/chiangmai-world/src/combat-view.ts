import * as THREE from 'three';
import { CombatSimulation, type CombatEvent, type CombatPose } from './combat';

const metal = (color: string) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.28, metalness: 0.6 });
const matte = (color: string) => new THREE.MeshStandardMaterial({ color, roughness: 0.78 });
function piece(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  parent: THREE.Object3D,
  x = 0,
  y = 0,
  z = 0,
): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}
function limb(
  parent: THREE.Object3D,
  a: THREE.Vector3,
  b: THREE.Vector3,
  radius: number,
  material: THREE.Material,
): void {
  const delta = b.clone().sub(a);
  const mesh = piece(
    new THREE.CapsuleGeometry(radius, Math.max(0.01, delta.length() - radius * 2), 5, 12),
    material,
    parent,
  );
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
}

export class CombatView {
  readonly enemies = new THREE.Group();
  readonly hands = new THREE.Group();
  private right = new THREE.Group();
  private left = new THREE.Group();
  private visuals: {
    root: THREE.Group;
    jelly: THREE.Mesh;
    material: THREE.MeshPhysicalMaterial;
    shadow: THREE.Mesh;
    label: HTMLDivElement;
  }[] = [];
  private floats: {
    div: HTMLDivElement;
    position: THREE.Vector3;
    created: number;
    duration: number;
  }[] = [];
  private particles: { mesh: THREE.Mesh; velocity: THREE.Vector3; life: number }[] = [];
  private projected = new THREE.Vector3();
  private damageOverlay: HTMLElement;
  private reticle: HTMLElement;
  private confirmUntil = 0;

  constructor(
    private scene: THREE.Scene,
    private camera: THREE.PerspectiveCamera,
    private simulation: CombatSimulation,
    private host: HTMLElement,
  ) {
    scene.add(this.enemies, camera);
    camera.add(this.hands);
    this.buildHands();
    this.damageOverlay = document.getElementById('damage-overlay')!;
    this.reticle = document.getElementById('reticle')!;
    const sphere = new THREE.SphereGeometry(0.76, 30, 20);
    const white = matte('#f2f4db');
    const black = matte('#152f25');
    const highlight = new THREE.MeshBasicMaterial({
      color: '#eaffd3',
      transparent: true,
      opacity: 0.75,
    });
    const groundShadow = new THREE.MeshBasicMaterial({
      color: '#263f25',
      transparent: true,
      opacity: 0.23,
      depthWrite: false,
    });
    for (const slime of simulation.slimes) {
      const root = new THREE.Group();
      const material = new THREE.MeshPhysicalMaterial({
        color: '#78c952',
        roughness: 0.22,
        metalness: 0,
        clearcoat: 1,
        clearcoatRoughness: 0.14,
        transparent: true,
        opacity: 0.92,
        emissive: '#254c10',
        emissiveIntensity: 0.08,
      });
      const jelly = piece(sphere, material, root, 0, 0.58, 0);
      jelly.scale.set(1.05, 0.72, 1);
      jelly.castShadow = true;
      for (const side of [-1, 1]) {
        piece(
          new THREE.SphereGeometry(0.145, 16, 12),
          white,
          jelly,
          side * 0.27,
          0.12,
          0.65,
        ).scale.set(0.86, 1.3, 0.5);
        piece(
          new THREE.SphereGeometry(0.075, 12, 10),
          black,
          jelly,
          side * 0.27,
          0.11,
          0.717,
        ).scale.set(0.75, 1.3, 0.5);
        piece(
          new THREE.SphereGeometry(0.021, 8, 6),
          white,
          jelly,
          side * 0.27 - 0.025,
          0.16,
          0.754,
        );
      }
      const smile = piece(
        new THREE.TorusGeometry(0.12, 0.025, 8, 16, Math.PI),
        black,
        jelly,
        0,
        -0.09,
        0.72,
      );
      smile.rotation.z = Math.PI;
      piece(new THREE.SphereGeometry(0.15, 14, 10), highlight, jelly, -0.24, 0.38, 0.44).scale.set(
        1.5,
        0.55,
        0.25,
      );
      piece(new THREE.SphereGeometry(0.065, 12, 8), highlight, jelly, -0.43, 0.25, 0.46);
      const core = piece(
        new THREE.OctahedronGeometry(0.13),
        new THREE.MeshStandardMaterial({
          color: '#dcf872',
          emissive: '#7fa92a',
          emissiveIntensity: 0.3,
          roughness: 0.25,
        }),
        jelly,
        0,
        0.15,
        -0.18,
      );
      core.rotation.z = 0.3;
      const shadow = piece(new THREE.CircleGeometry(0.72, 24), groundShadow, this.enemies);
      shadow.rotation.x = -Math.PI / 2;
      shadow.position.set(slime.position[0], 0.285, slime.position[1]);
      const label = document.createElement('div');
      label.className = 'enemy-label';
      label.innerHTML = '<span>สไลม์ <small>Lv.1</small></span><div class="enemy-hp"><i></i></div>';
      host.appendChild(label);
      this.visuals.push({ root, jelly, material, shadow, label });
      this.enemies.add(root);
    }
  }

  private buildHands(): void {
    const leather = matte('#4d3d2f'),
      skin = matte('#c49877'),
      armor = metal('#73878b'),
      brass = metal('#c6a65c');
    const cloth = matte('#263c3c');
    this.hands.add(this.right, this.left);
    const hand = piece(
      new THREE.SphereGeometry(0.069, 14, 12),
      leather,
      this.right,
      0,
      -0.06,
      0.01,
    );
    hand.scale.set(1.05, 1.15, 1.2);
    for (let i = 0; i < 4; i++) {
      const finger = piece(
        new THREE.CapsuleGeometry(0.017, 0.044, 3, 7),
        leather,
        this.right,
        -0.047 + i * 0.029,
        -0.04,
        -0.044,
      );
      finger.rotation.x = Math.PI / 2;
    }
    limb(
      this.right,
      new THREE.Vector3(0.02, -0.1, 0.04),
      new THREE.Vector3(0.12, -0.47, 0.32),
      0.065,
      skin,
    );
    limb(
      this.right,
      new THREE.Vector3(0.06, -0.19, 0.12),
      new THREE.Vector3(0.13, -0.42, 0.29),
      0.082,
      armor,
    );
    limb(
      this.right,
      new THREE.Vector3(0.13, -0.45, 0.29),
      new THREE.Vector3(0.3, -0.75, 0.47),
      0.1,
      cloth,
    );
    const sword = new THREE.Group();
    this.right.add(sword);
    const grip = piece(
      new THREE.CylinderGeometry(0.033, 0.036, 0.21, 12),
      leather,
      sword,
      0,
      -0.035,
      0,
    );
    grip.rotation.y = Math.PI / 6;
    for (let i = 0; i < 6; i++) {
      const wrap = piece(
        new THREE.TorusGeometry(0.035, 0.006, 5, 12),
        brass,
        sword,
        0,
        -0.12 + i * 0.033,
        0,
      );
      wrap.rotation.x = Math.PI / 2;
    }
    piece(new THREE.SphereGeometry(0.053, 12, 10), brass, sword, 0, -0.17, 0).scale.set(
      1,
      0.75,
      0.8,
    );
    const guard = piece(new THREE.BoxGeometry(0.3, 0.04, 0.065), brass, sword, 0, 0.09, 0);
    guard.rotation.z = 0.04;
    for (const side of [-1, 1])
      piece(new THREE.SphereGeometry(0.035, 10, 8), brass, sword, side * 0.16, 0.07, 0);
    const blade = new THREE.BufferGeometry();
    const levels = [
      { y: 0.12, w: 0.046 },
      { y: 0.9, w: 0.037 },
      { y: 1.08, w: 0 },
    ];
    const vertices: number[] = [],
      color: number[] = [];
    const shades = [
      new THREE.Color('#d7e5e8'),
      new THREE.Color('#80999e'),
      new THREE.Color('#e5f2f3'),
      new THREE.Color('#6a8188'),
    ];
    for (let level = 1; level < levels.length; level++) {
      const a = levels[level - 1],
        b = levels[level];
      const lower = [
        [-a.w, a.y, 0],
        [0, a.y, 0.014],
        [a.w, a.y, 0],
        [0, a.y, -0.014],
      ];
      const upper = [
        [-b.w, b.y, 0],
        [0, b.y, b.w ? 0.012 : 0],
        [b.w, b.y, 0],
        [0, b.y, b.w ? -0.012 : 0],
      ];
      for (let side = 0; side < 4; side++) {
        const next = (side + 1) % 4;
        for (const p of [
          lower[side],
          upper[side],
          lower[next],
          lower[next],
          upper[side],
          upper[next],
        ]) {
          vertices.push(...p);
          color.push(shades[side].r, shades[side].g, shades[side].b);
        }
      }
    }
    blade.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    blade.setAttribute('color', new THREE.Float32BufferAttribute(color, 3));
    blade.computeVertexNormals();
    piece(
      blade,
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        metalness: 0.55,
        roughness: 0.23,
        side: THREE.DoubleSide,
      }),
      sword,
    );
    piece(new THREE.CapsuleGeometry(0.066, 0.06, 5, 12), leather, this.left, 0, 0, 0).rotation.z =
      0.4;
    limb(
      this.left,
      new THREE.Vector3(0.01, -0.04, 0.03),
      new THREE.Vector3(-0.12, -0.39, 0.25),
      0.075,
      armor,
    );
    limb(
      this.left,
      new THREE.Vector3(-0.12, -0.4, 0.26),
      new THREE.Vector3(-0.25, -0.66, 0.38),
      0.095,
      cloth,
    );
    for (let i = 0; i < 4; i++)
      piece(
        new THREE.SphereGeometry(0.022, 8, 6),
        leather,
        this.left,
        -0.04 + i * 0.023,
        0.036,
        -0.024,
      );
    this.hands.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.renderOrder = 100;
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        material.depthTest = false;
        material.depthWrite = false;
      }
      object.frustumCulled = false;
    });
  }

  handle(events: CombatEvent[], visualTime: number): void {
    for (const event of events) {
      if (event.kind === 'hit') {
        this.confirmUntil = visualTime + 0.15;
        this.floating(String(event.amount), event.position, 'damage-number', visualTime, 0.8);
      }
      if (event.kind === 'kill') {
        this.floating('+20 XP', event.position, 'xp-number', visualTime + 0.2, 1.3);
        for (let i = 0; i < 12; i++) {
          const mesh = piece(
            new THREE.IcosahedronGeometry(0.085 + (i % 3) * 0.018, 0),
            new THREE.MeshStandardMaterial({
              color: '#a9df66',
              transparent: true,
              opacity: 0.9,
              roughness: 0.3,
            }),
            this.scene,
            event.position[0],
            0.6,
            event.position[1],
          );
          const angle = (i * Math.PI * 2) / 12;
          this.particles.push({
            mesh,
            velocity: new THREE.Vector3(
              Math.cos(angle) * 2,
              2 + (i % 3) * 0.5,
              Math.sin(angle) * 2,
            ),
            life: 0.9,
          });
        }
      }
      if (event.kind === 'block')
        this.floating('ป้องกัน', event.position, 'block-number', visualTime, 0.7);
    }
  }
  private floating(
    text: string,
    p: [number, number],
    className: string,
    created: number,
    duration: number,
  ): void {
    const div = document.createElement('div');
    div.className = `floating-number ${className}`;
    div.textContent = text;
    this.host.appendChild(div);
    this.floats.push({ div, position: new THREE.Vector3(p[0], 1.2, p[1]), created, duration });
  }
  reset(): void {
    for (const item of this.floats) item.div.remove();
    this.floats = [];
    for (const p of this.particles) {
      this.scene.remove(p.mesh);
      p.mesh.geometry.dispose();
      (p.mesh.material as THREE.Material).dispose();
    }
    this.particles = [];
    this.confirmUntil = 0;
  }
  update(
    dt: number,
    visualTime: number,
    pose: CombatPose,
    visible: boolean,
    moving: boolean,
  ): void {
    this.hands.visible = visible && this.simulation.player.hp > 0;
    this.enemies.visible = true;
    const swingTime = this.simulation.time - this.simulation.lastSwingAt;
    const slash =
      swingTime >= 0 && swingTime < 0.6 ? Math.sin(Math.min(1, swingTime / 0.42) * Math.PI) : 0;
    const idle = Math.sin(visualTime * 2) * 0.008;
    const sway = moving ? Math.sin(visualTime * 9) * 0.016 : 0;
    const horizontalFit = Math.min(1, Math.max(0.6, this.camera.aspect / 0.9));
    this.right.position.set(
      0.4 * horizontalFit - slash * 0.45,
      -0.3 + idle + sway + slash * 0.08,
      -1.1 - slash * 0.13,
    );
    this.right.rotation.set(-0.15 + slash * 0.55, -0.16 - slash * 0.55, -0.12 + slash * 1.4);
    this.left.position.set(
      -0.42 * horizontalFit + (pose.blocking ? 0.16 : 0),
      -0.36 + idle + sway + (pose.blocking ? 0.23 : 0),
      -0.95,
    );
    this.left.rotation.set(pose.blocking ? 0.7 : -0.2, 0.3, pose.blocking ? -1.1 : 0.3);
    if (pose.blocking) this.right.rotation.z = 1.05;
    for (let i = 0; i < this.simulation.slimes.length; i++) {
      const slime = this.simulation.slimes[i],
        view = this.visuals[i];
      const deadAge = this.simulation.time - slime.diedAt;
      view.root.visible = slime.mode !== 'dead' || deadAge < 0.3;
      view.shadow.visible = slime.mode !== 'dead';
      view.root.position.set(slime.position[0], 0.15, slime.position[1]);
      view.root.rotation.y = Math.atan2(
        pose.position[0] - slime.position[0],
        pose.position[1] - slime.position[1],
      );
      let squash = 1 + Math.sin(visualTime * 4 + i * 2) * 0.045;
      let hop = slime.mode === 'chase' ? Math.max(0, Math.sin(visualTime * 8 + i)) * 0.28 : 0;
      if (slime.mode === 'windup') {
        squash = 0.7;
        hop = Math.max(0, 1 - (slime.until - this.simulation.time) / 0.65) * 0.08;
      }
      if (slime.mode === 'recover')
        hop = Math.max(0, Math.sin((1.05 - slime.until + this.simulation.time) * 7)) * 0.38;
      if (slime.mode === 'stunned') squash = 0.74 + Math.sin(visualTime * 32) * 0.04;
      const death = slime.mode === 'dead' ? Math.max(0.02, 1 - deadAge / 0.3) : 1;
      view.root.scale.setScalar(death);
      view.jelly.scale.set(1.05 / Math.sqrt(squash), 0.72 * squash, 1 / Math.sqrt(squash));
      view.jelly.position.y = 0.58 * squash + hop;
      view.shadow.position.set(slime.position[0], 0.285, slime.position[1]);
      view.material.color.set(slime.mode === 'windup' ? '#b9b94b' : '#78c952');
      view.material.emissive.set(
        this.simulation.time - slime.hitAt < 0.14
          ? '#c9f7a4'
          : slime.mode === 'windup'
            ? '#714a19'
            : '#254c10',
      );
      view.material.emissiveIntensity = this.simulation.time - slime.hitAt < 0.14 ? 0.85 : 0.1;
      const d = Math.hypot(
        pose.position[0] - slime.position[0],
        pose.position[1] - slime.position[1],
      );
      this.projected.set(slime.position[0], 1.45 + hop, slime.position[1]);
      this.projected.project(this.camera);
      const onScreen =
        visible &&
        slime.mode !== 'dead' &&
        d < 22 &&
        this.projected.z < 1 &&
        Math.abs(this.projected.x) < 0.94 &&
        Math.abs(this.projected.y) < 0.9;
      view.label.style.display = onScreen ? 'block' : 'none';
      if (onScreen) {
        view.label.style.transform = `translate(${(this.projected.x * 0.5 + 0.5) * innerWidth}px, ${(-this.projected.y * 0.5 + 0.5) * innerHeight}px) translate(-50%,-100%)`;
        (view.label.querySelector('i') as HTMLElement).style.width =
          `${(slime.hp / slime.maxHp) * 100}%`;
        view.label.classList.toggle('attacking', slime.mode === 'windup');
      }
    }
    this.floats = this.floats.filter((item) => {
      const age = visualTime - item.created;
      if (age > item.duration) {
        item.div.remove();
        return false;
      }
      if (age < 0 || !visible) {
        item.div.style.display = 'none';
        return true;
      }
      item.div.style.display = 'block';
      this.projected.copy(item.position);
      this.projected.y += age * 1.2;
      this.projected.project(this.camera);
      item.div.style.opacity = String(Math.min(1, (item.duration - age) * 3));
      item.div.style.transform = `translate(${(this.projected.x * 0.5 + 0.5) * innerWidth}px, ${(-this.projected.y * 0.5 + 0.5) * innerHeight}px) translate(-50%,-50%)`;
      return true;
    });
    this.particles = this.particles.filter((p) => {
      p.life -= dt;
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        (p.mesh.material as THREE.Material).dispose();
        return false;
      }
      p.velocity.y -= dt * 6;
      p.mesh.position.addScaledVector(p.velocity, dt);
      p.mesh.scale.setScalar(Math.max(0, p.life));
      return true;
    });
    const hurt = this.simulation.time - this.simulation.hurtAt;
    this.damageOverlay.style.opacity =
      visible && hurt < 0.35 ? String((1 - hurt / 0.35) * 0.7) : '0';
    this.reticle.classList.toggle('confirmed', visualTime < this.confirmUntil);
  }
}

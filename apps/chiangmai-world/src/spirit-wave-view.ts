import * as THREE from 'three';
import { CombatSimulation, SPIRIT_WAVE, type CombatEvent } from './combat';

function glow(color: string, opacity: number, weapon = false): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: !weapon,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
}

function bladeAuraTexture(): THREE.DataTexture {
  const size = 64;
  const pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const offset = (y * size + x) * 4;
      const u = (x / (size - 1) - 0.5) * 2;
      const v = y / (size - 1);
      pixels[offset] = pixels[offset + 1] = pixels[offset + 2] = 255;
      pixels[offset + 3] = Math.round(255 * Math.exp(-u * u * 12) * Math.sin(v * Math.PI) ** 0.55);
    }
  }
  const texture = new THREE.DataTexture(pixels, size, size);
  texture.magFilter = texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

/** A tapered arc, rather than a full ring: narrow tips and a thick luminous cutting edge. */
function crescentGeometry(): THREE.BufferGeometry {
  const points: number[] = [];
  const segments = 64;
  const pair = (t: number, inner: boolean) => {
    const angle = -1.95 + t * 3.9;
    const radius = 1.6 - (inner ? Math.sin(t * Math.PI) * 0.42 : 0);
    return [Math.cos(angle) * radius - 0.45, Math.sin(angle) * radius * 0.82, 0];
  };
  for (let i = 0; i < segments; i++) {
    const a = i / segments,
      b = (i + 1) / segments;
    for (const p of [
      pair(a, false),
      pair(a, true),
      pair(b, false),
      pair(b, false),
      pair(a, true),
      pair(b, true),
    ])
      points.push(...p);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  return geometry;
}

export class SpiritWaveView {
  private charge = new THREE.Group();
  private motes: THREE.Mesh[] = [];
  private bladeGlows: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>[] = [];
  private auraRings: THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>[] = [];
  private waves = new Map<number, { group: THREE.Group; materials: THREE.MeshBasicMaterial[] }>();
  private bursts: {
    ring: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
    born: number;
  }[] = [];
  private arc = crescentGeometry();
  private ringGeometry = new THREE.RingGeometry(0.91, 1, 40);
  private flash: HTMLElement;

  constructor(
    private scene: THREE.Scene,
    weapon: THREE.Group,
    private simulation: CombatSimulation,
    private firstPerson = true,
  ) {
    weapon.add(this.charge);
    this.flash = document.getElementById('spirit-flash')!;
    const auraTexture = bladeAuraTexture();
    for (let i = 0; i < 3; i++) {
      const material = glow(i === 0 ? '#c1f6ff' : '#35bfff', 0.7 / (i + 1), true);
      if (i > 0) material.map = auraTexture;
      const blade = new THREE.Mesh(
        i === 0
          ? new THREE.BoxGeometry(0.065, 0.97, 0.025)
          : new THREE.PlaneGeometry(0.25 + i * 0.22, 1.14),
        material,
      );
      blade.position.y = 0.61;
      blade.renderOrder = 102 + i;
      this.charge.add(blade);
      this.bladeGlows.push(blade);
    }
    const moteGeometry = new THREE.IcosahedronGeometry(0.009, 0);
    const moteMaterial = glow('#a5f5ff', 0.9, true);
    for (let i = 0; i < 28; i++) {
      const mote = new THREE.Mesh(moteGeometry, moteMaterial);
      mote.renderOrder = 106;
      this.charge.add(mote);
      this.motes.push(mote);
    }
    for (let i = 0; i < 2; i++) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.24, 0.005, 6, 48),
        glow('#55ccff', 0.65, true),
      );
      ring.position.y = 0.6;
      ring.renderOrder = 105;
      this.charge.add(ring);
      this.auraRings.push(ring);
    }
    if (!firstPerson)
      this.charge.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.material.depthTest = true;
          object.renderOrder = 2;
        }
      });
  }

  bind(simulation: CombatSimulation): void {
    this.reset();
    this.simulation = simulation;
  }

  handle(events: CombatEvent[]): void {
    for (const event of events) {
      if (event.kind !== 'wave-stop' && event.kind !== 'wave-release') continue;
      const ring = new THREE.Mesh(this.ringGeometry, glow('#79ddff', 0.7));
      ring.position.set(event.position[0], 0.31, event.position[1]);
      ring.rotation.x = -Math.PI / 2;
      this.scene.add(ring);
      this.bursts.push({ ring, born: this.simulation.time });
    }
  }

  reset(): void {
    for (const wave of this.waves.values()) {
      this.scene.remove(wave.group);
      wave.materials.forEach((m) => m.dispose());
    }
    this.waves.clear();
    for (const burst of this.bursts) {
      this.scene.remove(burst.ring);
      burst.ring.material.dispose();
    }
    this.bursts = [];
    this.charge.visible = false;
    if (this.firstPerson) this.flash.style.opacity = '0';
  }

  update(visible: boolean): void {
    const sim = this.simulation;
    const charging = sim.chargingAt !== null;
    const progress = charging ? Math.min(1, (sim.time - sim.chargingAt!) / SPIRIT_WAVE.charge) : 0;
    const after = sim.time - sim.lastReleaseAt;
    this.charge.visible = visible && sim.player.hp > 0 && (charging || after < 0.3);
    for (let i = 0; i < this.motes.length; i++) {
      const phase = (sim.time * 1.8 + i / this.motes.length) % 1;
      const radius = (1 - phase) * (0.5 - progress * 0.2) + 0.035;
      const angle = i * 2.4 + phase * 7;
      this.motes[i].position.set(
        Math.cos(angle) * radius,
        0.1 + phase * 0.92,
        Math.sin(angle) * radius,
      );
      this.motes[i].scale.setScalar(0.45 + phase);
    }
    const pulse = 0.85 + Math.sin(sim.time * 25) * 0.15;
    this.bladeGlows.forEach((blade, i) => {
      blade.material.opacity =
        ((charging ? 0.25 + progress * 0.7 : Math.max(0, 1 - after / 0.3)) * pulse) / (i + 1);
    });
    this.auraRings.forEach((ring, i) => {
      ring.rotation.set(sim.time * (i ? -5 : 5), i + sim.time * 2, 0.4);
      ring.scale.setScalar(1.4 - progress * 0.65);
      ring.material.opacity = charging ? 0.3 + progress * 0.4 : 0;
    });
    if (this.firstPerson)
      this.flash.style.opacity =
        visible && after >= 0 && after < 0.22 ? String((1 - after / 0.22) * 0.14) : '0';
    const living = new Set(sim.waves.map((wave) => wave.id));
    for (const [id, view] of this.waves) {
      if (living.has(id)) continue;
      this.scene.remove(view.group);
      view.materials.forEach((m) => m.dispose());
      this.waves.delete(id);
    }
    for (const wave of sim.waves) {
      let view = this.waves.get(wave.id);
      if (!view) {
        const group = new THREE.Group();
        const materials: THREE.MeshBasicMaterial[] = [];
        for (let i = 0; i < 5; i++) {
          const material = glow(i === 0 ? '#dcfbff' : i === 1 ? '#54d9ff' : '#278bff', 1);
          const mesh = new THREE.Mesh(this.arc, material);
          mesh.rotation.z = -0.62;
          mesh.position.z = i * 0.22;
          mesh.scale.setScalar(i < 2 ? 1 + i * 0.08 : 1 - i * 0.08);
          mesh.renderOrder = 2;
          group.add(mesh);
          materials.push(material);
        }
        const floor = new THREE.Mesh(this.ringGeometry, glow('#56bfff', 0.3));
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = -1.15;
        group.add(floor);
        materials.push(floor.material);
        this.scene.add(group);
        view = { group, materials };
        this.waves.set(wave.id, view);
      }
      view.group.position.set(wave.position[0], 1.45, wave.position[1]);
      view.group.rotation.y = wave.yaw;
      const fade = Math.min(1, (SPIRIT_WAVE.range - wave.travelled) / 4);
      view.materials.forEach((m, i) => {
        m.opacity = fade * [0.95, 0.4, 0.22, 0.13, 0.06, 0.22][i];
      });
    }
    this.bursts = this.bursts.filter((burst) => {
      const age = sim.time - burst.born;
      if (age > 0.45) {
        this.scene.remove(burst.ring);
        burst.ring.material.dispose();
        return false;
      }
      burst.ring.scale.setScalar(0.3 + age * 6);
      burst.ring.material.opacity = (1 - age / 0.45) * 0.65;
      return true;
    });
  }
}

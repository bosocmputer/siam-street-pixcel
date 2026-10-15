import * as THREE from 'three';
import { CrowdSimulation, type FarmBot } from './crowd';
import { CombatSimulation } from './combat';
import { SpiritWaveView } from './spirit-wave-view';

const material = (color: string, metalness = 0) =>
  new THREE.MeshStandardMaterial({ color, metalness, roughness: metalness ? 0.35 : 0.8 });
function mesh(
  parent: THREE.Object3D,
  geometry: THREE.BufferGeometry,
  mat: THREE.Material,
  x = 0,
  y = 0,
  z = 0,
): THREE.Mesh {
  const result = new THREE.Mesh(geometry, mat);
  result.position.set(x, y, z);
  result.castShadow = true;
  parent.add(result);
  return result;
}
interface FighterView {
  root: THREE.Group;
  right: THREE.Group;
  left: THREE.Group;
  legs: THREE.Group[];
  effects: SpiritWaveView;
  simulation: CombatSimulation | null;
  generation: number;
  label: HTMLDivElement;
}

/** Ten articulated, visible actors. Shared geometry/materials stay allocated across benchmark runs. */
export class CrowdView {
  private group = new THREE.Group();
  private fighters: FighterView[] = [];
  private slimes: { root: THREE.Group; body: THREE.Mesh; material: THREE.MeshStandardMaterial }[] =
    [];
  private projected = new THREE.Vector3();
  constructor(
    private scene: THREE.Scene,
    private camera: THREE.Camera,
    private crowd: CrowdSimulation,
    host: HTMLElement,
  ) {
    scene.add(this.group);
    const skin = material('#b58a68'),
      steel = material('#80969e', 0.65),
      leather = material('#42372e'),
      gold = material('#bda260', 0.5);
    const white = material('#f4f2dd'),
      dark = material('#183527');
    const head = new THREE.SphereGeometry(0.16, 14, 10);
    const torso = new THREE.BoxGeometry(0.44, 0.54, 0.25);
    const arm = new THREE.CapsuleGeometry(0.075, 0.4, 4, 8);
    const leg = new THREE.CapsuleGeometry(0.085, 0.55, 4, 8);
    const foot = new THREE.BoxGeometry(0.17, 0.13, 0.3);
    const hand = new THREE.SphereGeometry(0.085, 10, 8);
    const blade = new THREE.ConeGeometry(0.052, 1, 4);
    const grip = new THREE.CylinderGeometry(0.03, 0.03, 0.2, 8);
    const guard = new THREE.BoxGeometry(0.28, 0.04, 0.06);
    const colors = [
      '#376b75',
      '#76504c',
      '#526b41',
      '#70638b',
      '#a37342',
      '#46756a',
      '#786b50',
      '#566788',
      '#7c5267',
      '#4b7454',
    ];
    for (let i = 0; i < 10; i++) {
      const root = new THREE.Group(),
        right = new THREE.Group(),
        left = new THREE.Group();
      const cloth = material(colors[i]);
      mesh(root, torso, cloth, 0, 1.15, 0);
      mesh(root, new THREE.BoxGeometry(0.38, 0.3, 0.28), steel, 0, 1.28, 0);
      mesh(root, head, skin, 0, 1.65, 0);
      mesh(
        root,
        new THREE.SphereGeometry(0.17, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.52),
        leather,
        0,
        1.69,
        0,
      );
      mesh(root, new THREE.BoxGeometry(0.15, 0.035, 0.015), dark, 0, 1.67, -0.151);
      const legs: THREE.Group[] = [];
      for (const side of [-1, 1]) {
        const pivot = new THREE.Group();
        pivot.position.set(side * 0.13, 0.91, 0);
        root.add(pivot);
        mesh(pivot, leg, cloth, 0, -0.36, 0);
        mesh(pivot, foot, leather, 0, -0.76, -0.055);
        legs.push(pivot);
      }
      right.position.set(0.3, 1.4, 0);
      left.position.set(-0.3, 1.4, 0);
      root.add(right, left);
      mesh(right, arm, steel, 0, -0.24, 0);
      mesh(right, hand, leather, 0, -0.52, 0);
      mesh(left, arm, cloth, 0, -0.24, 0);
      mesh(left, hand, skin, 0, -0.52, 0);
      // The weapon's local +Y matches the first-person skill effects.
      const weapon = new THREE.Group();
      weapon.position.set(0, -0.52, -0.05);
      weapon.rotation.x = -Math.PI / 2;
      right.add(weapon);
      mesh(weapon, grip, leather, 0, 0, 0);
      mesh(weapon, guard, gold, 0, 0.1, 0);
      mesh(weapon, blade, steel, 0, 0.61, 0);
      const effects = new SpiritWaveView(scene, weapon, crowd.bots[i].combat, false);
      const label = document.createElement('div');
      label.className = 'farm-label';
      label.textContent = `นักดาบ ${String(i + 1).padStart(2, '0')}`;
      host.appendChild(label);
      this.group.add(root);
      this.fighters.push({
        root,
        right,
        left,
        legs,
        effects,
        simulation: null,
        generation: -1,
        label,
      });
    }
    const jellyGeometry = new THREE.SphereGeometry(0.76, 20, 14);
    const eyeGeometry = new THREE.SphereGeometry(0.12, 10, 8);
    const pupilGeometry = new THREE.SphereGeometry(0.055, 8, 6);
    for (let i = 0; i < 30; i++) {
      const root = new THREE.Group();
      const jelly = new THREE.MeshStandardMaterial({
        color: '#7ec84f',
        roughness: 0.24,
        metalness: 0.05,
      });
      const body = mesh(root, jellyGeometry, jelly, 0, 0.65, 0);
      body.scale.set(1, 0.75, 1);
      for (const side of [-1, 1]) {
        mesh(body, eyeGeometry, white, side * 0.25, 0.1, 0.65);
        mesh(body, pupilGeometry, dark, side * 0.25, 0.1, 0.735);
      }
      this.group.add(root);
      this.slimes.push({ root, body, material: jelly });
    }
    this.setVisible(false);
  }
  setVisible(value: boolean): void {
    this.group.visible = value;
    if (!value)
      for (const view of this.fighters) {
        view.effects.reset();
        view.simulation = null;
        view.label.hidden = true;
      }
  }
  update(): void {
    for (let i = 0; i < this.fighters.length; i++) {
      const view = this.fighters[i],
        bot: FarmBot | undefined = this.crowd.bots[i];
      view.root.visible = !!bot;
      if (!bot) {
        if (view.simulation) view.effects.reset();
        view.simulation = null;
        view.label.hidden = true;
        continue;
      }
      if (view.simulation !== bot.combat || view.generation !== bot.generation) {
        view.effects.bind(bot.combat);
        view.simulation = bot.combat;
        view.generation = bot.generation;
      }
      const sim = bot.combat,
        alive = sim.player.hp > 0;
      view.root.position.set(bot.position[0], 0.28, bot.position[1]);
      view.root.rotation.set(0, bot.yaw, alive ? 0 : Math.PI / 2);
      const walking = bot.moving ? Math.sin(this.crowd.world.time * 10 + bot.id) * 0.55 : 0;
      view.legs[0].rotation.x = walking;
      view.legs[1].rotation.x = -walking;
      const age = sim.time - sim.lastSwingAt;
      const slash = age >= 0 && age < 0.6 ? Math.sin(Math.min(1, age / 0.42) * Math.PI) : 0;
      const charging = sim.chargingAt !== null;
      view.right.rotation.set(
        charging ? -0.9 : -0.12 - slash * 1.3,
        slash * 0.7,
        charging ? -0.6 : -0.1 - slash * 0.8,
      );
      view.left.rotation.set(charging ? -1.1 : -walking * 0.5, 0, charging ? 0.6 : 0.12);
      view.effects.handle(bot.events);
      bot.events = [];
      view.effects.update(alive);
      this.projected.set(bot.position[0], 2.2, bot.position[1]).project(this.camera);
      view.label.hidden =
        !alive ||
        this.projected.z >= 1 ||
        Math.abs(this.projected.x) > 0.97 ||
        Math.abs(this.projected.y) > 0.94;
      if (!view.label.hidden)
        view.label.style.transform = `translate(${(this.projected.x * 0.5 + 0.5) * innerWidth}px,${(-this.projected.y * 0.5 + 0.5) * innerHeight}px) translate(-50%,-100%)`;
    }
    for (let i = 0; i < this.slimes.length; i++) {
      const slime = this.crowd.world.slimes[i],
        view = this.slimes[i];
      view.root.visible = slime.mode !== 'dead';
      if (!view.root.visible) continue;
      view.root.position.set(slime.position[0], 0.28, slime.position[1]);
      const target = this.crowd.bots.find((b) => b.targetId === slime.id) ?? this.crowd.bots[0];
      view.root.rotation.y = Math.atan2(
        target.position[0] - slime.position[0],
        target.position[1] - slime.position[1],
      );
      const squash =
        slime.mode === 'windup' ? 0.68 : 1 + Math.sin(this.crowd.world.time * 6 + i) * 0.06;
      view.body.scale.set(1 / Math.sqrt(squash), 0.75 * squash, 1 / Math.sqrt(squash));
      view.body.position.y =
        0.65 +
        (slime.mode === 'chase' ? Math.max(0, Math.sin(this.crowd.world.time * 8 + i)) * 0.23 : 0);
      view.material.color.set(slime.mode === 'windup' ? '#c7b74f' : '#7ec84f');
      view.material.emissive.set(
        this.crowd.world.time - slime.hitAt < 0.14 ? '#b5ef87' : '#000000',
      );
    }
  }
}

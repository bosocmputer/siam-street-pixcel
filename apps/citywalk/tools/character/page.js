// The page make.mjs drives: builds a design, exports it, and draws it from four sides.

import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { buildCharacter } from './build.js';
import { DESIGNS } from './designs.js';

const rig = await (await fetch('/rig.json')).json();
const W = 1600,
  Hpx = 760;
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(W, Hpx);
renderer.setPixelRatio(1);
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.append(renderer.domElement);
const built = {};

const MIXAMO = {
  Hips: 'Hips',
  Spine: 'Spine',
  Chest: 'Spine2',
  Neck: 'Neck',
  Head: 'Head',
  Shoulder_L: 'LeftShoulder',
  UpperArm_L: 'LeftArm',
  LowerArm_L: 'LeftForeArm',
  Hand_L: 'LeftHand',
  Shoulder_R: 'RightShoulder',
  UpperArm_R: 'RightArm',
  LowerArm_R: 'RightForeArm',
  Hand_R: 'RightHand',
  UpperLeg_L: 'LeftUpLeg',
  LowerLeg_L: 'LeftLeg',
  Foot_L: 'LeftFoot',
  UpperLeg_R: 'RightUpLeg',
  LowerLeg_R: 'RightLeg',
  Foot_R: 'RightFoot',
};

/**
 * A test copy that looks like a file from another program: Mixamo bone names, arms out in a
 * T-pose, and built in centimetres. The game should still stand it up and animate it.
 */
function mixamoLike(root) {
  root.traverse((o) => {
    if (MIXAMO[o.name]) o.name = `mixamorig:${MIXAMO[o.name]}`;
  });
  root.getObjectByName('mixamorig:LeftArm').rotation.z = Math.PI / 2;
  root.getObjectByName('mixamorig:RightArm').rotation.z = -Math.PI / 2;
  root.scale.setScalar(100);
  return root;
}

function make(id, variant) {
  const c = buildCharacter(DESIGNS[id], rig);
  if (variant === 'mixamo') mixamoLike(c.root);
  built[id] = c;
  return new Promise((ok, fail) =>
    new GLTFExporter().parse(
      c.root,
      (buf) => {
        const bytes = new Uint8Array(buf);
        let s = '';
        for (let i = 0; i < bytes.length; i += 0x8000)
          s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
        ok({ glb: btoa(s), bytes: bytes.length, triangles: c.triangles });
      },
      fail,
      { binary: true },
    ),
  );
}

/** Front, three-quarter, side and back, side by side, lit like the game. */
function turnaround(id) {
  const c = built[id];
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0xb3a68c, 2.4));
  const sun = new THREE.DirectionalLight(0xfff1dc, 1.7);
  sun.position.set(2, 4, 3);
  scene.add(sun);
  const views = [0, -35, -90, 180];
  renderer.setScissorTest(true);
  renderer.setClearColor(0xeef0f6);
  renderer.clear();
  const w = W / views.length;
  views.forEach((deg, i) => {
    const holder = new THREE.Group();
    holder.add(c.root);
    holder.rotation.y = (deg * Math.PI) / 180;
    scene.add(holder);
    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.32, 32).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xc9ccd8 }),
    );
    scene.add(shadow);
    const cam = new THREE.PerspectiveCamera(16, w / Hpx, 0.1, 50);
    cam.position.set(0, 1.05, 6.6);
    cam.lookAt(0, 0.86, 0);
    renderer.setViewport(i * w, 0, w, Hpx);
    renderer.setScissor(i * w, 0, w, Hpx);
    renderer.render(scene, cam);
    scene.remove(holder, shadow);
  });
  renderer.setScissorTest(false);
}

/** A close look at the head from the front and a little to the side. */
function portrait(id) {
  const c = built[id];
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0xb3a68c, 2.4));
  const sun = new THREE.DirectionalLight(0xfff1dc, 1.7);
  sun.position.set(2, 4, 3);
  scene.add(sun);
  renderer.setScissorTest(true);
  renderer.setClearColor(0xeef0f6);
  renderer.clear();
  const w = W / 2;
  [0, -30].forEach((deg, i) => {
    const holder = new THREE.Group();
    holder.add(c.root);
    holder.rotation.y = (deg * Math.PI) / 180;
    scene.add(holder);
    const cam = new THREE.PerspectiveCamera(16, w / Hpx, 0.05, 50);
    cam.position.set(0, 1.6, 1.55);
    cam.lookAt(0, 1.555, 0);
    renderer.setViewport(i * w, 0, w, Hpx);
    renderer.setScissor(i * w, 0, w, Hpx);
    renderer.render(scene, cam);
    scene.remove(holder);
  });
  renderer.setScissorTest(false);
}

window.maker = { ready: true, designs: DESIGNS, make, turnaround, portrait };

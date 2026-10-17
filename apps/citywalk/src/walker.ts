import * as THREE from 'three';

// A simple stand-in for the player until the creator's character model arrives: a body, a head,
// a cap whose brim shows which way it faces, a shadow, and a motorbike shown when riding.

export interface Walker {
  body: THREE.Group;
  bike: THREE.Group;
  /** bounce the body while walking or running; `phase` grows with the steps */
  bob(phase: number, moving: boolean, riding: boolean): void;
}

export function makeWalker(): Walker {
  const body = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color: 0xe0773a });
  const skin = new THREE.MeshLambertMaterial({ color: 0xe9c09a });
  const dark = new THREE.MeshLambertMaterial({ color: 0x2b2f36 });
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.33, 0.7, 4, 10), shirt);
  torso.position.y = torso.userData.y = 0.95;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 12), skin);
  head.position.y = head.userData.y = 1.62;
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.06, 0.22), dark);
  cap.position.set(0, 1.79, -0.12);
  cap.userData.y = 1.79;
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.55, 20),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22 }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;
  body.add(torso, head, cap, shadow);

  const bike = new THREE.Group();
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.45, 1.7), dark);
  frame.position.y = 0.55;
  const wheelGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.14, 16);
  for (const z of [-0.7, 0.7]) {
    const w = new THREE.Mesh(wheelGeo, dark);
    w.rotation.z = Math.PI / 2;
    w.position.set(0, 0.32, z);
    bike.add(w);
  }
  bike.add(frame);
  bike.visible = false;
  body.add(bike);

  const bouncing = [torso, head, cap];
  return {
    body,
    bike,
    bob: (phase, moving, riding) => {
      const lift = moving && !riding ? Math.abs(Math.sin(phase)) * 0.12 : 0;
      for (const c of bouncing) c.position.y = (c.userData.y as number) + lift;
    },
  };
}

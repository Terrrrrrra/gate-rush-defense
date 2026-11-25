import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { GameConfig } from '../game/GameConfig.js';
import { clamp, damp } from '../utils/MathUtils.js';

/** 플레이어가 조종하는 파란 대포 */
export class PlayerCannon {
  constructor(scene) {
    const cfg = GameConfig.cannon;
    this.minX = -GameConfig.world.halfWidth + cfg.margin;
    this.maxX = GameConfig.world.halfWidth - cfg.margin;
    this.x = 0;
    this.targetX = 0;
    this.recoil = 0;
    this.squash = 0;
    this.tilt = 0;
    this.root = new THREE.Group();
    this.root.position.set(0, 0, GameConfig.world.cannonZ);
    scene.add(this.root);
    this.build();
    this._muzzleLocal = new THREE.Vector3(0, 0.95, -1.35);
  }

  build() {
    const blue = new THREE.MeshStandardMaterial({ color: 0x2f8cff, roughness: 0.38, metalness: 0.05 });
    const blueDark = new THREE.MeshStandardMaterial({ color: 0x1a5fc2, roughness: 0.45 });
    const white = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x2b3245, roughness: 0.6 });
    const gold = new THREE.MeshStandardMaterial({ color: 0xffc531, roughness: 0.35, metalness: 0.2 });

    // 받침 플랫폼
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.45, 0.22, 28), white);
    pad.position.y = 0.11;
    pad.receiveShadow = true;
    pad.castShadow = true;
    this.root.add(pad);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.32, 0.08, 8, 32), blue);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.22;
    this.root.add(ring);

    this.body = new THREE.Group();
    this.root.add(this.body);

    const chassis = new THREE.Mesh(new RoundedBoxGeometry(1.5, 0.55, 1.3, 3, 0.22), blue);
    chassis.position.y = 0.55;
    chassis.castShadow = true;
    this.body.add(chassis);

    // 바퀴
    const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.22, 20);
    const hubGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.25, 12);
    this.wheels = [];
    for (const sx of [-1, 1]) {
      for (const sz of [-0.38, 0.38]) {
        const w = new THREE.Mesh(wheelGeo, dark);
        w.rotation.z = Math.PI / 2;
        w.position.set(sx * 0.82, 0.38, sz);
        w.castShadow = true;
        const hub = new THREE.Mesh(hubGeo, gold);
        hub.rotation.z = Math.PI / 2;
        hub.position.copy(w.position);
        hub.position.x += sx * 0.02;
        this.body.add(w, hub);
        this.wheels.push(w);
      }
    }

    // 포탑 돔
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.58, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2), blueDark);
    dome.position.y = 0.8;
    dome.castShadow = true;
    this.body.add(dome);

    // 포신
    this.barrel = new THREE.Group();
    this.barrel.position.set(0, 0.95, 0);
    this.barrel.rotation.x = -0.12;
    this.body.add(this.barrel);
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.36, 1.3, 20), blue);
    tube.rotation.x = Math.PI / 2;
    tube.position.z = -0.7;
    tube.castShadow = true;
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.07, 8, 20), white);
    band.position.z = -0.45;
    const muzzle = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.11, 10, 22), white);
    muzzle.position.z = -1.33;
    const hole = new THREE.Mesh(new THREE.CircleGeometry(0.25, 18), dark);
    hole.position.z = -1.36;
    hole.rotation.y = Math.PI;
    this.barrel.add(tube, band, muzzle, hole);

    // 깃발
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.9, 6), white);
    pole.position.set(-0.55, 1.2, 0.45);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.28), new THREE.MeshStandardMaterial({ color: 0x2f8cff, side: THREE.DoubleSide }));
    flag.position.set(-0.34, 1.5, 0.45);
    this.flag = flag;
    this.body.add(pole, flag);

    this.root.traverse((o) => {
      if (o.isMesh) o.castShadow = true;
    });
    pad.castShadow = false;
  }

  reset() {
    this.x = this.targetX = 0;
    this.recoil = 0;
  }

  setTargetX(x) {
    this.targetX = clamp(x, this.minX, this.maxX);
  }

  fire() {
    this.recoil = 1;
    this.squash = 1;
  }

  /** 포구 월드 좌표 */
  getMuzzle(out) {
    return out.set(this.x, 0.95, this.root.position.z - 1.35);
  }

  update(dt, time) {
    const prev = this.x;
    this.x = damp(this.x, this.targetX, GameConfig.cannon.followSharpness, dt);
    const vel = (this.x - prev) / Math.max(dt, 1e-4);
    this.root.position.x = this.x;
    this.tilt = damp(this.tilt, clamp(-vel * 0.03, -0.25, 0.25), 12, dt);
    this.body.rotation.z = this.tilt;
    for (const w of this.wheels) w.rotation.x -= vel * dt * 2.5;

    this.recoil = Math.max(0, this.recoil - dt * 9);
    this.squash = Math.max(0, this.squash - dt * 7);
    this.barrel.position.z = this.recoil * 0.22;
    const s = 1 + Math.sin(this.squash * Math.PI) * 0.06;
    this.body.scale.set(s, 2 - s, s);
    this.flag.rotation.y = Math.sin(time * 6) * 0.25;
  }
}

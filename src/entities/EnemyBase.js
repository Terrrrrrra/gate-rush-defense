import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { clamp, easeInQuad } from '../utils/MathUtils.js';

/**
 * 기지 외형 정의. 새로운 기지 종류는 BASE_KINDS 에 빌더 함수를 추가하면 된다.
 * 빌더는 (group, mats) 를 받아 메쉬를 추가하고 { radius, hpHeight } 를 반환한다.
 */
export const BASE_KINDS = {
  castle(group, m) {
    const add = (geo, mat, x, y, z, cast = true) => {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, y, z);
      mesh.castShadow = cast;
      mesh.receiveShadow = true;
      group.add(mesh);
      return mesh;
    };
    add(new RoundedBoxGeometry(3.2, 0.35, 2.6, 2, 0.12), m.white, 0, 0.17, 0);
    add(new RoundedBoxGeometry(2.6, 1.3, 1.9, 3, 0.2), m.team, 0, 0.95, -0.1);
    // 성가퀴
    const merlon = new RoundedBoxGeometry(0.36, 0.3, 0.36, 2, 0.08);
    for (let i = 0; i < 5; i++) add(merlon, m.white, -1.05 + i * 0.525, 1.72, 0.72);
    // 중앙 탑
    add(new RoundedBoxGeometry(1.3, 1.2, 1.2, 3, 0.18), m.white, 0, 2.05, -0.3);
    add(new THREE.ConeGeometry(0.95, 1.0, 4), m.team, 0, 3.15, -0.3).rotation.y = Math.PI / 4;
    // 양쪽 원형 탑
    const towerGeo = new THREE.CylinderGeometry(0.5, 0.56, 2.1, 14);
    const roofGeo = new THREE.ConeGeometry(0.66, 0.9, 14);
    for (const sx of [-1, 1]) {
      add(towerGeo, m.white, sx * 1.35, 1.05, 0.55);
      add(roofGeo, m.team, sx * 1.35, 2.55, 0.55);
    }
    // 문
    const door = add(new THREE.CircleGeometry(0.42, 16, 0, Math.PI), m.dark, 0, 0.6, 0.86, false);
    const doorBox = add(new THREE.PlaneGeometry(0.84, 0.42), m.dark, 0, 0.4, 0.86, false);
    door.renderOrder = doorBox.renderOrder = 1;
    // 깃발
    add(new THREE.CylinderGeometry(0.035, 0.035, 0.9, 6), m.white, 0, 3.9, -0.3);
    const flag = add(new THREE.PlaneGeometry(0.6, 0.38), m.flag, 0.3, 4.15, -0.3);
    return { radius: 1.55, hpHeight: 4.6, flag };
  },
};

/** 적 기지: 체력, 피격/파괴 연출, 적 병력 생성 */
export class EnemyBase {
  constructor(scene, data, index) {
    this.data = data;
    this.index = index;
    this.team = index + 1; // 팀 0 은 플레이어
    this.name = data.name;
    this.color = new THREE.Color(data.color);
    this.maxHp = data.hp;
    this.hp = data.hp;
    this.position = new THREE.Vector3(data.x, 0, data.z);
    this.attackPoint = { x: data.x, z: data.z + 0.6 };

    this.root = new THREE.Group();
    this.root.position.copy(this.position);
    scene.add(this.root);
    this.body = new THREE.Group();
    this.root.add(this.body);

    this.mats = {
      team: new THREE.MeshStandardMaterial({ color: this.color, roughness: 0.4, emissive: 0xffffff, emissiveIntensity: 0 }),
      white: new THREE.MeshStandardMaterial({ color: 0xfbf6ee, roughness: 0.55, emissive: 0xffffff, emissiveIntensity: 0 }),
      dark: new THREE.MeshStandardMaterial({ color: 0x3a2b3f, roughness: 0.8 }),
      flag: new THREE.MeshStandardMaterial({ color: this.color, side: THREE.DoubleSide, roughness: 0.6 }),
    };
    const builder = BASE_KINDS[data.kind] ?? BASE_KINDS.castle;
    const info = builder(this.body, this.mats);
    this.radius = info.radius;
    this.flag = info.flag;
    this.hpAnchor = new THREE.Vector3(data.x, info.hpHeight, data.z);

    // 파괴 후 잔해
    this.rubble = new THREE.Group();
    const rockGeo = new THREE.DodecahedronGeometry(0.35, 0);
    for (let i = 0; i < 14; i++) {
      const r = new THREE.Mesh(rockGeo, i % 3 === 0 ? this.mats.team : this.mats.white);
      const a = Math.random() * Math.PI * 2;
      const d = Math.random() * 1.3;
      r.position.set(Math.cos(a) * d, 0.12 + Math.random() * 0.2, Math.sin(a) * d);
      r.rotation.set(Math.random() * 3, Math.random() * 3, 0);
      r.scale.setScalar(0.6 + Math.random() * 0.9);
      r.castShadow = true;
      this.rubble.add(r);
    }
    this.rubble.visible = false;
    this.root.add(this.rubble);

    this.reset();
  }

  get alive() {
    return this.hp > 0;
  }

  reset() {
    this.hp = this.maxHp;
    this.hitFlash = 0;
    this.hitPunch = 0;
    this.destroyT = -1;
    this.spawnTimer = 1.5 + this.index * 0.8;
    this.elapsed = 0;
    this.body.visible = true;
    this.body.position.set(0, 0, 0);
    this.body.rotation.set(0, 0, 0);
    this.body.scale.set(1, 1, 1);
    this.rubble.visible = false;
  }

  /** @returns {boolean} 이번 공격으로 파괴되었는지 */
  takeDamage(amount) {
    if (!this.alive) return false;
    this.hp = Math.max(0, this.hp - amount);
    this.hitFlash = 1;
    this.hitPunch = Math.min(1, this.hitPunch + 0.35);
    if (this.hp <= 0) {
      this.destroyT = 0;
      return true;
    }
    return false;
  }

  /**
   * @param {(base:EnemyBase, count:number)=>void} spawnFn 적 병력 생성 요청
   */
  update(dt, time, spawnFn) {
    this.flag.rotation.y = Math.sin(time * 5 + this.index) * 0.3;
    this.hitFlash = Math.max(0, this.hitFlash - dt * 6);
    this.hitPunch = Math.max(0, this.hitPunch - dt * 4);
    const fl = this.hitFlash * 0.55;
    this.mats.team.emissiveIntensity = fl;
    this.mats.white.emissiveIntensity = fl * 0.6;

    if (this.destroyT >= 0) {
      // 파괴 애니메이션: 흔들리며 가라앉고 찌그러진 뒤 잔해만 남는다
      this.destroyT += dt;
      const t = clamp(this.destroyT / 1.1, 0, 1);
      const e = easeInQuad(t);
      this.body.position.set(Math.sin(time * 60) * 0.12 * (1 - t), -e * 2.6, 0);
      this.body.rotation.z = Math.sin(this.index * 2 + 1) * 0.35 * e;
      this.body.scale.set(1 + e * 0.2, 1 - e * 0.65, 1 + e * 0.2);
      if (t >= 1 && this.body.visible) {
        this.body.visible = false;
        this.rubble.visible = true;
      }
      return;
    }

    const p = Math.sin(this.hitPunch * Math.PI) * 0.06;
    this.body.scale.set(1 + p, 1 - p * 0.8, 1 + p);
    this.body.position.x = (Math.random() - 0.5) * this.hitFlash * 0.08;

    // 적 병력 생성 (시간이 지날수록, 체력이 낮을수록 증가)
    this.elapsed += dt;
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      const sp = this.data.spawn;
      const rage = this.hp / this.maxHp < 0.4 ? 1.5 : 1;
      this.spawnTimer = sp.interval / rage;
      const count = Math.round(sp.count * (1 + (sp.growth * this.elapsed) / 20) * rage);
      spawnFn(this, count);
    }
  }
}

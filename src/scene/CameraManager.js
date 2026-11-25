import * as THREE from 'three';
import { GameConfig } from '../game/GameConfig.js';
import { clamp } from '../utils/MathUtils.js';

/**
 * 고정 쿼터뷰 카메라. 화면 비율에 맞춰 거리를 자동으로 조절하고 화면 흔들림을 처리한다.
 */
export class CameraManager {
  constructor() {
    const c = GameConfig.camera;
    this.camera = new THREE.PerspectiveCamera(c.fov, 1, 0.5, 120);
    this.target = new THREE.Vector3(c.target.x, c.target.y, c.target.z);
    this.basePos = new THREE.Vector3();
    this.trauma = 0;
    this.time = 0;
    this.kick = new THREE.Vector3();
  }

  resize(w, h) {
    const c = GameConfig.camera;
    const aspect = w / h;
    this.camera.aspect = aspect;
    // 세로 화면에서는 시야를 약간 넓혀 위아래 공간을 확보
    this.camera.fov = aspect < 0.7 ? c.fov + 6 : c.fov;
    this.camera.updateProjectionMatrix();

    const vfov = THREE.MathUtils.degToRad(this.camera.fov);
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * aspect);
    const pitch = THREE.MathUtils.degToRad(c.pitchDeg);
    // 가로 폭을 맞추기 위한 거리 (화면 하단 = 카메라에 가까운 쪽은 더 넓게 보이므로 중앙 기준)
    const distW = c.fitWidth / 2 / Math.tan(hfov / 2);
    // 세로 길이: 바닥 평면에 투영된 길이 ≈ 화면 높이 / sin(pitch)
    const distL = (c.fitLength * Math.sin(pitch)) / 2 / Math.tan(vfov / 2);
    const dist = clamp(Math.max(distW, distL), 18, 60);

    this.basePos.set(
      this.target.x,
      this.target.y + Math.sin(pitch) * dist,
      this.target.z + Math.cos(pitch) * dist
    );
    // 매우 세로로 긴 화면에서는 타겟을 살짝 아래(플레이어 쪽)로 내린다
    this.camera.position.copy(this.basePos);
    this.camera.lookAt(this.target);
  }

  shake(amount) {
    this.trauma = Math.min(GameConfig.effects.maxShake * 2, this.trauma + amount);
  }

  punch(x, y, z) {
    this.kick.set(x, y, z);
  }

  update(dt) {
    this.time += dt;
    this.trauma = Math.max(0, this.trauma - GameConfig.effects.shakeDecay * dt);
    const s = Math.min(this.trauma, GameConfig.effects.maxShake);
    const k = s * s;
    const t = this.time * 38;
    this.kick.multiplyScalar(Math.exp(-12 * dt));
    this.camera.position.set(
      this.basePos.x + Math.sin(t * 1.1) * k * 0.9 + this.kick.x,
      this.basePos.y + Math.sin(t * 1.7 + 1) * k * 0.6 + this.kick.y,
      this.basePos.z + Math.cos(t * 1.3) * k * 0.6 + this.kick.z
    );
    this.camera.lookAt(this.target);
  }
}

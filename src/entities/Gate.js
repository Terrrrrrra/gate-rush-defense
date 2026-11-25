import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { GameConfig } from '../game/GameConfig.js';
import { TEAM_PLAYER, STATE_WALK } from './UnitManager.js';
import { rand } from '../utils/MathUtils.js';

/** 배율 → 게이트 색상 */
const TIER_COLORS = { 2: 0x2fd47a, 3: 0x1fc2e8, 4: 0x3ea0ff, 5: 0x4f6dff, 7: 0xffa51f, 10: 0xff4fb0 };

/**
 * 게이트 종류 정의. 새로운 게이트는 여기에 추가한다.
 * clonesFor(gate): 유닛 1명이 통과할 때 추가로 생성할 병력 수
 */
export const GATE_TYPES = {
  multiply: {
    label: (v) => `x${v}`,
    color: (v) => TIER_COLORS[v] ?? 0x3ea0ff,
    clonesFor: (gate) => gate.value - 1,
  },
  add: {
    label: (v) => `+${v}`,
    color: () => 0x2fd4b4,
    // 일정 시간마다 첫 통과 유닛에게만 +value 를 부여 (그룹 단위 덧셈)
    clonesFor: (gate) => {
      if (gate.cooldown > 0) return 0;
      gate.cooldown = 1.0;
      return gate.value;
    },
  },
};

// 공유 지오메트리 / 머티리얼
let shared = null;
function getShared() {
  if (shared) return shared;
  shared = {
    post: new THREE.CapsuleGeometry(0.17, 1.5, 4, 12),
    beam: new RoundedBoxGeometry(1, 0.32, 0.36, 2, 0.12),
    panel: new THREE.BoxGeometry(1, 1.45, 0.06),
    textPlane: new THREE.PlaneGeometry(1, 0.5),
    postMat: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35 }),
    baseGeo: new RoundedBoxGeometry(0.5, 0.2, 0.5, 2, 0.08),
  };
  return shared;
}

function makeLabelTexture(text, color) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 256, 128);
  ctx.font = '900 96px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 14;
  ctx.strokeStyle = '#' + new THREE.Color(color).multiplyScalar(0.55).getHexString();
  ctx.strokeText(text, 128, 70);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(text, 128, 70);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** 단일 증식 게이트 */
export class Gate {
  constructor(scene, data, index) {
    const type = GATE_TYPES[data.type];
    if (!type) throw new Error(`Unknown gate type: ${data.type}`);
    this.data = data;
    this.type = type;
    this.index = index;
    this.bit = 1 << index;
    this.value = data.value;
    this.width = data.width;
    this.baseX = data.x;
    this.x = data.x;
    this.z = data.z;
    this.flash = 0;
    this.cooldown = 0;
    this.pending = 0; // UI 표시용 누적 증가량
    this.popupTimer = 0;
    this.color = new THREE.Color(type.color(data.value));

    const s = getShared();
    this.root = new THREE.Group();
    this.root.position.set(this.x, 0, this.z);
    scene.add(this.root);

    const w = this.width;
    for (const sx of [-1, 1]) {
      const post = new THREE.Mesh(s.post, s.postMat);
      post.position.set((sx * w) / 2, 0.92, 0);
      post.castShadow = true;
      const foot = new THREE.Mesh(s.baseGeo, s.postMat);
      foot.position.set((sx * w) / 2, 0.1, 0);
      foot.castShadow = true;
      this.root.add(post, foot);
    }
    this.beamMat = new THREE.MeshStandardMaterial({ color: this.color, roughness: 0.35, emissive: this.color, emissiveIntensity: 0.25 });
    const beam = new THREE.Mesh(s.beam, this.beamMat);
    beam.scale.x = w + 0.3;
    beam.position.y = 1.78;
    beam.castShadow = true;
    this.root.add(beam);

    this.panelMat = new THREE.MeshStandardMaterial({
      color: this.color,
      emissive: this.color,
      emissiveIntensity: 0.35,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      roughness: 0.2,
    });
    this.panel = new THREE.Mesh(s.panel, this.panelMat);
    this.panel.scale.x = w - 0.2;
    this.panel.position.y = 0.92;
    this.panel.renderOrder = 2;
    this.root.add(this.panel);

    this.label = new THREE.Mesh(
      s.textPlane,
      new THREE.MeshBasicMaterial({ map: makeLabelTexture(type.label(data.value), this.color), transparent: true, depthWrite: false })
    );
    const ls = Math.min(3.0, w * 0.95);
    this.label.scale.set(ls, ls, 1);
    this.label.position.set(0, 0.95, 0.12);
    this.label.rotation.x = -0.55; // 카메라 쪽으로 기울여 가독성 확보
    this.label.renderOrder = 3;
    this.root.add(this.label);
  }

  update(dt, time) {
    const m = this.data.move;
    if (m) this.x = this.baseX + Math.sin(time * m.speed * Math.PI * 2) * m.amplitude;
    this.root.position.x = this.x;
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.flash = Math.max(0, this.flash - dt * 3);
    const pulse = 0.35 + Math.sin(time * 4 + this.index) * 0.08;
    this.panelMat.emissiveIntensity = pulse + this.flash * 1.6;
    this.panelMat.opacity = 0.55 + this.flash * 0.3;
    this.beamMat.emissiveIntensity = 0.25 + this.flash * 1.2;
    const sc = 1 + this.flash * 0.08;
    this.root.scale.set(sc, sc, sc);
    this.label.position.y = 0.95 + Math.sin(time * 3 + this.index) * 0.05;
  }
}

/** 게이트 목록을 관리하고 병력 통과(증식) 판정을 처리한다. */
export class GateManager {
  constructor(scene, gateData) {
    if (gateData.length > 32) throw new Error('게이트는 레벨당 최대 32개');
    this.gates = gateData.map((d, i) => new Gate(scene, d, i));
    /** (gate, x, z, added) */
    this.onPass = null;
  }

  reset() {
    for (const g of this.gates) {
      g.flash = 0;
      g.pending = 0;
      g.cooldown = 0;
    }
  }

  update(dt, time, um) {
    const U = GameConfig.unit;
    for (const g of this.gates) {
      g.update(dt, time);
      g.popupTimer -= dt;
    }
    const n = um.count; // 이번 프레임에 생성되는 복제 병력은 다음 프레임부터 판정
    const { x, z, prevZ, team, state, delay, mask } = um;
    for (let gi = 0; gi < this.gates.length; gi++) {
      const g = this.gates[gi];
      const half = g.width / 2 - 0.1;
      const gz = g.z;
      for (let i = 0; i < n; i++) {
        if (team[i] !== TEAM_PLAYER || state[i] !== STATE_WALK || delay[i] > 0) continue;
        if (mask[i] & g.bit) continue;
        if (!(prevZ[i] > gz && z[i] <= gz)) continue;
        if (Math.abs(x[i] - g.x) > half) continue;
        mask[i] |= g.bit;
        um.flash[i] = 1;
        const want = g.type.clonesFor(g);
        const room = um.playerRoom();
        const clones = Math.min(want, room);
        for (let c = 0; c < clones; c++) {
          const a = rand(-Math.PI, Math.PI);
          const r = rand(0.1, 0.55);
          const cx = Math.min(Math.max(x[i] + Math.cos(a) * r, g.x - half), g.x + half);
          const j = um.spawn(TEAM_PLAYER, cx, gz - 0.15 - Math.random() * 0.35, Math.cos(a) * 1.6, um.vz[i] - 0.6, {
            mask: mask[i],
            delay: c * U.cloneStagger + Math.random() * 0.03,
            flash: 1,
            speed: um.speed[i],
          });
          if (j < 0) break;
        }
        g.flash = 1;
        g.pending += clones;
        this.onPass?.(g, x[i], gz, clones);
      }
    }
  }
}

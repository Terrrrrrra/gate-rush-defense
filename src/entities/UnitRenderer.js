import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

function paint(geo, hex) {
  const c = new THREE.Color(hex);
  const n = geo.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    arr[i * 3] = c.r;
    arr[i * 3 + 1] = c.g;
    arr[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
}

/**
 * 귀여운 병력 캐릭터 모델 (몸통 1 + 다리 2).
 * 몸통의 흰 부분은 instanceColor(팀 색) 로 물들고, 눈 같은 어두운 부분은 그대로 유지된다.
 */
function createBodyGeometry() {
  const parts = [];
  const body = new THREE.CapsuleGeometry(0.21, 0.2, 3, 10);
  body.translate(0, 0.56, 0);
  parts.push(paint(body, 0xffffff));

  const belly = new THREE.SphereGeometry(0.15, 8, 5);
  belly.scale(1, 1.05, 0.55);
  belly.translate(0, 0.46, 0.12);
  parts.push(paint(belly, 0xe8f0ff));

  for (const sx of [-1, 1]) {
    const eye = new THREE.SphereGeometry(0.045, 6, 4);
    eye.scale(1, 1.3, 0.6);
    eye.translate(sx * 0.08, 0.66, 0.19);
    parts.push(paint(eye, 0x141824));
    const shine = new THREE.SphereGeometry(0.016, 4, 3);
    shine.translate(sx * 0.08 + 0.012, 0.685, 0.215);
    parts.push(paint(shine, 0xffffff));
    const arm = new THREE.SphereGeometry(0.075, 6, 4);
    arm.scale(0.9, 1.25, 0.9);
    arm.translate(sx * 0.235, 0.48, 0.02);
    parts.push(paint(arm, 0xffffff));
  }
  // 머리 장식 (작은 뿔/안테나)
  const tuft = new THREE.ConeGeometry(0.06, 0.12, 6);
  tuft.translate(0, 0.89, 0);
  parts.push(paint(tuft, 0xffffff));

  const merged = mergeGeometries(parts.map((g) => g.toNonIndexed()));
  merged.computeVertexNormals();
  return merged;
}

function createLegGeometry() {
  const leg = new THREE.CapsuleGeometry(0.07, 0.1, 2, 6);
  leg.translate(0, -0.12, 0); // 회전축(엉덩이) 을 원점에
  return paint(leg, 0x9aa3b8);
}

export const HIP_Y = 0.3;
export const HIP_X = 0.095;

/**
 * 모든 팀의 병력을 InstancedMesh 3개(몸통, 왼다리, 오른다리)로 렌더링한다.
 * 행렬은 Object3D 없이 instanceMatrix.array 에 직접 기록한다.
 */
export class UnitRenderer {
  constructor(scene, capacity, quality) {
    this.capacity = capacity;
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.42, metalness: 0.02 });
    this.body = new THREE.InstancedMesh(createBodyGeometry(), mat, capacity);
    this.body.castShadow = true;
    this.body.frustumCulled = false;
    this.body.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.body.setColorAt(0, new THREE.Color(1, 1, 1));
    this.body.instanceColor.setUsage(THREE.DynamicDrawUsage);

    const legMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5 });
    this.legs = new THREE.InstancedMesh(createLegGeometry(), legMat, capacity * 2);
    this.legs.frustumCulled = false;
    this.legs.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.legs.setColorAt(0, new THREE.Color(1, 1, 1));
    this.legs.instanceColor.setUsage(THREE.DynamicDrawUsage);

    this.body.count = 0;
    this.legs.count = 0;
    scene.add(this.body, this.legs);
    this.setQuality(quality);
  }

  setQuality(q) {
    this.showLegs = q.legs;
    this.legs.visible = q.legs;
    this.legs.castShadow = false;
    this.body.castShadow = q.unitShadows;
  }

  /**
   * @param {import('./UnitManager.js').UnitManager} um
   */
  sync(um, teamColors) {
    const n = um.count;
    const bm = this.body.instanceMatrix.array;
    const bc = this.body.instanceColor.array;
    const lm = this.legs.instanceMatrix.array;
    const lc = this.legs.instanceColor.array;
    const showLegs = this.showLegs;
    const { x, y, z, heading, scale, squash, walk, team, flash } = um;

    for (let i = 0; i < n; i++) {
      const s = scale[i];
      const sy = s * squash[i];
      const cy = Math.cos(heading[i]);
      const sn = Math.sin(heading[i]);
      const px = x[i];
      const py = y[i];
      const pz = z[i];
      const o = i * 16;
      // 몸통: T * Ry * S(s, sy, s)
      bm[o] = cy * s; bm[o + 1] = 0; bm[o + 2] = -sn * s; bm[o + 3] = 0;
      bm[o + 4] = 0; bm[o + 5] = sy; bm[o + 6] = 0; bm[o + 7] = 0;
      bm[o + 8] = sn * s; bm[o + 9] = 0; bm[o + 10] = cy * s; bm[o + 11] = 0;
      bm[o + 12] = px; bm[o + 13] = py; bm[o + 14] = pz; bm[o + 15] = 1;

      const tc = teamColors[team[i]];
      const f = flash[i];
      const c3 = i * 3;
      bc[c3] = tc.r + (1 - tc.r) * f;
      bc[c3 + 1] = tc.g + (1 - tc.g) * f;
      bc[c3 + 2] = tc.b + (1 - tc.b) * f;

      if (showLegs) {
        const w = walk[i];
        for (let k = 0; k < 2; k++) {
          const a = k === 0 ? w : -w;
          const ca = Math.cos(a);
          const sa = Math.sin(a);
          const hx = (k === 0 ? -HIP_X : HIP_X) * s;
          const hy = HIP_Y * sy;
          const lo = (i * 2 + k) * 16;
          // R = Ry * Rx(a), 스케일 s
          lm[lo] = cy * s; lm[lo + 1] = 0; lm[lo + 2] = -sn * s; lm[lo + 3] = 0;
          lm[lo + 4] = sn * sa * s; lm[lo + 5] = ca * s; lm[lo + 6] = cy * sa * s; lm[lo + 7] = 0;
          lm[lo + 8] = sn * ca * s; lm[lo + 9] = -sa * s; lm[lo + 10] = cy * ca * s; lm[lo + 11] = 0;
          lm[lo + 12] = px + cy * hx; lm[lo + 13] = py + hy; lm[lo + 14] = pz - sn * hx; lm[lo + 15] = 1;
          const l3 = (i * 2 + k) * 3;
          lc[l3] = tc.r * 0.75; lc[l3 + 1] = tc.g * 0.75; lc[l3 + 2] = tc.b * 0.75;
        }
      }
    }
    this.body.count = n;
    this.body.instanceMatrix.needsUpdate = true;
    this.body.instanceColor.needsUpdate = true;
    if (showLegs) {
      this.legs.count = n * 2;
      this.legs.instanceMatrix.needsUpdate = true;
      this.legs.instanceColor.needsUpdate = true;
    }
  }
}

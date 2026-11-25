import * as THREE from 'three';
import { ObjectPool } from './ObjectPool.js';

/**
 * InstancedMesh 하나로 그리는 고정 용량 파티클 시스템 (고정 배열 = 풀).
 */
export class ParticleSystem {
  constructor(scene, capacity, geometry, material) {
    this.capacity = capacity;
    this.limit = capacity;
    this.count = 0;
    const F = () => new Float32Array(capacity);
    this.px = F(); this.py = F(); this.pz = F();
    this.vx = F(); this.vy = F(); this.vz = F();
    this.life = F(); this.maxLife = F();
    this.size = F(); this.rot = F(); this.spin = F();
    this.gravity = F(); this.drag = F();
    this.cr = F(); this.cg = F(); this.cb = F();
    this.grow = new Uint8Array(capacity);

    this.mesh = new THREE.InstancedMesh(geometry, material, capacity);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.setColorAt(0, new THREE.Color());
    this.mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    scene.add(this.mesh);
    this._c = new THREE.Color();
  }

  setLimit(n) {
    this.limit = Math.min(n, this.capacity);
  }

  clear() {
    this.count = 0;
    this.mesh.count = 0;
  }

  /**
   * opts: { color, speed, up, life, size, gravity, spread, drag, colors, grow }
   */
  emit(x, y, z, n, o) {
    const c = this._c;
    for (let k = 0; k < n; k++) {
      if (this.count >= this.limit) return;
      const i = this.count++;
      const a = Math.random() * Math.PI * 2;
      const sp = (o.speed ?? 3) * (0.4 + Math.random() * 0.8);
      const spread = o.spread ?? 1;
      this.px[i] = x + (Math.random() - 0.5) * (o.jitter ?? 0.2);
      this.py[i] = y;
      this.pz[i] = z + (Math.random() - 0.5) * (o.jitter ?? 0.2);
      this.vx[i] = Math.cos(a) * sp * spread;
      this.vz[i] = Math.sin(a) * sp * spread;
      this.vy[i] = (o.up ?? 3) * (0.6 + Math.random() * 0.7);
      const life = (o.life ?? 0.6) * (0.7 + Math.random() * 0.6);
      this.life[i] = life;
      this.maxLife[i] = life;
      this.size[i] = (o.size ?? 0.15) * (0.6 + Math.random() * 0.8);
      this.rot[i] = Math.random() * 6.28;
      this.spin[i] = (Math.random() - 0.5) * 12;
      this.gravity[i] = o.gravity ?? 12;
      this.drag[i] = o.drag ?? 1.5;
      this.grow[i] = o.grow ? 1 : 0;
      c.set(o.colors ? o.colors[(Math.random() * o.colors.length) | 0] : o.color ?? 0xffffff);
      this.cr[i] = c.r; this.cg[i] = c.g; this.cb[i] = c.b;
    }
  }

  update(dt) {
    let n = this.count;
    let i = 0;
    while (i < n) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        n--;
        if (i !== n) this.copy(n, i);
        continue;
      }
      const d = Math.exp(-this.drag[i] * dt);
      this.vx[i] *= d; this.vz[i] *= d;
      this.vy[i] -= this.gravity[i] * dt;
      this.px[i] += this.vx[i] * dt;
      this.py[i] += this.vy[i] * dt;
      this.pz[i] += this.vz[i] * dt;
      if (this.py[i] < 0.05 && this.gravity[i] > 0) {
        this.py[i] = 0.05;
        this.vy[i] *= -0.35;
        this.vx[i] *= 0.6; this.vz[i] *= 0.6;
      }
      this.rot[i] += this.spin[i] * dt;
      i++;
    }
    this.count = n;

    const m = this.mesh.instanceMatrix.array;
    const col = this.mesh.instanceColor.array;
    for (let j = 0; j < n; j++) {
      const t = this.life[j] / this.maxLife[j];
      const s = this.size[j] * (this.grow[j] ? 0.5 + (1 - t) * 1.5 : Math.min(1, t * 2.5));
      const r = this.rot[j];
      const cy = Math.cos(r) * s;
      const sy = Math.sin(r) * s;
      const ca = Math.cos(r * 0.7);
      const sa = Math.sin(r * 0.7);
      const o = j * 16;
      m[o] = cy; m[o + 1] = 0; m[o + 2] = -sy; m[o + 3] = 0;
      m[o + 4] = sy * sa; m[o + 5] = ca * s; m[o + 6] = cy * sa; m[o + 7] = 0;
      m[o + 8] = sy * ca; m[o + 9] = -sa * s; m[o + 10] = cy * ca; m[o + 11] = 0;
      m[o + 12] = this.px[j]; m[o + 13] = this.py[j]; m[o + 14] = this.pz[j]; m[o + 15] = 1;
      const c3 = j * 3;
      col[c3] = this.cr[j]; col[c3 + 1] = this.cg[j]; col[c3 + 2] = this.cb[j];
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor.needsUpdate = true;
  }

  copy(f, t) {
    this.px[t] = this.px[f]; this.py[t] = this.py[f]; this.pz[t] = this.pz[f];
    this.vx[t] = this.vx[f]; this.vy[t] = this.vy[f]; this.vz[t] = this.vz[f];
    this.life[t] = this.life[f]; this.maxLife[t] = this.maxLife[f];
    this.size[t] = this.size[f]; this.rot[t] = this.rot[f]; this.spin[t] = this.spin[f];
    this.gravity[t] = this.gravity[f]; this.drag[t] = this.drag[f];
    this.cr[t] = this.cr[f]; this.cg[t] = this.cg[f]; this.cb[t] = this.cb[f];
    this.grow[t] = this.grow[f];
  }
}

/** 바닥에 퍼지는 충격파 링 (메쉬 풀) */
export class RingEffects {
  constructor(scene, initial = 10) {
    const geo = new THREE.RingGeometry(0.75, 1, 40);
    geo.rotateX(-Math.PI / 2);
    this.pool = new ObjectPool(
      () => {
        const mesh = new THREE.Mesh(
          geo,
          new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, side: THREE.DoubleSide })
        );
        mesh.renderOrder = 4;
        mesh.visible = false;
        scene.add(mesh);
        return { mesh, t: 0, dur: 0.5, size: 2 };
      },
      (r) => {
        r.mesh.visible = false;
      },
      initial
    );
  }

  spawn(x, y, z, color, size = 2, dur = 0.5) {
    const r = this.pool.acquire();
    r.t = 0;
    r.dur = dur;
    r.size = size;
    r.mesh.position.set(x, y, z);
    r.mesh.material.color.set(color);
    r.mesh.visible = true;
  }

  update(dt) {
    this.pool.updateActive((r) => {
      r.t += dt;
      const k = r.t / r.dur;
      if (k >= 1) return false;
      const s = 0.2 + r.size * (1 - Math.pow(1 - k, 3));
      r.mesh.scale.set(s, 1, s);
      r.mesh.material.opacity = 1 - k;
      return true;
    });
  }

  clear() {
    this.pool.releaseAll();
  }
}

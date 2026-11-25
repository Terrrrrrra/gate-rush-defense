import { GameConfig } from '../game/GameConfig.js';
import { clamp, easeOutBack } from '../utils/MathUtils.js';

export const TEAM_PLAYER = 0;
export const STATE_WALK = 0;
export const STATE_ATTACK = 1;
export const STATE_DEAD = 2;

const CELL = 0.6;
const GX0 = -6.5;
const GZ0 = -24;
const GCOLS = Math.ceil(13 / CELL);
const GROWS = Math.ceil(44 / CELL);

/**
 * 모든 병력(아군/적군)을 구조체 배열(SoA, TypedArray)로 관리한다.
 * - 개별 Mesh/Rigidbody 없이 위치·속도를 직접 계산
 * - 공간 해시 그리드로 이웃 탐색 → 군집 분리(separation) + 아군/적군 충돌 처리
 * - 사망 시 swap-remove 로 배열을 압축해 프레임마다 할당이 발생하지 않는다.
 */
export class UnitManager {
  constructor(capacity) {
    this.capacity = capacity;
    this.limit = capacity;
    this.count = 0;
    const F = () => new Float32Array(capacity);
    this.x = F(); this.y = F(); this.z = F();
    this.prevZ = F();
    this.vx = F(); this.vz = F();
    this.heading = F();
    this.scale = F();
    this.baseScale = F();
    this.squash = F();
    this.walk = F();
    this.phase = F();
    this.age = F();
    this.delay = F();
    this.timer = F();
    this.flash = F();
    this.speed = F();
    this.ax = F(); this.az = F(); // 공격 시작 위치
    this.pushX = F(); this.pushZ = F();
    this.team = new Uint8Array(capacity);
    this.state = new Uint8Array(capacity);
    this.target = new Int8Array(capacity);
    this.mask = new Uint32Array(capacity);

    this.cellHead = new Int32Array(GCOLS * GROWS);
    this.cellNext = new Int32Array(capacity);
    this.teamCounts = new Int32Array(8);

    /** (x, z, teamA, teamB) 아군·적군 충돌 시 호출 */
    this.onClash = null;
  }

  setLimit(limit) {
    this.limit = Math.min(limit, this.capacity);
  }

  clear() {
    this.count = 0;
    this.teamCounts.fill(0);
  }

  countTeam(team) {
    return this.teamCounts[team];
  }

  /** 아군 병력이 추가로 생성 가능한 수 (적군 몫을 일부 남겨둔다) */
  playerRoom() {
    const enemyReserve = Math.floor(this.limit * 0.3);
    const enemies = this.count - this.teamCounts[TEAM_PLAYER];
    return Math.max(0, this.limit - Math.max(enemies, enemyReserve) - this.teamCounts[TEAM_PLAYER]);
  }

  enemyRoom() {
    const cap = Math.floor(this.limit * 0.45);
    const enemies = this.count - this.teamCounts[TEAM_PLAYER];
    return Math.max(0, Math.min(cap - enemies, this.limit - this.count));
  }

  spawn(team, x, z, vx, vz, opts = undefined) {
    if (this.count >= this.limit) return -1;
    const i = this.count++;
    this.x[i] = x; this.y[i] = 0; this.z[i] = z; this.prevZ[i] = z;
    this.vx[i] = vx; this.vz[i] = vz;
    this.heading[i] = Math.atan2(vx, vz);
    this.baseScale[i] = opts?.scale ?? 1;
    this.scale[i] = 0;
    this.squash[i] = 1;
    this.walk[i] = 0;
    this.phase[i] = Math.random() * 6.28;
    this.age[i] = 0;
    this.delay[i] = opts?.delay ?? 0;
    this.timer[i] = 0;
    this.flash[i] = opts?.flash ?? 0;
    this.speed[i] = opts?.speed ?? GameConfig.unit.speed;
    this.team[i] = team;
    this.state[i] = STATE_WALK;
    this.target[i] = -1;
    this.mask[i] = opts?.mask ?? 0;
    this.teamCounts[team]++;
    return i;
  }

  kill(i) {
    if (this.state[i] === STATE_DEAD) return;
    this.state[i] = STATE_DEAD;
    this.teamCounts[this.team[i]]--;
  }

  isActive(i) {
    return this.state[i] === STATE_WALK && this.delay[i] <= 0;
  }

  /**
   * 이동/조향/애니메이션
   * steer: { cannonX, playerTarget(i) -> {x,z}|null, attackPoint(baseIndex) -> {x,z} }
   */
  integrate(dt, steer) {
    const U = GameConfig.unit;
    const hw = GameConfig.world.halfWidth - 0.3;
    const n = this.count;
    const { x, y, z, vx, vz } = this;
    const k = 1 - Math.exp(-5 * dt);
    for (let i = 0; i < n; i++) {
      const st = this.state[i];
      if (st === STATE_DEAD) continue;
      if (this.delay[i] > 0) {
        this.delay[i] -= dt;
        this.scale[i] = 0;
        this.prevZ[i] = z[i];
        continue;
      }
      this.age[i] += dt;
      if (this.flash[i] > 0) this.flash[i] = Math.max(0, this.flash[i] - dt * 2.5);
      const pop = this.age[i] / U.spawnPopTime;
      this.scale[i] = this.baseScale[i] * (pop < 1 ? easeOutBack(pop) : 1);
      this.prevZ[i] = z[i];

      if (st === STATE_ATTACK) {
        // 기지로 뛰어올라 내리찍는 공격 모션
        this.timer[i] += dt;
        const t = clamp(this.timer[i] / U.attackTime, 0, 1);
        const tgt = steer.attackPoint(this.target[i]);
        x[i] = this.ax[i] + (tgt.x - this.ax[i]) * t;
        z[i] = this.az[i] + (tgt.z - this.az[i]) * t;
        y[i] = Math.sin(t * Math.PI) * 1.2;
        this.squash[i] = 1 + Math.sin(t * Math.PI * 2) * 0.18;
        this.walk[i] = 1.0;
        continue;
      }

      // 원하는 이동 방향
      let dx = 0;
      let dz = -1;
      const sp = this.speed[i];
      if (this.team[i] === TEAM_PLAYER) {
        if (z[i] < U.steerZ) {
          const tgt = steer.playerTarget(i);
          if (tgt) {
            dx = tgt.x - x[i];
            dz = tgt.z - z[i];
            const l = Math.hypot(dx, dz) || 1;
            dx /= l;
            dz /= l;
          } else {
            // 모든 기지 파괴: 카메라를 바라보며 제자리 만세 점프
            vx[i] *= 0.9;
            vz[i] *= 0.9;
            this.phase[i] += dt * 7;
            y[i] = Math.abs(Math.sin(this.phase[i])) * 0.45;
            this.squash[i] = 1 + Math.cos(this.phase[i] * 2) * 0.08;
            this.walk[i] = 0.5;
            this.heading[i] += (0 - this.heading[i]) * Math.min(1, dt * 6);
            continue;
          }
        }
      } else {
        dz = 1;
        dx = (steer.cannonX - x[i]) * 0.04;
      }
      vx[i] += (dx * sp - vx[i]) * k;
      vz[i] += (dz * sp - vz[i]) * k;
      x[i] += vx[i] * dt;
      z[i] += vz[i] * dt;
      if (x[i] < -hw) {
        x[i] = -hw;
        vx[i] = Math.abs(vx[i]) * 0.3;
      } else if (x[i] > hw) {
        x[i] = hw;
        vx[i] = -Math.abs(vx[i]) * 0.3;
      }

      // 걷기 애니메이션 (다리 스윙 + 통통 튀는 몸통)
      const v = Math.hypot(vx[i], vz[i]);
      this.phase[i] += dt * (6 + v * 2.6);
      const ph = this.phase[i];
      this.walk[i] = Math.sin(ph) * 0.75;
      y[i] = Math.abs(Math.cos(ph)) * 0.07;
      this.squash[i] = 1 + Math.sin(ph * 2) * 0.045;
      const targetHeading = Math.atan2(vx[i], vz[i]);
      let dh = targetHeading - this.heading[i];
      dh = ((((dh + Math.PI) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) - Math.PI;
      this.heading[i] += dh * Math.min(1, dt * 12);
    }
  }

  /** 공간 그리드를 이용한 군집 분리 + 아군/적군 접촉 처리 */
  separate() {
    const n = this.count;
    const head = this.cellHead;
    const next = this.cellNext;
    head.fill(-1);
    const { x, z, state, delay, team } = this;
    for (let i = 0; i < n; i++) {
      if (state[i] !== STATE_WALK || delay[i] > 0) {
        next[i] = -1;
        continue;
      }
      const cx = clamp(((x[i] - GX0) / CELL) | 0, 0, GCOLS - 1);
      const cz = clamp(((z[i] - GZ0) / CELL) | 0, 0, GROWS - 1);
      const c = cz * GCOLS + cx;
      next[i] = head[c];
      head[c] = i;
    }

    const sep = GameConfig.unit.separation;
    const sep2 = sep * sep;
    const kill = GameConfig.unit.killDistance;
    const kill2 = kill * kill;
    const px = this.pushX;
    const pz = this.pushZ;
    px.fill(0, 0, n);
    pz.fill(0, 0, n);

    for (let i = 0; i < n; i++) {
      if (state[i] !== STATE_WALK || delay[i] > 0) continue;
      const xi = x[i];
      const zi = z[i];
      const pi = team[i] === TEAM_PLAYER;
      const cx = clamp(((xi - GX0) / CELL) | 0, 0, GCOLS - 1);
      const cz = clamp(((zi - GZ0) / CELL) | 0, 0, GROWS - 1);
      let dead = false;
      for (let oz = -1; oz <= 1 && !dead; oz++) {
        const rz = cz + oz;
        if (rz < 0 || rz >= GROWS) continue;
        for (let ox = -1; ox <= 1 && !dead; ox++) {
          const rx = cx + ox;
          if (rx < 0 || rx >= GCOLS) continue;
          let j = head[rz * GCOLS + rx];
          while (j !== -1) {
            if (j !== i && state[j] === STATE_WALK) {
              const ddx = xi - x[j];
              const ddz = zi - z[j];
              const d2 = ddx * ddx + ddz * ddz;
              if (pi !== (team[j] === TEAM_PLAYER) && d2 < kill2) {
                // 아군 vs 적군: 1:1 소멸
                const tj = team[j];
                this.kill(i);
                this.kill(j);
                this.onClash?.((xi + x[j]) * 0.5, (zi + z[j]) * 0.5, team[i], tj);
                dead = true;
                break;
              }
              if (d2 < sep2) {
                if (d2 > 1e-6) {
                  const d = Math.sqrt(d2);
                  const f = ((sep - d) / d) * 0.5;
                  px[i] += ddx * f;
                  pz[i] += ddz * f;
                } else {
                  px[i] += (Math.random() - 0.5) * 0.05;
                  pz[i] += (Math.random() - 0.5) * 0.05;
                }
              }
            }
            j = next[j];
          }
        }
      }
    }
    const hw = GameConfig.world.halfWidth - 0.3;
    for (let i = 0; i < n; i++) {
      if (state[i] !== STATE_WALK) continue;
      // 프레임당 밀어내기 양을 제한해 떨림 방지
      x[i] = clamp(x[i] + clamp(px[i], -0.08, 0.08), -hw, hw);
      z[i] += clamp(pz[i], -0.08, 0.08);
    }
  }

  /** 죽은 유닛 제거 (swap-remove) */
  compact() {
    let n = this.count;
    let i = 0;
    while (i < n) {
      if (this.state[i] === STATE_DEAD) {
        n--;
        if (i !== n) this.copy(n, i);
      } else {
        i++;
      }
    }
    this.count = n;
  }

  copy(from, to) {
    this.x[to] = this.x[from];
    this.y[to] = this.y[from];
    this.z[to] = this.z[from];
    this.prevZ[to] = this.prevZ[from];
    this.vx[to] = this.vx[from];
    this.vz[to] = this.vz[from];
    this.heading[to] = this.heading[from];
    this.scale[to] = this.scale[from];
    this.baseScale[to] = this.baseScale[from];
    this.squash[to] = this.squash[from];
    this.walk[to] = this.walk[from];
    this.phase[to] = this.phase[from];
    this.age[to] = this.age[from];
    this.delay[to] = this.delay[from];
    this.timer[to] = this.timer[from];
    this.flash[to] = this.flash[from];
    this.speed[to] = this.speed[from];
    this.ax[to] = this.ax[from];
    this.az[to] = this.az[from];
    this.team[to] = this.team[from];
    this.state[to] = this.state[from];
    this.target[to] = this.target[from];
    this.mask[to] = this.mask[from];
  }
}

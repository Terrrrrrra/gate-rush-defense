import { GameConfig } from '../game/GameConfig.js';
import { TEAM_PLAYER, STATE_WALK, STATE_ATTACK } from '../entities/UnitManager.js';

/**
 * 전투 규칙: 아군 병력의 목표 기지 선택, 기지 공격, 적 병력 생성/돌파 처리.
 * 실제 효과(점수·파티클·UI)는 handlers 로 위임해 시스템 간 결합도를 낮춘다.
 * handlers: { onBaseHit(base,x,z,destroyed), onEnemyBreach(x,z), onAttackLand(x,z) }
 */
export class CombatSystem {
  constructor(units, bases, handlers) {
    this.units = units;
    this.bases = bases;
    this.handlers = handlers;
    const self = this;
    this._pt = { x: 0, z: 0 };
    /** UnitManager.integrate 에 전달되는 조향 정보 */
    this.steer = {
      cannonX: 0,
      playerTarget(i) {
        return self.pickTarget(i);
      },
      attackPoint(b) {
        const base = self.bases[b];
        return base ? base.attackPoint : self._pt;
      },
    };
  }

  pickTarget(i) {
    const um = this.units;
    let t = um.target[i];
    if (t < 0 || !this.bases[t].alive) {
      t = -1;
      let best = Infinity;
      for (let b = 0; b < this.bases.length; b++) {
        const base = this.bases[b];
        if (!base.alive) continue;
        const d = Math.abs(base.position.x - um.x[i]) * 1.4 + Math.abs(base.position.z - um.z[i]) * 0.2;
        if (d < best) {
          best = d;
          t = b;
        }
      }
      um.target[i] = t;
    }
    return t >= 0 ? this.bases[t].attackPoint : null;
  }

  spawnEnemies(base, count) {
    const um = this.units;
    const n = Math.min(count, um.enemyRoom());
    const sp = base.data.spawn;
    for (let k = 0; k < n; k++) {
      const x = base.position.x + (Math.random() - 0.5) * 2.4;
      const z = base.position.z + base.radius + 0.3 + Math.random() * 0.8;
      um.spawn(base.team, x, z, (Math.random() - 0.5) * 1.5, 2.5, {
        delay: k * 0.05,
        speed: sp.speed * (0.9 + Math.random() * 0.2),
      });
    }
  }

  update(dt) {
    const um = this.units;
    const U = GameConfig.unit;
    const goalZ = GameConfig.world.enemyGoalZ;
    const n = um.count;
    const { x, z, team, state, delay, target, timer } = um;
    for (let i = 0; i < n; i++) {
      if (delay[i] > 0) continue;
      const st = state[i];
      if (team[i] === TEAM_PLAYER) {
        if (st === STATE_WALK) {
          const t = target[i];
          if (t < 0) continue;
          const base = this.bases[t];
          if (!base.alive) continue;
          const dx = x[i] - base.position.x;
          const dz = z[i] - base.position.z;
          const r = base.radius + 0.35;
          if (dx * dx + dz * dz < r * r) {
            state[i] = STATE_ATTACK;
            timer[i] = 0;
            um.ax[i] = x[i];
            um.az[i] = z[i];
          }
        } else if (st === STATE_ATTACK && timer[i] >= U.attackTime) {
          const base = this.bases[target[i]];
          if (base && base.alive) {
            const destroyed = base.takeDamage(U.damage);
            this.handlers.onBaseHit(base, x[i], z[i], destroyed);
          } else {
            this.handlers.onAttackLand(x[i], z[i]);
          }
          um.kill(i);
        }
      } else if (st === STATE_WALK && z[i] > goalZ) {
        um.kill(i);
        this.handlers.onEnemyBreach(x[i], z[i], team[i]);
      }
    }
  }
}

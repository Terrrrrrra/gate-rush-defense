import * as THREE from 'three';
import { GameConfig } from './GameConfig.js';
import { TEAM_PLAYER } from '../entities/UnitManager.js';
import { rand } from '../utils/MathUtils.js';

const CONFETTI = [0xff4b5c, 0xffc531, 0x2fd47a, 0x2f8cff, 0xa45cff, 0xffffff];

/**
 * 게임 상태(타이틀/진행/일시정지/승리/패배), 점수·에너지·체력, 그리고 이벤트별 연출을 담당한다.
 */
export class GameManager {
  constructor(game) {
    this.g = game;
    this.state = 'title';
    this._muzzle = new THREE.Vector3();
    this.baseDamageAcc = game.bases.map(() => 0);
    this.baseDamageTimer = game.bases.map(() => 0);
    this.resetStats();
  }

  resetStats() {
    this.score = 0;
    this.energy = 30;
    this.playerHp = GameConfig.player.maxHp;
    this.kills = 0;
    this.maxUnits = 0;
    this.time = 0;
    this.fireTimer = 0;
    this.endTimer = -1;
    this.interacted = false;
    this.ringTimer = 0;
  }

  // ---------------- 상태 전환 ----------------
  start() {
    const g = this.g;
    this.resetStats();
    g.units.clear();
    g.sparks.clear();
    g.debris.clear();
    g.rings.clear();
    g.ui.clearPopups();
    g.bases.forEach((b) => b.reset());
    g.gates.reset();
    g.cannon.reset();
    g.input.setCannonX(0);
    g.input.release();
    g.ui.hideResult();
    g.ui.showStart(false);
    g.ui.showPause(false);
    g.ui.showHud(true);
    g.ui.resetHint();
    g.input.enabled = true;
    this.state = 'playing';
    g.perf.reset();
  }

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.g.input.release();
    this.g.input.enabled = false;
    this.g.ui.showPause(true);
  }

  resume() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    this.g.input.enabled = true;
    this.g.ui.showPause(false);
  }

  finish(win) {
    if (this.state !== 'playing') return;
    this.state = win ? 'won' : 'lost';
    this.endTimer = win ? 1.8 : 1.4;
    this.g.input.release();
    this.g.input.enabled = false;
    if (win) {
      this.score += Math.round(this.playerHp) * GameConfig.score.hpBonus;
    } else {
      this.g.camera.shake(1);
    }
  }

  // ---------------- 플레이어 행동 ----------------
  fireUnit(spreadMul = 1, speedMul = 1, delay = 0) {
    const g = this.g;
    if (g.units.playerRoom() <= 0) return false;
    const m = g.cannon.getMuzzle(this._muzzle);
    const C = GameConfig.cannon;
    const vx = (Math.random() - 0.5) * 2 * C.spread * spreadMul * C.muzzleSpeed * 0.25;
    g.units.spawn(TEAM_PLAYER, m.x + (Math.random() - 0.5) * 0.3, m.z, vx, -C.muzzleSpeed * speedMul, { delay });
    return true;
  }

  power() {
    if (this.state !== 'playing' || this.energy < GameConfig.energy.max) return;
    const g = this.g;
    this.energy = 0;
    const n = GameConfig.energy.burstCount;
    for (let i = 0; i < n; i++) this.fireUnit(3.2, 1.25, i * 0.012);
    const m = g.cannon.getMuzzle(this._muzzle);
    g.cannon.fire();
    g.camera.shake(0.45);
    g.camera.punch(0, 0.25, 0.4);
    g.rings.spawn(m.x, 0.1, m.z, 0xffc531, 3.5, 0.6);
    g.sparks.emit(m.x, m.y, m.z, 30, { colors: [0xffe066, 0xffffff, 0x7cc4ff], speed: 5, up: 4, life: 0.5, size: 0.16, gravity: 8 });
    g.ui.popText(m.x, 1.5, m.z - 1, 'POWER SHOT!', 'gate', 1.1, 2);
  }

  // ---------------- 이벤트 핸들러 ----------------
  onClash(x, z, teamA, teamB) {
    const g = this.g;
    this.kills++;
    this.score += GameConfig.score.kill;
    this.energy = Math.min(GameConfig.energy.max, this.energy + GameConfig.energy.perKill);
    const enemyTeam = teamA === TEAM_PLAYER ? teamB : teamA;
    const c = g.teamColorsHex[enemyTeam];
    g.sparks.emit(x, 0.4, z, 5, { colors: [0x2f8cff, c, 0xffffff], speed: 2.6, up: 3.2, life: 0.45, size: 0.12 });
  }

  onBaseHit(base, x, z, destroyed) {
    const g = this.g;
    this.score += GameConfig.score.baseHit;
    this.baseDamageAcc[base.index] += GameConfig.unit.damage;
    g.debris.emit(x, 1.2, z, 2, { colors: [base.data.color, 0xffffff], speed: 2.2, up: 4, life: 0.6, size: 0.14 });
    g.sparks.emit(x, 1, z, 2, { color: 0xfff1a8, speed: 2, up: 2, life: 0.25, size: 0.12, gravity: 0 });
    if (Math.random() < 0.15) g.camera.shake(0.12);
    if (destroyed) this.onBaseDestroyed(base);
  }

  onBaseDestroyed(base) {
    const g = this.g;
    const p = base.position;
    this.score += GameConfig.score.baseDestroyed;
    g.camera.shake(1.1);
    g.camera.punch(0, 0.6, 0.6);
    g.ui.shake();
    g.rings.spawn(p.x, 0.1, p.z, base.data.color, 6, 0.8);
    g.rings.spawn(p.x, 0.1, p.z, 0xffffff, 4, 0.5);
    g.debris.emit(p.x, 1.5, p.z, 70, { colors: [base.data.color, 0xfbf6ee, 0xfbf6ee, 0x8a7f73], speed: 6, up: 9, life: 1.6, size: 0.3, jitter: 2 });
    g.sparks.emit(p.x, 1.5, p.z, 40, { colors: [0xffe066, 0xff9a3c, 0xffffff], speed: 5, up: 6, life: 0.7, size: 0.2, gravity: 4 });
    // 연기 (위로 천천히 커지며 떠오르는 회색 입자)
    g.sparks.emit(p.x, 0.8, p.z, 24, { colors: [0xd9d4cc, 0xbdb6ad, 0xffffff], speed: 1.5, up: 1.6, life: 1.5, size: 0.45, gravity: -0.6, drag: 2, grow: true, jitter: 2 });
    g.ui.popText(p.x, 3.5, p.z, 'DESTROYED!', 'gate', 1.6, 1.5);
    g.ui.popText(p.x, 2.5, p.z, `+${GameConfig.score.baseDestroyed}`, 'small', 1.4, 1.2);
    if (g.bases.every((b) => !b.alive)) this.finish(true);
  }

  onAttackLand(x, z) {
    this.g.sparks.emit(x, 0.5, z, 3, { color: 0xffffff, speed: 1.5, up: 2, life: 0.3, size: 0.1 });
  }

  onEnemyBreach(x, z, team) {
    if (this.state !== 'playing') return;
    const g = this.g;
    this.playerHp = Math.max(0, this.playerHp - GameConfig.player.damagePerEnemy);
    g.camera.shake(0.28);
    g.ui.shake();
    g.sparks.emit(x, 0.5, z, 8, { colors: [g.teamColorsHex[team], 0xffffff], speed: 3, up: 4, life: 0.5, size: 0.14 });
    g.ui.popText(x, 1.2, z, `-${GameConfig.player.damagePerEnemy}`, 'damage', 0.8, 1);
    if (this.playerHp <= 0) this.finish(false);
  }

  onGatePass(gate, x, z, added) {
    const g = this.g;
    const c = gate.color.getHex();
    g.sparks.emit(x, 1.0, z, added > 2 ? 4 : 2, { colors: [c, 0xffffff, 0xfff36b], speed: 2.2, up: 3.5, life: 0.55, size: 0.11, gravity: 5 });
    if (gate.popupTimer <= 0 && gate.pending > 0) {
      gate.popupTimer = 0.4;
      g.ui.popText(gate.x, 2.2, gate.z, `${gate.type.label(gate.value)}  +${gate.pending}`, 'gate', 0.9, 1.6);
      g.rings.spawn(gate.x, 0.08, gate.z, c, gate.width * 0.8, 0.45);
      gate.pending = 0;
    }
  }

  // ---------------- 프레임 업데이트 ----------------
  update(dt) {
    const g = this.g;
    const playing = this.state === 'playing';
    const ended = this.state === 'won' || this.state === 'lost';

    if (playing) {
      this.time += dt;
      this.energy = Math.min(GameConfig.energy.max, this.energy + GameConfig.energy.regenPerSec * dt);
      // 발사
      this.fireTimer -= dt;
      if (g.input.isFiring) {
        if (!this.interacted) {
          this.interacted = true;
          g.ui.fadeHint();
        }
        while (this.fireTimer <= 0) {
          this.fireTimer += GameConfig.cannon.fireInterval;
          if (this.fireUnit()) {
            g.cannon.fire();
            const m = g.cannon.getMuzzle(this._muzzle);
            g.sparks.emit(m.x, m.y, m.z - 0.1, 3, { colors: [0xffffff, 0xbfe0ff], speed: 1.6, up: 1.5, life: 0.22, size: 0.12, gravity: 0 });
          }
        }
      } else {
        this.fireTimer = Math.max(this.fireTimer, 0);
      }
    }

    // 적 기지
    if (playing) {
      for (const b of g.bases) b.update(dt, g.time, g.spawnEnemies);
    } else {
      for (const b of g.bases) b.update(dt, g.time, noop);
    }

    // 기지별 누적 피해 팝업 (매 타격마다 DOM 을 만들지 않도록 묶어서 표시)
    for (let i = 0; i < g.bases.length; i++) {
      this.baseDamageTimer[i] -= dt;
      if (this.baseDamageAcc[i] > 0 && this.baseDamageTimer[i] <= 0) {
        const b = g.bases[i];
        g.ui.popText(b.position.x + rand(-0.8, 0.8), 2.8, b.position.z + 0.6, `-${this.baseDamageAcc[i]}`, 'damage small', 0.7, 1);
        this.baseDamageAcc[i] = 0;
        this.baseDamageTimer[i] = 0.25;
      }
    }

    const blue = g.units.countTeam(TEAM_PLAYER);
    if (blue > this.maxUnits) this.maxUnits = blue;

    if (ended) {
      this.endTimer -= dt;
      if (this.state === 'won') {
        this.ringTimer -= dt;
        if (this.ringTimer <= 0) {
          this.ringTimer = 0.12;
          g.sparks.emit(rand(-4, 4), 7, rand(-12, 6), 6, { colors: CONFETTI, speed: 1.5, up: 1, life: 2.2, size: 0.16, gravity: 3, drag: 2.5, jitter: 2 });
        }
      }
      if (this.endTimer <= 0 && this.endTimer > -1) {
        this.endTimer = -1;
        const hpRatio = this.playerHp / GameConfig.player.maxHp;
        const stars = hpRatio > 0.7 ? 3 : hpRatio > 0.35 ? 2 : 1;
        g.ui.showResult(this.state === 'won', this.score, { stars, kills: this.kills, maxUnits: this.maxUnits, time: this.time });
      }
    }

    // UI 갱신
    g.ui.setScore(this.score);
    g.ui.setPlayerHp(this.playerHp, GameConfig.player.maxHp);
    g.ui.setEnergy(this.energy, GameConfig.energy.max);
    g.ui.setUnits(blue);
    g.ui.updateBases(g.bases, dt);
    g.ui.setKnob(g.cannon.x, GameConfig.world.halfWidth - GameConfig.cannon.margin);
  }
}

function noop() {}

import * as THREE from 'three';
import { GameConfig, QUALITY_PRESETS, MAX_UNITS_CAPACITY, MAX_PARTICLES_CAPACITY } from './GameConfig.js';
import { LEVEL_1 } from './LevelData.js';
import { GameManager } from './GameManager.js';
import { SceneManager } from '../scene/SceneManager.js';
import { CameraManager } from '../scene/CameraManager.js';
import { Lighting } from '../scene/Lighting.js';
import { MapBuilder } from '../scene/MapBuilder.js';
import { PlayerCannon } from '../entities/PlayerCannon.js';
import { UnitManager } from '../entities/UnitManager.js';
import { UnitRenderer } from '../entities/UnitRenderer.js';
import { GateManager } from '../entities/Gate.js';
import { EnemyBase } from '../entities/EnemyBase.js';
import { InputSystem } from '../systems/InputSystem.js';
import { CombatSystem } from '../systems/CombatSystem.js';
import { ParticleSystem, RingEffects } from '../systems/ParticleSystem.js';
import { UIManager } from '../ui/UIManager.js';
import { PerformanceMonitor } from '../utils/PerformanceMonitor.js';

const QUALITY_ORDER = ['low', 'medium', 'high'];
const PLAYER_COLOR = 0x2f8cff;

function loadQuality() {
  try {
    const q = localStorage.getItem('gr.quality');
    if (q && QUALITY_PRESETS[q]) return q;
  } catch {
    /* 저장소 접근 불가 */
  }
  const coarse = matchMedia('(pointer: coarse)').matches;
  const lowMem = navigator.deviceMemory !== undefined && navigator.deviceMemory <= 3;
  return lowMem ? 'low' : coarse ? 'medium' : 'high';
}

/**
 * 컴포지션 루트: 모든 시스템을 생성·연결하고 메인 루프를 돌린다.
 */
export class Game {
  constructor(container, level = LEVEL_1) {
    this.level = level;
    this.qualityName = loadQuality();
    this.quality = QUALITY_PRESETS[this.qualityName];
    this.time = 0;
    this.running = false;
    this.rafId = 0;
    this.lastT = 0;

    // 씬 / 카메라 / 조명
    this.sceneMgr = new SceneManager(container, this.quality);
    const scene = this.sceneMgr.scene;
    this.camera = new CameraManager();
    this.lighting = new Lighting(scene, this.quality);
    this.map = new MapBuilder(scene, this.quality, level.bases);

    // 엔티티
    this.cannon = new PlayerCannon(scene);
    this.bases = level.bases.map((d, i) => new EnemyBase(scene, d, i));
    this.gates = new GateManager(scene, level.gates);
    this.units = new UnitManager(MAX_UNITS_CAPACITY);
    this.units.setLimit(this.quality.maxUnits);
    this.unitRenderer = new UnitRenderer(scene, MAX_UNITS_CAPACITY, this.quality);
    this.teamColorsHex = [PLAYER_COLOR, ...level.bases.map((b) => b.color)];
    this.teamColors = this.teamColorsHex.map((h) => new THREE.Color(h));

    // 파티클 (반짝이/연기 = 비조명, 파편 = 조명)
    this.sparks = new ParticleSystem(
      scene,
      MAX_PARTICLES_CAPACITY,
      new THREE.IcosahedronGeometry(0.5, 0),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.92, depthWrite: false })
    );
    this.sparks.mesh.renderOrder = 5;
    this.debris = new ParticleSystem(
      scene,
      Math.floor(MAX_PARTICLES_CAPACITY / 2),
      new THREE.BoxGeometry(0.6, 0.6, 0.6),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 })
    );
    this.debris.mesh.castShadow = true;
    this.rings = new RingEffects(scene, 10);

    // 시스템
    this.ui = new UIManager();
    this.input = new InputSystem(this.sceneMgr.renderer.domElement);
    this.gm = new GameManager(this);
    this.combat = new CombatSystem(this.units, this.bases, {
      onBaseHit: (b, x, z, d) => this.gm.onBaseHit(b, x, z, d),
      onEnemyBreach: (x, z, t) => this.gm.onEnemyBreach(x, z, t),
      onAttackLand: (x, z) => this.gm.onAttackLand(x, z),
    });
    this.spawnEnemies = (base, count) => this.combat.spawnEnemies(base, count);
    this.units.onClash = (x, z, a, b) => this.gm.onClash(x, z, a, b);
    this.gates.onPass = (g, x, z, n) => this.gm.onGatePass(g, x, z, n);
    this.input.onPower = () => this.gm.power();

    this.perf = new PerformanceMonitor({
      element: document.getElementById('fps'),
      onLow: () => this.downgradeQuality(),
    });

    this.ui.buildEnemyList(this.bases);
    this.ui.setQualityChip(this.qualityName);
    this.ui.bind({
      onStart: () => this.gm.start(),
      onRestart: () => this.gm.start(),
      onPause: () => this.gm.pause(),
      onResume: () => this.gm.resume(),
      onPower: () => this.gm.power(),
      onQuality: (q) => this.setQuality(q),
    });

    this.sceneMgr.onResize((w, h) => this.camera.resize(w, h));
    this.camera.resize(this.sceneMgr.width, this.sceneMgr.height);

    // 탭 비활성화 시 루프 정지
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.gm.pause();
        this.stop();
      } else {
        this.startLoop();
      }
    });

    this._loop = this.loop.bind(this);
    this.debugHooks();
  }

  setQuality(name, persist = true) {
    if (!QUALITY_PRESETS[name]) return;
    this.qualityName = name;
    this.quality = QUALITY_PRESETS[name];
    this.sceneMgr.setQuality(this.quality);
    this.lighting.setQuality(this.quality);
    this.unitRenderer.setQuality(this.quality);
    this.units.setLimit(this.quality.maxUnits);
    this.sparks.setLimit(this.quality.maxParticles);
    this.debris.setLimit(Math.floor(this.quality.maxParticles / 2));
    this.ui.setQualityChip(name);
    this.perf.extraText = name;
    if (persist) {
      try {
        localStorage.setItem('gr.quality', name);
      } catch {
        /* noop */
      }
    }
  }

  downgradeQuality() {
    const i = QUALITY_ORDER.indexOf(this.qualityName);
    if (i > 0) this.setQuality(QUALITY_ORDER[i - 1], false);
  }

  startLoop() {
    if (this.running) return;
    this.running = true;
    this.lastT = performance.now();
    this.rafId = requestAnimationFrame(this._loop);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }

  loop(now) {
    if (!this.running) return;
    this.rafId = requestAnimationFrame(this._loop);
    // deltaTime 기반 (긴 프레임/탭 복귀 시 튐 방지를 위해 상한)
    const dt = Math.min(0.05, Math.max(0, (now - this.lastT) / 1000));
    this.lastT = now;
    this.update(dt);
    this.sceneMgr.render(this.camera.camera);
  }

  update(dt) {
    this.time += dt;
    this.perf.update(dt);
    const paused = this.gm.state === 'paused';
    const simDt = paused ? 0 : dt;

    this.input.update(simDt);
    this.cannon.setTargetX(this.input.targetX);
    this.cannon.update(simDt, this.time);
    this.combat.steer.cannonX = this.cannon.x;

    if (!paused) {
      this.units.integrate(simDt, this.combat.steer);
      this.units.separate();
      this.gates.update(simDt, this.time, this.units);
      this.combat.update(simDt);
      this.units.compact();
    }
    this.gm.update(simDt);

    this.unitRenderer.sync(this.units, this.teamColors);
    this.sparks.update(simDt);
    this.debris.update(simDt);
    this.rings.update(simDt);
    this.camera.update(dt);
    this.ui.updateWorldUI(simDt, this.camera.camera, this.sceneMgr.width, this.sceneMgr.height);
  }

  /** 개발/테스트용 콘솔 훅 */
  debugHooks() {
    window.__game = this;
  }
}

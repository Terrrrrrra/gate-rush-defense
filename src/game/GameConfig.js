/**
 * 게임 전역 설정값. 밸런스/연출 조정은 이 파일에서 한다.
 */
export const QUALITY_PRESETS = {
  low: { pixelRatio: 1.0, shadows: true, shadowMapSize: 512, maxUnits: 260, maxParticles: 260, legs: true, unitShadows: false, decorations: 0.4 },
  medium: { pixelRatio: 1.5, shadows: true, shadowMapSize: 1024, maxUnits: 450, maxParticles: 450, legs: true, unitShadows: true, decorations: 1 },
  high: { pixelRatio: 2.0, shadows: true, shadowMapSize: 2048, maxUnits: 700, maxParticles: 700, legs: true, unitShadows: true, decorations: 1 },
};

/** 버퍼는 가장 큰 프리셋 기준으로 1회만 할당하고, 실제 사용량은 품질값으로 제한한다. */
export const MAX_UNITS_CAPACITY = 700;
export const MAX_PARTICLES_CAPACITY = 700;

export const GameConfig = {
  world: {
    halfWidth: 5, // 통로(플레이 영역) 반폭
    tileHalfWidth: 9, // 바닥 타일 전체 반폭
    minZ: -22,
    maxZ: 17,
    cannonZ: 10,
    enemyGoalZ: 9.2, // 적 병력이 이 z 를 넘으면 플레이어 피해
  },
  camera: {
    fov: 42,
    target: { x: 0, y: 0, z: -0.6 },
    pitchDeg: 58, // 수평 기준 내려다보는 각
    fitWidth: 15.2, // 화면 하단에서 반드시 보여야 할 가로 폭
    fitLength: 40, // 세로로 보여야 할 맵 길이
  },
  cannon: {
    followSharpness: 22,
    fireInterval: 0.15,
    muzzleSpeed: 6,
    spread: 0.35,
    margin: 0.6,
    dragSensitivity: 1.25, // 화면 폭 전체 드래그 = 통로 폭 * 값
    keyboardSpeed: 9,
  },
  unit: {
    speed: 3.4,
    radius: 0.24,
    separation: 0.46,
    killDistance: 0.42,
    spawnPopTime: 0.28,
    cloneStagger: 0.012,
    steerZ: -5.6, // 이 z 보다 위에서는 적 기지를 향해 방향을 튼다
    attackTime: 0.32,
    damage: 1,
  },
  energy: {
    max: 100,
    regenPerSec: 5.5,
    perKill: 0.6,
    burstCount: 28,
  },
  player: {
    maxHp: 100,
    damagePerEnemy: 3,
  },
  score: {
    kill: 10,
    baseHit: 5,
    baseDestroyed: 1000,
    hpBonus: 20,
  },
  effects: {
    shakeDecay: 2.4,
    maxShake: 0.55,
  },
};

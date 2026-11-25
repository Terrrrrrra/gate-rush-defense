/**
 * 레벨 데이터: 게이트와 적 기지를 데이터로 정의한다.
 * - 게이트를 추가/수정하려면 gates 배열만 고치면 된다.
 * - type 은 GATE_TYPES 의 키 (Gate.js) 중 하나.
 * - move 를 지정하면 x 축으로 왕복 이동한다.
 */
export const LEVEL_1 = {
  name: 'Stage 1',
  gates: [
    { id: 'g1', type: 'multiply', value: 2, x: -2.45, z: 4.4, width: 4.2 },
    { id: 'g2', type: 'multiply', value: 3, x: 2.45, z: 4.4, width: 4.2 },
    { id: 'g3', type: 'multiply', value: 5, x: -2.6, z: -1.6, width: 3.4 },
    { id: 'g4', type: 'multiply', value: 7, x: 2.2, z: -1.6, width: 2.4, move: { amplitude: 1.6, speed: 0.7 } },
  ],
  bases: [
    { id: 'red', kind: 'castle', name: 'RED FORT', color: 0xff4b5c, x: -2.8, z: -12.6, hp: 1600, spawn: { interval: 2.4, count: 5, speed: 1.9, growth: 0.35 } },
    { id: 'purple', kind: 'castle', name: 'PURPLE KEEP', color: 0xa45cff, x: 2.8, z: -12.6, hp: 2200, spawn: { interval: 2.8, count: 6, speed: 1.7, growth: 0.4 } },
  ],
};

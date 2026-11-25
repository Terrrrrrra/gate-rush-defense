// 외부 의존성 없이 PWA 아이콘 PNG 를 생성한다:  node scripts/generate-icons.mjs
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

const CRC_TABLE = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size, pixel) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  const SS = 3; // 슈퍼샘플링 안티앨리어싱
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++)
        for (let sx = 0; sx < SS; sx++) {
          const c = pixel((x + (sx + 0.5) / SS) / size, (y + (sy + 0.5) / SS) / size);
          r += c[0] * c[3]; g += c[1] * c[3]; b += c[2] * c[3]; a += c[3];
        }
      const o = y * (size * 4 + 1) + 1 + x * 4;
      raw[o] = a ? r / a : 0; raw[o + 1] = a ? g / a : 0; raw[o + 2] = a ? b / a : 0; raw[o + 3] = (a / (SS * SS)) * 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const inEllipse = (x, y, cx, cy, rx, ry) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
function roundRect(x, y, r, inset) {
  const lo = inset, hi = 1 - inset;
  const qx = Math.max(lo + r - x, 0, x - (hi - r));
  const qy = Math.max(lo + r - y, 0, y - (hi - r));
  return x >= lo && x <= hi && y >= lo && y <= hi && qx * qx + qy * qy <= r * r;
}

/** 귀여운 파란 병사 캐릭터 아이콘. maskable=true 면 꽉 찬 배경(안전영역 고려) */
function icon(maskable) {
  return (x, y) => {
    const inset = maskable ? 0 : 0.04;
    if (!roundRect(x, y, maskable ? 0 : 0.2, inset)) return [0, 0, 0, 0];
    const s = maskable ? 0.8 : 1; // maskable 은 중앙 80% 안전영역에 그린다
    const u = (x - 0.5) / s + 0.5;
    const v = (y - 0.5) / s + 0.5;
    let c = mix([255, 214, 92], [255, 152, 48], y); // 배경 그라데이션
    // 바닥 그림자
    if (inEllipse(u, v, 0.5, 0.86, 0.26, 0.05)) c = mix(c, [120, 60, 0], 0.35);
    // 다리
    if (inEllipse(u, v, 0.42, 0.8, 0.06, 0.07) || inEllipse(u, v, 0.58, 0.8, 0.06, 0.07)) c = [26, 80, 170];
    // 팔
    if (inEllipse(u, v, 0.25, 0.6, 0.065, 0.09) || inEllipse(u, v, 0.75, 0.6, 0.065, 0.09)) c = [38, 120, 235];
    // 몸통 (캡슐)
    const body = inEllipse(u, v, 0.5, 0.52, 0.25, 0.29);
    if (body) {
      c = mix([110, 185, 255], [32, 120, 235], Math.min(1, Math.max(0, (v - 0.25) / 0.5)));
      if (inEllipse(u, v, 0.43, 0.36, 0.07, 0.035)) c = mix(c, [255, 255, 255], 0.55); // 하이라이트
      if (inEllipse(u, v, 0.5, 0.64, 0.14, 0.12)) c = mix(c, [235, 244, 255], 0.75); // 배
      if (inEllipse(u, v, 0.42, 0.47, 0.035, 0.05) || inEllipse(u, v, 0.58, 0.47, 0.035, 0.05)) c = [20, 24, 36];
      if (inEllipse(u, v, 0.43, 0.455, 0.012, 0.014) || inEllipse(u, v, 0.59, 0.455, 0.012, 0.014)) c = [255, 255, 255];
    }
    // 안테나
    if (!body && Math.abs(u - 0.5) < 0.03 * (1 - (0.24 - v) / 0.06) && v > 0.18 && v < 0.24) c = [38, 120, 235];
    return [...c, 1];
  };
}

mkdirSync('public/icons', { recursive: true });
writeFileSync('public/icons/icon-192.png', png(192, icon(false)));
writeFileSync('public/icons/icon-512.png', png(512, icon(false)));
writeFileSync('public/icons/maskable-512.png', png(512, icon(true)));
writeFileSync('public/icons/apple-touch-icon.png', png(180, icon(true)));
console.log('icons generated');

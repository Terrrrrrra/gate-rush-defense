import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { GameConfig } from '../game/GameConfig.js';

const C_PATH_A = new THREE.Color(0xf6e7c8);
const C_PATH_B = new THREE.Color(0xecd8b3);
const C_SIDE_A = new THREE.Color(0xd3cec6);
const C_SIDE_B = new THREE.Color(0xc4beb5);
const C_BLUE = new THREE.Color(0x7fbaff);
const C_BATTLE = new THREE.Color(0xd9c29a);

/**
 * 타일 바닥, 통로 난간, 장식(나무/바위)을 생성한다. 모두 InstancedMesh 로 묶어 드로우콜을 최소화.
 */
export class MapBuilder {
  constructor(scene, quality, bases) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.buildTiles(bases);
    this.buildRails();
    this.buildDecorations(quality.decorations);
  }

  buildTiles(bases) {
    const { tileHalfWidth, halfWidth, minZ, maxZ } = GameConfig.world;
    const cols = tileHalfWidth * 2;
    const rows = maxZ - minZ;
    const geo = new RoundedBoxGeometry(0.94, 0.3, 0.94, 1, 0.07);
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0 });
    const mesh = new THREE.InstancedMesh(geo, mat, cols * rows);
    mesh.receiveShadow = true;
    const m = new THREE.Matrix4();
    const color = new THREE.Color();
    const baseColors = bases.map((b) => ({ x: b.x, z: b.z, c: new THREE.Color(b.color) }));
    let i = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = -tileHalfWidth + 0.5 + c;
        const z = minZ + 0.5 + r;
        const inPath = Math.abs(x) < halfWidth;
        const checker = (r + c) % 2 === 0;
        let y = -0.15;
        if (inPath) {
          color.copy(checker ? C_PATH_A : C_PATH_B);
          if (z > -10.5 && z < -3.5) color.lerp(C_BATTLE, 0.35);
          if (z > GameConfig.world.cannonZ - 1.5) color.lerp(C_BLUE, 0.35);
          for (const b of baseColors) {
            const d = Math.hypot(x - b.x, (z - b.z) * 0.8);
            if (d < 3.6) color.lerp(b.c, 0.35 * (1 - d / 3.6) + 0.12);
          }
        } else {
          color.copy(checker ? C_SIDE_A : C_SIDE_B);
          y = -0.05; // 바깥 타일은 살짝 높여 통로가 움푹 들어간 느낌
        }
        m.makeTranslation(x, y, z);
        mesh.setMatrixAt(i, m);
        mesh.setColorAt(i, color);
        i++;
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor.needsUpdate = true;
    this.group.add(mesh);

    // 바닥 아래 받침판 (타일 틈 사이로 하늘이 보이지 않도록)
    const under = new THREE.Mesh(
      new THREE.PlaneGeometry(tileHalfWidth * 2 + 6, rows + 10),
      new THREE.MeshBasicMaterial({ color: 0x9c8f7a })
    );
    under.rotation.x = -Math.PI / 2;
    under.position.set(0, -0.32, (minZ + maxZ) / 2);
    this.group.add(under);
  }

  buildRails() {
    const { halfWidth, minZ, maxZ } = GameConfig.world;
    const len = maxZ - minZ - 4;
    const zc = (minZ + maxZ) / 2 + 1;
    const wallGeo = new RoundedBoxGeometry(0.42, 0.5, len, 2, 0.12);
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 });
    const capGeo = new RoundedBoxGeometry(0.5, 0.16, len + 0.1, 2, 0.07);
    const capMat = new THREE.MeshStandardMaterial({ color: 0x4f9dff, roughness: 0.45 });
    for (const s of [-1, 1]) {
      const wall = new THREE.Mesh(wallGeo, wallMat);
      wall.position.set(s * (halfWidth + 0.21), 0.2, zc);
      wall.castShadow = true;
      wall.receiveShadow = true;
      const cap = new THREE.Mesh(capGeo, capMat);
      cap.position.set(s * (halfWidth + 0.21), 0.5, zc);
      cap.castShadow = true;
      this.group.add(wall, cap);
    }

    // 난간 기둥 (인스턴싱)
    const postGeo = new THREE.CylinderGeometry(0.2, 0.24, 0.85, 10);
    const postMat = new THREE.MeshStandardMaterial({ color: 0xffd23f, roughness: 0.5 });
    const n = Math.floor(len / 3);
    const posts = new THREE.InstancedMesh(postGeo, postMat, n * 2);
    posts.castShadow = true;
    const m = new THREE.Matrix4();
    let k = 0;
    for (let i = 0; i < n; i++) {
      const z = zc - len / 2 + 1.5 + i * 3;
      for (const s of [-1, 1]) m.makeTranslation(s * (halfWidth + 0.21), 0.38, z), posts.setMatrixAt(k++, m);
    }
    this.group.add(posts);
  }

  buildDecorations(density) {
    const { tileHalfWidth, halfWidth, minZ, maxZ } = GameConfig.world;
    const trunkGeo = new THREE.CylinderGeometry(0.12, 0.16, 0.6, 7);
    const crownGeo = new THREE.IcosahedronGeometry(0.62, 1);
    const rockGeo = new THREE.DodecahedronGeometry(0.4, 0);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x9a6a3f, roughness: 0.9 });
    const crownMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7, flatShading: true });
    const rockMat = new THREE.MeshStandardMaterial({ color: 0xb8b2aa, roughness: 0.9, flatShading: true });

    const spots = [];
    // 좌우 바깥 영역
    for (let z = minZ + 2; z < maxZ - 1; z += 2.3) {
      for (const s of [-1, 1]) {
        if (Math.random() > density) continue;
        const x = s * (halfWidth + 1.4 + Math.random() * (tileHalfWidth - halfWidth - 2));
        spots.push({ x, z: z + Math.random() * 1.2, tree: Math.random() < 0.72 });
      }
    }
    // 적 기지 뒤쪽
    for (let x = -halfWidth + 0.5; x < halfWidth; x += 1.6) {
      if (Math.random() > density) continue;
      spots.push({ x: x + Math.random() * 0.6, z: minZ + 1 + Math.random() * 1.8, tree: true });
    }

    const trees = spots.filter((s) => s.tree);
    const rocks = spots.filter((s) => !s.tree);
    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, Math.max(1, trees.length));
    const crowns = new THREE.InstancedMesh(crownGeo, crownMat, Math.max(1, trees.length));
    const rockMesh = new THREE.InstancedMesh(rockGeo, rockMat, Math.max(1, rocks.length));
    trunks.castShadow = crowns.castShadow = rockMesh.castShadow = true;
    trunks.count = crowns.count = trees.length;
    rockMesh.count = rocks.length;

    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const p = new THREE.Vector3();
    const sc = new THREE.Vector3();
    const greens = [0x6cc551, 0x58b847, 0x86d461, 0x4fae5a];
    const col = new THREE.Color();
    trees.forEach((t, i) => {
      const s = 0.8 + Math.random() * 0.55;
      m.compose(p.set(t.x, 0.3 * s, t.z), q.identity(), sc.set(s, s, s));
      trunks.setMatrixAt(i, m);
      q.setFromAxisAngle(p.set(0, 1, 0), Math.random() * Math.PI);
      m.compose(p.set(t.x, 0.95 * s, t.z), q, sc.set(s, s * 1.1, s));
      crowns.setMatrixAt(i, m);
      crowns.setColorAt(i, col.setHex(greens[i % greens.length]));
    });
    rocks.forEach((r, i) => {
      const s = 0.6 + Math.random() * 0.7;
      q.setFromEuler(new THREE.Euler(Math.random(), Math.random() * 3, Math.random()));
      m.compose(p.set(r.x, 0.12, r.z), q, sc.set(s, s * 0.7, s));
      rockMesh.setMatrixAt(i, m);
    });
    if (crowns.instanceColor) crowns.instanceColor.needsUpdate = true;
    this.group.add(trunks, crowns, rockMesh);
  }
}

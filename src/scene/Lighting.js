import * as THREE from 'three';

/** 반구광 + 그림자를 드리우는 방향광 */
export class Lighting {
  constructor(scene, quality) {
    this.hemi = new THREE.HemisphereLight(0xeaf6ff, 0xc9b28d, 1.55);
    scene.add(this.hemi);

    this.ambient = new THREE.AmbientLight(0xffffff, 0.35);
    scene.add(this.ambient);

    this.sun = new THREE.DirectionalLight(0xfff3df, 2.1);
    this.sun.position.set(-7, 18, 9);
    this.sun.target.position.set(0, 0, -2);
    scene.add(this.sun, this.sun.target);

    const cam = this.sun.shadow.camera;
    cam.left = -12;
    cam.right = 12;
    cam.top = 19;
    cam.bottom = -19;
    cam.near = 2;
    cam.far = 50;
    this.sun.shadow.bias = -0.0008;
    this.sun.shadow.normalBias = 0.03;
    this.sun.shadow.radius = 3;
    this.setQuality(quality);
  }

  setQuality(quality) {
    this.sun.castShadow = quality.shadows;
    const size = quality.shadowMapSize;
    if (this.sun.shadow.mapSize.x !== size) {
      this.sun.shadow.mapSize.set(size, size);
      if (this.sun.shadow.map) {
        this.sun.shadow.map.dispose();
        this.sun.shadow.map = null;
      }
    }
  }
}

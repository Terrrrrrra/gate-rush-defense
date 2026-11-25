import * as THREE from 'three';

/** 렌더러/씬 생성, 픽셀 비율 상한, 리사이즈를 담당한다. */
export class SceneManager {
  constructor(container, quality) {
    this.container = container;
    this.quality = quality;
    const isMobile = matchMedia('(pointer: coarse)').matches;
    this.renderer = new THREE.WebGLRenderer({
      antialias: !isMobile || quality.pixelRatio < 1.5,
      powerPreference: 'high-performance',
      alpha: false,
      stencil: false,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.shadowMap.enabled = quality.shadows;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.setAttribute('tabindex', '0');
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x8fd3f4);
    this.scene.fog = new THREE.Fog(0x8fd3f4, 38, 70);

    this.width = 1;
    this.height = 1;
    this.listeners = [];
    this._onResize = () => this.resize();
    window.addEventListener('resize', this._onResize);
    window.visualViewport?.addEventListener('resize', this._onResize);
    this.resize();
  }

  onResize(fn) {
    this.listeners.push(fn);
  }

  setQuality(quality) {
    this.quality = quality;
    this.renderer.shadowMap.enabled = quality.shadows;
    this.resize();
  }

  resize() {
    const w = Math.max(1, window.innerWidth);
    const h = Math.max(1, window.visualViewport?.height || window.innerHeight);
    document.documentElement.style.setProperty('--app-h', `${h}px`);
    this.width = w;
    this.height = h;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.quality.pixelRatio));
    this.renderer.setSize(w, h, false);
    for (const fn of this.listeners) fn(w, h);
  }

  render(camera) {
    this.renderer.render(this.scene, camera);
  }
}

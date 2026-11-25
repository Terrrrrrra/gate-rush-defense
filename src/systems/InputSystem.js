import { GameConfig } from '../game/GameConfig.js';

/**
 * Pointer Events 하나로 마우스/터치/펜 입력을 통합 처리한다.
 * - 누르고 있는 동안 발사(firing)
 * - 좌우 드래그 거리 → 대포 목표 x (상대 드래그 방식)
 * 키보드(←/→, A/D, Space)도 보조 입력으로 지원.
 */
export class InputSystem {
  constructor(element) {
    this.el = element;
    this.enabled = false;
    this.pointerId = null;
    this.firing = false;
    this.startX = 0;
    this.startTargetX = 0;
    this.targetX = 0;
    this.keyDir = 0;
    this.keys = new Set();
    this.onPower = null;
    this.onFirstInteract = null;

    this._down = this.onDown.bind(this);
    this._move = this.onMove.bind(this);
    this._up = this.onUp.bind(this);
    element.addEventListener('pointerdown', this._down);
    element.addEventListener('pointermove', this._move);
    element.addEventListener('pointerup', this._up);
    element.addEventListener('pointercancel', this._up);
    element.addEventListener('lostpointercapture', this._up);

    // 브라우저 기본 제스처(스크롤, 핀치줌, 더블탭 확대, 길게 눌러 메뉴) 차단
    const prevent = (e) => e.preventDefault();
    element.addEventListener('touchstart', prevent, { passive: false });
    element.addEventListener('touchmove', prevent, { passive: false });
    document.addEventListener('gesturestart', prevent);
    document.addEventListener('contextmenu', prevent);
    document.addEventListener(
      'touchmove',
      (e) => {
        if (e.touches.length > 1) e.preventDefault();
      },
      { passive: false }
    );

    window.addEventListener('keydown', (e) => {
      this.keys.add(e.code);
      if (e.code === 'Space') {
        e.preventDefault();
        if (this.enabled) this.onPower?.();
      }
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.release();
    });
  }

  /** 드래그 1픽셀이 월드 x 로 얼마인지 */
  get pixelToWorld() {
    const span = GameConfig.world.halfWidth * 2 * GameConfig.cannon.dragSensitivity;
    // PC 처럼 넓은 화면에서는 너무 둔하지 않도록 기준 폭 상한
    return span / Math.min(this.el.clientWidth || 400, 700);
  }

  setCannonX(x) {
    this.targetX = x;
  }

  onDown(e) {
    if (!this.enabled || this.pointerId !== null) return;
    e.preventDefault();
    this.pointerId = e.pointerId;
    try {
      this.el.setPointerCapture(e.pointerId);
    } catch {
      /* noop */
    }
    this.startX = e.clientX;
    this.startTargetX = this.targetX;
    this.firing = true;
    this.onFirstInteract?.();
  }

  onMove(e) {
    if (e.pointerId !== this.pointerId) return;
    e.preventDefault();
    this.targetX = this.startTargetX + (e.clientX - this.startX) * this.pixelToWorld;
    const lim = GameConfig.world.halfWidth - GameConfig.cannon.margin;
    // 경계에 닿으면 드래그 기준점을 재설정해 반대로 즉시 움직일 수 있게 한다
    if (this.targetX < -lim || this.targetX > lim) {
      this.targetX = Math.max(-lim, Math.min(lim, this.targetX));
      this.startX = e.clientX;
      this.startTargetX = this.targetX;
    }
  }

  onUp(e) {
    if (e.pointerId !== this.pointerId) return;
    this.release();
  }

  release() {
    if (this.pointerId !== null) {
      try {
        this.el.releasePointerCapture(this.pointerId);
      } catch {
        /* noop */
      }
    }
    this.pointerId = null;
    this.firing = false;
  }

  update(dt) {
    let dir = 0;
    if (this.keys.has('ArrowLeft') || this.keys.has('KeyA')) dir -= 1;
    if (this.keys.has('ArrowRight') || this.keys.has('KeyD')) dir += 1;
    if (dir && this.enabled) {
      const lim = GameConfig.world.halfWidth - GameConfig.cannon.margin;
      this.targetX = Math.max(-lim, Math.min(lim, this.targetX + dir * GameConfig.cannon.keyboardSpeed * dt));
    }
  }

  /** 키보드 방향키를 누르고 있어도 발사 */
  get isFiring() {
    return this.enabled && (this.firing || this.keys.has('ArrowLeft') || this.keys.has('ArrowRight') || this.keys.has('KeyA') || this.keys.has('KeyD') || this.keys.has('ArrowUp') || this.keys.has('KeyW'));
  }
}

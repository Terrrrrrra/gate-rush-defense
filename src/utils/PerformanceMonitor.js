/**
 * FPS 를 측정하고, 일정 시간 이상 낮게 유지되면 콜백으로 품질 하향을 요청한다.
 */
export class PerformanceMonitor {
  constructor({ lowFps = 28, sustain = 4, onLow = null, element = null } = {}) {
    this.lowFps = lowFps;
    this.sustain = sustain;
    this.onLow = onLow;
    this.element = element;
    this.frames = 0;
    this.acc = 0;
    this.fps = 60;
    this.lowTime = 0;
    this.cooldown = 4; // 시작 직후에는 판단 보류
    this.extraText = '';
  }

  update(dt) {
    this.frames++;
    this.acc += dt;
    if (this.cooldown > 0) this.cooldown -= dt;
    if (this.acc >= 0.5) {
      this.fps = this.frames / this.acc;
      this.frames = 0;
      this.acc = 0;
      if (this.element && !this.element.classList.contains('hidden')) {
        this.element.textContent = `${this.fps.toFixed(0)} FPS ${this.extraText}`;
      }
    }
    if (this.cooldown <= 0) {
      if (this.fps < this.lowFps) {
        this.lowTime += dt;
        if (this.lowTime > this.sustain) {
          this.lowTime = 0;
          this.cooldown = 6;
          this.onLow?.(this.fps);
        }
      } else {
        this.lowTime = Math.max(0, this.lowTime - dt);
      }
    }
  }

  reset() {
    this.cooldown = 4;
    this.lowTime = 0;
  }
}

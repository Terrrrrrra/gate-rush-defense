import * as THREE from 'three';
import { ObjectPool } from '../systems/ObjectPool.js';
import { formatNumber } from '../utils/MathUtils.js';

const $ = (id) => document.getElementById(id);

/**
 * HTML/CSS UI 레이어. Three.js 캔버스 위에 겹쳐 표시한다.
 * DOM 갱신은 값이 바뀔 때만 수행해 레이아웃 비용을 줄인다.
 */
export class UIManager {
  constructor() {
    this.el = {
      hud: $('hud'),
      score: $('score-value'),
      playerHpFill: $('player-hp-fill'),
      playerHpText: $('player-hp-text'),
      enemyList: $('enemy-list'),
      unitCount: $('unit-count'),
      unitBadge: $('unit-badge'),
      energyFill: $('energy-fill'),
      energyBar: document.querySelector('.energy-bar'),
      powerBtn: $('power-btn'),
      popupLayer: $('popup-layer'),
      dragHint: $('drag-hint'),
      knob: $('control-knob'),
      fps: $('fps'),
      start: $('screen-start'),
      pause: $('screen-pause'),
      result: $('screen-result'),
      resultTitle: $('result-title'),
      resultStars: $('result-stars'),
      resultScore: $('result-score'),
      resultDetail: $('result-detail'),
      loading: $('loading'),
    };
    this.cache = {};
    this.baseCards = [];
    this.baseLabels = [];
    this._v = new THREE.Vector3();

    this.popups = new ObjectPool(
      () => {
        const d = document.createElement('div');
        d.className = 'popup';
        d.style.display = 'none';
        this.el.popupLayer.appendChild(d);
        return { el: d, t: 0, life: 1, pos: new THREE.Vector3(), rise: 1 };
      },
      (p) => {
        p.el.style.display = 'none';
      },
      16
    );
  }

  hideLoading() {
    this.el.loading.classList.add('hidden');
  }

  /** 버튼 바인딩 */
  bind({ onStart, onRestart, onPause, onResume, onPower, onQuality }) {
    const tap = (el, fn) =>
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        fn();
      });
    tap($('start-btn'), onStart);
    tap($('restart-btn'), onRestart);
    tap($('restart-btn-pause'), onRestart);
    tap($('pause-btn'), onPause);
    tap($('resume-btn'), onResume);
    tap(this.el.powerBtn, onPower);
    document.querySelectorAll('[data-quality]').forEach((b) => tap(b, () => onQuality(b.dataset.quality)));
    // FPS 표시 토글 (점수판을 길게 누르거나 ?debug)
    if (new URLSearchParams(location.search).has('debug')) this.el.fps.classList.remove('hidden');
    $('score-value').parentElement.addEventListener('dblclick', () => this.el.fps.classList.toggle('hidden'));
  }

  setQualityChip(name) {
    document.querySelectorAll('[data-quality]').forEach((b) => b.classList.toggle('active', b.dataset.quality === name));
  }

  buildEnemyList(bases) {
    this.el.enemyList.innerHTML = '';
    this.baseCards = bases.map((b) => {
      const card = document.createElement('div');
      card.className = 'enemy-card';
      const hex = '#' + b.color.getHexString();
      card.innerHTML = `
        <div class="enemy-icon" style="background:${hex}">🏰</div>
        <div class="enemy-meta">
          <div class="enemy-name" style="color:${hex}">${b.name}</div>
          <div class="hp-bar"><div class="hp-fill" style="background:linear-gradient(${hex}cc, ${hex})"></div><span></span></div>
        </div>`;
      this.el.enemyList.appendChild(card);
      return { card, fill: card.querySelector('.hp-fill'), text: card.querySelector('span'), last: -1, hitT: 0 };
    });
    // 기지 머리 위 체력바
    this.baseLabels.forEach((l) => l.el.remove());
    this.baseLabels = bases.map((b) => {
      const el = document.createElement('div');
      el.className = 'base-hp';
      const hex = '#' + b.color.getHexString();
      el.innerHTML = `<div class="hp-bar"><div class="hp-fill" style="background:linear-gradient(${hex}cc, ${hex})"></div></div>`;
      this.el.popupLayer.appendChild(el);
      return { el, fill: el.querySelector('.hp-fill'), base: b };
    });
  }

  updateBases(bases, dt) {
    bases.forEach((b, i) => {
      const c = this.baseCards[i];
      const hp = Math.ceil(b.hp);
      if (c.last !== hp) {
        const ratio = b.hp / b.maxHp;
        c.fill.style.transform = `scaleX(${ratio})`;
        this.baseLabels[i].fill.style.transform = `scaleX(${ratio})`;
        c.text.textContent = hp > 0 ? formatNumber(hp) : 'DESTROYED';
        if (c.last > hp) {
          c.hitT = 0.12;
          c.card.classList.add('hit');
        }
        c.card.classList.toggle('dead', hp <= 0);
        c.last = hp;
      }
      if (c.hitT > 0) {
        c.hitT -= dt;
        if (c.hitT <= 0) c.card.classList.remove('hit');
      }
    });
  }

  setText(key, el, value) {
    if (this.cache[key] === value) return;
    this.cache[key] = value;
    el.textContent = value;
  }

  setScore(v) {
    this.setText('score', this.el.score, formatNumber(v));
  }

  setPlayerHp(hp, max) {
    const v = Math.ceil(hp);
    if (this.cache.php === v) return;
    this.cache.php = v;
    this.el.playerHpFill.style.transform = `scaleX(${Math.max(0, hp / max)})`;
    this.el.playerHpText.textContent = `${v} / ${max}`;
  }

  setUnits(n) {
    if (this.cache.units === n) return;
    if (this.cache.units !== undefined && n > this.cache.units + 5) {
      this.el.unitBadge.classList.add('bump');
      clearTimeout(this._bumpT);
      this._bumpT = setTimeout(() => this.el.unitBadge.classList.remove('bump'), 120);
    }
    this.cache.units = n;
    this.el.unitCount.textContent = formatNumber(n);
  }

  setEnergy(e, max) {
    const r = Math.round((e / max) * 100);
    if (this.cache.energy === r) return;
    this.cache.energy = r;
    this.el.energyFill.style.transform = `scaleX(${r / 100})`;
    const full = r >= 100;
    this.el.powerBtn.disabled = !full;
    this.el.energyBar.classList.toggle('full', full);
  }

  setKnob(x, halfWidth) {
    const pct = 50 + (x / halfWidth) * 50;
    const v = pct.toFixed(1);
    if (this.cache.knob === v) return;
    this.cache.knob = v;
    this.el.knob.style.left = `${v}%`;
  }

  fadeHint() {
    this.el.dragHint.classList.add('fade');
  }

  resetHint() {
    this.el.dragHint.classList.remove('fade');
  }

  shake() {
    this.el.hud.classList.remove('shake-ui');
    void this.el.hud.offsetWidth;
    this.el.hud.classList.add('shake-ui');
  }

  popText(x, y, z, text, cls = '', life = 0.9, rise = 1.4) {
    if (this.popups.active.length > 40) return;
    const p = this.popups.acquire();
    p.t = 0;
    p.life = life;
    p.rise = rise;
    p.pos.set(x, y, z);
    p.el.className = 'popup ' + cls;
    p.el.textContent = text;
    p.el.style.display = 'block';
  }

  /** 3D 좌표를 화면 좌표로 투영해 DOM 위치 갱신 */
  updateWorldUI(dt, camera, w, h) {
    const v = this._v;
    this.popups.updateActive((p) => {
      p.t += dt;
      const k = p.t / p.life;
      if (k >= 1) return false;
      v.copy(p.pos);
      v.y += k * p.rise;
      v.project(camera);
      const sx = (v.x * 0.5 + 0.5) * w;
      const sy = (-v.y * 0.5 + 0.5) * h;
      const pop = k < 0.15 ? 0.6 + (k / 0.15) * 0.6 : 1.2 - Math.min(0.2, (k - 0.15) * 0.5);
      p.el.style.transform = `translate(-50%, -50%) translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px) scale(${pop.toFixed(3)})`;
      p.el.style.opacity = k > 0.7 ? ((1 - k) / 0.3).toFixed(3) : '1';
      return true;
    });
    for (const l of this.baseLabels) {
      if (!l.base.alive) {
        l.el.style.display = 'none';
        continue;
      }
      l.el.style.display = '';
      v.copy(l.base.hpAnchor).project(camera);
      const sx = (v.x * 0.5 + 0.5) * w;
      const sy = (-v.y * 0.5 + 0.5) * h;
      l.el.style.transform = `translate(-50%, -100%) translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px)`;
    }
  }

  clearPopups() {
    this.popups.releaseAll();
  }

  showHud(show) {
    this.el.hud.classList.toggle('hidden', !show);
  }

  showStart(show) {
    this.el.start.classList.toggle('hidden', !show);
  }

  showPause(show) {
    this.el.pause.classList.toggle('hidden', !show);
  }

  showResult(win, score, detail) {
    const e = this.el;
    e.resultTitle.textContent = win ? 'VICTORY!' : 'DEFEAT';
    e.resultTitle.classList.toggle('lose', !win);
    const stars = win ? detail.stars : 0;
    [...e.resultStars.children].forEach((s, i) => s.classList.toggle('on', i < stars));
    e.resultScore.textContent = formatNumber(score);
    e.resultDetail.innerHTML = `처치한 적 <b>${formatNumber(detail.kills)}</b> · 최대 병력 <b>${formatNumber(detail.maxUnits)}</b><br>플레이 시간 ${detail.time.toFixed(1)}초`;
    e.result.classList.remove('hidden');
  }

  hideResult() {
    this.el.result.classList.add('hidden');
  }
}

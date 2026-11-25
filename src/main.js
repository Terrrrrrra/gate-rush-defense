import './style.css';
import { Game } from './game/Game.js';

function boot() {
  const container = document.getElementById('canvas-root');
  let game;
  try {
    game = new Game(container);
  } catch (err) {
    console.error(err);
    document.getElementById('loading').innerHTML =
      '<div class="screen-card"><b>WebGL 을 초기화하지 못했습니다.</b><p class="subtitle">다른 브라우저에서 시도해 주세요.</p></div>';
    return;
  }
  game.ui.hideLoading();
  game.startLoop();
}

boot();

// Service Worker: 프로덕션 빌드에서만 등록 (GitHub Pages 하위 경로를 고려해 BASE_URL 기준)
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    const base = import.meta.env.BASE_URL;
    navigator.serviceWorker.register(`${base}sw.js`, { scope: base }).catch((e) => console.warn('SW 등록 실패', e));
  });
}

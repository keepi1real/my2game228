'use strict';
// Точка входа: создаём игру и запускаем цикл.

window.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('game');
  const game = new Game(canvas);
  window.game = game;
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    game.update(dt);
    game.renderer.render();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
});

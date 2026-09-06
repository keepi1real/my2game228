'use strict';
// Точка входа: создаём игру и запускаем цикл.

function startGame() {
  const canvas = document.getElementById('game');
  const game = new Game(canvas);
  window.game = game;
  if(window.SEAMLESS_START){if(!game.resumeSeamlessJourney())game.startSeamlessJourney();}
  else if(window.ROOM_ROUTE_START){if(!game.resumeJourney())game.startJourney();}
  else if(window.ROOM_VISUAL_START)game.startVisualRoom();
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    game.update(dt);
    game.renderer.render();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', startGame);
else startGame();


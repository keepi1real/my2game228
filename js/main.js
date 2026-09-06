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
  // Следующий кадр планируется в finally, а не после render. Раньше он стоял
  // последней строкой, и любое исключение внутри кадра означало, что кадра
  // больше не будет никогда: картинка замирала без единого следа на экране, а
  // музыка продолжала играть, потому что Web Audio не зависит от кадров. Со
  // стороны это выглядело как «игра не запускается».
  //
  // Ошибку показываем один раз: 60 одинаковых записей в секунду ничего не
  // объясняют. Если падает каждый кадр подряд — цикл останавливаем осознанно и
  // говорим об этом, иначе игра молча жгла бы батарею.
  let brokenFrames = 0, reported = false;
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    let ok = false;
    try {
      game.update(dt);
      game.renderer.render();
      ok = true;
    } catch (err) {
      if (!reported) { reported = true; console.error('Ошибка в кадре игры:', err); }
    } finally {
      if (ok) brokenFrames = 0;
      else brokenFrames++;
      if (brokenFrames < 240) requestAnimationFrame(frame);
      else console.error('Игровой цикл остановлен: 240 кадров подряд с ошибкой.');
    }
  }
  requestAnimationFrame(frame);
}
if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', startGame);
else startGame();


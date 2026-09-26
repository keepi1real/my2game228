/* Smooth browser scaling on the playable Tide Observatory only. The world
 * canvas remains 1024×640; no camera, collision or saved state changes. */
(() => {
  'use strict';
  if (window.V21TideDisplay) return;
  const render = Renderer.prototype.render;
  let canvas = null, previous = '', assigned = '';

  Renderer.prototype.render = function (...args) {
    const game = this.g;
    const target = game?.canvas;
    const observatory = game?.journey?.seamless &&
      game.journey.levelId === 'tideobservatory' && game.journey.v21MapVersion === 21 &&
      game.state !== 'menu';
    if (canvas && (canvas !== target || !observatory)) {
      // Menus and fullscreen UI can replace cssText themselves. Restore only
      // the exact inline style set by this patch, preserving their own layout.
      if (canvas.style?.cssText === assigned) canvas.style.imageRendering = previous;
      canvas = null;
    }
    if (observatory && target?.style) {
      if (canvas !== target) {
        canvas = target;
        previous = target.style.imageRendering;
      }
      if (target.style.imageRendering !== 'auto') target.style.imageRendering = 'auto';
      assigned = target.style.cssText;
    }
    return render.apply(this, args);
  };
  window.V21TideDisplay = Object.freeze({version:21});
})();

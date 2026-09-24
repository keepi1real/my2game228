'use strict';
// Karg Ironfang: the four animation rows in assets/karg-ironfang/manifest.json.
// The game already owns movement, combat timing and facing; this module only
// selects atlas frames and leaves all other actors to ActorMotion.
const RiggedEnemyOverlay = (() => {
  const sheet = new Image();
  sheet.src = 'assets/karg-ironfang/sprite-sheet-alpha.png';
  const cell = 192, frames = 8, height = 54;
  // In the source atlas the feet are at y=174 and the head at about y=19.
  const scale = height / 155;
  const previousDraw = ActorMotion.draw;
  const previousCorpse = ActorMotion.corpse;

  function frame(e, s) {
    if (e.state === 'windup' || e.telegraph) {
      const t = e.telegraph;
      const progress = t ? 1 - t.time / t.total : 1 - e.windup / (e.def?.windup || .35);
      return {row: 3, index: Math.min(frames - 1, Math.floor(Math.max(0, progress) * frames))};
    }
    if (s.left > 0 && s.action === 'roar') {
      return {row: 3, index: Math.min(frames - 1, Math.floor((1 - s.left / s.total) * frames))};
    }
    if (s.left > 0 && s.action === 'attack') {
      return {row: 2, index: Math.min(frames - 1, Math.floor((1 - s.left / s.total) * frames))};
    }
    if (s.walk > .2) return {row: 1, index: Math.floor(s.age * 12) % frames};
    return {row: 0, index: Math.floor(s.age * 8) % frames};
  }

  function draw(c, group, id, e, options = {}) {
    if (group !== 'enemies' || id !== 'orc' || !sheet.complete || !sheet.naturalWidth) {
      return previousDraw(c, group, id, e, options);
    }
    const s = options.state || ActorMotion.state(e);
    const {row, index} = frame(e, s);
    c.save();
    c.translate(e.x, e.y);
    c.scale((s.facing || 1) * scale, scale);
    if (s.hit > 0) c.filter = `brightness(${1 + Math.min(1, s.hit / .15)})`;
    c.imageSmoothingEnabled = false;
    c.drawImage(sheet, index * cell, row * cell, cell, cell, -96, -174, cell, cell);
    c.restore();
    return true;
  }

  function corpse(c, f) {
    if (f.group !== 'enemies' || f.id !== 'orc' || !sheet.complete || !sheet.naturalWidth) {
      return previousCorpse(c, f);
    }
    const t = 1 - f.life / f.total;
    c.save();
    c.translate(f.x, f.y);
    c.globalAlpha *= Math.pow(1 - t, .7) * .8;
    c.rotate(f.facing * Math.min(1, t * 3) * 1.45);
    c.scale(1, 1 - Math.min(.65, t));
    draw(c, f.group, f.id, {x: 0, y: 0}, {state: {age: 0, walk: 0, facing: f.facing, left: 0, total: 1, hit: 0}});
    c.restore();
  }

  ActorMotion.draw = draw;
  ActorMotion.corpse = corpse;
  return {frame, sheet};
})();

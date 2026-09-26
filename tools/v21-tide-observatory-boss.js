// A chapter-specific third attack. Reuse RootCombat's validated lane geometry
// and persisted solar-spokes kind so in-progress boss saves remain resumable.
(() => {
  'use strict';
  const previousAbility = Game.prototype.updateBossAbilities;
  const previousRender = Renderer.prototype.render;
  const observatory = (g, e) => g.journey?.seamless && g.journey.levelId === 'tideobservatory' &&
    g.journey.v21MapVersion === 21 && e?.isBoss && e.type === 'tidewarden';
  Game.prototype.updateBossAbilities = function (e, dt, d, los) {
    if (!observatory(this, e)) return previousAbility.call(this, e, dt, d, los);
    // Stored with the other ability timers by the game's normal combat save.
    e.abilityTimers.meridian ??= 7.8;
    const used = previousAbility.call(this, e, dt, d, los);
    if (used || e.telegraph || e.stun > 0 || e.rootRecovery > 0 || this.state !== 'run') return used;
    e.abilityTimers.meridian = Math.max(-1, e.abilityTimers.meridian - dt);
    if (e.abilityTimers.meridian > 0 || !los || d > 430 || this.player.isInvisible()) return false;
    const p = this.player, phaseTwo = e.phase === 2;
    // The warning is fixed at the player's position; the corners stay clear.
    const lane = {shape: 'lane', x: p.x, y: p.y, len: phaseTwo ? 190 : 165,
      back: phaseTwo ? 190 : 165, half: phaseTwo ? 26 : 23};
    const shapes = [{...lane, angle: 0}, {...lane, angle: Math.PI / 2}];
    if (phaseTwo) shapes.push({...lane, angle: Math.PI / 4, half: 19});
    RootCombat.warn(e, 'solar-spokes', shapes, phaseTwo ? 1.35 : 1.55,
      {fixed: true, v21Meridian: true});
    e.abilityTimers.meridian = phaseTwo ? 7 : 8.4;
    e.attackTimer = Math.max(e.attackTimer, 1.7);
    return true;
  };
  Renderer.prototype.render = function () {
    previousRender.call(this);
    const g = this.g, e = g.boss;
    if (!observatory(g, e) || g.state !== 'run' || !e.telegraph?.v21Meridian ||
      dist(e.x, e.y, g.player.x, g.player.y) >= 1000) return;
    RoutePaint.plate(this.ctx, 756, 78, 254, 25);
    RoutePaint.text(this.ctx, 'МЕРИДИАН: ВЫЙДИ ИЗ ЛИНИЙ', 883, 91, '#bde7df', 10);
  };
})();

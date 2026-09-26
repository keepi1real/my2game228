// v20 preview: bounded recovery for a wave that cannot place its reinforcements.
// Install after maps/enemies, before main.js. Never awards loot or kills actors.
(() => {
  const TIMEOUT = 30;
  const active = g => g.journey?.seamless && g.journey.v20MapVersion === 20;
  const previousUpdate = EncounterDirector.update;
  EncounterDirector.update = function(g, dt) {
    const before = active(g) ? new Map(g.journey.rooms.map(r => [r, r.encounter?.queued.length || 0])) : null;
    const result = previousUpdate.call(this, g, dt);
    if (!active(g) || g.state !== 'run' || g.worldTour || !Number.isFinite(dt) || dt <= 0) return result;
    for (const room of g.journey.rooms) {
      const s = room.encounter;
      if (!s || room.cleared || !room.active || g.journey.current !== room.id) continue;
      // A normal fight (including the population cap and a living boss) is never
      // timed out. Once it finishes, the empty arena gets a full retry window.
      const fighting = g.enemies.some(e => e.alive && e.homeRoom === room.id);
      const pending = s.queued.length + s.spawns.length;
      if (fighting || !pending || s.delay > 0 || s.queued.length < before.get(room)) {
        s.v20SpawnBlockedSeconds = 0;
        continue;
      }
      s.v20SpawnBlockedSeconds = Math.min(TIMEOUT, (s.v20SpawnBlockedSeconds || 0) + dt);
      if (s.v20SpawnBlockedSeconds < TIMEOUT) continue;
      // Retire all remaining waves, so pending() cannot schedule another blocked
      // wave on the following tick. The usual room-clear path owns its reward.
      s.v20SpawnCancelled = pending;
      s.v20SpawnRecovery = 'blocked-spawns';
      s.queued = [];
      s.spawns = [];
      s.delay = -1;
      s.wave = Math.max(s.wave, EncounterDirector.plan(g.journey, room).length);
      g.journey.notice = 'Подкрепление не смогло войти. Путь освобождён.';
      g.journey.noticeTime = 5;
      console.warn('[v20-wave-recovery] blocked-spawns', {room:room.id, cancelled:pending, seconds:TIMEOUT});
      g.saveJourney();
    }
    return result;
  };
  const previousValidate = EncounterDirector.validate;
  EncounterDirector.validate = function(data) {
    const result = previousValidate.call(this, data);
    for (const room of data.rooms || []) {
      const s = room.encounter;
      if (!s) continue;
      if (s.v20SpawnBlockedSeconds !== undefined &&
          (!Number.isFinite(s.v20SpawnBlockedSeconds) || s.v20SpawnBlockedSeconds < 0 || s.v20SpawnBlockedSeconds > TIMEOUT))
        throw Error('Invalid wave recovery timer');
      if (s.v20SpawnCancelled !== undefined &&
          (!Number.isInteger(s.v20SpawnCancelled) || s.v20SpawnCancelled < 1 || s.v20SpawnCancelled > 13))
        throw Error('Invalid wave recovery count');
      if (s.v20SpawnRecovery !== undefined && s.v20SpawnRecovery !== 'blocked-spawns')
        throw Error('Invalid wave recovery reason');
    }
    return result;
  };
})();

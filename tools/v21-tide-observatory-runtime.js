// Install after v20-maps and BEFORE v20-save-atomic. Its outer transaction must
// commit mapVersion and chapterVersion in one write. The chapter is reached from
// ashen only by expeditions carrying chapterVersion 21. Existing checkpoints
// retain the ten-chapter route and their original mapVersion 20 geometry.
(() => {
  'use strict';
  const VERSION = 21;
  const previousStart = Game.prototype.startSeamlessJourney;
  const previousResume = Game.prototype.resumeSeamlessJourney;
  const previousDescend = Game.prototype.descendSeamlessFloor;
  const previousSave = Game.prototype.saveJourney;
  let building = false;
  function checkpoint() {
    try { return JSON.parse(localStorage.getItem(SeamlessFloor.key)); }
    catch (_) { return null; }
  }
  // A save can occur inside start, resume and descend before those calls return.
  function saveWithMarker(game, args) {
    const result = previousSave.apply(game, args);
    const j = game.journey;
    if (!j?.seamless || (!building && j.v21MapVersion !== VERSION)) return result;
    try {
      const data = checkpoint();
      if (data?.version === 4 && data.seed === j.seed && data.levelId === j.levelId && data.mapVersion === 20) {
        data.chapterVersion = VERSION;
        localStorage.setItem(SeamlessFloor.key, JSON.stringify(data));
      }
    } catch (_) { /* Existing save failure handling keeps this run playable. */ }
    return result;
  }
  Game.prototype.saveJourney = function (...args) { return saveWithMarker(this, args); };
  Game.prototype.startSeamlessJourney = function (...args) {
    const wasBuilding = building;
    building = true;
    try {
      const result = previousStart.apply(this, args);
      if (result !== false && this.journey?.seamless) this.journey.v21MapVersion = VERSION;
      return result;
    } finally { building = wasBuilding; }
  };
  Game.prototype.resumeSeamlessJourney = function (...args) {
    const saved = checkpoint();
    const marked = saved?.mapVersion === 20 && saved.chapterVersion === VERSION;
    if (saved?.chapterVersion !== undefined && !marked) return false;
    const wasBuilding = building;
    building = marked;
    try {
      const result = previousResume.apply(this, args);
      if (result && marked && this.journey?.levelId === saved.levelId && this.journey.seed === saved.seed) {
        this.journey.v21MapVersion = VERSION;
      }
      return result;
    } finally { building = wasBuilding; }
  };
  Game.prototype.descendSeamlessFloor = function (...args) {
    const marked = this.journey?.v21MapVersion === VERSION;
    const wasBuilding = building;
    building = marked;
    try {
      const result = previousDescend.apply(this, args);
      if (result && marked && this.journey?.seamless) this.journey.v21MapVersion = VERSION;
      return result;
    } finally { building = wasBuilding; }
  };
  // RoomCraft replaces the landmark on this biome with its v15 sprite ID.
  // Reuse a registered atlas rectangle until the chapter's artwork loads.
  WorldDetail.themes.tideobservatory = {
    ...WorldDetail.themes.tide, base: '#283f4c', trim: '#b9a778', light: '#80d5cd', water: false
  };
  RoomCraft.palettes.tideobservatory = ['#243e4b', '#b29a69'];
  for (const row of [0, 1]) {
    BiomeArtV3.sprites[`detail-tideobservatory-${row}`] = BiomeArtV3.sprites[`detail-tide-${row}`];
  }
  BiomeArtV3.sprites['landmark-v15-tideobservatory'] ??= BiomeArtV3.sprites['landmark-v15-tide'];
  if (!WorldTour.order.includes('tideobservatory')) WorldTour.order.push('tideobservatory');
  WorldTour.descriptions.tideobservatory = 'Сухие водомерные каналы, латунные полумесяцы и нулевой меридиан.';
  window.V21TideObservatory = Object.freeze({ version: VERSION, id: 'tideobservatory' });
})();

'use strict';
// Постоянный прогресс между забегами (localStorage).

const SAVE_KEY = 'shadows-undermountain-save-v1';
const WRITE_EVERY = 2; // секунд между отложенными записями прогресса

function defaultSave() {
  const heroes = {};
  for (const h of HEROES) heroes[h.id] = { xp: 0, level: 1, unlocked: h.unlockCost === 0, runs: 0, wins: 0 };
  return {
    shards: 0,
    heroes,
    upgrades: {},
    startItems: { startNone: true },
    stats: { runs: 0, kills: 0, bestFloor: 0, wins: 0, bossKills: 0 },
    lastHero: 'arator',
    lastStartItem: 'startNone',
  };
}

const Save = {
  data: null,
  // Запись в localStorage синхронная: JSON.stringify всего сейва на каждом убийстве
  // подтормаживал бой. Частые изменения помечаются mark(), а на диск уходят раз в
  // WRITE_EVERY секунд из игрового цикла. Всё, после чего прогресс терять нельзя
  // (конец этажа, конец забега, закрытие вкладки), вызывает save() напрямую.
  dirty: false, sinceWrite: 0,
  load() {
    let d = null;
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) d = JSON.parse(raw);
    } catch (e) { d = null; }
    const def = defaultSave();
    if (!d) d = def;
    // Мягкая миграция: доклеиваем недостающие поля.
    for (const k of Object.keys(def)) if (d[k] === undefined) d[k] = def[k];
    for (const h of HEROES) if (!d.heroes[h.id]) d.heroes[h.id] = def.heroes[h.id];
    this.data = d;
    return d;
  },
  save() {
    this.dirty = false; this.sinceWrite = 0;
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.data)); } catch (e) { /* приватный режим и т.п. */ }
  },
  // Отложенная запись: данные изменились, но ждать кадра-другого не страшно.
  mark() { this.dirty = true; },
  tick(dt) { if (!this.dirty) return; this.sinceWrite += dt; if (this.sinceWrite >= WRITE_EVERY) this.save(); },
  flush() { if (this.dirty) this.save(); },
  reset() { this.data = defaultSave(); this.save(); },
  hero(id) { return this.data.heroes[id]; },
  rank(upId) { return this.data.upgrades[upId] || 0; },
  // Итоговые модификаторы мета-прокачки.
  bonuses() {
    const s = { hpMult: 1, dmgMult: 1, speedMult: 1, cdr: 0, startPotions: 0, startGold: 0, xpMult: 1, potionMult: 1, dropMult: 1 };
    for (const u of UPGRADES) { const r = this.rank(u.id); if (r > 0) u.apply(s, r); }
    return s;
  },
  // Начисление опыта герою; возвращает число полученных уровней.
  addHeroXp(id, amount) {
    const h = this.hero(id);
    h.xp += amount;
    let ups = 0;
    while (h.level < MAX_LEVEL && h.xp >= xpToNext(h.level)) { h.xp -= xpToNext(h.level); h.level++; ups++; }
    if (h.level >= MAX_LEVEL) h.xp = Math.min(h.xp, xpToNext(h.level) - 1);
    return ups;
  },
};

'use strict';
// Постоянный прогресс между забегами (localStorage).

const SAVE_KEY = 'shadows-undermountain-save-v1';

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
    this.dirty = false; this.timer = 0;
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.data)); } catch (e) { /* приватный режим и т.п. */ }
  },
  // Отложенная запись. localStorage синхронный, а JSON.stringify всего прогресса
  // в разгар боя — заметный провал кадра на телефоне. Убийства помечают прогресс
  // грязным, а на диск он уходит раз в пару секунд; переходы между этажами и
  // конец забега по-прежнему пишут сразу через save().
  dirty: false,
  timer: 0,
  saveSoon() { this.dirty = true; },
  tick(dt) {
    if (!this.dirty) return;
    this.timer += dt;
    if (this.timer >= 2) this.save();
  },
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

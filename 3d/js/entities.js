'use strict';
// Игровые сущности: герой, враги, снаряды, лут, эффекты.

class Player {
  constructor(heroDef, level, meta) {
    this.hero = heroDef;
    this.level = level;
    this.meta = meta;
    this.x = 0; this.y = 0; this.r = 12;
    this.aim = { x: 1, y: 0 };
    this.vx = 0; this.vy = 0;
    this.equipment = { weapon: null, armor: null, trinket: null };
    this.bag = [];
    this.consumables = { potion: 0, lembas: 0, fireScroll: 0, elixir: 0 };
    this.buffs = [];
    this.shield = 0; this.shieldTime = 0;
    this.attackTimer = 0;
    this.skillCds = [0, 0, 0];
    this.dodgeCd = 0;
    this.dash = null;
    this.poison = 0; this.poisonTime = 0;
    this.slowTime = 0; this.stunTime = 0;
    this.invulnTime = 0; this.hurtFlash = 0;
    this.sneak = false;
    this.gold = 0;
    this.swing = 0; this.swingAngle = 0; this.recoil = 0;
    this.hp = this.maxHp;
  }
  // ---- Статы ----
  equipStat(name) {
    let v = 0;
    for (const k in this.equipment) { const it = this.equipment[k]; if (it && it.stats[name]) v += it.stats[name]; }
    return v;
  }
  buffStat(name) {
    let v = 0;
    for (const b of this.buffs) if (b.stat === name) v += b.value;
    return v;
  }
  get maxHp() {
    const base = (this.hero.hp + this.hero.hpPerLevel * (this.level - 1) + this.equipStat('hp')) * this.meta.hpMult;
    return Math.round(base);
  }
  damage() {
    const base = this.hero.dmg + this.hero.dmgPerLevel * (this.level - 1) + this.equipStat('dmg');
    return base * this.meta.dmgMult * (1 + this.buffStat('dmg'));
  }
  speed() {
    let s = (this.hero.speed + this.equipStat('speed')) * this.meta.speedMult * (1 + this.buffStat('speed'));
    if (this.slowTime > 0) s *= 0.6;
    return s;
  }
  armor() { return this.hero.armor + this.equipStat('armor') + this.buffStat('armor'); }
  crit() { return this.hero.crit + this.equipStat('crit') + this.buffStat('crit'); }
  attackCooldown() { return this.hero.attack.cooldown / (1 + this.equipStat('attackSpeed')); }
  cdr() { return clamp(this.meta.cdr + this.equipStat('cdr'), 0, 0.6); }
  lifesteal() { return this.equipStat('lifesteal'); }
  xpMult() { return this.meta.xpMult * (1 + this.equipStat('xpGain')); }
  goldMult() { return 1 + this.equipStat('goldFind'); }
  regen() { return this.equipStat('regen') + this.buffStat('regen'); }
  isInvisible() { return this.buffStat('invisible') > 0; }
  addBuff(stat, value, time) {
    // Одинаковые баффы не складываются, а обновляются.
    const ex = this.buffs.find((b) => b.stat === stat && b.value === value);
    if (ex) { ex.time = Math.max(ex.time, time); return; }
    this.buffs.push({ stat, value, time });
  }
  tickTimers(dt) {
    this.attackTimer = Math.max(0, this.attackTimer - dt);
    for (let i = 0; i < 3; i++) this.skillCds[i] = Math.max(0, this.skillCds[i] - dt);
    this.dodgeCd = Math.max(0, this.dodgeCd - dt);
    this.invulnTime = Math.max(0, this.invulnTime - dt);
    this.hurtFlash = Math.max(0, this.hurtFlash - dt);
    this.slowTime = Math.max(0, this.slowTime - dt);
    this.stunTime = Math.max(0, this.stunTime - dt);
    this.swing = Math.max(0, this.swing - dt);
    this.recoil = Math.max(0, this.recoil - dt);
    if (this.shieldTime > 0) { this.shieldTime -= dt; if (this.shieldTime <= 0) this.shield = 0; }
    for (let i = this.buffs.length - 1; i >= 0; i--) { this.buffs[i].time -= dt; if (this.buffs[i].time <= 0) this.buffs.splice(i, 1); }
    if (this.buffStat('invisible') <= 0) this.sneak = this.sneak && this.buffs.some((b) => b.stat === 'invisible');
  }
  bagFull() { return this.bag.length >= BAG_SIZE; }
  statsSummary() {
    return {
      'Здоровье': `${Math.round(this.hp)} / ${this.maxHp}`,
      'Урон': Math.round(this.damage()),
      'Броня': Math.round(this.armor()),
      'Скорость': Math.round(this.speed()),
      'Крит': pct(this.crit()),
      'Скорость атаки': pct(1 + this.equipStat('attackSpeed')),
      'Вампиризм': pct(this.lifesteal()),
      'Сокр. перезарядки': pct(this.cdr()),
      'Опыт': pct(this.xpMult()),
      'Золото': pct(this.goldMult()),
    };
  }
}

class Enemy {
  constructor(type, x, y, floor, bossDef) {
    const def = bossDef || MONSTERS[type];
    this.type = type; this.def = def; this.isBoss = !!bossDef;
    this.x = x; this.y = y; this.r = def.size;
    const scale = 1 + 0.13 * (floor - 1);
    const dscale = 1 + 0.09 * (floor - 1);
    this.maxHp = Math.round(def.hp * (this.isBoss ? 1 : scale));
    this.hp = this.maxHp;
    this.dmg = def.dmg * (this.isBoss ? 1 : dscale);
    this.speed = def.speed; this.armor = def.armor || 0;
    this.state = 'idle'; this.target = null;
    this.wander = { x: 0, y: 0, t: 0 };
    this.attackTimer = R.float(0, def.attackCd);
    this.windup = 0; this.windupDir = { x: 0, y: 0 };
    this.stun = 0; this.slow = 0; this.poisonDps = 0; this.poisonTime = 0;
    this.kx = 0; this.ky = 0; // отбрасывание
    this.hitFlash = 0; this.alive = true;
    this.flowTimer = R.float(0, 0.3);
    this.dir = { x: 0, y: 0 };
    this.abilityTimers = {};
    if (def.abilities) for (const k in def.abilities) this.abilityTimers[k] = def.abilities[k] * 0.6;
    this.charge = null; this.phase = 1;
    this.telegraph = null; // {x,y,r,time,total,type}
    this.stuckTimer = 0; this.lastX = x; this.lastY = y;
  }
}

class Projectile {
  constructor(o) {
    Object.assign(this, { pierce: 0, size: 4, color: '#fff', life: 1.5, explode: 0, stun: 0, slow: 0, crit: false, spin: false, poison: 0, hit: new Set(), angle: 0 }, o);
    this.angle = Math.atan2(this.vy, this.vx);
  }
}

class Pickup {
  constructor(x, y, kind, payload) {
    this.x = x; this.y = y; this.kind = kind; // 'item' | 'gold' | 'consumable'
    Object.assign(this, payload);
    this.bob = R.float(0, 6.28); this.age = 0;
    const a = R.float(0, 6.28), s = R.float(30, 80);
    this.vx = Math.cos(a) * s; this.vy = Math.sin(a) * s;
  }
}

class Chest { constructor(x, y) { this.x = x; this.y = y; this.opened = false; this.r = 14; } }
class Merchant { constructor(x, y, items) { this.x = x; this.y = y; this.items = items; this.r = 14; } }

// ---------- Генерация предметов ----------
let ITEM_UID = 1;
function rollRarity(floor, luck = 1) {
  const w = { common: RARITY.common.weight, rare: RARITY.rare.weight * (1 + floor * 0.08) * luck, epic: RARITY.epic.weight * (1 + floor * 0.15) * luck };
  return R.weighted(['common', 'rare', 'epic'], (k) => w[k]);
}
function makeItem(baseId, rarity) {
  const base = ITEM_BASE_BY_ID[baseId];
  const rar = RARITY[rarity];
  const stats = {};
  for (const k in base.stats) stats[k] = roundStat(k, base.stats[k] * (base.stats[k] < 0 ? 1 : rar.mult));
  // Аффиксы редких/эпических предметов.
  const pool = AFFIXES.filter((a) => !(a.stat in stats));
  const picked = R.shuffle(pool.slice()).slice(0, rar.affixes);
  for (const a of picked) stats[a.stat] = roundStat(a.stat, R.float(a.min, a.max));
  const name = base.name + RARITY_SUFFIX[rarity];
  const price = Math.round((30 + base.tier * 18) * rar.price);
  return { uid: ITEM_UID++, base: baseId, slot: base.slot, name, icon: base.icon, rarity, stats, price, tier: base.tier };
}
function roundStat(k, v) {
  if (['dmg', 'hp', 'armor', 'speed'].includes(k)) return Math.round(v);
  return Math.round(v * 100) / 100;
}
function randomItem(floor, luck = 1) {
  const pool = ITEM_BASES.filter((b) => b.tier <= floor + 1);
  const base = R.weighted(pool, (b) => (b.tier >= floor - 2 ? 3 : 1));
  return makeItem(base.id, rollRarity(floor, luck));
}
function randomConsumable() {
  const keys = Object.keys(CONSUMABLES);
  return R.weighted(keys, (k) => CONSUMABLES[k].weight);
}
function itemStatsText(item) {
  return Object.entries(item.stats).map(([k, v]) => `${STAT_NAMES[k]} ${STAT_FMT[k](v)}`).join(', ');
}

if (typeof module !== 'undefined') module.exports = { Player, Enemy, Projectile, Pickup, Chest, Merchant, makeItem, randomItem, rollRarity, randomConsumable, itemStatsText };

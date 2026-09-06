'use strict';
// Проверки без браузера: целостность данных и генерация подземелья.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ctx = { console, module: undefined, localStorage: { getItem: () => null, setItem() {}, removeItem() {} }, performance: { now: () => Date.now() } };
ctx.window = ctx;
vm.createContext(ctx);
for (const f of ['utils', 'iso', 'data', 'save', 'dungeon', 'entities']) {
  const src = fs.readFileSync(path.join(__dirname, '..', 'js', f + '.js'), 'utf8');
  // Убираем 'use strict', чтобы объявления const/class попали в контекст как глобальные.
  vm.runInContext(src.replace(/^'use strict';/, ''), ctx, { filename: f + '.js' });
}

// Верхнеуровневые const/class из скриптов не попадают в объект контекста — вытаскиваем их выражением.
const NAMES = ['HEROES', 'SKILLS', 'MONSTERS', 'BOSSES', 'ITEM_BASES', 'ITEM_BASE_BY_ID', 'AFFIXES', 'START_ITEMS', 'STAT_NAMES', 'STAT_FMT', 'RARITY', 'xpToNext', 'randomItem', 'makeItem', 'Player', 'generateFloor', 'MAX_FLOOR', 'BOSS_FLOORS', 'MERCHANT_FLOORS', 'TILE', 'T_STAIRS', 'isoX', 'isoY', 'isoToWorld', 'isoDir', 'isoDepth', 'ISO_CIRCLE_X', 'ISO_CIRCLE_Y', 'ISO_ANGLE_SHIFT'];
Object.assign(ctx, vm.runInContext('({' + NAMES.join(',') + '})', ctx));

let failed = 0;
function check(cond, msg) { if (!cond) { failed++; console.error('FAIL:', msg); } }

// --- Изометрия ---
// Проекция линейна и обратима: без этого не сойдутся ни прицел по мыши, ни выбор
// тайла под курсором.
{
  const { isoX, isoY, isoToWorld, isoDir, isoDepth, TILE } = ctx;
  for (const [wx, wy] of [[0, 0], [140, -60], [-33.5, 900], [2048, 1536]]) {
    const back = isoToWorld(isoX(wx, wy), isoY(wx, wy));
    check(Math.abs(back.x - wx) < 1e-9 && Math.abs(back.y - wy) < 1e-9, `проекция необратима в (${wx}, ${wy})`);
  }
  // Квадрат тайла ложится ромбом ровно вдвое шире своей высоты.
  const w = isoX(TILE, 0) - isoX(0, TILE), h = isoY(TILE, TILE) - isoY(0, 0);
  check(Math.abs(w - TILE) < 1e-9, `ширина ромба ${w}, ожидалась ${TILE}`);
  check(Math.abs(w - h * 2) < 1e-9, `ромб не 2:1: ${w} на ${h}`);
  // Клавиши задают направление по экрану: W строго вверх, D строго вправо.
  const up = isoDir(0, -1), right = isoDir(1, 0);
  check(Math.abs(isoX(up.x, up.y)) < 1e-9 && isoY(up.x, up.y) < 0, 'W уводит не строго вверх по экрану');
  check(Math.abs(isoY(right.x, right.y)) < 1e-9 && isoX(right.x, right.y) > 0, 'D уводит не строго вправо по экрану');
  check(Math.abs(Math.hypot(up.x, up.y) - 1) < 1e-9, 'направление не нормировано: скорость зависела бы от клавиши');
  // Глубина растёт «к зрителю»: соседний тайл вправо-вниз рисуется позже.
  check(isoDepth(TILE, TILE) > isoDepth(0, 0), 'порядок отрисовки по глубине перевёрнут');
  // Окружность пола — эллипс с углом, сдвинутым на 45°.
  const R = 40;
  for (let t = 0; t < 6.28; t += 0.37) {
    const dx = isoX(R * Math.cos(t), R * Math.sin(t)), dy = isoY(R * Math.cos(t), R * Math.sin(t));
    const ex = R * ctx.ISO_CIRCLE_X * Math.cos(t + ctx.ISO_ANGLE_SHIFT);
    const ey = R * ctx.ISO_CIRCLE_Y * Math.sin(t + ctx.ISO_ANGLE_SHIFT);
    check(Math.hypot(dx - ex, dy - ey) < 1e-9, `эллипс расходится с проекцией при t=${t.toFixed(2)}`);
  }
}

// --- Данные ---
for (const h of ctx.HEROES) {
  check(h.skills.length === 3, `${h.id}: должно быть 3 умения`);
  for (const s of h.skills) check(ctx.SKILLS[s], `${h.id}: неизвестное умение ${s}`);
  check(h.attack.type === 'melee' ? h.attack.range > 0 : h.attack.speed > 0, `${h.id}: некорректная атака`);
}
for (const [k, m] of Object.entries(ctx.MONSTERS)) {
  check(m.hp > 0 && m.dmg > 0 && m.speed > 0 && m.xp > 0, `${k}: базовые статы`);
  check(Array.isArray(m.gold) && m.gold.length === 2, `${k}: диапазон золота`);
  if (m.ranged) check(m.projSpeed > 0 && m.keepDistance > 0, `${k}: настройки дальнего боя`);
}
for (const b of Object.values(ctx.BOSSES)) check(b.abilities && Object.keys(b.abilities).length > 0, `${b.id}: способности босса`);
for (const it of ctx.ITEM_BASES) {
  check(['weapon', 'armor', 'trinket'].includes(it.slot), `${it.id}: слот`);
  for (const s of Object.keys(it.stats)) check(ctx.STAT_NAMES[s] && ctx.STAT_FMT[s], `${it.id}: нет имени/формата для стата ${s}`);
}
for (const a of ctx.AFFIXES) check(ctx.STAT_NAMES[a.stat], `аффикс ${a.stat} без имени`);
for (const s of ctx.START_ITEMS) if (s.item) check(ctx.ITEM_BASE_BY_ID[s.item.base], `стартовый предмет ${s.id}: нет базы`);
check(ctx.xpToNext(1) < ctx.xpToNext(2), 'кривая опыта растёт');

// --- Генерация предметов ---
for (let i = 0; i < 200; i++) {
  const it = ctx.randomItem(1 + (i % 10));
  check(it.name && it.price > 0 && Object.keys(it.stats).length > 0, 'случайный предмет');
  const affixCount = Object.keys(it.stats).length - Object.keys(ctx.ITEM_BASE_BY_ID[it.base].stats).length;
  check(affixCount === ctx.RARITY[it.rarity].affixes, `аффиксы: ${it.rarity} → ${affixCount}`);
}

// --- Игрок ---
{
  const meta = { hpMult: 1, dmgMult: 1, speedMult: 1, cdr: 0, startPotions: 0, startGold: 0, xpMult: 1, potionMult: 1, dropMult: 1 };
  const p = new ctx.Player(ctx.HEROES[0], 5, meta);
  check(p.maxHp === ctx.HEROES[0].hp + ctx.HEROES[0].hpPerLevel * 4, 'hp по уровню');
  const armor = ctx.makeItem('chain', 'rare');
  p.equipment.armor = armor;
  check(p.armor() === ctx.HEROES[0].armor + armor.stats.armor, 'броня учитывает экипировку');
  p.addBuff('dmg', 0.5, 5);
  check(Math.abs(p.damage() - (ctx.HEROES[0].dmg + ctx.HEROES[0].dmgPerLevel * 4 + p.equipStat('dmg')) * 1.5) < 1e-6, 'бафф урона');
}

// --- Генерация этажей ---
let totalEnemies = 0;
for (let floor = 1; floor <= ctx.MAX_FLOOR; floor++) {
  for (let seed = 1; seed <= 30; seed++) {
    const gen = ctx.generateFloor(floor, seed * 1013 + floor);
    const map = gen.map;
    const sx = Math.floor(gen.spawn.x / ctx.TILE), sy = Math.floor(gen.spawn.y / ctx.TILE);
    const tx = Math.floor(gen.stairs.x / ctx.TILE), ty = Math.floor(gen.stairs.y / ctx.TILE);
    check(map.isWalkable(sx, sy), `этаж ${floor}/${seed}: спавн в стене`);
    check(map.get(tx, ty) === ctx.T_STAIRS, `этаж ${floor}/${seed}: лестница не на месте`);
    check(!map.circleBlocked(gen.spawn.x, gen.spawn.y, 12), `этаж ${floor}/${seed}: спавн упирается в стену`);
    const field = map.flowField(tx, ty);
    check(field[map.idx(sx, sy)] >= 0, `этаж ${floor}/${seed}: лестница недостижима`);
    for (const e of gen.enemies) {
      const ex = Math.floor(e.x / ctx.TILE), ey = Math.floor(e.y / ctx.TILE);
      check(map.isWalkable(ex, ey), `этаж ${floor}/${seed}: враг ${e.type} в стене`);
      check(field[map.idx(ex, ey)] >= 0, `этаж ${floor}/${seed}: враг ${e.type} в недостижимой зоне`);
      check(ctx.MONSTERS[e.type].minFloor <= floor, `этаж ${floor}/${seed}: ${e.type} раньше срока`);
    }
    for (const c of gen.chests) check(map.isWalkable(Math.floor(c.x / ctx.TILE), Math.floor(c.y / ctx.TILE)), `этаж ${floor}/${seed}: сундук в стене`);
    if (gen.merchant) check(map.isWalkable(Math.floor(gen.merchant.x / ctx.TILE), Math.floor(gen.merchant.y / ctx.TILE)), `этаж ${floor}/${seed}: торговец в стене`);
    const isBoss = ctx.BOSS_FLOORS.includes(floor);
    check(isBoss ? !!gen.boss : !gen.boss, `этаж ${floor}: босс ${isBoss ? 'нужен' : 'не нужен'}`);
    check(ctx.MERCHANT_FLOORS.includes(floor) ? !!gen.merchant : !gen.merchant, `этаж ${floor}: торговец`);
    if (gen.boss) check(!map.circleBlocked(gen.boss.x, gen.boss.y, ctx.BOSSES[gen.boss.id].size), `этаж ${floor}: босс упирается в стену`);
    totalEnemies += gen.enemies.length;
    // Туман войны и видимость.
    map.updateVisibility(sx, sy, 9);
    check(map.visible[map.idx(sx, sy)] === 1, `этаж ${floor}: точка спавна видима`);
  }
}
check(totalEnemies > 0, 'враги генерируются');

if (failed) { console.error(`\n${failed} проверок провалено`); process.exit(1); }
console.log('Все проверки пройдены.');

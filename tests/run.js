'use strict';
// Проверки без браузера: целостность данных и генерация подземелья.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ctx = { console, module: undefined, localStorage: { getItem: () => null, setItem() {}, removeItem() {} }, performance: { now: () => Date.now() } };
ctx.window = ctx;
vm.createContext(ctx);
for (const f of ['utils', 'data', 'save', 'dungeon', 'entities']) {
  const src = fs.readFileSync(path.join(__dirname, '..', 'js', f + '.js'), 'utf8');
  // Убираем 'use strict', чтобы объявления const/class попали в контекст как глобальные.
  vm.runInContext(src.replace(/^'use strict';/, ''), ctx, { filename: f + '.js' });
}

// Верхнеуровневые const/class из скриптов не попадают в объект контекста — вытаскиваем их выражением.
const NAMES = ['HALL_FLOOR', 'T_CHASM', 'generateGreatHall', 'HEROES', 'SKILLS', 'MONSTERS', 'BOSSES', 'ITEM_BASES', 'ITEM_BASE_BY_ID', 'AFFIXES', 'START_ITEMS', 'STAT_NAMES', 'STAT_FMT', 'RARITY', 'xpToNext', 'randomItem', 'makeItem', 'Player', 'generateFloor', 'MAX_FLOOR', 'BOSS_FLOORS', 'MERCHANT_FLOORS', 'TILE', 'T_STAIRS'];
Object.assign(ctx, vm.runInContext('({' + NAMES.join(',') + '})', ctx));

let failed = 0;
function check(cond, msg) { if (!cond) { failed++; console.error('FAIL:', msg); } }

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

// --- Железные Чертоги: рукотворный этаж ---
{
  const gen = ctx.generateFloor(ctx.HALL_FLOOR, 12345);
  const map = gen.map;
  check(gen.title === 'Железные Чертоги', 'у чертога есть название');
  check(!gen.merchant && !gen.boss, 'в чертоге нет торговца и босса');

  let chasm = 0;
  for (let i = 0; i < map.tiles.length; i++) if (map.tiles[i] === ctx.T_CHASM) chasm++;
  check(chasm > 100, `пропасть прорублена (тайлов: ${chasm})`);

  // Через пропасть должно быть видно, иначе мост становится слепым.
  const cx = map.w >> 1;
  let sawChasm = false;
  for (let y = 0; y < map.h && !sawChasm; y++) {
    for (let x = 0; x < map.w; x++) {
      if (map.tiles[map.idx(x, y)] !== ctx.T_CHASM) continue;
      check(map.isWall(x, y), 'пропасть не пройти');
      check(!map.blocksSight(x, y), 'через пропасть видно');
      sawChasm = true;
      break;
    }
  }

  // Усыпальница и зал — оба с сундуком, и оба достижимы.
  const stx = Math.floor(gen.stairs.x / ctx.TILE), sty = Math.floor(gen.stairs.y / ctx.TILE);
  const field = map.flowField(stx, sty);
  const spx = Math.floor(gen.spawn.x / ctx.TILE), spy = Math.floor(gen.spawn.y / ctx.TILE);
  check(field[map.idx(spx, spy)] >= 0, 'от входа есть путь к лестнице');
  check(gen.chests.length >= 1, 'в чертоге есть сундук');
  for (const c of gen.chests) {
    const tx = Math.floor(c.x / ctx.TILE), ty = Math.floor(c.y / ctx.TILE);
    check(field[map.idx(tx, ty)] >= 0, 'сундук достижим');
  }

  // Мост — единственная переправа: замуровав его, лестницу достать нельзя.
  const blocked = ctx.generateFloor(ctx.HALL_FLOOR, 12345).map;
  for (let y = 0; y < blocked.h; y++) {
    for (let x = 0; x < blocked.w; x++) {
      // Пол внутри полосы пропасти и есть мост.
      if (blocked.tiles[blocked.idx(x, y)] !== ctx.T_CHASM) continue;
      for (const by of [y - 1, y + 1]) {
        if (blocked.get(x, by) === 1) blocked.set(x, by, ctx.T_CHASM);
      }
    }
  }
  const blockedField = blocked.flowField(stx, sty);
  check(blockedField[blocked.idx(spx, spy)] < 0, 'без моста лестница недостижима');
}



if (failed) { console.error(`\n${failed} проверок провалено`); process.exit(1); }
console.log('Все проверки пройдены.');

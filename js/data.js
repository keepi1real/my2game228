'use strict';
// Все игровые данные: герои, умения, монстры, боссы, предметы, мета-улучшения.

const GAME_TITLE = 'Тени Подгорья';
const MAX_FLOOR = 10;
const BOSS_FLOORS = [5, 10];
const MERCHANT_FLOORS = [3, 7];
const MAX_LEVEL = 40;
const BAG_SIZE = 12;

function xpToNext(level) { return Math.round(60 * Math.pow(level, 1.45)); }

// ---------- Герои ----------
const HEROES = [
  {
    id: 'arator', name: 'Аратор', title: 'Следопыт Севера', symbol: 'A', color: '#5cb85c',
    desc: 'Наследник забытого королевства. Сбалансированный боец с мечом: крепок, быстр и умеет лечиться травами.',
    hp: 120, hpPerLevel: 9, dmg: 14, dmgPerLevel: 1.1, speed: 172, armor: 2, crit: 0.08,
    attack: { type: 'melee', range: 48, arc: Math.PI * 0.65, cooldown: 0.45 },
    skills: ['dashStrike', 'warcry', 'herbs'], unlockCost: 0,
  },
  {
    id: 'baldin', name: 'Балдин', title: 'Гном из Железных Чертогов', symbol: 'Б', color: '#e8a33d',
    desc: 'Тяжёлый топор, тяжёлая броня, тяжёлый нрав. Медленный, но очень живучий и бьёт наповал.',
    hp: 165, hpPerLevel: 12, dmg: 22, dmgPerLevel: 1.6, speed: 142, armor: 5, crit: 0.05,
    attack: { type: 'melee', range: 44, arc: Math.PI * 0.85, cooldown: 0.7 },
    skills: ['whirlwind', 'stoneSkin', 'axeThrow'], unlockCost: 0,
  },
  {
    id: 'faelas', name: 'Фаелас', title: 'Лучник Сумеречного леса', symbol: 'Ф', color: '#6fc3df',
    desc: 'Эльф с длинным луком. Хрупкий, но стремительный: держит дистанцию и осыпает врагов стрелами.',
    hp: 85, hpPerLevel: 6, dmg: 11, dmgPerLevel: 0.9, speed: 196, armor: 0, crit: 0.15,
    attack: { type: 'ranged', speed: 540, cooldown: 0.38, size: 4, color: '#c8f0ff' },
    skills: ['volley', 'evade', 'trueshot'], unlockCost: 60,
  },
  {
    id: 'mithrandir', name: 'Митрандир', title: 'Серый странник', symbol: 'М', color: '#c77dff',
    desc: 'Маг с посохом и искрой древнего огня. Слаб телом, но огненные шары и вспышки решают бой издалека.',
    hp: 80, hpPerLevel: 6, dmg: 16, dmgPerLevel: 1.2, speed: 166, armor: 0, crit: 0.06,
    attack: { type: 'ranged', speed: 420, cooldown: 0.55, size: 6, color: '#e2b3ff' },
    skills: ['fireball', 'flash', 'barrier'], unlockCost: 90,
  },
  {
    id: 'peregrin', name: 'Перегрин', title: 'Хоббит из Зелёных Холмов', symbol: 'П', color: '#f5d76e',
    desc: 'Маленький, быстрый и незаметный. Кинжал, камни и второй завтрак — всё, что нужно для приключения.',
    hp: 95, hpPerLevel: 7, dmg: 9, dmgPerLevel: 0.8, speed: 212, armor: 1, crit: 0.2,
    attack: { type: 'melee', range: 38, arc: Math.PI * 0.55, cooldown: 0.28 },
    skills: ['vanish', 'stone', 'breakfast'], unlockCost: 120,
  },
];
const HERO_BY_ID = Object.fromEntries(HEROES.map((h) => [h.id, h]));

// ---------- Умения ----------
// use(game, player, aim) вызывается из game.js. aim = {x, y} направление (нормализованное).
const SKILLS = {
  dashStrike: {
    name: 'Рывок клинка', icon: '➶', cooldown: 6,
    desc: 'Рывок вперёд на 130 px, все враги на пути получают 200% урона.',
    use(g, p, aim) { g.playerDash(p, aim, 130, 0.16, { dmgMult: 2.0, invuln: true }); },
  },
  warcry: {
    name: 'Клич Севера', icon: '♪', cooldown: 18,
    desc: '+40% урона и +15% скорости на 6 секунд.',
    use(g, p) { p.addBuff('dmg', 0.4, 6); p.addBuff('speed', 0.15, 6); g.addText(p.x, p.y - 20, 'Клич!', '#ffd54f'); g.burst(p.x, p.y, '#ffd54f', 14); },
  },
  herbs: {
    name: 'Целебные травы', icon: '❀', cooldown: 24,
    desc: 'Восстанавливает 35% здоровья в течение 4 секунд.',
    use(g, p) { p.addBuff('regen', p.maxHp * 0.35 / 4, 4); g.addText(p.x, p.y - 20, 'Травы', '#7cd67c'); },
  },
  whirlwind: {
    name: 'Круговой удар', icon: '↻', cooldown: 8,
    desc: 'Удар по всем врагам в радиусе 80 px: 170% урона и отбрасывание.',
    use(g, p) { g.playerAoe(p, 80, 1.7, { knockback: 260, color: '#e8a33d' }); },
  },
  stoneSkin: {
    name: 'Каменная кожа', icon: '▣', cooldown: 20,
    desc: '+12 брони на 6 секунд.',
    use(g, p) { p.addBuff('armor', 12, 6); g.addText(p.x, p.y - 20, 'Камень', '#bdbdbd'); g.burst(p.x, p.y, '#9e9e9e', 12); },
  },
  axeThrow: {
    name: 'Бросок топора', icon: '⚒', cooldown: 9,
    desc: 'Топор летит сквозь врагов, нанося 220% урона каждому.',
    use(g, p, aim) { g.spawnProjectile({ x: p.x, y: p.y, vx: aim.x * 380, vy: aim.y * 380, dmg: p.damage() * 2.2, owner: 'player', pierce: 99, size: 9, color: '#e8a33d', life: 1.2, spin: true }); },
  },
  volley: {
    name: 'Залп', icon: '⋔', cooldown: 7,
    desc: 'Веер из 5 стрел, каждая наносит 90% урона.',
    use(g, p, aim) {
      const base = Math.atan2(aim.y, aim.x);
      for (let i = -2; i <= 2; i++) {
        const a = base + i * 0.16;
        g.spawnProjectile({ x: p.x, y: p.y, vx: Math.cos(a) * 520, vy: Math.sin(a) * 520, dmg: p.damage() * 0.9, owner: 'player', size: 4, color: '#c8f0ff', life: 1.0 });
      }
    },
  },
  evade: {
    name: 'Прыжок эльфа', icon: '⇠', cooldown: 5,
    desc: 'Отскок назад на 150 px с неуязвимостью.',
    use(g, p, aim) { g.playerDash(p, { x: -aim.x, y: -aim.y }, 150, 0.15, { invuln: true }); },
  },
  trueshot: {
    name: 'Стрела судьбы', icon: '➹', cooldown: 12,
    desc: 'Быстрая пробивающая стрела, 320% урона, гарантированный крит.',
    use(g, p, aim) { g.spawnProjectile({ x: p.x, y: p.y, vx: aim.x * 800, vy: aim.y * 800, dmg: p.damage() * 3.2, owner: 'player', pierce: 99, size: 5, color: '#ffffff', life: 1.0, crit: true }); },
  },
  fireball: {
    name: 'Огненный шар', icon: '✦', cooldown: 6,
    desc: 'Шар взрывается при попадании: 240% урона всем в радиусе 85 px.',
    use(g, p, aim) { g.spawnProjectile({ x: p.x, y: p.y, vx: aim.x * 340, vy: aim.y * 340, dmg: p.damage() * 2.4, owner: 'player', size: 9, color: '#ff7043', life: 1.6, explode: 85 }); },
  },
  flash: {
    name: 'Вспышка света', icon: '☀', cooldown: 15,
    desc: 'Оглушает всех врагов в радиусе 160 px на 2.5 с и наносит 60% урона.',
    use(g, p) { g.playerAoe(p, 160, 0.6, { stun: 2.5, color: '#ffffff' }); g.flashScreen(0.6); },
  },
  barrier: {
    name: 'Барьер', icon: '◎', cooldown: 22,
    desc: 'Щит, поглощающий урон в размере 45% макс. здоровья, на 8 секунд.',
    use(g, p) { p.shield = Math.max(p.shield, p.maxHp * 0.45); p.shieldTime = 8; g.addText(p.x, p.y - 20, 'Барьер', '#c77dff'); },
  },
  vanish: {
    name: 'Тихие шаги', icon: '☾', cooldown: 16,
    desc: 'Невидимость на 4 с: враги теряют вас, следующий удар наносит 300% урона.',
    use(g, p) { p.addBuff('invisible', 1, 4); p.sneak = true; g.enemies.forEach((e) => { e.target = null; e.state = 'idle'; }); g.addText(p.x, p.y - 20, 'Тень', '#b0bec5'); },
  },
  stone: {
    name: 'Меткий камень', icon: '●', cooldown: 6,
    desc: 'Камень из пращи: 130% урона и оглушение на 1.5 с.',
    use(g, p, aim) { g.spawnProjectile({ x: p.x, y: p.y, vx: aim.x * 480, vy: aim.y * 480, dmg: p.damage() * 1.3, owner: 'player', size: 5, color: '#a1887f', life: 1.0, stun: 1.5 }); },
  },
  breakfast: {
    name: 'Второй завтрак', icon: '☕', cooldown: 20,
    desc: 'Мгновенно лечит 25% здоровья и даёт +30% скорости на 5 с.',
    use(g, p) { g.healPlayer(p.maxHp * 0.25); p.addBuff('speed', 0.3, 5); g.addText(p.x, p.y - 20, 'Ням!', '#f5d76e'); },
  },
};

// ---------- Монстры ----------
const MONSTERS = {
  goblin: { name: 'Гоблин', symbol: 'g', shape: 'tri', color: '#7cb342', size: 11, hp: 24, dmg: 7, speed: 140, xp: 8, shards: 1, gold: [2, 6], sight: 230, attackRange: 28, attackCd: 0.9, windup: 0.25, minFloor: 1, weight: 10 },
  orc: { name: 'Орк', symbol: 'o', shape: 'square', color: '#c62828', size: 14, hp: 52, dmg: 12, speed: 108, xp: 16, shards: 1, gold: [4, 10], sight: 240, attackRange: 32, attackCd: 1.1, windup: 0.35, minFloor: 1, weight: 8 },
  archer: { name: 'Орк-лучник', symbol: 'a', shape: 'square', color: '#ef6c00', size: 12, hp: 36, dmg: 10, speed: 100, xp: 18, shards: 1, gold: [4, 10], sight: 300, attackRange: 250, keepDistance: 170, ranged: true, projSpeed: 280, attackCd: 1.6, windup: 0.4, minFloor: 2, weight: 6 },
  warg: { name: 'Варг', symbol: 'w', shape: 'diamond', color: '#9e9e9e', size: 13, hp: 42, dmg: 15, speed: 200, xp: 22, shards: 2, gold: [3, 8], sight: 320, attackRange: 30, attackCd: 0.8, windup: 0.2, minFloor: 3, weight: 6 },
  spider: { name: 'Паук Мрака', symbol: 's', shape: 'tri', color: '#8e24aa', size: 12, hp: 34, dmg: 8, speed: 160, xp: 20, shards: 2, gold: [3, 9], sight: 260, attackRange: 28, attackCd: 0.9, windup: 0.25, poison: 4, minFloor: 4, weight: 6 },
  bat: { name: 'Пещерная мышь', symbol: 'b', shape: 'diamond', color: '#7e57c2', size: 10, hp: 18, dmg: 6, speed: 232, xp: 10, shards: 1, gold: [2, 5], sight: 280, attackRange: 26, attackCd: 0.7, windup: 0.15, minFloor: 2, weight: 7 },
  spawn: { name: 'Порождение мрака', symbol: 'c', shape: 'tri', color: '#4e6b52', size: 14, hp: 68, dmg: 14, speed: 150, xp: 30, shards: 2, gold: [5, 12], sight: 270, attackRange: 30, attackCd: 1.0, windup: 0.3, poison: 6, minFloor: 5, weight: 5 },
  golem: { name: 'Рунный голем', symbol: 'Y', shape: 'square', color: '#546e7a', size: 20, hp: 210, dmg: 30, speed: 62, xp: 70, shards: 4, gold: [18, 34], sight: 220, attackRange: 44, attackCd: 2.0, windup: 0.7, knockback: 340, armor: 8, minFloor: 5, weight: 3 },
  troll: { name: 'Пещерный тролль', symbol: 'T', shape: 'hex', color: '#795548', size: 24, hp: 190, dmg: 28, speed: 74, xp: 65, shards: 4, gold: [15, 30], sight: 240, attackRange: 46, attackCd: 1.8, windup: 0.6, knockback: 300, minFloor: 4, weight: 3 },
  uruk: { name: 'Урук', symbol: 'U', shape: 'square', color: '#4e342e', size: 17, hp: 120, dmg: 21, speed: 118, xp: 45, shards: 3, gold: [10, 20], sight: 260, attackRange: 34, attackCd: 1.0, windup: 0.3, armor: 4, minFloor: 6, weight: 5 },
  wraith: { name: 'Умертвие', symbol: 'u', shape: 'circle', color: '#80deea', size: 14, hp: 70, dmg: 17, speed: 125, xp: 50, shards: 3, gold: [8, 18], sight: 320, attackRange: 260, keepDistance: 150, ranged: true, projSpeed: 240, projColor: '#4dd0e1', attackCd: 1.5, windup: 0.4, slow: 2, minFloor: 6, weight: 4 },
  shadow: { name: 'Тень', symbol: 'x', shape: 'circle', color: '#37474f', size: 12, hp: 55, dmg: 19, speed: 175, xp: 40, shards: 3, gold: [6, 14], sight: 300, attackRange: 30, attackCd: 0.7, windup: 0.2, minFloor: 8, weight: 5 },
};

const BOSSES = {
  grazgot: {
    id: 'grazgot', name: 'Гразгот, вождь орков', symbol: 'G', shape: 'square', color: '#b71c1c', size: 30,
    hp: 750, dmg: 26, speed: 105, xp: 300, shards: 30, gold: [80, 120], sight: 900, attackRange: 50, attackCd: 1.4, windup: 0.5, armor: 3, knockback: 260,
    abilities: { charge: 7, summon: 13, slam: 5 },
  },
  morgul: {
    id: 'morgul', name: 'Тень Моргула', symbol: 'Ω', shape: 'circle', color: '#263238', size: 30,
    hp: 1500, dmg: 32, speed: 120, xp: 800, shards: 60, gold: [150, 250], sight: 900, attackRange: 52, attackCd: 1.2, windup: 0.4, armor: 5,
    abilities: { blink: 6, volley: 4.5, summon: 16, scream: 11 },
  },
};

// ---------- Предметы ----------
const RARITY = {
  common: { name: 'Обычный', mult: 1.0, color: '#cfcfcf', weight: 65, affixes: 0, price: 1 },
  rare: { name: 'Редкий', mult: 1.45, color: '#5aa9ff', weight: 28, affixes: 1, price: 2.2 },
  epic: { name: 'Эпический', mult: 2.1, color: '#c77dff', weight: 7, affixes: 2, price: 5 },
};
const RARITY_SUFFIX = { common: '', rare: ' искусной работы', epic: ' древних мастеров' };

const STAT_NAMES = {
  dmg: 'Урон', hp: 'Здоровье', armor: 'Броня', speed: 'Скорость', crit: 'Шанс крита', attackSpeed: 'Скорость атаки',
  lifesteal: 'Вампиризм', cdr: 'Сокр. перезарядки', xpGain: 'Опыт', goldFind: 'Золото', regen: 'Регенерация',
};
const STAT_FMT = {
  dmg: (v) => sign(Math.round(v)), hp: (v) => sign(Math.round(v)), armor: (v) => sign(Math.round(v)), speed: (v) => sign(Math.round(v)),
  crit: (v) => sign(Math.round(v * 100)) + '%', attackSpeed: (v) => sign(Math.round(v * 100)) + '%', lifesteal: (v) => sign(Math.round(v * 100)) + '%',
  cdr: (v) => sign(Math.round(v * 100)) + '%', xpGain: (v) => sign(Math.round(v * 100)) + '%', goldFind: (v) => sign(Math.round(v * 100)) + '%', regen: (v) => sign(+v.toFixed(1)) + '/с',
};

// Базовые предметы. tier — минимальный этаж, где может выпасть.
const ITEM_BASES = [
  // Оружие
  { id: 'rustySword', slot: 'weapon', name: 'Ржавый меч', icon: '⚔', tier: 1, stats: { dmg: 4 } },
  { id: 'shortBlade', slot: 'weapon', name: 'Короткий клинок', icon: '⚔', tier: 1, stats: { dmg: 3, attackSpeed: 0.1 } },
  { id: 'orcCleaver', slot: 'weapon', name: 'Орочий тесак', icon: '⚔', tier: 2, stats: { dmg: 7 } },
  { id: 'dwarfAxe', slot: 'weapon', name: 'Секира Чертогов', icon: '⚒', tier: 3, stats: { dmg: 10, attackSpeed: -0.08 } },
  { id: 'elfBlade', slot: 'weapon', name: 'Эльфийский клинок', icon: '⚔', tier: 4, stats: { dmg: 8, crit: 0.08, attackSpeed: 0.1 } },
  { id: 'runeBlade', slot: 'weapon', name: 'Рунный клинок', icon: '⚔', tier: 6, stats: { dmg: 14, lifesteal: 0.05 } },
  { id: 'sunEdge', slot: 'weapon', name: 'Клинок Заката', icon: '✧', tier: 8, stats: { dmg: 20, crit: 0.1 } },
  // Броня
  { id: 'leather', slot: 'armor', name: 'Кожаный доспех', icon: '▲', tier: 1, stats: { armor: 2, hp: 10 } },
  { id: 'chain', slot: 'armor', name: 'Кольчуга', icon: '▲', tier: 2, stats: { armor: 4, hp: 15, speed: -6 } },
  { id: 'loriCloak', slot: 'armor', name: 'Плащ Лесного народа', icon: '▲', tier: 3, stats: { armor: 2, speed: 14, hp: 8 } },
  { id: 'dwarfMail', slot: 'armor', name: 'Гномья бронь', icon: '▲', tier: 4, stats: { armor: 7, hp: 30, speed: -12 } },
  { id: 'mithril', slot: 'armor', name: 'Мифриловая рубаха', icon: '▲', tier: 7, stats: { armor: 9, hp: 40 } },
  // Талисманы
  { id: 'boneCharm', slot: 'trinket', name: 'Костяной оберег', icon: '◈', tier: 1, stats: { hp: 15 } },
  { id: 'swiftRing', slot: 'trinket', name: 'Кольцо ветра', icon: '◈', tier: 2, stats: { speed: 18 } },
  { id: 'bloodAmulet', slot: 'trinket', name: 'Кровавый амулет', icon: '◈', tier: 3, stats: { lifesteal: 0.08 } },
  { id: 'wisdomStone', slot: 'trinket', name: 'Камень мудрости', icon: '◈', tier: 3, stats: { xpGain: 0.2 } },
  { id: 'hourglass', slot: 'trinket', name: 'Песочные часы', icon: '◈', tier: 4, stats: { cdr: 0.15 } },
  { id: 'goldTooth', slot: 'trinket', name: 'Золотой зуб дракона', icon: '◈', tier: 4, stats: { goldFind: 0.35, dmg: 2 } },
  { id: 'starPendant', slot: 'trinket', name: 'Подвеска звезды', icon: '◈', tier: 6, stats: { crit: 0.12, regen: 1.0 } },
  { id: 'kingRing', slot: 'trinket', name: 'Кольцо Древнего Короля', icon: '◈', tier: 8, stats: { dmg: 6, hp: 30, cdr: 0.1 } },
];
const ITEM_BASE_BY_ID = Object.fromEntries(ITEM_BASES.map((b) => [b.id, b]));

const AFFIXES = [
  { stat: 'dmg', min: 2, max: 5 }, { stat: 'hp', min: 8, max: 20 }, { stat: 'armor', min: 1, max: 3 }, { stat: 'speed', min: 5, max: 12 },
  { stat: 'crit', min: 0.03, max: 0.08 }, { stat: 'attackSpeed', min: 0.05, max: 0.12 }, { stat: 'lifesteal', min: 0.02, max: 0.05 },
  { stat: 'cdr', min: 0.04, max: 0.1 }, { stat: 'xpGain', min: 0.05, max: 0.15 }, { stat: 'goldFind', min: 0.1, max: 0.25 }, { stat: 'regen', min: 0.3, max: 0.8 },
];

const CONSUMABLES = {
  potion: { id: 'potion', slot: 'consumable', name: 'Зелье лечения', icon: '⚗', color: '#e05a4a', price: 30, desc: 'Восстанавливает 40% здоровья.', weight: 10 },
  lembas: { id: 'lembas', slot: 'consumable', name: 'Дорожный хлеб', icon: '▭', color: '#f5d76e', price: 25, desc: 'Лечит 20% здоровья и даёт +25% скорости на 6 с.', weight: 5 },
  fireScroll: { id: 'fireScroll', slot: 'consumable', name: 'Свиток пламени', icon: '§', color: '#ff7043', price: 45, desc: 'Взрыв вокруг героя: 300% урона всем в радиусе 140 px.', weight: 4 },
  elixir: { id: 'elixir', slot: 'consumable', name: 'Эликсир силы', icon: '⚗', color: '#c77dff', price: 50, desc: '+30% урона и +10 брони на 12 с.', weight: 3 },
};

// Стартовые предметы (разблокируются за осколки, выбираются перед забегом).
const START_ITEMS = [
  { id: 'startNone', name: 'Без предмета', desc: 'Начать налегке.', cost: 0, item: null },
  { id: 'startPotions', name: 'Сумка целителя', desc: '3 зелья лечения на старте.', cost: 25, consumables: { potion: 3 } },
  { id: 'startCloak', name: 'Плащ Лесного народа', desc: 'Редкий плащ: броня, здоровье и скорость.', cost: 60, item: { base: 'loriCloak', rarity: 'rare' } },
  { id: 'startBlade', name: 'Эльфийский клинок', desc: 'Редкий клинок с шансом крита.', cost: 80, item: { base: 'elfBlade', rarity: 'rare' } },
  { id: 'startAmulet', name: 'Кровавый амулет', desc: 'Эпический амулет: сильный вампиризм.', cost: 140, item: { base: 'bloodAmulet', rarity: 'epic' } },
];

// Мета-улучшения (постоянные).
const UPGRADES = [
  { id: 'vitality', name: 'Крепость тела', desc: '+8% максимального здоровья за ранг', max: 5, baseCost: 30, costStep: 25, apply: (s, r) => { s.hpMult += 0.08 * r; } },
  { id: 'might', name: 'Мощь удара', desc: '+6% урона за ранг', max: 5, baseCost: 35, costStep: 30, apply: (s, r) => { s.dmgMult += 0.06 * r; } },
  { id: 'swiftness', name: 'Лёгкость шага', desc: '+4% скорости передвижения за ранг', max: 3, baseCost: 40, costStep: 40, apply: (s, r) => { s.speedMult += 0.04 * r; } },
  { id: 'haste', name: 'Быстрый разум', desc: '-6% времени перезарядки умений за ранг', max: 3, baseCost: 45, costStep: 45, apply: (s, r) => { s.cdr += 0.06 * r; } },
  { id: 'fortune', name: 'Запас зелий', desc: '+1 зелье лечения на старте за ранг', max: 3, baseCost: 20, costStep: 20, apply: (s, r) => { s.startPotions += r; } },
  { id: 'wealth', name: 'Наследство', desc: '+25 золота на старте за ранг', max: 4, baseCost: 15, costStep: 15, apply: (s, r) => { s.startGold += 25 * r; } },
  { id: 'wisdom', name: 'Мудрость веков', desc: '+10% получаемого опыта за ранг', max: 3, baseCost: 40, costStep: 40, apply: (s, r) => { s.xpMult += 0.1 * r; } },
  { id: 'alchemy', name: 'Алхимия', desc: 'Зелья лечат на +10% больше за ранг', max: 3, baseCost: 25, costStep: 25, apply: (s, r) => { s.potionMult += 0.1 * r; } },
  { id: 'luck', name: 'Удача странника', desc: '+10% шанс выпадения предметов за ранг', max: 3, baseCost: 35, costStep: 35, apply: (s, r) => { s.dropMult += 0.1 * r; } },
];
const UPGRADE_BY_ID = Object.fromEntries(UPGRADES.map((u) => [u.id, u]));
function upgradeCost(u, rank) { return u.baseCost + u.costStep * rank; }

if (typeof module !== 'undefined') {
  module.exports = { HEROES, HERO_BY_ID, SKILLS, MONSTERS, BOSSES, RARITY, ITEM_BASES, ITEM_BASE_BY_ID, AFFIXES, CONSUMABLES, START_ITEMS, UPGRADES, UPGRADE_BY_ID, upgradeCost, xpToNext, MAX_FLOOR, BOSS_FLOORS, MERCHANT_FLOORS, BAG_SIZE };
}

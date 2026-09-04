'use strict';
// Визуальный слой. Боевая логика сюда не заходит: слой только решает, чем нарисовать существо.
//
// Порядок выбора для каждой сущности:
//   1. спрайт   — вырезанный персонаж с альфа-каналом, стоит ступнями на игровой координате;
//   2. портрет  — живописная иллюстрация с фоном, показывается круглым токеном;
//   3. фигура   — геометрический фолбэк из render.js.
// Любое звено можно оставить пустым — рендер спустится к следующему, поэтому незаконченный
// набор арта не ломает игру.

// ---------- Портреты ----------
// Иллюстрации с фоном. Основное место — меню и карточки выбора героя, где им отведено 120–460 px.
// focusX/focusY — точка исходника, которая попадёт в центр токена (доля ширины/высоты);
// zoom — во сколько раз вырезаемый квадрат меньше короткой стороны.
const PORTRAITS = {
  heroes: {
    arator: { src: 'assets/heroes/arator.webp', focusY: 0.17, zoom: 2.5 },
    baldin: { src: 'assets/heroes/baldin.webp', focusY: 0.20, zoom: 2.4 },
    faelas: { src: 'assets/heroes/faelas.webp', focusY: 0.16, zoom: 2.6 },
    mithrandir: { src: 'assets/heroes/mithrandir.webp', focusY: 0.19, zoom: 2.5 },
    peregrin: { src: 'assets/heroes/peregrin.webp', focusY: 0.24, zoom: 2.3 },
  },
  enemies: {
    goblin: { src: 'assets/enemies/goblin.webp', focusX: 0.44, focusY: 0.19, zoom: 2.5 },
    warg: { src: 'assets/enemies/warg.webp', focusX: 0.40, focusY: 0.45, zoom: 1.95 },
    spider: { src: 'assets/enemies/spider.webp', focusY: 0.45, zoom: 1.7 },
    troll: { src: 'assets/enemies/troll.webp', focusX: 0.46, focusY: 0.22, zoom: 2.0 },
  },
  bosses: {},
};

// ---------- Спрайты ----------
// Вырезанные персонажи на прозрачном фоне, 256x256 WebP с альфа-каналом.
// anchorY — доля высоты исходника, на которой находятся ступни (1 — самый низ картинки);
// height  — высота фигуры на экране в пикселях;
// flip    — можно ли зеркалить спрайт при движении влево (по умолчанию да).
// Ключи должны совпадать с id из js/data.js.
const SPRITES = {
  heroes: {
    arator: { src: 'assets/sprites/arator.webp', anchorY: 0.973, height: 56 },
    baldin: { src: 'assets/sprites/baldin.webp', anchorY: 0.973, height: 46 },
    faelas: { src: 'assets/sprites/faelas.webp', anchorY: 0.973, height: 58 },
    mithrandir: { src: 'assets/sprites/mithrandir.webp', anchorY: 0.973, height: 56 },
    peregrin: { src: 'assets/sprites/peregrin.webp', anchorY: 0.973, height: 42 },
  },
  enemies: {
    goblin: { src: 'assets/sprites/goblin.webp', anchorY: 0.973, height: 48 },
    warg: { src: 'assets/sprites/warg.webp', anchorY: 0.973, height: 42 },
    spider: { src: 'assets/sprites/spider.webp', anchorY: 0.965, height: 36 },
    troll: { src: 'assets/sprites/troll.webp', anchorY: 0.973, height: 88 },
  },
  // Гразготу и Моргулу арт пока не сделан — они остаются на геометрическом рендере.
  bosses: {},
};

// Ориентиры высот на экране при тайле 32 px: герой 48, мелкий монстр 40, тролль 72, босс 110.
const DEFAULT_ANCHOR_Y = 0.97;

// ---------- Тайлы пола ----------
// Бесшовные каменные текстуры 256x256. base заливает весь проходимый пол, остальные
// ложатся поверх редкими мягкими пятнами, чтобы подземелье не выглядело одной простынёй.
const FLOOR_TILES = {
  base: 'assets/tiles/floor_plain.webp',
  patches: [
    'assets/tiles/floor_crack.webp',
    'assets/tiles/floor_grit.webp',
    'assets/tiles/floor_moss.webp',
  ],
};

// ---------- Тайлсет стен ----------
// Лист 4x4 из 16 плиток по 64x64. Индекс плитки — битовая маска соседей-стен:
//   m = сверху*1 + справа*2 + снизу*4 + слева*8
// Позиция в листе: sx = (m % 4) * 64, sy = (m >> 2) * 64.
const WALL_TILES = { src: 'assets/tiles/wall_tileset.webp', size: 64, cols: 4 };

// ---------- Оружие ближнего боя ----------
// Чем герой машет. Рисуется вдоль оси X от рукояти к острию, длина приходит от рендера,
// поворот и положение кисти он же и задаёт. Ключи — id из js/data.js; кого тут нет,
// тот бьёт без оружия (лучники и маг вообще не машут — у них другой тип атаки).
const MELEE_WEAPONS = {
  arator: { kind: 'sword', blade: '#b9c4d4', guard: '#c9b27a', grip: '#3b2a18', width: 3.4, guardH: 6 },
  baldin: { kind: 'axe', blade: '#cdd6e2', guard: '#8a6a3a', grip: '#4a3620', width: 3.0, guardH: 5, head: 9 },
  peregrin: { kind: 'dagger', blade: '#d8dde6', guard: '#b8a06a', grip: '#33291a', width: 2.6, guardH: 4 },
};
const meleeWeapon = (id) => MELEE_WEAPONS[id] || null;

// Клинок в локальных координатах: рукоять около нуля, остриё на расстоянии len.
function drawMeleeWeapon(ctx, id, len) {
  const w = meleeWeapon(id);
  if (!w) return false;
  const bw = w.width, grip = 8;

  ctx.fillStyle = w.grip;
  ctx.fillRect(-grip - 3, -1.8, grip, 3.6);
  ctx.fillStyle = w.guard;
  ctx.beginPath(); ctx.arc(-grip - 3, 0, 2.2, 0, Math.PI * 2); ctx.fill();      // навершие
  ctx.fillRect(-1.5, -w.guardH / 2, 3, w.guardH);                              // гарда

  ctx.fillStyle = w.blade;
  if (w.kind === 'axe') {
    // Топор: голое древко и широкое лезвие у самого конца.
    ctx.fillStyle = w.grip; ctx.fillRect(0, -1.6, len - w.head, 3.2);
    ctx.fillStyle = w.blade;
    ctx.beginPath();
    ctx.moveTo(len - w.head, -2);
    ctx.quadraticCurveTo(len - 1, -w.head, len, -w.head * 0.35);
    ctx.lineTo(len, w.head * 0.35);
    ctx.quadraticCurveTo(len - 1, w.head, len - w.head, 2);
    ctx.closePath(); ctx.fill();
  } else {
    // Меч и кинжал: полоса, сужающаяся к острию.
    ctx.beginPath();
    ctx.moveTo(1.5, -bw); ctx.lineTo(len - 7, -bw * 0.65); ctx.lineTo(len, 0);
    ctx.lineTo(len - 7, bw * 0.65); ctx.lineTo(1.5, bw);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.8)';                                    // блик по долу
    ctx.fillRect(4, -0.7, len - 12, 1.2);
  }
  return true;
}

// ---------- Загрузка ----------
const GAME_ART = new Map();
const artKey = (kind, group, id) => `${kind}:${group}:${id}`;
const ready = (img) => !!(img && img.complete && img.naturalWidth);

function loadArt(kind, group, id, def) {
  const img = new Image();
  img.decoding = 'async';
  img.src = def.src;
  GAME_ART.set(artKey(kind, group, id), img);
  return img;
}

function preloadGameArt() {
  for (const [kind, table] of [['portrait', PORTRAITS], ['sprite', SPRITES]]) {
    for (const group of Object.keys(table)) {
      for (const [id, def] of Object.entries(table[group])) loadArt(kind, group, id, def);
    }
  }
}
preloadGameArt();

function loadImage(src) {
  const img = new Image();
  img.decoding = 'async';
  img.src = src;
  return img;
}

const BASE_TILE = loadImage(FLOOR_TILES.base);
const PATCH_TILES = FLOOR_TILES.patches.map(loadImage);
const WALL_SHEET = loadImage(WALL_TILES.src);
const tilesReady = () => ready(BASE_TILE) && PATCH_TILES.every(ready) && ready(WALL_SHEET);

// Плитки стен режем из листа один раз за загрузку в отдельные холсты размером с тайл карты.
// Зачем именно так: плитка в листе 64 px, а клетка карты TILE = 32, то есть при рисовании
// прямо из листа масштаб был бы 0.5, и интерполяция затягивала бы в края пиксели соседних
// плиток — на стыках стен появились бы швы. Копия каждой плитки в свой холст 1:1 отрезает
// её от соседей, а уменьшение делается один раз внутри изолированного холста.
let WALL_TILE_CACHE = null;
function wallTiles() {
  if (WALL_TILE_CACHE) return WALL_TILE_CACHE;
  if (!ready(WALL_SHEET)) return null;
  const { size, cols } = WALL_TILES;
  WALL_TILE_CACHE = [];
  for (let m = 0; m < 16; m++) {
    const cut = document.createElement('canvas');
    cut.width = cut.height = size;
    cut.getContext('2d').drawImage(WALL_SHEET, (m % cols) * size, Math.floor(m / cols) * size, size, size, 0, 0, size, size);

    const tile = document.createElement('canvas');
    tile.width = tile.height = TILE;
    const t = tile.getContext('2d');
    t.imageSmoothingQuality = 'high';
    t.drawImage(cut, 0, 0, size, size, 0, 0, TILE, TILE);
    WALL_TILE_CACHE.push(tile);
  }
  return WALL_TILE_CACHE;
}

// Маска соседей. За границей карты сосед считается стеной: map.get отдаёт там T_WALL.
// Колонны в маску не входят — это отдельные стоящие посреди комнаты объекты,
// и учитывать их как стену значило бы лепить на соседние стены лишние стыки.
// Стену в глубине монолита рисовать незачем — её ниоткуда не видно.
// Видимой считаем ту, у которой хотя бы один из восьми соседей не стена и не колонна.
function wallVisible(map, x, y) {
  for (let oy = -1; oy <= 1; oy++) {
    for (let ox = -1; ox <= 1; ox++) {
      const n = map.get(x + ox, y + oy);
      if (n !== T_WALL && n !== T_PILLAR) return true;
    }
  }
  return false;
}

function wallMask(map, x, y) {
  return (map.get(x, y - 1) === T_WALL ? 1 : 0)
    + (map.get(x + 1, y) === T_WALL ? 2 : 0)
    + (map.get(x, y + 1) === T_WALL ? 4 : 0)
    + (map.get(x - 1, y) === T_WALL ? 8 : 0);
}

// Подключить спрайт на ходу: достаточно положить файл и вызвать это с id из js/data.js.
function registerSprite(group, id, def) {
  if (!SPRITES[group]) SPRITES[group] = {};
  SPRITES[group][id] = def;
  loadArt('sprite', group, id, def);
}

const portraitDef = (group, id) => (PORTRAITS[group] && PORTRAITS[group][id]) || null;
const spriteDef = (group, id) => (SPRITES[group] && SPRITES[group][id]) || null;
const artImage = (kind, group, id) => GAME_ART.get(artKey(kind, group, id)) || null;
// Совместимость с DOM-частью ниже: путь к портрету героя для меню и карточек.
const artPath = (group, id) => { const d = portraitDef(group, id); return d && d.src; };

// ---------- Движение: что именно анимировать ----------
// Собирает из сущности всё, что нужно анимации, и прячет разницу между Player и Enemy.
function motionOf(group, ent, time) {
  if (ent.artSeed === undefined) ent.artSeed = R.float(0, Math.PI * 2);
  let facing, moving, attackK, flash, stunned;
  let aimX = 0, aimY = 0;
  if (group === 'heroes') {
    aimX = ent.aim.x; aimY = ent.aim.y;
    facing = ent.aim.x >= 0 ? 1 : -1;
    moving = !!ent.dash || Math.abs(ent.vx) + Math.abs(ent.vy) > 0.01;
    attackK = ent.recoil / RECOIL_TIME;
    flash = ent.hurtFlash / 0.15;
    stunned = ent.stunTime > 0;
  } else {
    facing = ent.dir.x >= 0 ? 1 : -1;
    moving = ent.state === 'chase' && Math.abs(ent.dir.x) + Math.abs(ent.dir.y) > 0.01;
    attackK = ent.def.windup ? 1 - ent.windup / ent.def.windup : 0;
    if (ent.state !== 'windup') attackK = 0;
    flash = ent.hitFlash / 0.12;
    stunned = ent.stun > 0;
  }
  return {
    facing, moving, stunned, time, seed: ent.artSeed, aimX, aimY,
    attackK: clamp(attackK, 0, 1),
    flash: clamp(flash, 0, 1),
  };
}

// ---------- Отрисовка спрайта ----------
// Белый силуэт для вспышки при попадании. Считается один раз на картинку.
const WHITE_MASK = new Map();
function whiteMask(img) {
  let c = WHITE_MASK.get(img);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = img.naturalWidth; c.height = img.naturalHeight;
  const t = c.getContext('2d');
  t.drawImage(img, 0, 0);
  t.globalCompositeOperation = 'source-in';
  t.fillStyle = '#ffffff';
  t.fillRect(0, 0, c.width, c.height);
  WHITE_MASK.set(img, c);
  return c;
}

function drawSprite(ctx, img, def, ent, m) {
  const h = def.height;
  const w = img.naturalWidth * (h / img.naturalHeight);
  const feet = h * (def.anchorY == null ? DEFAULT_ANCHOR_Y : def.anchorY);

  // Процедурная анимация: шаг при ходьбе, наклон в сторону бега, дыхание в покое,
  // выпад при атаке, дрожь при оглушении. Ни одного лишнего кадра арта не требует.
  const step = m.moving ? Math.sin(m.time * 12 + m.seed) : 0;
  const bob = m.moving ? -Math.abs(step) * 2.2 : Math.sin(m.time * 2 + m.seed) * 0.7;
  const lean = m.moving ? step * 0.045 : 0;
  const breath = m.moving ? 0 : Math.sin(m.time * 2 + m.seed) * 0.012;
  const wobble = m.stunned ? Math.sin(m.time * 22 + m.seed) * 0.08 : 0;
  const punch = m.attackK;
  // Выпад в сторону удара: тело коротко уходит вперёд и мягко возвращается.
  // По вертикали смещение меньше — вид сверху под углом, глубина сжата.
  const lunge = punch * punch;

  const baseAlpha = ctx.globalAlpha;
  ctx.save();
  ctx.translate(ent.x + m.aimX * lunge * 6, ent.y + bob + m.aimY * lunge * 3.5);
  if (m.facing < 0 && def.flip !== false) ctx.scale(-1, 1);
  // Разворот корпуса в удар. После зеркалирования поворот тоже зеркалится,
  // поэтому знак задавать не нужно — тело само доворачивается в нужную сторону.
  ctx.rotate(lean + wobble + punch * 0.24);
  ctx.scale(1 + punch * 0.10 + breath, 1 - punch * 0.07 + breath);
  ctx.drawImage(img, -w / 2, -feet, w, h);
  if (m.flash > 0) {
    ctx.globalAlpha = baseAlpha * m.flash * 0.85;
    ctx.drawImage(whiteMask(img), -w / 2, -feet, w, h);
  }
  ctx.restore();
}

// ---------- Отрисовка портрета круглым токеном ----------
// Вырезает из иллюстрации квадрат вокруг точки фокуса и вписывает его в круг.
function drawPortraitToken(ctx, img, def, x, y, radius, color) {
  const sw = img.naturalWidth, sh = img.naturalHeight;
  const side = Math.min(sw, sh) / (def.zoom || 1);
  const sx = clamp(sw * (def.focusX == null ? 0.5 : def.focusX) - side / 2, 0, sw - side);
  const sy = clamp(sh * (def.focusY == null ? 0.4 : def.focusY) - side / 2, 0, sh - side);

  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(img, sx, sy, side, side, x - radius, y - radius, radius * 2, radius * 2);
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = color || 'rgba(230,226,211,0.75)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

// ---------- Пол: запекание слоя ----------
// Текстура пола не зависит от кадра, поэтому вся карта рисуется один раз в отдельный
// холст, а каждый кадр из него берётся только видимый кусок одним drawImage.
// Лестницу сюда не кладём: её вид меняется по ходу боя с боссом.

// Пятно варианта с мягким краем. Узор привязан к координатам основного холста,
// иначе плиты пятна съедут относительно базовых.
function stampFloorPatch(ctx, img, map, rng) {
  const room = map.rooms.length ? rng.pick(map.rooms) : null;
  const cx = room ? (room.x + rng.float(0, room.w)) * TILE : rng.float(0, map.w * TILE);
  const cy = room ? (room.y + rng.float(0, room.h)) * TILE : rng.float(0, map.h * TILE);
  const r = rng.float(70, 190);
  const size = Math.ceil(r * 2);

  const patch = document.createElement('canvas');
  patch.width = patch.height = size;
  const p = patch.getContext('2d');
  p.translate(-(cx - r), -(cy - r));
  p.fillStyle = p.createPattern(img, 'repeat');
  p.fillRect(cx - r, cy - r, size, size);
  p.setTransform(1, 0, 0, 1, 0, 0);

  // Радиальная маска: к краю пятно растворяется, иначе оно выглядит наклейкой.
  p.globalCompositeOperation = 'destination-in';
  const grad = p.createRadialGradient(r, r, r * 0.15, r, r, r);
  grad.addColorStop(0, 'rgba(0,0,0,1)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  p.fillStyle = grad;
  p.fillRect(0, 0, size, size);

  ctx.globalAlpha = rng.float(0.35, 0.7);
  ctx.drawImage(patch, cx - r, cy - r);
  ctx.globalAlpha = 1;
}

// Одно и то же подземелье должно давать одну и ту же раскладку пятен.
function floorSeed(map) {
  let h = (map.w * 73856093) ^ (map.h * 19349663) ^ (map.rooms.length * 83492791);
  for (const r of map.rooms) h = (h * 31 + r.cx * 977 + r.cy) | 0;
  return Math.abs(h) || 1;
}

// Возвращает готовый холст или null, если текстуры ещё грузятся —
// тогда render.js рисует пол заливкой и пробует снова на следующем кадре.
function bakeFloorLayer(map) {
  if (!tilesReady()) return null;
  const canvas = document.createElement('canvas');
  canvas.width = map.w * TILE;
  canvas.height = map.h * TILE;
  const ctx = canvas.getContext('2d');

  // 1. Базовый камень — под проходимыми тайлами, колоннами и видимыми стенами.
  //    Под стенами он нужен потому, что у плитки прозрачный верхний край: без пола
  //    там просвечивал бы фон и вдоль стен шла бы чёрная полоса. В глубину скалы
  //    камень не кладём — оттуда он вылез бы наружу там, где должен быть монолит.
  ctx.fillStyle = ctx.createPattern(BASE_TILE, 'repeat');
  for (let y = 0; y < map.h; y++) {
    for (let x = 0; x < map.w; x++) {
      if (map.tiles[map.idx(x, y)] !== T_WALL || wallVisible(map, x, y)) ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
    }
  }

  // 2. Пятна вариантов. source-atop удерживает их строго на уже залитом полу,
  //    так что за границы комнат и коридоров они не выходят.
  const rng = new RNG(floorSeed(map));
  ctx.globalCompositeOperation = 'source-atop';
  const perTile = Math.max(2, Math.round((map.w * map.h) / 700));
  for (const img of PATCH_TILES) for (let i = 0; i < perTile; i++) stampFloorPatch(ctx, img, map, rng);
  ctx.globalCompositeOperation = 'source-over';

  // 3. Стены и колонны поверх пола.
  // Координаты целочисленные (px, py кратны TILE) и плитка кладётся 1:1 — швов не будет.
  const walls = wallTiles();
  for (let y = 0; y < map.h; y++) {
    for (let x = 0; x < map.w; x++) {
      const t = map.tiles[map.idx(x, y)], px = x * TILE, py = y * TILE;
      if (t === T_WALL) {
        if (!wallVisible(map, x, y)) continue;
        if (walls) {
          ctx.drawImage(walls[wallMask(map, x, y)], px, py);
        } else {
          ctx.fillStyle = COLORS.wall; ctx.fillRect(px, py, TILE, TILE);
          ctx.fillStyle = COLORS.wallTop; ctx.fillRect(px, py, TILE, 6);
          if (map.get(x, y + 1) !== T_WALL) { ctx.fillStyle = COLORS.wallEdge; ctx.fillRect(px, py + TILE - 5, TILE, 5); }
        }
      } else if (t === T_PILLAR) {
        ctx.fillStyle = COLORS.pillar; ctx.beginPath(); ctx.roundRect(px + 5, py + 3, TILE - 10, TILE - 6, 6); ctx.fill();
        ctx.fillStyle = '#6a6a88'; ctx.fillRect(px + 8, py + 5, TILE - 16, 4);
      }
    }
  }
  return canvas;
}

// ---------- Точки расширения, которые вызывает render.js ----------
// Ширина спрайта на экране — по ней рендер выбирает размер и высоту тени.
// null означает «спрайта нет», и тень встаёт под геометрическую фигуру.
function artSpriteWidth(group, id) {
  const def = spriteDef(group, id);
  if (!def) return null;
  const img = artImage('sprite', group, id);
  if (!ready(img)) return null;
  return img.naturalWidth * (def.height / img.naturalHeight);
}

// Высота спрайта на экране: по ней рендер поднимает полоску здоровья и значки над головой.
function artSpriteHeight(group, id) {
  const def = spriteDef(group, id);
  return def && ready(artImage('sprite', group, id)) ? def.height : null;
}

// Рисует тело существа. Возвращает false, если арта нет и рисовать должен render.js.
function drawEntityArt(ctx, group, id, ent, radius, color, time) {
  const sd = spriteDef(group, id);
  const simg = sd && artImage('sprite', group, id);
  if (sd && ready(simg)) { drawSprite(ctx, simg, sd, ent, motionOf(group, ent, time)); return true; }

  const pd = portraitDef(group, id);
  const pimg = pd && artImage('portrait', group, id);
  if (pd && ready(pimg)) { drawPortraitToken(ctx, pimg, pd, ent.x, ent.y, radius + 2, color); return true; }

  return false;
}

// В главном меню портреты не показываем: там и так фон, а ряд лиц его перегружает.
// Герои со своим артом встречают игрока на экране выбора.
if (typeof UI !== 'undefined') {
  // ---------- Выбор героя: карточки + крупный портрет ----------
  const baseRenderHeroSelect = UI.prototype.renderHeroSelect;
  UI.prototype.renderHeroSelect = function renderHeroSelectWithArt() {
    baseRenderHeroSelect.call(this);

    this.root.querySelectorAll('.hero-card[data-hero]').forEach((card) => {
      const id = card.dataset.hero;
      const imgPath = artPath('heroes', id);
      const symbol = card.querySelector('.hero-symbol');
      if (!symbol || !imgPath) return;
      symbol.classList.add('hero-art-thumb');
      symbol.style.background = 'transparent';
      symbol.innerHTML = `<img src="${imgPath}" alt="${HERO_BY_ID[id].name}" draggable="false">`;
    });

    const hero = HERO_BY_ID[this.heroId];
    const detail = this.root.querySelector('.hero-detail');
    const src = hero && artPath('heroes', hero.id);
    if (detail && src) {
      detail.classList.add('hero-detail-with-art');
      detail.insertAdjacentHTML('afterbegin', `
        <div class="hero-detail-art" aria-hidden="true">
          <img src="${src}" alt="" draggable="false">
        </div>`);
    }
  };
}

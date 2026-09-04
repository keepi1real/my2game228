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
const tilesReady = () => ready(BASE_TILE) && PATCH_TILES.every(ready);

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
  if (group === 'heroes') {
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
    facing, moving, stunned, time, seed: ent.artSeed,
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

  const baseAlpha = ctx.globalAlpha;
  ctx.save();
  ctx.translate(ent.x, ent.y + bob);
  if (m.facing < 0 && def.flip !== false) ctx.scale(-1, 1);
  ctx.rotate(lean + wobble + punch * 0.14);
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

  // 1. Базовый камень — только под проходимыми тайлами и колоннами,
  //    иначе текстура вылезет наружу там, где должна быть сплошная скала.
  ctx.fillStyle = ctx.createPattern(BASE_TILE, 'repeat');
  for (let y = 0; y < map.h; y++) {
    for (let x = 0; x < map.w; x++) {
      if (map.tiles[map.idx(x, y)] !== T_WALL) ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
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
  for (let y = 0; y < map.h; y++) {
    for (let x = 0; x < map.w; x++) {
      const t = map.tiles[map.idx(x, y)], px = x * TILE, py = y * TILE;
      if (t === T_WALL) {
        // Стены в глубине скалы не рисуем — их всё равно не видно.
        let nearFloor = false;
        for (let oy = -1; oy <= 1 && !nearFloor; oy++) {
          for (let ox = -1; ox <= 1; ox++) {
            const n = map.get(x + ox, y + oy);
            if (n !== T_WALL && n !== T_PILLAR) { nearFloor = true; break; }
          }
        }
        if (!nearFloor) continue;
        ctx.fillStyle = COLORS.wall; ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = COLORS.wallTop; ctx.fillRect(px, py, TILE, 6);
        if (map.get(x, y + 1) !== T_WALL) { ctx.fillStyle = COLORS.wallEdge; ctx.fillRect(px, py + TILE - 5, TILE, 5); }
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

// ---------- Главное меню: полоса пяти героев ----------
if (typeof UI !== 'undefined') {
  const baseShowMenu = UI.prototype.showMenu;
  UI.prototype.showMenu = function showMenuWithArt() {
    baseShowMenu.call(this);
    const panel = this.root.querySelector('.panel');
    const subtitle = panel && panel.querySelector('.subtitle');
    if (!panel || !subtitle || panel.querySelector('.menu-hero-strip')) return;
    const strip = document.createElement('div');
    strip.className = 'menu-hero-strip';
    strip.innerHTML = HEROES.map((h) => `
      <div class="menu-hero-mini" title="${h.name} — ${h.title}">
        <img src="${artPath('heroes', h.id)}" alt="${h.name}" draggable="false">
        <span>${h.name}</span>
      </div>`).join('');
    subtitle.insertAdjacentElement('afterend', strip);
  };

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

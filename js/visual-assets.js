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
// Вырезанные персонажи на прозрачном фоне, 512x512 PNG. Появляются в фазе 2.
// anchorY — доля высоты исходника, на которой находятся ступни (1 — самый низ картинки);
// height  — высота фигуры на экране в пикселях;
// flip    — можно ли зеркалить спрайт при движении влево (по умолчанию да).
// Ключи должны совпадать с id из js/data.js.
const SPRITES = {
  heroes: {},
  enemies: {},
  bosses: {},
};

// Ориентиры высот на экране при тайле 32 px: герой 48, мелкий монстр 40, тролль 72, босс 110.
const DEFAULT_ANCHOR_Y = 0.97;

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

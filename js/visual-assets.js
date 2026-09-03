'use strict';
// Визуальные ассеты героев/врагов. Этот слой не меняет боевую логику:
// если картинка не загрузилась, Renderer продолжит показывать старые геометрические маркеры.

const VISUAL_ASSETS = {
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
    // Тот же арт пещерного тролля, что временно закреплён за Гразготом: здесь он подходит буквально.
    troll: { src: 'assets/bosses/grazgot.webp', focusX: 0.46, focusY: 0.22, zoom: 2.0 },
  },
  bosses: {
    grazgot: { src: 'assets/bosses/grazgot.webp', focusX: 0.46, focusY: 0.22, zoom: 2.0 },
  },
};

const GAME_ART = new Map();

function artKey(group, id) { return `${group}:${id}`; }
function artDef(group, id) { return (VISUAL_ASSETS[group] && VISUAL_ASSETS[group][id]) || null; }
function artPath(group, id) { const d = artDef(group, id); return d && d.src; }
function artImage(group, id) { return GAME_ART.get(artKey(group, id)) || null; }

function preloadGameArt() {
  for (const group of Object.keys(VISUAL_ASSETS)) {
    for (const [id, def] of Object.entries(VISUAL_ASSETS[group])) {
      const img = new Image();
      img.decoding = 'async';
      img.src = def.src;
      img.addEventListener('load', () => GAME_ART.set(artKey(group, id), img), { once: true });
      // Сохраняем ссылку сразу: drawArtToken проверяет complete/naturalWidth.
      GAME_ART.set(artKey(group, id), img);
    }
  }
}
preloadGameArt();

// Рисует круглый токен: вырезает из картинки квадрат вокруг точки фокуса и вписывает в круг.
// focusX/focusY — доля ширины/высоты исходника, которая окажется в центре токена; zoom — во сколько
// раз вырезаемый квадрат меньше короткой стороны (чем больше, тем крупнее план).
function drawArtToken(ctx, img, x, y, radius, opts = {}) {
  if (!img || !img.complete || !img.naturalWidth) return false;
  const sw = img.naturalWidth, sh = img.naturalHeight;
  const side = Math.min(sw, sh) / (opts.zoom || 1);
  const sx = clamp(sw * (opts.focusX == null ? 0.5 : opts.focusX) - side / 2, 0, sw - side);
  const sy = clamp(sh * (opts.focusY == null ? 0.4 : opts.focusY) - side / 2, 0, sh - side);

  ctx.save();
  ctx.globalAlpha = opts.alpha == null ? 1 : opts.alpha;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(img, sx, sy, side, side, x - radius, y - radius, radius * 2, radius * 2);
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = opts.border || 'rgba(230,226,211,0.75)';
  ctx.lineWidth = opts.lineWidth || 1.5;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  return true;
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

// ---------- Игра: изображения поверх безопасного fallback Renderer ----------
if (typeof Renderer !== 'undefined') {
  const baseDrawPlayer = Renderer.prototype.drawPlayer;
  Renderer.prototype.drawPlayer = function drawPlayerWithArt() {
    baseDrawPlayer.call(this);
    const g = this.g, p = g.player, hero = g.hero;
    if (!p || !hero) return;
    const def = artDef('heroes', hero.id);
    if (!def) return;
    const invisible = typeof p.isInvisible === 'function' && p.isInvisible();
    const alpha = invisible ? 0.42 : 1;
    drawArtToken(this.ctx, artImage('heroes', hero.id), p.x, p.y, p.r + 2.5, {
      focusX: def.focusX, focusY: def.focusY, zoom: def.zoom,
      alpha,
      border: p.hurtFlash > 0 ? '#ffffff' : hero.color,
      lineWidth: p.hurtFlash > 0 ? 2.5 : 1.5,
    });
  };

  const baseDrawEnemies = Renderer.prototype.drawEnemies;
  Renderer.prototype.drawEnemies = function drawEnemiesWithArt() {
    baseDrawEnemies.call(this);
    const g = this.g, ctx = this.ctx;
    for (const e of g.enemies) {
      if (!e.alive || !this.visibleAt(e.x, e.y)) continue;
      const group = e.isBoss ? 'bosses' : 'enemies';
      const id = e.isBoss ? e.def.id : e.type;
      const def = artDef(group, id);
      if (!def) continue;
      const radius = e.isBoss ? e.r + 5 : e.r + 2;
      drawArtToken(ctx, artImage(group, id), e.x, e.y, radius, {
        focusX: def.focusX, focusY: def.focusY, zoom: def.zoom,
        border: e.hitFlash > 0 ? '#ffffff' : (e.isBoss && e.phase === 2 ? '#ff1744' : e.def.color),
        lineWidth: e.isBoss ? 2.5 : 1.5,
      });
      if (e.isBoss) {
        ctx.save();
        ctx.globalAlpha = 0.2 + Math.sin(g.time * 5) * 0.06;
        ctx.strokeStyle = e.phase === 2 ? '#ff1744' : '#d4a94a';
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(e.x, e.y, radius + 5, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      }
    }
  };
}

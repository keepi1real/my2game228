'use strict';
// Сенсорное управление. Включается само при первом касании и с этого момента
// подменяет клавиатуру с мышью; на настольной машине слой спит и ничего не стоит.
//
// Раскладка родом из мобильных рогаликов вроде Soul Knight: левый большой палец
// водит плавающий стик, правый лежит на кнопках. Прицел по умолчанию наводится
// сам на ближайшего врага — целиться пальцем в бою невозможно, а без прицела
// не работают ни лучник, ни маг.

// Кнопки заданы в координатах холста (1024×640) и вместе с ним масштабируются.
const TOUCH_UI = {
  attack: { x: 936, y: 552, r: 56 },
  dodge: { x: 842, y: 600, r: 34 },
  skills: [{ x: 832, y: 480, r: 33 }, { x: 894, y: 424, r: 33 }, { x: 968, y: 398, r: 33 }],
  use: { x: 700, y: 470, r: 34 },     // «торговать», показывается только у торговца
  bag: { x: 322, y: 34, r: 25 },
  pause: { x: 380, y: 34, r: 25 },
  // Расходники — ряд из четырёх ячеек 40×44, правый край на x = 800.
  consX: 800, consY: VIEW_H - 58, consW: 40, consH: 44, consGap: 6,
};

// Порядок ячеек расходников — общий для раскладки, HUD и горячих клавиш F G R T.
const CONSUMABLE_ORDER = ['potion', 'lembas', 'fireScroll', 'elixir'];

const STICK_MAX = 60;      // радиус, на котором стик даёт полную скорость
const STICK_DEAD = 8;      // мёртвая зона: дрожь пальца не должна двигать героя
const AIM_RANGE = 420;     // дальше этого автоприцел цель не ищет
const AIM_SMOOTH = 12;     // насколько быстро прицел доводится до цели

function touchConsumableRect(i) {
  const u = TOUCH_UI;
  const x = u.consX - (4 - i) * (u.consW + u.consGap);
  return { x, y: u.consY, w: u.consW, h: u.consH };
}

class TouchControls {
  constructor(canvas) {
    this.canvas = canvas;
    this.enabled = false;          // до первого касания слой не вмешивается
    this.move = { x: 0, y: 0 };    // нормализованный вектор движения
    this.stick = null;             // { id, ox, oy, x, y } — плавающий стик
    this.aimDrag = null;           // { id, ox, oy, x, y } — ручной прицел правой половиной
    this.attack = false;
    this.pressed = {};             // одноразовые нажатия, снимаются в endFrame
    this.buttons = {};             // что сейчас удерживается — только для подсветки
    this.showUse = false;          // рядом торговец: кнопка «торговать» видна и нажимается

    const opts = { passive: false };
    canvas.addEventListener('pointerdown', (e) => this.onDown(e), opts);
    canvas.addEventListener('pointermove', (e) => this.onMove(e), opts);
    for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) {
      canvas.addEventListener(ev, (e) => this.onUp(e), opts);
    }
  }

  // Координаты холста из координат страницы — тот же пересчёт, что у мыши.
  toCanvas(e) {
    const r = this.canvas.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) * (this.canvas.width / r.width),
      y: (e.clientY - r.top) * (this.canvas.height / r.height),
    };
  }

  // Какая кнопка под точкой. null — значит попали в пустое место.
  hitButton(x, y) {
    const u = TOUCH_UI;
    const inCircle = (b) => (x - b.x) ** 2 + (y - b.y) ** 2 <= b.r * b.r;
    if (inCircle(u.attack)) return 'attack';
    if (inCircle(u.dodge)) return 'dodge';
    for (let i = 0; i < 3; i++) if (inCircle(u.skills[i])) return 'skill' + i;
    if (this.showUse && inCircle(u.use)) return 'use';
    if (inCircle(u.bag)) return 'bag';
    if (inCircle(u.pause)) return 'pause';
    for (let i = 0; i < 4; i++) {
      const r = touchConsumableRect(i);
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return 'cons' + i;
    }
    return null;
  }

  onDown(e) {
    if (e.pointerType === 'mouse') return;
    this.enabled = true;
    e.preventDefault();
    const p = this.toCanvas(e);
    const b = this.hitButton(p.x, p.y);
    if (b) {
      this.buttons[b] = e.pointerId;
      if (b === 'attack') this.attack = true;
      else this.pressed[b] = true;     // остальные срабатывают один раз за касание
      return;
    }
    // Пустое место: левая половина — стик движения, правая — ручной прицел.
    const slot = p.x < VIEW_W / 2 ? 'stick' : 'aimDrag';
    this[slot] = { id: e.pointerId, ox: p.x, oy: p.y, x: p.x, y: p.y };
  }

  onMove(e) {
    if (e.pointerType === 'mouse' || !this.enabled) return;
    for (const slot of ['stick', 'aimDrag']) {
      const s = this[slot];
      if (s && s.id === e.pointerId) { e.preventDefault(); const p = this.toCanvas(e); s.x = p.x; s.y = p.y; }
    }
  }

  onUp(e) {
    if (e.pointerType === 'mouse') return;
    for (const slot of ['stick', 'aimDrag']) {
      if (this[slot] && this[slot].id === e.pointerId) this[slot] = null;
    }
    for (const b in this.buttons) {
      if (this.buttons[b] !== e.pointerId) continue;
      delete this.buttons[b];
      if (b === 'attack') this.attack = false;
    }
  }

  // Вектор движения от стика. Полная скорость на STICK_MAX, ближе — плавно меньше.
  moveVector() {
    const s = this.stick;
    if (!s) return null;
    const dx = s.x - s.ox, dy = s.y - s.oy;
    const len = Math.hypot(dx, dy);
    if (len < STICK_DEAD) return { x: 0, y: 0 };
    const k = Math.min(1, len / STICK_MAX) / len;
    return { x: dx * k, y: dy * k };
  }

  // Направление ручного прицела, если игрок ведёт пальцем по правой половине.
  aimVector() {
    const s = this.aimDrag;
    if (!s) return null;
    const dx = s.x - s.ox, dy = s.y - s.oy;
    const len = Math.hypot(dx, dy);
    if (len < STICK_DEAD) return null;
    return { x: dx / len, y: dy / len };
  }

  hit(name) { const v = !!this.pressed[name]; this.pressed[name] = false; return v; }
  held(name) { return name in this.buttons; }
  endFrame() { this.pressed = {}; }
}

// Автоприцел: ближайший видимый враг в пределах AIM_RANGE.
// Возвращает нормализованное направление или null, если целиться не в кого.
function autoAimDir(game, p) {
  let best = null, bestD = AIM_RANGE;
  for (const e of game.enemies) {
    if (!e.alive) continue;
    const d = dist(p.x, p.y, e.x, e.y);
    if (d >= bestD) continue;
    const tx = Math.floor(e.x / TILE), ty = Math.floor(e.y / TILE);
    if (game.map && !game.map.visible[game.map.idx(tx, ty)]) continue;
    best = e; bestD = d;
  }
  if (!best) return null;
  const dx = best.x - p.x, dy = best.y - p.y, len = Math.hypot(dx, dy) || 1;
  return { x: dx / len, y: dy / len };
}

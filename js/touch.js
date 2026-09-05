'use strict';
// Сенсорное управление.
//
// Слой ничего не знает про бой и ничего не меняет в его правилах: он синтезирует
// ровно то же, что даёт клавиатура с мышью. Стик кладёт вектор в input.stick,
// кнопки взводят те же коды клавиш, что и физические, а прицел выставляется
// через input.mouse — как если бы игрок водил курсором. Поэтому game.js
// про сенсор знает всего в двух местах: вызов applyTo и чтение стика.

// Раскладка в координатах канваса (1024x640), landscape.
// Крупная атака под правым большим пальцем, умения дугой над ней, служебные
// кнопки наверху — они нажимаются редко и до них можно тянуться.
const TOUCH_BUTTONS = [
  { id: 'attack', x: 906, y: 528, r: 62, hold: true },
  { id: 'dodge', x: 786, y: 566, r: 42, key: 'ShiftLeft', icon: '⇢' },
  { id: 'skill0', x: 762, y: 438, r: 40, key: 'Digit1' },
  { id: 'skill1', x: 846, y: 396, r: 40, key: 'Digit2' },
  { id: 'skill2', x: 936, y: 384, r: 40, key: 'Digit3' },
  { id: 'potion', x: 688, y: 552, r: 36, key: 'KeyF' },
  { id: 'pause', x: 330, y: 36, r: 26, key: 'Escape', icon: '❚❚' },
  { id: 'bag', x: 394, y: 36, r: 26, key: 'KeyI', icon: '▤' },
];
const STICK_MAX = 62;      // радиус отклонения стика
const STICK_DEAD = 9;      // мёртвая зона, иначе палец «дрожит» на месте
const AIM_REACH = 220;     // куда ставится виртуальный курсор от героя

const TouchControls = {
  active: false,
  stick: null,      // { id, ox, oy, x, y }
  aim: null,        // { id, ox, oy, x, y } — протяжка от кнопки атаки
  held: {},         // id кнопки -> идентификатор касания
  canvas: null,
  input: null,

  attach(canvas, input) {
    this.canvas = canvas; this.input = input;
    const opts = { passive: false };
    canvas.addEventListener('touchstart', (e) => this.onStart(e), opts);
    canvas.addEventListener('touchmove', (e) => this.onMove(e), opts);
    canvas.addEventListener('touchend', (e) => this.onEnd(e), opts);
    canvas.addEventListener('touchcancel', (e) => this.onEnd(e), opts);
  },
  // Координаты касания в системе канваса.
  point(t) {
    const r = this.canvas.getBoundingClientRect();
    return { x: (t.clientX - r.left) * (this.canvas.width / r.width), y: (t.clientY - r.top) * (this.canvas.height / r.height) };
  },
  buttonAt(x, y) {
    // Кнопки имеют приоритет над стиком, поэтому проверяются первыми.
    // Зона нажатия чуть шире рисунка: палец попадает не в центр.
    for (const b of TOUCH_BUTTONS) {
      const pad = b.r * 0.25;
      if ((x - b.x) ** 2 + (y - b.y) ** 2 <= (b.r + pad) ** 2) return b;
    }
    return null;
  },
  onStart(e) {
    e.preventDefault();
    this.active = true;
    for (const t of e.changedTouches) {
      const p = this.point(t);
      const b = this.buttonAt(p.x, p.y);
      if (b) {
        this.held[b.id] = t.identifier;
        if (b.hold) { this.input.mouse.down = true; this.aim = { id: t.identifier, ox: p.x, oy: p.y, x: p.x, y: p.y }; }
        else if (b.key) { this.input.keys[b.key] = true; this.input.pressed[b.key] = true; }
        continue;
      }
      // Стик плавающий: центр там, где палец коснулся, а не в углу.
      if (!this.stick && p.x < this.canvas.width * 0.5 && p.y > 90) {
        this.stick = { id: t.identifier, ox: p.x, oy: p.y, x: p.x, y: p.y };
      }
    }
  },
  onMove(e) {
    e.preventDefault();
    for (const t of e.changedTouches) {
      const p = this.point(t);
      if (this.stick && this.stick.id === t.identifier) { this.stick.x = p.x; this.stick.y = p.y; }
      if (this.aim && this.aim.id === t.identifier) { this.aim.x = p.x; this.aim.y = p.y; }
    }
  },
  onEnd(e) {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (this.stick && this.stick.id === t.identifier) this.stick = null;
      if (this.aim && this.aim.id === t.identifier) { this.aim = null; this.input.mouse.down = false; }
      for (const b of TOUCH_BUTTONS) {
        if (this.held[b.id] !== t.identifier) continue;
        delete this.held[b.id];
        if (b.hold) this.input.mouse.down = false;
        else if (b.key) this.input.keys[b.key] = false;
      }
    }
  },
  // Сброс всех касаний: вкладку свернули, палец «завис».
  release() {
    this.stick = null; this.aim = null; this.held = {};
    if (this.input) this.input.mouse.down = false;
  },
  // Вектор стика: длина 0..1, мёртвая зона снята.
  vector() {
    if (!this.stick) return null;
    const dx = this.stick.x - this.stick.ox, dy = this.stick.y - this.stick.oy;
    const len = Math.hypot(dx, dy);
    if (len < STICK_DEAD) return null;
    const k = Math.min(1, (len - STICK_DEAD) / (STICK_MAX - STICK_DEAD));
    return { x: dx / len, y: dy / len, len: k };
  },
  // Направление протяжки от кнопки атаки — ручное прицеливание.
  aimVector() {
    if (!this.aim) return null;
    const dx = this.aim.x - this.aim.ox, dy = this.aim.y - this.aim.oy;
    const len = Math.hypot(dx, dy);
    if (len < 16) return null;
    return { x: dx / len, y: dy / len };
  },
  // Вызывается раз в кадр до игровой логики.
  applyTo(input, game) {
    if (!this.active) return;
    const v = this.vector();
    input.stick = v;
    const p = game.player;
    if (!p || game.state !== 'run') return;
    // Прицел: протяжка от атаки главнее, иначе смотрим туда, куда идём.
    // Без движения прицел остаётся прежним — герой не «крутится» сам по себе.
    const a = this.aimVector() || (v && v.len > 0.25 ? v : null);
    if (a) {
      input.mouse.x = p.x + a.x * AIM_REACH - game.camera.x;
      input.mouse.y = p.y + a.y * AIM_REACH - game.camera.y;
    }
  },
};

// ---------- Отрисовка ----------
// Вызывается из render.js через мягкую проверку: без этого файла игра остаётся
// полностью рабочей на клавиатуре.
function drawTouchControls(ctx, game) {
  if (!TouchControls.active) return;
  const p = game.player, hero = game.hero;
  ctx.save();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';

  // Стик.
  const s = TouchControls.stick;
  if (s) {
    const dx = s.x - s.ox, dy = s.y - s.oy, len = Math.hypot(dx, dy) || 1;
    const k = Math.min(1, len / STICK_MAX);
    ctx.globalAlpha = 0.22; ctx.fillStyle = '#e6e2d3';
    ctx.beginPath(); ctx.arc(s.ox, s.oy, STICK_MAX, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 0.5; ctx.strokeStyle = '#e6e2d3'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(s.ox, s.oy, STICK_MAX, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 0.75; ctx.fillStyle = hero ? hero.color : '#d4a94a';
    ctx.beginPath(); ctx.arc(s.ox + dx / len * STICK_MAX * k, s.oy + dy / len * STICK_MAX * k, 26, 0, Math.PI * 2); ctx.fill();
  }

  for (const b of TOUCH_BUTTONS) {
    const pressed = TouchControls.held[b.id] !== undefined;
    let icon = b.icon || '', label = '', cd = 0, full = 1, disabled = false, color = '#e6e2d3';
    if (b.id === 'attack') { icon = '⚔'; cd = p ? p.attackTimer : 0; full = p ? p.attackCooldown() : 1; color = hero ? hero.color : '#d4a94a'; }
    else if (b.id === 'dodge') { cd = p ? p.dodgeCd : 0; full = 1.4; }
    else if (b.id.startsWith('skill')) {
      const i = +b.id.slice(5);
      const sk = hero ? SKILLS[hero.skills[i]] : null;
      icon = sk ? sk.icon : '?'; label = String(i + 1);
      cd = p ? p.skillCds[i] : 0; full = sk && p ? sk.cooldown * (1 - p.cdr()) : 1;
      color = hero ? hero.color : '#d4a94a';
    } else if (b.id === 'potion') {
      const n = p ? p.consumables.potion : 0;
      icon = CONSUMABLES.potion.icon; label = '×' + n; disabled = n <= 0; color = CONSUMABLES.potion.color;
    }
    ctx.globalAlpha = disabled ? 0.3 : pressed ? 0.95 : 0.62;
    ctx.fillStyle = 'rgba(8,8,14,0.72)';
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = pressed ? '#ffffff' : color; ctx.lineWidth = pressed ? 3 : 2;
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.stroke();
    // Перезарядка — сектором по кругу кнопки, чтобы её было видно, не отводя взгляда.
    if (cd > 0 && full > 0) {
      ctx.globalAlpha = 0.5; ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.moveTo(b.x, b.y);
      ctx.arc(b.x, b.y, b.r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, cd / full));
      ctx.closePath(); ctx.fill();
    }
    ctx.globalAlpha = disabled ? 0.4 : 0.95;
    ctx.fillStyle = color; ctx.font = `bold ${Math.round(b.r * 0.8)}px sans-serif`;
    ctx.fillText(icon, b.x, b.y + (label ? -4 : 1));
    if (label) { ctx.fillStyle = '#e6e2d3'; ctx.font = 'bold 12px sans-serif'; ctx.fillText(label, b.x, b.y + b.r * 0.55); }
  }
  ctx.restore();
}

'use strict';
// Общие утилиты: RNG, математика, геометрия.

const TILE = 32;
const RECOIL_TIME = 0.14; // длительность выпада при атаке, общая для взмаха и выстрела
const VIEW_W = 1024;
const VIEW_H = 640;

class RNG {
  constructor(seed) { this.s = (seed >>> 0) || 1; }
  next() {
    // mulberry32
    this.s = (this.s + 0x6D2B79F5) | 0;
    let t = Math.imul(this.s ^ (this.s >>> 15), 1 | this.s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  float(a = 0, b = 1) { return a + this.next() * (b - a); }
  int(a, b) { return Math.floor(this.float(a, b + 1)); }
  pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
  chance(p) { return this.next() < p; }
  weighted(arr, wfn) {
    let total = 0;
    for (const it of arr) total += wfn(it);
    let r = this.next() * total;
    for (const it of arr) { r -= wfn(it); if (r <= 0) return it; }
    return arr[arr.length - 1];
  }
  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
}

// Общий RNG для боя/лута (несидированный от пола).
const R = new RNG((Date.now() ^ 0x9E3779B9) >>> 0);

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
const angleTo = (ax, ay, bx, by) => Math.atan2(by - ay, bx - ax);
const angleDiff = (a, b) => {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
};
const fmt = (n) => (Math.abs(n) >= 1000 ? Math.round(n).toLocaleString('ru-RU') : String(Math.round(n)));
const pct = (n) => Math.round(n * 100) + '%';
const sign = (n) => (n > 0 ? '+' : '') + n;

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Бресенхем для проверки видимости между тайлами.
function lineOfSight(map, x0, y0, x1, y1) {
  let dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
  let sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = x0, y = y0;
  for (let i = 0; i < 200; i++) {
    if (x === x1 && y === y1) return true;
    if (!(x === x0 && y === y0) && map.isWall(x, y)) return false;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x += sx; }
    if (e2 <= dx) { err += dx; y += sy; }
  }
  return false;
}

if (typeof module !== 'undefined') module.exports = { RNG, clamp, lerp, dist, angleTo, angleDiff, lineOfSight, TILE };

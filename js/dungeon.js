'use strict';
// Генерация этажей: комнаты + коридоры, арены боссов, туман войны.

const T_WALL = 0, T_FLOOR = 1, T_STAIRS = 2, T_PILLAR = 3;

class GameMap {
  constructor(w, h) {
    this.w = w; this.h = h;
    this.tiles = new Uint8Array(w * h);
    this.explored = new Uint8Array(w * h);
    this.visible = new Uint8Array(w * h);
    this.rooms = [];
    this.torches = [];
    this.decor = [];
  }
  idx(x, y) { return y * this.w + x; }
  inBounds(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  get(x, y) { return this.inBounds(x, y) ? this.tiles[this.idx(x, y)] : T_WALL; }
  set(x, y, t) { if (this.inBounds(x, y)) this.tiles[this.idx(x, y)] = t; }
  isWall(x, y) { const t = this.get(x, y); return t === T_WALL || t === T_PILLAR; }
  isWalkable(x, y) { return !this.isWall(x, y); }
  // Проверка круга (в пикселях) на столкновение со стенами.
  circleBlocked(px, py, r) {
    const x0 = Math.floor((px - r) / TILE), x1 = Math.floor((px + r) / TILE);
    const y0 = Math.floor((py - r) / TILE), y1 = Math.floor((py + r) / TILE);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if (!this.isWall(x, y)) continue;
      // Ближайшая точка тайла к центру круга.
      const cx = clamp(px, x * TILE, x * TILE + TILE), cy = clamp(py, y * TILE, y * TILE + TILE);
      if ((cx - px) ** 2 + (cy - py) ** 2 < r * r) return true;
    }
    return false;
  }
  // Обновление видимости вокруг точки (в тайлах).
  updateVisibility(cx, cy, radius) {
    this.visible.fill(0);
    const r2 = radius * radius;
    for (let y = cy - radius; y <= cy + radius; y++) {
      for (let x = cx - radius; x <= cx + radius; x++) {
        if (!this.inBounds(x, y)) continue;
        const dx = x - cx, dy = y - cy;
        if (dx * dx + dy * dy > r2) continue;
        if (lineOfSight(this, cx, cy, x, y)) {
          const i = this.idx(x, y);
          this.visible[i] = 1; this.explored[i] = 1;
        }
      }
    }
  }
  // BFS-поле расстояний от тайла (для навигации врагов).
  flowField(tx, ty) {
    const dist = new Int16Array(this.w * this.h).fill(-1);
    if (!this.inBounds(tx, ty) || this.isWall(tx, ty)) return dist;
    const q = [this.idx(tx, ty)];
    dist[q[0]] = 0;
    let head = 0;
    while (head < q.length) {
      const i = q[head++];
      const x = i % this.w, y = (i / this.w) | 0, d = dist[i];
      const n = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]];
      for (const [nx, ny] of n) {
        if (!this.inBounds(nx, ny) || this.isWall(nx, ny)) continue;
        const j = this.idx(nx, ny);
        if (dist[j] !== -1) continue;
        dist[j] = d + 1;
        q.push(j);
      }
    }
    return dist;
  }
}

function rectsOverlap(a, b, pad) {
  return a.x - pad < b.x + b.w && a.x + a.w + pad > b.x && a.y - pad < b.y + b.h && a.y + a.h + pad > b.y;
}

// Возвращает { map, spawn, stairs, enemies:[{type,x,y}], chests:[{x,y}], merchant:{x,y}|null, boss:{id,x,y}|null }
function generateFloor(floor, seed) {
  const rng = new RNG(seed);
  const isBoss = BOSS_FLOORS.includes(floor);
  return isBoss ? generateBossArena(floor, rng) : generateRooms(floor, rng);
}

function generateRooms(floor, rng) {
  const W = 52 + Math.min(floor, 6) * 2, H = 38 + Math.min(floor, 6);
  const map = new GameMap(W, H);
  const rooms = [];
  const target = 8 + Math.min(floor, 5);
  for (let attempt = 0; attempt < 400 && rooms.length < target; attempt++) {
    const w = rng.int(5, 11), h = rng.int(4, 9);
    const x = rng.int(1, W - w - 2), y = rng.int(1, H - h - 2);
    const r = { x, y, w, h, cx: x + (w >> 1), cy: y + (h >> 1) };
    if (rooms.some((o) => rectsOverlap(r, o, 2))) continue;
    rooms.push(r);
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) map.set(xx, yy, T_FLOOR);
  }
  // Сортируем комнаты по X, чтобы коридоры шли примерно слева направо, и соединяем цепочкой.
  rooms.sort((a, b) => a.cx - b.cx);
  for (let i = 1; i < rooms.length; i++) carveCorridor(map, rooms[i - 1], rooms[i], rng);
  // Пара дополнительных петель для вариативности.
  for (let k = 0; k < 2 && rooms.length > 3; k++) {
    const a = rng.pick(rooms), b = rng.pick(rooms);
    if (a !== b) carveCorridor(map, a, b, rng);
  }
  // Колонны в больших комнатах.
  for (const r of rooms) {
    if (r.w >= 8 && r.h >= 6 && rng.chance(0.6)) {
      const n = rng.int(1, 3);
      for (let i = 0; i < n; i++) {
        const px = rng.int(r.x + 2, r.x + r.w - 3), py = rng.int(r.y + 2, r.y + r.h - 3);
        if (px !== r.cx || py !== r.cy) map.set(px, py, T_PILLAR);
      }
    }
  }
  map.rooms = rooms;
  placeTorches(map, rng);

  const first = rooms[0];
  // Лестница — в самой дальней по BFS комнате.
  const field = map.flowField(first.cx, first.cy);
  let last = rooms[rooms.length - 1], best = -1;
  for (const r of rooms) { const d = field[map.idx(r.cx, r.cy)]; if (d > best) { best = d; last = r; } }
  map.set(last.cx, last.cy, T_STAIRS);

  const spawn = { x: (first.cx + 0.5) * TILE, y: (first.cy + 0.5) * TILE };
  const stairs = { x: (last.cx + 0.5) * TILE, y: (last.cy + 0.5) * TILE };

  // Враги.
  const enemies = [];
  const pool = Object.keys(MONSTERS).filter((k) => MONSTERS[k].minFloor <= floor);
  const middle = rooms.filter((r) => r !== first);
  const totalEnemies = 9 + floor * 3;
  for (let i = 0; i < totalEnemies; i++) {
    const r = rng.pick(middle);
    const type = rng.weighted(pool, (k) => MONSTERS[k].weight * (MONSTERS[k].minFloor >= floor - 1 ? 1.5 : 1));
    const pos = randomFloorInRoom(map, r, rng);
    if (!pos) continue;
    enemies.push({ type, x: pos.x, y: pos.y });
  }

  // Сундуки.
  const chests = [];
  const chestCount = rng.int(1, 2) + (rng.chance(0.3) ? 1 : 0);
  for (let i = 0; i < chestCount; i++) {
    const r = rng.pick(middle);
    const pos = randomFloorInRoom(map, r, rng);
    if (pos) chests.push(pos);
  }

  // Торговец.
  let merchant = null;
  if (MERCHANT_FLOORS.includes(floor)) {
    const candidates = middle.filter((r) => r !== last);
    const r = rng.pick(candidates.length ? candidates : middle);
    const pos = randomFloorInRoom(map, r, rng);
    if (pos) merchant = pos;
  }
  return { map, spawn, stairs, enemies, chests, merchant, boss: null };
}

function generateBossArena(floor, rng) {
  const W = 36, H = 28;
  const map = new GameMap(W, H);
  const r = { x: 4, y: 4, w: W - 8, h: H - 8, cx: W >> 1, cy: H >> 1 };
  for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) map.set(x, y, T_FLOOR);
  // Срезаем углы для формы арены.
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4 - i; j++) {
    map.set(r.x + i, r.y + j, T_WALL); map.set(r.x + r.w - 1 - i, r.y + j, T_WALL);
    map.set(r.x + i, r.y + r.h - 1 - j, T_WALL); map.set(r.x + r.w - 1 - i, r.y + r.h - 1 - j, T_WALL);
  }
  // Четыре колонны.
  for (const [px, py] of [[r.cx - 6, r.cy - 4], [r.cx + 6, r.cy - 4], [r.cx - 6, r.cy + 4], [r.cx + 6, r.cy + 4]]) map.set(px, py, T_PILLAR);
  map.rooms = [r];
  placeTorches(map, rng);
  // Открываем всю арену сразу.
  map.explored.fill(1);
  const spawn = { x: (r.x + 3) * TILE, y: (r.cy + 0.5) * TILE };
  const stairsTx = r.x + r.w - 3;
  map.set(stairsTx, r.cy, T_STAIRS);
  const stairs = { x: (stairsTx + 0.5) * TILE, y: (r.cy + 0.5) * TILE };
  const bossId = floor >= 10 ? 'morgul' : 'grazgot';
  return { map, spawn, stairs, enemies: [], chests: [], merchant: null, boss: { id: bossId, x: (r.cx + 4) * TILE, y: (r.cy + 0.5) * TILE } };
}

function carveCorridor(map, a, b, rng) {
  let x = a.cx, y = a.cy;
  const horizontalFirst = rng.chance(0.5);
  const carve = (cx, cy) => { if (map.get(cx, cy) === T_WALL) map.set(cx, cy, T_FLOOR); };
  const stepX = () => { while (x !== b.cx) { x += Math.sign(b.cx - x); carve(x, y); } };
  const stepY = () => { while (y !== b.cy) { y += Math.sign(b.cy - y); carve(x, y); } };
  if (horizontalFirst) { stepX(); stepY(); } else { stepY(); stepX(); }
}

function randomFloorInRoom(map, r, rng) {
  for (let i = 0; i < 20; i++) {
    const x = rng.int(r.x, r.x + r.w - 1), y = rng.int(r.y, r.y + r.h - 1);
    if (map.get(x, y) === T_FLOOR) return { x: (x + 0.5) * TILE, y: (y + 0.5) * TILE };
  }
  return null;
}

function placeTorches(map, rng) {
  map.torches = [];
  for (let y = 1; y < map.h - 1; y++) for (let x = 1; x < map.w - 1; x++) {
    if (map.get(x, y) !== T_FLOOR) continue;
    if (map.get(x, y - 1) === T_WALL && rng.chance(0.08)) map.torches.push({ x: (x + 0.5) * TILE, y: y * TILE + 4, phase: rng.float(0, 6.28) });
  }
}

if (typeof module !== 'undefined') module.exports = { GameMap, generateFloor, T_WALL, T_FLOOR, T_STAIRS, T_PILLAR };

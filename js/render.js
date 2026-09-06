'use strict';
// Отрисовка: изометрическая карта, сущности, эффекты, HUD.
//
// Мир плоский — сущности живут в обычных пиксельных координатах, — а на экран он
// кладётся проекцией из js/iso.js. Всё, что лежит в плоскости пола (тени, круги
// умений, дуга взмаха), рисуется эллипсом 2:1: именно так выглядит окружность,
// если смотреть на пол под изометрическим углом.

const COLORS = {
  floor: '#24242f', floorAlt: '#20202a', unseen: '#07070b', fog: 'rgba(5,5,10,0.55)',
  wall: '#3a3a4e', wallTop: '#4a4a62', wallEdge: '#2a2a3a', pillar: '#55556e',
  stairs: '#d4a94a', gold: '#ffd54f', chest: '#b8863b', merchant: '#6fc3df',
};

// Грани блока. Свет падает сверху-слева, поэтому левая щека светлее правой —
// без этой разницы блок читается как плоский ромб, а не как объём.
const WALL_LIT = { top: '#4c4c64', left: '#3a3a4e', right: '#2b2b3c' };
const WALL_DIM = { top: '#2c2c3a', left: '#22222e', right: '#191922' };
const PILLAR_LIT = { top: '#5f5f7c', left: '#4a4a60', right: '#35354a' };
const PILLAR_DIM = { top: '#37374a', left: '#2b2b39', right: '#20202b' };

function drawShape(ctx, shape, x, y, r, color, angle = 0) {
  ctx.fillStyle = color;
  ctx.beginPath();
  if (shape === 'circle') ctx.arc(x, y, r, 0, Math.PI * 2);
  else if (shape === 'square') { ctx.save(); ctx.translate(x, y); ctx.rotate(angle); ctx.rect(-r, -r, r * 2, r * 2); ctx.restore(); }
  else if (shape === 'tri') { ctx.save(); ctx.translate(x, y); ctx.rotate(angle); ctx.moveTo(r, 0); ctx.lineTo(-r * 0.8, r * 0.85); ctx.lineTo(-r * 0.8, -r * 0.85); ctx.closePath(); ctx.restore(); }
  else if (shape === 'diamond') { ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y); ctx.closePath(); }
  else if (shape === 'hex') { for (let i = 0; i < 6; i++) { const a = Math.PI / 3 * i; const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r; if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py); } ctx.closePath(); }
  ctx.fill();
}

class Renderer {
  constructor(game) { this.g = game; this.ctx = game.ctx; }

  render() {
    const g = this.g, ctx = this.ctx;
    ctx.fillStyle = '#07070b'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    if (!g.map || !g.player) return;
    let sx = 0, sy = 0;
    if (g.shake > 0) { sx = (Math.random() - 0.5) * g.shake; sy = (Math.random() - 0.5) * g.shake; }
    ctx.save();
    // Камера хранится уже в координатах проекции, поэтому здесь только сдвиг и приближение.
    ctx.translate(Math.round(VIEW_W / 2 + sx), Math.round(VIEW_H / 2 + sy));
    ctx.scale(ISO_ZOOM, ISO_ZOOM);
    ctx.translate(-g.camera.x, -g.camera.y);
    this.bounds = this.viewTiles();
    this.drawFloor();
    this.drawFogFloor();
    this.drawTorches();
    this.drawTelegraphs();
    this.drawScene();
    this.drawProjectiles();
    this.drawEffects();
    this.drawParticles();
    this.drawTexts();
    ctx.restore();
    this.drawHud();
  }

  // ---------- Геометрия ----------
  // Какие тайлы могут попасть в кадр. Экран — прямоугольник, в мире ему отвечает
  // повёрнутый квадрат, поэтому берём габариты по четырём его углам.
  viewTiles() {
    const g = this.g, map = g.map;
    const hw = VIEW_W / 2 / ISO_ZOOM, hh = VIEW_H / 2 / ISO_ZOOM;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const [dx, dy] of [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]]) {
      const w = isoToWorld(g.camera.x + dx, g.camera.y + dy);
      if (w.x < minX) minX = w.x;
      if (w.x > maxX) maxX = w.x;
      if (w.y < minY) minY = w.y;
      if (w.y > maxY) maxY = w.y;
    }
    // Запас: блок стены поднимается над своим тайлом, поэтому в кадр залезают и те,
    // чей пол уже ушёл за нижний край экрана.
    const pad = 3;
    return {
      x0: clamp(Math.floor(minX / TILE) - pad, 0, map.w - 1),
      y0: clamp(Math.floor(minY / TILE) - pad, 0, map.h - 1),
      x1: clamp(Math.ceil(maxX / TILE) + pad, 0, map.w - 1),
      y1: clamp(Math.ceil(maxY / TILE) + pad, 0, map.h - 1),
    };
  }

  // Ромб как подпуть. Обход всегда в одну сторону, чтобы соседние ромбы в общем
  // пути сливались без светлых швов по общим рёбрам.
  tilePath(x0, y0, x1, y1, lift) {
    const ctx = this.ctx;
    ctx.moveTo(isoX(x0, y0), isoY(x0, y0) - lift);
    ctx.lineTo(isoX(x1, y0), isoY(x1, y0) - lift);
    ctx.lineTo(isoX(x1, y1), isoY(x1, y1) - lift);
    ctx.lineTo(isoX(x0, y1), isoY(x0, y1) - lift);
    ctx.closePath();
  }
  tileDiamond(tx, ty, lift, inset = 0) {
    this.tilePath(tx * TILE + inset, ty * TILE + inset, (tx + 1) * TILE - inset, (ty + 1) * TILE - inset, lift);
  }
  // Окружность в плоскости пола.
  floorEllipse(wx, wy, r) {
    this.ctx.ellipse(isoX(wx, wy), isoY(wx, wy), r * ISO_CIRCLE_X, r * ISO_CIRCLE_Y, 0, 0, Math.PI * 2);
  }
  tileAt(x, y) {
    const m = this.g.map;
    return m.idx(clamp(Math.floor(x / TILE), 0, m.w - 1), clamp(Math.floor(y / TILE), 0, m.h - 1));
  }
  visibleAt(x, y) { return this.g.map.visible[this.tileAt(x, y)]; }
  seenAt(x, y) { return this.g.map.explored[this.tileAt(x, y)]; }

  // ---------- Пол ----------
  // Слой пола печётся один раз на этаж и хранится вместе с картой, для которой сделан.
  floorLayer(map) {
    if (this.layerFor === map) return this.layer;
    if (typeof bakeFloorLayer !== 'function') { this.layerFor = map; this.layer = null; return null; }
    // Без стен: в изометрии они не плитки, а блоки, и рисуются отдельно по глубине.
    const baked = bakeFloorLayer(map, false);
    if (!baked) return null;              // текстуры ещё грузятся — повторим на следующем кадре
    this.layerFor = map; this.layer = baked;
    return baked;
  }
  drawFloor() {
    const ctx = this.ctx, map = this.g.map, layer = this.floorLayer(map);
    if (layer) {
      // Проекция линейна, поэтому весь запечённый пол ложится одним drawImage:
      // матрица сама превращает квадраты плиток в ромбы.
      ctx.save();
      ctx.transform(ISO_KX, ISO_KY, -ISO_KX, ISO_KY, 0, 0);
      ctx.drawImage(layer, 0, 0);
      ctx.restore();
      return;
    }
    // Пока текстуры грузятся — плоская заливка.
    const b = this.bounds;
    ctx.beginPath();
    for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) {
      const i = map.idx(x, y);
      if (map.explored[i] && map.tiles[i] !== T_WALL) this.tileDiamond(x, y, 0);
    }
    ctx.fillStyle = COLORS.floor; ctx.fill();
  }
  // Туман поверх пола: неразведанное закрашивается наглухо, разведанное вне поля
  // зрения — полупрозрачно. Каждый слой собирается в один путь и заливается разом.
  drawFogFloor() {
    const ctx = this.ctx, map = this.g.map, b = this.bounds;
    let any = false;
    ctx.beginPath();
    for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) {
      if (!map.explored[map.idx(x, y)]) { this.tileDiamond(x, y, 0); any = true; }
    }
    if (any) { ctx.fillStyle = COLORS.unseen; ctx.fill(); }
    any = false;
    ctx.beginPath();
    for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) {
      const i = map.idx(x, y);
      if (map.explored[i] && !map.visible[i] && map.tiles[i] !== T_WALL) { this.tileDiamond(x, y, 0); any = true; }
    }
    if (any) { ctx.fillStyle = COLORS.fog; ctx.fill(); }
  }

  // ---------- Сцена ----------
  // Стены, лестница и все сущности идут одним списком, отсортированным по глубине:
  // иначе герой то пропадал бы за стеной, перед которой стоит, то залезал бы на неё.
  drawScene() {
    const g = this.g, map = g.map, b = this.bounds, items = [];
    for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) {
      const i = map.idx(x, y), t = map.tiles[i];
      if (!map.explored[i]) continue;
      if (t !== T_WALL && t !== T_PILLAR && t !== T_STAIRS) continue;
      if (t === T_WALL && !this.wallShown(map, x, y)) continue;
      items.push({ kind: t, d: isoDepth((x + 0.5) * TILE, (y + 0.5) * TILE), x, y, lit: map.visible[i] });
    }
    for (const c of g.chests) if (this.seenAt(c.x, c.y)) items.push({ kind: 'chest', d: isoDepth(c.x, c.y), ref: c });
    const m = g.merchant;
    if (m && this.seenAt(m.x, m.y)) items.push({ kind: 'merchant', d: isoDepth(m.x, m.y), ref: m });
    for (const it of g.pickups) if (this.visibleAt(it.x, it.y)) items.push({ kind: 'pickup', d: isoDepth(it.x, it.y), ref: it });
    for (const e of g.enemies) if (this.visibleAt(e.x, e.y)) items.push({ kind: 'enemy', d: isoDepth(e.x, e.y), ref: e });
    items.push({ kind: 'player', d: isoDepth(g.player.x, g.player.y), ref: g.player });
    items.sort((a, c) => a.d - c.d);
    for (const it of items) {
      if (it.kind === T_WALL) this.drawBlock(it.x, it.y, it.lit ? WALL_LIT : WALL_DIM, ISO_WALL_H, 0);
      else if (it.kind === T_PILLAR) this.drawBlock(it.x, it.y, it.lit ? PILLAR_LIT : PILLAR_DIM, ISO_WALL_H * 1.2, TILE * 0.22);
      else if (it.kind === T_STAIRS) this.drawStairs(it.x, it.y, g.stairsOpen, it.lit);
      else if (it.kind === 'chest') this.drawChest(it.ref);
      else if (it.kind === 'merchant') this.drawMerchant(it.ref);
      else if (it.kind === 'pickup') this.drawPickup(it.ref);
      else if (it.kind === 'enemy') this.drawEnemy(it.ref);
      else this.drawPlayer();
    }
  }
  // Стены в глубине скалы не рисуем: наружу они всё равно не выходят, а блоков было бы втрое больше.
  wallShown(map, x, y) {
    if (typeof wallVisible === 'function') return wallVisible(map, x, y);
    for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) if (!map.isWall(x + ox, y + oy)) return true;
    return false;
  }
  // Блок: верхняя грань и две щеки, обращённые к зрителю. Дальние две не рисуем —
  // их всё равно закрывает сам блок.
  drawBlock(tx, ty, pal, h, inset) {
    const ctx = this.ctx;
    const x0 = tx * TILE + inset, y0 = ty * TILE + inset;
    const x1 = (tx + 1) * TILE - inset, y1 = (ty + 1) * TILE - inset;
    const nx = isoX(x0, y0), ny = isoY(x0, y0);          // дальний угол ромба
    const ex = isoX(x1, y0), ey = isoY(x1, y0);          // правый
    const sx = isoX(x1, y1), sy = isoY(x1, y1);          // ближний
    const wx = isoX(x0, y1), wy = isoY(x0, y1);          // левый
    ctx.fillStyle = pal.right;
    ctx.beginPath(); ctx.moveTo(ex, ey - h); ctx.lineTo(sx, sy - h); ctx.lineTo(sx, sy); ctx.lineTo(ex, ey); ctx.closePath(); ctx.fill();
    ctx.fillStyle = pal.left;
    ctx.beginPath(); ctx.moveTo(wx, wy - h); ctx.lineTo(sx, sy - h); ctx.lineTo(sx, sy); ctx.lineTo(wx, wy); ctx.closePath(); ctx.fill();
    ctx.fillStyle = pal.top;
    ctx.beginPath(); ctx.moveTo(nx, ny - h); ctx.lineTo(ex, ey - h); ctx.lineTo(sx, sy - h); ctx.lineTo(wx, wy - h); ctx.closePath(); ctx.fill();
  }
  // Лестница вниз: шахта ступенями уходит под уровень пола. Каждая следующая
  // ступень ниже и уже, дальние темнее — свет сверху до них уже не достаёт.
  drawStairs(tx, ty, open, lit) {
    const ctx = this.ctx, STEPS = 5, drop = 5;
    for (let i = STEPS - 1; i >= 0; i--) {
      const k = i / (STEPS - 1);
      ctx.beginPath();
      this.tileDiamond(tx, ty, -i * drop, 2 + k * (TILE * 0.16));
      const v = Math.round((lit ? 58 : 34) - k * (lit ? 34 : 20));
      ctx.fillStyle = 'rgb(' + v + ',' + Math.round(v * 0.95) + ',' + Math.round(v * 0.84) + ')';
      ctx.fill();
      ctx.strokeStyle = open ? 'rgba(212,169,74,0.45)' : 'rgba(150,152,164,0.20)';
      ctx.lineWidth = 1; ctx.stroke();
    }
    if (open) {
      // Тёплый отсвет — подсказка, что проход открыт.
      ctx.beginPath(); this.tileDiamond(tx, ty, 0, 2);
      ctx.fillStyle = 'rgba(212,169,74,0.22)'; ctx.fill();
    } else {
      // Пока жив босс, поперёк лестницы лежит брус.
      const cx = (tx + 0.5) * TILE, cy = (ty + 0.5) * TILE;
      ctx.beginPath();
      this.tilePath(cx - TILE * 0.44, cy - 3, cx + TILE * 0.44, cy + 3, 4);
      ctx.fillStyle = '#8d6e63'; ctx.fill();
    }
  }

  // ---------- Сущности ----------
  // Спрайты и фигуры рисуются в экранных координатах, а сущность хранит мировые.
  // Подставляем ей проекцию, не трогая оригинал: прототип отдаёт всё остальное —
  // скорость, прицел, вспышки, — а x и y перекрыты своими.
  projected(ent) {
    if (ent.artSeed === undefined && typeof R !== 'undefined') ent.artSeed = R.float(0, Math.PI * 2);
    const s = Object.create(ent);
    s.x = isoX(ent.x, ent.y); s.y = isoY(ent.x, ent.y);
    return s;
  }
  drawShadow(x, y, width) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.ellipse(x, y, width * 0.34, width * 0.17, 0, 0, Math.PI * 2); ctx.fill();
  }
  drawEnemy(e) {
    const ctx = this.ctx, g = this.g, def = e.def, s = this.projected(e);
    const group = e.isBoss ? 'bosses' : 'enemies';
    const artId = e.isBoss ? def.id : e.type;
    // Спрайт стоит ступнями на координате, фигура центрируется на ней — тень встаёт по-разному.
    const spriteW = this.spriteWidth(group, artId);
    this.drawShadow(s.x, spriteW ? s.y : s.y + e.r * 0.4, spriteW || e.r * 2.65);
    const angle = isoAngle(e.dir.x, e.dir.y) || 0;
    let color = def.color;
    if (e.hitFlash > 0) color = '#ffffff';
    if (e.state === 'windup') { const k = 1 - e.windup / def.windup; ctx.save(); ctx.globalAlpha = 0.4; drawShape(ctx, def.shape, s.x, s.y, e.r + 4 + k * 6, '#ff5252', angle); ctx.restore(); }
    if (e.isBoss) { ctx.save(); ctx.globalAlpha = 0.25 + Math.sin(g.time * 4) * 0.1; drawShape(ctx, def.shape, s.x, s.y, e.r + 10, e.phase === 2 ? '#ff1744' : def.color, angle); ctx.restore(); }
    if (!this.drawArt(group, artId, s, e.r, color)) {
      drawShape(ctx, def.shape, s.x, s.y, e.r, color, def.shape === 'tri' ? angle : 0);
      ctx.fillStyle = '#0b0b10'; ctx.font = 'bold ' + Math.round(e.r * 1.1) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(def.symbol, s.x, s.y + 1);
    }
    const top = this.bodyTop(group, artId, s, e.r);
    if (e.stun > 0) { ctx.fillStyle = '#ffd54f'; ctx.font = '12px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('✶', s.x + Math.sin(g.time * 8) * 6, top - 8); }
    if (e.poisonTime > 0) { ctx.fillStyle = '#8e24aa'; ctx.beginPath(); ctx.arc(s.x + e.r, top, 3, 0, Math.PI * 2); ctx.fill(); }
    // Полоска здоровья.
    if (e.hp < e.maxHp && !e.isBoss) {
      const w = e.r * 2 + 6, hy = top - 7;
      ctx.fillStyle = '#000'; ctx.fillRect(s.x - w / 2, hy, w, 4);
      ctx.fillStyle = '#e05a4a'; ctx.fillRect(s.x - w / 2, hy, w * Math.max(0, e.hp / e.maxHp), 4);
    }
  }
  drawPlayer() {
    const ctx = this.ctx, g = this.g, p = g.player, hero = g.hero, s = this.projected(p);
    const spriteW = this.spriteWidth('heroes', hero.id);
    this.drawShadow(s.x, spriteW ? s.y : s.y + 5, spriteW || 32);
    // Взмах: сначала след, он всегда позади бойца.
    const swing = this.swingState(p);
    if (swing) this.drawSwingTrail(p, s, swing);
    // Клинок за спиной рисуется до фигуры, перед грудью — после неё.
    const bladeInFront = !!swing && Math.sin(swing.angle + ISO_ANGLE_SHIFT) > -0.25;
    if (swing && !bladeInFront) this.drawSwingBlade(p, s, swing);
    if (p.shield > 0) { ctx.save(); ctx.globalAlpha = 0.35; ctx.fillStyle = '#c77dff'; ctx.beginPath(); this.floorEllipse(p.x, p.y, p.r + 6); ctx.fill(); ctx.restore(); }
    ctx.save();
    if (p.isInvisible()) ctx.globalAlpha = 0.4;
    let color = hero.color;
    if (p.hurtFlash > 0) color = '#ff5252';
    else if (p.invulnTime > 0 && Math.floor(g.time * 20) % 2 === 0 && !p.dash) color = '#ffffff';
    if (!this.drawArt('heroes', hero.id, s, p.r, color)) {
      drawShape(ctx, 'circle', s.x, s.y, p.r, color);
      ctx.strokeStyle = '#0b0b10'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(s.x, s.y, p.r, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#0b0b10'; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(hero.symbol, s.x, s.y + 1);
    }
    if (swing && bladeInFront) this.drawSwingBlade(p, s, swing);
    ctx.restore();
    const top = this.bodyTop('heroes', hero.id, s, p.r);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '11px sans-serif';
    for (const b of p.buffs) {
      if (b.stat === 'dmg') { ctx.fillStyle = '#ffd54f'; ctx.fillText('▲', s.x - 12, top - 8); }
      if (b.stat === 'armor') { ctx.fillStyle = '#bdbdbd'; ctx.fillText('▣', s.x + 12, top - 8); }
    }
    if (p.poisonTime > 0) { ctx.fillStyle = '#8e24aa'; ctx.fillText('☠', s.x, top - 10); }
  }
  drawChest(c) {
    const ctx = this.ctx, x = isoX(c.x, c.y), y = isoY(c.x, c.y);
    this.drawShadow(x, y + 4, 30);
    ctx.fillStyle = c.opened ? '#5a4a2a' : COLORS.chest;
    ctx.beginPath(); ctx.roundRect(x - 13, y - 15, 26, 18, 4); ctx.fill();
    ctx.fillStyle = c.opened ? '#3a3020' : '#7a5a25'; ctx.fillRect(x - 13, y - 9, 26, 3);
    if (!c.opened) { ctx.fillStyle = COLORS.gold; ctx.fillRect(x - 2, y - 10, 4, 6); }
  }
  drawMerchant(m) {
    const ctx = this.ctx, x = isoX(m.x, m.y), y = isoY(m.x, m.y);
    this.drawShadow(x, y, 44);
    drawShape(ctx, 'circle', x, y - 13, 13, COLORS.merchant);
    ctx.fillStyle = '#0b0b10'; ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('$', x, y - 12);
    const d = dist(m.x, m.y, this.g.player.x, this.g.player.y);
    ctx.fillStyle = '#e6e2d3'; ctx.font = '12px sans-serif'; ctx.fillText(d < 60 ? '[E] Торговать' : 'Торговец', x, y - 35);
  }
  drawPickup(it) {
    const ctx = this.ctx, g = this.g;
    const x = isoX(it.x, it.y), y = isoY(it.x, it.y) + Math.sin(g.time * 4 + it.bob) * 2 - 6;
    if (it.kind === 'gold') { ctx.fillStyle = COLORS.gold; ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#fff4c2'; ctx.fillRect(x - 1, y - 2, 2, 2); }
    else if (it.kind === 'consumable') { const c = CONSUMABLES[it.id]; ctx.fillStyle = c.color; ctx.beginPath(); ctx.roundRect(x - 7, y - 9, 14, 18, 3); ctx.fill(); ctx.fillStyle = '#0b0b10'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(c.icon, x, y + 1); }
    else {
      const col = RARITY[it.item.rarity].color;
      ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI / 4);
      ctx.fillStyle = '#12121a'; ctx.fillRect(-9, -9, 18, 18); ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.strokeRect(-9, -9, 18, 18); ctx.restore();
      ctx.fillStyle = col; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(it.item.icon, x, y + 1);
      if (it.item.rarity !== 'common') { ctx.globalAlpha = 0.25 + Math.sin(g.time * 5) * 0.1; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, 16, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; }
    }
  }

  // ---------- Точки расширения визуального слоя (js/visual-assets.js) ----------
  // Без него все они возвращают пустоту, и рендер остаётся полностью геометрическим.
  spriteWidth(group, id) {
    return (typeof artSpriteWidth === 'function' && artSpriteWidth(group, id)) || null;
  }
  // Верх видимого тела: у спрайта это макушка, у фигуры — край окружности.
  // По нему выставляются полоска здоровья и значки, чтобы они не легли поперёк туловища.
  bodyTop(group, id, ent, radius) {
    const h = typeof artSpriteHeight === 'function' ? artSpriteHeight(group, id) : null;
    return ent.y - (h || radius);
  }
  drawArt(group, id, ent, radius, color) {
    return typeof drawEntityArt === 'function' && drawEntityArt(this.ctx, group, id, ent, radius, color, this.g.time);
  }
  // Высота кисти над ступнями — примерно середина груди. У геометрического
  // фолбэка спрайта нет, там за высоту берётся радиус фигуры.
  handHeight(group, id, radius) {
    const h = typeof artSpriteHeight === 'function' ? artSpriteHeight(group, id) : null;
    return h ? h * 0.55 : radius;
  }

  // ---------- Взмах ----------
  // Состояние взмаха: клинок проходит дугу рывком в начале и мягко доводится к концу.
  // Урон наносится мгновенно в момент удара, эта кривая — чистая анимация.
  swingState(p) {
    if (p.swing <= 0) return null;
    const t = clamp(1 - p.swing / SWING_TIME, 0, 1);
    const from = p.swingAngle - p.swingArc / 2;
    return { from, angle: from + p.swingArc * (1 - Math.pow(1 - t, 2.6)), range: p.swingRange, fade: 1 - t };
  }
  // Дуга лежит в плоскости пола, поэтому на экране это эллипс 2:1, а мировой угол
  // вдоль него сдвинут на 45° — вывод в js/iso.js.
  drawSwingTrail(p, s, st) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(s.x, s.y - this.handHeight('heroes', this.g.hero.id, p.r));
    ctx.scale(ISO_CIRCLE_X, ISO_CIRCLE_Y);
    const a0 = st.from + ISO_ANGLE_SHIFT, a1 = st.angle + ISO_ANGLE_SHIFT;
    ctx.globalAlpha = 0.22 * st.fade; ctx.fillStyle = this.g.hero.color;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, st.range, a0, a1); ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 0.8 * st.fade; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3 / ISO_CIRCLE_X; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(0, 0, st.range, a0, a1); ctx.stroke();
    ctx.restore();
  }
  // Сам клинок рисуется неискажённым: считаем, куда уехала кисть по эллипсу, и
  // разворачиваем оружие туда. Длина берётся до этой точки — так удар вглубь
  // выходит короче удара вбок, как и должно быть под углом.
  drawSwingBlade(p, s, st) {
    const ctx = this.ctx;
    const a = st.angle + ISO_ANGLE_SHIFT;
    const hx = Math.cos(a) * st.range * ISO_CIRCLE_X, hy = Math.sin(a) * st.range * ISO_CIRCLE_Y;
    ctx.save();
    ctx.translate(s.x, s.y - this.handHeight('heroes', this.g.hero.id, p.r));
    ctx.rotate(Math.atan2(hy, hx));
    if (typeof drawMeleeWeapon === 'function') drawMeleeWeapon(ctx, this.g.hero.id, Math.hypot(hx, hy) * 0.9);
    ctx.restore();
  }

  // ---------- Эффекты ----------
  drawTorches() {
    const g = this.g, ctx = this.ctx, map = g.map;
    for (const t of map.torches) {
      if (!map.visible[this.tileAt(t.x, t.y)]) continue;
      const x = isoX(t.x, t.y), y = isoY(t.x, t.y);
      const fl = 0.85 + Math.sin(g.time * 9 + t.phase) * 0.15;
      const grad = ctx.createRadialGradient(x, y, 2, x, y, 60 * fl);
      grad.addColorStop(0, 'rgba(255,170,60,0.35)'); grad.addColorStop(1, 'rgba(255,120,30,0)');
      ctx.fillStyle = grad; ctx.fillRect(x - 70, y - 70, 140, 140);
      ctx.fillStyle = '#7a4a1e'; ctx.fillRect(x - 2, y - 10, 4, 10);
      ctx.fillStyle = 'rgba(255,' + (160 + Math.round(60 * fl)) + ',60,1)'; ctx.beginPath(); ctx.arc(x, y - 12, 4 * fl, 0, Math.PI * 2); ctx.fill();
    }
  }
  drawTelegraphs() {
    const ctx = this.ctx;
    for (const e of this.g.enemies) {
      if (!e.telegraph) continue;
      const t = e.telegraph, k = 1 - t.time / t.total;
      ctx.save(); ctx.globalAlpha = 0.25 + k * 0.35;
      if (t.type === 'circle') {
        ctx.fillStyle = '#ff5252'; ctx.beginPath(); this.floorEllipse(t.x, t.y, t.r * (0.5 + 0.5 * k)); ctx.fill();
        ctx.globalAlpha = 0.8; ctx.strokeStyle = '#ff5252'; ctx.lineWidth = 2; ctx.beginPath(); this.floorEllipse(t.x, t.y, t.r); ctx.stroke();
      } else if (t.type === 'charge') {
        // Полоса разгона лежит на полу: проецируем её четыре угла, выходит параллелограмм.
        const ca = Math.cos(t.angle), sa = Math.sin(t.angle);
        const quad = (len) => [[0, -e.r], [len, -e.r], [len, e.r], [0, e.r]].map(function (c) {
          const wx = e.x + ca * c[0] - sa * c[1], wy = e.y + sa * c[0] + ca * c[1];
          return [isoX(wx, wy), isoY(wx, wy)];
        });
        const trace = (pts) => { ctx.beginPath(); pts.forEach((pt, i) => (i ? ctx.lineTo(pt[0], pt[1]) : ctx.moveTo(pt[0], pt[1]))); ctx.closePath(); };
        ctx.fillStyle = '#ff5252'; trace(quad(t.len * k)); ctx.fill();
        ctx.globalAlpha = 0.7; ctx.strokeStyle = '#ff5252'; ctx.lineWidth = 2; trace(quad(t.len)); ctx.stroke();
      }
      ctx.restore();
    }
  }
  drawProjectiles() {
    const ctx = this.ctx;
    for (const pr of this.g.projectiles) {
      ctx.save();
      ctx.translate(isoX(pr.x, pr.y), isoY(pr.x, pr.y));
      ctx.rotate(isoAngle(Math.cos(pr.angle), Math.sin(pr.angle)));
      ctx.fillStyle = pr.color;
      if (pr.spin) { ctx.fillRect(-pr.size, -3, pr.size * 2, 6); ctx.fillRect(-3, -pr.size, 6, pr.size * 2); }
      else if (pr.owner === 'player' && pr.size <= 5) { ctx.fillRect(-10, -1.5, 16, 3); ctx.beginPath(); ctx.moveTo(6, -3); ctx.lineTo(11, 0); ctx.lineTo(6, 3); ctx.fill(); }
      else { ctx.beginPath(); ctx.arc(0, 0, pr.size, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 0.35; ctx.beginPath(); ctx.arc(-pr.size * 1.5, 0, pr.size * 0.7, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
    }
  }
  drawEffects() {
    const ctx = this.ctx;
    for (const ef of this.g.effects) {
      if (ef.type === 'ring') {
        const k = 1 - ef.time / ef.max;
        ctx.save(); ctx.globalAlpha = 1 - k; ctx.strokeStyle = ef.color; ctx.lineWidth = 4;
        ctx.beginPath(); this.floorEllipse(ef.x, ef.y, ef.r * (0.3 + 0.7 * k)); ctx.stroke(); ctx.restore();
      } else if (ef.type === 'slash') {
        ctx.save(); ctx.globalAlpha = ef.time / 0.15;
        ctx.translate(isoX(ef.x, ef.y), isoY(ef.x, ef.y)); ctx.scale(ISO_CIRCLE_X, ISO_CIRCLE_Y);
        ctx.strokeStyle = ef.color; ctx.lineWidth = 3 / ISO_CIRCLE_X;
        const a = ef.angle + ISO_ANGLE_SHIFT;
        ctx.beginPath(); ctx.arc(0, 0, ef.r, a - 0.6, a + 0.6); ctx.stroke(); ctx.restore();
      }
    }
  }
  drawParticles() {
    const ctx = this.ctx;
    for (const pt of this.g.particles) {
      const x = isoX(pt.x, pt.y), y = isoY(pt.x, pt.y);
      ctx.globalAlpha = Math.max(0, pt.life / (pt.max || 0.6));
      ctx.fillStyle = pt.color;
      if (pt.fade) { ctx.beginPath(); ctx.arc(x, y, pt.size, 0, Math.PI * 2); ctx.fill(); }
      else ctx.fillRect(x - pt.size / 2, y - pt.size / 2, pt.size, pt.size);
    }
    ctx.globalAlpha = 1;
  }
  drawTexts() {
    const ctx = this.ctx;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const t of this.g.texts) {
      // Всплывает строго вверх по экрану, поэтому подъём хранится отдельно от мировой точки.
      const x = isoX(t.x, t.y), y = isoY(t.x, t.y) - (t.lift || 0);
      ctx.globalAlpha = Math.min(1, t.life * 2);
      ctx.font = 'bold ' + Math.round(13 * t.scale) + 'px sans-serif';
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.strokeText(t.text, x, y);
      ctx.fillStyle = t.color; ctx.fillText(t.text, x, y);
    }
    ctx.globalAlpha = 1;
  }

  // ---------- HUD ----------
  drawHud() {
    const ctx = this.ctx, g = this.g, p = g.player, hero = g.hero, hs = Save.hero(hero.id);
    // Затемнение при низком здоровье.
    if (p.hp / p.maxHp < 0.3) { const grad = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.35, VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.8); grad.addColorStop(0, 'rgba(180,0,0,0)'); grad.addColorStop(1, `rgba(180,0,0,${0.25 + Math.sin(g.time * 5) * 0.1})`); ctx.fillStyle = grad; ctx.fillRect(0, 0, VIEW_W, VIEW_H); }
    if (g.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${g.flash})`; ctx.fillRect(0, 0, VIEW_W, VIEW_H); }
    if (g.transition > 0) { ctx.fillStyle = `rgba(0,0,0,${g.transition / 0.6})`; ctx.fillRect(0, 0, VIEW_W, VIEW_H); }
    // Панель героя.
    ctx.fillStyle = 'rgba(8,8,14,0.7)'; ctx.beginPath(); ctx.roundRect(12, 12, 280, 78, 8); ctx.fill();
    drawShape(ctx, 'circle', 40, 46, 20, hero.color);
    ctx.fillStyle = '#0b0b10'; ctx.font = 'bold 20px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(hero.symbol, 40, 47);
    ctx.textAlign = 'left'; ctx.fillStyle = '#e6e2d3'; ctx.font = 'bold 14px sans-serif'; ctx.fillText(`${hero.name}  ·  ур. ${p.level}`, 70, 24);
    // HP.
    const hpW = 205;
    ctx.fillStyle = '#2a1010'; ctx.fillRect(70, 36, hpW, 14);
    ctx.fillStyle = '#e05a4a'; ctx.fillRect(70, 36, hpW * clamp(p.hp / p.maxHp, 0, 1), 14);
    if (p.shield > 0) { ctx.fillStyle = 'rgba(199,125,255,0.8)'; ctx.fillRect(70, 36, hpW * clamp(p.shield / p.maxHp, 0, 1), 5); }
    ctx.fillStyle = '#fff'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(`${Math.ceil(p.hp)} / ${p.maxHp}`, 70 + hpW / 2, 43);
    // XP.
    const need = xpToNext(hs.level);
    ctx.fillStyle = '#10202a'; ctx.fillRect(70, 56, hpW, 7);
    ctx.fillStyle = '#6fc3df'; ctx.fillRect(70, 56, hpW * clamp(hs.xp / need, 0, 1), 7);
    ctx.textAlign = 'left'; ctx.fillStyle = '#9a97a8'; ctx.font = '11px sans-serif'; ctx.fillText(`Опыт ${hs.xp} / ${need}`, 70, 74);
    ctx.textAlign = 'right'; ctx.fillStyle = '#ffd54f'; ctx.fillText(`${p.gold} зол.`, 70 + hpW, 74);
    // Этаж, осколки.
    ctx.textAlign = 'center'; ctx.fillStyle = '#e6e2d3'; ctx.font = 'bold 16px sans-serif';
    ctx.fillText(`Этаж ${g.floor} / ${MAX_FLOOR}`, VIEW_W / 2, 24);
    ctx.font = '12px sans-serif'; ctx.fillStyle = '#9a97a8'; ctx.fillText(`Убито: ${g.runStats.kills}   Осколки: +${g.runStats.shards}`, VIEW_W / 2, 42);
    // Босс.
    if (g.boss && g.boss.alive) {
      const b = g.boss, w = 420, x = (VIEW_W - w) / 2, y = 56;
      ctx.fillStyle = 'rgba(8,8,14,0.7)'; ctx.beginPath(); ctx.roundRect(x - 8, y - 6, w + 16, 32, 6); ctx.fill();
      ctx.fillStyle = '#2a1010'; ctx.fillRect(x, y + 8, w, 12);
      ctx.fillStyle = b.phase === 2 ? '#ff1744' : '#c62828'; ctx.fillRect(x, y + 8, w * clamp(b.hp / b.maxHp, 0, 1), 12);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(b.def.name, VIEW_W / 2, y + 1);
    }
    // Умения.
    const skW = 52, gap = 8, total = 3 * skW + 2 * gap + gap + skW;
    let sx = (VIEW_W - total) / 2, sy = VIEW_H - skW - 16;
    for (let i = 0; i < 3; i++) {
      const sk = SKILLS[hero.skills[i]], cd = p.skillCds[i], full = sk.cooldown * (1 - p.cdr());
      this.drawSkillBox(sx + i * (skW + gap), sy, skW, sk.icon, String(i + 1), cd, full, hero.color, sk.name);
    }
    this.drawSkillBox(sx + 3 * (skW + gap), sy, skW, '⇢', 'Shift', p.dodgeCd, 1.4, '#9a97a8', 'Уклонение');
    // Расходники.
    const cons = [['potion', 'F'], ['lembas', 'G'], ['fireScroll', 'R'], ['elixir', 'T']];
    let cx = VIEW_W - 16;
    for (let i = cons.length - 1; i >= 0; i--) {
      const [id, key] = cons[i], c = CONSUMABLES[id], n = p.consumables[id];
      cx -= 46;
      ctx.fillStyle = 'rgba(8,8,14,0.7)'; ctx.beginPath(); ctx.roundRect(cx, VIEW_H - 58, 40, 44, 6); ctx.fill();
      ctx.globalAlpha = n > 0 ? 1 : 0.3;
      ctx.fillStyle = c.color; ctx.font = 'bold 18px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(c.icon, cx + 20, VIEW_H - 40);
      ctx.fillStyle = '#e6e2d3'; ctx.font = 'bold 12px sans-serif'; ctx.fillText(`${key} ×${n}`, cx + 20, VIEW_H - 22);
      ctx.globalAlpha = 1;
    }
    // Сообщения.
    ctx.textAlign = 'left'; ctx.font = '13px sans-serif';
    let my = VIEW_H - 16;
    for (let i = g.messages.length - 1; i >= 0; i--) { const m = g.messages[i]; ctx.globalAlpha = Math.min(1, m.life); ctx.fillStyle = '#e6e2d3'; ctx.fillText(m.text, 16, my); my -= 18; }
    ctx.globalAlpha = 1;
    // Мини-карта.
    this.drawMinimap();
    // Баннер.
    if (g.banner) {
      const k = Math.min(1, g.banner.time / 0.5, (2.6 - Math.min(2.6, g.banner.time)) * 3 + 0.2);
      ctx.globalAlpha = clamp(k, 0, 1);
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0, VIEW_H / 2 - 50, VIEW_W, 100);
      ctx.fillStyle = '#d4a94a'; ctx.font = 'bold 36px serif'; ctx.textAlign = 'center'; ctx.fillText(g.banner.text, VIEW_W / 2, VIEW_H / 2 - 8);
      if (g.banner.sub) { ctx.fillStyle = '#e6e2d3'; ctx.font = '16px sans-serif'; ctx.fillText(g.banner.sub, VIEW_W / 2, VIEW_H / 2 + 24); }
      ctx.globalAlpha = 1;
    }
    // Подсказка на первом этаже.
    if (g.floor === 1 && g.runStats.time < 12) {
      ctx.globalAlpha = clamp(12 - g.runStats.time, 0, 1); ctx.fillStyle = '#9a97a8'; ctx.font = '13px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('WASD — движение · ЛКМ / Пробел — атака · 1 2 3 — умения · Shift — уклонение · F — зелье · I — инвентарь · E — торговец', VIEW_W / 2, VIEW_H - 112);
      ctx.globalAlpha = 1;
    }
  }
  drawSkillBox(x, y, w, icon, key, cd, full, color, name) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(8,8,14,0.75)'; ctx.beginPath(); ctx.roundRect(x, y, w, w, 8); ctx.fill();
    ctx.strokeStyle = cd > 0 ? '#3a3a52' : color; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(x, y, w, w, 8); ctx.stroke();
    ctx.fillStyle = cd > 0 ? '#555' : color; ctx.font = 'bold 24px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(icon, x + w / 2, y + w / 2 - 4);
    if (cd > 0) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.beginPath(); ctx.moveTo(x + w / 2, y + w / 2); ctx.arc(x + w / 2, y + w / 2, w * 0.75, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (cd / full)); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = 'bold 14px sans-serif'; ctx.fillText(cd.toFixed(1), x + w / 2, y + w / 2 - 4);
    }
    ctx.fillStyle = '#d4a94a'; ctx.font = 'bold 10px sans-serif'; ctx.fillText(key, x + w / 2, y + w - 9);
  }
  drawMinimap() {
    const ctx = this.ctx, g = this.g, map = g.map, p = g.player;
    const scale = 3, mw = map.w * scale, mh = map.h * scale, x0 = VIEW_W - mw - 12, y0 = 56;
    ctx.fillStyle = 'rgba(8,8,14,0.6)'; ctx.fillRect(x0 - 4, y0 - 4, mw + 8, mh + 8);
    for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) {
      const i = map.idx(x, y);
      if (!map.explored[i]) continue;
      const t = map.tiles[i];
      if (t === T_WALL) continue;
      ctx.fillStyle = t === T_STAIRS ? '#d4a94a' : (map.visible[i] ? '#4a4a62' : '#2e2e40');
      ctx.fillRect(x0 + x * scale, y0 + y * scale, scale, scale);
    }
    if (g.merchant) { ctx.fillStyle = '#6fc3df'; ctx.fillRect(x0 + Math.floor(g.merchant.x / TILE) * scale - 1, y0 + Math.floor(g.merchant.y / TILE) * scale - 1, scale + 2, scale + 2); }
    for (const e of g.enemies) if (this.visibleAt(e.x, e.y)) { ctx.fillStyle = e.isBoss ? '#ff1744' : '#e05a4a'; ctx.fillRect(x0 + Math.floor(e.x / TILE) * scale, y0 + Math.floor(e.y / TILE) * scale, scale, scale); }
    ctx.fillStyle = g.hero.color; ctx.fillRect(x0 + Math.floor(p.x / TILE) * scale - 1, y0 + Math.floor(p.y / TILE) * scale - 1, scale + 2, scale + 2);
  }
}

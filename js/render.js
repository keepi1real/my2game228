'use strict';
// Отрисовка: карта, сущности, эффекты, HUD.

const COLORS = {
  floor: '#24242f', floorAlt: '#20202a', wall: '#3a3a4e', wallTop: '#4a4a62', wallEdge: '#2a2a3a', pillar: '#55556e',
  stairs: '#d4a94a', fog: 'rgba(5,5,10,0.55)', gold: '#ffd54f', chest: '#b8863b', merchant: '#6fc3df',
};

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
    ctx.save();
    let sx = 0, sy = 0;
    if (g.shake > 0) { sx = (Math.random() - 0.5) * g.shake; sy = (Math.random() - 0.5) * g.shake; }
    ctx.translate(-Math.round(g.camera.x) + sx, -Math.round(g.camera.y) + sy);
    this.drawMap();
    this.drawTorches();
    this.drawChests();
    this.drawMerchant();
    this.drawPickups();
    this.drawTelegraphs();
    this.drawEnemies();
    this.drawPlayer();
    this.drawProjectiles();
    this.drawEffects();
    this.drawParticles();
    this.drawTexts();
    ctx.restore();
    this.drawHud();
  }
  drawMap() {
    const g = this.g, ctx = this.ctx, map = g.map;
    const x0 = Math.max(0, Math.floor(g.camera.x / TILE) - 1), y0 = Math.max(0, Math.floor(g.camera.y / TILE) - 1);
    const x1 = Math.min(map.w - 1, Math.ceil((g.camera.x + VIEW_W) / TILE) + 1), y1 = Math.min(map.h - 1, Math.ceil((g.camera.y + VIEW_H) / TILE) + 1);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = map.idx(x, y);
      if (!map.explored[i]) continue;
      const t = map.tiles[i], px = x * TILE, py = y * TILE;
      if (t === T_WALL) {
        // Стены рисуем только если рядом есть пол (видимая грань).
        let nearFloor = false;
        for (let oy = -1; oy <= 1 && !nearFloor; oy++) for (let ox = -1; ox <= 1; ox++) if (map.get(x + ox, y + oy) !== T_WALL && map.get(x + ox, y + oy) !== T_PILLAR) { nearFloor = true; break; }
        if (!nearFloor) continue;
        ctx.fillStyle = COLORS.wall; ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = COLORS.wallTop; ctx.fillRect(px, py, TILE, 6);
        if (map.get(x, y + 1) !== T_WALL) { ctx.fillStyle = COLORS.wallEdge; ctx.fillRect(px, py + TILE - 5, TILE, 5); }
      } else if (t === T_PILLAR) {
        ctx.fillStyle = COLORS.floor; ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = COLORS.pillar; ctx.beginPath(); ctx.roundRect(px + 5, py + 3, TILE - 10, TILE - 6, 6); ctx.fill();
        ctx.fillStyle = '#6a6a88'; ctx.fillRect(px + 8, py + 5, TILE - 16, 4);
      } else {
        ctx.fillStyle = ((x + y) & 1) ? COLORS.floor : COLORS.floorAlt; ctx.fillRect(px, py, TILE, TILE);
        if (t === T_STAIRS) {
          ctx.fillStyle = g.stairsOpen ? '#2a2412' : '#1a1a20'; ctx.fillRect(px + 3, py + 3, TILE - 6, TILE - 6);
          ctx.strokeStyle = g.stairsOpen ? COLORS.stairs : '#555'; ctx.lineWidth = 2; ctx.strokeRect(px + 3, py + 3, TILE - 6, TILE - 6);
          ctx.fillStyle = g.stairsOpen ? COLORS.stairs : '#666'; ctx.font = 'bold 22px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(g.stairsOpen ? '>' : '×', px + TILE / 2, py + TILE / 2 + 1);
        }
      }
      if (!map.visible[i]) { ctx.fillStyle = COLORS.fog; ctx.fillRect(px, py, TILE, TILE); }
    }
  }
  drawTorches() {
    const g = this.g, ctx = this.ctx, map = g.map;
    for (const t of map.torches) {
      const tx = Math.floor(t.x / TILE), ty = Math.floor(t.y / TILE);
      if (!map.visible[map.idx(tx, ty)]) continue;
      if (t.x < g.camera.x - 80 || t.x > g.camera.x + VIEW_W + 80 || t.y < g.camera.y - 80 || t.y > g.camera.y + VIEW_H + 80) continue;
      const fl = 0.85 + Math.sin(g.time * 9 + t.phase) * 0.15;
      const grad = ctx.createRadialGradient(t.x, t.y + 6, 2, t.x, t.y + 6, 60 * fl);
      grad.addColorStop(0, 'rgba(255,170,60,0.35)'); grad.addColorStop(1, 'rgba(255,120,30,0)');
      ctx.fillStyle = grad; ctx.fillRect(t.x - 70, t.y - 70, 140, 140);
      ctx.fillStyle = '#7a4a1e'; ctx.fillRect(t.x - 2, t.y, 4, 10);
      ctx.fillStyle = `rgba(255,${160 + Math.round(60 * fl)},60,1)`; ctx.beginPath(); ctx.arc(t.x, t.y - 1, 4 * fl, 0, Math.PI * 2); ctx.fill();
    }
  }
  visibleAt(x, y) { const m = this.g.map; return m.visible[m.idx(Math.floor(x / TILE), Math.floor(y / TILE))]; }
  drawChests() {
    const ctx = this.ctx;
    for (const c of this.g.chests) {
      if (!this.visibleAt(c.x, c.y) && !this.g.map.explored[this.g.map.idx(Math.floor(c.x / TILE), Math.floor(c.y / TILE))]) continue;
      ctx.fillStyle = c.opened ? '#5a4a2a' : COLORS.chest;
      ctx.beginPath(); ctx.roundRect(c.x - 13, c.y - 9, 26, 18, 4); ctx.fill();
      ctx.fillStyle = c.opened ? '#3a3020' : '#7a5a25'; ctx.fillRect(c.x - 13, c.y - 3, 26, 3);
      if (!c.opened) { ctx.fillStyle = COLORS.gold; ctx.fillRect(c.x - 2, c.y - 4, 4, 6); }
    }
  }
  drawMerchant() {
    const m = this.g.merchant, ctx = this.ctx;
    if (!m || !this.g.map.explored[this.g.map.idx(Math.floor(m.x / TILE), Math.floor(m.y / TILE))]) return;
    ctx.fillStyle = '#1f3a44'; ctx.beginPath(); ctx.roundRect(m.x - 22, m.y + 10, 44, 10, 3); ctx.fill();
    drawShape(ctx, 'circle', m.x, m.y, 13, COLORS.merchant);
    ctx.fillStyle = '#0b0b10'; ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('$', m.x, m.y + 1);
    const d = dist(m.x, m.y, this.g.player.x, this.g.player.y);
    ctx.fillStyle = '#e6e2d3'; ctx.font = '12px sans-serif'; ctx.fillText(d < 60 ? '[E] Торговать' : 'Торговец', m.x, m.y - 22);
  }
  drawPickups() {
    const ctx = this.ctx, g = this.g;
    for (const it of g.pickups) {
      if (!this.visibleAt(it.x, it.y)) continue;
      const bob = Math.sin(g.time * 4 + it.bob) * 2;
      if (it.kind === 'gold') { ctx.fillStyle = COLORS.gold; ctx.beginPath(); ctx.arc(it.x, it.y + bob, 4, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#fff4c2'; ctx.fillRect(it.x - 1, it.y + bob - 2, 2, 2); }
      else if (it.kind === 'consumable') { const c = CONSUMABLES[it.id]; ctx.fillStyle = c.color; ctx.beginPath(); ctx.roundRect(it.x - 7, it.y - 9 + bob, 14, 18, 3); ctx.fill(); ctx.fillStyle = '#0b0b10'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(c.icon, it.x, it.y + bob + 1); }
      else {
        const col = RARITY[it.item.rarity].color;
        ctx.save(); ctx.translate(it.x, it.y + bob); ctx.rotate(Math.PI / 4);
        ctx.fillStyle = '#12121a'; ctx.fillRect(-9, -9, 18, 18); ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.strokeRect(-9, -9, 18, 18); ctx.restore();
        ctx.fillStyle = col; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(it.item.icon, it.x, it.y + bob + 1);
        if (it.item.rarity !== 'common') { ctx.globalAlpha = 0.25 + Math.sin(g.time * 5) * 0.1; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(it.x, it.y + bob, 16, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; }
      }
    }
  }
  drawTelegraphs() {
    const ctx = this.ctx;
    for (const e of this.g.enemies) {
      if (!e.telegraph) continue;
      const t = e.telegraph, k = 1 - t.time / t.total;
      ctx.save(); ctx.globalAlpha = 0.25 + k * 0.35;
      if (t.type === 'circle') { ctx.fillStyle = '#ff5252'; ctx.beginPath(); ctx.arc(t.x, t.y, t.r * (0.5 + 0.5 * k), 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 0.8; ctx.strokeStyle = '#ff5252'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2); ctx.stroke(); }
      else if (t.type === 'charge') { ctx.translate(e.x, e.y); ctx.rotate(t.angle); ctx.fillStyle = '#ff5252'; ctx.fillRect(0, -e.r, t.len * k, e.r * 2); ctx.globalAlpha = 0.7; ctx.strokeStyle = '#ff5252'; ctx.lineWidth = 2; ctx.strokeRect(0, -e.r, t.len, e.r * 2); }
      ctx.restore();
    }
  }
  drawEnemies() {
    const ctx = this.ctx, g = this.g;
    for (const e of g.enemies) {
      if (!this.visibleAt(e.x, e.y)) continue;
      const def = e.def;
      // Тень.
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(e.x, e.y + e.r * 0.8, e.r * 0.9, e.r * 0.4, 0, 0, Math.PI * 2); ctx.fill();
      const angle = Math.atan2(e.dir.y, e.dir.x) || 0;
      let color = def.color;
      if (e.hitFlash > 0) color = '#ffffff';
      if (e.state === 'windup') { const k = 1 - e.windup / def.windup; ctx.save(); ctx.globalAlpha = 0.4; drawShape(ctx, def.shape, e.x, e.y, e.r + 4 + k * 6, '#ff5252', angle); ctx.restore(); }
      if (e.isBoss) { ctx.save(); ctx.globalAlpha = 0.25 + Math.sin(g.time * 4) * 0.1; drawShape(ctx, def.shape, e.x, e.y, e.r + 10, e.phase === 2 ? '#ff1744' : def.color, angle); ctx.restore(); }
      drawShape(ctx, def.shape, e.x, e.y, e.r, color, def.shape === 'tri' ? angle : (def.shape === 'square' ? angle * 0 : 0));
      ctx.fillStyle = '#0b0b10'; ctx.font = `bold ${Math.round(e.r * 1.1)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(def.symbol, e.x, e.y + 1);
      if (e.stun > 0) { ctx.fillStyle = '#ffd54f'; ctx.font = '12px sans-serif'; ctx.fillText('✶', e.x + Math.sin(g.time * 8) * 6, e.y - e.r - 8); }
      if (e.poisonTime > 0) { ctx.fillStyle = '#8e24aa'; ctx.beginPath(); ctx.arc(e.x + e.r, e.y - e.r, 3, 0, Math.PI * 2); ctx.fill(); }
      // Полоска здоровья.
      if (e.hp < e.maxHp && !e.isBoss) {
        const w = e.r * 2 + 6, hy = e.y - e.r - 7;
        ctx.fillStyle = '#000'; ctx.fillRect(e.x - w / 2, hy, w, 4);
        ctx.fillStyle = '#e05a4a'; ctx.fillRect(e.x - w / 2, hy, w * Math.max(0, e.hp / e.maxHp), 4);
      }
    }
  }
  drawPlayer() {
    const ctx = this.ctx, g = this.g, p = g.player, hero = g.hero;
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(p.x, p.y + 10, 11, 5, 0, 0, Math.PI * 2); ctx.fill();
    // Взмах.
    if (p.swing > 0) {
      const k = p.swing / 0.14;
      ctx.save(); ctx.globalAlpha = 0.6 * k; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.swingRange, p.swingAngle - p.swingArc / 2, p.swingAngle + p.swingArc / 2); ctx.stroke();
      ctx.globalAlpha = 0.18 * k; ctx.fillStyle = hero.color; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.arc(p.x, p.y, p.swingRange, p.swingAngle - p.swingArc / 2, p.swingAngle + p.swingArc / 2); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    if (p.shield > 0) { ctx.save(); ctx.globalAlpha = 0.35; ctx.fillStyle = '#c77dff'; ctx.beginPath(); ctx.arc(p.x, p.y, p.r + 6, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
    ctx.save();
    if (p.isInvisible()) ctx.globalAlpha = 0.4;
    let color = hero.color;
    if (p.hurtFlash > 0) color = '#ff5252';
    else if (p.invulnTime > 0 && Math.floor(g.time * 20) % 2 === 0 && !p.dash) color = '#ffffff';
    drawShape(ctx, 'circle', p.x, p.y, p.r, color);
    ctx.strokeStyle = '#0b0b10'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#0b0b10'; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(hero.symbol, p.x, p.y + 1);
    // Указатель прицела.
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(p.x + p.aim.x * (p.r + 2), p.y + p.aim.y * (p.r + 2)); ctx.lineTo(p.x + p.aim.x * (p.r + 9), p.y + p.aim.y * (p.r + 9)); ctx.stroke();
    ctx.restore();
    for (const b of p.buffs) {
      if (b.stat === 'dmg') { ctx.fillStyle = '#ffd54f'; ctx.font = '11px sans-serif'; ctx.fillText('▲', p.x - 12, p.y - p.r - 8); }
      if (b.stat === 'armor') { ctx.fillStyle = '#bdbdbd'; ctx.font = '11px sans-serif'; ctx.fillText('▣', p.x + 12, p.y - p.r - 8); }
    }
    if (p.poisonTime > 0) { ctx.fillStyle = '#8e24aa'; ctx.font = '11px sans-serif'; ctx.fillText('☠', p.x, p.y - p.r - 10); }
  }
  drawProjectiles() {
    const ctx = this.ctx;
    for (const pr of this.g.projectiles) {
      ctx.save(); ctx.translate(pr.x, pr.y); ctx.rotate(pr.angle);
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
      if (ef.type === 'ring') { const k = 1 - ef.time / ef.max; ctx.save(); ctx.globalAlpha = 1 - k; ctx.strokeStyle = ef.color; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(ef.x, ef.y, ef.r * (0.3 + 0.7 * k), 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
      else if (ef.type === 'slash') { ctx.save(); ctx.globalAlpha = ef.time / 0.15; ctx.strokeStyle = ef.color; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(ef.x, ef.y, ef.r, ef.angle - 0.6, ef.angle + 0.6); ctx.stroke(); ctx.restore(); }
    }
  }
  drawParticles() {
    const ctx = this.ctx;
    for (const pt of this.g.particles) {
      ctx.globalAlpha = Math.max(0, pt.life / (pt.max || 0.6));
      ctx.fillStyle = pt.color;
      if (pt.fade) { ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2); ctx.fill(); }
      else ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
    }
    ctx.globalAlpha = 1;
  }
  drawTexts() {
    const ctx = this.ctx;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const t of this.g.texts) {
      ctx.globalAlpha = Math.min(1, t.life * 2);
      ctx.font = `bold ${Math.round(13 * t.scale)}px sans-serif`;
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.strokeText(t.text, t.x, t.y);
      ctx.fillStyle = t.color; ctx.fillText(t.text, t.x, t.y);
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

'use strict';
// Ядро игры: ввод, состояния, цикл обновления, бой, ИИ, инвентарь.

class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = {}; this.pressed = {};
    this.mouse = { x: VIEW_W / 2, y: VIEW_H / 2, down: false, rdown: false, clicked: false };
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys[e.code] = true; this.pressed[e.code] = true;
      if (['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => { this.keys[e.code] = false; });
    window.addEventListener('blur', () => { this.keys = {}; this.mouse.down = false; });
    const toCanvas = (e) => {
      const r = canvas.getBoundingClientRect();
      this.mouse.x = (e.clientX - r.left) * (canvas.width / r.width);
      this.mouse.y = (e.clientY - r.top) * (canvas.height / r.height);
    };
    canvas.addEventListener('mousemove', toCanvas);
    canvas.addEventListener('mousedown', (e) => { toCanvas(e); if (e.button === 0) { this.mouse.down = true; this.mouse.clicked = true; } if (e.button === 2) this.mouse.rdown = true; });
    window.addEventListener('mouseup', (e) => { if (e.button === 0) this.mouse.down = false; if (e.button === 2) this.mouse.rdown = false; });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    this.touch = new TouchControls(canvas);
  }
  down(code) { return !!this.keys[code]; }
  hit(code) { const v = !!this.pressed[code]; this.pressed[code] = false; return v; }
  // Сенсорный слой спит, пока экрана не коснулись, поэтому обе проверки безопасны.
  tHit(name) { return this.touch.hit(name); }
  tHeld(name) { return this.touch.held(name); }
  get touchMode() { return this.touch.enabled; }
  endFrame() { this.pressed = {}; this.mouse.clicked = false; this.touch.endFrame(); }
}

class Game {
  constructor(canvas) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d');
    this.state = 'menu';
    this.input = new Input(canvas);
    Save.load();
    this.renderer = new Renderer(this);
    this.ui = new UI(this);
    this.time = 0; this.msgCooldown = 0;
    this.resetRunState();
    this.ui.showMenu();
  }
  resetRunState() {
    this.player = null; this.hero = null; this.floor = 0; this.map = null;
    this.enemies = []; this.projectiles = []; this.pickups = []; this.particles = []; this.texts = []; this.effects = [];
    this.chests = []; this.merchant = null; this.boss = null; this.stairs = null; this.stairsOpen = true;
    this.camera = { x: 0, y: 0 }; this.shake = 0; this.flash = 0; this.messages = [];
    this.runStats = { kills: 0, shards: 0, gold: 0, bossKills: 0, floor: 1, time: 0, items: 0, levels: 0 };
    this.flow = null; this.flowTimer = 0; this.banner = null; this.transition = 0; this.bagFullTimer = 0;
  }

  // ---------- Забег ----------
  startRun(heroId, startItemId) {
    this.resetRunState();
    const def = HERO_BY_ID[heroId];
    const meta = Save.bonuses();
    const hs = Save.hero(heroId);
    this.hero = def;
    const p = new Player(def, hs.level, meta);
    p.gold = meta.startGold;
    p.consumables.potion = meta.startPotions;
    const si = START_ITEMS.find((s) => s.id === startItemId);
    if (si) {
      if (si.item) { const it = makeItem(si.item.base, si.item.rarity); p.equipment[it.slot] = it; }
      if (si.consumables) for (const k in si.consumables) p.consumables[k] += si.consumables[k];
    }
    p.hp = p.maxHp;
    this.player = p;
    Save.data.lastHero = heroId; Save.data.lastStartItem = startItemId;
    Save.data.stats.runs++; hs.runs++;
    Save.save();
    this.state = 'run';
    this.ui.hide();
    this.loadFloor(1);
    this.message(`${def.name} спускается в Подгорье. Удачи!`);
  }
  loadFloor(n) {
    this.floor = n; this.runStats.floor = Math.max(this.runStats.floor, n);
    const gen = generateFloor(n, (R.int(1, 1e9) ^ (n * 7919)) >>> 0);
    this.map = gen.map;
    this.enemies = []; this.projectiles = []; this.pickups = []; this.particles = []; this.texts = []; this.effects = []; this.chests = [];
    this.stairs = gen.stairs; this.boss = null;
    const p = this.player;
    p.x = gen.spawn.x; p.y = gen.spawn.y; p.dash = null; p.invulnTime = 1.0;
    for (const e of gen.enemies) this.enemies.push(new Enemy(e.type, e.x, e.y, n));
    for (const c of gen.chests) this.chests.push(new Chest(c.x, c.y));
    this.merchant = gen.merchant ? new Merchant(gen.merchant.x, gen.merchant.y, this.makeShopStock()) : null;
    if (gen.boss) {
      const b = new Enemy(gen.boss.id, gen.boss.x, gen.boss.y, n, BOSSES[gen.boss.id]);
      this.enemies.push(b); this.boss = b; this.stairsOpen = false;
      this.message(`${b.def.name} преграждает путь!`);
    } else this.stairsOpen = true;
    this.map.updateVisibility(Math.floor(p.x / TILE), Math.floor(p.y / TILE), 9);
    this.flow = null; this.flowTimer = 0;
    this.camera.x = p.x - VIEW_W / 2; this.camera.y = p.y - VIEW_H / 2;
    this.banner = { text: gen.boss ? 'Логово босса' : `Этаж ${n}`, sub: gen.boss ? BOSSES[gen.boss.id].name : (n === 1 ? 'Найдите лестницу вниз' : ''), time: 2.6 };
    this.transition = 0.6;
    Save.save();
  }
  nextFloor() {
    if (this.floor >= MAX_FLOOR) { this.endRun(true); return; }
    this.loadFloor(this.floor + 1);
  }
  makeShopStock() {
    const luck = this.player.meta.dropMult;
    const stock = [];
    for (let i = 0; i < 3; i++) { const it = randomItem(this.floor + 1, luck * 1.4); stock.push({ kind: 'item', item: it, price: Math.round(it.price * 1.4) }); }
    stock.push({ kind: 'consumable', id: 'potion', price: CONSUMABLES.potion.price, qty: 3 });
    stock.push({ kind: 'consumable', id: 'lembas', price: CONSUMABLES.lembas.price, qty: 2 });
    stock.push({ kind: 'consumable', id: R.chance(0.5) ? 'fireScroll' : 'elixir', price: CONSUMABLES.fireScroll.price, qty: 1 });
    return stock;
  }
  endRun(victory) {
    const p = this.player, hs = Save.hero(this.hero.id), st = Save.data.stats;
    st.kills += this.runStats.kills; st.bestFloor = Math.max(st.bestFloor, this.runStats.floor);
    st.bossKills += this.runStats.bossKills;
    if (victory) { st.wins++; hs.wins++; const bonus = 100; Save.data.shards += bonus; this.runStats.shards += bonus; }
    Save.save();
    this.state = victory ? 'win' : 'dead';
    this.ui.showResult(victory, this.runStats, hs);
  }
  toMenu() { this.resetRunState(); this.state = 'menu'; this.ui.showMenu(); }

  // ---------- Цикл ----------
  update(dt) {
    this.time += dt;
    const inp = this.input;
    if (this.state === 'run') {
      if (inp.hit('Escape') || inp.tHit('pause')) { this.state = 'paused'; this.ui.showPause(); inp.endFrame(); return; }
      if (inp.hit('KeyI') || inp.hit('Tab') || inp.tHit('bag')) { this.state = 'inventory'; this.ui.showInventory(); inp.endFrame(); return; }
      this.runStats.time += dt;
      this.updatePlayer(dt);
      this.updateEnemies(dt);
      this.updateProjectiles(dt);
      this.updatePickups(dt);
      this.updateWorld(dt);
    } else if (this.state === 'paused') {
      if (inp.hit('Escape')) { this.state = 'run'; this.ui.hide(); }
    } else if (this.state === 'inventory') {
      if (inp.hit('Escape') || inp.hit('KeyI') || inp.hit('Tab')) { this.state = 'run'; this.ui.hide(); }
    } else if (this.state === 'shop') {
      if (inp.hit('Escape') || inp.hit('KeyE')) { this.state = 'run'; this.ui.hide(); }
    }
    this.updateEffects(dt);
    inp.endFrame();
  }

  // ---------- Игрок ----------
  updatePlayer(dt) {
    const p = this.player, inp = this.input, map = this.map;
    p.tickTimers(dt);
    // Регенерация и яд.
    if (p.regen() > 0) p.hp = Math.min(p.maxHp, p.hp + p.regen() * dt);
    if (p.poisonTime > 0) { p.poisonTime -= dt; p.hp -= p.poison * dt; if (p.hp <= 0) { this.playerDie('яд'); return; } }
    // Движение: стик, если играют пальцем, иначе клавиатура. Стик аналоговый —
    // длина вектора меньше единицы даёт шаг медленнее, и это нужное поведение.
    let mx = 0, my = 0;
    const tmove = inp.touchMode ? inp.touch.moveVector() : null;
    if (tmove) { mx = tmove.x; my = tmove.y; }
    else {
      if (inp.down('KeyW') || inp.down('ArrowUp')) my -= 1;
      if (inp.down('KeyS') || inp.down('ArrowDown')) my += 1;
      if (inp.down('KeyA') || inp.down('ArrowLeft')) mx -= 1;
      if (inp.down('KeyD') || inp.down('ArrowRight')) mx += 1;
      const n = Math.hypot(mx, my);
      if (n > 0) { mx /= n; my /= n; }
    }
    const ml = Math.hypot(mx, my);
    // Прицел. Мышь наводит точно, палец — нет, поэтому на сенсоре ведём цель сами:
    // ручная протяжка по правой половине, иначе ближайший враг, иначе направление бега.
    if (inp.touchMode) {
      const want = inp.touch.aimVector() || autoAimDir(this, p) || (ml > 0 ? { x: mx / ml, y: my / ml } : null);
      if (want) {
        const k = Math.min(1, dt * AIM_SMOOTH);
        p.aim.x += (want.x - p.aim.x) * k; p.aim.y += (want.y - p.aim.y) * k;
        const al = Math.hypot(p.aim.x, p.aim.y) || 1;
        p.aim.x /= al; p.aim.y /= al;
      }
    } else {
      const wx = inp.mouse.x + this.camera.x, wy = inp.mouse.y + this.camera.y;
      const ad = dist(p.x, p.y, wx, wy);
      if (ad > 4) { p.aim.x = (wx - p.x) / ad; p.aim.y = (wy - p.y) / ad; }
    }
    p.vx = mx; p.vy = my;
    if (p.dash) {
      const d = p.dash;
      const step = Math.min(dt, d.time);
      this.moveEntity(p, d.vx * step, d.vy * step);
      d.time -= step;
      if (d.dmgMult) {
        for (const e of this.enemies) {
          if (d.hit.has(e) || !e.alive) continue;
          if (dist(p.x, p.y, e.x, e.y) < p.r + e.r + 6) { d.hit.add(e); this.hitEnemy(e, p.damage() * d.dmgMult, { knockback: 200 }); }
        }
      }
      this.particles.push({ x: p.x, y: p.y, vx: 0, vy: 0, life: 0.25, max: 0.25, color: this.hero.color, size: 8, fade: true });
      if (d.time <= 0) p.dash = null;
    } else if (p.stunTime <= 0) {
      const sp = p.speed();
      this.moveEntity(p, mx * sp * dt, my * sp * dt);
    }
    // Умения.
    const skillKeys = ['Digit1', 'Digit2', 'Digit3'];
    for (let i = 0; i < 3; i++) {
      if ((inp.hit(skillKeys[i]) || inp.tHit('skill' + i)) && p.stunTime <= 0) this.useSkill(i);
    }
    if ((inp.hit('ShiftLeft') || inp.hit('ShiftRight') || inp.tHit('dodge')) && p.dodgeCd <= 0 && !p.dash && p.stunTime <= 0) {
      const dir = ml > 0 ? { x: mx, y: my } : { x: p.aim.x, y: p.aim.y };
      this.playerDash(p, dir, 110, 0.18, { invuln: true });
      p.dodgeCd = 1.4;
    }
    const consKeys = ['KeyF', 'KeyG', 'KeyR', 'KeyT'];
    for (let i = 0; i < CONSUMABLE_ORDER.length; i++) {
      if (inp.hit(consKeys[i]) || inp.tHit('cons' + i)) this.useConsumable(CONSUMABLE_ORDER[i]);
    }
    // Атака. С сенсора кнопка удерживается, поэтому бьём, пока палец лежит.
    if ((inp.mouse.down || inp.down('Space') || inp.tHeld('attack')) && p.attackTimer <= 0 && !p.dash && p.stunTime <= 0) this.playerAttack();
    // Взаимодействие. Клавиши E у телефона нет, поэтому у торговца всплывает кнопка.
    const nearMerchant = !!this.merchant && dist(p.x, p.y, this.merchant.x, this.merchant.y) < 60;
    inp.touch.showUse = nearMerchant;
    if ((inp.hit('KeyE') || inp.tHit('use')) && nearMerchant) {
      this.state = 'shop'; this.ui.showShop(this.merchant); return;
    }
    // Сундуки.
    for (const c of this.chests) if (!c.opened && dist(p.x, p.y, c.x, c.y) < p.r + c.r + 2) this.openChest(c);
    // Лестница.
    const tx = Math.floor(p.x / TILE), ty = Math.floor(p.y / TILE);
    if (map.get(tx, ty) === T_STAIRS) {
      if (this.stairsOpen && this.transition <= 0) { this.nextFloor(); return; }
    }
    // Видимость и камера.
    if (tx !== p.lastTx || ty !== p.lastTy) { map.updateVisibility(tx, ty, 9); p.lastTx = tx; p.lastTy = ty; this.flow = null; }
    const cx = clamp(p.x - VIEW_W / 2, Math.min(0, (map.w * TILE - VIEW_W) / 2), Math.max(0, map.w * TILE - VIEW_W));
    const cy = clamp(p.y - VIEW_H / 2, Math.min(0, (map.h * TILE - VIEW_H) / 2), Math.max(0, map.h * TILE - VIEW_H));
    this.camera.x = lerp(this.camera.x, cx, Math.min(1, dt * 8));
    this.camera.y = lerp(this.camera.y, cy, Math.min(1, dt * 8));
  }
  moveEntity(e, dx, dy) {
    const map = this.map;
    // Дробим шаг, чтобы не проскочить стену на большой скорости.
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 8));
    const sx = dx / steps, sy = dy / steps;
    for (let i = 0; i < steps; i++) {
      if (!map.circleBlocked(e.x + sx, e.y, e.r)) e.x += sx;
      if (!map.circleBlocked(e.x, e.y + sy, e.r)) e.y += sy;
    }
    e.x = clamp(e.x, e.r, map.w * TILE - e.r); e.y = clamp(e.y, e.r, map.h * TILE - e.r);
  }
  playerAttack() {
    const p = this.player, atk = this.hero.attack;
    p.attackTimer = p.attackCooldown();
    p.recoil = RECOIL_TIME;
    let mult = 1;
    if (p.sneak) { mult = 3; p.sneak = false; p.buffs = p.buffs.filter((b) => b.stat !== 'invisible'); this.addText(p.x, p.y - 24, 'Удар из тени!', '#b0bec5'); }
    if (atk.type === 'melee') {
      const a = Math.atan2(p.aim.y, p.aim.x);
      p.swing = SWING_TIME; p.swingAngle = a; p.swingRange = atk.range; p.swingArc = atk.arc;
      let hitAny = false;
      for (const e of this.enemies) {
        if (!e.alive) continue;
        const d = dist(p.x, p.y, e.x, e.y);
        if (d > atk.range + e.r) continue;
        if (Math.abs(angleDiff(a, angleTo(p.x, p.y, e.x, e.y))) > atk.arc / 2 + Math.asin(Math.min(1, e.r / Math.max(d, 1)))) continue;
        this.hitEnemy(e, p.damage() * mult, { knockback: 140 });
        hitAny = true;
      }
      if (!hitAny) this.effects.push({ type: 'miss', x: p.x, y: p.y, time: 0.1 });
    } else {
      this.spawnProjectile({ x: p.x + p.aim.x * 10, y: p.y + p.aim.y * 10, vx: p.aim.x * atk.speed, vy: p.aim.y * atk.speed, dmg: p.damage() * mult, owner: 'player', size: atk.size, color: atk.color, life: 1.2 });
    }
  }
  useSkill(i) {
    const p = this.player;
    if (p.skillCds[i] > 0) return;
    const sk = SKILLS[this.hero.skills[i]];
    sk.use(this, p, { x: p.aim.x, y: p.aim.y });
    p.skillCds[i] = sk.cooldown * (1 - p.cdr());
  }
  useConsumable(id) {
    const p = this.player;
    if (!p.consumables[id] || p.consumables[id] <= 0) { this.message(`Нет: ${CONSUMABLES[id].name}`); return false; }
    p.consumables[id]--;
    const c = CONSUMABLES[id];
    if (id === 'potion') this.healPlayer(p.maxHp * 0.4 * p.meta.potionMult);
    else if (id === 'lembas') { this.healPlayer(p.maxHp * 0.2 * p.meta.potionMult); p.addBuff('speed', 0.25, 6); }
    else if (id === 'fireScroll') { this.playerAoe(p, 140, 3.0, { color: '#ff7043', knockback: 200 }); this.shake = Math.max(this.shake, 8); }
    else if (id === 'elixir') { p.addBuff('dmg', 0.3, 12); p.addBuff('armor', 10, 12); }
    this.addText(p.x, p.y - 22, c.name, c.color);
    return true;
  }
  healPlayer(amount) {
    const p = this.player;
    const before = p.hp;
    p.hp = Math.min(p.maxHp, p.hp + amount);
    const real = Math.round(p.hp - before);
    if (real > 0) this.addText(p.x + R.float(-8, 8), p.y - 16, '+' + real, '#7cd67c');
    this.burst(p.x, p.y, '#7cd67c', 8);
  }
  playerDash(p, dir, distance, time, opts) {
    const l = Math.hypot(dir.x, dir.y) || 1;
    p.dash = { vx: (dir.x / l) * distance / time, vy: (dir.y / l) * distance / time, time, dmgMult: opts.dmgMult || 0, hit: new Set() };
    if (opts.invuln) p.invulnTime = Math.max(p.invulnTime, time + 0.05);
  }
  playerAoe(p, radius, mult, opts) {
    this.effects.push({ type: 'ring', x: p.x, y: p.y, r: radius, time: 0.35, max: 0.35, color: opts.color || '#fff' });
    for (const e of this.enemies) {
      if (!e.alive) continue;
      if (dist(p.x, p.y, e.x, e.y) <= radius + e.r) this.hitEnemy(e, p.damage() * mult, { knockback: opts.knockback || 0, stun: opts.stun || 0 });
    }
    this.burst(p.x, p.y, opts.color || '#fff', 18, radius * 1.5);
  }
  spawnProjectile(o) { this.projectiles.push(new Projectile(o)); }
  flashScreen(v) { this.flash = Math.max(this.flash, v); }

  // ---------- Урон ----------
  hitEnemy(e, dmg, opts = {}) {
    if (!e.alive) return;
    const p = this.player;
    let crit = opts.crit || R.chance(p.crit());
    if (crit) dmg *= 1.8;
    dmg = Math.max(1, dmg - e.armor);
    dmg = Math.round(dmg);
    e.hp -= dmg; e.hitFlash = 0.12;
    if (e.state === 'idle') { e.state = 'chase'; e.target = p; e.memory = 4; }
    this.addText(e.x + R.float(-10, 10), e.y - e.r - 6, String(dmg) + (crit ? '!' : ''), crit ? '#ffd54f' : '#ffffff', crit ? 1.3 : 1);
    if (opts.knockback && !e.isBoss) { const a = angleTo(p.x, p.y, e.x, e.y); e.kx += Math.cos(a) * opts.knockback; e.ky += Math.sin(a) * opts.knockback; }
    if (opts.stun && !e.isBoss) e.stun = Math.max(e.stun, opts.stun);
    if (opts.stun && e.isBoss) e.stun = Math.max(e.stun, opts.stun * 0.3);
    if (p.lifesteal() > 0) p.hp = Math.min(p.maxHp, p.hp + dmg * p.lifesteal());
    this.burst(e.x, e.y, e.def.color, 4, 60);
    if (e.hp <= 0) this.killEnemy(e);
  }
  damagePlayer(amount, source) {
    const p = this.player;
    if (p.invulnTime > 0) return;
    amount = Math.max(amount * 0.25, amount - p.armor());
    if (p.shield > 0) { const abs = Math.min(p.shield, amount); p.shield -= abs; amount -= abs; if (abs > 0) this.addText(p.x, p.y - 26, '-' + Math.round(abs) + ' щит', '#c77dff'); }
    amount = Math.round(amount);
    if (amount <= 0) return;
    p.hp -= amount; p.hurtFlash = 0.15; p.invulnTime = Math.max(p.invulnTime, 0.12);
    this.shake = Math.max(this.shake, Math.min(10, amount / 4 + 2));
    this.addText(p.x + R.float(-8, 8), p.y - 18, '-' + amount, '#e05a4a', 1.1);
    this.burst(p.x, p.y, '#e05a4a', 6, 70);
    if (p.hp <= 0) this.playerDie(source && source.def ? source.def.name : 'неизвестность');
  }
  playerDie(killer) {
    if (this.state !== 'run') return;
    const p = this.player;
    p.hp = 0;
    this.burst(p.x, p.y, this.hero.color, 30, 160);
    this.shake = 14;
    this.runStats.killer = killer;
    this.message(`${this.hero.name} пал на этаже ${this.floor}.`);
    this.endRun(false);
  }
  killEnemy(e) {
    e.alive = false;
    const p = this.player, def = e.def;
    this.burst(e.x, e.y, def.color, e.isBoss ? 60 : 12, e.isBoss ? 220 : 110);
    this.runStats.kills++;
    // Опыт (постоянный).
    const xp = Math.round(def.xp * p.xpMult());
    const ups = Save.addHeroXp(this.hero.id, xp);
    this.addText(e.x, e.y - e.r - 20, '+' + xp + ' оп.', '#6fc3df', 0.9);
    if (ups > 0) {
      p.level = Save.hero(this.hero.id).level;
      this.runStats.levels += ups;
      this.healPlayer(p.maxHp * 0.3);
      this.addText(p.x, p.y - 34, `Уровень ${p.level}!`, '#ffd54f', 1.5);
      this.message(`${this.hero.name} достигает уровня ${p.level}!`);
      this.effects.push({ type: 'ring', x: p.x, y: p.y, r: 60, time: 0.6, max: 0.6, color: '#ffd54f' });
    }
    // Осколки.
    Save.data.shards += def.shards; this.runStats.shards += def.shards;
    // Золото.
    const gold = Math.round(R.int(def.gold[0], def.gold[1]) * p.goldMult());
    if (gold > 0) this.pickups.push(new Pickup(e.x, e.y, 'gold', { amount: gold }));
    // Лут.
    const luck = p.meta.dropMult;
    if (e.isBoss) {
      this.runStats.bossKills++;
      for (let i = 0; i < 2; i++) { const rar = R.chance(0.5) ? 'epic' : 'rare'; const pool = ITEM_BASES.filter((b) => b.tier <= this.floor + 2 && b.tier >= this.floor - 3); const base = R.pick(pool); this.pickups.push(new Pickup(e.x, e.y, 'item', { item: makeItem(base.id, rar) })); }
      this.pickups.push(new Pickup(e.x, e.y, 'consumable', { id: 'potion' }));
      this.pickups.push(new Pickup(e.x, e.y, 'consumable', { id: 'potion' }));
      this.stairsOpen = true; this.boss = null;
      this.message(`${def.name} повержен! Путь вниз открыт.`);
      this.banner = { text: 'Босс повержен', sub: 'Лестница открыта', time: 2.5 };
      this.shake = 16;
      if (this.floor >= MAX_FLOOR) this.banner = { text: 'Тень рассеяна', sub: 'Спуститесь по лестнице, чтобы завершить поход', time: 4 };
    } else {
      const dropChance = (0.05 + def.xp / 400) * luck;
      if (R.chance(dropChance)) this.pickups.push(new Pickup(e.x, e.y, 'item', { item: randomItem(this.floor, luck) }));
      if (R.chance(0.10 * luck)) this.pickups.push(new Pickup(e.x, e.y, 'consumable', { id: randomConsumable() }));
    }
    Save.save();
  }

  // ---------- Враги ----------
  updateEnemies(dt) {
    const p = this.player;
    this.flowTimer -= dt;
    if (!this.flow || this.flowTimer <= 0) { this.flow = this.map.flowField(Math.floor(p.x / TILE), Math.floor(p.y / TILE)); this.flowTimer = 0.3; }
    for (const e of this.enemies) if (e.alive) this.updateEnemy(e, dt);
    this.enemies = this.enemies.filter((e) => e.alive);
    // Расталкивание врагов друг от друга.
    for (let i = 0; i < this.enemies.length; i++) for (let j = i + 1; j < this.enemies.length; j++) {
      const a = this.enemies[i], b = this.enemies[j];
      const d = dist(a.x, a.y, b.x, b.y), min = a.r + b.r;
      if (d < min && d > 0.01) { const push = (min - d) / 2, ang = angleTo(a.x, a.y, b.x, b.y); const px = Math.cos(ang) * push, py = Math.sin(ang) * push; this.moveEntity(a, -px, -py); this.moveEntity(b, px, py); }
    }
  }
  updateEnemy(e, dt) {
    const p = this.player, def = e.def, map = this.map;
    e.hitFlash = Math.max(0, e.hitFlash - dt);
    e.stun = Math.max(0, e.stun - dt); e.slow = Math.max(0, e.slow - dt);
    if (e.poisonTime > 0) { e.poisonTime -= dt; e.hp -= e.poisonDps * dt; if (e.hp <= 0) { this.killEnemy(e); return; } }
    // Отбрасывание.
    if (Math.abs(e.kx) > 1 || Math.abs(e.ky) > 1) { this.moveEntity(e, e.kx * dt, e.ky * dt); e.kx *= Math.pow(0.02, dt); e.ky *= Math.pow(0.02, dt); }
    if (e.telegraph) { e.telegraph.time -= dt; if (e.telegraph.time <= 0) { this.resolveTelegraph(e); } return; }
    if (e.charge) { this.updateCharge(e, dt); return; }
    if (e.stun > 0) { e.windup = 0; return; }
    const d = dist(p.x, p.y, e.x, e.y);
    const etx = Math.floor(e.x / TILE), ety = Math.floor(e.y / TILE), ptx = Math.floor(p.x / TILE), pty = Math.floor(p.y / TILE);
    const los = d < def.sight && lineOfSight(map, etx, ety, ptx, pty);
    const canSee = los && !p.isInvisible();
    const speed = e.speed * (e.slow > 0 ? 0.5 : 1) * (e.phase === 2 ? 1.25 : 1);
    if (e.state === 'idle') {
      if (canSee) { e.state = 'chase'; e.memory = 4; if (!e.isBoss) this.addText(e.x, e.y - e.r - 8, '!', '#ffd54f'); }
      else {
        e.wander.t -= dt;
        if (e.wander.t <= 0) { e.wander.t = R.float(1, 3); if (R.chance(0.5)) { const a = R.float(0, 6.28); e.wander.x = Math.cos(a); e.wander.y = Math.sin(a); } else { e.wander.x = 0; e.wander.y = 0; } }
        this.moveEntity(e, e.wander.x * speed * 0.35 * dt, e.wander.y * speed * 0.35 * dt);
        return;
      }
    }
    if (e.state === 'windup') {
      e.windup -= dt;
      if (e.windup <= 0) { this.enemyAttack(e); e.state = 'chase'; }
      return;
    }
    // chase
    if (canSee) e.memory = 4; else { e.memory -= dt; if (e.memory <= 0) { e.state = 'idle'; return; } }
    e.attackTimer -= dt;
    const inRange = def.ranged ? (d <= def.attackRange && los) : (d <= def.attackRange + p.r);
    if (inRange && e.attackTimer <= 0 && !p.isInvisible()) {
      e.state = 'windup'; e.windup = def.windup; e.windupDir = { x: (p.x - e.x) / (d || 1), y: (p.y - e.y) / (d || 1) };
      e.attackTimer = def.attackCd;
      return;
    }
    // Способности босса.
    if (e.isBoss && this.updateBossAbilities(e, dt, d, los)) return;
    // Навигация.
    let dx = 0, dy = 0;
    if (def.ranged && d < def.keepDistance && los) {
      // Держим дистанцию.
      dx = (e.x - p.x) / (d || 1); dy = (e.y - p.y) / (d || 1);
      const nx = e.x + dx * speed * dt, ny = e.y + dy * speed * dt;
      if (map.circleBlocked(nx, ny, e.r)) { const t = dx; dx = -dy; dy = t; }
    } else if (d < TILE * 1.6 && los) {
      dx = (p.x - e.x) / (d || 1); dy = (p.y - e.y) / (d || 1);
    } else {
      const n = this.flowStep(etx, ety);
      if (n) { const cx = (n.x + 0.5) * TILE, cy = (n.y + 0.5) * TILE; const dd = dist(e.x, e.y, cx, cy) || 1; dx = (cx - e.x) / dd; dy = (cy - e.y) / dd; }
      else { dx = (p.x - e.x) / (d || 1); dy = (p.y - e.y) / (d || 1); }
    }
    // Не наступаем на игрока.
    if (!def.ranged && d < e.r + p.r + 2) { dx = 0; dy = 0; }
    e.dir.x = dx; e.dir.y = dy;
    this.moveEntity(e, dx * speed * dt, dy * speed * dt);
  }
  flowStep(tx, ty) {
    const f = this.flow, map = this.map;
    if (!map.inBounds(tx, ty)) return null;
    const here = f[map.idx(tx, ty)];
    if (here < 0) return null;
    let best = null, bd = here;
    for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
      if (!ox && !oy) continue;
      const nx = tx + ox, ny = ty + oy;
      if (!map.inBounds(nx, ny) || map.isWall(nx, ny)) continue;
      if (ox && oy && (map.isWall(tx + ox, ty) || map.isWall(tx, ty + oy))) continue;
      const v = f[map.idx(nx, ny)];
      if (v >= 0 && v < bd) { bd = v; best = { x: nx, y: ny }; }
    }
    return best;
  }
  enemyAttack(e) {
    const p = this.player, def = e.def;
    const d = dist(p.x, p.y, e.x, e.y);
    if (def.ranged) {
      const a = angleTo(e.x, e.y, p.x, p.y);
      this.spawnProjectile({ x: e.x, y: e.y, vx: Math.cos(a) * def.projSpeed, vy: Math.sin(a) * def.projSpeed, dmg: e.dmg, owner: 'enemy', size: 5, color: def.projColor || '#ffb74d', life: 2.2, slow: def.slow || 0 });
    } else {
      this.effects.push({ type: 'slash', x: e.x, y: e.y, angle: Math.atan2(e.windupDir.y, e.windupDir.x), r: def.attackRange + 6, time: 0.15, color: def.color });
      if (d <= def.attackRange + p.r + 10) {
        this.damagePlayer(e.dmg, e);
        if (def.poison) { p.poison = def.poison * (1 + this.floor * 0.1); p.poisonTime = 4; }
        if (def.knockback) { const a = angleTo(e.x, e.y, p.x, p.y); this.moveEntity(p, Math.cos(a) * def.knockback * 0.25, Math.sin(a) * def.knockback * 0.25); }
      }
    }
  }
  // ---------- Боссы ----------
  updateBossAbilities(e, dt, d, los) {
    const p = this.player, ab = e.def.abilities;
    if (e.hp < e.maxHp * 0.5 && e.phase === 1) { e.phase = 2; this.message(`${e.def.name} впадает в ярость!`); this.burst(e.x, e.y, '#ff1744', 40, 200); this.shake = 10; }
    const rate = e.phase === 2 ? 1.4 : 1;
    for (const k in ab) e.abilityTimers[k] -= dt * rate;
    if (e.def.id === 'grazgot') {
      if (e.abilityTimers.charge <= 0 && d > 120 && los) { e.abilityTimers.charge = ab.charge; e.telegraph = { type: 'charge', angle: angleTo(e.x, e.y, p.x, p.y), time: 0.6, total: 0.6, len: 420 }; return true; }
      if (e.abilityTimers.slam <= 0 && d < 100) { e.abilityTimers.slam = ab.slam; e.telegraph = { type: 'circle', x: e.x, y: e.y, r: 120, time: 0.7, total: 0.7, dmgMult: 1.4 }; return true; }
      if (e.abilityTimers.summon <= 0) { e.abilityTimers.summon = ab.summon; this.summonMinions(e, 'goblin', 3); return false; }
    } else if (e.def.id === 'morgul') {
      if (e.abilityTimers.blink <= 0 && d > 160) { e.abilityTimers.blink = ab.blink; this.blinkBoss(e); return false; }
      if (e.abilityTimers.volley <= 0 && los) { e.abilityTimers.volley = ab.volley; const base = angleTo(e.x, e.y, p.x, p.y); for (let i = -2; i <= 2; i++) { const a = base + i * 0.22; this.spawnProjectile({ x: e.x, y: e.y, vx: Math.cos(a) * 260, vy: Math.sin(a) * 260, dmg: e.dmg * 0.7, owner: 'enemy', size: 6, color: '#7e57c2', life: 2.5, slow: 1.5 }); } return false; }
      if (e.abilityTimers.scream <= 0 && d < 220) { e.abilityTimers.scream = ab.scream; e.telegraph = { type: 'circle', x: e.x, y: e.y, r: 210, time: 0.8, total: 0.8, dmgMult: 0.9, slow: 3 }; return true; }
      if (e.abilityTimers.summon <= 0) { e.abilityTimers.summon = ab.summon; this.summonMinions(e, e.phase === 2 ? 'shadow' : 'wraith', 2); return false; }
    }
    return false;
  }
  resolveTelegraph(e) {
    const t = e.telegraph, p = this.player; e.telegraph = null;
    if (t.type === 'charge') {
      e.charge = { vx: Math.cos(t.angle) * 560, vy: Math.sin(t.angle) * 560, time: 0.55, hit: false };
    } else if (t.type === 'circle') {
      this.effects.push({ type: 'ring', x: t.x, y: t.y, r: t.r, time: 0.4, max: 0.4, color: e.def.color });
      this.shake = Math.max(this.shake, 9);
      if (dist(p.x, p.y, t.x, t.y) <= t.r + p.r) { this.damagePlayer(e.dmg * t.dmgMult, e); if (t.slow) p.slowTime = Math.max(p.slowTime, t.slow); }
    }
  }
  updateCharge(e, dt) {
    const c = e.charge, p = this.player;
    const ox = e.x, oy = e.y;
    this.moveEntity(e, c.vx * dt, c.vy * dt);
    if (dist(ox, oy, e.x, e.y) < Math.hypot(c.vx, c.vy) * dt * 0.5) { c.time = 0; this.shake = Math.max(this.shake, 6); }
    this.particles.push({ x: e.x, y: e.y, vx: 0, vy: 0, life: 0.3, max: 0.3, color: e.def.color, size: 10, fade: true });
    if (!c.hit && dist(p.x, p.y, e.x, e.y) < p.r + e.r + 4) { c.hit = true; this.damagePlayer(e.dmg * 1.5, e); const a = Math.atan2(c.vy, c.vx); this.moveEntity(p, Math.cos(a) * 60, Math.sin(a) * 60); }
    c.time -= dt;
    if (c.time <= 0) e.charge = null;
  }
  summonMinions(e, type, n) {
    this.addText(e.x, e.y - e.r - 14, 'Ко мне!', '#ff8a65', 1.2);
    for (let i = 0; i < n; i++) {
      for (let t = 0; t < 10; t++) {
        const a = R.float(0, 6.28), rr = R.float(50, 110);
        const x = e.x + Math.cos(a) * rr, y = e.y + Math.sin(a) * rr;
        if (!this.map.circleBlocked(x, y, 14)) { const m = new Enemy(type, x, y, this.floor); m.state = 'chase'; m.memory = 6; this.enemies.push(m); this.burst(x, y, MONSTERS[type].color, 8, 80); break; }
      }
    }
  }
  blinkBoss(e) {
    const p = this.player;
    this.burst(e.x, e.y, '#7e57c2', 20, 120);
    for (let t = 0; t < 20; t++) {
      const a = R.float(0, 6.28), rr = R.float(90, 140);
      const x = p.x + Math.cos(a) * rr, y = p.y + Math.sin(a) * rr;
      if (!this.map.circleBlocked(x, y, e.r + 2)) { e.x = x; e.y = y; break; }
    }
    this.burst(e.x, e.y, '#7e57c2', 20, 120);
    this.addText(e.x, e.y - e.r - 12, '...', '#b39ddb');
  }

  // ---------- Снаряды ----------
  updateProjectiles(dt) {
    const p = this.player;
    for (const pr of this.projectiles) {
      if (pr.dead) continue;
      pr.life -= dt;
      const steps = Math.max(1, Math.ceil(Math.hypot(pr.vx, pr.vy) * dt / 10));
      for (let s = 0; s < steps && !pr.dead; s++) {
        pr.x += pr.vx * dt / steps; pr.y += pr.vy * dt / steps;
        if (this.map.circleBlocked(pr.x, pr.y, 2)) { this.projectileEnd(pr); break; }
        if (pr.owner === 'player') {
          for (const e of this.enemies) {
            if (!e.alive || pr.hit.has(e)) continue;
            if (dist(pr.x, pr.y, e.x, e.y) < e.r + pr.size) {
              pr.hit.add(e);
              if (pr.explode) { this.projectileEnd(pr); break; }
              this.hitEnemy(e, pr.dmg, { crit: pr.crit, stun: pr.stun, knockback: 80 });
              if (pr.pierce > 0) pr.pierce--; else { pr.dead = true; break; }
            }
          }
        } else if (dist(pr.x, pr.y, p.x, p.y) < p.r + pr.size) {
          pr.dead = true;
          if (p.invulnTime <= 0) { this.damagePlayer(pr.dmg, null); if (pr.slow) p.slowTime = Math.max(p.slowTime, pr.slow); }
          break;
        }
      }
      if (pr.life <= 0 && !pr.dead) this.projectileEnd(pr);
      if (pr.spin) pr.angle += dt * 20;
    }
    this.projectiles = this.projectiles.filter((pr) => !pr.dead);
  }
  projectileEnd(pr) {
    pr.dead = true;
    if (pr.explode && pr.owner === 'player') {
      this.effects.push({ type: 'ring', x: pr.x, y: pr.y, r: pr.explode, time: 0.35, max: 0.35, color: pr.color });
      this.burst(pr.x, pr.y, pr.color, 22, 150);
      this.shake = Math.max(this.shake, 5);
      for (const e of this.enemies) if (e.alive && dist(pr.x, pr.y, e.x, e.y) <= pr.explode + e.r) this.hitEnemy(e, pr.dmg, { knockback: 120 });
    } else this.burst(pr.x, pr.y, pr.color, 3, 50);
  }

  // ---------- Лут ----------
  updatePickups(dt) {
    const p = this.player;
    this.bagFullTimer = Math.max(0, this.bagFullTimer - dt);
    for (const it of this.pickups) {
      it.age += dt;
      if (it.age < 0.4) { this.moveEntity(Object.assign(it, { r: 6 }), it.vx * dt, it.vy * dt); it.vx *= 0.9; it.vy *= 0.9; continue; }
      const d = dist(p.x, p.y, it.x, it.y);
      if (it.kind === 'gold' && d < 90) { const a = angleTo(it.x, it.y, p.x, p.y); const sp = 260 + (90 - d) * 4; it.x += Math.cos(a) * sp * dt; it.y += Math.sin(a) * sp * dt; }
      if (d < p.r + 10) {
        if (it.kind === 'gold') { p.gold += it.amount; this.runStats.gold += it.amount; it.dead = true; this.addText(p.x, p.y - 20, '+' + it.amount + ' зол.', '#ffd54f', 0.9); }
        else if (it.kind === 'consumable') { p.consumables[it.id]++; it.dead = true; this.addText(p.x, p.y - 20, CONSUMABLES[it.id].name, CONSUMABLES[it.id].color, 0.9); }
        else if (it.kind === 'item') {
          if (p.bagFull()) { if (this.bagFullTimer <= 0) { this.message('Сумка полна! Откройте инвентарь (I).'); this.bagFullTimer = 2.5; } }
          else { p.bag.push(it.item); it.dead = true; this.runStats.items++; this.addText(p.x, p.y - 20, it.item.name, RARITY[it.item.rarity].color, 1); this.message(`Найдено: ${it.item.name}`); }
        }
      }
    }
    this.pickups = this.pickups.filter((it) => !it.dead);
  }
  openChest(c) {
    c.opened = true;
    const luck = this.player.meta.dropMult;
    this.burst(c.x, c.y, '#ffd54f', 20, 120);
    this.pickups.push(new Pickup(c.x, c.y, 'item', { item: randomItem(this.floor, luck * 1.5) }));
    this.pickups.push(new Pickup(c.x, c.y, 'gold', { amount: Math.round(R.int(10, 25) * this.floor * this.player.goldMult()) }));
    if (R.chance(0.6)) this.pickups.push(new Pickup(c.x, c.y, 'consumable', { id: randomConsumable() }));
    this.message('Сундук открыт!');
  }

  // ---------- Инвентарь ----------
  equipItem(item) {
    const p = this.player;
    const idx = p.bag.indexOf(item); if (idx < 0) return;
    p.bag.splice(idx, 1);
    const old = p.equipment[item.slot];
    p.equipment[item.slot] = item;
    if (old) p.bag.push(old);
    p.hp = Math.min(p.hp, p.maxHp);
    this.message(`Надето: ${item.name}`);
  }
  unequipItem(slot) {
    const p = this.player, it = p.equipment[slot];
    if (!it || p.bagFull()) return;
    p.equipment[slot] = null; p.bag.push(it); p.hp = Math.min(p.hp, p.maxHp);
  }
  dropItem(item) {
    const p = this.player;
    const idx = p.bag.indexOf(item); if (idx < 0) return;
    p.bag.splice(idx, 1);
    this.pickups.push(Object.assign(new Pickup(p.x, p.y, 'item', { item }), { age: -1.5 }));
  }
  sellItem(item) {
    const p = this.player;
    const idx = p.bag.indexOf(item); if (idx < 0) return;
    p.bag.splice(idx, 1);
    const g = Math.round(item.price * 0.4); p.gold += g;
    this.message(`Продано: ${item.name} за ${g} зол.`);
  }
  buy(entry) {
    const p = this.player;
    if (p.gold < entry.price) { this.message('Не хватает золота.'); return false; }
    if (entry.kind === 'item') {
      if (p.bagFull()) { this.message('Сумка полна.'); return false; }
      p.gold -= entry.price; p.bag.push(entry.item); entry.sold = true;
    } else {
      if (entry.qty <= 0) return false;
      p.gold -= entry.price; p.consumables[entry.id]++; entry.qty--;
    }
    return true;
  }

  // ---------- Мир и эффекты ----------
  updateWorld(dt) {
    this.transition = Math.max(0, this.transition - dt);
    if (this.banner) { this.banner.time -= dt; if (this.banner.time <= 0) this.banner = null; }
  }
  updateEffects(dt) {
    this.shake = Math.max(0, this.shake - dt * 30);
    this.flash = Math.max(0, this.flash - dt * 2);
    for (const pt of this.particles) { pt.life -= dt; pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.vx *= 0.92; pt.vy *= 0.92; }
    this.particles = this.particles.filter((pt) => pt.life > 0);
    for (const t of this.texts) { t.life -= dt; t.y -= 28 * dt; }
    this.texts = this.texts.filter((t) => t.life > 0);
    for (const ef of this.effects) ef.time -= dt;
    this.effects = this.effects.filter((ef) => ef.time > 0);
    for (const m of this.messages) m.life -= dt;
    this.messages = this.messages.filter((m) => m.life > 0);
  }
  burst(x, y, color, n, speed = 90) {
    for (let i = 0; i < n; i++) {
      const a = R.float(0, 6.28), s = R.float(speed * 0.3, speed);
      this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: R.float(0.25, 0.6), max: 0.6, color, size: R.float(2, 4) });
    }
  }
  addText(x, y, text, color, scale = 1) { this.texts.push({ x, y, text, color, life: 0.9, scale }); }
  message(text) { this.messages.push({ text, life: 5 }); if (this.messages.length > 5) this.messages.shift(); }
}

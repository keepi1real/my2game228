'use strict';
// DOM-интерфейс: меню, выбор героя, лагерь, инвентарь, торговец, результаты.

class UI {
  constructor(game) { this.g = game; this.root = document.getElementById('ui'); this.selectedItem = null; }
  hide() { this.root.innerHTML = ''; }
  render(html) { this.root.innerHTML = html; }
  bind(selector, evt, fn) { this.root.querySelectorAll(selector).forEach((el) => el.addEventListener(evt, (e) => fn(el, e))); }

  // ---------- Главное меню ----------
  showMenu() {
    const d = Save.data, st = d.stats;
    this.render(`
      <div class="overlay overlay-front"><div class="panel" style="min-width:520px">
        <h1>${GAME_TITLE}</h1>
        <div class="subtitle">Rogue-like о героях, спускающихся во тьму под горами</div>
        <div class="menu-buttons">
          <button class="primary" data-a="heroes">В подземелье</button>
          <button data-a="camp">Лагерь: улучшения и снаряжение</button>
          <button data-a="help">Как играть</button>
          <button class="small" data-a="reset" style="align-self:center;margin-top:8px">Сбросить весь прогресс</button>
        </div>
        <div class="footer-row">
          <span class="shards">◆ Осколки мифрила: ${d.shards}</span>
          <span class="muted">Походов: ${st.runs} · Побед: ${st.wins} · Лучший этаж: ${st.bestFloor} · Убито: ${st.kills}</span>
        </div>
      </div></div>`);
    this.bind('[data-a=heroes]', 'click', () => this.showHeroSelect());
    this.bind('[data-a=camp]', 'click', () => this.showCamp('upgrades'));
    this.bind('[data-a=help]', 'click', () => this.showHelp(() => this.showMenu()));
    this.bind('[data-a=reset]', 'click', () => { if (confirm('Удалить весь прогресс: уровни героев, осколки, улучшения?')) { Save.reset(); this.showMenu(); } });
  }
  showHelp(back) {
    this.render(`
      <div class="overlay"><div class="panel" style="max-width:640px">
        <h2>Как играть</h2>
        <div class="help">
          <p><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> или стрелки — движение. Мышь — прицел. <kbd>ЛКМ</kbd> или <kbd>Пробел</kbd> — атака.</p>
          <p><kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> — умения героя (с перезарядкой). <kbd>Shift</kbd> — уклонение (неуязвимость на время рывка).</p>
          <p><kbd>F</kbd> — зелье лечения, <kbd>G</kbd> — дорожный хлеб, <kbd>R</kbd> — свиток пламени, <kbd>T</kbd> — эликсир силы.</p>
          <p><kbd>I</kbd> или <kbd>Tab</kbd> — инвентарь (игра на паузе). <kbd>E</kbd> — поговорить с торговцем. <kbd>Esc</kbd> — пауза.</p>
          <h3>Правила</h3>
          <p>Подземелье из ${MAX_FLOOR} этажей. На ${BOSS_FLOORS.join(' и ')} этажах ждут боссы. Найдите лестницу <b style="color:#d4a94a">&gt;</b>, чтобы спуститься.</p>
          <p>Опыт и уровень героя <b>сохраняются навсегда</b>, даже после смерти. Погибая, вы теряете найденные предметы и золото.</p>
          <p>За убийства и боссов копятся <span class="shards">осколки мифрила</span>. В лагере на них открываются новые герои, постоянные улучшения и стартовые предметы.</p>
          <p>Сундуки открываются касанием. Предметы подбираются автоматически, пока в сумке есть место (${BAG_SIZE} ячеек). Золото тянется к герою.</p>
        </div>
        <div class="footer-row"><span></span><button data-a="back">Назад</button></div>
      </div></div>`);
    this.bind('[data-a=back]', 'click', () => back());
  }

  // ---------- Выбор героя ----------
  showHeroSelect() {
    const d = Save.data;
    this.heroId = HERO_BY_ID[d.lastHero] && d.heroes[d.lastHero].unlocked ? d.lastHero : 'arator';
    this.startItemId = d.startItems[d.lastStartItem] ? d.lastStartItem : 'startNone';
    this.renderHeroSelect();
  }
  renderHeroSelect() {
    const d = Save.data, meta = Save.bonuses();
    const cards = HEROES.map((h) => {
      const hs = d.heroes[h.id];
      const need = xpToNext(hs.level);
      return `<div class="hero-card ${h.id === this.heroId ? 'selected' : ''} ${hs.unlocked ? '' : 'locked'}" data-hero="${h.id}">
        <div class="hero-symbol" style="background:${h.color}">${h.symbol}</div>
        <div class="hero-name">${h.name}</div>
        <div class="hero-title">${h.title}</div>
        ${hs.unlocked ? `<div class="hero-level">Уровень ${hs.level}</div><div class="xpbar"><div style="width:${Math.round(100 * hs.xp / need)}%"></div></div>`
          : `<div class="hero-level" style="color:#d4a94a">🔒 ${h.unlockCost} ◆</div>`}
      </div>`;
    }).join('');
    const h = HERO_BY_ID[this.heroId], hs = d.heroes[this.heroId];
    const tmp = new Player(h, hs.level, meta);
    const skills = h.skills.map((id, i) => { const s = SKILLS[id]; return `<div class="skill-item"><div class="skill-key">${i + 1}</div><div><b>${s.icon} ${s.name}</b> <span class="muted">(${s.cooldown} с)</span><br><span class="muted">${s.desc}</span></div></div>`; }).join('');
    const starts = START_ITEMS.map((s) => {
      const unlocked = !!d.startItems[s.id];
      return `<div class="start-item ${s.id === this.startItemId ? 'selected' : ''} ${unlocked ? '' : 'locked'}" data-start="${s.id}">
        <b>${s.name}</b><div class="muted">${s.desc}</div>${unlocked ? '' : `<div class="shards" style="margin-top:4px">🔒 ${s.cost} ◆ — открыть в лагере</div>`}</div>`;
    }).join('');
    this.render(`
      <div class="overlay overlay-front"><div class="panel" style="min-width:860px">
        <div class="row between"><h2 style="margin:0">Выбор героя</h2><span class="shards">◆ ${d.shards}</span></div>
        <div class="hero-grid" style="margin-top:12px">${cards}</div>
        <div class="hero-detail">
          <div class="row between"><div><b style="font-size:18px;color:${h.color}">${h.name}</b> <span class="muted">— ${h.title}</span></div>
            ${hs.unlocked ? `<span class="muted">Походов: ${hs.runs} · Побед: ${hs.wins}</span>` : `<button class="small primary" data-a="unlock" ${d.shards >= h.unlockCost ? '' : 'disabled'}>Открыть за ${h.unlockCost} ◆</button>`}</div>
          <div class="muted" style="margin:6px 0 10px">${h.desc}</div>
          <div class="stat-line">
            <span>Здоровье <b>${tmp.maxHp}</b></span><span>Урон <b>${Math.round(tmp.damage())}</b></span><span>Броня <b>${tmp.armor()}</b></span>
            <span>Скорость <b>${Math.round(tmp.speed())}</b></span><span>Крит <b>${pct(tmp.crit())}</b></span>
            <span>Атака <b>${h.attack.type === 'melee' ? 'ближняя' : 'дальняя'}</b></span>
          </div>
          <div class="skill-list">${skills}</div>
        </div>
        <h3>Стартовый предмет</h3>
        <div class="start-items">${starts}</div>
        <div class="footer-row">
          <button data-a="back">Назад</button>
          <button class="primary" data-a="start" ${hs.unlocked ? '' : 'disabled'}>Начать поход</button>
        </div>
      </div></div>`);
    this.bind('[data-hero]', 'click', (el) => { this.heroId = el.dataset.hero; this.renderHeroSelect(); });
    this.bind('[data-start]', 'click', (el) => { if (d.startItems[el.dataset.start]) { this.startItemId = el.dataset.start; this.renderHeroSelect(); } });
    this.bind('[data-a=unlock]', 'click', () => { if (d.shards >= h.unlockCost) { d.shards -= h.unlockCost; hs.unlocked = true; Save.save(); this.renderHeroSelect(); } });
    this.bind('[data-a=back]', 'click', () => this.showMenu());
    this.bind('[data-a=start]', 'click', () => this.g.startRun(this.heroId, this.startItemId));
  }

  // ---------- Лагерь ----------
  showCamp(tab) {
    const d = Save.data;
    let body = '';
    if (tab === 'upgrades') {
      body = `<div class="upgrade-list">${UPGRADES.map((u) => {
        const r = Save.rank(u.id), maxed = r >= u.max, cost = upgradeCost(u, r);
        return `<div class="upgrade"><div><div class="name">${u.name}</div><div class="desc">${u.desc}</div></div>
          <div class="pips">${Array.from({ length: u.max }, (_, i) => `<div class="pip ${i < r ? 'on' : ''}"></div>`).join('')}</div>
          <button class="small ${maxed ? '' : 'primary'}" data-up="${u.id}" ${maxed || d.shards < cost ? 'disabled' : ''}>${maxed ? 'Максимум' : cost + ' ◆'}</button></div>`;
      }).join('')}</div>`;
    } else {
      body = `<div class="upgrade-list">${START_ITEMS.filter((s) => s.cost > 0).map((s) => {
        const un = !!d.startItems[s.id];
        return `<div class="upgrade"><div><div class="name">${s.name}</div><div class="desc">${s.desc}</div></div><div></div>
          <button class="small ${un ? '' : 'primary'}" data-si="${s.id}" ${un || d.shards < s.cost ? 'disabled' : ''}>${un ? 'Открыто' : s.cost + ' ◆'}</button></div>`;
      }).join('')}</div>`;
    }
    this.render(`
      <div class="overlay overlay-front"><div class="panel" style="min-width:640px">
        <div class="row between"><h2 style="margin:0">Лагерь</h2><span class="shards">◆ ${d.shards}</span></div>
        <div class="muted" style="margin:6px 0 12px">Осколки мифрила добываются из монстров и боссов. Улучшения действуют на всех героев навсегда.</div>
        <div class="tabs"><div class="tab ${tab === 'upgrades' ? 'active' : ''}" data-tab="upgrades">Улучшения</div><div class="tab ${tab === 'items' ? 'active' : ''}" data-tab="items">Стартовые предметы</div></div>
        ${body}
        <div class="footer-row"><button data-a="back">Назад</button><button class="primary" data-a="heroes">К выбору героя</button></div>
      </div></div>`);
    this.bind('[data-tab]', 'click', (el) => this.showCamp(el.dataset.tab));
    this.bind('[data-up]', 'click', (el) => { const u = UPGRADE_BY_ID[el.dataset.up], r = Save.rank(u.id), cost = upgradeCost(u, r); if (r < u.max && d.shards >= cost) { d.shards -= cost; d.upgrades[u.id] = r + 1; Save.save(); this.showCamp('upgrades'); } });
    this.bind('[data-si]', 'click', (el) => { const s = START_ITEMS.find((x) => x.id === el.dataset.si); if (!d.startItems[s.id] && d.shards >= s.cost) { d.shards -= s.cost; d.startItems[s.id] = true; Save.save(); this.showCamp('items'); } });
    this.bind('[data-a=back]', 'click', () => this.showMenu());
    this.bind('[data-a=heroes]', 'click', () => this.showHeroSelect());
  }

  // ---------- Пауза ----------
  showPause() {
    this.render(`
      <div class="overlay"><div class="panel">
        <h2>Пауза</h2>
        <div class="menu-buttons">
          <button class="primary" data-a="resume">Продолжить</button>
          <button data-a="help">Как играть</button>
          <button data-a="abandon">Сдаться и вернуться в лагерь</button>
        </div>
      </div></div>`);
    this.bind('[data-a=resume]', 'click', () => { this.g.state = 'run'; this.hide(); });
    this.bind('[data-a=help]', 'click', () => this.showHelp(() => this.showPause()));
    this.bind('[data-a=abandon]', 'click', () => { if (confirm('Прервать поход? Найденные предметы и золото пропадут.')) this.g.playerDie('малодушие'); });
  }

  // ---------- Инвентарь ----------
  itemHtml(item, cls = '') {
    if (!item) return '';
    return `<div class="item-icon rarity-${item.rarity} ${cls}">${item.icon}</div><div><div class="item-name rarity-${item.rarity}">${item.name}</div><div class="item-stats">${itemStatsText(item)}</div></div>`;
  }
  compareHtml(item) {
    const p = this.g.player, eq = p.equipment[item.slot];
    if (!eq || eq === item) return '';
    const keys = new Set([...Object.keys(item.stats), ...Object.keys(eq.stats)]);
    return '<div style="margin-top:6px">По сравнению с надетым: ' + [...keys].map((k) => { const dv = (item.stats[k] || 0) - (eq.stats[k] || 0); if (Math.abs(dv) < 0.001) return ''; return `<span class="compare ${dv < 0 ? 'neg' : ''}">${STAT_NAMES[k]} ${STAT_FMT[k](dv)}</span>`; }).filter(Boolean).join(', ') + '</div>';
  }
  showInventory() {
    const g = this.g, p = g.player;
    const slots = [['weapon', 'Оружие'], ['armor', 'Броня'], ['trinket', 'Талисман']].map(([s, label]) => {
      const it = p.equipment[s];
      return `<div class="slot" data-slot="${s}"><div class="slot-label">${label}</div>${it ? this.itemHtml(it) : '<span class="muted">— пусто —</span>'}</div>`;
    }).join('');
    const bag = Array.from({ length: BAG_SIZE }, (_, i) => {
      const it = p.bag[i];
      if (!it) return `<div class="bag-slot empty"></div>`;
      return `<div class="bag-slot ${this.selectedItem === it ? 'selected' : ''}" data-bag="${i}"><div class="item-icon rarity-${it.rarity}">${it.icon}</div><div class="item-name rarity-${it.rarity}">${it.name}</div></div>`;
    }).join('');
    const cons = Object.keys(CONSUMABLES).map((id) => { const c = CONSUMABLES[id], n = p.consumables[id]; return `<div class="row between" style="padding:4px 0"><span><b style="color:${c.color}">${c.icon}</b> ${c.name} <span class="muted">×${n}</span><br><span class="muted">${c.desc}</span></span><button class="small" data-use="${id}" ${n > 0 ? '' : 'disabled'}>Использовать</button></div>`; }).join('');
    const sel = this.selectedItem;
    let tip = '<span class="muted">Выберите предмет в сумке или надетый предмет.</span>';
    if (sel) {
      const equipped = Object.values(p.equipment).includes(sel);
      tip = `<div class="row">${this.itemHtml(sel)}</div><div class="muted" style="margin-top:4px">${RARITY[sel.rarity].name} · цена ${sel.price} зол.</div>${equipped ? '' : this.compareHtml(sel)}
        <div class="actions">${equipped ? `<button class="small" data-a="unequip" ${p.bagFull() ? 'disabled' : ''}>Снять</button>` : `<button class="small primary" data-a="equip">Надеть</button><button class="small" data-a="drop">Выбросить</button>`}</div>`;
    }
    const stats = Object.entries(p.statsSummary()).map(([k, v]) => `${k}: <b>${v}</b>`).join(' · ');
    this.render(`
      <div class="overlay"><div class="panel inv-panel">
        <div class="row between"><h2 style="margin:0">Инвентарь</h2><span class="gold">${p.gold} зол.</span></div>
        <div class="inv-layout" style="margin-top:12px">
          <div>
            <h3 style="margin-top:0">Снаряжение</h3><div class="equip-slots">${slots}</div>
            <h3>Расходники</h3>${cons}
            <div class="player-stats">${stats}</div>
          </div>
          <div>
            <h3 style="margin-top:0">Сумка (${p.bag.length}/${BAG_SIZE})</h3>
            <div class="bag-grid">${bag}</div>
            <div class="item-tip">${tip}</div>
          </div>
        </div>
        <div class="footer-row"><span class="muted">Esc / I — закрыть</span><button class="primary" data-a="close">Закрыть</button></div>
      </div></div>`);
    this.bind('[data-bag]', 'click', (el) => { this.selectedItem = p.bag[+el.dataset.bag]; this.showInventory(); });
    this.bind('[data-slot]', 'click', (el) => { const it = p.equipment[el.dataset.slot]; if (it) { this.selectedItem = it; this.showInventory(); } });
    this.bind('[data-a=equip]', 'click', () => { g.equipItem(sel); this.selectedItem = null; this.showInventory(); });
    this.bind('[data-a=unequip]', 'click', () => { g.unequipItem(sel.slot); this.selectedItem = null; this.showInventory(); });
    this.bind('[data-a=drop]', 'click', () => { g.dropItem(sel); this.selectedItem = null; this.showInventory(); });
    this.bind('[data-use]', 'click', (el) => { g.useConsumable(el.dataset.use); this.showInventory(); });
    this.bind('[data-a=close]', 'click', () => { g.state = 'run'; this.hide(); });
  }

  // ---------- Торговец ----------
  showShop(m) {
    const g = this.g, p = g.player;
    const stock = m.items.map((en, i) => {
      if (en.kind === 'item') {
        if (en.sold) return `<div class="shop-item" style="opacity:0.4"><div class="item-icon">—</div><div class="muted">Продано</div><div></div></div>`;
        return `<div class="shop-item">${this.itemHtml(en.item)}<button class="small primary" data-buy="${i}" ${p.gold >= en.price && !p.bagFull() ? '' : 'disabled'}>${en.price} зол.</button></div>`;
      }
      const c = CONSUMABLES[en.id];
      return `<div class="shop-item"><div class="item-icon" style="color:${c.color}">${c.icon}</div><div><div class="item-name">${c.name} <span class="muted">(осталось ${en.qty})</span></div><div class="item-stats">${c.desc}</div></div><button class="small primary" data-buy="${i}" ${p.gold >= en.price && en.qty > 0 ? '' : 'disabled'}>${en.price} зол.</button></div>`;
    }).join('');
    const sell = p.bag.length ? p.bag.map((it, i) => `<div class="shop-item">${this.itemHtml(it)}<button class="small" data-sell="${i}">Продать за ${Math.round(it.price * 0.4)}</button></div>`).join('') : '<div class="muted">Сумка пуста.</div>';
    this.render(`
      <div class="overlay"><div class="panel" style="min-width:820px">
        <div class="row between"><h2 style="margin:0">Торговец</h2><span class="gold">${p.gold} зол.</span></div>
        <div class="muted" style="margin:4px 0 12px">«Товар редкий, цены честные. Почти.»</div>
        <div class="inv-layout">
          <div><h3 style="margin-top:0">Купить</h3><div class="shop-items">${stock}</div></div>
          <div><h3 style="margin-top:0">Продать (${p.bag.length}/${BAG_SIZE})</h3><div class="shop-items">${sell}</div></div>
        </div>
        <div class="footer-row"><span class="muted">Esc / E — закрыть</span><button class="primary" data-a="close">Закрыть</button></div>
      </div></div>`);
    this.bind('[data-buy]', 'click', (el) => { g.buy(m.items[+el.dataset.buy]); this.showShop(m); });
    this.bind('[data-sell]', 'click', (el) => { g.sellItem(p.bag[+el.dataset.sell]); this.showShop(m); });
    this.bind('[data-a=close]', 'click', () => { g.state = 'run'; this.hide(); });
  }

  // ---------- Результат ----------
  showResult(victory, rs, hs) {
    const g = this.g, h = g.hero;
    const mins = Math.floor(rs.time / 60), secs = Math.floor(rs.time % 60);
    this.render(`
      <div class="overlay"><div class="panel ${victory ? 'banner-win' : 'banner-death'}" style="min-width:520px">
        <h1>${victory ? 'Тень рассеяна!' : 'Герой пал'}</h1>
        <div class="subtitle">${victory ? `${h.name} прошёл все ${MAX_FLOOR} этажей Подгорья.` : `${h.name} погиб на этаже ${g.floor}${rs.killer ? ` (${rs.killer})` : ''}. Уровень сохранён, вещи потеряны.`}</div>
        <div class="result-stats">
          <div>Этаж: <b>${rs.floor}</b></div><div>Время: <b>${mins}:${String(secs).padStart(2, '0')}</b></div>
          <div>Убито врагов: <b>${rs.kills}</b></div><div>Боссов: <b>${rs.bossKills}</b></div>
          <div>Уровней получено: <b>${rs.levels}</b></div><div>Уровень героя: <b>${hs.level}</b></div>
          <div>Осколков добыто: <b class="shards">+${rs.shards} ◆</b></div><div>Всего осколков: <b class="shards">${Save.data.shards} ◆</b></div>
        </div>
        <div class="menu-buttons">
          <button class="primary" data-a="again">Снова в подземелье</button>
          <button data-a="camp">В лагерь</button>
        </div>
      </div></div>`);
    this.bind('[data-a=again]', 'click', () => { g.resetRunState(); g.state = 'menu'; this.showHeroSelect(); });
    this.bind('[data-a=camp]', 'click', () => g.toMenu());
  }
}

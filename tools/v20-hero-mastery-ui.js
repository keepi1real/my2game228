// Read-only v20 mastery labels for the campaign selector and the canvas menu.
// Load after v20-hero-progression and the v19 front menu. No save fields.
(() => {
  const bonuses = Object.freeze({
    arator: '+1 броня',
    baldin: '+4% урона',
    faelas: '+3 п. п. шанса крита',
    mithrandir: '+2 п. п. сокращения перезарядки (до 60%)',
    peregrin: '−4% интервал обычных атак',
  });
  const shortBonuses = Object.freeze({
    arator: '+1 броня', baldin: '+4% урона', faelas: '+3 п. п. крит',
    mithrandir: '+2 п. п. отката', peregrin: '−4% интервал атак',
  });
  const levelOf = id => Number(Save.data.heroes?.[id]?.level) || 1;
  const labelOf = id => {
    const level = levelOf(id);
    const bonus = bonuses[id];
    return bonus ? `Мастерство 10: ${bonus} · ${level >= 10 ? 'получено' : `откроется через ${10 - level} ур.`}` : '';
  };

  const oldSelect = UI.prototype.renderHeroSelect;
  UI.prototype.renderHeroSelect = function () {
    const result = oldSelect.call(this);
    const detail = this.root.querySelector('.hero-detail');
    if (!detail || !bonuses[this.heroId]) return result;
    const note = document.createElement('div');
    note.className = 'hero-mastery';
    note.setAttribute('role', 'status');
    note.textContent = labelOf(this.heroId);
    note.style.cssText = 'margin:8px 0;padding:8px 10px;border-left:3px solid #d4a94a;background:#25221d;color:#f2dfb1;font-size:13px;line-height:1.4';
    detail.querySelector('.skill-list')?.before(note);
    return result;
  };

  const oldFront = UI.prototype.renderFrontMenu;
  UI.prototype.renderFrontMenu = function () {
    const result = oldFront.call(this);
    for (const button of this.root.querySelectorAll('[data-front^="hero-"]')) {
      const id = button.dataset.front.slice(5);
      if (bonuses[id]) button.setAttribute('aria-label', `${HERO_BY_ID[id].name} — ${HERO_BY_ID[id].title}. Уровень ${levelOf(id)}. ${labelOf(id)}`);
    }
    return result;
  };

  const oldPaint = FrontMenu.paint;
  FrontMenu.paint = function (ctx, menu, time) {
    oldPaint.call(this, ctx, menu, time);
    const level = levelOf(menu.heroId);
    const label = shortBonuses[menu.heroId]
      ? `Мастерство 10 · ${shortBonuses[menu.heroId]} · ${level >= 10 ? 'получено' : `через ${10 - level} ур.`}` : '';
    if (!label) return;
    const L = menu.layout, u = L.unit;
    const x = L.portrait ? L.x : L.heroX;
    const y = L.portrait ? L.rosterY + L.cardH + 59 * u : L.heroY + 75 * u;
    ctx.save();
    ctx.font = `${(L.portrait ? 16 : 10) * u}px Arial, sans-serif`;
    ctx.textAlign = L.portrait ? 'left' : 'center';
    ctx.textBaseline = 'middle';
    if (L.portrait) {
      // This line replaces the historical mastery tagline below the roster.
      ctx.fillStyle = '#07141c';
      ctx.fillRect(x - 2 * u, y - 11 * u, L.bwidth + 4 * u, 22 * u);
    }
    ctx.fillStyle = level >= 10 ? '#f2d990' : '#bdc7c5';
    ctx.fillText(label, x, y, L.portrait ? L.bwidth : L.w * .43);
    ctx.restore();
  };
})();

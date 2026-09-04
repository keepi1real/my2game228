'use strict';
// Проверки в настоящем браузере: сенсорное управление, вёрстка под телефон, PWA.
//
//   npm i playwright && npx playwright install chromium
//   node tests/browser.js
//
// Регрессии по бою, движению и луту лежат отдельно, в tests/combat.js.

const { withPage, checker } = require('./harness');
const { check, done } = checker();

withPage({
  context: {
    viewport: { width: 844, height: 390 },   // телефон, повёрнутый в ландшафт
    hasTouch: true, isMobile: true, deviceScaleFactor: 2,
  },
}, async ({ page, ctx, errors }) => {

  // Пересчёт координат холста (1024×640) в координаты страницы.
  const mapPt = (x, y) => page.evaluate(([x, y]) => {
    const c = document.getElementById('game'), r = c.getBoundingClientRect();
    return { x: r.left + x * (r.width / c.width), y: r.top + y * (r.height / c.height) };
  }, [x, y]);

  const cdp = await ctx.newCDPSession(page);
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', {
    type, touchPoints: pts.map((p, i) => ({ x: p.x, y: p.y, id: i })),
  });
  const tap = async (x, y) => {
    const p = await mapPt(x, y);
    await touch('touchStart', [p]); await page.waitForTimeout(80); await touch('touchEnd', []);
    await page.waitForTimeout(120);
  };

  // Координаты кнопок берём из самой игры, а не переписываем сюда: раскладка
  // живёт в TOUCH_UI и будет меняться, а тест должен ходить за ней следом.
  const ui = await page.evaluate(() => ({
    attack: TOUCH_UI.attack, skill0: TOUCH_UI.skills[0], bag: TOUCH_UI.bag,
  }));

  // Забег стартуем напрямую, минуя DOM-меню: проверяем управление, а не вёрстку меню.
  await page.evaluate(() => window.game.startRun('arator', 'startNone'));
  await page.waitForTimeout(300);
  check(await page.evaluate(() => game.state === 'run'), 'забег запустился');

  // --- Стик движения ---
  const before = await page.evaluate(() => game.player.x);
  const a = await mapPt(250, 460), b = await mapPt(330, 460);
  await touch('touchStart', [a]);
  await page.waitForTimeout(60);
  check(await page.evaluate(() => !!game.input.touch.stick), 'стик появился под пальцем');
  check(await page.evaluate(() => game.input.touchMode), 'сенсорный режим включился');
  for (let i = 1; i <= 6; i++) {
    await touch('touchMove', [{ x: a.x + (b.x - a.x) * i / 6, y: a.y }]);
    await page.waitForTimeout(50);
  }
  const after = await page.evaluate(() => game.player.x);
  check(after > before + 5, `герой поехал вправо (${before.toFixed(0)} → ${after.toFixed(0)})`);
  await touch('touchEnd', []);
  await page.waitForTimeout(60);
  check(await page.evaluate(() => !game.input.touch.stick), 'стик исчез после отпускания');

  // --- Атака удержанием ---
  const atk = await mapPt(ui.attack.x, ui.attack.y);
  await touch('touchStart', [atk]);
  await page.waitForTimeout(120);
  check(await page.evaluate(() => game.input.touch.held('attack')), 'кнопка атаки удерживается');
  check(await page.evaluate(() => game.player.attackTimer > 0 || game.player.swing > 0), 'атака сработала');
  await touch('touchEnd', []);
  await page.waitForTimeout(60);

  // --- Умение ---
  await tap(ui.skill0.x, ui.skill0.y);
  check(await page.evaluate(() => game.player.skillCds[0] > 0), 'умение 1 ушло в откат');

  // --- Инвентарь и его закрытие ---
  await tap(ui.bag.x, ui.bag.y);
  check(await page.evaluate(() => game.state === 'inventory'), 'кнопка сумки открыла инвентарь');
  const panel = await page.evaluate(() => {
    const el = document.querySelector('.panel');
    return el ? { w: el.getBoundingClientRect().width, vw: innerWidth } : null;
  });
  check(panel && panel.w <= panel.vw, `панель влезает в экран (${panel && panel.w.toFixed(0)} ≤ ${panel && panel.vw})`);
  const xBtn = await page.evaluate(() => {
    const el = document.querySelector('.panel-x');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { onScreen: r.top >= 0 && r.bottom <= innerHeight && r.right <= innerWidth, w: r.width };
  });
  check(xBtn && xBtn.onScreen, 'крестик закрытия виден на экране');
  check(xBtn && xBtn.w >= 44, `крестик не меньше 44 px (${xBtn && xBtn.w})`);
  await page.locator('.panel-x').tap();
  await page.waitForTimeout(150);
  check(await page.evaluate(() => game.state === 'run'), 'крестик закрыл инвентарь');

  // --- Автоприцел ---
  // Врага ставим не на фиксированное смещение, а на ближайший видимый проходимый
  // тайл: на слепом смещении гоблин попадал в стену, автоприцел его не видел
  // и проверка падала через раз в зависимости от того, как лёг этаж.
  const aim = await page.evaluate(async () => {
    const p = game.player, map = game.map;
    const px = Math.floor(p.x / TILE), py = Math.floor(p.y / TILE);
    let spot = null;
    for (let r = 2; r <= 5 && !spot; r++) {
      for (let dy = -r; dy <= r && !spot; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = px + dx, y = py + dy;
        if (!map.inBounds(x, y) || !map.isWalkable(x, y)) continue;
        if (!map.visible[map.idx(x, y)]) continue;
        spot = { x: x * TILE + TILE / 2, y: y * TILE + TILE / 2 };
        break;
      }
    }
    if (!spot) return null;
    game.enemies.length = 0;                       // чужие враги увели бы прицел
    game.enemies.push(new Enemy('goblin', spot.x, spot.y, 1));
    const want = { x: spot.x - p.x, y: spot.y - p.y };
    const l = Math.hypot(want.x, want.y);
    p.aim.x = -want.x / l; p.aim.y = -want.y / l;  // изначально смотрим ровно назад
    await new Promise((r) => setTimeout(r, 600));
    return { dot: (p.aim.x * want.x + p.aim.y * want.y) / l };
  });
  check(aim && aim.dot > 0.9, `автоприцел развернулся на врага (совпадение ${aim ? aim.dot.toFixed(2) : 'нет места'})`);

  // --- PWA ---
  const mf = await page.evaluate(() => fetch('manifest.webmanifest').then((r) => (r.ok ? r.json() : null)));
  check(mf && mf.icons && mf.icons.length === 3, 'манифест отдаётся и в нём три иконки');
  check(mf && mf.display === 'fullscreen' && mf.orientation === 'landscape', 'манифест просит ландшафт и полный экран');
  for (const ic of (mf && mf.icons) || []) {
    check(await page.evaluate((u) => fetch(u).then((r) => r.ok), ic.src), `иконка отдаётся: ${ic.src}`);
  }
  check(await page.evaluate(() => navigator.serviceWorker.getRegistration().then((r) => !!r)), 'service worker зарегистрирован');

  check(errors.length === 0, 'ошибок в консоли нет' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));

});

process.on('beforeExit', () => done('телефон и PWA'));

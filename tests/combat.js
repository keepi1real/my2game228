'use strict';
// Регрессии по бою, движению и луту: node tests/combat.js
//
// Каждая проверка здесь once сломалась по-настоящему — это не «на всякий случай»,
// а фиксация найденных багов. Нужен playwright: игровой цикл требует холста,
// а Game создаёт Renderer и UI, которые без DOM не поднять.

const { withPage, checker } = require('./harness');
const { check, done } = checker();

withPage({}, async ({ page, errors }) => {
  // Всё измерение идёт одним заходом в страницу: игра не сериализуется, а гонять
  // по одному вызову на проверку — это сотни раундтрипов.
  const r = await page.evaluate(() => {
    const g = window.game;
    const out = {};
    const step = (n, dt = 1 / 60) => { for (let i = 0; i < n; i++) g.update(dt); };
    const quiet = () => { g.input.keys = {}; g.input.pressed = {}; g.input.mouse.down = false; };
    // Стену ставим сами, а не ищем готовую. Раньше тест искал стену толщиной
    // ровно в тайл с полом по обе стороны — на многих этажах такой просто нет
    // (перегородки между комнатами толще), и проверка падала через раз по воле
    // генератора. Нужен лишь горизонтальный ряд из трёх проходимых тайлов —
    // он есть всегда, — и середина превращается в стену.
    const buildWall = (map) => {
      for (let y = 1; y < map.h - 1; y++) for (let x = 1; x < map.w - 1; x++) {
        if (map.isWalkable(x - 1, y) && map.isWalkable(x, y) && map.isWalkable(x + 1, y)) {
          map.set(x, y, T_WALL);
          return map.isWall(x, y) ? { x, y } : null;
        }
      }
      return null;
    };
    const sides = (map, w) => ({
      left: { x: (w.x - 1 + 0.5) * TILE, y: (w.y + 0.5) * TILE },
      right: { x: (w.x + 1 + 0.5) * TILE, y: (w.y + 0.5) * TILE },
    });

    // ---------- Оглушение отменяет замах ----------
    g.startRun('arator', 'startNone'); quiet();
    g.enemies.length = 0; g.projectiles.length = 0;
    const arch = new Enemy('archer', g.player.x + 120, g.player.y, 1);
    g.enemies.push(arch);
    arch.state = 'windup'; arch.windup = 0.5; arch.attackTimer = 999; arch.windupDir = { x: -1, y: 0 };
    step(6);
    arch.stun = 1.0;
    step(6);
    out.stateAfterStun = arch.state;
    g.projectiles.length = 0;
    step(70);                       // ~1.17 c: оглушение давно кончилось
    out.shotsAfterStun = g.projectiles.length;

    // ---------- Ближний бой не проходит сквозь стену ----------
    g.startRun('baldin', 'startNone'); quiet();
    const wall = buildWall(g.map);
    out.foundWall = !!wall;
    if (wall) {
      const s = sides(g.map, wall);
      // Тролль достаёт на 68 px — дальше, чем 64 px между центрами через стену.
      g.enemies.length = 0;
      const pl = g.player;
      pl.x = s.left.x; pl.y = s.left.y; pl.hp = pl.maxHp; pl.invulnTime = 0;
      const troll = new Enemy('troll', s.right.x, s.right.y, 1);
      troll.windupDir = { x: -1, y: 0 };
      g.enemies.push(troll);
      out.trollReach = troll.def.attackRange + pl.r + 10;
      const hp0 = pl.hp;
      g.enemyAttack(troll);
      out.trollHitThroughWall = pl.hp < hp0;

      // И симметрично: игрок тоже не достаёт сквозь стену.
      troll.hp = troll.maxHp;
      pl.aim.x = 1; pl.aim.y = 0; pl.attackTimer = 0;
      const thp0 = troll.hp;
      g.playerAttack();
      out.playerHitThroughWall = troll.hp < thp0;

      // Контроль: без стены удар обязан проходить, иначе проверка выше ничего не значит.
      troll.hp = troll.maxHp; troll.x = pl.x + 40; troll.y = pl.y;
      pl.attackTimer = 0;
      const thp1 = troll.hp;
      g.playerAttack();
      out.playerHitsInOpen = troll.hp < thp1;
    }

    // ---------- Золото не притягивается сквозь стену ----------
    if (wall) {
      const s = sides(g.map, wall);
      g.pickups.length = 0;
      const pl = g.player;
      pl.x = s.left.x; pl.y = s.left.y;
      const coin = new Pickup(s.right.x, s.right.y, 'gold', { amount: 7 });
      coin.age = 1; coin.vx = 0; coin.vy = 0;
      g.pickups.push(coin);
      const gold0 = pl.gold;
      step(40);
      out.goldThroughWall = pl.gold > gold0;

      // Контроль: в чистом поле магнит обязан работать. Игрок сейчас стоит
      // вплотную к стене, поэтому начинаем с чистого этажа и ищем открытое
      // направление — иначе монета опять окажется за стеной и контроль соврёт.
      g.startRun('arator', 'startNone'); quiet();
      g.pickups.length = 0;
      const pl2 = g.player;
      let spot = null;
      for (const [dx, dy] of [[60, 0], [-60, 0], [0, 60], [0, -60], [42, 42], [-42, -42]]) {
        if (g.map.circleBlocked(pl2.x + dx, pl2.y + dy, 8)) continue;
        if (!g.canReach(pl2, { x: pl2.x + dx, y: pl2.y + dy })) continue;
        spot = { x: pl2.x + dx, y: pl2.y + dy }; break;
      }
      out.foundOpenSpot = !!spot;
      if (spot) {
        const near = new Pickup(spot.x, spot.y, 'gold', { amount: 5 });
        near.age = 1; near.vx = 0; near.vy = 0;
        g.pickups.push(near);
        const gold1 = pl2.gold;
        step(60);
        out.goldMagnetWorks = pl2.gold > gold1;
      }
    }

    // ---------- Смерть от стрелы называет стрелка ----------
    g.startRun('faelas', 'startNone'); quiet();
    g.enemies.length = 0; g.projectiles.length = 0;
    const shooter = new Enemy('archer', g.player.x + 80, g.player.y, 1);
    g.enemies.push(shooter);
    g.player.hp = 1; g.player.invulnTime = 0;
    g.enemyAttack(shooter);
    step(30);
    out.killer = g.runStats.killer || null;
    out.shooterName = shooter.def.name;

    // ---------- Лут босса: пул не пустеет ни на одном этаже ----------
    out.emptyBossPools = [];
    for (let f = 1; f <= MAX_FLOOR; f++) {
      let pool = ITEM_BASES.filter((b) => b.tier <= f + 2 && b.tier >= f - 3);
      if (!pool.length) pool = ITEM_BASES.filter((b) => b.tier <= f + 2);
      if (!pool.length) pool = ITEM_BASES;
      if (!pool.length) out.emptyBossPools.push(f);
    }

    // ---------- Проданный товар нельзя купить второй раз ----------
    g.startRun('arator', 'startNone'); quiet();
    const stock = g.makeShopStock();
    const entry = stock.find((e) => e.kind === 'item');
    g.player.gold = entry.price * 3;
    g.player.bag.length = 0;
    const bought1 = g.buy(entry);
    const goldMid = g.player.gold;
    const bought2 = g.buy(entry);
    out.doubleBuy = { first: bought1, second: bought2, goldTaken: goldMid !== g.player.gold };

    // ---------- Сохранение не пишется на каждом убийстве ----------
    let writes = 0;
    const realSet = localStorage.setItem.bind(localStorage);
    localStorage.setItem = (...a) => { writes++; return realSet(...a); };
    g.startRun('baldin', 'startNone'); quiet();
    writes = 0;
    g.enemies.length = 0;
    for (let i = 0; i < 12; i++) {
      const e = new Enemy('goblin', g.player.x + 300 + i, g.player.y, 1);
      g.enemies.push(e);
      g.killEnemy(e);
    }
    out.writesAfter12Kills = writes;
    step(1);                        // меньше 2 c — сброса ещё не было
    out.writesBeforeFlush = writes;
    step(150);                      // 2.5 c — отложенная запись прошла
    out.writesAfterFlush = writes;
    localStorage.setItem = realSet;

    return out;
  });

  check(r.stateAfterStun === 'chase', `оглушение снимает замах (состояние «${r.stateAfterStun}»)`);
  check(r.shotsAfterStun === 0, `после оглушения нет мгновенного выстрела (выстрелов: ${r.shotsAfterStun})`);

  check(r.foundWall, 'на этаже нашлась стена с проходом по обе стороны');
  check(r.trollReach > 64, `у тролля замах длиннее стены — проверка осмысленна (${r.trollReach} px > 64)`);
  check(r.trollHitThroughWall === false, 'тролль не бьёт сквозь стену');
  check(r.playerHitThroughWall === false, 'игрок не бьёт сквозь стену');
  check(r.playerHitsInOpen === true, 'в чистом поле удар игрока проходит');

  check(r.goldThroughWall === false, 'золото не притягивается сквозь стену');
  check(r.foundOpenSpot, 'нашлось открытое место для контрольной монеты');
  check(r.goldMagnetWorks === true, 'магнит золота работает в чистом поле');

  check(r.killer === r.shooterName, `смерть от стрелы называет стрелка («${r.killer}»)`);

  check(r.emptyBossPools.length === 0, `пул лута босса не пуст ни на одном этаже (пустые: ${r.emptyBossPools.join(',') || 'нет'})`);

  check(r.doubleBuy.first === true, 'товар покупается');
  check(r.doubleBuy.second === false, 'проданный товар второй раз не покупается');
  check(r.doubleBuy.goldTaken === false, 'за вторую покупку золото не списано');

  check(r.writesAfter12Kills === 0, `12 убийств не пишут в localStorage (записей: ${r.writesAfter12Kills})`);
  check(r.writesBeforeFlush === 0, 'до срока отложенная запись не срабатывает');
  check(r.writesAfterFlush === 1, `через 2 с прогресс пишется один раз (записей: ${r.writesAfterFlush})`);

  check(errors.length === 0, 'ошибок в консоли нет' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));
});

process.on('beforeExit', () => done('бой и лут'));

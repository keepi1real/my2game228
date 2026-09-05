'use strict';
// Общая обвязка браузерных проверок: находит Chromium, поднимает tools/server.js,
// открывает страницу. Используется из tests/browser.js и tests/combat.js.
//
// Playwright в зависимостях не числится: игра от него не зависит, а тесты нужны
// только когда трогают ввод, бой или вёрстку. Если его нет — вызывающий скрипт
// молча выходит с нулевым кодом, чтобы не валить прогон на машине без браузера.

const { spawn } = require('child_process');
const fs = require('fs');
const net = require('net');
const path = require('path');

const root = path.join(__dirname, '..');

function playwright() {
  try { return require('playwright'); } catch (e) { return null; }
}

// Где взять Chromium. Обычно его ставит сам playwright, но в готовых образах
// браузер часто лежит рядом и другой версии — тогда указываем путь руками.
function chromePath() {
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (!base || !fs.existsSync(base)) return undefined;
  const dir = fs.readdirSync(base).filter((d) => d.startsWith('chromium-')).sort().pop();
  if (!dir) return undefined;
  const exe = path.join(base, dir, 'chrome-linux', 'chrome');
  return fs.existsSync(exe) ? exe : undefined;
}

// Счётчик проверок с печатью. Возвращает объект с check() и списком провалов.
function checker() {
  const fail = [];
  return {
    fail,
    check(cond, msg) { console.log((cond ? 'ok   ' : 'FAIL ') + msg); if (!cond) fail.push(msg); },
    done(what) {
      console.log(fail.length ? `\n${fail.length} проверок провалено` : `\n${what}: все проверки пройдены.`);
      process.exit(fail.length ? 1 : 0);
    },
  };
}

// Свободный порт у системы. Фиксированные номера сталкивались с уже запущенным
// сервером, и тест молча читал чужую выдачу — редкие необъяснимые падения.
function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

// Поднимает сервер, открывает игру, отдаёт page в fn и всё за собой убирает.
async function withPage(opts, fn) {
  const pw = playwright();
  if (!pw) {
    // На своей машине пропуск удобен: игра от playwright не зависит. В CI это
    // означало бы зелёную сборку, не проверившую ничего, поэтому там выставлен
    // REQUIRE_BROWSER и отсутствие браузера — ошибка, а не повод пройти мимо.
    if (process.env.REQUIRE_BROWSER) {
      console.error('playwright не установлен, а REQUIRE_BROWSER задан: проверки обязательны.');
      process.exit(1);
    }
    console.log('playwright не установлен — браузерные проверки пропущены.');
    console.log('Поставить: npm i playwright && npx playwright install chromium');
    process.exit(0);
  }
  const port = Number(process.env.PORT) || await freePort();
  const server = spawn(process.execPath, [path.join(root, 'tools', 'server.js'), String(port)], { stdio: 'ignore' });
  server.on('error', (e) => console.error('сервер не запустился:', e.message));
  const stop = () => { try { server.kill(); } catch (e) {} };
  process.on('exit', stop);

  const browser = await pw.chromium.launch({ executablePath: chromePath() });
  const ctx = await browser.newContext(opts.context || { viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 300)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 300)); });

  // Сервер только что стартовал — даём ему занять порт.
  let opened = false;
  for (let i = 0; i < 20 && !opened; i++) {
    try { await page.goto(`http://localhost:${port}/index.html`, { waitUntil: 'load', timeout: 2000 }); opened = true; }
    catch (e) { await new Promise((r) => setTimeout(r, 250)); }
  }
  if (!opened) { await browser.close(); stop(); throw new Error(`игра не открылась на порту ${port}`); }
  await page.waitForFunction(() => window.game, null, { timeout: 10000 });

  try { await fn({ page, ctx, errors }); }
  finally { await browser.close(); stop(); }
}

module.exports = { withPage, checker };

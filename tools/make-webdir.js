'use strict';
// Готовит папку с игрой: node tools/make-webdir.js [--pwa] [куда]
//
// Без флага — под APK: service worker не нужен и мешает. С --pwa — под раздачу
// по HTTPS (GitHub Pages и прочие): туда идут sw.js и .nojekyll, а регистрация
// в index.html остаётся на месте.
//
// Capacitor копирует в приложение всё содержимое указанной папки. Корень репозитория
// на эту роль не годится: туда попали бы .git, node_modules, tests и tools —
// десятки мегабайт, которым в APK делать нечего. Поэтому переносим ровно то,
// без чего игра не запустится.
//
// Отличие от tools/bundle.js: тот делает один файл с картинками в base64 для
// пересылки, здесь же нужны обычные файлы — WebView отдаёт их быстрее и кэширует.

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const args = process.argv.slice(2);
const pwa = args.includes('--pwa');
const out = path.resolve(args.find((a) => !a.startsWith('--')) || path.join(root, 'www'));

// Service worker в APK не кладём: внутри WebView всё и так локальное, а лишний
// слой кэша только помешает обновлению игры вместе с приложением.
const FILES = ['index.html', 'manifest.webmanifest'].concat(pwa ? ['sw.js', '.nojekyll'] : []);
const DIRS = ['css', 'js', 'assets'];

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  let n = 0;
  for (const e of fs.readdirSync(from, { withFileTypes: true })) {
    const src = path.join(from, e.name), dst = path.join(to, e.name);
    if (e.isDirectory()) n += copyDir(src, dst);
    else { fs.copyFileSync(src, dst); n++; }
  }
  return n;
}

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

let count = 0;
for (const f of FILES) { fs.copyFileSync(path.join(root, f), path.join(out, f)); count++; }
for (const d of DIRS) count += copyDir(path.join(root, d), path.join(out, d));

// Регистрация service worker внутри WebView только мешает: обновление приложения
// приходит с новым APK, а не из сети. Вырезаем ровно этот блок, разметку не трогаем.
if (!pwa) {
  const idx = path.join(out, 'index.html');
  const html = fs.readFileSync(idx, 'utf8')
    .replace(/\n\s*<!-- Регистрация service worker[\s\S]*?<\/script>\n/, '\n');
  fs.writeFileSync(idx, html);
}

const size = (function du(p) {
  const s = fs.statSync(p);
  if (!s.isDirectory()) return s.size;
  return fs.readdirSync(p).reduce((a, e) => a + du(path.join(p, e)), 0);
})(out);

console.log(`Записано ${out}: ${count} файлов, ${(size / 1024 / 1024).toFixed(1)} МБ`);
console.log(pwa
  ? 'Готово к раздаче по HTTPS: service worker и .nojekyll на месте.'
  : 'Дальше: npx cap sync android && cd android && ./gradlew assembleDebug');

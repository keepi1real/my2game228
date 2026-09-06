'use strict';
// Составляет assets/audio.json — список того, какие записи реально лежат в
// assets/music и assets/sfx: node tools/audio-index.js
//
// Зачем: без списка игре пришлось бы искать каждый звук вслепую, а промах —
// это 404 в консоли. Пока записей нет, промахов было бы больше сотни за сеанс,
// и браузерная проверка «ошибок в консоли нет» справедливо падала.
//
// Запускается сам из tools/bundle.js и tools/make-webdir.js, так что сборка
// никогда не расходится с папками. Руками нужен только после того, как в
// assets/ положили новые файлы и хочется услышать их сразу, без пересборки.
const fs = require('fs');
const path = require('path');

const EXTS = ['.mp3', '.ogg', '.wav'];

// id -> расширение. Расширение хранится, чтобы игра не подбирала его перебором:
// перебор — это опять промахи в сети.
function scan(root, dir) {
  const abs = path.join(root, dir);
  const found = {};
  if (!fs.existsSync(abs)) return found;
  for (const name of fs.readdirSync(abs).sort()) {
    const ext = path.extname(name).toLowerCase();
    if (!EXTS.includes(ext)) continue;
    const id = name.slice(0, -ext.length);
    if (!found[id]) found[id] = ext.slice(1);   // первый по порядку выигрывает
  }
  return found;
}

function build(root) {
  const index = { music: scan(root, 'assets/music'), sfx: scan(root, 'assets/sfx') };
  const out = path.join(root, 'assets', 'audio.json');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(index) + '\n');
  return index;
}

module.exports = { build, scan };

if (require.main === module) {
  const root = path.join(__dirname, '..');
  const i = build(root);
  console.log(`assets/audio.json: музыки ${Object.keys(i.music).length}, эффектов ${Object.keys(i.sfx).length}`);
}

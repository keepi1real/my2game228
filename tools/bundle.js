'use strict';
// Собирает игру в один автономный HTML-файл: node tools/bundle.js [--artifact] [out]
// В том числе встраивает локальные WebP-ассеты как data URI.
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const args = process.argv.slice(2);
const artifact = args.includes('--artifact');
const out = args.find((a) => !a.startsWith('--')) || path.join(root, 'dist', 'index.html');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

const styles = [...html.matchAll(/<link rel="stylesheet" href="([^"]+)">/g)].map((m) => m[1]);
let css = styles.map((f) => `/* ---- ${f} ---- */\n` + fs.readFileSync(path.join(root, f), 'utf8')).join('\n');
const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]);
let js = scripts.map((f) => `// ---- ${f} ----\n` + fs.readFileSync(path.join(root, f), 'utf8').replace(/^'use strict';\n/, '')).join('\n');

// Ассеты превращаем в data URI, чтобы dist/index.html был автономным.
// Ищем и в JS, и в CSS: в стилях пути записаны относительно css/, то есть с ../,
// и раньше такие ссылки не вшивались вовсе — сборка молча теряла картинку.
// Ничего не находится по ссылке — просто пропускаем: страница остаётся рабочей.
const inlined = [];
function inlineAssets(text) {
  const refs = [...new Set(text.match(/(?:\.\.\/)*assets\/[A-Za-z0-9_./-]+\.(?:webp|png)/g) || [])]
    .sort((a, b) => b.length - a.length);   // длинные первыми, иначе ../assets/x покалечится заменой assets/x
  for (const ref of refs) {
    const rel = ref.replace(/^(?:\.\.\/)+/, '');
    const abs = path.join(root, rel);
    if (!fs.existsSync(abs)) continue;
    const mime = rel.endsWith('.png') ? 'image/png' : 'image/webp';
    text = text.split(ref).join(`data:${mime};base64,${fs.readFileSync(abs).toString('base64')}`);
    inlined.push(rel);
  }
  return text;
}
js = inlineAssets(js);
css = inlineAssets(css);

const title = html.match(/<title>(.*?)<\/title>/)[1];
const body = `<title>${title}</title>\n<style>\n${css}</style>\n<div id="game-root">\n  <canvas id="game" width="1024" height="640"></canvas>\n  <div id="ui"></div>\n</div>\n<script>\n'use strict';\n${js}\n</script>\n`;
const doc = artifact ? body : `<!DOCTYPE html>\n<html lang="ru">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n${body.replace('<div id="game-root">', '</head>\n<body>\n<div id="game-root">')}</body>\n</html>\n`;
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, doc);
console.log(`Записано ${out} (${(doc.length / 1024).toFixed(0)} КБ), встроено ассетов: ${new Set(inlined).size}`);

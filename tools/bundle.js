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
const css = styles.map((f) => `/* ---- ${f} ---- */\n` + fs.readFileSync(path.join(root, f), 'utf8')).join('\n');
const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]);
let js = scripts.map((f) => `// ---- ${f} ----\n` + fs.readFileSync(path.join(root, f), 'utf8').replace(/^'use strict';\n/, '')).join('\n');

// Любые assets/*.webp, упомянутые в JS, превращаем в data URI, чтобы dist/index.html был автономным.
const assetRefs = [...new Set(js.match(/assets\/[A-Za-z0-9_./-]+\.webp/g) || [])];
for (const rel of assetRefs) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) continue;
  const dataUri = `data:image/webp;base64,${fs.readFileSync(abs).toString('base64')}`;
  js = js.split(rel).join(dataUri);
}

const title = html.match(/<title>(.*?)<\/title>/)[1];
const body = `<title>${title}</title>\n<style>\n${css}</style>\n<div id="game-root">\n  <canvas id="game" width="1024" height="640"></canvas>\n  <div id="ui"></div>\n</div>\n<script>\n'use strict';\n${js}\n</script>\n`;
const doc = artifact ? body : `<!DOCTYPE html>\n<html lang="ru">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n${body.replace('<div id="game-root">', '</head>\n<body>\n<div id="game-root">')}</body>\n</html>\n`;
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, doc);
console.log(`Записано ${out} (${(doc.length / 1024).toFixed(0)} КБ), встроено ассетов: ${assetRefs.length}`);

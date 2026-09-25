'use strict';
const fs = require('fs');
const http = require('http');
const path = require('path');
const {chromium} = require('playwright');
const dir = path.resolve('www');
const server = http.createServer((req, res) => {
  const name = decodeURIComponent(new URL(req.url, 'http://localhost').pathname).replace(/^\//, '') || 'index.html';
  if (!['index.html', 'adventure-v19-play.html.gz', 'assets/audio.json'].includes(name)) {
    res.writeHead(404).end(); return;
  }
  const file = path.join(dir, name);
  res.setHeader('content-type', name.endsWith('.gz') ? 'application/gzip' : name.endsWith('.json') ? 'application/json' : 'text/html; charset=utf-8');
  fs.createReadStream(file).pipe(res);
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({headless:true});
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:' + server.address().port, {waitUntil:'domcontentloaded'});
    await page.waitForFunction(() => document.title === 'Осколки Рассвета' && !!document.querySelector('#game') && !!document.querySelector('#ui'), {timeout:90000});
    await page.waitForTimeout(1500);
    if (errors.length) throw new Error('Browser errors: ' + errors.join('; '));
    console.log('V19 menu loaded:', await page.title());
  } finally {
    await browser.close();
    server.close();
  }
})().catch(error => {console.error(error); process.exitCode=1; server.close();});

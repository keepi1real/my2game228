'use strict';
const fs = require('fs');
const http = require('http');
const path = require('path');
const {chromium} = require('playwright');
const dir = path.resolve('www');
const allowed = new Set([
  'adventure-v20/index.html',
  'adventure-v20/adventure-v20-play.html.gz',
  'assets/v20/seam-crab.png',
  'assets/v20/ceramic-observatory-floor.png',
  'assets/audio.json',
]);
const server = http.createServer((req,res) => {
  const name = decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\//,'') || 'adventure-v20/index.html';
  if (!allowed.has(name)) {res.writeHead(404).end();return;}
  res.setHeader('content-type', name.endsWith('.gz') ? 'application/gzip' : name.endsWith('.png') ? 'image/png' : name.endsWith('.json') ? 'application/json' : 'text/html; charset=utf-8');
  fs.createReadStream(path.join(dir,name)).pipe(res);
});
(async () => {
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser=await chromium.launch({headless:true});
  try {
    const page=await browser.newPage();
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    page.on('console',message=>{if(message.type()==='error' && /Ошибка в кадре игры|Игровой цикл остановлен|TypeError|ReferenceError/.test(message.text()))errors.push(message.text());});
    await page.goto('http://127.0.0.1:'+server.address().port+'/adventure-v20/index.html',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(() => document.title === 'Осколки Рассвета' && window.V20Build?.installed?.length === 4 && document.querySelectorAll('[aria-label*="—"]').length >= 5, null, {timeout:90000});
    await page.getByRole('button',{name:'Начать поход'}).click();
    await page.waitForFunction(() => window.game?.state === 'run' && window.game?.journey?.v20MapVersion === 20, null, {timeout:30000});
    await page.waitForTimeout(1200);
    if (errors.length) throw Error(errors.join('\n'));
    console.log('V20 started with',await page.evaluate(() => ({hero:game.hero.id,mapVersion:game.journey.v20MapVersion,patches:V20Build.installed})));
  } finally {await browser.close();server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;server.close();});

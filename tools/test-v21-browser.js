'use strict';
const fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const {chromium}=require('playwright');
const root=path.resolve('www');
const allowed=new Set(['adventure-v20/index.html','adventure-v20/adventure-v20-play.html.gz','assets/v20/seam-crab.png','assets/v20/ceramic-observatory-floor.png','assets/audio.json']);
const server=http.createServer((req,res)=>{
  const file=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\//,'');
  if(!allowed.has(file)){res.writeHead(404).end();return;}
  res.setHeader('content-type',file.endsWith('.gz')?'application/gzip':file.endsWith('.png')?'image/png':file.endsWith('.json')?'application/json':'text/html; charset=utf-8');
  fs.createReadStream(path.join(root,file)).pipe(res);
});
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser=await chromium.launch({headless:true});
  try{
    const page=await browser.newPage(),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
    await page.goto('http://127.0.0.1:'+server.address().port+'/adventure-v20/index.html?debug=1&map=tideobservatory',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.game?.state==='run'&&window.game?.journey?.levelId==='tideobservatory'&&window.game?.journey?.v21MapVersion===21,null,{timeout:90000});
    await page.waitForTimeout(1200);
    const result=await page.evaluate(()=>({rooms:game.journey.rooms.length,key:SeamlessFloor.key,checkpoint:JSON.parse(localStorage.getItem(SeamlessFloor.key)),art:!!window.V21TideObservatoryArt,build:window.V20Build?.installed}));
    if(result.rooms!==16||result.key!=='undermountain-biomes-v21-observatory-preview'||!result.art||!result.build?.includes('tide-observatory-art')||result.checkpoint?.chapterVersion!==21||result.checkpoint?.mapVersion!==20)throw Error('New chapter or isolated checkpoint missing');
    if(errors.length)throw Error(errors.join('\n'));
    console.log('PASS playable observatory: 16 rooms, isolated v21 save, art loaded, no browser errors');
  }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;server.close();});

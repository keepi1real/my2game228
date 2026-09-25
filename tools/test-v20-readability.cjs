'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium}=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES?path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'playwright'):'playwright');
const sourcePath=process.argv[2]||path.resolve(__dirname,'../adventure-v19-play.html.gz');
const sourceBytes=fs.readFileSync(sourcePath);
const base=(sourcePath.endsWith('.gz')?require('zlib').gunzipSync(sourceBytes):sourceBytes).toString('utf8');
const start=base.indexOf('function layout(w=1024,h=640,saved=false)'),end=base.indexOf('  function text(',start);
assert(start>0&&end>start);const layout=base.slice(start,end);
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{for(const viewport of [{width:844,height:390},{width:390,height:844}]){
  const page=await browser.newPage({viewport});
  await page.setContent('<style>body{margin:0}.front-surface{position:fixed;inset:0}.front-hit,.front-difficulty{position:absolute}.front-difficulty{display:flex;align-items:center}canvas{width:100vw;height:auto}</style><canvas id="game" width="1024" height="640"></canvas><div id="ui"></div>');
  await page.addScriptTag({content:`const HEROES=['a','b','c','d','e'].map(id=>({id}));const profile=id=>({name:id,title:id});const FrontMenu={layout:${layout}};class Renderer{drawEnemies(){return 17}visibleAt(){return true}};window.testRenderer=Renderer;window.testFront=FrontMenu;`});
  await page.addScriptTag({path:path.resolve(__dirname,'v20-readability.js')});
  for(const saved of [false,true]){
   const report=await page.evaluate(saved=>{
    const w=innerWidth<innerHeight?720:Math.round(640*innerWidth/innerHeight),h=innerWidth<innerHeight?Math.round(720*innerHeight/innerWidth):640;
    const L=testFront.layout(w,h,saved),d=L.difficulty;
    document.querySelector('#ui').innerHTML='<div class="front-surface">'+L.boxes.map(b=>`<button class="front-hit" data-id="${b.id}" style="left:${b.x/w*100}%;top:${b.y/h*100}%;width:${b.w/w*100}%;height:${b.h/h*100}%">${b.id}</button>`).join('')+`<label class="front-difficulty" style="left:${d.x/w*100}%;top:${d.y/h*100}%;width:${d.w/w*100}%;height:${d.h/h*100}%"><select><option>Normal</option></select></label></div>`;
    const targets=[...document.querySelectorAll('button,select')].map(el=>{const r=el.getBoundingClientRect();return {id:el.dataset.id||'difficulty',x:r.x,y:r.y,w:r.width,h:r.height};});
    const overlaps=[];for(let i=0;i<targets.length;i++)for(let j=i+1;j<targets.length;j++){const a=targets[i],b=targets[j];if(Math.min(a.x+a.w,b.x+b.w)>Math.max(a.x,b.x)+.1&&Math.min(a.y+a.h,b.y+b.h)>Math.max(a.y,b.y)+.1)overlaps.push([a.id,b.id]);}
    return {targets,overlaps};
   },saved);
   assert(report.targets.every(t=>t.w>=43.99&&t.h>=43.99),JSON.stringify(report));assert.equal(report.overlaps.length,0,JSON.stringify(report.overlaps));
  }
  const check=await page.evaluate(()=>{
   const canvas=document.querySelector('canvas'),ctx=canvas.getContext('2d'),e={alive:true,x:300,y:150,telegraph:{total:1,time:.5,shapes:[{}]}},g={canvas,journey:{seamless:true},enemies:[e]},r=new testRenderer();r.g=g;r.ctx=ctx;
   const before=JSON.stringify(g.enemies),draw=[];const old=ctx.fillRect.bind(ctx);ctx.fillRect=(x,y,w,h)=>{draw.push({w,h});return old(x,y,w,h);};const value=r.drawEnemies();
   const scale=V20Readability.scales(canvas,ctx);return {value,changed:before!==JSON.stringify(g.enemies),pips:draw.slice(1).map(p=>({w:p.w*scale.x,h:p.h*scale.y}))};
  });
  assert.equal(check.value,17);assert.equal(check.changed,false);assert.equal(check.pips.length,4);assert(check.pips.every(p=>Math.abs(p.w-7)<.01&&Math.abs(p.h-7)<.01));
  console.log('PASS',viewport,'saved/unsaved tap targets ≥44 CSS px, no target overlap, four 7×7 CSS px pips, no combat mutation.');await page.close();
 }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

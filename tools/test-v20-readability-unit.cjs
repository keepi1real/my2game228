'use strict';
const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('assert/strict');
const base=require('zlib').gunzipSync(fs.readFileSync(path.join(__dirname,'../adventure-v19-play.html.gz'))).toString();
const start=base.indexOf('function layout(w=1024,h=640,saved=false)'),end=base.indexOf('  function text(',start);assert(start>0&&end>start);
for(const [width,height] of [[844,390],[390,844]]){
 const draw=[];class Renderer{drawEnemies(){return 17}visibleAt(){return true}}
 const env={window:{innerWidth:width,innerHeight:height},document:{createElement:()=>({}),head:{appendChild(){}}},Renderer};
 vm.createContext(env);vm.runInContext(`const HEROES=['a','b','c','d','e'].map(id=>({id}));const profile=id=>({name:id,title:id});const FrontMenu={layout:${base.slice(start,end)}};window.testFront=FrontMenu;`,env);
 vm.runInContext(fs.readFileSync(path.join(__dirname,'v20-readability.js'),'utf8'),env);
 const w=width<height?720:Math.round(640*width/height),h=width<height?Math.round(720*height/width):640,sx=width/w,sy=height/h;
 for(const saved of [false,true]){
  const L=env.window.testFront.layout(w,h,saved),boxes=L.boxes.concat([L.difficulty]);
  for(const b of boxes){assert(b.w*sx>=44-.01);assert(b.h*sy>=44-.01);assert(b.y>=0);assert((b.y+b.h)*sy<=height);}
  for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){const a=boxes[i],b=boxes[j];assert(!(Math.min(a.x+a.w,b.x+b.w)>Math.max(a.x,b.x)&&Math.min(a.y+a.h,b.y+b.h)>Math.max(a.y,b.y)));}
 }
 const canvas={width:1024,height:640,getBoundingClientRect:()=>({width,height:width*640/1024})};
 const c={getTransform:()=>({a:1,b:0,c:0,d:1}),save(){},restore(){},fillRect(x,y,w,h){draw.push({w,h})},strokeRect(){}};
 const r=new Renderer();r.ctx=c;r.g={canvas,journey:{seamless:true},enemies:[{alive:true,x:50,y:50,telegraph:{total:1,time:.5,shapes:[{}]}}]};const before=JSON.stringify(r.g.enemies);
 assert.equal(r.drawEnemies(),17);assert.equal(before,JSON.stringify(r.g.enemies));const scale=env.window.V20Readability.scales(canvas,c);
 assert.equal(draw.length,5);for(const p of draw.slice(1)){assert(Math.abs(p.w*scale.x-7)<.01);assert(Math.abs(p.h*scale.y-7)<.01);}
 console.log('PASS geometry + pips:',width,height);
}

'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {createCanvas}=require('@napi-rs/canvas');
const canvas=createCanvas(300,300),ctx=canvas.getContext('2d');
const source=fs.readFileSync(path.join(__dirname,'v20-combat-visibility.js'),'utf8');
const g={hero:{id:'arator'},journey:{v20MapVersion:20},player:{x:140,y:180,r:12,hp:100},enemies:[],decor:[]};
let propCalls=0,worldCalls=0;
const env={window:{},BiomeArtV3:{sprites:{pillar:{rect:[0,0,100,200]}},prop(){propCalls++;return 7;}},
  RootCombat:{contains:(s,p)=>Math.hypot(s.x-p.x,s.y-p.y)<=s.r+p.r}};
class Renderer {
  constructor(){this.g=g;this.ctx=ctx;}
  bodyTop(){return 100;}
  drawSeamlessWorld(){worldCalls++;for(const o of g.decor)env.BiomeArtV3.prop(ctx,o,g.player,0);return 19;}
}
env.Renderer=Renderer;vm.createContext(env);vm.runInContext(source,env);
const api=env.window.V20CombatVisibility,r=new Renderer();
const pillar={x:140,y:210,height:160,r:24,sprite:'pillar'};
assert(api.covers(pillar,g.player,100));
assert(!api.covers({...pillar,y:175},g.player,100),'props behind hero');
assert(!api.covers({...pillar,x:280},g.player,100),'props beside hero');
assert(!api.covers({...pillar,height:30},g.player,100),'low props');
g.decor=[pillar];const before=JSON.stringify(g);ctx.globalAlpha=.7;ctx.lineWidth=9;const alpha=ctx.globalAlpha;
assert.equal(r.drawSeamlessWorld(),19);assert.equal(ctx.globalAlpha,alpha);assert.equal(ctx.lineWidth,9);
assert.equal(JSON.stringify(g),before);assert.equal(api.metrics.occlusionSignals,1);assert.equal(propCalls,1);
function enemy(time,total=1,x=140){return {alive:true,telegraph:{type:'root',kind:'strike',time,total,shapes:[{shape:'circle',x,y:180,r:30}]}};}
g.enemies=[enemy(.8),enemy(.2),enemy(.5),enemy(.1),enemy(.05,1,280)];
let t=api.threats(g);assert.equal(t.count,4);assert.deepEqual(Array.from(t.earliest,e=>e.time),[.1,.2,.5]);
const shape=t.checked;assert(shape<=g.enemies.length);
const state=JSON.stringify(g);r.drawSeamlessWorld();assert.equal(api.metrics.overlapSignals,1);assert.equal(JSON.stringify(g),state);
g.enemies[3].telegraph.time=0;t=api.threats(g);assert.equal(t.count,3);assert.equal(t.earliest[0].time,.2);
g.player.x=280;assert.equal(api.threats(g).count,1,'moving out updates overlap immediately');
g.enemies[4].telegraph.kind='summon';assert.equal(api.threats(g).count,0,'summon is not damage warning');
g.player.x=140;g.enemies[0].alive=false;g.enemies[1].telegraph=null;assert.equal(api.threats(g).count,1,'cancelled and dead casts removed');
const frames=api.metrics.frames;g.journey.v20MapVersion=undefined;r.drawSeamlessWorld();assert.equal(api.metrics.frames,frames,'legacy chain unaffected');
g.journey.v20MapVersion=20;const snapshot=JSON.stringify(g);let calls=0;
g.enemies=Array.from({length:40},()=>enemy(.5));
const start=performance.now();for(let i=0;i<1000;i++){const d=api.threats(g);assert.equal(d.earliest.length,3);calls+=d.checked;}
const ms=performance.now()-start;assert.equal(calls,40000);
vm.runInContext(source,env);assert.equal(env.window.V20CombatVisibility,api,'idempotent');
console.log('PASS combat visibility: prop occlusion, legacy scope, return/state preservation, dynamic 4→3→1→0 overlaps, top3 timings, no world mutation. 40 casts ×1000:',ms.toFixed(1),'ms (CPU unit benchmark, not browser FPS).');

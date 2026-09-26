'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
let depth=0,draws=0,legacyChest=0,legacyShrine=0,legacyStairs=0;
const c=new Proxy({save(){depth++},restore(){assert(--depth>=0)}},{get(t,k){if(k in t)return t[k];return ()=>draws++;},set(t,k,v){t[k]=v;return true;}});
const RoutePaint={chest(){legacyChest++;return 10},shrine(){legacyShrine++;return 11}};
class Renderer{
 drawStairs(){legacyStairs++;return 12}
 drawSeamlessWorld(){
  if(this.fail)throw Error('intentional');
  RoutePaint.chest(this.ctx,this.object,0,this.locked);RoutePaint.shrine(this.ctx,this.g.journey.rooms[0].restPoint,this.used,0);this.drawStairs(-16,-16,this.open);return 13;
 }
}
const env={window:{},Renderer,RoutePaint};vm.createContext(env);const code=fs.readFileSync(path.join(__dirname,'v20-interactables.js'),'utf8');vm.runInContext(code,env);
const r=new Renderer();r.ctx=c;r.object={x:15,y:25,homeRoom:0,opened:false};r.open=true;r.g={journey:{v20MapVersion:20,current:0,rooms:[{id:0,biome:'roots',restPoint:{x:80,y:90}},{id:15,biome:'forge'}]}};
for(const biome of ['roots','bastion','forge'])for(const used of [false,true])for(const locked of [false,true]){
 r.g.journey.rooms[0].biome=biome;r.used=used;r.locked=locked;r.object.opened=used;
 const before=JSON.stringify({g:r.g,object:r.object});assert.equal(r.drawSeamlessWorld(),13);assert.equal(depth,0);assert.equal(before,JSON.stringify({g:r.g,object:r.object}));
}
assert(draws>100);assert.equal(legacyChest,0);assert.equal(legacyShrine,0);assert.equal(legacyStairs,0);
assert.equal(RoutePaint.chest(c,r.object,0,false),10);assert.equal(RoutePaint.shrine(c,{},false,0),11);
r.g.journey.v20MapVersion=19;assert.equal(r.drawSeamlessWorld(),13);assert.equal(legacyChest,2);assert.equal(legacyShrine,2);assert.equal(legacyStairs,1);
r.g.journey.v20MapVersion=20;r.open=false;r.drawSeamlessWorld();assert.equal(legacyStairs,2);
r.fail=true;assert.throws(()=>r.drawSeamlessWorld(),/intentional/);assert.equal(RoutePaint.chest(c,r.object,0,false),10);
const before=Renderer.prototype.drawSeamlessWorld;vm.runInContext(code,env);assert.equal(before,Renderer.prototype.drawSeamlessWorld);
console.log('PASS: three materials, available/locked/opened/used states, unchanged game objects, v19 fallback, closed-exit fallback, context cleanup after exception, canvas balance, idempotence.');

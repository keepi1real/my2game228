'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {createCanvas}=require('@napi-rs/canvas');
const source=fs.readFileSync(path.join(__dirname,'v20-matte-floor.js'),'utf8');
const canvas=createCanvas(160,120),c=canvas.getContext('2d');
const g=Object.freeze({journey:Object.freeze({v20MapVersion:20})});
const view=Object.freeze({x:0,y:0,w:160,h:120});
const polygon=Object.freeze([[10,10],[150,10],[150,110],[10,110]].map(Object.freeze));
let seenThis,seenArguments;
const env={window:{},Math:Object.assign(Object.create(Math),{random(){throw Error('RNG forbidden');}}),BiomeArtV3:{ground(...args){
  seenThis=this;seenArguments=args;
  c.fillStyle='#829a9c';c.fillRect(0,0,160,120);
  c.fillStyle='#263238';c.fillRect(80,0,80,120);
  return 73;
}}};
vm.createContext(env);vm.runInContext(source,env);
const pixel=(x,y)=>Array.from(c.getImageData(x,y,1,1).data);
const contrast=(a,b)=>Math.abs(a[0]-b[0])+Math.abs(a[1]-b[1])+Math.abs(a[2]-b[2]);
const originalContrast=contrast([130,154,156],[38,50,56]);
for (const biome of ['roots','bastion','forge','glass']) {
  const room=Object.freeze({biome,polygons:Object.freeze([polygon])});
  const rooms=Object.freeze([room]), corridors=Object.freeze([]);
  const before=JSON.stringify({g,rooms,corridors,view});
  c.globalAlpha=1;c.lineWidth=7;
  assert.equal(env.BiomeArtV3.ground(c,g,rooms,corridors,view,'extra'),73);
  assert.equal(seenThis,env.BiomeArtV3);assert.equal(seenArguments[5],'extra');
  assert.equal(before,JSON.stringify({g,rooms,corridors,view}));
  assert.equal(c.lineWidth,7);assert.equal(c.globalAlpha,1);
  assert.deepEqual(pixel(5,60),[130,154,156,255],'outside floor stays exact');
  const central=contrast(pixel(79,60),pixel(80,60));
  assert(central/originalContrast>.57 && central/originalContrast<.63,'centre suppresses texture contrast by 40%');
  assert(contrast(pixel(79,13),pixel(80,13))>central,'rim keeps more detail');
  // Real world draw order is ground -> telegraphs -> actors. Exact pixels prove
  // this patch adds nothing above these later layers, even with overlap.
  c.fillStyle='#ff806e';c.fillRect(55,45,45,8);
  c.fillStyle='#d4fff1';c.fillRect(72,35,12,35);
  assert.deepEqual(pixel(60,48),[255,128,110,255],'telegraph remains exact');
  assert.deepEqual(pixel(76,48),[212,255,241,255],'hero remains exact');
}
const original=env.BiomeArtV3.ground;vm.runInContext(source,env);
assert.equal(original,env.BiomeArtV3.ground,'idempotent');
for (const [version,biome,customView] of [[19,'roots',view],[20,'storm',view],[20,'roots',{x:500,y:500,w:20,h:20}]]) {
  env.BiomeArtV3.ground(c,{journey:{v20MapVersion:version}},[{biome,polygons:[polygon]}],[],customView);
  assert.equal(env.window.V20MatteFloor.metrics.rooms,0);
  assert.deepEqual(pixel(79,60),[130,154,156,255]);
}
// A failed Canvas operation must not leak the clip or any paint settings.
c.globalAlpha=.5;c.lineWidth=11;const savedAlpha=c.globalAlpha;
const throwing=new Proxy(c,{get(target,key){if(key==='createLinearGradient')return ()=>{throw Error('paint failure');};const value=target[key];return typeof value==='function'?value.bind(target):value;},set(target,key,value){target[key]=value;return true;}});
assert.throws(()=>env.BiomeArtV3.ground(throwing,g,[{biome:'roots',polygons:[polygon]}],[],view),/paint failure/);
assert.equal(c.globalAlpha,savedAlpha);assert.equal(c.lineWidth,11);
c.globalAlpha=1;c.fillStyle='#ff0000';c.fillRect(0,0,3,3);
assert.deepEqual(pixel(1,1),[255,0,0,255],'clip restored after exception');
console.log('PASS matte floor: four materials, pixel-measured 40% central contrast reduction, exact hero/telegraph pixels, room clipping, culling, legacy exclusion, state/RNG safety, argument/return preservation, idempotence and exception restore.');

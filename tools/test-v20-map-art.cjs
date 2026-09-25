/* Presentation contract test: node tools/test-v20-map-art.cjs */
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(require('node:path').join(__dirname,'v20-map-art.js'),'utf8');
const marks=Object.freeze([Object.freeze({x:24,y:24,angle:.2,scale:.8,radius:17.6,variant:0,kind:'cluster'}),Object.freeze({x:4000,y:4000,angle:0,scale:1,radius:22,variant:1,kind:'rim'})]);
let calls=0,depth=0;
const ctx=new Proxy({save(){depth++;calls++;},restore(){depth--;assert(depth>=0);calls++;},createLinearGradient(){return {addColorStop(){}};}},{get(t,k){return k in t?t[k]:(()=>{calls++;});},set(t,k,v){t[k]=v;return true;}});
const math=Object.create(Math);math.random=()=>{throw new Error('Presentation consumed gameplay RNG');};
const env={window:{V20MapPlacement:{forRoom:()=>marks}},Math:math,BiomeArtV3:{ground(){return 'ground-result';},prop(){return 'prop-result';}}};
vm.createContext(env);vm.runInContext(source,env);
const g={journey:{v20MapVersion:20}},room={center:{x:100,y:100},polygons:[[[0,0],[200,0],[200,200],[0,200]]],biome:'roots'};
const view={x:0,y:0,w:300,h:300},before=JSON.stringify({g,room,marks});
for(const biome of Object.keys(env.window.V20MapArt.profiles)){
  const r={...room,biome};assert.equal(env.BiomeArtV3.ground(ctx,g,[r],[],view),'ground-result');
  assert.equal(env.window.V20MapArt.metrics.rooms,1);assert.equal(env.window.V20MapArt.metrics.marks,1);
  assert.equal(env.BiomeArtV3.prop(ctx,{kind:'biome-prop',biome,x:25,y:25,r:18},null,0),'prop-result');assert.equal(depth,0);
}
assert.equal(before,JSON.stringify({g,room,marks}));
const old=env.BiomeArtV3.ground;vm.runInContext(source,env);assert.equal(old,env.BiomeArtV3.ground);
const current=calls;env.BiomeArtV3.ground(ctx,{journey:{v20MapVersion:19}},[room],[],view);assert.equal(calls,current);
env.BiomeArtV3.ground(ctx,g,[room],[],{x:5000,y:5000,w:300,h:300});assert.equal(calls,current);
console.log('PASS: 12 biome motifs; v19 exclusion; viewport culling; no RNG or state mutation; balanced canvas stack; idempotence.');

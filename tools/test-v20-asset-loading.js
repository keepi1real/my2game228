'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const code=fs.readFileSync(path.join(__dirname,'v20-asset-loading.js'),'utf8');
function setup() {
  const requests=[];
  class Image {constructor(){this.complete=false;this.naturalWidth=0;}set src(v){this.url=v;requests.push(v);}get src(){return this.url||'';}}
  class Game {
    startSeamlessJourney(seed,hero,level){this.journey={levelId:level,seamless:true};return 17;}
    resumeSeamlessJourney(){this.journey={levelId:'glass',seamless:true};return true;}
    descendSeamlessFloor(){this.journey={levelId:'glass',seamless:true};return 18;}
    makeJourneyEnemy(type){return {type};}
  }
  const env={window:{},Image,Game,BiomeArtV3:{ground(){return 23;}},loadImage(src){const image=new Image();image.src=src;return image;}};
  vm.createContext(env);vm.runInContext(code,env);
  const crab=env.loadImage('../assets/v20/seam-crab.png'),floor=env.loadImage('../assets/v20/ceramic-observatory-floor.png');
  return {env,requests,g:new Game(),crab,floor};
}
const h=setup();assert.equal(h.requests.length,0,'menu requests zero new PNGs');
assert.equal(h.env.loadImage('../assets/v20/seam-crab.png'),h.crab,'stable image reference');
h.env.loadImage('legacy.png');assert.deepEqual(h.requests,['legacy.png'],'unrelated loader unchanged');
assert.equal(h.g.startSeamlessJourney(1,'arator','undermountain'),17);assert.equal(h.requests.length,1);
assert.equal(h.env.BiomeArtV3.ground(null,h.g,[{biome:'roots'}]),23);
assert.equal(h.requests.length,1,'first non-Glass fight leaves art unloaded');
assert.equal(h.env.BiomeArtV3.ground(null,h.g,[{biome:'glass'}]),23);
assert.equal(h.requests.at(-1),'../assets/v20/ceramic-observatory-floor.png');
for(let i=0;i<100;i++)h.env.BiomeArtV3.ground(null,h.g,[{biome:'glass'}]);assert.equal(h.requests.length,2,'one floor request');
assert.equal(h.g.startSeamlessJourney(1,'arator','glass'),17);assert.equal(h.requests.at(-1),'../assets/v20/seam-crab.png');
h.crab.onerror();h.floor.onerror();
for(let i=0;i<100;i++)h.env.BiomeArtV3.ground(null,h.g,[{}]);
assert.equal(h.requests.length,3,'failed requests do not loop');assert(!h.crab.naturalWidth&&!h.floor.naturalWidth,'old ready guard remains false');
for(const method of ['resumeSeamlessJourney','descendSeamlessFloor']){const next=setup();next.g[method]();assert.deepEqual(next.requests,['../assets/v20/seam-crab.png']);}
const spawn=setup();assert.equal(spawn.g.makeJourneyEnemy('seamcrab').type,'seamcrab');assert.equal(spawn.requests.length,1);
const idle=setup();idle.env.BiomeArtV3.ground(null,{journey:null},[]);assert.equal(idle.requests.length,0);
vm.runInContext(code,h.env);assert.equal(h.requests.length,3,'idempotent installation');
console.log('PASS lazy PNGs: zero menu requests; demand floor; Glass start/resume/descent/crab; unchanged loader/returns; missing images; no retries.');

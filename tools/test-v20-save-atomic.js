'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'v20-save-atomic.js'),'utf8');
const key='undermountain-biomes-v20-preview',legacy='undermountain-biomes-v3';
function setup(failAt=0) {
  let writes=0;const persisted=new Map([[key,'{"old":true}'],[legacy,'legacy checkpoint']]);
  class Storage {
    getItem(k){return persisted.get(k)??null;}
    setItem(k,v){if(k===key&&++writes===failAt)throw Error('QuotaExceededError');persisted.set(k,String(v));}
  }
  const localStorage=new Storage();
  class Game {
    constructor(){this.journey={seamless:true,v20MapVersion:20,seed:42,saveTimer:5};this.meta=false;}
    saveJourney(){
      if(this.meta)localStorage.setItem('meta','progress');
      localStorage.setItem(key,this.dead?'null':JSON.stringify({version:4,seed:42,player:{x:44,y:55}}));
      this.journey.saveTimer=0;
      const data=JSON.parse(localStorage.getItem(key));
      if(data){data.mapVersion=20;localStorage.setItem(key,JSON.stringify(data));}
      if(this.explode)throw Error('inner failed');return 7;
    }
  }
  const env={window:{},Storage,localStorage,Game,SeamlessFloor:{key}};vm.createContext(env);vm.runInContext(source,env);
  return {env,g:new Game(),persisted,writes:()=>writes};
}
// The old two-write algorithm would fail on write 2. Atomic save never calls it.
const h=setup(2);assert.equal(h.g.saveJourney(),7);assert.equal(h.writes(),1);
const saved=JSON.parse(h.persisted.get(key));assert.equal(saved.mapVersion,20);assert.equal(saved.player.x,44);assert.equal(h.persisted.get(legacy),'legacy checkpoint');
const prior=h.persisted.get(key);h.g.saveJourney();assert.equal(h.persisted.get(key),prior,'quota leaves previous checkpoint intact');assert.equal(h.g.journey.noticeTime,5);
const denied=setup(1);denied.g.saveJourney();assert.equal(denied.persisted.get(key),'{"old":true}');assert.equal(denied.g.journey.saveTimer,5);
const dead=setup();dead.g.dead=true;dead.g.saveJourney();assert.equal(dead.persisted.get(key),'null');assert.equal(dead.writes(),1);
const crash=setup();crash.g.explode=true;assert.throws(()=>crash.g.saveJourney(),/inner failed/);assert.equal(crash.writes(),0);assert.equal(crash.persisted.get(key),'{"old":true}');
crash.g.explode=false;crash.g.saveJourney();assert.equal(crash.writes(),1,'transaction scope restored after error');
const meta=setup();meta.g.meta=true;meta.g.saveJourney();assert.equal(meta.persisted.get('meta'),'progress');assert.equal(meta.writes(),1);
const methods=meta.env.Storage.prototype.setItem;vm.runInContext(source,meta.env);assert.equal(meta.env.Storage.prototype.setItem,methods,'idempotent');
meta.env.localStorage.setItem(key,'outside');assert.equal(meta.persisted.get(key),'outside','writes outside save remain native');
console.log('PASS atomic checkpoint: staged read/write, one commit, second-write failure removed, quota preserves old data, death tombstone, thrown save, meta/legacy isolation, idempotence.');

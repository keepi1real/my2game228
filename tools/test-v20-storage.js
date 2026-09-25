'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const code = fs.readFileSync(path.join(__dirname, 'v20-storage.js'), 'utf8');
const oldKey = 'undermountain-biomes-v3', newKey = 'undermountain-biomes-v20-preview';
const metaKey = 'shadows-undermountain-save-v1';
function run(entries, deny) {
  const data = new Map(entries), writes = [];
  const env = {window:{}, SeamlessFloor:{key:oldKey}, localStorage:{
    getItem(key) { if(deny==='read')throw Error('denied'); return data.get(key) ?? null; },
    setItem(key,value) { if(deny==='write')throw Error('quota'); writes.push(key);data.set(key,value); }
  }};
  vm.createContext(env);vm.runInContext(code,env);
  assert.equal(env.SeamlessFloor.key,newKey);
  assert(!writes.includes(oldKey));assert(!writes.includes(metaKey));
  return {env,data,writes};
}
const legacy = JSON.stringify({version:4,seed:42,heroId:'arator'});
const first = run([[oldKey,legacy],[metaKey,'meta unchanged']]);
assert.equal(first.data.get(newKey),legacy);
assert.equal(first.data.get(oldKey),legacy);
assert.equal(first.data.get(metaKey),'meta unchanged');
assert.equal(first.env.window.V20Storage.migration,'copied');
// Save and death use the same dynamically resolved property as the real game.
first.env.localStorage.setItem(first.env.SeamlessFloor.key,'v20 checkpoint');
first.env.localStorage.setItem(first.env.SeamlessFloor.key,'null');
assert.equal(first.data.get(oldKey),legacy);
vm.runInContext(code,first.env);assert.equal(first.data.get(newKey),'null');
for(const existing of ['null','v20 checkpoint','corrupt checkpoint']) {
  const next=run([[oldKey,legacy],[newKey,existing]]);
  assert.equal(next.data.get(newKey),existing);assert.equal(next.writes.length,0);
}
assert.equal(run([]).data.has(newKey),false);
for(const deny of ['read','write']) {
  const blocked=run([[oldKey,legacy]],deny);
  assert.equal(blocked.data.get(oldKey),legacy);
  assert.equal(blocked.env.window.V20Storage.migration,'storage-unavailable');
}
console.log('PASS v20 checkpoint isolation: migration, legacy/meta integrity, existing preview, tombstone, idempotence, denied storage.');

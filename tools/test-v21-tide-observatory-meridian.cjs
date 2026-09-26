'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),vm=require('node:vm'),zlib=require('node:zlib'),assert=require('node:assert/strict');
const {harness}=require('./test-room-visual');
const {extendChapter}=require('./v20-chapter-extension.cjs');
(async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'v21-meridian-'));
 try{
  const root=path.resolve(__dirname,'..'),file=path.join(dir,'game.html');
  fs.writeFileSync(file,extendChapter(zlib.gunzipSync(fs.readFileSync(path.join(root,'adventure-v19-play.html.gz'))).toString(),JSON.parse(fs.readFileSync(path.join(__dirname,'v21-tide-observatory-level.json')))));
  const h=await harness({bundle:file}),g=h.g;h.env.document.head={appendChild(){}};
  for(const patch of JSON.parse(fs.readFileSync(path.join(__dirname,'v20-manifest.json'))).patches)
    vm.runInContext(fs.readFileSync(path.join(__dirname,patch.file),'utf8'),h.env,{filename:patch.file});
  function enter(id){
    g.startSeamlessJourney(42,'arator',id,'journey');const r=g.journey.rooms[15];
    Object.assign(g.player,{x:r.center.x,y:r.center.y+95});g.updateSeamlessZones();
    return g.enemies.find(v=>v.alive&&v.isBoss&&v.homeRoom===15);
  }
  let e=enter('tideobservatory');assert(e);
  e.abilityTimers.undertow=9;e.abilityTimers.surge=9;e.abilityTimers.meridian=0;
  assert(g.updateBossAbilities(e,.016,180,true));assert.equal(e.telegraph.kind,'solar-spokes');
  assert(e.telegraph.v21Meridian);assert.equal(e.telegraph.shapes.length,2);
  assert(vm.runInContext('RootCombat.validState(game.enemies.find(e=>e.isBoss).rootState || RootCombat.snapshot(game.enemies.find(e=>e.isBoss)))',h.env));
  const warning=JSON.stringify(e.telegraph),timer=e.abilityTimers.meridian;
  g.saveJourney();assert(g.resumeSeamlessJourney());e=g.enemies.find(v=>v.alive&&v.isBoss&&v.homeRoom===15);
  assert.equal(JSON.stringify(e.telegraph),warning);assert.equal(e.abilityTimers.meridian,timer);
  // The warning and the hit test must describe the same lanes.
  const s=e.telegraph.shapes[0];Object.assign(g.player,{x:s.x+75,y:s.y+75,invulnTime:0});
  assert(!vm.runInContext('game.enemies.find(e=>e.isBoss).telegraph.shapes.some(s=>RootCombat.contains(s,game.player))',h.env));
  const safeHp=g.player.hp;g.resolveTelegraph(e);assert.equal(g.player.hp,safeHp,'outside the lanes is safe');
  e.telegraph=null;e.rootRecovery=0;e.hp=e.maxHp*.45;e.abilityTimers.undertow=9;e.abilityTimers.surge=9;e.abilityTimers.meridian=0;
  assert(g.updateBossAbilities(e,.016,180,true));assert.equal(e.phase,2);assert.equal(e.telegraph.shapes.length,3);
  g.saveJourney();assert(g.resumeSeamlessJourney());e=g.enemies.find(v=>v.alive&&v.isBoss&&v.homeRoom===15);
  assert(e.telegraph.v21Meridian);assert.equal(e.telegraph.shapes.length,3);
  Object.assign(g.player,{x:e.telegraph.shapes[0].x,y:e.telegraph.shapes[0].y,invulnTime:0});
  const hitHp=g.player.hp;g.resolveTelegraph(e);assert(g.player.hp<hitHp,'the center of the announced lanes deals damage');
  e=enter('tide');e.abilityTimers.undertow=9;e.abilityTimers.surge=9;
  assert.equal(g.updateBossAbilities(e,.016,180,true),false);assert.equal(e.abilityTimers.meridian,undefined);
  console.log('PASS Observatory Meridian: two/three announced lanes, saved phases/timer, original Tidewarden unaffected.');
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});

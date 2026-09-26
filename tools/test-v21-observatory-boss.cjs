'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),vm=require('node:vm'),zlib=require('node:zlib'),assert=require('node:assert/strict');
const {harness}=require('./test-room-visual');
const {extendChapter}=require('./v20-chapter-extension.cjs');
(async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'v21-boss-'));
 try{
  const root=path.resolve(__dirname,'..'),file=path.join(dir,'game.html'),level=JSON.parse(fs.readFileSync(path.join(__dirname,'v21-tide-observatory-level.json')));
  fs.writeFileSync(file,extendChapter(zlib.gunzipSync(fs.readFileSync(path.join(root,'adventure-v19-play.html.gz'))).toString(),level));
  const h=await harness({bundle:file}),g=h.g;h.env.document.head={appendChild(){}};
  for(const p of JSON.parse(fs.readFileSync(path.join(__dirname,'v20-manifest.json'))).patches)vm.runInContext(fs.readFileSync(path.join(__dirname,p.file),'utf8'),h.env,{filename:p.file});
  function enter(id,difficulty='journey'){
   g.startSeamlessJourney(42,'arator',id,difficulty);const r=g.journey.rooms[15];Object.assign(g.player,{x:r.center.x,y:r.center.y+95});g.updateSeamlessZones();
   assert.equal(g.journey.current,15);assert(r.active);const bosses=g.enemies.filter(e=>e.isBoss&&e.homeRoom===15&&e.alive);assert.equal(bosses.length,1);return bosses[0];
  }
  const canonical=vm.runInContext('JSON.stringify(BOSSES.tidewarden)',h.env);
  let e;for(const [difficulty,cadence] of [['journey',1],['veteran',.91],['nightmare',.83]]){
  e=enter('tideobservatory',difficulty);assert.equal(e.type,'tidewarden');assert.equal(e.def.name,level.bossName);assert.equal(e.def.color,level.bossDef.color);assert.equal(e.def.abilities.undertow,7.5*cadence);assert.equal(e.def.abilities.surge,5.8*cadence);assert(!g.map.circleBlocked(e.x,e.y,e.r));
  // Actual ability methods produce fixed, valid warning geometry in both phases.
  e.rootRecovery=0;e.stun=0;e.abilityTimers.undertow=0;e.abilityTimers.surge=9;
  assert(g.updateBossAbilities(e,.01,180,true));assert.equal(e.telegraph.kind,'tidal-ring');assert.equal(e.telegraph.shapes[0].r,235);
  const warning=JSON.stringify(e.telegraph),hp=e.hp;g.saveJourney();assert(g.resumeSeamlessJourney(),'resume during boss ring');
  e=g.enemies.find(e=>e.isBoss&&e.homeRoom===15);assert.equal(e.def.name,level.bossName);assert.equal(e.def.color,level.bossDef.color);assert.equal(e.hp,hp);assert.equal(JSON.stringify(e.telegraph),warning);assert.equal(e.def.abilities.undertow,7.5*cadence);
  e.telegraph=null;e.rootRecovery=0;e.stun=0;e.hp=e.maxHp*.45;e.abilityTimers.undertow=9;e.abilityTimers.surge=0;
  assert(g.updateBossAbilities(e,.01,180,true));assert.equal(e.phase,2);assert.equal(e.telegraph.kind,'tidal-fan');assert.equal(e.telegraph.shapes.length,3);
  // Tick the real encounter director at the health threshold: this exercises
  // the new chapter roster lookup that ordinary spawn tests do not reach.
  vm.runInContext('EncounterDirector.update(game,.01)',h.env);
  assert.equal(g.journey.rooms[15].encounter.bossPhases,1);assert(g.journey.rooms[15].encounter.queued.length>0);
  const phaseWarning=JSON.stringify(e.telegraph);g.saveJourney();assert(g.resumeSeamlessJourney(),'resume during phase-two fan and summon queue');
  e=g.enemies.find(e=>e.isBoss&&e.homeRoom===15);assert.equal(e.def.name,level.bossName);assert.equal(e.phase,2);assert.equal(JSON.stringify(e.telegraph),phaseWarning);assert.equal(g.journey.rooms[15].encounter.bossPhases,1);
  vm.runInContext('EncounterDirector.update(game,2)',h.env);vm.runInContext('EncounterDirector.update(game,2)',h.env);assert(g.enemies.filter(e=>e.alive&&e.homeRoom===15).length>3);
  if(difficulty!=='journey'){
   for(const guard of g.enemies.filter(v=>v.alive&&v.homeRoom===15&&!v.isBoss))g.hitEnemy(guard,999999,{});
   e.hp=e.maxHp*.2;vm.runInContext('EncounterDirector.update(game,.01)',h.env);assert.equal(g.journey.rooms[15].encounter.bossPhases,2);
  }
  // Finish once, then reload and tick: loot/rewards cannot be duplicated.
  for(const enemy of g.enemies.filter(v=>v.alive&&v.homeRoom===15))g.hitEnemy(enemy,999999,{});
  vm.runInContext('EncounterDirector.update(game,2)',h.env);g.updateSeamlessZones();
  assert(g.journey.rooms[15].cleared,'boss room clears');
  g.saveJourney();const loot=JSON.stringify(g.pickups),gold=g.player.gold,stats=JSON.stringify(g.runStats);
  assert(g.resumeSeamlessJourney(),'resume completed boss room');assert(g.journey.rooms[15].cleared);vm.runInContext('EncounterDirector.update(game,2)',h.env);g.updateSeamlessZones();
  assert.deepEqual(JSON.parse(JSON.stringify(g.pickups)),JSON.parse(loot),'no duplicated loot after resume');assert.equal(g.player.gold,gold);assert.equal(JSON.stringify(g.runStats),stats,'no second boss reward');assert(!g.enemies.some(v=>v.alive&&v.isBoss&&v.homeRoom===15));
  }
  // The original tidal boss remains its original definition and abilities.
  e=enter('tide');assert.equal(e.def.name,'Хранитель прилива');assert.equal(e.def.color,'#a5ddd1');assert.equal(vm.runInContext('JSON.stringify(BOSSES.tidewarden)',h.env),canonical);g.saveJourney();assert(g.resumeSeamlessJourney());e=g.enemies.find(e=>e.isBoss&&e.homeRoom===15);assert.equal(e.def.name,'Хранитель прилива');
  console.log('PASS observatory boss spawn/definition, ring attack, phase-two fan, mid-attack saves in all three difficulties, no duplicate rewards, summoned reinforcements, original tidewarden unchanged.');
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});

'use strict';
const fs=require('node:fs'),vm=require('node:vm'),zlib=require('node:zlib'),assert=require('node:assert/strict'),path=require('node:path'),os=require('node:os');
const {harness}=require('./test-room-visual');
(async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'v20-wave-'));
  try {
    const file=path.join(dir,'base.html');fs.writeFileSync(file,zlib.gunzipSync(fs.readFileSync(path.join(__dirname,'../adventure-v19-play.html.gz'))));
    const h=await harness({bundle:file}),g=h.g;
    for(const name of ['v20-storage','v20-maps','v20-enemies','v20-save-atomic','v20-wave-recovery'])
      vm.runInContext(fs.readFileSync(path.join(__dirname,name+'.js'),'utf8'),h.env);
    const director=vm.runInContext('EncounterDirector',h.env),key=vm.runInContext('SeamlessFloor.key',h.env);
    g.startSeamlessJourney(77,'arator','glass','journey');
    const room=g.journey.rooms.find(r=>!r.cleared&&r.role!=='boss');assert(room);
    for(const r of g.journey.rooms)r.active=false;
    room.active=true;room.visited=true;g.journey.current=room.id;
    g.player.x=room.center.x;g.player.y=room.center.y;g.enemies=[];
    room.encounter={wave:director.plan(g.journey,room).length,delay:0,queued:['goblin'],spawns:[],bossPhases:0};
    const id=room.id,geometry=JSON.stringify(g.journey.rooms.map(r=>[r.polygons,r.obstacles]));
    let diagnostics=0;h.env.console={...console,warn:()=>diagnostics++};
    for(let n=0;n<3;n++){
      g.map.circleBlocked=()=>true;
      for(let i=0;i<80;i++)director.update(g,.1);
      g.saveJourney();assert(g.resumeSeamlessJourney());
      assert.equal(JSON.stringify(g.journey.rooms.map(r=>[r.polygons,r.obstacles])),geometry);
      assert(g.journey.rooms[id].encounter.v20SpawnBlockedSeconds>=7.9*(n+1));
    }
    g.map.circleBlocked=()=>true;
    const gold=g.player.gold,xp=g.player.xp;
    for(let i=0;i<70;i++)director.update(g,.1);
    assert.equal(diagnostics,1);assert(!director.pending(g,g.journey.rooms[id]));
    assert.equal(g.enemies.length,0);assert.equal(g.player.gold,gold);assert.equal(g.player.xp,xp);
    assert.equal(JSON.parse(h.storage.get(key)).rooms[id].encounter.v20SpawnRecovery,'blocked-spawns');
    g.updateSeamlessZones();assert(g.journey.rooms[id].cleared);
    const settled=JSON.stringify({gold:g.player.gold,xp:g.player.xp,rooms:g.journey.rooms});
    for(let i=0;i<20;i++){director.update(g,.1);g.updateSeamlessZones();}
    assert.equal(JSON.stringify({gold:g.player.gold,xp:g.player.xp,rooms:g.journey.rooms}),settled);
    g.saveJourney();assert(g.resumeSeamlessJourney());assert(g.journey.rooms[id].cleared);
    assert(!director.pending(g,g.journey.rooms[id]));assert.equal(diagnostics,1);
    console.log('PASS actual Game: three save/resume cycles preserve timer and geometry, abort saved, normal room clear once, no extra gold/XP/enemy, terminal restore.');
  } finally {fs.rmSync(dir,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});

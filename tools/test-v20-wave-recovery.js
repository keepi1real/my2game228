'use strict';
const fs = require('node:fs'), path = require('node:path'), zlib = require('node:zlib');
const vm = require('node:vm'), assert = require('node:assert/strict');
const html = zlib.gunzipSync(fs.readFileSync(path.join(__dirname, '../adventure-v19-play.html.gz'))).toString();
const start = html.indexOf('const EncounterDirector=');
const end = html.indexOf('const encounterMake=', start);
assert(start > 0 && end > start, 'Use the real shipped director, including its private point()');
const patch = fs.readFileSync(path.join(__dirname, 'v20-wave-recovery.js'), 'utf8');
function scene(patched = true) {
  const warnings = [], checkpoints = [], made = [];
  const env = {console:{warn:(...args)=>warnings.push(args)},
    MONSTERS:{goblin:{size:15},warg:{size:15},archer:{size:15}}, BOSSES:{},
    AdventureRun:{enabled:()=>false}, ExpeditionLevels:{get:()=>({})},
    RoomVisualArt:{inside:(x,y,p)=>x>=p.x&&x<=p.x+p.w&&y>=p.y&&y<=p.y+p.h},
    dist:(x,y,a,b)=>Math.hypot(x-a,y-b), EliteTrials:{apply:()=>{}}, ActorMotion:{add:()=>{}}};
  vm.createContext(env);vm.runInContext(html.slice(start,end),env);
  if (patched) vm.runInContext(patch,env);
  const director = vm.runInContext('EncounterDirector',env);
  const room = {id:0,role:'combat',depth:3,active:true,cleared:false,center:{x:500,y:500},polygons:[{x:150,y:300,w:700,h:400}],
    encounter:{wave:2,delay:0,queued:['goblin'],spawns:[],bossPhases:0}};
  let blocked = true;
  const g = {state:'run',journey:{seamless:true,v20MapVersion:20,layoutVersion:16,difficulty:'veteran',current:0,rooms:[room],levelId:'undermountain',seed:1},
    player:{x:500,y:500},enemies:[],map:{circleBlocked:()=>blocked},
    makeJourneyEnemy:(type,x,y,boss,homeRoom)=>{const e={type,x,y,r:15,alive:true,isBoss:boss,homeRoom};made.push(e);return e;},
    saveJourney:()=>checkpoints.push(JSON.parse(JSON.stringify(g.journey)))};
  const tick = (seconds,dt=.1)=>{for(let n=0;n<Math.round(seconds/dt);n++)director.update(g,dt);};
  return {g,room,director,tick,warnings,checkpoints,made,unblock:()=>{blocked=false;},block:()=>{blocked=true;}};
}
// Repro the old code indefinitely retaining the head of queued when point() is null.
{
  const h=scene(false);h.tick(120);assert(h.director.pending(h.g,h.room));
  assert.equal(h.room.encounter.queued.length,1);assert.equal(h.made.length,0);
  console.log('REPRO v19: all candidates blocked for 120s; queued=1, pending=true.');
}
// A location opens just before the deadline: placement is progress, then exactly
// one telegraphed spawn with the original player/wall separation checks.
{
  const h=scene();h.tick(29);h.unblock();h.tick(3);
  assert.equal(h.made.length,1);assert.equal(h.warnings.length,0);
  const e=h.made[0];assert(Math.hypot(e.x-h.g.player.x,e.y-h.g.player.y)>=185);
  assert(!h.g.map.circleBlocked(e.x,e.y,e.r));assert.equal(h.room.encounter.spawns.length,0);
  h.tick(40);assert.equal(h.made.length,1);assert.equal(h.warnings.length,0);
}
// Permanent blockage retires remaining waves once. No enemy, XP, gold, or reward
// hooks are called; pending=false hands completion to the existing clear path.
{
  const h=scene();h.room.encounter.wave=1;h.tick(31);
  assert(!h.director.pending(h.g,h.room));assert.equal(h.warnings.length,1);
  assert.equal(h.checkpoints.length,1);assert.equal(h.made.length,0);
  assert.equal(h.checkpoints[0].rooms[0].encounter.v20SpawnRecovery,'blocked-spawns');
  h.tick(100);assert.equal(h.warnings.length,1);assert.equal(h.checkpoints.length,1);
}
// All legal candidates occupied by actors in an adjacent room also return null.
// Removing those blockers before the deadline must preserve exactly one spawn.
{
  const h=scene();h.unblock();
  for(let y=-168;y<=168;y+=56)for(let x=-336;x<=336;x+=56)
    h.g.enemies.push({alive:true,homeRoom:1,x:500+x,y:500+y,r:15});
  h.tick(20);assert.equal(h.made.length,0);assert.equal(h.room.encounter.queued.length,1);
  h.g.enemies=[];h.tick(3);assert.equal(h.made.length,1);assert.equal(h.warnings.length,0);
}
// A warning location can become blocked after scheduling, leaving spawns (not
// queued) stuck in the original .3s retry loop. Cover that distinct failure.
{
  const h=scene();h.unblock();h.tick(.1);assert.equal(h.room.encounter.spawns.length,1);
  h.block();h.tick(31);assert(!h.director.pending(h.g,h.room));assert.equal(h.made.length,0);
  assert.equal(h.warnings.length,1);
}
// Any living defender, including population cap, prevents cancellation.
for (const count of [1,8]) {
  const h=scene();h.g.enemies=Array.from({length:count},()=>({alive:true,homeRoom:0,x:500,y:500,r:15}));
  h.tick(90);assert.equal(h.warnings.length,0);assert.equal(h.room.encounter.queued.length,1);
  h.g.enemies=[];h.tick(31);assert.equal(h.warnings.length,1);
}
// Pauses, a different room, tours and legacy journeys cannot accrue recovery time.
for (const mode of ['pause','elsewhere','inactive','tour','legacy']) {
  const h=scene();
  if(mode==='pause')h.g.state='paused';if(mode==='elsewhere')h.g.journey.current=1;
  if(mode==='inactive')h.room.active=false;if(mode==='tour')h.g.worldTour=true;
  if(mode==='legacy')delete h.g.journey.v20MapVersion;
  h.tick(90);assert.equal(h.warnings.length,0);assert.equal(h.room.encounter.queued.length,1);
}
// The encounter is the checkpoint payload. Three JSON restores keep the timeout;
// malformed optional fields fail the same validator as core encounter fields.
{
  const h=scene();
  for(let i=0;i<3;i++){
    h.tick(8);const copy=JSON.parse(JSON.stringify(h.g.journey));
    h.director.validate(copy);h.room.encounter=copy.rooms[0].encounter;
  }
  assert(h.room.encounter.v20SpawnBlockedSeconds>23);h.tick(7);
  assert.equal(h.warnings.length,1);assert(!h.director.pending(h.g,h.room));
  for(const [key,value] of [['v20SpawnBlockedSeconds',-1],['v20SpawnBlockedSeconds',31],['v20SpawnBlockedSeconds','4'],['v20SpawnCancelled',0],['v20SpawnRecovery','other']]){
    const data=JSON.parse(JSON.stringify(h.g.journey));data.rooms[0].encounter[key]=value;
    assert.throws(()=>h.director.validate(data),/Invalid wave recovery/);
  }
}
console.log('PASS recovery: temporary/permanent blocks, delayed spawn, living enemies/cap, pause/room/tour/legacy, 3 restores, validation, one diagnostic/save, no forced spawn.');

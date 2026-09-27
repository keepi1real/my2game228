'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const harnessPath=process.env.V27_HARNESS||(fs.existsSync(path.join(__dirname,'v27-harness.cjs'))?path.join(__dirname,'v27-harness.cjs'):'/workspace/scratch/513c16890429/game-repo/tools/v27-harness.cjs');
const {boot}=require(harnessPath);
(async()=>{
 const root=path.resolve(__dirname,'..'),h=await boot({team:'quarry',root}),{RootCombat}=h.a,g=h.g;
 function enter(id){const r=g.journey.rooms[id];g.player.x=r.center.x;g.player.y=r.center.y+100;g.updateSeamlessZones();g.player.invulnTime=0;return r;}
 function ready(e){e.stun=0;e.rootRecovery=0;e.arrival=0;e.telegraph=null;e.charge=null;e.state='chase';e.attackTimer=10;}
 function resumed(e){const id=RootCombat.id(e),before=JSON.stringify(e.telegraph);assert(RootCombat.validState(RootCombat.snapshot(e)));g.saveJourney();assert(g.resumeSeamlessJourney());const saved=g.enemies.find(v=>v.rvId===id);assert(saved);assert.equal(JSON.stringify(saved.telegraph),before);return saved;}
 enter(1);let e=g.enemies.find(v=>v.type==='quarry_cleaver'&&v.homeRoom===1);assert(e);ready(e);e.windupDir={x:1,y:0};RootCombat.basic(g,e);assert.equal(e.telegraph.kind,'sweep');assert(e.telegraph.total>=.85);e=resumed(e);
 // An inactive room cannot wind up an anti-kite attack before native room gates.
 ready(e);e.abilityTimers.quarryLunge=0;g.journey.rooms[e.homeRoom].active=false;const timer=e.abilityTimers.quarryLunge;g.updateEnemy(e,.1);assert.equal(e.abilityTimers.quarryLunge,timer);assert.equal(e.telegraph,null);g.journey.rooms[e.homeRoom].active=true;
 // Fixed ranged warning remains in place after the hero changes position.
 let s=g.enemies.find(v=>v.type==='quarry_scorcher');enter(s.homeRoom);ready(s);
 const r=g.journey.rooms[s.homeRoom];s.x=r.center.x-100;s.y=r.center.y;g.player.x=r.center.x+80;g.player.y=r.center.y;s.windupDir={x:1,y:0};
 RootCombat.basic(g,s);assert.equal(s.telegraph.kind,'bolts');const mark={...s.telegraph.shapes[0]};g.player.y+=110;assert.equal(s.telegraph.shapes[0].y,mark.y);s=resumed(s);
 const oldReach=g.canReach;g.canReach=()=>false;ready(s);RootCombat.basic(g,s);assert.equal(s.telegraph,null,'blocked caster cancels, never falls back to spores');g.canReach=oldReach;
 // Boss phase transition and lane pattern use checkpoint-supported state.
 enter(15);let b=g.enemies.find(v=>v.isBoss&&v.homeRoom===15);ready(b);const br=g.journey.rooms[15];b.x=br.center.x-160;b.y=br.center.y;g.player.x=br.center.x+80;g.player.y=br.center.y;b.hp=b.maxHp*.49;b.phase=1;
 assert(g.updateBossAbilities(b,.01,240,true));assert.equal(b.phase,2);ready(b);b.abilityTimers.cut=0;b.abilityTimers.mark=10;
 assert(g.updateBossAbilities(b,.01,240,true));assert.equal(b.telegraph.kind,'lunge');assert.equal(b.telegraph.shapes.length,3);b=resumed(b);
 const pos={x:b.x,y:b.y};g.resolveTelegraph(b);assert(b.charge);const hp=g.player.hp;g.updateEnemy(b,.1);assert(Math.hypot(b.x-pos.x,b.y-pos.y)>20);assert(!g.map.circleBlocked(b.x,b.y,b.r));assert.equal(g.player.hp,hp,'charge cannot damage twice after lane impact');
 ready(b);b.abilityTimers.cut=10;b.abilityTimers.mark=0;g.player.x=b.x+250;g.player.y=b.y;assert(g.updateBossAbilities(b,.01,250,true));assert(b.telegraph.quarryCast);b=resumed(b);
 const cx=g.player.x,cy=g.player.y;g.camera.x=cx-512;g.camera.y=cy-320;g.map.updateVisibility(Math.floor(cx/32),Math.floor(cy/32));g.renderer.render();await h.settleImages();h.shot(path.join(root,'assets/v27/quarry/qa-boss-warning.png'));
 // Existing chapter actors still delegate to their original definitions.
 g.startSeamlessJourney(42,'arator','tide','journey');const native=g.enemies.find(v=>v.def.rootvault&&!v.isBoss);if(native){ready(native);native.windupDir={x:1,y:0};RootCombat.basic(g,native);assert(!native.telegraph?.quarry);}
 console.log('PASS quarry real basic/boss mechanics, inactive-room gate, blocked LOS cancel, fixed mark, phase2, collision-aware charge, no double damage, 4 mid-telegraph resumes, old chapter delegation');
})().catch(e=>{console.error(e);process.exitCode=1;});

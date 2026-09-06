'use strict';
const assert=require('assert'),vm=require('vm'),{harness}=require('./test-room-visual'),{buttons}=require('./test-native-buttons');
(async()=>{
  const ui=buttons(),h=await harness({ui,bundle:process.argv[2]}),g=h.g,{SeamlessFloor:S,ExpeditionLevels:L,RootCombat:C,BestiaryArt:Art,RunRelics:Relics,AdventureProgress:A,R}=vm.runInContext('({SeamlessFloor,ExpeditionLevels,RootCombat,BestiaryArt,RunRelics,AdventureProgress,R})',h.env),original=JSON.stringify(h.a.Save.data);
  const starts=new Set(),shapes=new Set();
  for(const level of Object.keys(L.levels))for(let seed=1;seed<=(['amber','glass'].includes(level)?8:1);seed++){
    g.toMenu();g.startSeamlessJourney(seed,'arator',level);const j=g.journey,m=g.map,p=S.spawn(j),flow=m.flowField(Math.floor(p.x/32),Math.floor(p.y/32));starts.add(j.start);assert.equal(j.rooms.length,16);
    for(const r of j.rooms){if(['amber','glass'].includes(level))shapes.add(r.design.shape);for(const q of [r.center,r.chestPoint,r.restPoint,r.rewardPoint,{x:r.center.x,y:r.center.y+110}].filter(Boolean)){assert(!m.circleBlocked(q.x,q.y,12),level+':'+seed+':'+r.id);assert(flow[m.idx(Math.floor(q.x/32),Math.floor(q.y/32))]>=0,'reachable socket');}for(const poly of r.polygons)assert(poly.every(([x,y])=>x>0&&y>0&&x<S.width&&y<S.height));}
    if(['amber','glass'].includes(level))for(const l of j.corridors)for(let t=.1;t<1;t+=.1)assert(!m.circleBlocked(l.from.x+(l.to.x-l.from.x)*t,l.from.y+(l.to.y-l.from.y)*t,12),'continuous corridor '+level+':'+seed+':'+l.id+':'+t);assert(g.enemies.every(e=>!m.circleBlocked(e.x,e.y,e.r)));
  }
  assert.equal(starts.size,3);assert.equal(shapes.size,10);
  for(const id of ['tombguard','censer','glassduelist','prismmoth','amberking','glassregent'])assert(Art.sprite(id));
  function place(q){assert(!g.map.circleBlocked(q.x,q.y,12));Object.assign(g.player,{x:q.x,y:q.y});g.updateSeamlessZones();g.map.updateVisibility(Math.floor(q.x/32),Math.floor(q.y/32));}
  function clear(id){place(g.journey.rooms[id].center);for(const e of g.enemies.slice())if(e.alive&&e.homeRoom===id)g.hitEnemy(e,999999,{});g.updateSeamlessZones();}
  // Whole chain: stable player, talent budget, artifacts, checkpoint and staircase gates.
  g.toMenu();g.startSeamlessJourney(42,'baldin');let expectedClears=0;
  for(const level of Object.keys(L.levels)){
    assert.equal(g.journey.levelId,level);for(const r of g.journey.rooms)if(['combat','elite','boss'].includes(r.role)&&!r.cleared){clear(r.id);expectedClears++;}
    assert.equal(g.player.talents.clears,expectedClears);assert.equal(g.player.talents.earned,Math.min(9,1+Math.floor(expectedClears/4)));const previous=g.player.talents.clears;g.updateSeamlessZones();assert.equal(g.player.talents.clears,previous);
    if(level==='amber')Relics.grant(g,'scarab');
    const p=g.player,stats=JSON.stringify(p.talents),gear=JSON.stringify(p.equipment),hp=p.hp,t=g.journeyTargets().find(t=>t.kind==='stairs');assert(t);place(t);assert(g.journeyInteract(t));
    if(level!=='glass'){assert.strictEqual(g.player,p);assert.equal(g.player.hp,hp);assert.equal(JSON.stringify(p.talents),stats);assert.equal(JSON.stringify(p.equipment),gear);if(level==='amber')assert.equal(Relics.rank(p,'scarab'),1);}
    else{assert.equal(g.state,'win');assert.equal(h.storage.get(S.key),'null');}
  }
  let boss;
  function encounter(level,ability,phase=1){g.toMenu();g.startSeamlessJourney(42,'arator',level);const r=g.journey.rooms[15];boss=g.enemies.find(e=>e.isBoss);Object.assign(boss,{x:r.center.x,y:r.center.y,attackTimer:99,rootRecovery:0});g.enemies=[boss];place({x:r.center.x+140,y:r.center.y});g.player.invulnTime=0;if(phase===2)boss.hp=boss.maxHp*.4;for(const k in boss.abilityTimers)boss.abilityTimers[k]=99;boss.abilityTimers[ability]=0;g.updateBossAbilities(boss,.016,140,true);assert(boss.telegraph);}
  function tick(t){for(let i=0;i<Math.ceil(t*60);i++)g.update(1/60);}
  for(const [level,ability]of [['amber','royalCleave'],['amber','burialSeals'],['glass','mirrorLanes'],['glass','petalRings']])for(const phase of [1,2]){
    encounter(level,ability,phase);assert.equal(boss.phase,phase);assert(C.validState(C.snapshot(boss)));const saved=JSON.stringify(boss.telegraph);g.state='paused';tick(.3);assert.equal(JSON.stringify(boss.telegraph),saved);g.saveJourney();g.toMenu();assert(g.resumeSeamlessJourney());boss=g.enemies.find(e=>e.isBoss);assert.equal(JSON.stringify(boss.telegraph),saved);
    const geom=boss.telegraph.shapes,r=g.journey.rooms[15],points=[];for(let y=-160;y<=160;y+=20)for(let x=-180;x<=180;x+=20){const q={x:r.center.x+x,y:r.center.y+y,r:12};if(!g.map.circleBlocked(q.x,q.y,12))points.push(q);}const hit=points.find(q=>geom.some(s=>C.contains(s,q)&&g.canReach(s,q))),safe=points.find(q=>geom.every(s=>!C.contains(s,q)));assert(hit&&safe);place(hit);g.player.invulnTime=0;const hp=g.player.hp;tick(.8);assert.equal(g.player.hp,hp);tick(.75);assert(g.player.hp<hp);
    encounter(level,ability,phase);place(safe);const hp2=g.player.hp;tick(1.6);assert.equal(g.player.hp,hp2,'dodge');encounter(level,ability,phase);boss.stun=.4;g.updateEnemies(.05);assert(!boss.telegraph);encounter(level,ability,phase);g.hitEnemy(boss,999999,{});assert(!boss.telegraph);
  }
  // Each new enemy enters the real AI windup, then resolves its own attack.
  for(const [type,level,d]of [['tombguard','amber',70],['censer','amber',150],['glassduelist','glass',150],['prismmoth','glass',180]]){
    g.toMenu();g.startSeamlessJourney(42,'arator',level);const r=g.journey.rooms[1],e=g.enemies.find(e=>e.type===type);Object.assign(e,{x:r.center.x,y:r.center.y,homeRoom:1,state:'chase',attackTimer:0});g.enemies=[e];place({x:r.center.x+d,y:r.center.y});g.player.invulnTime=0;g.updateEnemies(.016);assert(e.telegraph,type+' starts windup');const hp=g.player.hp;tick(1.65);assert(g.player.hp<hp,type+' resolves attack');
  }
  g.toMenu();g.startSeamlessJourney(42,'arator','amber');const guard=g.enemies.find(e=>e.type==='tombguard'),r=g.journey.rooms[1];Object.assign(guard,{x:r.center.x,y:r.center.y,armor:0,hp:1000,maxHp:1000});g.enemies=[guard];place({x:guard.x+50,y:guard.y});C.warn(guard,'sweep',[{shape:'cone',x:guard.x,y:guard.y,angle:0,r:114,half:.88}],1.1);const chance=R.chance;R.chance=()=>false;g.hitEnemy(guard,100,{});assert.equal(guard.hp,935);g.player.x=guard.x-50;g.hitEnemy(guard,100,{});assert.equal(guard.hp,835,'flank bypasses shield');R.chance=chance;
  g.toMenu();g.startSeamlessJourney(42,'arator','glass');place(g.journey.rooms[15].center);g.hitEnemy(g.enemies.find(e=>e.isBoss),999999,{});g.updateSeamlessZones();assert(!g.stairsOpen,'boss guards gate final staircase');
  g.toMenu();assert.equal(JSON.stringify(h.a.Save.data),original);ui.click('data-front','floors');assert.equal(ui.querySelectorAll('[data-expedition]').length,8);ui.click('data-expedition','glass');assert.equal(g.floor,8);g.state='paused';g.ui.showPause();ui.click('data-route-pause','talents');assert.equal(g.state,'talents');
  console.log('PASS v11 levels: 22 generated floors, 10 new shapes, connected routes/rewards, full I–VIII run and talent credits, carryover, boss hit/dodge/phase/save/stun/death, four new AI attacks, shield flanking and native menu/pause access.');
})().catch(e=>{console.error(e);process.exitCode=1;});

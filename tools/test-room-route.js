'use strict';
// Real engine + native Canvas. No browser or gameplay-balancing claim is made.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const {harness}=require('./test-room-visual');
const out=path.resolve(__dirname,'../dist/room-route');
(async()=>{
  fs.mkdirSync(out,{recursive:true});const h=await harness(),{g,a}=h;
  const {RoomRoute:RR,makeItem}=vm.runInContext('({RoomRoute,makeItem})',h.env);
  const original=a.Save.data,originalJSON=JSON.stringify(original);a.Save.dirty=true;a.Save.timer=.7;
  const starts=new Set(),geometrySeen=new Set();
  function flood(map,start){
    const w=128,cell=8,walk=new Set();
    for(let y=0;y<88;y++)for(let x=0;x<w;x++)if(!map.circleBlocked(x*cell+4,y*cell+4,12))walk.add(y*w+x);
    const index=p=>Math.floor(p.y/cell)*w+Math.floor(p.x/cell),seed=index(start),seen=new Set([seed]),q=[seed];assert(walk.has(seed),'spawn on fine navigation grid');
    for(let n=0;n<q.length;n++)for(const d of [-1,1,-w,w]){const x=q[n]+d;if(walk.has(x)&&!seen.has(x)){q.push(x);seen.add(x);}}
    assert.equal(seen.size,walk.size,'entire walkable mask is connected');return {seen,index};
  }
  for(let seed=1;seed<=30;seed++){
    const j=RR.create(seed);starts.add(j.start);assert.equal(j.rooms.length,16);const seen=new Set([j.start]),q=[j.start];
    for(let n=0;n<q.length;n++)for(const to of j.rooms[q[n]].links)if(!seen.has(to)){seen.add(to);q.push(to);}
    assert.equal(seen.size,16,'no isolated graph nodes');assert.equal(j.rooms[15].role,'boss');
    assert.equal(j.rooms.filter(r=>r.role==='treasure').length,2);assert.equal(j.rooms.filter(r=>r.role==='rest').length,2);
    for(const r of j.rooms){
      assert(r.doors.length>=1&&r.doors.length<=3);assert.equal(new Set(r.doors.map(d=>d.socket)).size,r.doors.length);
      for(const d of r.doors)assert(j.rooms[d.to].doors.some(back=>back.to===r.id),'every edge has a physical return door');
      const map=RR.makeMap(r),key=r.template+':'+r.variant,spawn=RR.point(map.template,[768,720]);
      if(!geometrySeen.has(key)){
        const f=flood(map,spawn);geometrySeen.add(key);
        for(const d of map.doors){assert(!map.circleBlocked(d.x,d.y,12));assert(f.seen.has(f.index(d)),'reachable threshold');}
      }
      for(const d of map.doors){const arrival={x:d.x,y:d.y+(d.socket==='back'?-76:82)};assert(!map.circleBlocked(arrival.x,arrival.y,12),'safe arrival '+r.id+':'+d.socket);}
    }
  }
  assert.equal(starts.size,3,'three seeded entrance choices');
  g.startJourney(42);assert.equal(g.journey.current,5);assert.equal(g.enemies.length,0);
  assert(h.ui.innerHTML.includes('Карта'));
  function shot(name){g.updateEffects(2);g.journey.transition=0;g.shake=0;g.time=2;g.player.invulnTime=0;g.renderer.render();fs.writeFileSync(path.join(out,name+'.png'),h.canvas.toBuffer('image/png'));}
  shot('01-entrance');
  function clear(){for(const e of g.enemies.slice())if(e.alive)g.hitEnemy(e,999999,{});g.player.poisonTime=0;g.update(1/60);assert(g.journey.rooms[g.journey.current].cleared);}
  // Follow an 8px collision path with the actual WASD update, then press E.
  function walkTo(goal){
    const m=g.map,w=128,step=8,index=p=>Math.floor(p.y/step)*w+Math.floor(p.x/step),from=index(g.player),to=index(goal),parents=new Map([[from,null]]),queue=[from];
    for(let n=0;n<queue.length&&!parents.has(to);n++)for(const delta of [-1,1,-w,w]){
      const v=queue[n]+delta,x=(v%w)*step+4,y=Math.floor(v/w)*step+4;
      if(v>=0&&v<w*88&&!parents.has(v)&&!m.circleBlocked(x,y,12)){parents.set(v,queue[n]);queue.push(v);}
    }
    assert(parents.has(to),'physical path exists');const path=[];for(let v=to;v!==from;v=parents.get(v))path.push({x:v%w*step+4,y:Math.floor(v/w)*step+4});path.reverse();
    for(const q of path){let ticks=0;while(dist(g.player,q)>3&&ticks++<20){const dx=q.x-g.player.x,dy=q.y-g.player.y;g.input.keys={};if(Math.abs(dx)>2)g.input.keys[dx>0?'KeyD':'KeyA']=true;if(Math.abs(dy)>2)g.input.keys[dy>0?'KeyS':'KeyW']=true;g.update(1/120);}assert(ticks<=20,'WASD path does not stick');}g.input.keys={};
  }
  function dist(a,b){return Math.hypot(a.x-b.x,a.y-b.y);}
  const initialDoor=g.map.doors[0];walkTo({x:initialDoor.x,y:initialDoor.y+42});
  g.journey.transition=0;g.input.pressed.KeyE=true;g.update(1/60);assert.equal(g.journey.current,3,'E enters adjacent room');
  for(const e of g.enemies){assert(!g.map.circleBlocked(e.x,e.y,e.r));assert(dist(g.player,e)>140,'enemy spawn safety radius');assert(g.map.doors.every(d=>dist(e,d)>110),'enemy spawn away from exits');}
  const locked=g.map.doors[0];g.player.x=locked.x;g.player.y=locked.y+30;g.journey.transition=0;const roomId=g.journey.current;
  assert.equal(g.journeyInteract({...locked,kind:'door'}),false);assert.equal(g.journey.current,roomId,'combat cannot be skipped through a door');
  // A real melee attack, not a test damage call, kills a normal foe.
  const foe=g.enemies.find(e=>e.type==='goblin');g.player.x=foe.x;g.player.y=foe.y+33;g.player.invulnTime=50;g.input.mouse.x=foe.x;g.input.mouse.y=foe.y-32;g.input.mouse.down=true;
  for(let i=0;i<240&&foe.alive;i++)g.update(1/60);g.input.mouse.down=false;assert(!foe.alive,'actual engine attack damages and kills');
  clear();shot('02-cleared-doors');
  const exit=g.map.doors.find(d=>d.to===5);g.player.x=exit.x;g.player.y=exit.y+(exit.socket==='back'?-35:35);g.journey.transition=0;
  assert(g.journeyInteract({...exit,kind:'door'}));assert.equal(g.journey.current,5);
  // Return to a cleared room: no respawn, lost drops, or repeated clear rewards.
  const returnDoor=g.map.doors[0];g.player.x=returnDoor.x;g.player.y=returnDoor.y+35;g.journey.transition=0;
  assert(g.journeyInteract({...returnDoor,kind:'door'}));assert.equal(g.enemies.length,0);assert(g.journey.rooms[3].cleared);
  // Treasure interaction is explicit; standing over it cannot auto-open it.
  g.enterJourneyRoom(10);const chest=g.chests[0];g.player.x=chest.x;g.player.y=chest.y;g.journey.transition=0;
  g.update(1/60);assert.equal(chest.opened,false);shot('03-treasure');
  const potions=g.player.consumables.potion;g.input.pressed.KeyE=true;g.update(1/60);assert(chest.opened);assert.equal(g.player.consumables.potion,potions+1);
  const lootCount=g.pickups.length;g.input.pressed.KeyE=true;g.update(1/60);assert.equal(g.pickups.length,lootCount,'no duplicate chest reward');
  const loot=JSON.stringify(g.pickups);g.enterJourneyRoom(7);g.enterJourneyRoom(10);assert(g.chests[0].opened);assert.equal(JSON.stringify(g.pickups),loot,'uncollected loot survives revisiting');
  // An elite chest remains sealed during combat and guarantees rare-or-better gear.
  g.enterJourneyRoom(13);const eliteChest=g.chests[0];g.player.x=eliteChest.x;g.player.y=eliteChest.y;g.journey.transition=0;
  assert(!g.journeyInteract({...eliteChest,kind:'chest',chest:eliteChest}));clear();
  assert(g.journeyInteract({...eliteChest,kind:'chest',chest:eliteChest}));assert(g.pickups.some(p=>p.kind==='item'&&p.item.rarity!=='common'));
  g.enterJourneyRoom(7);g.player.hp=30;const rest=g.journeyTargets().find(t=>t.kind==='rest');g.player.x=rest.x;g.player.y=rest.y;g.journey.transition=0;
  assert(g.journeyInteract(rest));const hp=g.player.hp;assert(hp>30);assert(!g.journeyInteract(rest));assert.equal(g.player.hp,hp);shot('04-rest');
  // Checkpoint recreates classes, enemy HP, unique item IDs, exploration and loot.
  g.enterJourneyRoom(8);g.player.hp=81;g.enemies[0].hp=11;g.player.bag.push({...makeItem('rustySword','rare'),uid:9001});g.saveJourney();
  const beforeResume=JSON.parse(h.storage.get(RR.key));g.toMenu();assert.strictEqual(a.Save.data,original);assert.equal(JSON.stringify(a.Save.data),originalJSON);assert.equal(a.Save.timer,.7);assert.equal(a.Save.dirty,true);
  assert(g.resumeJourney());assert.equal(g.journey.current,8);assert.equal(g.player.hp,81);assert.equal(g.enemies[0].hp,11);assert.equal(typeof g.enemies[0].def.name,'string');assert(makeItem('rustySword','common').uid>9001);
  assert.equal(g.journey.rooms[10].world.chests[0].opened,true);assert(g.journey.rooms[7].restUsed);
  g.journey.transition=0;shot('05-gallery-combat');clear();shot('06-gallery-open');
  // Explore the full graph through actual door interactions, including cycles.
  const explored=new Set();
  function visit(id){
    explored.add(id);if(!g.journey.rooms[id].cleared)clear();
    for(const to of g.journey.rooms[id].links){if(explored.has(to))continue;
      const d=g.map.doors.find(d=>d.to===to);g.player.x=d.x;g.player.y=d.y+(d.socket==='back'?-35:35);g.journey.transition=0;assert(g.journeyInteract({...d,kind:'door'}));
      if(to===15){shot('07-boss');const boss=g.boss;g.hitEnemy(boss,999999,{});g.update(1/60);assert(g.enemies.some(e=>e.alive));assert.equal(g.stairsOpen,false);assert(!g.journeyTargets().some(t=>t.kind==='stairs'),'guards still lock the final stair');}
      visit(to);
      const back=g.map.doors.find(d=>d.to===id);g.player.x=back.x;g.player.y=back.y+(back.socket==='back'?-35:35);g.journey.transition=0;assert(g.journeyInteract({...back,kind:'door'}));
    }
  }
  visit(8);assert.equal(explored.size,16);assert(g.journey.rooms.every(r=>r.visited));
  g.ui.showJourneyMap();assert.equal(g.state,'route-map');const time=g.runStats.time;g.update(1);assert.equal(g.runStats.time,time,'map pauses combat');shot('08-route-map');g.input.pressed.KeyM=true;g.update(1/60);assert.equal(g.state,'run');
  g.enterJourneyRoom(15);g.journey.transition=0;g.update(1/60);const stair=g.journeyTargets().find(t=>t.kind==='stairs');assert(stair);walkTo({x:stair.x,y:stair.y+36});shot('09-stair');g.input.pressed.KeyE=true;g.update(1/60);
  assert.equal(g.state,'win');assert.equal(h.storage.get(RR.key),'null');assert(h.ui.innerHTML.includes('Этаж пройден'));
  // Death stops later engine phases, does not leave a resumable dead run.
  g.startJourney(8);g.player.hp=1;g.player.poison=200;g.player.poisonTime=2;
  const enemyPhase=g.updateEnemies;g.updateEnemies=()=>{throw Error('Enemy phase ran after poison death');};g.update(1/60);g.updateEnemies=enemyPhase;
  assert.equal(g.state,'dead');assert.equal(h.storage.get(RR.key),'null');assert.equal(g.resumeJourney(),false);
  g.toMenu();assert.strictEqual(a.Save.data,original);assert.equal(JSON.stringify(original),originalJSON);
  assert(h.writes.every(key=>key===RR.key),'no meta/campaign writes during expedition');
  // Touch use opens the same chest through the same interaction path.
  g.startJourney(42);g.enterJourneyRoom(10);g.input.touch.enabled=true;const tc=g.chests[0];g.player.x=tc.x;g.player.y=tc.y+40;g.journey.transition=0;g.update(1/60);assert(g.input.touch.showUse);shot('10-touch');g.input.touch.pressed.use=true;g.update(1/60);assert(tc.opened);
  g.toMenu();g.startRun('arator','startNone');assert(!g.journey);assert(!g.visualRoom);assert(g.map.rooms.length>0,'original campaign still starts');
  fs.writeFileSync(path.join(out,'validation.json'),JSON.stringify({passed:true,seeds:30,rooms:16,entrances:[...starts],geometryConfigurations:geometrySeen.size,checkpointVersion:beforeResume.version,checks:['radius navigation','real WASD passage','locked doors','melee combat','chests and loot persistence','single-use rest','rare elite reward','checkpoint restore','full graph traversal','map pause','boss plus guards stair gate','victory','death phase guard','meta save isolation','touch interaction','original campaign regression'],browserTested:false},null,2));
  console.log('PASS: 16-room route, 30 seeds, physical movement, interactions, reload, boss, stairs, death and isolated saves.');
})().catch(error=>{console.error(error);process.exitCode=1;});

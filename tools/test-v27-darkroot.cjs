/* Darkroot integration QA against the assembled game and real Canvas. */
'use strict';
const assert=require('node:assert/strict');
const path=require('node:path');
let boot;
try {({boot}=require(path.join(__dirname,'v27-harness.cjs')));}
catch (e) {
  if(e.code!=='MODULE_NOT_FOUND')throw e;
  ({boot}=require('/workspace/scratch/513c16890429/game-repo/tools/v27-harness.cjs'));
}
const root=path.resolve(__dirname,'..'),step=16,radius=12;
const seeds=[42,731,987654321];

function audit(j,map){
  const w=Math.ceil(map.w*32/step),h=Math.ceil(map.h*32/step),mask=new Uint8Array(w*h);
  for(const poly of map.polygons){
    const xs=poly.map(p=>p[0]),ys=poly.map(p=>p[1]);
    for(let y=Math.max(0,Math.floor(Math.min(...ys)/step)-1);y<=Math.min(h-1,Math.ceil(Math.max(...ys)/step)+1);y++)
      for(let x=Math.max(0,Math.floor(Math.min(...xs)/step)-1);x<=Math.min(w-1,Math.ceil(Math.max(...xs)/step)+1);x++)mask[y*w+x]=1;
  }
  const pass=new Uint8Array(mask.length);
  for(let i=0;i<mask.length;i++)if(mask[i])pass[i]=+!map.circleBlocked(((i%w)+.5)*step,(Math.floor(i/w)+.5)*step,radius);
  function anchor(p,label){
    assert(!map.circleBlocked(p.x,p.y,radius),`${label}: full hero disc blocked`);
    const cx=Math.floor(p.x/step),cy=Math.floor(p.y/step);
    for(let d=0;d<=3;d++)for(let dy=-d;dy<=d;dy++)for(let dx=-d;dx<=d;dx++){
      if(Math.max(Math.abs(dx),Math.abs(dy))!==d)continue;
      const x=cx+dx,y=cy+dy,id=y*w+x;if(x<0||y<0||x>=w||y>=h||!pass[id])continue;
      const q={x:(x+.5)*step,y:(y+.5)*step},n=Math.ceil(Math.hypot(q.x-p.x,q.y-p.y)/4);
      if(Array.from({length:n+1},(_,k)=>k).every(k=>!map.circleBlocked(p.x+(q.x-p.x)*k/n,p.y+(q.y-p.y)*k/n,radius)))return id;
    }
    assert.fail(`${label}: no safe sampled anchor`);
  }
  const start=anchor({x:j.rooms[j.start].center.x,y:j.rooms[j.start].center.y+110},'spawn');
  const seen=new Uint8Array(pass.length),queue=new Int32Array(pass.length);let head=0,tail=0;
  queue[tail++]=start;seen[start]=1;
  while(head<tail){
    const id=queue[head++],x=id%w,y=Math.floor(id/w);
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const nx=x+dx,ny=y+dy,next=ny*w+nx;
      if(nx<0||ny<0||nx>=w||ny>=h||!pass[next]||seen[next])continue;
      let clear=true;
      for(let k=1;k<4;k++)if(map.circleBlocked((x+.5+dx*k/4)*step,(y+.5+dy*k/4)*step,radius)){clear=false;break;}
      if(clear){seen[next]=1;queue[tail++]=next;}
    }
  }
  const failures=[];
  function check(p,label){try{if(!seen[anchor(p,label)])failures.push(`${label}: disconnected`);}catch(e){failures.push(e.message);}}
  for(const r of j.rooms){
    check(r.center,`room ${r.id} center`);
    if([0,5,10].includes(r.id))check({x:r.center.x,y:r.center.y+110},`start ${r.id}`);
    if(r.id===15){
      check({x:r.center.x,y:r.center.y+95},'boss exit approach');
      check({x:r.origin.x+512,y:r.origin.y+213},'actual boss stairs');
    }
    for(const [name,p]of [['rest',r.restPoint],['chest',r.chestPoint],['feature',r.featureUsePoint]])
      if(p&&!map.circleBlocked(p.x,p.y,radius))check(p,`room ${r.id} ${name}`);
  }
  for(const c of j.corridors)for(const t of [.25,.5,.75]){
    const dx=c.to.x-c.from.x,dy=c.to.y-c.from.y,n=Math.hypot(dx,dy);let open=false;
    for(let offset=-c.half;offset<=c.half;offset+=8){
      const p={x:c.from.x+dx*t-dy/n*offset,y:c.from.y+dy*t+dx/n*offset};
      if(map.circleBlocked(p.x,p.y,radius))continue;
      try{if(seen[anchor(p,'corridor cross section')]){open=true;break;}}catch(_){}
    }
    if(!open)failures.push(`corridor ${c.a}-${c.b} t=${t}: no reachable opening`);
  }
  return {failures,reachable:tail,walkable:pass.reduce((a,b)=>a+b,0)};
}
const json=x=>JSON.stringify(x);
function placement(g,p){assert(!g.map.circleBlocked(p.x,p.y,g.player.r),'teleport on floor');Object.assign(g.player,{x:p.x,y:p.y});g.updateSeamlessZones();g.map.updateVisibility(Math.floor(p.x/32),Math.floor(p.y/32));}
function enemyAt(g,type,room=1){const e=g.enemies.find(v=>v.type===type&&v.homeRoom===room);assert(e,`${type} in room ${room}`);return e;}
function select(g,e,offset=120){const r=g.journey.rooms[e.homeRoom];Object.assign(e,{x:r.center.x,y:r.center.y,state:'chase',attackTimer:0,stun:0,rootRecovery:0,telegraph:null,charge:null});g.enemies=[e];placement(g,{x:e.x+offset,y:e.y});return e;}
function state(e){return {type:e.type,id:e.rvId,homeRoom:e.homeRoom,x:e.x,y:e.y,hp:e.hp,phase:e.phase,rootState:e.def.rootvault?{attackTimer:e.attackTimer,abilityTimers:e.abilityTimers,telegraph:e.telegraph,charge:e.charge,rootRecovery:e.rootRecovery||0}:null};}
function resume(g,a){const j=g.journey,geometry=json([j.rooms.map(r=>[r.center,r.polygons,r.obstacles,r.decor]),j.corridors.map(c=>[c.polygon,c.from,c.to]),g.map.obstacles]);const players=json({x:g.player.x,y:g.player.y,hp:g.player.hp,skillCds:g.player.skillCds,relics:g.player.relics});const enemies=json(g.enemies.filter(e=>e.alive).map(state));g.saveJourney();assert(g.resumeSeamlessJourney(),'valid Darkroot checkpoint');assert.equal(json([g.journey.rooms.map(r=>[r.center,r.polygons,r.obstacles,r.decor]),g.journey.corridors.map(c=>[c.polygon,c.from,c.to]),g.map.obstacles]),geometry,'exact generated geometry after resume');assert.equal(json({x:g.player.x,y:g.player.y,hp:g.player.hp,skillCds:g.player.skillCds,relics:g.player.relics}),players,'player state after resume');assert.equal(json(g.enemies.filter(e=>e.alive).map(state)),enemies,'enemy IDs and combat state after resume');return g.enemies.find(e=>e.isBoss);}
function reset(g,hero='arator'){g.toMenu();g.startSeamlessJourney(42,hero,'darkroot','journey');}
function waitWarning(g,e){for(let i=0;i<150&&!e.telegraph;i++)g.updateEnemies(1/60);assert(e.telegraph,`${e.type} starts a warning`);assert(e.telegraph.v27Darkroot);return e.telegraph;}

(async()=>{
  const h=await boot({team:'darkroot',root,seed:42,hero:'arator',difficulty:'journey'}),{g,a,env}=h;
  let totalReachable=0,totalWalkable=0;
  for(const seed of seeds){
    g.toMenu();g.startSeamlessJourney(seed,'arator','darkroot','journey');
    assert.equal(g.journey.rooms.length,16);assert.equal(g.journey.corridors.length,18);assert.equal(g.journey.layoutVersion,16);assert.equal(g.journey.v20MapVersion,20);
    const before=json(g.journey),r=audit(g.journey,g.map);assert.equal(json(g.journey),before,'route audit is read only');assert.deepEqual(r.failures,[],`seed ${seed} physical targets`);
    totalReachable+=r.reachable;totalWalkable+=r.walkable;console.log(`PASS route seed ${seed}: ${r.reachable}/${r.walkable} cells; all centers, starts, stairs, corridor sections`);
  }
  g.toMenu();g.startSeamlessJourney(42,'arator','darkroot','journey');
  assert.equal(a.AdventureRun.floor(g.journey),1,'standalone run uses floor 1 scaling');
  assert.equal(g.floor,1);
  assert.equal(a.AdventureRun.chance({drops:0,cooldown:0,misses:0},false),.14);
  assert.equal(a.AdventureRun.chance({drops:0,cooldown:0,misses:3},true),.44);
  assert.equal(a.AdventureRun.chance({drops:0,cooldown:0,misses:5},false),1);
  assert.equal(a.AdventureRun.chance({drops:2,cooldown:0,misses:5},true),0);
  assert.equal(a.AdventureRun.chance({drops:0,cooldown:2,misses:5},true),0);
  const room=g.journey.rooms.find(r=>r.role==='combat');const economy=g.journey.relicEconomy;
  assert.equal(economy.drops,0);a.AdventureRun.resolve(g,room);assert.equal(economy.resolved,1);
  const controlled=a.AdventureRun.freshEconomy();g.journey.relicEconomy=controlled;controlled.misses=5;
  const combat=g.journey.rooms.filter(r=>r.role==='combat'||r.role==='elite');
  assert(a.AdventureRun.resolve(g,combat[0]));assert.equal(controlled.drops,1);assert.equal(controlled.cooldown,2);
  assert(!a.AdventureRun.resolve(g,combat[1]));assert.equal(controlled.cooldown,1);
  assert(!a.AdventureRun.resolve(g,combat[2]));assert.equal(controlled.cooldown,0);
  controlled.misses=5;assert(a.AdventureRun.resolve(g,combat[3]));assert.equal(controlled.drops,2);
  assert(!a.AdventureRun.resolve(g,combat[4]));assert.equal(combat[4].reward.reason,'floor-cap');
  console.log('PASS standard AdventureRun floor/relic economy');
  // The actual image objects, source frame rectangles and frame drawing are exercised.
  const mobs=env.V27DarkrootMobs;assert.equal(mobs.frames,8);assert.deepEqual([...mobs.ids],['root_reaper','root_grafter','root_heart']);
  for(const id of mobs.ids){const f=mobs.files[id];assert.equal(f.rects.length,8);assert.equal(f.image.width,1774);assert.equal(f.image.height,887);assert(f.rects.every(([x,y,w,h])=>x>=0&&y>=0&&w>0&&h>0&&x+w<=f.image.width&&y+h<=f.image.height));}
  const ctx=h.canvas.getContext('2d'),oldSave=ctx.save,oldRestore=ctx.restore,oldDraw=ctx.drawImage;let depth=0,draws=0;const atlasDrawn=new Set();
  ctx.save=function(...args){depth++;return oldSave.apply(this,args);};
  ctx.restore=function(...args){depth--;assert(depth>=0,'Canvas restore underflow');return oldRestore.apply(this,args);};
  ctx.drawImage=function(...args){draws++;for(const id of mobs.ids)if(args[0]===mobs.files[id].image)atlasDrawn.add(id);return oldDraw.apply(this,args);};
  try{
    for(const type of mobs.ids){
      const e=type==='root_heart'?g.enemies.find(v=>v.isBoss):g.enemies.find(v=>v.type===type);
      assert(e);placement(g,{x:e.x+70,y:e.y+70});g.camera={x:Math.max(0,e.x-512),y:Math.max(0,e.y-320)};g.renderer.render();assert.equal(depth,0,'Canvas save/restore balanced');
    }
    assert(draws>0,'actual images drawn on Canvas');assert.deepEqual([...atlasDrawn].sort(),[...mobs.ids].sort(),'all three creature atlases used by real Canvas draw');
  }finally{ctx.save=oldSave;ctx.restore=oldRestore;ctx.drawImage=oldDraw;}
  console.log('PASS three image atlases / 24 bounded frames, visible Canvas images, balanced draw state');

  // Both ordinary actors travel through the normal AI update and released attack.
  for(const [type,offset] of [['root_reaper',70],['root_grafter',130]]){
    reset(g);let e=select(g,enemyAt(g,type),offset),t=waitWarning(g,e);
    const frozen=json(t.shapes),kind=type==='root_reaper'?'sweep':'spores';assert.equal(t.kind,kind);
    g.state='paused';const paused=json(state(e));h.step(.3);assert.equal(json(state(e)),paused,'pause freezes warning/enemy');g.state='run';
    const hp=g.player.hp;g.player.invulnTime=0;h.step(t.time+.3);assert.equal(e.telegraph,null);
    if(type==='root_reaper')assert(g.player.hp<hp,'sweep damaged marked target');
    else assert(g.rootHazards.some(v=>v.sourceType===type),'spores produced the actual persistent hazard');
    assert(e.rootRecovery>0,'release has recovery');
    assert.equal(json(t.shapes),frozen,'warning geometry stays fixed');
    reset(g);e=select(g,enemyAt(g,type),offset);waitWarning(g,e);e.stun=.5;g.updateEnemies(.016);assert(!e.telegraph,'stun interrupts warning');
  }
  console.log('PASS both mobs warn / release / recovery / stun and paused warning');
  reset(g);let e=select(g,enemyAt(g,'root_reaper'),240);e.abilityTimers.rootLeap=0;g.updateEnemy(e,.016);
  assert.equal(e.telegraph?.kind,'lunge');const lane=e.telegraph.shapes[0],origin={x:e.x,y:e.y};
  h.step(.92);assert(e.charge,'lunge launches physical charge after warning');
  h.step(.16);const travel=Math.hypot(e.x-origin.x,e.y-origin.y);assert(travel>15&&travel<=215,`actual charge travel ${travel}`);
  assert(Math.abs((e.x-origin.x)*(-Math.sin(lane.angle))+(e.y-origin.y)*Math.cos(lane.angle))<e.r+8,'charge inside warning lane');
  console.log('PASS reaper physical lunge follows warned lane');

  // Boss abilities are forced due through their real update method, then
  // advance the actual game simulation and persist halfway through a warning.
  for(const phase of [1,2])for(const [ability,kind,count]of [['pulse','toll',1],['graft','bolts',1],['rootlane','mirror-lanes',phase===1?2:3]]){
    reset(g);let b=g.enemies.find(v=>v.isBoss);select(g,b,160);
    if(phase===2){b.hp=b.maxHp*.45;assert(g.updateBossAbilities(b,.016,160,true));assert.equal(b.phase,2);assert(b.rootRecovery>0);b.rootRecovery=0;}
    for(const key of Object.keys(b.abilityTimers))b.abilityTimers[key]=100;
    b.abilityTimers[ability]=0;assert(g.updateBossAbilities(b,.016,160,true));
    assert.equal(b.telegraph.kind,kind);assert.equal(b.telegraph.shapes.length,count);assert(b.telegraph.v27Darkroot);
    if(kind==='toll'){
      const s=b.telegraph.shapes[0];assert(s.inner>g.player.r+20,'center genuinely safe');
      assert(!a.RootCombat.contains(s,{x:b.x,y:b.y,r:g.player.r}),'ring center outside hit shape');
    }
    if(kind==='mirror-lanes'){
      const shapes=b.telegraph.shapes;
      const spaces=[];for(let angle=-.8;angle<=.8;angle+=.01){const p={x:b.x+Math.cos(angle)*180,y:b.y+Math.sin(angle)*180,r:12};if(shapes.every(s=>!a.RootCombat.contains(s,p)))spaces.push(p);}
      assert(spaces.length,'safe gap between lanes');
    }
    const initial=json(b.telegraph.shapes);g.player.invulnTime=10;h.step(.25);assert(b.telegraph&&b.telegraph.time<b.telegraph.total,'actual midtelegraph tick');
    const time=b.telegraph.time,timers=json(b.abilityTimers),id=b.rvId;
    b=resume(g,a);assert.equal(b.rvId,id);assert.equal(b.telegraph.time,time);assert.equal(json(b.abilityTimers),timers);assert.equal(json(b.telegraph.shapes),initial);
    g.state='paused';h.step(.2);assert.equal(b.telegraph.time,time);g.state='run';
    h.step(time+.1);assert.equal(b.telegraph,null);assert(b.rootRecovery>0);
  }
  console.log('PASS both boss phases: ring / marks / split lanes, live midwarning save/resume and recovery');

  reset(g);const sleeping=enemyAt(g,'root_reaper',1),sleep=json(state(sleeping));g.updateEnemy(sleeping,1);assert.equal(json(state(sleeping)),sleep,'inactive room mob stays still');
  for(const hero of a.HEROES.map(v=>v.id)){
    reset(g,hero);const p=g.player,b=g.enemies.find(v=>v.homeRoom===1);select(g,b,95);g.enemies=[b];
    p.aim={x:1,y:0};p.attackTimer=0;g.playerAttack();for(let i=0;i<3;i++){p.skillCds[i]=0;g.useSkill(i);h.step(.08);g.renderer.render();}
    h.step(.35);g.renderer.render();assert.equal(g.state,'run',`${hero} survives basic/skills`);
  }
  console.log('PASS five heroes: actual basic, three skills each, update and render');

  reset(g);const key=a.SeamlessFloor.key,writeCount=h.writes.filter(k=>k===key).length;g.saveJourney();assert.equal(h.writes.filter(k=>k===key).length,writeCount+1,'one atomic checkpoint write');const valid=h.storage.get(key);assert(valid&&valid!=='null');
  const native=h.storage.set;h.storage.set=()=>{throw Error('quota');};
  try{g.player.gold+=3;assert.doesNotThrow(()=>g.saveJourney());assert.equal(h.storage.get(key),valid,'failed write retains checkpoint');}
  finally{h.storage.set=native;}
  g.player.invulnTime=0;g.damagePlayer(999999,null);assert.equal(h.storage.get(key),'null','death clears checkpoint');
  assert.equal(g.resumeSeamlessJourney(),false);reset(g);assert.equal(g.state,'run','new run after death');
  console.log('PASS checkpoint failure/death/new run');
  console.log(`PASS Darkroot QA: ${totalReachable}/${totalWalkable} physical cells sampled`);
})().catch(e=>{console.error(e);process.exitCode=1;});

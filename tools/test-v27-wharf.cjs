/* Wharf seed route, combat/checkpoint and art smoke tests. Run with node tools/test-v27-wharf.cjs. */
'use strict';
const assert=require('node:assert/strict'), fs=require('node:fs'), path=require('node:path');
const repo=path.resolve(__dirname,'..');
const local=path.join(__dirname,'v27-harness.cjs');
const helper=fs.existsSync(local)?local:path.resolve(__dirname,'../../game-repo/tools/v27-harness.cjs');
const {boot}=require(helper);
const {createCanvas,loadImage}=require(require.resolve('@napi-rs/canvas',{paths:[path.dirname(helper)]}));
const step=16,radius=12;
function audit(j, map) {
  const w = Math.ceil(map.w * 32 / step), h = Math.ceil(map.h * 32 / step);
  // Restrict sampling to floor bounding boxes; collision itself is always the
  // engine's exact polygon and obstacle test, including the full player disc.
  const mask = new Uint8Array(w * h);
  for (const poly of map.polygons) {
    const xs = poly.map(p => p[0]), ys = poly.map(p => p[1]);
    const x0 = Math.max(0, Math.floor(Math.min(...xs) / step) - 1);
    const x1 = Math.min(w - 1, Math.ceil(Math.max(...xs) / step) + 1);
    const y0 = Math.max(0, Math.floor(Math.min(...ys) / step) - 1);
    const y1 = Math.min(h - 1, Math.ceil(Math.max(...ys) / step) + 1);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) mask[y*w+x] = 1;
  }
  const pass = new Uint8Array(mask.length);
  for (let i = 0; i < mask.length; i++) if (mask[i]) {
    const x = i % w, y = Math.floor(i / w);
    pass[i] = +!map.circleBlocked((x+.5)*step, (y+.5)*step, radius);
  }
  function anchor(p, label) {
    assert(!map.circleBlocked(p.x, p.y, radius), `${label}: exact hero disc blocked`);
    const cx = Math.floor(p.x/step), cy = Math.floor(p.y/step);
    // The nearest cell may lie just inside an obstacle; test a short, exact
    // straight segment so snapping never jumps a wall.
    for (let d = 0; d <= 3; d++) for (let dy = -d; dy <= d; dy++) for (let dx = -d; dx <= d; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== d) continue;
      const x = cx+dx, y = cy+dy, id = y*w+x;
      if (x < 0 || y < 0 || x >= w || y >= h || !pass[id]) continue;
      const q = {x:(x+.5)*step,y:(y+.5)*step};
      const distance = Math.hypot(q.x-p.x,q.y-p.y), n = Math.ceil(distance/4);
      if (Array.from({length:n+1},(_,k)=>k).every(k => !map.circleBlocked(p.x+(q.x-p.x)*k/n,p.y+(q.y-p.y)*k/n,radius))) return id;
    }
    assert.fail(`${label}: no safe grid anchor`);
  }
  const start = anchor({x:j.rooms[j.start].center.x,y:j.rooms[j.start].center.y+110},'spawn');
  const seen = new Uint8Array(pass.length), queue = new Int32Array(pass.length);
  let head = 0, tail = 0; queue[tail++] = start; seen[start] = 1;
  while (head < tail) {
    const id = queue[head++], x = id%w, y = Math.floor(id/w);
    for (const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nx = x+dx, ny = y+dy, next = ny*w+nx;
      if (nx<0 || ny<0 || nx>=w || ny>=h || !pass[next] || seen[next]) continue;
      // A 16px edge may skim a convex obstacle or polygon cusp. Check the
      // actual swept circle at quarter-edge points before joining cells.
      let clear = true;
      for (let k=1;k<4;k++) if(map.circleBlocked((x+.5+dx*k/4)*step,(y+.5+dy*k/4)*step,radius)){clear=false;break;}
      if(clear){seen[next]=1;queue[tail++]=next;}
    }
  }
  const failures = [], check=(p,label) => {
    try { if(!seen[anchor(p,label)]) failures.push(`${label}: disconnected`); }
    catch(e) { failures.push(e.message); }
  };
  for (const r of j.rooms) {
    check(r.center,`room ${r.id} center`);
    if ([0,5,10].includes(r.id)) check({x:r.center.x,y:r.center.y+110},`alternate start ${r.id}`);
    if (r.id === 15) check({x:r.center.x,y:r.center.y+95},'boss exit approach');
    for(const [name,p] of [['rest',r.restPoint],['chest',r.chestPoint],['feature use',r.featureUsePoint]])
      if (p && !map.circleBlocked(p.x,p.y,radius)) check(p,`room ${r.id} ${name}`);
  }
  // A cover object may sit on the corridor centerline. The cross section is
  // passable if at least one full-radius opening joins the reachable floor.
  for (const c of j.corridors) for(const t of [.25,.5,.75]) {
    const dx=c.to.x-c.from.x,dy=c.to.y-c.from.y,n=Math.hypot(dx,dy);
    let open=false;
    for(let offset=-c.half;offset<=c.half;offset+=8){
      const p={x:c.from.x+dx*t-dy/n*offset,y:c.from.y+dy*t+dx/n*offset};
      if(map.circleBlocked(p.x,p.y,radius))continue;
      try { if(seen[anchor(p,'corridor section')]) {open=true;break;} } catch(_){}
    }
    if(!open)failures.push(`door ${c.a}-${c.b} t=${t}: no reachable opening`);
  }
  return {failures, reachableCells:tail, walkableCells:pass.reduce((a,b)=>a+b,0)};
}

(async()=>{
  const h=await boot({team:'wharf',root:repo,seed:42,hero:'arator',difficulty:'journey'});
  const {g,a}=h;
  const art=h.env.window.V27WharfArt;
  assert.equal(Object.keys(art.images).length,0,'art should load lazily before first render');
  let total=0;
  for(const seed of [42,731,987654321]){
    g.startSeamlessJourney(seed,'arator','drownedwharf','journey');
    const j=g.journey,before=JSON.stringify(j),result=audit(j,g.map);
    assert.equal(j.rooms.length,16);assert.equal(j.corridors.length,23);
    assert.equal(JSON.stringify(j),before,'route audit mutated journey');
    assert.deepEqual(result.failures,[],`seed ${seed} physical route`);
    assert(result.reachableCells/result.walkableCells>.999,'too many unreachable walking cells');
    total+=result.reachableCells;
    console.log(`PASS map seed ${seed}: ${result.reachableCells}/${result.walkableCells} walkable samples reachable`);
  }
  for(const hero of a.HEROES.map(v=>v.id)){
    g.startSeamlessJourney(42,hero,'drownedwharf','journey');h.step(.1);g.renderer.render();
    assert.equal(g.state,'run');
    assert([g.player.x,g.player.y,g.player.hp,...g.enemies.flatMap(e=>[e.x,e.y,e.hp])].every(Number.isFinite),`${hero} finite game state`);
    console.log(`PASS hero ${hero}: update/render`);
  }
  g.startSeamlessJourney(42,'arator','drownedwharf','journey');
  // The world render requests floor/props; an actual enemy draw requests the mob atlas.
  g.renderer.render();await h.settleImages();g.renderer.render();
  const firstCrab=g.enemies.find(v=>v.type==='wharf_crab');
  a.ActorMotion.draw(g.renderer.ctx,'enemy',firstCrab.type,firstCrab,{});await h.settleImages();
  assert(['floor','props','mobs'].every(key=>art.images[key]?.width>0), 'art images should load after render');
  const png=path.resolve(repo,'assets/v27/wharf/wharf-mobs.png');
  const manifest=JSON.parse(fs.readFileSync(path.resolve(repo,'assets/v27/wharf/mob-frames.json'),'utf8'));
  const image=await loadImage(png),canvas=createCanvas(image.width,image.height),ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);
  assert.equal(image.width,2048);assert.equal(image.height,1536);
  const pixels=ctx.getImageData(0,0,image.width,image.height).data;
  const alpha=(x,y)=>pixels[(y*image.width+x)*4+3];
  assert.equal(alpha(0,0),0);assert.equal(alpha(511,511),0);
  let frames=0;
  for(const [name,spec] of Object.entries(manifest)){
    assert.equal(spec.anchor[0],.5);assert.equal(spec.anchor[1],.94);
    assert(spec.renderHeight>spec.height);
    for(const [pose,[x,y,w,h]] of Object.entries(spec.frames)){
      assert.equal(w,512);assert.equal(h,512);assert(x>=0&&x+w<=2048&&y>=0&&y+h<=1536);
      let minX=2048,minY=1536,maxX=-1,maxY=-1;
      for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)if(alpha(xx,yy)>=16){
        minX=Math.min(minX,xx);maxX=Math.max(maxX,xx);minY=Math.min(minY,yy);maxY=Math.max(maxY,yy);
      }
      assert.deepEqual([minX,minY,maxX-minX+1,maxY-minY+1],spec.inkBounds[pose],`${name}/${pose} measured alpha`);
      assert(minX>x+20&&maxX<x+w-20&&minY>y+20&&maxY<y+h-5,`${name}/${pose} transparent cover`);
      frames++;
    }
  }
  assert.equal(frames,12);
  console.log('PASS atlas: lazy PNG load, RGBA transparent borders and all 12 measured frames');
  // A reversed corridor must not cancel the room in the painted floor union.
  const raster=createCanvas(256,180),rc=raster.getContext('2d');
  const roomPoly=[[20,30],[200,30],[200,160],[20,160]],corridorPoly=[[100,90],[240,90],[240,140],[100,140]].reverse();
  a.BiomeArtV3.ground(rc,{journey:{levelId:'drownedwharf'},map:{boundary:[]}},
    [{polygons:[roomPoly],design:{deckProfile:'shoal'}}],
    [{polygon:corridorPoly,from:{x:100,y:115},to:{x:240,y:115}}],{x:0,y:0,w:256,h:180});
  for(const [x,y]of [[50,100],[150,110],[220,110]])assert(rc.getImageData(x,y,1,1).data[3]>250,'dry floor union must stay painted');
  assert.equal(rc.getImageData(245,170,1,1).data[3],0,'water stays outside dry floor');
  console.log('PASS raster: reversed-winding corridor overlap remains dry');
  const e=g.enemies.find(v=>v.type==='wharf_crab');
  const p=g.player;p.x=e.x+190;p.y=e.y;
  assert(!g.map.circleBlocked(p.x,p.y,12)&&g.canReach(e,p),'rush test placement');
  g.journey.rooms[e.homeRoom].active=true;e.state='chase';e.attackTimer=2;e.rootRecovery=0;e.stun=0;e.abilityTimers.wharfRush=0;
  g.updateEnemy(e,1/60);
  assert.equal(e.telegraph?.wharfAction,'scrap-rush');assert.equal(e.telegraph?.kind,'lunge');
  assert(e.telegraph.time>.8&&e.telegraph.shapes[0].len===240);
  const id=a.RootCombat.id(e),key=a.SeamlessFloor.key;
  const geometry=game=>JSON.stringify({rooms:game.journey.rooms.map(r=>({polygons:r.polygons,obstacles:r.obstacles})),
    corridors:game.journey.corridors.map(c=>c.polygon),mapPolygons:game.map.polygons,mapObstacles:game.map.obstacles});
  const beforeGeometry=geometry(g);
  g.saveJourney();let saved=JSON.parse(h.env.localStorage.getItem(key));
  assert.equal(saved.enemies.find(v=>v.rvId===id)?.rootState?.telegraph?.wharfAction,'scrap-rush');
  assert(g.resumeSeamlessJourney(),'resume mid rush warning');
  assert.equal(geometry(g),beforeGeometry,'geometry changed after checkpoint reload');
  const rushed=g.enemies.find(v=>v.rvId===id);assert.equal(rushed.telegraph?.wharfAction,'scrap-rush');
  g.resolveTelegraph(rushed);assert.equal(rushed.charge?.damage,.9);
  g.saveJourney();saved=JSON.parse(h.env.localStorage.getItem(key));
  assert.equal(saved.enemies.find(v=>v.rvId===id)?.rootState?.charge?.damage,.9);
  assert(g.resumeSeamlessJourney(),'resume mid rush charge');
  const moving=g.enemies.find(v=>v.rvId===id),start={x:moving.x,y:moving.y};
  for(let i=0;i<40&&moving.charge;i++)g.updateCharge(moving,1/60);
  const travelled=Math.hypot(moving.x-start.x,moving.y-start.y);
  assert(travelled>20,'rush did not actually move');
  assert(travelled<=211,`rush travelled ${travelled} > warned travel 210`);
  assert(!g.map.circleBlocked(moving.x,moving.y,moving.r),'rush stopped on safe floor');
  assert(!moving.charge&&moving.rootRecovery>=.55,'rush recovery');
  console.log(`PASS rush: .9s warning, mid-warning and mid-charge resume, ${travelled.toFixed(1)}px travel <= 210px`);
  // The current physical map supplies an actual wall rather than a mocked collision response.
  let wall=null;
  for(let y=Math.floor(p.y-250);y<p.y+250&&!wall;y+=8)for(let x=Math.floor(p.x-400);x<p.x+400;x+=8)
    if(!g.map.circleBlocked(x,y,moving.r)&&g.map.circleBlocked(x+55,y,moving.r)){wall={x,y};break;}
  assert(wall,'find a real reachable wall edge');
  moving.x=wall.x;moving.y=wall.y;moving.stun=0;
  a.RootCombat.warn(moving,'lunge',[{shape:'lane',x:wall.x,y:wall.y,angle:0,len:240,back:moving.r+8,half:moving.r+14}],.9,{fixed:true,wharf:true,wharfAction:'scrap-rush'});
  g.resolveTelegraph(moving);
  for(let i=0;i<40&&moving.charge;i++)g.updateCharge(moving,1/60);
  assert(moving.x-wall.x<100,'wall stopped rush early');
  assert(!g.map.circleBlocked(moving.x,moving.y,moving.r),'wall stop remains on safe floor');
  console.log(`PASS wall: charge stopped at ${(moving.x-wall.x).toFixed(1)}px`);
  const boss=g.enemies.find(v=>v.type==='wharf_foreman');assert(boss&&boss.isBoss);
  boss.hp=boss.maxHp*.49;boss.phase=1;boss.stun=0;boss.rootRecovery=0;boss.telegraph=null;
  assert(g.updateBossAbilities(boss,.02,200,true));assert.equal(boss.phase,2);
  boss.rootRecovery=0;boss.abilityTimers.wharfSlam=4;boss.abilityTimers.wharfLanes=0;boss.abilityTimers.wharfSweep=5;
  assert(g.updateBossAbilities(boss,.02,230,true));assert.equal(boss.telegraph?.kind,'mirror-lanes');
  assert.equal(boss.telegraph.shapes.length,3);
  assert(a.RootCombat.validState(a.RootCombat.snapshot(boss)));
  const bossId=a.RootCombat.id(boss);g.saveJourney();saved=JSON.parse(h.env.localStorage.getItem(key));
  assert.equal(saved.enemies.find(v=>v.rvId===bossId)?.rootState?.telegraph?.wharf,true);
  assert(g.resumeSeamlessJourney(),'resume phase-II boss warning');
  const resumedBoss=g.enemies.find(v=>v.rvId===bossId);
  assert.equal(resumedBoss.phase,2);assert.equal(resumedBoss.telegraph.kind,'mirror-lanes');
  assert.equal(resumedBoss.telegraph.shapes.length,3);
  console.log('PASS boss: phase-II lanes and timers survive mid-telegraph save/resume');
  const shot=path.join(require('node:os').tmpdir(),'v27-wharf-qa-world.png');
  const screenshotCrab=g.enemies.find(v=>v.rvId===id),screenP=g.player;
  const sr=g.journey.rooms[screenshotCrab.homeRoom];
  screenshotCrab.x=sr.center.x-100;screenshotCrab.y=sr.center.y;
  screenP.x=sr.center.x;screenP.y=sr.center.y+110;
  assert(!g.map.circleBlocked(screenP.x,screenP.y,screenP.r),'screenshot hero must stand on dry reachable floor');
  assert(!g.map.circleBlocked(screenshotCrab.x,screenshotCrab.y,screenshotCrab.r),'screenshot crab placement');
  g.updateSeamlessZones();
  g.camera.x=sr.center.x-512;g.camera.y=sr.center.y-240;
  g.map.updateVisibility(Math.floor(g.player.x/a.TILE),Math.floor(g.player.y/a.TILE));
  h.shot(shot);
  console.log(`PASS QA screenshot ${shot}; routes ${total} sampled reachable cells across three seeds`);
})().catch(error=>{console.error(error);process.exitCode=1;});

/* Read-only physical route audit for seeded v20 floors.
 * Usage: node tools/test-v20-map-reachability.cjs [seed ...]
 */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const zlib = require('node:zlib');
const {harness} = require('./test-room-visual');

const root = path.resolve(__dirname, '..');
const step = 16, radius = 12; // Player.r and actual circleBlocked clearance.
const seeds = process.argv.slice(2).length ? process.argv.slice(2).map(Number) : [42, 731, 987654321];
assert(seeds.length && seeds.every(s => Number.isInteger(s) && s >= 0 && s <= 0xffffffff), 'seeds must be unsigned integers');

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
  const began=Date.now();
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'v20-reach-'));
  try {
    const file=path.join(dir,'base.html');
    fs.writeFileSync(file,zlib.gunzipSync(fs.readFileSync(path.join(root,'adventure-v19-play.html.gz'))));
    const h=await harness({bundle:file});
    vm.runInContext(fs.readFileSync(path.join(__dirname,'v20-maps.js'),'utf8'),h.env,{filename:'v20-maps.js'});
    const levels=vm.runInContext('WorldTour.order',h.env);
    let cases=0, reachable=0, walkable=0;
    for (const seed of seeds) for (const level of levels) {
      // Use the real start routine to activate v20 and inspect the map without
      // moving the hero. The harness keeps its saves in an in-memory Map.
      h.g.startSeamlessJourney(seed,'arator',level,'journey');
      const actual=h.g.journey, map=h.g.map;
      assert.equal(actual.v20MapVersion,20);
      assert.equal(actual.seed,seed);
      const snapshot=JSON.stringify(actual);
      const result=audit(actual,map);
      assert.equal(JSON.stringify(actual),snapshot,'audit changed generated journey');
      cases++; reachable+=result.reachableCells;walkable+=result.walkableCells;
      if(result.failures.length) throw Error(`${level} seed ${seed}: ${result.failures.join('; ')}`);
      console.log(`PASS ${level} seed ${seed}: ${result.reachableCells}/${result.walkableCells} sampled cells reachable`);
    }
    console.log(`PASS v20 physical routes: ${cases} seed/chapter maps, hero radius ${radius}px, ${reachable}/${walkable} sampled cells reachable, ${((Date.now()-began)/1000).toFixed(1)}s`);
  } finally {fs.rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});

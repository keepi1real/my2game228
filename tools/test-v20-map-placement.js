'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),vm=require('node:vm'),zlib=require('node:zlib');
const {harness}=require('./test-room-visual');
const root=path.resolve(__dirname,'..');
function segment(p,a,b) {
  const vx=b[0]-a[0],vy=b[1]-a[1],d=vx*vx+vy*vy;
  const t=d?Math.max(0,Math.min(1,((p.x-a[0])*vx+(p.y-a[1])*vy)/d)):0;
  return Math.hypot(p.x-a[0]-t*vx,p.y-a[1]-t*vy);
}
(async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'v20-placement-'));
  try {
    const file=path.join(dir,'base.html');fs.writeFileSync(file,zlib.gunzipSync(fs.readFileSync(path.join(root,'adventure-v19-play.html.gz'))));
    const h=await harness({bundle:file}),g=h.g;
    for(const name of ['v20-maps.js','v20-map-placement.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,name),'utf8'),h.env,{filename:name});
    const api=h.env.V20MapPlacement,levels=vm.runInContext('WorldTour.order',h.env);
    let marks=0,cases=0;
    const collect=()=>g.journey.rooms.map(r=>api.forRoom(g.journey,r));
    for(const seed of [42,987654321])for(const level of levels){
      g.startSeamlessJourney(seed,'arator',level,'journey');
      const before=JSON.stringify(g.journey),state=g.map.obstacles.slice();
      const first=collect(),serialized=JSON.stringify(first);
      assert.equal(JSON.stringify(g.journey),before,'placement may not change journey');
      assert.deepEqual(g.map.obstacles,state,'collision objects remain unchanged');
      const generated=api.metrics.candidates;
      for(let frame=0;frame<120;frame++)assert.equal(JSON.stringify(collect()),serialized);
      assert.equal(api.metrics.candidates,generated,'no generation during later frames');
      for(let index=0;index<first.length;index++) {
        const room=g.journey.rooms[index];assert(first[index].length<=12);
        for(const p of first[index]) {
          marks++;assert(Object.isFrozen(p));
          assert(Math.hypot(Math.max(0,Math.abs(p.x-room.center.x)-336),Math.max(0,Math.abs(p.y-room.center.y)-168))>=p.radius+28,'reinforcement grid remains clear');
          for(const q of [room.center,room.restPoint,room.chestPoint,room.featurePoint,room.featureUsePoint,{x:room.center.x,y:room.center.y+110}].filter(Boolean))
            assert(Math.hypot(p.x-q.x,p.y-q.y)>=p.radius+100,'mandatory point remains clear');
          for(const c of g.journey.corridors) {
            assert(!h.a.RoomVisualArt.inside(p.x,p.y,c.polygon),'outside corridor');
            c.polygon.forEach((a,i)=>assert(segment(p,a,c.polygon[(i+1)%c.polygon.length])>=p.radius+36,'corridor margin'));
          }
        }
      }
      g.saveJourney();assert(g.resumeSeamlessJourney());assert.equal(JSON.stringify(collect()),serialized,'save/resume determinism');cases++;
    }
    assert(marks>0,'placement must produce visible details');
    assert.equal(api.forRoom({v20MapVersion:19},g.journey.rooms[0]).length,0,'legacy unaffected');
    assert(api.metrics.candidates<=api.metrics.rooms*api.MAX_CANDIDATES,'bounded work');
    console.log('PASS placement:',cases,'seed/chapter cases;',marks,'marks; exact resume, clear spawn/reward/corridors, no geometry writes, 120 cached frames; candidates',api.metrics.candidates);
  } finally {fs.rmSync(dir,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});

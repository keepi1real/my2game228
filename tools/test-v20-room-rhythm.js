'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),vm=require('node:vm'),zlib=require('node:zlib');
const {harness}=require('./test-room-visual');
const root=path.resolve(__dirname,'..');
(async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'v20-rhythm-'));
  try{
    const file=path.join(dir,'base.html');fs.writeFileSync(file,zlib.gunzipSync(fs.readFileSync(path.join(root,'adventure-v19-play.html.gz'))));
    const h=await harness({bundle:file}),g=h.g;
    for(const name of ['v20-maps.js','v20-map-placement.js','v20-map-art.js','v20-room-rhythm.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,name),'utf8'),h.env,{filename:name});
    const api=h.env.V20RoomRhythm,placement=h.env.V20MapPlacement;
    const installed=vm.runInContext('BiomeArtV3.ground',h.env);
    vm.runInContext(fs.readFileSync(path.join(__dirname,'v20-room-rhythm.js'),'utf8'),h.env);
    assert.equal(installed,vm.runInContext('BiomeArtV3.ground',h.env),'idempotent installation');
    const collect=()=>g.journey.rooms.map(r=>api.forRoom(g.journey,r));
    let checked=0,marks=0;
    for(const level of vm.runInContext('WorldTour.order',h.env))for(const seed of [42,987654321]){
      g.startSeamlessJourney(seed,'arator',level,'journey');
      if(!checked)g.renderer.render(); // Exercise the real Canvas wrapper too.
      const before=JSON.stringify(g.journey),obstacles=JSON.stringify(g.map.obstacles);
      const first=collect(),serialized=JSON.stringify(first);
      for(let id=0;id<first.length;id++){
        const room=g.journey.rooms[id],slots=placement.forRoom(g.journey,room);
        assert(first[id].length<=api.quotas[room.role],`bounded density: ${level}/${id}`);
        for(const mark of first[id]){
          marks++;assert(Object.isFrozen(mark));
          assert(slots.some(p=>p.x===mark.x&&p.y===mark.y&&mark.radius<=p.radius),'mark occupies safe placement slot');
        }
      }
      assert.equal(JSON.stringify(g.journey),before,'read-only generation');
      assert.equal(JSON.stringify(g.map.obstacles),obstacles,'collision unchanged');
      g.saveJourney();assert(g.resumeSeamlessJourney());
      assert.equal(JSON.stringify(collect()),serialized,'same marks after resume');
      checked++;
    }
    assert(marks>0);assert.equal(api.forRoom({v20MapVersion:19},g.journey.rooms[1]).length,0,'legacy disabled');
    console.log(`PASS rhythm: ${checked} seed/chapter pairs; ${marks} safe cues; exact save/resume; legacy disabled.`);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});

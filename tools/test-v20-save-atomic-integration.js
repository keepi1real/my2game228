'use strict';
const fs=require('node:fs'),vm=require('node:vm'),zlib=require('node:zlib'),assert=require('node:assert/strict'),path=require('node:path'),os=require('node:os');
const {harness}=require('./test-room-visual');
const root=path.resolve(__dirname,'..');
(async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'v20-atomic-'));
  try {
    const file=path.join(dir,'base.html');fs.writeFileSync(file,zlib.gunzipSync(fs.readFileSync(path.join(root,'adventure-v19-play.html.gz'))));
    const h=await harness({bundle:file}),g=h.g;
    g.startSeamlessJourney(44,'arator','glass','journey');g.saveJourney();
    const legacy=vm.runInContext('SeamlessFloor.key',h.env),old=h.storage.get(legacy);
    for(const name of ['v20-storage','v20-maps'])vm.runInContext(fs.readFileSync(path.join(__dirname,name+'.js'),'utf8'),h.env);
    let writes=0,fail=false;const native=h.env.localStorage.setItem;
    h.env.localStorage.setItem=function(key,value){
      if(key==='undermountain-biomes-v20-preview'){writes++;if(fail)throw Error('quota');}
      return native.call(this,key,value);
    };
    vm.runInContext(fs.readFileSync(path.join(__dirname,'v20-save-atomic.js'),'utf8'),h.env);
    g.startSeamlessJourney(77,'arator','glass','journey');writes=0;g.saveJourney();assert.equal(writes,1);
    const key=vm.runInContext('SeamlessFloor.key',h.env),raw=h.storage.get(key);
    assert.equal(JSON.parse(raw).mapVersion,20);
    const geometry=()=>JSON.stringify(g.journey.rooms.map(r=>[r.polygons,r.obstacles]));
    const before=geometry();assert(g.resumeSeamlessJourney());assert.equal(geometry(),before);
    fail=true;g.player.gold+=77;g.saveJourney();assert.equal(h.storage.get(key),raw);
    assert(g.resumeSeamlessJourney());assert.equal(g.player.gold,JSON.parse(raw).player.gold);
    assert.equal(h.storage.get(legacy),old);
    console.log('PASS actual Game atomic save: one write, marker, exact geometry resume, quota preserves checkpoint/gold, legacy unchanged.');
  } finally {fs.rmSync(dir,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});

/* Checkpoint geometry from the published v21 route must survive route revision 2. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),vm=require('node:vm'),zlib=require('node:zlib');
const {harness}=require('./test-room-visual');
const {extendChapter}=require('./v20-chapter-extension.cjs');
const root=path.resolve(__dirname,'..');
const read=name=>fs.readFileSync(path.join(__dirname,name),'utf8');
const apply=(h,name)=>{h.env.document.head??={appendChild(){}};vm.runInContext(read(name),h.env,{filename:name});};
const geometry=g=>JSON.stringify({rooms:g.journey.rooms.map(r=>({links:r.links,obstacles:r.obstacles})),corridors:g.journey.corridors});

(async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'v21-old-route-'));
  try{
    const base=zlib.gunzipSync(fs.readFileSync(path.join(root,'adventure-v19-play.html.gz'))).toString();
    const published=JSON.parse(read('fixtures/v21-published-level.json'));
    const revised=JSON.parse(read('v21-tide-observatory-level.json'));
    assert.notDeepEqual(published.edges,revised.edges,'fixture is the older published layout');
    const oldFile=path.join(dir,'old.html'),newFile=path.join(dir,'new.html');
    fs.writeFileSync(oldFile,extendChapter(base,published));
    fs.writeFileSync(newFile,extendChapter(base,revised));
    const old=await harness({bundle:oldFile}),fresh=await harness({bundle:newFile});
    const manifest=JSON.parse(read('v20-manifest.json'));
    const stack=manifest.patches.filter(p=>!p.id.startsWith('v21')&&!p.file.startsWith('v21-'));
    for(const h of [old,fresh])for(const p of stack){
      if(p.file==='v20-save-atomic.js'){apply(h,'v21-preview-start.js');apply(h,'v21-tide-observatory-runtime.js');}
      apply(h,p.file);
    }
    old.g.startSeamlessJourney(42,'arator','tideobservatory','journey');
    fresh.g.startSeamlessJourney(42,'arator','tideobservatory','journey');
    const oldMap=old.g.map,newMap=fresh.g.map;
    const removed=published.edges.filter(([a,b])=>!revised.edges.some(([x,y])=>x===a&&y===b));
    let corridorPoint;
    for(const [a,b] of removed){
      const from=old.g.journey.rooms[a].center,to=old.g.journey.rooms[b].center;
      for(const t of [.35,.45,.5,.55,.65]){
        const x=from.x+(to.x-from.x)*t,y=from.y+(to.y-from.y)*t;
        if(!oldMap.circleBlocked(x,y,12)&&newMap.circleBlocked(x,y,12)){corridorPoint={x,y,a,b};break;}
      }
      if(corridorPoint)break;
    }
    assert(corridorPoint,'published route must include a walkable position missing from revised route');
    old.g.player.x=corridorPoint.x;old.g.player.y=corridorPoint.y;
    old.g.journey.rooms[5].visited=true;old.g.journey.rooms[5].discovered=true;
    old.g.saveJourney();
    const checkpoint=JSON.parse(old.storage.get('undermountain-biomes-v20-preview'));
    // The published runtime did not serialize routeRevision.
    delete checkpoint.routeRevision;
    const original=JSON.stringify(checkpoint),key='undermountain-biomes-v20-preview';
    fresh.storage.set(key,original);
    assert(fresh.g.resumeSeamlessJourney(),'published checkpoint resumes from removed corridor');
    assert.equal(fresh.g.player.x,corridorPoint.x);assert.equal(fresh.g.player.y,corridorPoint.y);
    assert.equal(geometry(fresh.g),geometry(old.g),'old room links, corridors and obstacles survive reconstruction');
    assert.equal(fresh.g.journey.v21RouteRevision,1);
    assert(fresh.g.journey.rooms[5].visited,'room progress survives');
    assert.deepEqual(JSON.parse(fresh.storage.get(key)),checkpoint,'resume leaves the checkpoint intact');
    fresh.g.saveJourney();
    assert.equal(JSON.parse(fresh.storage.get(key)).routeRevision,undefined,'old route stays old after save');
    assert(fresh.g.resumeSeamlessJourney(),'old layout survives repeat save and resume');
    assert.equal(geometry(fresh.g),geometry(old.g));
    const invalid=JSON.parse(original);invalid.player.x=0;invalid.player.y=0;
    const invalidRaw=JSON.stringify(invalid);fresh.storage.set(key,invalidRaw);
    assert.equal(fresh.g.resumeSeamlessJourney(),false,'invalid old checkpoint is rejected');
    assert.equal(fresh.storage.get(key),invalidRaw,'failed resume leaves the original checkpoint untouched');
    assert.equal(vm.runInContext("JSON.stringify(ExpeditionLevels.get('tideobservatory').edges)",fresh.env),JSON.stringify(revised.edges),'failed resume restores new registry edges');
    fresh.g.startSeamlessJourney(42,'arator','tideobservatory','journey');fresh.g.saveJourney();
    assert.equal(JSON.parse(fresh.storage.get(key)).routeRevision,2,'fresh run uses revised route marker');
    assert(fresh.g.resumeSeamlessJourney());assert.equal(fresh.g.journey.v21RouteRevision,2);
    assert.equal(fresh.g.journey.corridors.length,revised.edges.length);
    console.log(`PASS published v21 checkpoint in removed corridor ${corridorPoint.a}-${corridorPoint.b} resumes with original geometry; progress and repeated saves survive; fresh runs use routeRevision 2.`);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});

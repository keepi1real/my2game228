'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),vm=require('node:vm'),zlib=require('node:zlib'),assert=require('node:assert/strict');
const {harness}=require('./test-room-visual');
const {extendChapter}=require('./v20-chapter-extension.cjs');
const root=path.resolve(__dirname,'..'), ID='tideobservatory';
const legacyKey='undermountain-biomes-v3', mainKey='undermountain-biomes-v20-preview', previewKey='undermountain-biomes-v21-observatory-preview';
const read=name=>fs.readFileSync(path.join(__dirname,name),'utf8');
const apply=(h,name)=>{h.env.document.head??={appendChild(){}};return vm.runInContext(read(name),h.env,{filename:name});};
const geometry=g=>JSON.stringify({rooms:g.journey.rooms.map(r=>({id:r.id,role:r.role,center:r.center,polygons:r.polygons,obstacles:r.obstacles,links:r.links})),corridors:g.journey.corridors,spawn:[g.player.x,g.player.y]});
(async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'v21-compat-'));
 try {
  const original=zlib.gunzipSync(fs.readFileSync(path.join(root,'adventure-v19-play.html.gz'))).toString();
  const definition=JSON.parse(read('v21-tide-observatory-level.json'));
  assert.throws(()=>extendChapter(original+' ',definition),/pinned/);
  const baseFile=path.join(dir,'base.html'),newFile=path.join(dir,'new.html');
  fs.writeFileSync(baseFile,original);fs.writeFileSync(newFile,extendChapter(original,definition));
  const old=await harness({bundle:baseFile}), fresh=await harness({bundle:newFile});
  const chapters=vm.runInContext('Array.from(WorldTour.order)',old.env);
  // Capture genuine v19 checkpoints before applying any extension patches.
  const legacy=[];
  for(const id of chapters){old.g.startSeamlessJourney(731,'arator',id,'journey');old.g.saveJourney();legacy.push({id,raw:old.storage.get(legacyKey),geometry:geometry(old.g)});}
  const manifest=JSON.parse(read('v20-manifest.json'));
  // Test the current v20 patch stack, with v21 patches applied deliberately below.
  const stack=manifest.patches.filter(p=>!p.id.startsWith('v21')&&!p.file.startsWith('v21-'));
  for(const h of [old,fresh])for(const p of stack){if(h===fresh&&p.file==='v20-save-atomic.js'){apply(h,'v21-preview-start.js');assert.equal(vm.runInContext('SeamlessFloor.key',h.env),mainKey);apply(h,'v21-tide-observatory-runtime.js');}apply(h,p.file);}
  if(fs.existsSync(path.join(__dirname,'v21-tide-observatory-art.js')))apply(fresh,'v21-tide-observatory-art.js');
  for(const item of legacy){fresh.storage.set(mainKey,item.raw);assert(fresh.g.resumeSeamlessJourney(),'v19 resume '+item.id);assert.equal(geometry(fresh.g),item.geometry,'v19 geometry '+item.id);assert(!fresh.g.journey.v21MapVersion,'old save gained chapter marker');}
  for(const id of chapters){
   old.g.startSeamlessJourney(42,'arator',id,'journey');old.g.saveJourney();const raw=old.storage.get(mainKey),before=geometry(old.g);
   fresh.storage.set(mainKey,raw);assert(fresh.g.resumeSeamlessJourney(),'v20 resume '+id);assert.equal(geometry(fresh.g),before,'v20 geometry '+id);assert(!fresh.g.journey.v21MapVersion);
   fresh.g.startSeamlessJourney(42,'arator',id,'journey');assert.equal(geometry(fresh.g),before,'fresh old chapter geometry '+id);
  }
  assert.equal(vm.runInContext("AdventureRun.next({layoutVersion:16,levelId:'ashen'})",fresh.env),null);
  fresh.g.startSeamlessJourney(99,'arator','ashen','journey');fresh.g.saveJourney();
  assert.equal(JSON.parse(fresh.storage.get(mainKey)).chapterVersion,21);
  assert(fresh.g.resumeSeamlessJourney());assert.equal(fresh.g.journey.v21MapVersion,21);
  assert.equal(vm.runInContext('AdventureRun.next(game.journey)',fresh.env),ID);
  fresh.g.journey.rooms[15].cleared=true;assert(fresh.g.descendSeamlessFloor());assert.equal(fresh.g.journey.levelId,ID);assert.equal(fresh.g.floor,11);
  const newGeometry=geometry(fresh.g);fresh.g.saveJourney();assert(fresh.g.resumeSeamlessJourney());assert.equal(geometry(fresh.g),newGeometry);assert.equal(fresh.g.journey.v21MapVersion,21);assert.equal(vm.runInContext('AdventureRun.next(game.journey)',fresh.env),null);
  assert.equal(fresh.g.journey.rooms.length,16);assert.equal(fresh.g.journey.rooms[15].role,'boss');
  fresh.g.renderer.render();
  // The preview key switches only for the explicit new chapter debug URL.
  const preview=await harness({bundle:newFile});preview.env.URLSearchParams=URLSearchParams;preview.env.location={search:'?debug=1&map=tideobservatory'};
  preview.storage.set(legacyKey,'legacy sentinel');preview.storage.set(mainKey,'main sentinel');
  let failNative=false,nativeWrites=0;const nativeSet=preview.env.localStorage.setItem;preview.env.localStorage.setItem=function(key,value){if(key===previewKey){if(failNative)throw Error('quota');nativeWrites++;}return nativeSet.call(this,key,value);};
  for(const p of stack){if(p.file==='v20-save-atomic.js'){apply(preview,'v21-preview-start.js');apply(preview,'v21-tide-observatory-runtime.js');}apply(preview,p.file);}
  assert.equal(vm.runInContext('SeamlessFloor.key',preview.env),previewKey);
  preview.g.startSeamlessJourney(21,'arator',ID,'journey');const previewGeometry=geometry(preview.g);nativeWrites=0;preview.g.saveJourney();assert.equal(nativeWrites,1,'one atomic preview write');assert(preview.g.resumeSeamlessJourney());assert.equal(geometry(preview.g),previewGeometry);
  const saved=preview.storage.get(previewKey);failNative=true;
  preview.g.player.gold+=100;preview.g.saveJourney();assert.equal(preview.storage.get(previewKey),saved);assert(preview.g.resumeSeamlessJourney());assert.equal(preview.g.player.gold,JSON.parse(saved).player.gold);
  assert.equal(preview.storage.get(legacyKey),'legacy sentinel');assert.equal(preview.storage.get(mainKey),'main sentinel');assert.equal(JSON.parse(preview.storage.get(previewKey)).chapterVersion,21);
  console.log('PASS 10 genuine v19 saves + 10 v20 saves preserve geometry, fresh old maps unchanged, marker survives ashen reload, chapter 11 descent/save/resume/render, isolated playable preview checkpoint.');
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});

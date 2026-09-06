'use strict';
const fs=require('fs'),os=require('os'),path=require('path'),vm=require('vm'),assert=require('assert');
const {install}=require('./install-room-visual');
const root=path.resolve(__dirname,'..'),tmp=fs.mkdtempSync(path.join(os.tmpdir(),'room-visual-install-'));
try{
  for(const v6 of [false,true]){
    const target=path.join(tmp,v6?'v6':'main');fs.mkdirSync(path.join(target,'js'),{recursive:true});
    for(const file of ['game.js','render.js','visual-assets.js',...(v6?['room-floor.js','room-save.js']:[])])fs.writeFileSync(path.join(target,'js',file),'// Existing project file');
    const index='<html><head></head><body><script src="js/main.js"></script></body></html>';fs.writeFileSync(path.join(target,'index.html'),index);
    fs.mkdirSync(path.join(target,'assets/rooms'),{recursive:true});fs.writeFileSync(path.join(target,'assets/rooms/crown.png'),'existing boss art');
    const result=install(target,root);assert(result.mode.includes(v6?'v6':'current'));
    const html=fs.readFileSync(path.join(target,'index.html'),'utf8');assert(html.includes('js/room-visual-art.js'));assert(html.includes(v6?'js/room-visual-v6.js':'js/room-visual-preview.js'));
    assert.equal(fs.readFileSync(path.join(target,'assets/rooms/crown.png'),'utf8'),'existing boss art');
    assert.equal(fs.readFileSync(path.join(target,'js/game.js'),'utf8'),'// Existing project file');
    install(target,root);assert.equal(fs.readFileSync(path.join(target,'index.html'),'utf8'),html,'Idempotent installation');
    assert.equal(fs.readdirSync(target).filter(f=>f.startsWith('index-before-')).length,1);
    fs.writeFileSync(path.join(target,'assets/room-visual-v1/gallery.png'),'custom image');
    assert.throws(()=>install(target,root),/Existing file differs/);assert.equal(fs.readFileSync(path.join(target,'index.html'),'utf8'),html);
  }
  const calls=[],oldBoss={},context={ROOM_ART:{gallery:{},crown:oldBoss},PAINTED_ROOM_CACHE:new Map([['gallery',1],['crown',2]]),
    RoomVisualArt:{image:{newArt:true},ground:()=>calls.push('ground'),flames:(_c,_t,front)=>calls.push(front?'front-fire':'rear-fire'),columnShadow:()=>calls.push('shadow'),drawColumn:()=>calls.push('column')},
    roomTemplate:id=>({scene:id}),drawRoomHazards:()=>calls.push('hazards'),drawRoomForeground:()=>calls.push('foreground'),drawRoomObstacle:()=>calls.push('old-column'),game:{time:3}};
  context.window=context;vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(root,'js/room-visual-v6.js'),'utf8'),context);
  assert.strictEqual(context.ROOM_ART.crown,oldBoss);assert(context.ROOM_ART.gallery.newArt);assert(!context.PAINTED_ROOM_CACHE.has('gallery'));assert(context.PAINTED_ROOM_CACHE.has('crown'));
  context.drawRoomHazards({}, {map:{paintedRoom:'gallery'},time:2});assert.deepStrictEqual(calls,['ground','rear-fire','hazards']);
  calls.length=0;context.drawRoomObstacle({}, {kind:'column'},{});assert.deepStrictEqual(calls,['shadow','column']);
  calls.length=0;context.drawRoomHazards({}, {map:{paintedRoom:'crown'},time:2});context.drawRoomObstacle({}, {kind:'column'},{});assert.deepStrictEqual(calls,['hazards','old-column']);
  console.log('PASS: main/v6 adapter selection, non-destructive installation, idempotence, collision-safe art-only adapter contract and boss-art preservation.');
}finally{fs.rmSync(tmp,{recursive:true,force:true});}

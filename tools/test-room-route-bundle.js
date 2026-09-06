'use strict';
const path=require('path'),vm=require('vm'),assert=require('assert');
const {harness}=require('./test-room-visual');
(async()=>{
  const h=await harness({bundle:path.resolve(__dirname,'../dist/room-route/rogue-route-v1.html')});
  vm.runInContext('startGame()',h.env);const g=h.env.game;
  assert(g.journey&&g.journey.rooms.length===16&&g.state==='run','standalone opens directly in the playable route');
  for(const id of [g.journey.start,8,15]){g.enterJourneyRoom(id);assert(g.map.template.image.complete);assert.equal(g.map.template.image.width,1536);g.journey.transition=0;g.renderer.render();}
  assert(typeof h.env.lastFrame==='function','main animation loop scheduled');
  h.env.lastFrame(16);assert(g.runStats.time>0,'main loop updates game');
  console.log('PASS: standalone main entry, all embedded room images and frame loop (native Canvas).');
})().catch(e=>{console.error(e);process.exitCode=1;});

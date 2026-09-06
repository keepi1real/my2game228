'use strict';
// Production Canvas captures. Camera and encounter positions are staged.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const {createCanvas}=require('@napi-rs/canvas'),{harness}=require('./test-room-visual'),{buttons}=require('./test-native-buttons');
const out=path.resolve(__dirname,'../dist/expedition-v11');
(async()=>{
  fs.mkdirSync(out,{recursive:true});const h=await harness({ui:buttons()}),g=h.g,{SeamlessFloor:S,AdventureProgress:A}=vm.runInContext('({SeamlessFloor,AdventureProgress})',h.env);
  function shot(name){if(g.journey)g.journey.noticeTime=0;g.renderer.render();fs.writeFileSync(path.join(out,name+'.png'),h.canvas.toBuffer('image/png'));}
  function place(q){assert(!g.map.circleBlocked(q.x,q.y,12));Object.assign(g.player,{x:q.x,y:q.y});g.camera={x:Math.max(0,Math.min(S.width-1024,q.x-512)),y:Math.max(0,Math.min(S.height-640,q.y-340))};g.updateSeamlessZones();g.map.updateVisibility(Math.floor(q.x/32),Math.floor(q.y/32));}
  g.time=6;shot('menu-v11');
  for(const level of ['amber','glass']){
    g.startSeamlessJourney(42,level==='amber'?'baldin':'faelas',level);g.player.invulnTime=999;
    const court=g.journey.rooms[1];place({x:court.center.x,y:court.center.y+100});g.update(1/60);shot(level+'-court');
    const r=g.journey.rooms[15],e=g.enemies.find(e=>e.isBoss);Object.assign(e,{x:r.center.x,y:r.center.y,attackTimer:99});place({x:r.center.x+140,y:r.center.y+35});
    for(const k in e.abilityTimers)e.abilityTimers[k]=99;e.abilityTimers[level==='amber'?'royalCleave':'mirrorLanes']=0;g.updateBossAbilities(e,1/60,145,true);for(let i=0;i<30;i++)g.update(1/60);shot(level+'-boss');
    const whole=createCanvas(1421,1210),c=whole.getContext('2d'),old=g.renderer.ctx;g.renderer.ctx=c;c.scale(1421/S.width,1210/S.height);
    try{g.renderer.drawSeamlessWorld({x:0,y:0,w:S.width,h:S.height});}finally{g.renderer.ctx=old;}
    fs.writeFileSync(path.join(out,level+'-entire-floor.png'),whole.toBuffer('image/png'));g.journey.rooms.forEach(r=>r.discovered=true);g.ui.showJourneyMap();shot(level+'-route');g.toMenu();
  }
  g.startSeamlessJourney(42,'mithrandir','glass');g.ui.showTalents();for(const id of ['focus','weave','vigor'])A.learn(g,id);shot('talents-desktop');h.env.innerWidth=390;h.env.innerHeight=844;g.talentBranch='arcana';g.ui.showTalents();shot('talents-phone');g.closeTalents();h.env.innerWidth=1024;h.env.innerHeight=640;
  const r=g.journey.rooms[6];place(r.center);for(const e of g.enemies)if(e.homeRoom===6)e.alive=false;g.updateSeamlessZones();place(r.rewardPoint);g.journeyInteract(g.journeyTargets().find(t=>t.kind==='relic'&&t.homeRoom===6));shot('artifact-choice');
  fs.writeFileSync(path.join(out,'render-info.json'),JSON.stringify({version:11,floors:8,rooms:128,talents:12,uniqueArtifacts:6,newMobs:4,newBosses:2,source:'Production Canvas with staged camera and encounters',browserTested:false,androidTested:false},null,2));console.log('Captured 12 production-rendered previews.');
})().catch(e=>{console.error(e);process.exitCode=1;});

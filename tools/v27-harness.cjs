'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm');
const {assemble,ids,root}=require('./v27-build.cjs');
const {harness}=require('./test-room-visual.js');
async function boot(options={}){
  const teams=options.teams||[options.team||'wharf'];
  const roots=options.roots||Object.fromEntries(teams.map(t=>[t,options.root||root]));
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'v27-test-')),bundle=path.join(temp,'game.html');
  try{
    assemble({teams,roots,out:bundle});
    const h=await harness({bundle});
    h.a=vm.runInContext('({Game,Save,SeamlessFloor,AdventureRun,EncounterDirector,RootCombat,ActorMotion,MONSTERS,BOSSES,HEROES,HERO_BY_ID,ExpeditionLevels,RoomCraft,BiomeV3,BiomeArtV3,WorldDetail,Renderer,UI,RoomVisualArt,TILE,T_FLOOR})',h.env);
    h.g.startSeamlessJourney(options.seed??42,options.hero||'arator',options.level||ids[teams[0]],options.difficulty||'journey');
    await h.settleImages();
    h.step=(seconds=1)=>{for(let i=0;i<Math.ceil(seconds*60);i++)h.g.update(1/60);};
    h.shot=file=>{h.g.banner=null;h.g.messages=[];h.g.shake=0;h.g.renderer.render();fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,h.canvas.toBuffer('image/png'));};
    return h;
  }finally{fs.rmSync(temp,{recursive:true,force:true});}
}
module.exports={boot,assemble,ids,root};

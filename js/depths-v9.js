'use strict';
// Chapters V and VI share the warning/hit geometry and paused save state of
// the existing bestiary. Their bosses remain separate from the campaign pool.
Object.assign(BOSSES,{
  tidewarden:{id:'tidewarden',name:'Хранитель прилива',symbol:'П',shape:'hex',color:'#a5ddd1',size:30,hp:1180,dmg:22,speed:78,armor:4,xp:660,shards:50,gold:[125,185],sight:750,attackRange:96,attackCd:3.2,windup:1,abilities:{undertow:7.5,surge:5.8},rootvault:true,pattern:'sweep'},
  sunforger:{id:'sunforger',name:'Кузнец затмения',symbol:'К',shape:'hex',color:'#efbb83',size:30,hp:1380,dmg:25,speed:62,armor:5,xp:780,shards:65,gold:[160,220],sight:750,attackRange:96,attackCd:3.5,windup:1,abilities:{hammerRain:10,spokes:7},rootvault:true,pattern:'sweep'},
});
BestiaryArt.specs.tidewarden={rect:[24,512,536,500],height:184,image:BiomeArtV3.tideSheet};
BestiaryArt.specs.sunforger={rect:[10,512,460,506],height:192,image:BiomeArtV3.forgeSheet};

const DepthsChapter=(()=>{
  const active=g=>g?.journey?.seamless&&['tide','sunforge'].includes(g.journey.levelId);
  const hints={'tidal-ring':['ПРИЛИВ: УКРОЙСЯ','ВНУТРИ КОЛЬЦА'],'tidal-fan':['ВОЛНЫ: УЙДИ ЗА СПИНУ','ИЛИ В ПРОМЕЖУТОК'],'hammerfall':['СЛЕДУЮЩИЙ УДАР','ОТМЕЧАЕТ НОВОЕ МЕСТО'],'solar-spokes':['ПРОЙДИ МЕЖДУ','ОГНЕННЫМИ ЛУЧАМИ']};
  function hammer(g,e){
    RootCombat.warn(e,'hammerfall',[{shape:'circle',x:g.player.x,y:g.player.y,r:e.phase===2?68:60}],e.phase===2?1.1:1.3,{fixed:true});
    e.attackTimer=Math.max(e.attackTimer,2);
  }
  return {active,hints,hammer};
})();
const depthsBoss=Game.prototype.updateBossAbilities;
Game.prototype.updateBossAbilities=function(e,dt,d,los){
  if(!['tidewarden','sunforger'].includes(e.type))return depthsBoss.call(this,e,dt,d,los);
  if(this.state!=='run'||e.stun>0||e.rootRecovery>0)return false;
  if(e.hp<=e.maxHp*.5&&e.phase===1){e.phase=2;this.message(e.type==='tidewarden'?'Прилив усиливается: волны расходятся веером!':'Чёрное Солнце пробудилось: три удара молота!');}
  for(const key in e.abilityTimers)e.abilityTimers[key]-=dt*(e.phase===2?1.15:1);
  if(!los||d>440||this.player.isInvisible())return false;
  const p=this.player,angle=Math.atan2(p.y-e.y,p.x-e.x);
  if(e.type==='tidewarden'){
    if(e.abilityTimers.undertow<=0){
      e.abilityTimers.undertow=e.def.abilities.undertow;
      RootCombat.warn(e,'tidal-ring',[{shape:'ring',x:e.x,y:e.y,inner:e.phase===2?76:96,r:e.phase===2?260:235}],1.3,{fixed:true});return true;
    }
    if(e.abilityTimers.surge<=0){
      e.abilityTimers.surge=e.def.abilities.surge;
      RootCombat.warn(e,'tidal-fan',(e.phase===2?[-.92,0,.92]:[0]).map(offset=>({shape:'cone',x:e.x,y:e.y,angle:angle+offset,r:295,half:.37})),e.phase===2?1.2:1.1,{fixed:true});return true;
    }
  }else{
    if(e.depthCombo>0){e.depthCombo--;DepthsChapter.hammer(this,e);return true;}
    if(e.abilityTimers.hammerRain<=0){e.abilityTimers.hammerRain=e.def.abilities.hammerRain;e.depthCombo=e.phase===2?2:1;DepthsChapter.hammer(this,e);return true;}
    if(e.abilityTimers.spokes<=0){
      e.abilityTimers.spokes=e.def.abilities.spokes;
      RootCombat.warn(e,'solar-spokes',[0,1,2,3].map(i=>({shape:'lane',x:e.x,y:e.y,angle:i*Math.PI/2+(e.phase===2?Math.PI/4:0),len:285,half:21})),e.phase===2?1.25:1.45,{fixed:true});return true;
    }
  }return false;
};
const depthsEnemy=Game.prototype.updateEnemy,depthsKill=Game.prototype.killEnemy;
Game.prototype.updateEnemy=function(e,dt){if(e.type==='sunforger'&&e.stun>0)e.depthCombo=0;return depthsEnemy.call(this,e,dt);};
Game.prototype.killEnemy=function(e){if(e.type==='sunforger')e.depthCombo=0;return depthsKill.call(this,e);};

const depthsWorld=Renderer.prototype.drawSeamlessWorld;
Renderer.prototype.drawSeamlessWorld=function(view){
  depthsWorld.call(this,view);const g=this.g;if(!DepthsChapter.active(g))return;
  const c=this.ctx,time=g.motionClock||0,tide=g.journey.levelId==='tide';c.save();
  for(let i=0;i<28;i++){
    const x=view.x+(i*181+time*(tide?5:13))%view.w,y=view.y+((i*109-time*(tide?3:24))%view.h+view.h)%view.h;
    if(g.map.floorContains(x,y))continue;
    if(tide){c.strokeStyle='rgba(127,210,196,.12)';c.lineWidth=1;c.beginPath();c.ellipse(x,y,12+(i%4)*4,3+(i%3),-.15,0,Math.PI*1.5);c.stroke();}
    else {c.fillStyle=i%3?'rgba(245,158,83,.32)':'rgba(253,213,137,.55)';c.fillRect(x,y,1.5,3);}
  }c.restore();
};
const depthsRender=Renderer.prototype.render;
Renderer.prototype.render=function(){
  depthsRender.call(this);const g=this.g;if(!DepthsChapter.active(g)||g.state!=='run')return;const e=g.boss,t=e?.telegraph;
  if(!t||t.type!=='root'||dist(e.x,e.y,g.player.x,g.player.y)>=1000)return;
  const lines=DepthsChapter.hints[t.kind]||['ТЯЖЁЛЫЙ ЗАМАХ','УЙДИ ИЗ СЕКТОРА'];RoutePaint.plate(this.ctx,756,78,254,45);
  lines.forEach((line,i)=>RoutePaint.text(this.ctx,line,883,93+i*16,'#ffdfa3',10));
};


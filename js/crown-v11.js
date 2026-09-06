'use strict';
Object.assign(MONSTERS,{
  tombguard:{name:'Могильный страж',symbol:'С',shape:'hex',color:'#cfa772',size:23,hp:125,dmg:19,speed:72,armor:4,xp:42,shards:3,gold:[9,16],sight:600,attackRange:98,attackCd:3.1,windup:1.1,minFloor:99,weight:0,rootvault:true,pattern:'sweep'},
  censer:{name:'Кадильщик династии',symbol:'К',shape:'circle',color:'#dbb181',size:16,hp:62,dmg:12,speed:86,xp:35,shards:3,gold:[7,13],sight:600,attackRange:310,attackCd:3.8,windup:1.15,keepDistance:220,ranged:true,projSpeed:200,minFloor:99,weight:0,rootvault:true,pattern:'censer'},
  glassduelist:{name:'Стеклянный дуэлянт',symbol:'Д',shape:'tri',color:'#c8b5e0',size:15,hp:74,dmg:14,speed:154,armor:1,xp:38,shards:3,gold:[8,14],sight:600,attackRange:200,attackCd:3,windup:.8,minFloor:99,weight:0,rootvault:true,pattern:'lunge'},
  prismmoth:{name:'Призматическая моль',symbol:'М',shape:'diamond',color:'#d5c8e9',size:14,hp:51,dmg:12,speed:108,xp:32,shards:3,gold:[6,13],sight:600,attackRange:315,attackCd:3,windup:.95,keepDistance:205,ranged:true,projSpeed:245,projColor:'#c8b4f0',minFloor:99,weight:0,rootvault:true,pattern:'fan'},
});
Object.assign(BOSSES,{
  amberking:{id:'amberking',name:'Янтарный царь',symbol:'Ц',shape:'hex',color:'#e2b46b',size:30,hp:1540,dmg:26,speed:68,armor:6,xp:850,shards:70,gold:[180,235],sight:750,attackRange:96,attackCd:3.4,windup:1,abilities:{royalCleave:6.8,burialSeals:9},rootvault:true,pattern:'sweep'},
  glassregent:{id:'glassregent',name:'Хранительница отражений',symbol:'Л',shape:'hex',color:'#d8bce9',size:30,hp:1720,dmg:24,speed:92,armor:3,xp:960,shards:85,gold:[200,265],sight:750,attackRange:96,attackCd:3,windup:1,abilities:{mirrorLanes:7,petalRings:9.5},rootvault:true,pattern:'sweep'},
});
BestiaryArt.specs.amberking={rect:[40,405,357,450],height:206,image:BiomeArtV3.amberSheet,clip:[[40,405],[135,405],[140,428],[397,428],[397,855],[40,855]]};
BestiaryArt.specs.tombguard={rect:[429,437,405,410],height:102,image:BiomeArtV3.amberSheet};
BestiaryArt.specs.censer={rect:[898,407,314,443],height:94,image:BiomeArtV3.amberSheet,clip:[[970,407],[1050,407],[1050,426],[1212,426],[1212,850],[898,850],[898,426],[970,426]]};
BestiaryArt.specs.glassregent={rect:[11,420,415,421],height:198,image:BiomeArtV3.glassSheet};
BestiaryArt.specs.glassduelist={rect:[448,430,349,414],height:94,image:BiomeArtV3.glassSheet};
BestiaryArt.specs.prismmoth={rect:[831,431,411,365],height:103,image:BiomeArtV3.glassSheet};
const CrownChapter=(()=>{
  const active=g=>g.journey?.seamless&&['amber','glass'].includes(g.journey.levelId);
  const hints={'royal-cleave':['ЗАМАХ ЦАРЯ','ЗАЙДИ ЗА СПИНУ'],'burial-seals':['ПОГРЕБАЛЬНЫЕ ПЕЧАТИ','ВЫЙДИ ИЗ КРУГОВ'],'mirror-lanes':['ЛУЧИ ОТРАЖЕНИЙ','ПОКИНЬ ПЕРЕСЕЧЕНИЕ'],'petal-rings':['ЛУННЫЕ ВЕНЦЫ','ИЩИ ЦЕНТР ИЛИ ПРОМЕЖУТОК']};
  return {active,hints};
})();
const crownHit=Game.prototype.hitEnemy;
Game.prototype.hitEnemy=function(e,dmg,opts={}){
  // The shield is raised during a visible, locked windup. Flank or stun it.
  if(e.type==='tombguard'&&e.stun<=0&&e.telegraph?.kind==='sweep'){
    const s=e.telegraph.shapes[0],a=Math.atan2(this.player.y-e.y,this.player.x-e.x);if(Math.abs(angleDiff(s.angle,a))<1.1)dmg*=.65;
  }return crownHit.call(this,e,dmg,opts);
};
const crownBoss=Game.prototype.updateBossAbilities;
Game.prototype.updateBossAbilities=function(e,dt,d,los){
  if(!['amberking','glassregent'].includes(e.type))return crownBoss.call(this,e,dt,d,los);
  if(this.state!=='run'||e.stun>0||e.rootRecovery>0)return false;
  if(e.phase===1&&e.hp<=e.maxHp*.5){e.phase=2;this.message(e.type==='amberking'?'Янтарный венец расколот: печатей стало пять!':'Зеркала пробуждаются: три отражения вместо двух!');}
  for(const key in e.abilityTimers)e.abilityTimers[key]-=dt*(e.phase===2?1.12:1);
  if(!los||d>430||this.player.isInvisible())return false;const p=this.player,angle=Math.atan2(p.y-e.y,p.x-e.x);
  if(e.type==='amberking'){
    if(e.abilityTimers.royalCleave<=0){e.abilityTimers.royalCleave=e.def.abilities.royalCleave;RootCombat.warn(e,'royal-cleave',[{shape:'cone',x:e.x,y:e.y,angle,r:e.phase===2?260:230,half:e.phase===2?1.5:1.25}],1.35,{fixed:true});return true;}
    if(e.abilityTimers.burialSeals<=0){e.abilityTimers.burialSeals=e.def.abilities.burialSeals;const offsets=e.phase===2?[[0,0],[105,0],[-105,0],[0,105],[0,-105]]:[[0,0],[0,105],[0,-105]];RootCombat.warn(e,'burial-seals',offsets.map(([x,y])=>({shape:'circle',x:p.x+x,y:p.y+y,r:42})),1.4,{fixed:true});return true;}
  }else{
    if(e.abilityTimers.mirrorLanes<=0){e.abilityTimers.mirrorLanes=e.def.abilities.mirrorLanes;const angles=e.phase===2?[angle,angle+Math.PI/3,angle-Math.PI/3]:[angle-.65,angle+.65];RootCombat.warn(e,'mirror-lanes',angles.map(a=>({shape:'lane',x:p.x-Math.cos(a)*170,y:p.y-Math.sin(a)*170,angle:a,len:340,half:17})),1.4,{fixed:true});return true;}
    if(e.abilityTimers.petalRings<=0){e.abilityTimers.petalRings=e.def.abilities.petalRings;const n=e.phase===2?3:2;RootCombat.warn(e,'petal-rings',Array.from({length:n},(_,i)=>({shape:'ring',x:e.x+Math.cos(i*Math.PI*2/n)*115,y:e.y+Math.sin(i*Math.PI*2/n)*90,inner:48,r:99})),1.45,{fixed:true});return true;}
  }return false;
};
const crownWorld=Renderer.prototype.drawSeamlessWorld;
Renderer.prototype.drawSeamlessWorld=function(view){
  crownWorld.call(this,view);const g=this.g;if(!CrownChapter.active(g))return;const c=this.ctx,t=g.motionClock||0,glass=g.journey.levelId==='glass';c.save();
  for(let i=0;i<24;i++){const x=view.x+(i*181+t*9)%view.w,y=view.y+((i*103+t*(glass?12:-7))%view.h+view.h)%view.h;if(g.map.floorContains(x,y))continue;c.fillStyle=glass?'rgba(217,196,240,.3)':'rgba(226,183,112,.25)';c.beginPath();c.ellipse(x,y,glass?3:1.5,glass?1.4:1,Math.sin(t+i),0,Math.PI*2);c.fill();}c.restore();
};
const crownRender=Renderer.prototype.render;
Renderer.prototype.render=function(){crownRender.call(this);const g=this.g;if(!CrownChapter.active(g)||g.state!=='run')return;const e=g.boss,t=e?.telegraph;if(!t||t.type!=='root'||dist(e.x,e.y,g.player.x,g.player.y)>1000)return;const lines=CrownChapter.hints[t.kind]||['ТЯЖЁЛЫЙ ЗАМАХ','УЙДИ ИЗ СЕКТОРА'];RoutePaint.plate(this.ctx,756,78,254,45);lines.forEach((line,i)=>RoutePaint.text(this.ctx,line,883,93+i*16,'#ffdfa3',10));};

'use strict';
// A warning and its hit test share one frozen geometric description. All clocks
// advance in the simulation, never in the renderer (including paused saves).
const RootCombat=(()=>{
  const TAU=Math.PI*2,shapes=new Set(['circle','ring','cone','lane','cross']);
  const local=(s,p)=>{const a=s.angle||0,dx=p.x-s.x,dy=p.y-s.y;return {x:dx*Math.cos(a)+dy*Math.sin(a),y:-dx*Math.sin(a)+dy*Math.cos(a)};};
  function contains(s,p){
    const q=local(s,p),r=p.r||0,d=Math.hypot(q.x,q.y);
    if(s.shape==='circle')return d<=s.r+r;
    if(s.shape==='ring')return d+r>=s.inner&&d-r<=s.r;
    if(s.shape==='cone')return d<=s.r+r&&Math.abs(Math.atan2(q.y,q.x))<=s.half+Math.asin(Math.min(1,r/(d||1)));
    if(s.shape==='lane')return q.x>=-(s.back||0)-r&&q.x<=s.len+r&&Math.abs(q.y)<=s.half+r;
    return (Math.abs(q.x)<=s.r+r&&Math.abs(q.y)<=s.half+r)||(Math.abs(q.y)<=s.r+r&&Math.abs(q.x)<=s.half+r);
  }
  function path(c,s){
    c.save();c.translate(s.x,s.y);c.rotate(s.angle||0);c.beginPath();
    if(s.shape==='circle')c.arc(0,0,s.r,0,TAU);
    else if(s.shape==='ring'){c.arc(0,0,s.r,0,TAU);c.moveTo(s.inner,0);c.arc(0,0,s.inner,0,TAU,true);}
    else if(s.shape==='cone'){c.moveTo(0,0);c.arc(0,0,s.r,-s.half,s.half);c.closePath();}
    else if(s.shape==='lane')c.rect(-(s.back||0),-s.half,s.len+(s.back||0),s.half*2);
    else {const a=s.r,b=s.half;[[-a,-b],[-b,-b],[-b,-a],[b,-a],[b,-b],[a,-b],[a,b],[b,b],[b,a],[-b,a],[-b,b],[-a,b]].forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();}
    c.restore();
  }
  function id(e){return e.rvId||(e.rvId=[e.type,e.homeRoom,e.x.toFixed(3),e.y.toFixed(3)].join(':'));}
  function warn(e,kind,geometry,time,extra={}){
    e.telegraph={type:'root',kind,shapes:geometry,time,total:time,...extra};e.state='chase';e.windup=0;
    ActorMotion.event(e,'prepare',0);id(e);
  }
  function basic(g,e){
    const a=Math.atan2(e.windupDir.y,e.windupDir.x),s={x:e.x,y:e.y,angle:a},duration=e.def.windup;
    switch(e.def.pattern){
      case 'lunge':warn(e,'lunge',[{...s,shape:'lane',len:210+e.r+4,back:e.r+4,half:e.r+4}],duration);break;
      case 'sweep':warn(e,'sweep',[{...s,shape:'cone',r:114,half:.88}],duration);break;
      case 'censer':warn(e,'censer',[{shape:'circle',x:g.player.x,y:g.player.y,r:56},{shape:'circle',x:g.player.x+Math.cos(a+Math.PI/2)*110,y:g.player.y+Math.sin(a+Math.PI/2)*110,r:45}],duration,{fixed:true});break;
      case 'spores':warn(e,'spores',[{shape:'circle',x:g.player.x,y:g.player.y,r:65}],duration);break;
      case 'fan':warn(e,'fan',[-.24,0,.24].map(offset=>({...s,shape:'lane',angle:a+offset,len:340,half:5})),duration);break;
    }
  }
  function canDamage(g,s){return contains(s,g.player)&&g.canReach({x:s.x,y:s.y},g.player);}
  function spawnPoints(g,e,count){
    const result=[],r=MONSTERS.thornstalker.size,p=g.player;
    for(let i=0;i<16&&result.length<count;i++){
      const a=i*2.399+e.phase,x=e.x+Math.cos(a)*125,y=e.y+Math.sin(a)*105;
      if(!g.map.circleBlocked(x,y,r+4)&&dist(x,y,p.x,p.y)>90&&g.enemies.every(v=>!v.alive||dist(x,y,v.x,v.y)>v.r+r+8)&&result.every(v=>dist(x,y,v.x,v.y)>50))result.push({shape:'circle',x,y,r:24});
    }return result;
  }
  function snapshot(e){return {rvId:id(e),phase:e.phase,attackTimer:e.attackTimer,abilityTimers:e.abilityTimers,telegraph:e.telegraph,charge:e.charge,rootRecovery:e.rootRecovery||0,depthCombo:e.depthCombo||0};}
  function validShape(s){
    if(!s||!shapes.has(s.shape)||![s.x,s.y].every(Number.isFinite)||Math.abs(s.x)>20000||Math.abs(s.y)>20000)return false;
    const positive=k=>Number.isFinite(s[k])&&s[k]>0&&s[k]<1000;
    if(s.angle!==undefined&&!Number.isFinite(s.angle))return false;
    if(s.shape==='lane')return positive('len')&&positive('half')&&(s.back===undefined||positive('back'));
    if(!positive('r'))return false;
    if(s.shape==='ring')return positive('inner')&&s.inner<s.r;
    if(s.shape==='cross'||s.shape==='cone')return positive('half');
    return true;
  }
  function validState(s){return s&&[1,2].includes(s.phase)&&Number.isFinite(s.attackTimer)&&Number.isFinite(s.rootRecovery)&&(s.depthCombo===undefined||(Number.isInteger(s.depthCombo)&&s.depthCombo>=0&&s.depthCombo<=2))&&(!s.telegraph||(s.telegraph.type==='root'&&['lunge','sweep','spores','fan','toll','rupture','summon','gale','bolts','elite-ring','elite-brand','tidal-ring','tidal-fan','hammerfall','solar-spokes','royal-cleave','burial-seals','mirror-lanes','petal-rings','censer'].includes(s.telegraph.kind)&&Array.isArray(s.telegraph.shapes)&&s.telegraph.shapes.length<=8&&s.telegraph.shapes.every(validShape)&&Number.isFinite(s.telegraph.time)&&s.telegraph.time>=0&&Number.isFinite(s.telegraph.total)&&s.telegraph.total>0&&s.telegraph.time<=s.telegraph.total))&&(!s.charge||['vx','vy','time'].every(k=>Number.isFinite(s.charge[k])))&&Object.values(s.abilityTimers||{}).every(Number.isFinite);}
  function validateSave(data){
    for(const e of data.enemies)if(e.rootState&&!validState(e.rootState))throw Error('Invalid combat checkpoint');
    if(data.rootHazards!==undefined&&(!Array.isArray(data.rootHazards)||data.rootHazards.length>32||!data.rootHazards.every(s=>validShape(s)&&[s.life,s.tick,s.dmg].every(Number.isFinite)&&s.life>0&&s.life<=3.2&&MONSTERS[s.sourceType]?.rootvault&&typeof s.sourceId==='string')))throw Error('Invalid hazard checkpoint');
  }
  function restore(e,s){if(!s)return;Object.assign(e,s);e.abilityTimers={...s.abilityTimers};}
  return {contains,path,warn,basic,canDamage,spawnPoints,id,snapshot,validState,validateSave,restore};
})();

const rootBaseReset=Game.prototype.resetRunState;
Game.prototype.resetRunState=function(){rootBaseReset.call(this);this.rootHazards=[];this.rootImpacts=[];};
const rootBaseEnemy=Game.prototype.updateEnemy;
Game.prototype.updateEnemy=function(e,dt){
  if(this.state!=='run'||!e.alive)return;
  if(!e.def.rootvault)return rootBaseEnemy.call(this,e,dt);
  if(this.journey?.seamless&&!this.journey.rooms[e.homeRoom]?.active)return;
  // A stun interrupts both preparation and a launched lunge immediately.
  if(e.stun>0){e.telegraph=null;e.charge=null;e.windup=0;e.state='chase';e.attackTimer=Math.max(e.attackTimer,.8);}
  if(e.telegraph&&!e.telegraph.fixed&&e.telegraph.kind!=='spores'&&e.telegraph.kind!=='rupture'&&e.telegraph.kind!=='summon')for(const s of e.telegraph.shapes){s.x=e.x;s.y=e.y;}
  const speed=e.speed,recovery=e.rootRecovery||0;e.rootRecovery=Math.max(0,recovery-dt);if(recovery)e.speed=0;
  try{rootBaseEnemy.call(this,e,dt);}finally{e.speed=speed;}
  if(e.alive&&e.state==='windup'&&!e.telegraph)RootCombat.basic(this,e);
};
const rootBaseAttack=Game.prototype.enemyAttack;
Game.prototype.enemyAttack=function(e){if(e.def.rootvault){if(!e.telegraph)RootCombat.basic(this,e);return;}return rootBaseAttack.call(this,e);};
const rootBaseBoss=Game.prototype.updateBossAbilities;
Game.prototype.updateBossAbilities=function(e,dt,d,los){
  if(!e.def.rootvault)return rootBaseBoss.call(this,e,dt,d,los);
  if(this.state!=='run'||e.stun>0||e.rootRecovery>0)return false;
  if(e.hp<=e.maxHp*.5&&e.phase===1){e.phase=2;this.message(e.type==='bellwarden'?'Второй звон: удары учащаются!':'Корни пробуждаются: берегитесь диагональных разломов!');}
  for(const key in e.abilityTimers)e.abilityTimers[key]-=dt*(e.phase===2?1.25:1);
  if(!los||this.player.isInvisible())return false;
  if(e.type==='bellwarden'&&e.abilityTimers.toll<=0&&d<360){
    e.abilityTimers.toll=e.def.abilities.toll;
    RootCombat.warn(e,'toll',[{shape:'ring',x:e.x,y:e.y,inner:92,r:e.phase===2?224:204}],e.phase===2?1:1.2);return true;
  }
  if(e.type==='rootmother'){
    if(e.abilityTimers.summon<=0){
      e.abilityTimers.summon=e.def.abilities.summon;
      const n=this.enemies.filter(v=>v.alive&&v.homeRoom===e.homeRoom).length,points=RootCombat.spawnPoints(this,e,Math.min(e.phase===2?3:2,Math.max(0,8-n)));
      if(points.length){RootCombat.warn(e,'summon',points,1.3);return true;}
    }
    if(e.abilityTimers.rupture<=0&&d<480){
      e.abilityTimers.rupture=e.def.abilities.rupture;
      RootCombat.warn(e,'rupture',[{shape:'cross',x:this.player.x,y:this.player.y,r:e.phase===2?185:150,half:23,angle:e.phase===2?Math.PI/4:0}],e.phase===2?1.15:1.3);return true;
    }
  }return false;
};
const rootBaseResolve=Game.prototype.resolveTelegraph;
Game.prototype.resolveTelegraph=function(e){
  const t=e.telegraph;if(t?.type!=='root')return rootBaseResolve.call(this,e);
  e.telegraph=null;if(!e.alive||e.stun>0||this.state!=='run')return;
  e.rootRecovery=t.kind==='lunge'?.65:.5;e.attackTimer=Math.max(e.attackTimer,e.rootRecovery+.4);
  ActorMotion.event(e,t.kind,.4,t.shapes[0]?.angle||0);
  if(t.kind==='lunge'){
    const a=t.shapes[0].angle;e.charge={vx:Math.cos(a)*420,vy:Math.sin(a)*420,time:.5,hit:false};return;
  }
  if(t.kind==='fan'){
    for(const s of t.shapes)this.spawnProjectile({x:e.x,y:e.y,vx:Math.cos(s.angle)*e.def.projSpeed,vy:Math.sin(s.angle)*e.def.projSpeed,dmg:e.dmg,owner:'enemy',src:e,size:5,color:e.def.projColor,life:340/e.def.projSpeed});return;
  }
  if(t.kind==='spores'){
    this.rootHazards??=[];if(this.rootHazards.length>=32)this.rootHazards.shift();
    this.rootHazards.push({...t.shapes[0],sourceId:RootCombat.id(e),sourceType:e.type,homeRoom:e.homeRoom,dmg:e.dmg,life:3.1,tick:0});return;
  }
  if(t.kind==='summon'){
    for(const s of t.shapes){if(this.enemies.filter(v=>v.alive&&v.homeRoom===e.homeRoom).length>=8)break;
      if(this.map.circleBlocked(s.x,s.y,18)||dist(s.x,s.y,this.player.x,this.player.y)<65||this.enemies.some(v=>v.alive&&dist(s.x,s.y,v.x,v.y)<v.r+18))continue;
      const m=this.makeJourneyEnemy('thornstalker',s.x,s.y);m.homeRoom=e.homeRoom;m.attackTimer=1.5;this.enemies.push(m);
      ActorMotion.add(this,{kind:'burst',x:s.x,y:s.y,r:35,color:'#e3c794',life:.5});
    }return;
  }
  this.rootImpacts??=[];this.rootImpacts.push({shapes:t.shapes,life:.4,total:.4,kind:t.kind});if(this.rootImpacts.length>24)this.rootImpacts.shift();
  if(t.shapes.some(s=>RootCombat.canDamage(this,s)))this.damagePlayer(e.dmg*(t.kind==='sweep'?1:1.25),e);
  if(t.kind==='toll')this.shake=Math.max(this.shake,7);
};
const rootBaseWorld=Game.prototype.updateWorld;
Game.prototype.updateWorld=function(dt){
  rootBaseWorld.call(this,dt);if(this.state!=='run')return;
  this.rootImpacts=(this.rootImpacts||[]).filter(i=>(i.life-=dt)>0);
  for(const s of this.rootHazards||[]){
    if(this.state!=='run')break;s.life-=dt;s.tick-=dt;
    if(s.life>0&&s.tick<=0){s.tick=.65;if(RootCombat.canDamage(this,s))this.damagePlayer(s.dmg,{def:MONSTERS[s.sourceType]});}
  }
  this.rootHazards=(this.rootHazards||[]).filter(s=>s.life>0);
};
const rootBaseKill=Game.prototype.killEnemy;
Game.prototype.killEnemy=function(e){if(!e.alive)return;this.rootHazards=(this.rootHazards||[]).filter(s=>s.sourceId!==e.rvId);e.telegraph=null;e.charge=null;return rootBaseKill.call(this,e);};

const rootBaseTelegraphs=Renderer.prototype.drawTelegraphs;
Renderer.prototype.drawTelegraphs=function(){
  rootBaseTelegraphs.call(this);const g=this.g,c=this.ctx;c.save();
  if(!g.enemies.some(e=>e.alive&&e.telegraph?.type==='root')&&!g.rootHazards?.length&&!g.rootImpacts?.length){c.restore();return;}
  // Warnings are grounded on the physical floor; unreachable water never glows.
  if(g.map?.seamless){c.beginPath();for(const p of g.map.polygons){p.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();}c.clip();}
  for(const e of g.enemies){const t=e.telegraph;if(!e.alive||t?.type!=='root')continue;
    const k=clamp(1-t.time/t.total,0,1),color=t.kind==='summon'?'#d4d99a':'#ffc47d';
    for(const s of t.shapes){RootCombat.path(c,s);c.fillStyle=t.kind==='summon'?'rgba(203,208,127,.16)':'rgba(209,63,38,'+(.13+k*.22)+')';c.fill();c.strokeStyle=color;c.lineWidth=2;c.stroke();
      c.save();c.setLineDash([5,6]);c.strokeStyle='rgba(255,224,177,.45)';c.lineWidth=1;c.stroke();c.restore();}
    // A closing clock is a timing cue in addition to the color and silhouette.
    c.strokeStyle=color;c.lineWidth=3;c.beginPath();c.arc(e.x,e.y+15,7,-Math.PI/2,-Math.PI/2+Math.PI*2*k);c.stroke();
  }
  for(const s of g.rootHazards||[]){RootCombat.path(c,s);c.fillStyle='rgba(187,94,33,.38)';c.fill();c.strokeStyle='#f5bf73';c.lineWidth=2;c.stroke();
    for(let i=0;i<8;i++){const a=i*2.4+(g.motionClock||0)*.5;c.fillStyle='#ffd392';c.beginPath();c.arc(s.x+Math.cos(a)*s.r*.65,s.y+Math.sin(a)*s.r*.65,2+Math.sin(a)**2*2,0,Math.PI*2);c.fill();}}
  for(const fx of g.rootImpacts||[]){c.save();c.globalAlpha=fx.life/fx.total;for(const s of fx.shapes){RootCombat.path(c,s);c.fillStyle='rgba(255,179,83,.4)';c.fill();c.strokeStyle='#ffe1a6';c.lineWidth=5;c.stroke();}c.restore();}
  c.restore();
};
// Boss instructions sit beside the health bar, above tall sprites and scenery.
const rootBaseRender=Renderer.prototype.render;
Renderer.prototype.render=function(){
  rootBaseRender.call(this);const g=this.g,t=g.boss?.telegraph;
  if(!g.journey?.seamless||['tide','sunforge','amber','glass'].includes(g.journey.levelId)||t?.type!=='root'||g.state!=='run'||dist(g.boss.x,g.boss.y,g.player.x,g.player.y)>=1000)return;
  const c=this.ctx,label=t.kind==='toll'?'УКРОЙСЯ ВНУТРИ КОЛЬЦА':t.kind==='rupture'?'УЙДИ С РАЗЛОМА':t.kind==='summon'?'ПРИЗЫВ СТРАЖЕЙ':'ОТОЙДИ ОТ УДАРА';
  RoutePaint.plate(c,365,131,295,25);RoutePaint.text(c,label,512,144,'#ffdfa2',11);
};


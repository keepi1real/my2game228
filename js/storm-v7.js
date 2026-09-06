'use strict';
// Fourth expedition chapter: optional objectives, persistent one-shot choices,
// and a boss whose strength reflects the player's route through the citadel.
BOSSES.stormarchon={id:'stormarchon',name:'Архонт Бури',symbol:'А',shape:'hex',color:'#a5d7f1',size:30,hp:1050,dmg:22,speed:78,armor:6,xp:600,shards:48,gold:[120,175],sight:750,attackRange:95,attackCd:3.2,windup:.95,abilities:{gale:6,bolts:4.8},rootvault:true,pattern:'sweep'};
BestiaryArt.specs.stormarchon={rect:[0,0,1254,1254],height:174,image:loadImage('assets/recovered-v9/b9347b74a379712b.png')};

const StormChapter=(()=>{
  const active=g=>g?.journey?.seamless&&g.journey.levelId==='storm';
  const choices={forge:['edge','plate'],chart:['chart','restore'],beacon:['quenched']};
  function quenched(g){return active(g)?g.journey.rooms.filter(r=>r.feature?.kind==='beacon'&&r.featureChoice==='quenched').length:0;}
  function syncBoss(g){const n=quenched(g);for(const e of g.enemies)if(e.type==='stormarchon'){e.dmg=BOSSES.stormarchon.dmg-3*n;e.armor=BOSSES.stormarchon.armor-2*n;}}
  function validChoice(room,value){return value===undefined||choices[room.feature?.kind]?.includes(value);}
  function validateSave(data){
    if(data.player.expeditionBoons!==undefined&&(!data.player.expeditionBoons||!['edge','plate'].includes(data.player.expeditionBoons.stormForge)))throw Error('Invalid expedition boon');
    const level=ExpeditionLevels.get(data.levelId);
    for(let i=0;i<data.rooms.length;i++)if(!validChoice({feature:level.features?.[i]},data.rooms[i].featureChoice))throw Error('Invalid event choice');
  }
  const choiceText={edge:'Закалить оружие · +15% урона',plate:'Укрепить доспех · +3 брони',chart:'Раскрыть все зоны на карте',restore:'Восстановить 40% здоровья и получить зелье'};
  return {active,choices,quenched,syncBoss,validChoice,validateSave,choiceText};
})();

const stormDamage=Player.prototype.damage,stormArmor=Player.prototype.armor;
Player.prototype.damage=function(){return stormDamage.call(this)*(this.expeditionBoons?.stormForge==='edge'?1.15:1);};
Player.prototype.armor=function(){return stormArmor.call(this)+(this.expeditionBoons?.stormForge==='plate'?3:0);};
const stormPopulate=Game.prototype.populateSeamlessFloor,stormResume=Game.prototype.resumeSeamlessJourney,stormReset=Game.prototype.resetRunState;
Game.prototype.populateSeamlessFloor=function(){stormPopulate.call(this);if(StormChapter.active(this))StormChapter.syncBoss(this);};
Game.prototype.resumeSeamlessJourney=function(){const result=stormResume.call(this);if(result&&StormChapter.active(this))StormChapter.syncBoss(this);return result;};
Game.prototype.resetRunState=function(){stormReset.call(this);this.pendingFloorEvent=null;};

const stormTargets=Game.prototype.journeyTargets;
Game.prototype.journeyTargets=function(){
  const targets=stormTargets.call(this);if(!StormChapter.active(this))return targets;
  for(const r of this.journey.rooms)if(r.feature){
    const label=r.featureChoice?(r.feature.kind==='beacon'?'Маяк погашен · Архонт ослаблен':'Выбор уже сделан'):!r.cleared?'Победите стражу маяка':r.feature.kind==='beacon'?'Погасить маяк · ослабить Архонта':r.feature.title;
    targets.push({...r.featureUsePoint,kind:'floor-feature',homeRoom:r.id,enabled:r.cleared&&!r.featureChoice,label});
  }return targets;
};
const stormInteract=Game.prototype.journeyInteract;
Game.prototype.journeyInteract=function(target){
  if(target?.kind!=='floor-feature')return stormInteract.call(this,target);
  if(!StormChapter.active(this)||this.state!=='run')return false;
  const r=this.journey.rooms[target.homeRoom];
  if(!r?.feature||!r.cleared||r.featureChoice||dist(this.player.x,this.player.y,r.featureUsePoint.x,r.featureUsePoint.y)>65)return false;
  if(r.feature.kind==='beacon'){
    r.featureChoice='quenched';StormChapter.syncBoss(this);this.journey.notice='Маяк погашен: урон Архонта −3, броня −2. '+StormChapter.quenched(this)+' / 2';this.journey.noticeTime=5;
    ActorMotion.add(this,{kind:'burst',x:r.featurePoint.x,y:r.featurePoint.y,r:66,color:'#b3e9f2',life:.7});this.saveJourney();return true;
  }
  this.state='floor-event';this.pendingFloorEvent=r.id;this.input.mouse.down=false;this.input.touch.attack=false;this.saveJourney();this.ui.showFloorEvent(r);return true;
};
Game.prototype.closeFloorEvent=function(){
  if(this.state!=='floor-event')return false;this.state='run';this.pendingFloorEvent=null;this.input.pressed={};this.input.mouse.down=false;this.input.touch.attack=false;this.ui.hide();return true;
};
Game.prototype.chooseFloorEvent=function(id,choice){
  if(!StormChapter.active(this)||this.state!=='floor-event'||this.pendingFloorEvent!==id||this.player.hp<=0)return false;
  const r=this.journey.rooms[id];if(!r?.feature||!r.cleared||r.featureChoice||r.feature.kind==='beacon'||!StormChapter.choices[r.feature.kind].includes(choice)||dist(this.player.x,this.player.y,r.featureUsePoint.x,r.featureUsePoint.y)>65)return false;
  if(r.feature.kind==='forge')this.player.expeditionBoons={stormForge:choice};
  else if(choice==='chart')for(const room of this.journey.rooms)room.discovered=true;
  else {this.healPlayer(this.player.maxHp*.4);this.player.consumables.potion++;}
  r.featureChoice=choice;this.closeFloorEvent();this.journey.notice=StormChapter.choiceText[choice];this.journey.noticeTime=5;this.saveJourney();return true;
};
UI.prototype.showFloorEvent=function(r){
  const isForge=r.feature.kind==='forge',body=isForge?'Тепло древнего горна ещё живо. Выберите одно улучшение до конца похода.':'На столе остались карты цитадели и запас целебной воды. Выберите одну награду.';
  this.render(`<div class="overlay overlay-front"><div class="panel expedition-help"><h2>${r.feature.title}</h2><p>${body}</p>${StormChapter.choices[r.feature.kind].map(id=>`<button class="primary" data-floor-choice="${id}">${StormChapter.choiceText[id]}</button>`).join('')}<p class="muted">Пока вы выбираете, бой на паузе. Можно уйти и вернуться позже.</p><button data-event-close>Вернуться в зал</button></div></div>`);
  this.bind('[data-floor-choice]','click',el=>this.g.chooseFloorEvent(r.id,el.dataset.floorChoice));
  this.bind('[data-event-close]','click',()=>this.g.closeFloorEvent());
};
const stormUpdate=Game.prototype.update;
Game.prototype.update=function(dt){
  if(this.state==='floor-event'){
    if(this.input.hit('Escape')||this.input.tHit('pause'))this.closeFloorEvent();this.input.endFrame();return;
  }return stormUpdate.call(this,dt);
};

const stormBossAbilities=Game.prototype.updateBossAbilities;
Game.prototype.updateBossAbilities=function(e,dt,d,los){
  if(e.type!=='stormarchon')return stormBossAbilities.call(this,e,dt,d,los);
  if(this.state!=='run'||e.stun>0||e.rootRecovery>0)return false;
  if(e.hp<=e.maxHp*.5&&e.phase===1){e.phase=2;this.message('Буря меняет направление. Ищите промежутки между полосами!');}
  for(const k in e.abilityTimers)e.abilityTimers[k]-=dt*(e.phase===2?1.25:1);
  if(!los||d>500||this.player.isInvisible())return false;
  const p=this.player;
  if(e.abilityTimers.gale<=0){
    e.abilityTimers.gale=e.def.abilities.gale;const angle=e.phase===2?Math.PI/2:0,dx=Math.cos(angle),dy=Math.sin(angle);
    const shapes=[-100,0,100].map(offset=>({shape:'lane',x:p.x-dx*190-dy*offset,y:p.y-dy*190+dx*offset,angle,len:380,half:21}));
    RootCombat.warn(e,'gale',shapes,e.phase===2?1.05:1.25,{fixed:true});return true;
  }
  if(e.abilityTimers.bolts<=0){
    e.abilityTimers.bolts=e.def.abilities.bolts;const offsets=e.phase===2?[[0,0],[-115,0],[115,0],[0,110]]:[[0,0],[-115,30],[115,-30]];
    RootCombat.warn(e,'bolts',offsets.map(([x,y])=>({shape:'circle',x:p.x+x,y:p.y+y,r:43})),1.15,{fixed:true});return true;
  }return false;
};

const stormProp=BiomeArtV3.prop;
BiomeArtV3.prop=function(c,o,player,time){
  const g=window.game,used=StormChapter.active(g)&&o.featureRoom!==undefined&&g.journey.rooms[o.featureRoom]?.featureChoice;
  c.save();if(used&&o.sprite==='stormbeacon')c.globalAlpha*=.43;stormProp(c,o,player,time);c.restore();
};
const stormWorld=Renderer.prototype.drawSeamlessWorld;
Renderer.prototype.drawSeamlessWorld=function(view){
  stormWorld.call(this,view);const g=this.g;if(!StormChapter.active(g))return;const c=this.ctx;
  for(const r of g.journey.rooms)if(r.feature&&SeamlessPaint.intersects(SeamlessPaint.roomBounds(r),view)){
    const p=r.featureUsePoint,used=!!r.featureChoice,label=r.feature.kind==='beacon'?(used?'МАЯК ПОГАШЕН':'МАЯК БУРИ'):used?'ВЫБОР СДЕЛАН':r.feature.kind==='forge'?'КУЗНИЦА':'КАРТОГРАФЫ';
    ActorMotion.rune(c,p.x,p.y,22,used?0:(g.motionClock||0)*.3,used?'#7b939d':'#eacb87',used?.28:.75);
    RoutePaint.text(c,label,p.x,p.y+23,used?'#9bafb5':'#e9d3a2',10);
  }
  // Snow motes are visual only; no hidden slippery-floor movement modifier.
  const time=g.motionClock||0;for(let i=0;i<36;i++){const x=view.x+((i*167+time*22)%view.w),y=view.y+((i*83+time*9)%view.h);c.fillStyle='rgba(208,229,243,.32)';c.fillRect(x,y,2,1);}
};
const stormRender=Renderer.prototype.render;
Renderer.prototype.render=function(){
  stormRender.call(this);const g=this.g;if(!StormChapter.active(g)||g.state==='route-map'||g.frontMenu)return;const c=this.ctx,n=StormChapter.quenched(g);
  RoutePaint.plate(c,756,12,254,57);RoutePaint.text(c,'МАЯКИ ПОГАШЕНЫ: '+n+' / 2',883,31,'#c8dfee',12);RoutePaint.text(c,n===2?'Архонт ослаблен. Ищите трон.':'Маяки необязательны. Выбирайте путь.',883,52,'#b4c7d5',10);
  if(g.boss?.type==='stormarchon'&&dist(g.boss.x,g.boss.y,g.player.x,g.player.y)<1000&&['gale','bolts'].includes(g.boss.telegraph?.kind)&&g.state==='run'){
    RoutePaint.plate(c,345,131,335,25);RoutePaint.text(c,g.boss.telegraph.kind==='gale'?'УЙДИ В ПРОМЕЖУТОК МЕЖДУ ПОЛОСАМИ':'ВЫЙДИ ИЗ КРУГОВ МОЛНИИ',512,144,'#ffe2ac',10);
  }
};


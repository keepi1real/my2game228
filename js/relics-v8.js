'use strict';
// A reward belongs to a cleared room, not to the last enemy. The stored draft
// survives leaving, pausing, resuming and choosing a reward in another room.
const RunRelics=(()=>{
  const catalog=Object.freeze({
    scarab:{name:'Янтарный скарабей',line:'Щит после зачистки',detail:'Зачистка боевого зала даёт щит 12 ед. на 15 с.',color:'#e4bf79',max:1,biome:'amber'},
    incense:{name:'Ладан предков',line:'+6 HP после зачистки',detail:'Лечение после боевого зала. Повторный вход не даёт награду.',color:'#d7ac93',max:1,biome:'amber'},
    hourglass:{name:'Пески династии',line:'Рывок ускоряет умения',detail:'Рывок сокращает три перезарядки на 0,8 с. Восстановление: 5 с.',color:'#e5c988',max:1,biome:'amber'},
    mirror:{name:'Зеркальная печать',line:'Удар слабее на 35%',detail:'Один входящий удар ослабляется. Восстановление: 14 с.',color:'#cabbe8',max:1,biome:'glass'},
    petal:{name:'Лунный лепесток',line:'Умение → атака +30%',detail:'Следующая обычная атака в течение 6 с после умения сильнее.',color:'#ddc4e6',max:1,biome:'glass'},
    glassheart:{name:'Стеклянное сердце',line:'+20 HP · −1 броня',detail:'Больше здоровья ценой защиты. При получении восстанавливает 20 HP.',color:'#b8cadf',max:1,biome:'glass'},
    blade:{name:'Клятва клинка',line:'+6% урона',detail:'Сильнее удары и заклинания.',color:'#e9b38b',max:3},
    heart:{name:'Сердце горы',line:'+12 к здоровью',detail:'Растут запас и текущее здоровье.',color:'#d99897',max:3},
    ward:{name:'Печать стража',line:'+1 к броне',detail:'Снижает урон входящих ударов.',color:'#9acbce',max:3},
    stride:{name:'Шаг ветра',line:'+3% скорости',detail:'Быстрее перемещение по залам.',color:'#bdd6ab',max:3},
    focus:{name:'Звёздная память',line:'−2,5% перезарядки',detail:'Умения восстанавливаются быстрее.',color:'#a6b8e5',max:3},
    fang:{name:'Око охотника',line:'+2,5% шанса крита',detail:'Повышает шанс критического удара.',color:'#d6bbdf',max:3},
    salve:{name:'Живая вода',line:'Восстановить 35% HP',detail:'Мгновенное лечение героя.',color:'#93cfb3'},
    potion:{name:'Запас странника',line:'+1 лечебное зелье',detail:'Останется с вами до использования.',color:'#a5cedd'},
    fire:{name:'Свиток пламени',line:'+1 огненный свиток',detail:'Огненный взрыв вокруг героя.',color:'#e6b38d'}
  });
  const ids=Object.keys(catalog),permanent=ids.filter(id=>catalog[id].max),supplies=['salve','potion','fire'];
  const rank=(p,id)=>p.relics?.[id]||0;
  function point(g,r){
    // No collider is added: the relic is a small ground pickup. Only place it
    // in the connected navigation mesh, away from chests and event controls.
    const candidates=[];
    for(const y of [100,60,20,-20,-60,-100])for(const x of [0,-60,60,-120,120])candidates.push({x:r.center.x+x,y:r.center.y+y});
    const q=candidates.find(p=>!g.map.circleBlocked(p.x,p.y,20)&&g.map.tiles[g.map.idx(Math.floor(p.x/TILE),Math.floor(p.y/TILE))]===T_FLOOR&&[r.chestPoint,r.featureUsePoint].filter(Boolean).every(v=>dist(v.x,v.y,p.x,p.y)>75));
    if(!q)throw Error('No reachable relic socket in room '+r.id);return q;
  }
  function prepareRooms(g){
    for(const r of g.journey.rooms)if(['combat','elite'].includes(r.role)){
      // v3/v4 saves without rewards keep cleared rooms spent. Uncleared rooms
      // participate immediately, without retroactive grants or a run reset.
      if(!r.reward&&!r.cleared)r.reward={status:'sealed'};
      if(r.reward)r.rewardPoint=point(g,r);
    }
  }
  function draft(g,r){
    const rng=new RNG((g.journey.seed^((r.id+1)*73471)^(g.floor*181081))>>>0);
    const pool=rng.shuffle(permanent.filter(id=>!catalog[id].biome&&rank(g.player,id)<catalog[id].max));
    const rest=rng.shuffle(supplies.slice());
    const artifacts=rng.shuffle(permanent.filter(id=>catalog[id].biome===g.journey.levelId&&rank(g.player,id)<1));
    if(artifacts.length&&(r.role==='elite'||r.id%3===0))return [artifacts[0],...pool.slice(0,1),...rest].slice(0,3);
    return [...pool.slice(0,2),...rest].slice(0,3);
  }
  function describe(p,id){
    const d=catalog[id],n=rank(p,id),capped=d.max&&n>=d.max;
    return {name:d.name,line:capped?'+1 зелье вместо повтора':d.line,detail:capped?'Этот предмет уже достиг максимального ранга.':d.detail,
      footer:d.max?(capped?'МАКСИМАЛЬНЫЙ РАНГ':d.biome?'АРТЕФАКТ · ДО КОНЦА ПОХОДА':['I','II','III'][n]+' РАНГ · ДО КОНЦА ПОХОДА'):'ПРИМЕНЯЕТСЯ СРАЗУ',color:d.color};
  }
  function grant(g,id){
    const p=g.player,d=catalog[id];
    if(d.max){
      if(rank(p,id)>=d.max){p.consumables.potion++;return;}
      p.relics={...p.relics,[id]:rank(p,id)+1};if(id==='heart'||id==='glassheart')p.hp=Math.min(p.maxHp,p.hp+(id==='heart'?12:20));
    }else if(id==='salve')g.healPlayer(p.maxHp*.35);
    else if(id==='potion')p.consumables.potion++;
    else p.consumables.fireScroll++;
  }
  function validateSave(data){
    const v=data.player.relics;
    if(v!==undefined&&(!v||Array.isArray(v)||typeof v!=='object'||Object.entries(v).some(([k,n])=>!permanent.includes(k)||!Number.isInteger(n)||n<1||n>catalog[k].max)))throw Error('Invalid relic ranks');
    for(const r of data.rooms){const v=r.reward;if(v===undefined)continue;
      if(!v||!['sealed','available','claimed'].includes(v.status))throw Error('Invalid room reward');
      if(v.status==='sealed'){if(v.offers!==undefined||v.choice!==undefined)throw Error('Invalid sealed reward');continue;}
      if(!r.cleared||!Array.isArray(v.offers)||v.offers.length!==3||new Set(v.offers).size!==3||!v.offers.every(id=>ids.includes(id))||
        (v.status==='claimed'?!v.offers.includes(v.choice):v.choice!==undefined))throw Error('Invalid reward draft');
    }
  }
  return {catalog,permanent,rank,prepareRooms,draft,describe,grant,validateSave};
})();

const relicDamage=Player.prototype.damage,relicArmor=Player.prototype.armor,relicSpeed=Player.prototype.speed,relicCdr=Player.prototype.cdr,relicCrit=Player.prototype.crit;
const relicMaxHp=Object.getOwnPropertyDescriptor(Player.prototype,'maxHp').get;
Player.prototype.damage=function(){return relicDamage.call(this)*(1+.06*RunRelics.rank(this,'blade'));};
Player.prototype.armor=function(){return relicArmor.call(this)+RunRelics.rank(this,'ward');};
Player.prototype.speed=function(){return relicSpeed.call(this)*(1+.03*RunRelics.rank(this,'stride'));};
Player.prototype.cdr=function(){return Math.min(.6,relicCdr.call(this)+.025*RunRelics.rank(this,'focus'));};
Player.prototype.crit=function(){return Math.min(1,relicCrit.call(this)+.025*RunRelics.rank(this,'fang'));};
Object.defineProperty(Player.prototype,'maxHp',{configurable:true,get(){return relicMaxHp.call(this)+12*RunRelics.rank(this,'heart');}});
const relicSummary=Player.prototype.statsSummary;
Player.prototype.statsSummary=function(){const result=relicSummary.call(this);for(const id of RunRelics.permanent){const n=RunRelics.rank(this,id);if(n)result[RunRelics.catalog[id].name]=RunRelics.catalog[id].biome?'Артефакт похода':['I','II','III'][n-1]+' / III · реликвия';}return result;};

const relicPopulate=Game.prototype.populateSeamlessFloor,relicZones=Game.prototype.updateSeamlessZones;
Game.prototype.populateSeamlessFloor=function(){relicPopulate.call(this);RunRelics.prepareRooms(this);};
Game.prototype.updateSeamlessZones=function(){
  relicZones.call(this);if(!this.journey?.seamless)return;let changed=false;
  for(const r of this.journey.rooms)if(r.cleared&&r.reward?.status==='sealed'){
    r.reward={status:'available',offers:RunRelics.draft(this,r)};changed=true;
    this.journey.notice='Зал зачищен. Подойдите к реликвии и выберите награду.';this.journey.noticeTime=5;
  }if(changed)this.saveJourney();
};
const relicTargets=Game.prototype.journeyTargets,relicInteract=Game.prototype.journeyInteract;
Game.prototype.journeyTargets=function(){
  const targets=relicTargets.call(this);if(this.journey?.seamless)for(const r of this.journey.rooms)if(r.cleared&&r.reward?.status==='available')targets.push({...r.rewardPoint,kind:'relic',homeRoom:r.id,enabled:true,label:'Реликвия · выбрать одну из трёх наград'});
  return targets;
};
Game.prototype.journeyInteract=function(t){
  if(t?.kind!=='relic')return relicInteract.call(this,t);
  const r=this.journey?.seamless&&this.journey.rooms[t.homeRoom];
  if(this.state!=='run'||this.player.hp<=0||!r?.cleared||r.reward?.status!=='available'||!r.rewardPoint||dist(this.player.x,this.player.y,r.rewardPoint.x,r.rewardPoint.y)>65)return false;
  // Freeze a production-rendered view before resizing the canvas for the dialog.
  this.relicBackdrop=document.createElement('canvas');this.relicBackdrop.width=VIEW_W;this.relicBackdrop.height=VIEW_H;
  const ctx=this.relicBackdrop.getContext('2d'),previous=this.renderer.ctx;this.renderer.ctx=ctx;ctx.save();ctx.translate(-this.camera.x,-this.camera.y);
  try{this.renderer.drawSeamlessWorld({x:this.camera.x,y:this.camera.y,w:VIEW_W,h:VIEW_H});}finally{ctx.restore();this.renderer.ctx=previous;}
  this.state='relic-choice';this.pendingRelic=r.id;this.input.mouse.down=false;this.input.touch.attack=false;this.saveJourney();this.ui.showRelicChoice();return true;
};
Game.prototype.closeRelicChoice=function(){
  if(this.state!=='relic-choice')return false;
  this.state='run';this.pendingRelic=null;this.ui.hide();this.input.keys={};this.input.pressed={};this.input.mouse.down=false;
  Object.assign(this.input.touch,{attack:false,move:{x:0,y:0},stick:null,aimDrag:null,pressed:{}});return true;
};
Game.prototype.chooseRelic=function(roomId,id){
  const r=this.journey?.seamless&&this.journey.rooms[roomId];
  if(this.state!=='relic-choice'||this.pendingRelic!==roomId||this.player.hp<=0||!r?.cleared||r.reward?.status!=='available'||!r.reward.offers.includes(id)||dist(this.player.x,this.player.y,r.rewardPoint.x,r.rewardPoint.y)>65)return false;
  const text=RunRelics.describe(this.player,id);r.reward.status='claimed';r.reward.choice=id;RunRelics.grant(this,id);
  this.closeRelicChoice();this.journey.notice=text.name+' · '+text.line;this.journey.noticeTime=5;
  ActorMotion.add(this,{kind:'burst',x:r.rewardPoint.x,y:r.rewardPoint.y,r:50,color:text.color,life:.7});this.saveJourney();return true;
};
const relicUpdate=Game.prototype.update,relicReset=Game.prototype.resetRunState;
Game.prototype.update=function(dt){
  if(this.state!=='relic-choice')return relicUpdate.call(this,dt);
  if(this.input.hit('Escape')||this.input.tHit('pause'))this.closeRelicChoice();
  else for(let i=0;i<3;i++)if(this.input.hit('Digit'+(i+1))){const id=this.pendingRelic;this.chooseRelic(id,this.journey.rooms[id].reward.offers[i]);break;}
  this.input.endFrame();
};
Game.prototype.resetRunState=function(){RelicUI.closeCanvas(this);relicReset.call(this);this.pendingRelic=null;};


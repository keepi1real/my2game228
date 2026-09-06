'use strict';
// Run-scoped talents, hero identities and artifact procs. Campaign data is untouched.
const AdventureProgress=(()=>{
  const branches=[{id:'assault',name:'НАТИСК',color:'#e6ad88'},{id:'guard',name:'СТОЙКОСТЬ',color:'#99cbbf'},{id:'arcana',name:'МАСТЕРСТВО',color:'#bca9e0'}];
  const rows=[
    ['edge','assault','Острый клинок','+8% урона атак и умений.'],
    ['fervor','assault','Темп боя','Обычные атаки на 8% быстрее.'],
    ['hunt','assault','Охота','+15% урона врагам ниже 30% здоровья.'],
    ['rush','assault','Прорыв','После рывка следующая обычная атака за 3 с наносит +35%.'],
    ['vigor','guard','Жизненная сила','+20 к максимальному и текущему здоровью.'],
    ['plate','guard','Закалка','+2 к броне.'],
    ['resolve','guard','Последний рубеж','При здоровье ниже 35% входящие удары слабее на 10%.'],
    ['bastion','guard','Бастион','Рывок даёт щит на 10 ед. на 3 с. Восстановление: 5 с.'],
    ['focus','arcana','Сосредоточение','−4 п.п. перезарядки умений.'],
    ['weave','arcana','Поток','Применение умения сокращает остальные перезарядки на 0,6 с.'],
    ['renew','arcana','Второе дыхание','Каждое четвёртое применение умения восстанавливает 4 HP.'],
    ['echo','arcana','Эхо силы','Каждое третье умение: следующая обычная атака за 6 с наносит +50%.'],
  ];
  const nodes=Object.fromEntries(rows.map(([id,branch,name,detail],i)=>[id,{id,branch,name,detail,tier:i%4+1,requires:i%4?rows[i-1][0]:null}]));
  const heroes={arator:['Ритм клинка','Третий удар серии: +60%','Меч следопыта'],baldin:['Ответ железа','Контрудар после ранения: +50%','Топор Железных Чертогов'],faelas:['Дальний выстрел','Обычная стрела от 170 ед.: +25%','Лук сумерек'],mithrandir:['Отзвук заклинания','Умение заряжает выстрел посоха ×2','Посох Серого странника'],peregrin:['Ловкий выпад','После рывка: критический удар','Кинжал Зелёных Холмов']};
  const timers={comboTime:3,counterTime:5,spellTime:6,evadeTime:3,evadeCd:4,rushTime:3,bastionCd:5,petalTime:6,echoTime:6,mirrorCd:14,hourCd:5};
  const combat=()=>Object.assign({combo:0,casts:0},Object.fromEntries(Object.keys(timers).map(k=>[k,0])));
  const fresh=(points=1)=>({points,earned:points,clears:0,nodes:[]});
  const has=(p,id)=>p.talents?.nodes.includes(id)||false;
  const artifact=(p,id)=>RunRelics.rank(p,id)>0;
  const state=p=>p.combatV11||(p.combatV11=combat());
  function init(g){
    const p=g.player,f=ExpeditionLevels.get(g.journey.levelId).floor;p.talents=fresh(Math.min(5,f));p.combatV11=combat();
    p.level=Math.max(p.level,1+Math.floor((f-1)*1.5));Save.hero(p.hero.id).level=p.level;
    p.equipment.weapon.name=heroes[p.hero.id][2];p.equipment.weapon.stats.dmg=4+2*(f-1);p.hp=p.maxHp;
  }
  function available(p,id){const n=nodes[id];return !!n&&p.talents?.points>0&&!has(p,id)&&(!n.requires||has(p,n.requires));}
  function learn(g,id){
    if(g.state!=='talents'||!g.journey?.seamless||g.player.hp<=0||!available(g.player,id))return false;
    const p=g.player;p.talents.points--;p.talents.nodes.push(id);if(id==='vigor')p.hp=Math.min(p.maxHp,p.hp+20);
    g.saveJourney();g.ui.showTalents();return true;
  }
  function prepare(g){
    const p=g.player;if(!p.talents)p.talents=fresh();state(p);
    for(const r of g.journey.rooms)if(r.talentCounted===undefined)r.talentCounted=!!r.cleared;
  }
  function validate(d){
    const t=d.player.talents;
    if(t!==undefined){
      if(!t||!Array.isArray(t.nodes)||new Set(t.nodes).size!==t.nodes.length||!Number.isInteger(t.points)||t.points<0||!Number.isInteger(t.earned)||t.earned<1||t.earned>9||t.points+t.nodes.length!==t.earned||!Number.isInteger(t.clears)||t.clears<0||t.clears>256)throw Error('Invalid talent checkpoint');
      for(const id of t.nodes)if(!nodes[id]||(nodes[id].requires&&!t.nodes.includes(nodes[id].requires)))throw Error('Invalid talent prerequisite');
    }
    const s=d.player.combatV11;if(s!==undefined){
      if(!s||!Number.isInteger(s.combo)||s.combo<0||s.combo>2||!Number.isInteger(s.casts)||s.casts<0||s.casts>11)throw Error('Invalid combat counter');
      for(const [k,max]of Object.entries(timers))if(!Number.isFinite(s[k])||s[k]<0||s[k]>max)throw Error('Invalid combat timer');
    }
    for(const r of d.rooms)if(r.talentCounted!==undefined&&typeof r.talentCounted!=='boolean')throw Error('Invalid talent credit');
  }
  return {branches,nodes,heroes,timers,combat,fresh,has,artifact,state,init,available,learn,prepare,validate};
})();
const progressDamage=Player.prototype.damage,progressArmor=Player.prototype.armor,progressCdr=Player.prototype.cdr,progressAttackCd=Player.prototype.attackCooldown,progressMax=Object.getOwnPropertyDescriptor(Player.prototype,'maxHp').get;
Player.prototype.damage=function(){return progressDamage.call(this)*(AdventureProgress.has(this,'edge')?1.08:1);};
Player.prototype.armor=function(){return progressArmor.call(this)+(AdventureProgress.has(this,'plate')?2:0)-(AdventureProgress.artifact(this,'glassheart')?1:0);};
Player.prototype.cdr=function(){return Math.min(.6,progressCdr.call(this)+(AdventureProgress.has(this,'focus')?.04:0));};
Player.prototype.attackCooldown=function(){return progressAttackCd.call(this)/(AdventureProgress.has(this,'fervor')?1.08:1);};
Object.defineProperty(Player.prototype,'maxHp',{configurable:true,get(){return progressMax.call(this)+(AdventureProgress.has(this,'vigor')?20:0)+(AdventureProgress.artifact(this,'glassheart')?20:0);}});
const progressTick=Player.prototype.tickTimers;
Player.prototype.tickTimers=function(dt){progressTick.call(this,dt);if(!this.combatV11)return;const s=this.combatV11;for(const k of Object.keys(AdventureProgress.timers))s[k]=Math.max(0,s[k]-dt);if(!s.comboTime)s.combo=0;};
const progressSummary=Player.prototype.statsSummary;
Player.prototype.statsSummary=function(){const s=progressSummary.call(this);if(this.talents){s['Приём героя']=AdventureProgress.heroes[this.hero.id][1];s['Таланты']=this.talents.nodes.length+' / 9 · '+this.talents.points+' очк.';}return s;};

const progressAttack=Game.prototype.playerAttack;
Game.prototype.playerAttack=function(){
  if(!this.journey?.seamless)return progressAttack.call(this);
  const p=this.player,s=AdventureProgress.state(p),id=p.hero.id;
  const a={hit:false,mult:(id==='arator'&&s.combo===2?1.6:id==='baldin'&&s.counterTime>0?1.5:id==='mithrandir'&&s.spellTime>0?2:1)*(s.rushTime>0?1.35:1)*(s.petalTime>0?1.3:1)*(s.echoTime>0?1.5:1),crit:id==='peregrin'&&s.evadeTime>0,origin:{x:p.x,y:p.y},ranged:id==='faelas',counter:id==='baldin'&&s.counterTime>0};
  this.progressAttackContext=a;try{progressAttack.call(this);}finally{this.progressAttackContext=null;}
  if(id==='arator'){s.combo=a.hit?(s.combo+1)%3:0;s.comboTime=a.hit?3:0;}
  s.spellTime=0;s.evadeTime=0;s.rushTime=0;s.petalTime=0;s.echoTime=0;
  if(a.counter&&a.hit){s.counterTime=0;p.shield=Math.max(p.shield,6);p.shieldTime=Math.max(p.shieldTime,3);}
};
const progressProjectile=Game.prototype.spawnProjectile;
Game.prototype.spawnProjectile=function(o){const a=this.progressAttackContext;if(a&&o.owner==='player')o={...o,dmg:o.dmg*a.mult,crit:o.crit||a.crit,size:o.size*(a.mult>1?1.2:1),masteryShot:a.ranged?a.origin:undefined};return progressProjectile.call(this,o);};
const progressHit=Game.prototype.hitEnemy;
Game.prototype.hitEnemy=function(e,dmg,opts={}){
  const a=this.progressAttackContext,p=this.player;
  if(this.journey?.seamless){
    if(a&&e.alive){if(!a.hit&&(a.mult>1||a.crit))this.addText(p.x,p.y-38,'Сильный удар!','#efd096');a.hit=true;dmg*=a.mult;opts={...opts,crit:opts.crit||a.crit};}
    if(opts.masteryShot&&dist(opts.masteryShot.x,opts.masteryShot.y,e.x,e.y)>=170)dmg*=1.25;
    if(AdventureProgress.has(p,'hunt')&&e.hp<e.maxHp*.3)dmg*=1.15;
  }return progressHit.call(this,e,dmg,opts);
};
const progressSkill=Game.prototype.useSkill;
Game.prototype.useSkill=function(i){
  const ready=this.journey?.seamless&&this.player.skillCds[i]<=0,result=progressSkill.call(this,i);if(!ready)return result;
  const p=this.player,s=AdventureProgress.state(p);s.casts=(s.casts+1)%12;
  if(p.hero.id==='mithrandir')s.spellTime=6;
  if(AdventureProgress.artifact(p,'petal'))s.petalTime=6;
  if(AdventureProgress.has(p,'weave'))p.skillCds=p.skillCds.map((v,j)=>j===i?v:Math.max(0,v-.6));
  if(AdventureProgress.has(p,'renew')&&s.casts%4===0)this.healPlayer(4);
  if(AdventureProgress.has(p,'echo')&&s.casts%3===0)s.echoTime=6;
  return result;
};
const progressDash=Game.prototype.playerDash;
Game.prototype.playerDash=function(p,...args){
  const result=progressDash.call(this,p,...args);if(!this.journey?.seamless)return result;
  const s=AdventureProgress.state(p);
  if(p.hero.id==='peregrin'&&s.evadeCd<=0){s.evadeTime=3;s.evadeCd=4;}
  if(AdventureProgress.has(p,'rush'))s.rushTime=3;
  if(AdventureProgress.has(p,'bastion')&&s.bastionCd<=0){p.shield=Math.max(p.shield,10);p.shieldTime=Math.max(p.shieldTime,3);s.bastionCd=5;}
  if(AdventureProgress.artifact(p,'hourglass')&&s.hourCd<=0){p.skillCds=p.skillCds.map(v=>Math.max(0,v-.8));s.hourCd=5;}
  return result;
};
const progressHurt=Game.prototype.damagePlayer;
Game.prototype.damagePlayer=function(amount,source){
  if(!this.journey?.seamless)return progressHurt.call(this,amount,source);
  const p=this.player,s=AdventureProgress.state(p),before=p.hp+p.shield;
  if(p.invulnTime<=0&&amount>0){
    if(AdventureProgress.has(p,'resolve')&&p.hp<p.maxHp*.35)amount*=.9;
    if(AdventureProgress.artifact(p,'mirror')&&s.mirrorCd<=0){amount*=.65;s.mirrorCd=14;}
  }
  const result=progressHurt.call(this,amount,source);if(p.hero.id==='baldin'&&p.hp>0&&p.hp+p.shield<before)s.counterTime=5;return result;
};
const progressEnemy=Game.prototype.makeJourneyEnemy;
Game.prototype.makeJourneyEnemy=function(...args){const e=progressEnemy.apply(this,args);if(this.journey?.seamless&&!e.isBoss){const f=ExpeditionLevels.get(this.journey.levelId).floor;e.expeditionDamageScale=1+.065*(f-1);e.dmg=e.def.dmg*e.expeditionDamageScale;e.hp=e.maxHp=Math.round(e.maxHp*(1+.1*(f-1)));}return e;};
const progressPopulate=Game.prototype.populateSeamlessFloor,progressZones=Game.prototype.updateSeamlessZones;
Game.prototype.populateSeamlessFloor=function(){progressPopulate.call(this);AdventureProgress.prepare(this);};
Game.prototype.updateSeamlessZones=function(){
  progressZones.call(this);if(!this.journey?.seamless)return;const p=this.player,t=p.talents;if(!t)return;
  let changed=false;for(const r of this.journey.rooms)if(r.cleared&&!r.talentCounted){r.talentCounted=true;changed=true;if(!['combat','elite','boss'].includes(r.role))continue;
    t.clears++;if(t.clears%4===0&&t.earned<9){t.earned++;t.points++;this.journey.notice='Новое очко таланта! Нажмите K или откройте таланты из паузы.';this.journey.noticeTime=5;}
    if(AdventureProgress.artifact(p,'scarab')){p.shield=Math.max(p.shield,12);p.shieldTime=Math.max(p.shieldTime,15);}
    if(AdventureProgress.artifact(p,'incense'))this.healPlayer(6);
  }if(changed)this.saveJourney();
};

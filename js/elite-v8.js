'use strict';
// One marked guard per elite arena. An affix augments the existing creature's
// AI and silhouette; it does not replace the biome's enemy or boss roster.
const EliteTrials=(()=>{
  const affixes=Object.freeze({echo:{name:'ГУЛ ГЛУБИН',color:'#ecc487',kind:'elite-ring',cooldown:6.5},brand:{name:'ПЕЧАТЬ ПЕПЛА',color:'#edb1a4',kind:'elite-brand',cooldown:7}});
  function apply(e,affix,fresh=false){
    e.eliteAffix=affix;e.eliteCooldown=3.5;
    // Derive values from the source definition: restoring never multiplies an
    // already scaled stat. HP from a checkpoint is retained verbatim.
    e.dmg=e.def.dmg*(e.expeditionDamageScale||1)*1.12;e.armor=(e.def.armor||0)+1;
    if(fresh)e.hp=e.maxHp=Math.round(e.maxHp*1.35);
  }
  function populate(g){
    for(const r of g.journey.rooms)if(r.role==='elite'){
      const guards=g.enemies.filter(e=>e.homeRoom===r.id);if(guards.some(e=>e.isBoss))continue;
      const e=guards.find(e=>!e.isBoss);if(e){const rng=new RNG((g.journey.seed+r.id*3797)>>>0);apply(e,rng.pick(['echo','brand']),true);}
    }
  }
  function snapshot(e){return e.eliteAffix?{affix:e.eliteAffix,cooldown:e.eliteCooldown,combat:RootCombat.snapshot(e)}:undefined;}
  function restore(e,s){if(!s)return;apply(e,s.affix);e.eliteCooldown=s.cooldown;RootCombat.restore(e,s.combat);}
  function validateSave(data){for(const e of data.enemies){const s=e.eliteState;if(s===undefined)continue;
    if(!s||e.isBoss||!Object.hasOwn(affixes,s.affix)||!Number.isFinite(s.cooldown)||s.cooldown<0||s.cooldown>8||!RootCombat.validState(s.combat))throw Error('Invalid elite checkpoint');
  }}
  function cast(g,e){
    const a=affixes[e.eliteAffix],p=g.player;
    const shapes=e.eliteAffix==='echo'?[{shape:'ring',x:e.x,y:e.y,inner:68,r:148}]:[{shape:'circle',x:p.x,y:p.y,r:55}];
    RootCombat.warn(e,a.kind,shapes,1.2,{fixed:true});e.eliteCooldown=a.cooldown;
  }
  return {affixes,apply,populate,snapshot,restore,validateSave,cast};
})();
const elitePopulate=Game.prototype.populateSeamlessFloor,eliteUpdateEnemy=Game.prototype.updateEnemy;
Game.prototype.populateSeamlessFloor=function(){elitePopulate.call(this);EliteTrials.populate(this);};
Game.prototype.updateEnemy=function(e,dt){
  if(!e.eliteAffix||!this.journey?.seamless||this.state!=='run'||!e.alive||!this.journey.rooms[e.homeRoom]?.active||dist(e.x,e.y,this.player.x,this.player.y)>1200)return eliteUpdateEnemy.call(this,e,dt);
  e.eliteCooldown=Math.max(0,e.eliteCooldown-dt);
  if(e.stun>0&&e.telegraph?.kind?.startsWith('elite-')){e.telegraph=null;e.windup=0;e.state='chase';e.eliteCooldown=Math.max(3,e.eliteCooldown);e.attackTimer=Math.max(.8,e.attackTimer);}
  const p=this.player;
  if(e.hp>0&&e.stun<=0&&e.eliteCooldown<=0&&!e.telegraph&&!e.charge&&e.state!=='windup'&&!(e.rootRecovery>0)&&dist(e.x,e.y,p.x,p.y)<330&&!p.isInvisible()&&this.canReach(e,p))EliteTrials.cast(this,e);
  // The root bestiary already handles its own recovery. Legacy enemies need
  // the same short vulnerable pause after resolving an affix spell.
  const speed=e.speed;if(!e.def.rootvault&&e.rootRecovery>0){e.rootRecovery=Math.max(0,e.rootRecovery-dt);e.speed=0;}
  try{return eliteUpdateEnemy.call(this,e,dt);}finally{e.speed=speed;}
};
const eliteDraw=Renderer.prototype.drawEnemies;
Renderer.prototype.drawEnemies=function(){
  const g=this.g,c=this.ctx,visible=g.enemies.filter(e=>e.alive&&e.eliteAffix&&this.visibleAt(e.x,e.y));
  for(const e of visible)ActorMotion.rune(c,e.x,e.y+2,e.r+10,0,EliteTrials.affixes[e.eliteAffix].color,.8);
  eliteDraw.call(this);
  for(const e of visible){const a=EliteTrials.affixes[e.eliteAffix],top=this.bodyTop('enemies',e.type,e,e.r)-22;
    RoutePaint.plate(c,e.x-65,top-9,130,19);RoutePaint.text(c,a.name,e.x,top+1,a.color,9);
  }
};


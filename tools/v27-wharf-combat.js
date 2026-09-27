/* Wharf roster and attack choreography. Frozen RootCombat shapes drive both warning and damage. */
(() => {
  'use strict';
  if(window.V27WharfCombat)return;
  const roster={
    wharf_crab:{name:'Краб-утилизатор',symbol:'▣',shape:'hex',color:'#b3bcb0',size:20,hp:114,dmg:14,speed:108,armor:2,xp:42,shards:3,gold:[8,14],sight:650,attackRange:70,attackCd:2.4,windup:1.05,rootvault:true,pattern:'sweep',minFloor:99,weight:0},
    wharf_harpooner:{name:'Гарпунщик корпуса',symbol:'↗',shape:'diamond',color:'#c7c4af',size:17,hp:82,dmg:16,speed:92,armor:0,xp:42,shards:3,gold:[8,14],sight:690,attackRange:430,keepDistance:205,ranged:true,projSpeed:300,projColor:'#e1b58b',attackCd:3.3,windup:1.2,rootvault:true,pattern:'fan',minFloor:99,weight:0}
  };
  Object.assign(MONSTERS,roster);
  BOSSES.wharf_foreman={...ExpeditionLevels.get('drownedwharf').bossDef};

  const active=(g,e)=>g?.journey?.seamless&&g.journey.levelId==='drownedwharf'&&
    ['wharf_crab','wharf_harpooner','wharf_foreman'].includes(e?.type);
  const angleToPlayer=(g,e)=>Math.atan2(g.player.y-e.y,g.player.x-e.x);
  const warning=(e,kind,shapes,time,action)=>
    RootCombat.warn(e,kind,shapes,time,{fixed:true,wharf:true,wharfAction:action});
  const priorBasic=RootCombat.basic;
  RootCombat.basic=function(g,e){
    if(!active(g,e))return priorBasic.call(this,g,e);
    const a=Math.atan2(e.windupDir?.y??0,e.windupDir?.x??1);
    if(e.type==='wharf_harpooner'){
      // A fixed narrow harpoon lane. The player sees its final heading before it can hit.
      warning(e,'bolts',[{shape:'lane',x:e.x,y:e.y,angle:a,len:470,back:e.r+7,half:13}],1.2,'harpoon');
    }else{
      warning(e,'sweep',[{shape:'cone',x:e.x,y:e.y,angle:a,
        r:e.isBoss?160:120,half:e.isBoss?.85:1.03}],e.isBoss?1.02:1.05,'hull-sweep');
    }
  };

  // A warned physical approach gives ranged heroes a reason to reposition.
  // The entire 210 px travel and contact disc fit inside the announced lane.
  const priorEnemy=Game.prototype.updateEnemy;
  Game.prototype.updateEnemy=function(e,dt){
    if(active(this,e)&&e.type==='wharf_crab'&&e.alive&&this.state==='run'&&this.journey.rooms[e.homeRoom]?.active){
      const timers=e.abilityTimers||(e.abilityTimers={});timers.wharfRush??=3.4;
      timers.wharfRush=Math.max(-1,timers.wharfRush-dt);
      const p=this.player,d=Math.hypot(p.x-e.x,p.y-e.y);
      if(timers.wharfRush<=0&&d>145&&d<460&&!p.isInvisible()&&e.stun<=0&&!e.telegraph&&!e.charge&&!e.rootRecovery&&e.state!=='windup'&&this.canReach(e,p)){
        const a=angleToPlayer(this,e);
        warning(e,'lunge',[{shape:'lane',x:e.x,y:e.y,angle:a,len:240,back:e.r+8,half:e.r+14}],.9,'scrap-rush');
        timers.wharfRush=5.8;e.attackTimer=Math.max(e.attackTimer,1.7);
      }
    }
    return priorEnemy.call(this,e,dt);
  };

  const priorBoss=Game.prototype.updateBossAbilities;
  Game.prototype.updateBossAbilities=function(e,dt,d,los){
    if(!active(this,e)||e.type!=='wharf_foreman')return priorBoss.call(this,e,dt,d,los);
    if(this.state!=='run'||e.stun>0||e.telegraph||e.charge||e.rootRecovery>0)return false;
    if(e.hp<e.maxHp*.5&&e.phase===1){
      e.phase=2;e.rootRecovery=.85;e.attackTimer=Math.max(e.attackTimer,1.05);
      this.message('Смотритель корпуса поднимает второй кран!');return true;
    }
    // The boss definition keeps its base JSON fields; these extra numeric timers
    // travel through RootCombat.snapshot/restore and validState unchanged.
    const clocks=e.abilityTimers;
    clocks.wharfSlam??=3.8;clocks.wharfLanes??=5.4;clocks.wharfSweep??=7.1;
    const rate=e.phase===2?1.18:1;
    for(const key of ['wharfSlam','wharfLanes','wharfSweep'])clocks[key]-=dt*rate;
    if(!los||this.player.isInvisible()||d>480)return false;
    const a=angleToPlayer(this,e),p=this.player;
    if(clocks.wharfSlam<=0&&d<310){
      clocks.wharfSlam=e.phase===2?6.1:7.5;
      warning(e,'hammerfall',[{shape:'circle',x:p.x,y:p.y,r:e.phase===2?76:65}],1.12,'crane-stomp');
    }else if(clocks.wharfLanes<=0&&d>105){
      clocks.wharfLanes=e.phase===2?6.7:8.2;
      const nx=-Math.sin(a),ny=Math.cos(a),spacing=e.phase===2?72:62;
      const offsets=e.phase===2?[-spacing,0,spacing]:[-spacing,spacing];
      warning(e,'mirror-lanes',offsets.map(offset=>({shape:'lane',x:e.x+nx*offset,
        y:e.y+ny*offset,angle:a,len:Math.min(440,d+80),back:e.r+8,half:e.phase===2?18:20})),1.18,'harpoon-lanes');
    }else if(clocks.wharfSweep<=0&&d<235){
      clocks.wharfSweep=e.phase===2?5.5:7;
      warning(e,'sweep',[{shape:'cone',x:e.x,y:e.y,angle:a,r:e.phase===2?230:200,
        half:e.phase===2?1.18:1.06}],1.08,'hull-sweep');
    }else return false;
    e.attackTimer=Math.max(e.attackTimer,1.5);
    return true;
  };

  const priorResolve=Game.prototype.resolveTelegraph;
  Game.prototype.resolveTelegraph=function(e){
    const t=e.telegraph;
    if(!active(this,e)||t?.type!=='root'||t.wharf!==true)return priorResolve.call(this,e);
    e.telegraph=null;
    if(!e.alive||e.stun>0||this.state!=='run')return;
    e.rootRecovery=t.wharfAction==='crane-stomp'?.9:.72;
    if(t.wharfAction==='scrap-rush'){
      const a=t.shapes[0].angle;
      e.charge={vx:Math.cos(a)*500,vy:Math.sin(a)*500,time:.42,hit:false,v17:true,damage:.9};
      e.rootRecovery=1.14;e.attackTimer=Math.max(e.attackTimer,1.65);
      ActorMotion.event(e,'attack',.42,a);return;
    }
    e.attackTimer=Math.max(e.attackTimer,e.rootRecovery+.48);
    ActorMotion.event(e,'attack',.35,t.shapes[0]?.angle??angleToPlayer(this,e));
    this.rootImpacts??=[];
    this.rootImpacts.push({shapes:t.shapes,life:.35,total:.35,kind:t.kind});
    if(this.rootImpacts.length>24)this.rootImpacts.shift();
    if(t.shapes.some(shape=>RootCombat.canDamage(this,shape)))
      this.damagePlayer(e.dmg*(e.isBoss&&t.wharfAction==='crane-stomp'?1.2:1),e);
    this.shake=Math.max(this.shake,e.isBoss?5:2);
  };
  window.V27WharfCombat={version:27,roster,active};
})();

// Darkroot encounter choreography. Install after v27-darkroot-runtime and the
// existing RootCombat module, before the game instance is constructed.
(() => {
  'use strict';
  if (window.V27DarkrootCombat) return;
  const ids = new Set(['root_reaper', 'root_grafter', 'root_heart']);
  const active = (g, e) => g?.journey?.seamless && g.journey.levelId === 'darkroot' && ids.has(e?.type);
  const angle = (e, p) => Math.atan2(p.y - e.y, p.x - e.x);
  const previousBasic = RootCombat.basic;
  RootCombat.basic = function (g, e) {
    if (!active(g, e)) return previousBasic.call(this, g, e);
    if (e.type === 'root_grafter') {
      // This target is a snapshot: stepping away during the warning works.
      RootCombat.warn(e, 'spores', [{shape:'circle', x:g.player.x, y:g.player.y, r:61}], 1.2,
        {fixed:true, v27Darkroot:true});
    } else {
      const a = Math.atan2(e.windupDir.y, e.windupDir.x);
      RootCombat.warn(e, 'sweep', [{shape:'cone', x:e.x, y:e.y, angle:a,
        r:e.type === 'root_heart' ? 128 : 133, half:e.type === 'root_heart' ? .91 : 1.13}],
        e.def.windup, {fixed:true, v27Darkroot:true});
    }
  };

  const previousEnemy = Game.prototype.updateEnemy;
  Game.prototype.updateEnemy = function (e, dt) {
    if (!active(this, e)) return previousEnemy.call(this, e, dt);
    if (this.state!=='run' || !e.alive || !this.journey.rooms[e.homeRoom]?.active)
      return previousEnemy.call(this,e,dt);
    const p = this.player, d = Math.hypot(p.x-e.x, p.y-e.y);
    // The timer belongs to the ordinary saved abilityTimers object. A distant
    // target sees the complete dash lane before collision movement begins.
    if (e.type === 'root_reaper' && e.alive && e.state === 'chase' && !e.telegraph && !e.charge &&
        !(e.stun>0) && !(e.rootRecovery>0) && d>174 && d<375 && !p.isInvisible() &&
        this.canReach(e,p)) {
      e.abilityTimers ??= {};
      e.abilityTimers.rootLeap ??= 1.3;
      e.abilityTimers.rootLeap = Math.max(-1, e.abilityTimers.rootLeap-dt);
      if (e.abilityTimers.rootLeap<=0) {
        const a=angle(e,p);
        RootCombat.warn(e,'lunge',[{shape:'lane',x:e.x,y:e.y,angle:a,
          len:250,back:e.r+5,half:e.r+p.r+7}],.9,{fixed:true,v27Darkroot:true});
        e.abilityTimers.rootLeap=6.7;
        e.attackTimer=Math.max(e.attackTimer,1.25);
      }
    }
    const speed=e.speed, keep=e.def.keepDistance;
    // Close to a kiting player promptly; the actual release is still warned.
    if (e.type === 'root_reaper' && e.state === 'chase' && d>100 && d<360 &&
        !e.telegraph && !e.charge) e.speed*=1.2;
    if (e.type === 'root_grafter') e.def.keepDistance=105;
    try {
      const result=previousEnemy.call(this,e,dt);
      // A bounded side-step breaks the straight pursuit line. Below 105 px
      // the existing ranged AI backs away; beyond that it does not flee.
      if (e.type==='root_grafter' && e.alive && e.state==='chase' &&
          !e.telegraph && !e.charge && !(e.stun>0) && !(e.rootRecovery>0) &&
          d>112 && d<315 && this.canReach(e,p)) {
        const a=angle(e,p)+(e.homeRoom%2 ? 1 : -1)*Math.PI/2;
        this.moveEntity(e,Math.cos(a)*speed*.37*dt,Math.sin(a)*speed*.37*dt);
      }
      return result;
    }
    finally { e.speed=speed; if(e.type==='root_grafter') e.def.keepDistance=keep; }
  };

  const previousBoss = Game.prototype.updateBossAbilities;
  Game.prototype.updateBossAbilities = function (e,dt,d,los) {
    if (!active(this,e) || e.type!=='root_heart')
      return previousBoss.call(this,e,dt,d,los);
    if (this.state!=='run' || !e.alive || e.stun>0 || e.telegraph || e.charge || e.rootRecovery>0)
      return false;
    if (e.phase===1 && e.hp<=e.maxHp*.5) {
      e.phase=2;
      e.rootRecovery=1.35;
      e.attackTimer=Math.max(e.attackTimer,1.7);
      this.message('Сердцевик раскрыл вторую сердцевину! Следите за проходами между корнями.');
      return true;
    }
    const ab=e.def.abilities, timers=e.abilityTimers;
    for (const key of ['pulse','graft','rootlane']) {
      timers[key] ??= ab[key];
      timers[key]=Math.max(-1,timers[key]-dt*(e.phase===2?1.15:1));
    }
    if (!los || d>490 || this.player.isInvisible()) return false;
    const p=this.player, a=angle(e,p), second=e.phase===2;
    if (timers.pulse<=0 && d<285) {
      timers.pulse=ab.pulse;
      // The center is safe, including the player's collision radius.
      RootCombat.warn(e,'toll',[{shape:'ring',x:e.x,y:e.y,inner:second?94:87,r:second?220:204}],
        second?1.18:1.34,{fixed:true,v27Darkroot:true});
      return true;
    }
    if (timers.graft<=0) {
      timers.graft=ab.graft;
      RootCombat.warn(e,'bolts',[{shape:'circle',x:p.x,y:p.y,r:second?76:67}],
        second?1.12:1.27,{fixed:true,v27Darkroot:true});
      return true;
    }
    if (timers.rootlane<=0 && d>95) {
      timers.rootlane=ab.rootlane;
      const base={shape:'lane',x:e.x,y:e.y,len:Math.min(465,d+85),back:e.r+6,
        half:second?18:21};
      const offsets=second?[-.57,0,.57]:[-.42,.42];
      RootCombat.warn(e,'mirror-lanes',offsets.map(v=>({...base,angle:a+v})),
        second?1.15:1.36,{fixed:true,v27Darkroot:true});
      return true;
    }
    return false;
  };

  const previousResolve = Game.prototype.resolveTelegraph;
  Game.prototype.resolveTelegraph = function (e) {
    const t=e?.telegraph;
    if (!active(this,e) || t?.type!=='root' || !t.v27Darkroot)
      return previousResolve.call(this,e);
    e.telegraph=null;
    if (!e.alive || e.stun>0 || this.state!=='run') return;
    const cast=e.type==='root_grafter' || (e.type==='root_heart' && t.kind!=='sweep');
    ActorMotion.event(e,cast?'cast':'attack',.4,t.shapes[0]?.angle||0);
    e.rootRecovery=e.type==='root_heart' ? (e.phase===2?1.85:2.05) :
      e.type==='root_reaper' ? .83 : .95;
    e.attackTimer=Math.max(e.attackTimer,e.rootRecovery+.35);
    if (t.kind==='lunge') {
      const a=t.shapes[0].angle;
      // 420 px/s for .5 s = 210 px; 250 includes both collision radii.
      e.charge={vx:Math.cos(a)*420,vy:Math.sin(a)*420,time:.5,hit:false};
      return;
    }
    if (t.kind==='spores') {
      this.rootHazards??=[];
      if(this.rootHazards.length>=32)this.rootHazards.shift();
      this.rootHazards.push({...t.shapes[0],sourceId:RootCombat.id(e),sourceType:e.type,
        homeRoom:e.homeRoom,dmg:e.dmg,life:2.45,tick:0});
      return;
    }
    this.rootImpacts??=[];
    this.rootImpacts.push({shapes:t.shapes,life:.4,total:.4,kind:t.kind});
    if(this.rootImpacts.length>24)this.rootImpacts.shift();
    if(t.shapes.some(s=>RootCombat.canDamage(this,s)))
      this.damagePlayer(e.dmg*(e.isBoss?1.12:1),e);
    this.shake=Math.max(this.shake,e.isBoss?6:3);
  };

  const previousRender=Renderer.prototype.render;
  Renderer.prototype.render=function(){
    previousRender.call(this);
    const g=this.g,e=g.boss,t=e?.telegraph;
    if(!active(g,e)||e.type!=='root_heart'||g.state!=='run'||!t?.v27Darkroot||
       Math.hypot(e.x-g.player.x,e.y-g.player.y)>1000)return;
    const label=t.kind==='toll'?'СЕРДЦЕ КОЛЬЦА БЕЗОПАСНО':
      t.kind==='bolts'?'УЙДИ С ОТМЕЧЕННОГО МЕСТА':
      t.kind==='mirror-lanes'?'ПРОХОДЫ МЕЖДУ КОРНЯМИ':'ОТОЙДИ ОТ СЕКТОРА';
    RoutePaint.plate(this.ctx,756,78,254,25);
    RoutePaint.text(this.ctx,label,883,91,'#d7edb9',10);
  };
  window.V27DarkrootCombat=Object.freeze({version:27});
})();

/* Red Quarry combat. Paint and timings use RootCombat's checkpoint-safe geometry. */
(() => {
  'use strict';
  if (window.V27QuarryCombat) return;
  const IDs = new Set(['quarry_cleaver','quarry_scorcher','quarry_cutter']);
  const active = (g,e) => g?.journey?.seamless && g.journey.levelId === 'redquarry' && IDs.has(e?.type);
  const angle = (a,b) => Math.atan2(b.y-a.y,b.x-a.x);
  const lane = (e,a,len,half,offset=0) => ({shape:'lane',x:e.x-Math.sin(a)*offset,y:e.y+Math.cos(a)*offset,angle:a,len,back:e.r+5,half});
  const previousBasic = RootCombat.basic;
  RootCombat.basic = function(g,e) {
    if (!active(g,e)) return previousBasic.apply(this,arguments);
    const a = e.windupDir ? Math.atan2(e.windupDir.y,e.windupDir.x) : angle(e,g.player);
    if (e.type === 'quarry_scorcher') {
      // Frozen world position, with a full second to leave the mark. No hazard.
      if (!g.canReach(e,g.player)) { e.state='chase'; e.windup=0; e.attackTimer=Math.max(e.attackTimer,.8); return; }
      RootCombat.warn(e,'bolts',[{shape:'circle',x:g.player.x,y:g.player.y,r:48}],1.12,{fixed:true,quarry:true});
    } else {
      RootCombat.warn(e,'sweep',[{shape:'cone',x:e.x,y:e.y,angle:a,r:e.isBoss?162:127,half:e.isBoss?.86:.95}],e.isBoss?.98:1.06,{quarry:true});
    }
  };

  // The cleaver takes a collision-aware stride at a kiting target. Its cooldown
  // lives in abilityTimers so mid-windup and post-charge saves restore exactly.
  const previousEnemy = Game.prototype.updateEnemy;
  Game.prototype.updateEnemy = function(e,dt) {
    if (active(this,e) && e.type === 'quarry_cleaver' && e.alive && this.state === 'run' && this.journey.rooms[e.homeRoom]?.active && !(e.arrival > 0)) {
      e.abilityTimers ??= {};
      if (!Number.isFinite(e.abilityTimers.quarryLunge)) e.abilityTimers.quarryLunge = 3.2;
      const t = e.abilityTimers;
      if (!e.telegraph && !e.charge && e.stun <= 0 && !(e.rootRecovery > 0)) {
        t.quarryLunge -= dt;
        const p=this.player,d=Math.hypot(p.x-e.x,p.y-e.y);
        if (t.quarryLunge <= 0 && d > 125 && d < 242 && e.state === 'chase' && !p.isInvisible() && this.canReach(e,p)) {
          const a=angle(e,p);
          t.quarryLunge=5.2;
          RootCombat.warn(e,'lunge',[lane(e,a,244,e.r+12)],.96,{fixed:true,quarry:true});
        }
      }
    }
    return previousEnemy.apply(this,arguments);
  };

  const previousBoss = Game.prototype.updateBossAbilities;
  Game.prototype.updateBossAbilities = function(e,dt,d,los) {
    if (!active(this,e) || e.type !== 'quarry_cutter') return previousBoss.apply(this,arguments);
    if (this.state !== 'run' || !e.alive || e.stun > 0 || e.rootRecovery > 0 || e.telegraph || e.charge) return false;
    if (e.hp <= e.maxHp*.5 && e.phase === 1) {
      e.phase=2;
      e.rootRecovery=.72;
      e.attackTimer=Math.max(e.attackTimer,.9);
      this.message('Резец ускоряет круг: между полосами есть проходы!');
      return true;
    }
    const timers=e.abilityTimers ??= {},ab=e.def.abilities||{},rate=e.phase===2?1.22:1;
    for (const key of ['cut','mark']) {
      if (!Number.isFinite(timers[key])) timers[key]=ab[key]||7;
      timers[key]-=dt*rate;
    }
    const p=this.player;
    if (!los || p.isInvisible() || !this.canReach(e,p)) return false;
    const a=angle(e,p);
    if (timers.cut<=0 && d<370) {
      timers.cut=ab.cut||6.8;
      const len=Math.min(380,Math.max(205,d+48));
      const shapes=[lane(e,a,len,18)];
      if (e.phase===2) shapes.push(lane(e,a,len,17,-74),lane(e,a,len,17,74));
      RootCombat.warn(e,'lunge',shapes,e.phase===2?1.04:1.23,{fixed:true,quarry:true});
      return true;
    }
    if (timers.mark<=0 && d<475) {
      timers.mark=ab.mark||8.4;
      const shapes=[{shape:'circle',x:p.x,y:p.y,r:e.phase===2?56:50}];
      if (e.phase===2) {
        // Companion mark leaves a clear route perpendicular to the target line.
        shapes.push({shape:'circle',x:p.x+Math.cos(a)*112,y:p.y+Math.sin(a)*112,r:42});
      }
      RootCombat.warn(e,'bolts',shapes,e.phase===2?1.06:1.23,{fixed:true,quarry:true,quarryCast:true});
      return true;
    }
    return false;
  };

  const previousResolve = Game.prototype.resolveTelegraph;
  Game.prototype.resolveTelegraph = function(e) {
    const t=e.telegraph;
    if (!active(this,e) || t?.type !== 'root' || !t.quarry) return previousResolve.apply(this,arguments);
    e.telegraph=null;
    if (!e.alive || e.stun > 0 || this.state !== 'run') return;
    const isLunge=t.kind==='lunge';
    e.rootRecovery=isLunge?.67:.56;
    e.attackTimer=Math.max(e.attackTimer,e.rootRecovery+.4);
    const a=t.shapes[0]?.angle ?? angle(e,this.player);
    ActorMotion.event(e,t.kind==='bolts'?'cast':'attack',isLunge?.52:.4,a);
    this.rootImpacts ??= [];
    this.rootImpacts.push({shapes:t.shapes,life:.32,total:.32,kind:t.kind});
    if (this.rootImpacts.length>24) this.rootImpacts.shift();
    if (t.shapes.some(s=>RootCombat.canDamage(this,s)))
      this.damagePlayer(e.dmg*(e.type==='quarry_cutter'?1.16:1),e);
    if (isLunge) {
      // Native updateCharge calls moveEntity, which subdivides collision steps.
      // Damage was resolved against the exact warned lanes, so contact cannot double-hit.
      const travel=e.type==='quarry_cutter'?160:195;
      const time=e.type==='quarry_cutter'?.43:.56;
      e.charge={vx:Math.cos(a)*travel/time,vy:Math.sin(a)*travel/time,time,hit:true};
    }
  };
  window.V27QuarryCombat=Object.freeze({version:27,ids:Object.freeze([...IDs]),active});
})();

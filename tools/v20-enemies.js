// v20 bestiary. Inject into the classic game script before // ---- js/main.js ----.
// All additions use the existing RootCombat geometry, so warning and hit test agree.
(() => {
  const roster = {
    seamcrab: {name:'Шовный краб',symbol:'▣',shape:'hex',color:'#8cddc6',size:19,hp:166,dmg:19,speed:106,armor:4,xp:68,shards:4,gold:[12,22],sight:610,attackRange:62,attackCd:2.1,windup:.9,rootvault:true,pattern:'sweep',minFloor:5,weight:2},
    rimeprowler: {name:'Инейный следопыт',symbol:'◈',shape:'diamond',color:'#83c5d9',size:15,hp:108,dmg:17,speed:165,armor:1,xp:55,shards:3,gold:[8,16],sight:650,attackRange:74,attackCd:2.35,windup:.76,rootvault:true,pattern:'lunge',minFloor:4,weight:3},
    gravechanter: {name:'Певчий осколков',symbol:'✦',shape:'hex',color:'#b6a2e4',size:15,hp:86,dmg:14,speed:102,xp:52,shards:3,gold:[9,17],sight:650,attackRange:300,keepDistance:150,ranged:true,projSpeed:260,projColor:'#c6a9ed',attackCd:2.5,windup:.8,rootvault:true,pattern:'fan',minFloor:4,weight:3},
    sigilbinder: {name:'Печатник трещин',symbol:'✥',shape:'circle',color:'#e9a77b',size:17,hp:104,dmg:12,speed:92,xp:58,shards:3,gold:[10,18],sight:650,attackRange:280,keepDistance:125,ranged:true,projSpeed:230,projColor:'#ffc39d',attackCd:3.2,windup:1,rootvault:true,pattern:'spores',minFloor:5,weight:2}
  };
  Object.assign(MONSTERS, roster);
  BOSSES.clockweaver={id:'clockweaver',name:'Часовщик разлома',symbol:'⌛',shape:'hex',color:'#d6b5ed',size:35,hp:1280,dmg:24,speed:112,armor:5,xp:800,shards:60,gold:[145,220],sight:1100,attackRange:96,attackCd:2.5,windup:.85,rootvault:true,pattern:'sweep',abilities:{cross:5.8,mark:7.4,ring:8.8,summon:15}};
  // Its entire collision travel fits inside the announced lane, including
  // both body radii. The core lunge uses 420 px/s for .5 s (210 px).
  const previousBasic=RootCombat.basic;
  RootCombat.basic=function(g,e){
    if(e.type==='rimeprowler'){
      const a=Math.atan2(e.windupDir.y,e.windupDir.x);
      RootCombat.warn(e,'lunge',[{shape:'lane',x:e.x,y:e.y,angle:a,len:245,back:e.r+8,half:e.r+14}],e.def.windup,{fixed:true});
      return;
    }
    return previousBasic.call(this,g,e);
  };
  const ids=new Set([...Object.keys(roster),'clockweaver']);
  const v20=g=>g?.journey?.seamless&&g.journey.v20MapVersion===20;
  // Applied before EncounterDirector.scale. Old checkpoints retain their old actors.
  const previousMake=Game.prototype.makeJourneyEnemy;
  Game.prototype.makeJourneyEnemy=function(type,x,y,boss=false,homeRoom){
    if(v20(this)&&this.journey.levelId==='glass'){
      if(type==='glassregent'&&boss)type='clockweaver';
      else if(type==='glassduelist')type=homeRoom%2===0?'rimeprowler':'seamcrab';
      else if(type==='prismmoth'&&homeRoom%2===1)type='gravechanter';
      else if(type==='wraith'&&homeRoom%3===0)type='sigilbinder';
    }
    return previousMake.call(this,type,x,y,boss,homeRoom);
  };
  // The glass boss is also referred to by the legacy boss roster on room creation.
  // This wrapper maps the encounter type at construction, while later waves use
  // the same constructor and new saves contain the new IDs themselves.
  const previousBoss=Game.prototype.updateBossAbilities;
  Game.prototype.updateBossAbilities=function(e,dt,d,los){
    if(e.type!=='clockweaver')return previousBoss.call(this,e,dt,d,los);
    if(this.state!=='run'||e.stun>0||e.rootRecovery>0||e.telegraph||e.charge)return false;
    if(e.hp<e.maxHp*.5&&e.phase===1){e.phase=2;this.message('Часовщик ускоряет ход! Между полосами остаются проходы.');e.rootRecovery=.8;e.attackTimer=Math.max(e.attackTimer,1);return true;}
    const ab=e.def.abilities,rate=e.phase===2?1.22:1;
    for(const key in ab)e.abilityTimers[key]-=dt*rate;
    if(!los||this.player.isInvisible())return false;
    const p=this.player,a=angleTo(e.x,e.y,p.x,p.y);
    if(e.abilityTimers.cross<=0&&d>110&&d<490){
      e.abilityTimers.cross=ab.cross;
      const base={shape:'lane',x:e.x,y:e.y,len:Math.min(455,d+85),back:e.r+5,half:19};
      RootCombat.warn(e,'mirror-lanes',[{...base,angle:a-.28},{...base,angle:a+.28}],e.phase===2?1.08:1.28,{fixed:true,v20:true});
      return true;
    }
    if(e.abilityTimers.mark<=0&&d>190&&d<550){
      e.abilityTimers.mark=ab.mark;
      RootCombat.warn(e,'bolts',[{shape:'circle',x:p.x,y:p.y,r:e.phase===2?70:61}],1.16,{fixed:true,v20:true});
      return true;
    }
    if(e.abilityTimers.ring<=0&&d<225){
      e.abilityTimers.ring=ab.ring;
      RootCombat.warn(e,'toll',[{shape:'ring',x:e.x,y:e.y,inner:72,r:e.phase===2?225:205}],1.13,{fixed:true,v20:true});
      return true;
    }
    if(e.abilityTimers.summon<=0){
      e.abilityTimers.summon=ab.summon;
      const count=this.enemies.filter(v=>v.alive&&v.homeRoom===e.homeRoom).length;
      if(count<7){
        const spots=[];
        for(let i=0;i<20&&spots.length<2;i++){
          const angle=i*2.39996323+e.phase,x=e.x+Math.cos(angle)*115,y=e.y+Math.sin(angle)*105;
          if(!this.map.circleBlocked(x,y,roster.rimeprowler.size+4)&&dist(x,y,p.x,p.y)>95&&this.enemies.every(v=>!v.alive||dist(x,y,v.x,v.y)>v.r+30)&&spots.every(s=>dist(x,y,s.x,s.y)>60))spots.push({shape:'circle',x,y,r:24});
        }
        if(spots.length){RootCombat.warn(e,'summon',spots,1.28,{fixed:true,v20:true});return true;}
      }
    }
    return false;
  };
  const previousResolve=Game.prototype.resolveTelegraph;
  Game.prototype.resolveTelegraph=function(e){
    const t=e.telegraph;
    if(t?.type!=='root'||!t.v20)return previousResolve.call(this,e);
    e.telegraph=null;
    if(!e.alive||e.stun>0||this.state!=='run')return;
    e.rootRecovery=.72;e.attackTimer=Math.max(e.attackTimer,1.05);
    ActorMotion.event(e,t.kind,.4,t.shapes[0]?.angle||0);
    if(t.kind==='summon'){
      for(const shape of t.shapes){
        if(this.enemies.filter(v=>v.alive&&v.homeRoom===e.homeRoom).length>=8)break;
        if(this.map.circleBlocked(shape.x,shape.y,roster.rimeprowler.size+4)||dist(shape.x,shape.y,this.player.x,this.player.y)<70||this.enemies.some(v=>v.alive&&dist(v.x,v.y,shape.x,shape.y)<v.r+22))continue;
        const m=this.makeJourneyEnemy('rimeprowler',shape.x,shape.y,false,e.homeRoom);
        m.homeRoom=e.homeRoom;m.state='chase';m.memory=6;m.attackTimer=1.6;this.enemies.push(m);
        ActorMotion.add(this,{kind:'burst',x:shape.x,y:shape.y,r:32,color:'#a9ddea',life:.5});
      }
      return;
    }
    this.rootImpacts??=[];this.rootImpacts.push({shapes:t.shapes,life:.38,total:.38,kind:t.kind});
    if(this.rootImpacts.length>24)this.rootImpacts.shift();
    if(t.shapes.some(s=>RootCombat.canDamage(this,s)))this.damagePlayer(e.dmg*(t.kind==='toll'?1.1:1.18),e);
    this.shake=Math.max(this.shake,4);
  };
  // Each new actor has a short, legible label and its own silhouette. Drawn after
  // sprites so no external image asset is required to identify them.
  const previousDraw=Renderer.prototype.drawEnemies;
  Renderer.prototype.drawEnemies=function(){
    previousDraw.call(this);
    const c=this.ctx,g=this.g;
    for(const e of g.enemies){if(!e.alive||!ids.has(e.type)||!this.visibleAt(e.x,e.y))continue;
      c.save();c.translate(e.x,e.y);c.strokeStyle=e.def.color;c.lineWidth=e.isBoss?2.8:2;
      c.globalAlpha=e.hitFlash>0?.95:.72;c.beginPath();
      if(e.type==='rimeprowler'){c.moveTo(0,-e.r-10);c.lineTo(e.r+9,0);c.lineTo(0,e.r+7);c.lineTo(-e.r-9,0);c.closePath();}
      else if(e.type==='seamcrab'){c.rect(-e.r-8,-e.r-5,(e.r+8)*2,(e.r+5)*2);c.moveTo(-e.r-10,-8);c.lineTo(-e.r-20,-15);c.moveTo(e.r+10,8);c.lineTo(e.r+20,15);}
      else if(e.type==='gravechanter'){for(let i=0;i<6;i++){const a=i*Math.PI/3;c.moveTo(Math.cos(a)*(e.r+3),Math.sin(a)*(e.r+3));c.lineTo(Math.cos(a)*(e.r+13),Math.sin(a)*(e.r+13));}}
      else if(e.type==='sigilbinder'){c.arc(0,0,e.r+8,0,Math.PI*2);for(let i=0;i<4;i++){const a=i*Math.PI/2;c.moveTo(Math.cos(a)*(e.r+4),Math.sin(a)*(e.r+4));c.lineTo(Math.cos(a)*(e.r+14),Math.sin(a)*(e.r+14));}}
      else {c.arc(0,0,e.r+14,0,Math.PI*2);for(let i=0;i<8;i++){const a=i*Math.PI/4+g.time*.3;c.moveTo(Math.cos(a)*(e.r+12),Math.sin(a)*(e.r+12));c.lineTo(Math.cos(a)*(e.r+22),Math.sin(a)*(e.r+22));}}
      c.stroke();c.restore();
    }
  };
  const previousRender=Renderer.prototype.render;
  Renderer.prototype.render=function(){
    previousRender.call(this);
    const g=this.g,e=g.boss,t=e?.telegraph;
    if(g.state!=='run'||e?.type!=='clockweaver'||t?.type!=='root'||!t.v20||dist(e.x,e.y,g.player.x,g.player.y)>1050)return;
    const label=t.kind==='mirror-lanes'?'ВСТАНЬ МЕЖДУ ПОЛОСАМИ':t.kind==='toll'?'ВОЙДИ В ЦЕНТР КОЛЬЦА':t.kind==='bolts'?'УЙДИ С ПЕЧАТИ':'ПРЕРВИ ПРИЗЫВ';
    const c=this.ctx;RoutePaint.plate(c,756,78,254,25);RoutePaint.text(c,label,883,91,'#f0d3f8',10);
  };
})();

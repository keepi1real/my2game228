'use strict';
// Cutout rigs and action-driven effects. All animation uses simulation time;
// rendering never consumes the gameplay RNG or changes a collider/attack timer.
const ActorMotion = (() => {
  const TAU=Math.PI*2, states=new WeakMap();
  const aliases={orc:['enemies','goblin',54],archer:['enemies','goblin',50],uruk:['enemies','troll',76],wraith:['heroes','mithrandir',62],shadow:['heroes','mithrandir',53],grazgot:['enemies','troll',114],morgul:['heroes','mithrandir',108]};
  function state(e){let s=states.get(e);if(!s){s={x:e.x,y:e.y,phase:0,walk:0,facing:1,age:0,action:'idle',left:0,total:1,angle:0,hit:0,step:0};states.set(e,s);}return s;}
  function asset(group,id){if(BestiaryArt.specs[id])return {group,id,height:BestiaryArt.specs[id].height};const a=aliases[id];return a?{group:a[0],id:a[1],height:a[2]}:{group,id,height:spriteDef(group,id)?.height};}
  function event(e,action,time,angle=0){const s=state(e);Object.assign(s,{action,left:time,total:time,angle});}
  function add(g,fx){if(!g.motionFX)g.motionFX=[];if(g.motionFX.length>=96)g.motionFX.shift();g.motionFX.push({...fx,total:fx.life});}
  function update(g,dt){
    g.motionClock=(g.motionClock||0)+dt;
    for(const e of [g.player,...g.enemies].filter(Boolean)){
      const s=state(e),d=Math.hypot(e.x-s.x,e.y-s.y),moving=d>.05&&d<70&&!e.stun&&!e.stunTime;
      s.age+=dt;s.left=Math.max(0,s.left-dt);s.hit=Math.max(0,s.hit-dt);
      s.walk+=(Number(moving)-s.walk)*(1-Math.exp(-18*dt));
      if(moving)s.phase+=d*(e.type==='spider'?.22:e.type==='warg'?.12:.15);
      const direction=e.aim?.x ?? (e.x-s.x);if(Math.abs(direction)>.01)s.facing=direction<0?-1:1;
      if(e.state==='windup'&&Math.abs(e.windupDir?.x||0)>.01)s.facing=e.windupDir.x<0?-1:1;
      if(moving&&Math.floor(s.phase/Math.PI)!==s.step){s.step=Math.floor(s.phase/Math.PI);if(Math.abs(e.x-g.camera.x-512)<580&&Math.abs(e.y-g.camera.y-320)<380)add(g,{kind:'dust',x:e.x,y:e.y,r:e.r*.6,color:'#c9bda0',life:.3});}
      if(e.dash&&moving&&s.age-(s.ghostAt||0)>.027){s.ghostAt=s.age;add(g,{kind:'ghost',x:e.x,y:e.y,id:g.hero.id,group:'heroes',facing:s.facing,life:.2});}
      s.x=e.x;s.y=e.y;
    }
    g.motionFX=(g.motionFX||[]).filter(f=>(f.life-=dt)>0);
    g.motionCorpses=(g.motionCorpses||[]).filter(f=>(f.life-=dt)>0);
    for(const pr of g.projectiles){
      pr.motionAge=(pr.motionAge||0)+dt;pr.trail=pr.trail||[];
      pr.trail.push({x:pr.x,y:pr.y,age:pr.motionAge});
      pr.trail=pr.trail.filter(p=>pr.motionAge-p.age<.18).slice(-12);
    }
  }
  // A connected texture mesh keeps joints watertight. Small cached pose sets
  // avoid per-actor mesh tessellation in the steady-state mobile render loop.
  const poses=new WeakMap();
  function poseImage(img,id,s,wind,release){
    let mode='idle',frame=0;
    if(wind>.04){mode='wind';frame=Math.min(3,Math.floor(wind*4));}
    else if(release>.04){mode='strike';frame=Math.min(3,Math.floor(release*4));}
    else if(s.walk>.2){mode='walk';frame=Math.floor((s.phase%TAU+TAU)%TAU/TAU*12);}
    if(['embermoth','prismmoth'].includes(id)){mode='flight';frame=Math.floor(s.age*16)%12;}
    const key=id+':'+mode+':'+frame;let cache=poses.get(img);if(!cache){cache=new Map();poses.set(img,cache);}if(cache.has(key))return cache.get(key);
    const phase=['walk','flight'].includes(mode)?frame*TAU/12:0,wave=Math.sin(phase),lift=Math.abs(wave),w=mode==='wind'?(frame+1)/4:0,r=mode==='strike'?(frame+1)/4:0;
    const canvas=document.createElement('canvas');canvas.width=288;canvas.height=288;const c=canvas.getContext('2d');
    function vertex(x,y){
      let dx=0,dy=0;
      if(['embermoth','prismmoth'].includes(id)){
        const wing=clamp((Math.abs(x-137)-14)/90,0,1);dx=-(x-137)*wing*(.12+.14*wave);dy=wave*wing*20;
      }else if(id==='spider'){
        const leg=clamp((Math.abs(x-128)-24)/72,0,1),side=x<128?-1:1;
        dx=wave*side*leg*11;dy=wave*side*leg*17-lift*(1-leg)*3;
      }else if(id==='warg'){
        const leg=clamp((y-115)/110,0,1),side=Math.tanh((125-x)/25);
        dx=wave*side*leg*14+r*8*(1-leg);dy=-Math.max(0,wave*side)*leg*24-lift*(1-leg)*6+w*(1-leg)*6;
      }else{
        const hip=id==='baldin'?185:id==='troll'?155:165,leg=clamp((y-hip)/(248-hip),0,1),side=Math.tanh((128-x)/15);
        dx=wave*side*leg*15+(w*.12-r*.12)*Math.max(0,hip-y);
        dy=-Math.max(0,wave*side)*leg*26-lift*(1-leg)*6;
      }
      return [x+16+dx,y+16+dy];
    }
    function triangle(src,dst){
      const [p,q,r]=src,[a,b,d]=dst,sx=q[0]-p[0],sy=q[1]-p[1],tx=r[0]-p[0],ty=r[1]-p[1],det=sx*ty-tx*sy;
      const m0=((b[0]-a[0])*ty-(d[0]-a[0])*sy)/det,m2=(sx*(d[0]-a[0])-tx*(b[0]-a[0]))/det;
      const m1=((b[1]-a[1])*ty-(d[1]-a[1])*sy)/det,m3=(sx*(d[1]-a[1])-tx*(b[1]-a[1]))/det;
      c.save();c.beginPath();const cx=(a[0]+b[0]+d[0])/3,cy=(a[1]+b[1]+d[1])/3;
      dst.forEach(([x,y],i)=>{x=cx+(x-cx)*1.012;y=cy+(y-cy)*1.012;i?c.lineTo(x,y):c.moveTo(x,y);});c.closePath();c.clip();
      c.transform(m0,m1,m2,m3,a[0]-m0*p[0]-m2*p[1],a[1]-m1*p[0]-m3*p[1]);c.drawImage(img,0,0);c.restore();
    }
    for(let y=0;y<256;y+=32)for(let x=0;x<256;x+=32){const a=[x,y],b=[x+32,y],d=[x+32,y+32],e=[x,y+32];triangle([a,b,d],[vertex(...a),vertex(...b),vertex(...d)]);triangle([a,d,e],[vertex(...a),vertex(...d),vertex(...e)]);}
    cache.set(key,canvas);return canvas;
  }
  function rig(c,img,id,s,wind,release){c.drawImage(poseImage(img,id,s,wind,release),-16,-16);}
  function glow(c,x,y,r,color,alpha=.4){c.save();c.globalAlpha*=alpha;const gr=c.createRadialGradient(x,y,0,x,y,r);gr.addColorStop(0,color);gr.addColorStop(1,'transparent');c.fillStyle=gr;c.fillRect(x-r,y-r,r*2,r*2);c.restore();}
  function rune(c,x,y,r,time,color,alpha=1){
    c.save();c.translate(x,y);c.scale(1,.56);c.rotate(time);c.globalAlpha*=alpha;c.strokeStyle=color;c.lineWidth=1.2;
    c.beginPath();c.arc(0,0,r,0,TAU);c.moveTo(r*.75,0);c.arc(0,0,r*.75,0,TAU);c.stroke();
    for(let i=0;i<6;i++){c.save();c.rotate(i*TAU/6);c.beginPath();c.moveTo(r-3,-3);c.lineTo(r+2,0);c.lineTo(r-3,3);c.stroke();c.restore();}c.restore();
  }
  function weapon(c,id,e,s,h,wind,release){
    if(BestiaryArt.specs[id]){
      if(['sporecantor','rootmother'].includes(id))glow(c,e.x,e.y-h*.56,10+wind*19,'#ffc07a',.32+wind*.35);
      return;
    }
    const isMage=id==='mithrandir'||id==='wraith'||id==='morgul',isBow=id==='faelas'||id==='archer';
    const a=e.aim?Math.atan2(e.aim.y,e.aim.x):e.state==='windup'?Math.atan2(e.windupDir.y,e.windupDir.x):s.angle;
    const active=s.left>0,cast=active?Math.min(1,s.left/s.total*1.4):wind;
    if(isMage){
      const x=e.x+s.facing*h*.28,y=e.y-h*.53;
      c.save();c.translate(x,y);c.scale(h/56,h/56);c.rotate(-s.facing*(.13+release*.35-wind*.2));
      c.lineCap='round';c.strokeStyle='#302735';c.lineWidth=5;c.beginPath();c.moveTo(0,20);c.lineTo(0,-29);c.stroke();
      c.strokeStyle='#cfb58a';c.lineWidth=2;c.stroke();c.strokeStyle='#eee0b0';c.beginPath();c.arc(0,-29,5,0,TAU);c.stroke();
      const color=id==='mithrandir'?'#d8acff':'#6ce4ec';glow(c,0,-30,cast?25:11,color,cast?.8:.35);c.fillStyle='#fff1de';c.beginPath();c.arc(0,-30,cast?3.5:2,0,TAU);c.fill();c.restore();
      if(cast){rune(c,x,y-18,19+cast*8,s.age*5,color,cast);for(let i=0;i<3;i++){const b=s.age*10+i*TAU/3;c.fillStyle=color;c.beginPath();c.arc(x+Math.cos(b)*20,y-18+Math.sin(b)*10,2,0,TAU);c.fill();}}
    }else if(isBow){
      c.save();c.translate(e.x,e.y-h*.5);c.rotate(a);c.translate(14-release*4,0);c.strokeStyle='#dac798';c.lineWidth=2.6;c.beginPath();c.moveTo(0,-17);c.quadraticCurveTo(18,0,0,17);c.stroke();c.strokeStyle='#e9e6ce';c.lineWidth=.8;c.beginPath();c.moveTo(0,-17);c.lineTo(-7-wind*7-release*4,0);c.lineTo(0,17);c.stroke();
      if(wind||!active){c.strokeStyle='#b8d7d3';c.lineWidth=1.5;c.beginPath();c.moveTo(-6-wind*7,0);c.lineTo(19,0);c.stroke();}c.restore();
    }else if(!['warg','spider','shadow'].includes(id)&&!e.aim){
      // Enemy weapon follows the wind-up and the actual attack event.
      c.save();c.translate(e.x,e.y-h*.42);c.scale(1,.65);c.rotate(a+(wind?-1.35*wind:active?.8*(1-s.left/s.total):.9));
      drawMeleeWeapon(c,id==='troll'||id==='grazgot'||id==='uruk'?'baldin':'peregrin',h*.6);c.restore();
    }
  }
  function draw(c,group,id,e,options={}){
    const a=asset(group,id),custom=BestiaryArt.specs[id],img=custom?BestiaryArt.sprite(id):artImage('sprite',a.group,a.id),def=custom||spriteDef(a.group,a.id);if(!img||(!custom&&!ready(img))||!def)return false;
    const s=options.state||state(e),h=options.height||a.height,scale=h/256;
    const wind=e.state==='windup'?clamp(1-e.windup/(e.def.windup||.4),0,1):e.telegraph?clamp(1-e.telegraph.time/e.telegraph.total,0,1):0;
    const release=s.left>0?Math.pow(s.left/s.total,2):0;
    const airy=['wraith','shadow','morgul'].includes(id),bob=['embermoth','prismmoth'].includes(id)?Math.sin(s.age*5)*4-8:airy?Math.sin(s.age*3)*3-4:Math.sin(s.age*2)*.4;
    const aim=e.aim||e.windupDir||{x:s.facing,y:0};
    c.save();c.translate(e.x+aim.x*(release*4-wind*3),e.y+bob+aim.y*release*2);
    c.scale(s.facing*scale,scale);c.translate(-128,-256*(def.anchorY||.973));
    if(airy){c.globalAlpha*=.78;c.shadowColor='#59dedb';c.shadowBlur=16;}
    rig(c,img,a.id,s,wind,release);
    if(s.hit>0){c.globalAlpha*=Math.min(.65,s.hit/.12);rig(c,whiteMask(img),a.id,s,wind,release);}
    c.restore();
    if(!options.noWeapon)weapon(c,id,e,s,h,wind,release);
    if(e.shield>0){c.save();c.strokeStyle='#ddc0ff';c.lineWidth=1.2;c.globalAlpha*=.45;c.beginPath();c.ellipse(e.x,e.y-h*.43,h*.42,h*.52,Math.sin(s.age)*.06,0,Math.PI*2);c.stroke();for(let i=0;i<3;i++){const a=s.age*2+i*Math.PI*2/3,x=e.x+Math.cos(a)*h*.42,y=e.y-h*.43+Math.sin(a)*h*.45;glow(c,x,y,9,'#d8b4ff',.8);c.fillStyle='#f3dcff';c.fillRect(x-1.5,y-2,3,4);}c.restore();}
    if(airy)rune(c,e.x,e.y,18,s.age,'#70d1d3',.2);
    return true;
  }
  function effects(c,g){
    for(const f of g.motionFX||[]){
      const t=1-f.life/f.total;c.save();c.globalAlpha*=1-t;
      if(f.kind==='ghost'){draw(c,f.group,f.id,{x:f.x,y:f.y,aim:{x:f.facing,y:0}},{state:{phase:0,walk:0,age:0,facing:f.facing,left:0,total:1,hit:0},noWeapon:true});}
      else if(f.kind==='dust'){c.fillStyle=f.color;for(let i=0;i<3;i++){c.globalAlpha=.16*(1-t);c.beginPath();c.ellipse(f.x+(i-1)*t*14,f.y-t*6,f.r*(.5+t),2+t*2,0,0,TAU);c.fill();}}
      else if(f.kind==='impact'){
        glow(c,f.x,f.y-20,24+28*t,f.color,.6);c.translate(f.x,f.y-20);c.rotate(f.angle||0);c.strokeStyle=f.color;c.lineWidth=2;
        for(let i=0;i<7;i++){c.rotate(TAU/7);c.beginPath();c.moveTo(7+t*12,0);c.lineTo(16+t*25,0);c.stroke();}
      }else if(f.kind==='cast'){rune(c,f.x,f.y,f.r*(.7+t*.4),(g.motionClock||0)*2,f.color,1-t);glow(c,f.x,f.y-20,38,f.color,.25);}
      else if(f.kind==='slash'){
        c.translate(f.x,f.y-f.h*.4);c.scale(1,.65);c.rotate(f.angle);c.strokeStyle=f.color;c.lineWidth=7*(1-t)+1;c.beginPath();c.arc(0,0,f.r,-1.1+t*.8,.9+t*.8);c.stroke();c.strokeStyle='#fff1c6';c.lineWidth=1;c.stroke();
      }else if(f.kind==='spin'){
        c.translate(f.x,f.y-20);c.scale(1,.62);c.rotate(t*TAU*1.5);c.strokeStyle=f.color;c.lineWidth=4;c.beginPath();c.arc(0,0,f.r,-2,1.8);c.stroke();drawMeleeWeapon(c,'baldin',f.r);
      }else if(f.kind==='burst'){
        glow(c,f.x,f.y,f.r*(.7+t),f.color,.65);c.strokeStyle=f.color;c.lineWidth=5*(1-t)+1;c.beginPath();c.ellipse(f.x,f.y,f.r*t,f.r*t*.65,0,0,TAU);c.stroke();
      }c.restore();
    }
  }
  function corpse(c,f){const t=1-f.life/f.total;c.save();c.translate(f.x,f.y);c.globalAlpha*=Math.pow(1-t,.7)*.8;c.rotate(f.facing*Math.min(1,t*3)*1.45);c.scale(1,1-Math.min(.65,t));draw(c,f.group,f.id,{x:0,y:0},{state:{phase:0,walk:0,age:0,facing:f.facing,left:0,total:1,hit:0},noWeapon:true});c.restore();}
  return {state,asset,event,add,update,draw,effects,corpse,glow,rune};
})();

const motionBaseReset=Game.prototype.resetRunState;
Game.prototype.resetRunState=function(){motionBaseReset.call(this);this.motionClock=0;this.motionFX=[];this.motionCorpses=[];};
const motionBaseUpdate=Game.prototype.update;
Game.prototype.update=function(dt){
  const player=this.player,playing=this.state==='run';
  if(playing)for(const e of [player,...this.enemies].filter(Boolean)){const s=ActorMotion.state(e);s.x=e.x;s.y=e.y;}
  motionBaseUpdate.call(this,dt);
  if(playing&&this.player===player&&this.state==='run')ActorMotion.update(this,dt);
};
const motionBaseAttack=Game.prototype.playerAttack;
Game.prototype.playerAttack=function(){ActorMotion.event(this.player,'attack',.25,Math.atan2(this.player.aim.y,this.player.aim.x));return motionBaseAttack.call(this);};
const motionBaseEnemyAttack=Game.prototype.enemyAttack;
Game.prototype.enemyAttack=function(e){
  const a=angleTo(e.x,e.y,this.player.x,this.player.y);ActorMotion.event(e,e.def.ranged?'cast':'attack',.32,a);
  ActorMotion.add(this,{kind:e.def.ranged?'cast':'slash',x:e.x,y:e.y,h:ActorMotion.asset('enemies',e.type).height||48,r:e.def.ranged?25:e.def.attackRange+6,angle:a,color:e.def.ranged?(e.def.projColor||'#ffb769'):'#f0976b',life:.25});
  return motionBaseEnemyAttack.call(this,e);
};
const motionBaseSkill=Game.prototype.useSkill;
Game.prototype.useSkill=function(i){
  if(!this.player||!Number.isInteger(i)||i<0||i>2||this.player.skillCds[i]>0)return;
  const p=this.player,id=this.hero.skills[i];ActorMotion.event(p,id,.5,Math.atan2(p.aim.y,p.aim.x));
  ActorMotion.add(this,{kind:id==='whirlwind'?'spin':'cast',x:p.x,y:p.y,r:id==='whirlwind'?80:36,color:['herbs','breakfast'].includes(id)?'#a6ecb5':id==='fireball'?'#ff9764':this.hero.color,life:id==='whirlwind'?.5:.6});
  return motionBaseSkill.call(this,i);
};
const motionBaseHit=Game.prototype.hitEnemy;
Game.prototype.hitEnemy=function(e,...args){if(!e.alive)return;ActorMotion.state(e).hit=.15;ActorMotion.add(this,{kind:'impact',x:e.x,y:e.y,angle:angleTo(this.player.x,this.player.y,e.x,e.y),color:'#ffe0aa',life:.17});return motionBaseHit.call(this,e,...args);};
const motionBaseDamage=Game.prototype.damagePlayer;
Game.prototype.damagePlayer=function(...args){const p=this.player,before=p.hp;const result=motionBaseDamage.apply(this,args);if(p.hp<before){ActorMotion.state(p).hit=.18;ActorMotion.add(this,{kind:'impact',x:p.x,y:p.y,color:'#ff9a78',life:.18});}return result;};
const motionBaseKill=Game.prototype.killEnemy;
Game.prototype.killEnemy=function(e){
  if(e.alive){this.motionCorpses??=[];if(this.motionCorpses.length>=24)this.motionCorpses.shift();this.motionCorpses.push({x:e.x,y:e.y,group:e.isBoss?'bosses':'enemies',id:e.type,facing:ActorMotion.state(e).facing,life:.65,total:.65});}
  return motionBaseKill.call(this,e);
};
const motionBaseSpawn=Game.prototype.spawnProjectile;
Game.prototype.spawnProjectile=function(o){const result=motionBaseSpawn.call(this,o),pr=this.projectiles[this.projectiles.length-1];pr.trail=[{x:pr.x,y:pr.y,age:0}];pr.motionAge=0;pr.visualKind=pr.spin?'axe':pr.owner==='player'?(this.hero.id==='faelas'?'arrow':this.hero.id==='peregrin'?'stone':'orb'):pr.src?.type==='archer'?'arrow':'orb';return result;};
const motionBaseProjectileEnd=Game.prototype.projectileEnd;
Game.prototype.projectileEnd=function(pr){if(!pr.dead&&pr.explode)ActorMotion.add(this,{kind:'burst',x:pr.x,y:pr.y,r:pr.explode,color:pr.color,life:.45});return motionBaseProjectileEnd.call(this,pr);};
const motionBaseResolve=Game.prototype.resolveTelegraph;
Game.prototype.resolveTelegraph=function(e){const t=e.telegraph;if(t){ActorMotion.event(e,t.type,.4,angleTo(e.x,e.y,this.player.x,this.player.y));if(t.type==='circle')ActorMotion.add(this,{kind:'burst',x:t.x,y:t.y,r:t.r,color:'#ff9563',life:.5});}return motionBaseResolve.call(this,e);};

const motionBaseArt=Renderer.prototype.drawArt;
Renderer.prototype.drawArt=function(group,id,e,r,color){return ActorMotion.draw(this.ctx,group,id,e)||motionBaseArt.call(this,group,id,e,r,color);};
const motionBaseTop=Renderer.prototype.bodyTop,motionBaseWidth=Renderer.prototype.spriteWidth;
Renderer.prototype.bodyTop=function(group,id,e,r){const a=ActorMotion.asset(group,id);return a.height?e.y-a.height:motionBaseTop.call(this,group,id,e,r);};
Renderer.prototype.spriteWidth=function(group,id){return ActorMotion.asset(group,id).height||motionBaseWidth.call(this,group,id);};
// Corpses are only visual snapshots: the combat loop still removes dead enemies
// immediately. In the seamless renderer they are depth-sorted with props.
const motionBaseEffects=Renderer.prototype.drawEffects;
Renderer.prototype.drawEffects=function(){motionBaseEffects.call(this);ActorMotion.effects(this.ctx,this.g);};
const motionBaseEnemies=Renderer.prototype.drawEnemies;
Renderer.prototype.drawEnemies=function(){if(!this.g.journey?.seamless)for(const f of this.g.motionCorpses||[])if(this.visibleAt(f.x,f.y))ActorMotion.corpse(this.ctx,f);return motionBaseEnemies.call(this);};
Renderer.prototype.drawProjectiles=function(){
  const c=this.ctx;
  for(const pr of this.g.projectiles){
    if(!this.visibleAt(pr.x,pr.y))continue;const tail=pr.trail||[],orb=pr.visualKind==='orb'||(!pr.visualKind&&!pr.spin&&pr.size>5);
    c.save();c.fillStyle='rgba(0,0,0,.2)';c.beginPath();c.ellipse(pr.x,pr.y,pr.size+2,2,0,0,Math.PI*2);c.fill();c.translate(0,-22);c.lineCap='round';
    // Sampled positions follow the real projectile, including diagonal flight.
    for(let i=1;i<tail.length;i++){const k=i/tail.length;c.globalAlpha=k*.5;c.strokeStyle=pr.color;c.lineWidth=(orb?pr.size*1.3:3)*k;c.beginPath();c.moveTo(tail[i-1].x,tail[i-1].y);c.lineTo(tail[i].x,tail[i].y);c.stroke();}c.globalAlpha=1;
    if(orb)ActorMotion.glow(c,pr.x,pr.y,pr.size*3.8,pr.color,.65);
    c.translate(pr.x,pr.y);c.rotate(pr.angle);
    if(pr.spin){c.strokeStyle='rgba(244,196,114,.5)';c.lineWidth=2;c.beginPath();c.arc(0,0,14,0,Math.PI*1.5);c.stroke();c.translate(-8,0);drawMeleeWeapon(c,'baldin',22);}
    else if(pr.visualKind==='stone'){c.fillStyle='#d7c2a3';c.beginPath();c.ellipse(0,0,5,3,.5,0,Math.PI*2);c.fill();}
    else if(!orb){c.strokeStyle='#e9d6ae';c.lineWidth=2;c.beginPath();c.moveTo(-13,0);c.lineTo(8,0);c.stroke();c.fillStyle=pr.owner==='enemy'?'#ff966c':'#e5f8ff';c.beginPath();c.moveTo(12,0);c.lineTo(5,-3);c.lineTo(6,3);c.fill();c.strokeStyle=pr.color;c.beginPath();c.moveTo(-10,0);c.lineTo(-15,-4);c.moveTo(-10,0);c.lineTo(-15,4);c.stroke();}
    else{c.fillStyle=pr.color;c.beginPath();c.ellipse(0,0,pr.size*1.3,pr.size,0,0,Math.PI*2);c.fill();c.fillStyle='#fff7e4';c.beginPath();c.arc(2,-1,pr.size*.5,0,Math.PI*2);c.fill();for(let i=0;i<3;i++){const a=(pr.motionAge||0)*13+i*Math.PI*2/3;c.fillStyle=pr.color;c.beginPath();c.arc(Math.cos(a)*pr.size*1.6,Math.sin(a)*pr.size*1.3,1.8,0,Math.PI*2);c.fill();}}
    c.restore();
  }
};
// A compact skill dock makes spell names and cooldowns discoverable on desktop.
const motionBaseRender=Renderer.prototype.render;
Renderer.prototype.render=function(){
  motionBaseRender.call(this);const g=this.g;if(!g.journey?.seamless||!g.player||g.input.touchMode||g.state==='route-map')return;
  const c=this.ctx,p=g.player;for(let i=0;i<3;i++){const x=260+i*160,y=548,sk=SKILLS[g.hero.skills[i]],cd=p.skillCds[i];RoutePaint.plate(c,x,y,148,47);RoutePaint.text(c,String(i+1),x+14,y+15,cd?'#8b929a':'#ffdfa0',14);RoutePaint.text(c,sk.name,x+79,y+17,cd?'#a3a7ac':'#ebe0bf',11);RoutePaint.text(c,cd?cd.toFixed(1)+' с':'ГОТОВО',x+79,y+35,cd?'#a8abc1':'#95d8c5',9);}
};


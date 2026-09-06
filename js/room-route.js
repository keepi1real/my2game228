'use strict';
// Playable 16-room expedition. It has its own checkpoint and never writes the
// original campaign's meta save. Room visits retain enemies, opened chests and loot.
const routeBaseReset=Game.prototype.resetRunState;
Game.prototype.resetRunState=function(){routeBaseReset.call(this);this.journey=null;};
const routeBaseStartPreview=Game.prototype.startVisualRoom;
Game.prototype.startVisualRoom=function(...args){if(this.journey)this.saveJourney();return routeBaseStartPreview.apply(this,args);};
const routeBaseMenu=Game.prototype.toMenu,routeBaseStart=Game.prototype.startRun;
Game.prototype.toMenu=function(){if(this.journey)this.saveJourney();return routeBaseMenu.call(this);};
Game.prototype.startRun=function(...args){if(this.journey)this.saveJourney();return routeBaseStart.apply(this,args);};
Game.prototype.startJourney=function(seed=R.int(1,0x7fffffff)){
  endVisualRoomPreview();VisualRoomPreview.save={data:Save.data,dirty:Save.dirty,timer:Save.timer};
  Save.data=JSON.parse(JSON.stringify(Save.data));Save.dirty=false;Save.timer=0;
  this.resetRunState();this.journey=RoomRoute.create(seed);this.hero=HERO_BY_ID.arator;
  this.player=new Player(this.hero,Save.hero('arator').level,Save.bonuses());
  this.player.consumables.potion=3;this.player.consumables.lembas=1;
  this.player.equipment.weapon=makeItem('rustySword','common');
  this.player.hp=this.player.maxHp;this.floor=1;this.state='run';this.enterJourneyRoom(this.journey.start);
};
Game.prototype.captureJourneyRoom=function(){
  const j=this.journey;if(!j||!this.map)return;
  const room=j.rooms[j.current];
  room.world={enemies:this.enemies.filter(e=>e.alive),chests:this.chests,pickups:this.pickups};
};
Game.prototype.saveJourney=function(){
  const j=this.journey;if(!j)return;
  try {
    if(j.completed||this.player.hp<=0){localStorage.setItem(RoomRoute.key,'null');return;}
    this.captureJourneyRoom();
    const p=this.player,player={};
    for(const k of ['x','y','hp','level','gold','equipment','bag','consumables','buffs','shield','shieldTime','poison','poisonTime','skillCds','dodgeCd'])player[k]=p[k];
    const rooms=j.rooms.map(r=>({visited:r.visited,discovered:r.discovered,cleared:r.cleared,initialized:r.initialized,restUsed:r.restUsed,
      world:r.world&&{chests:r.world.chests,pickups:r.world.pickups,enemies:r.world.enemies.filter(e=>e.alive).map(e=>({type:e.type,isBoss:e.isBoss,x:e.x,y:e.y,hp:e.hp,maxHp:e.maxHp}))}}));
    localStorage.setItem(RoomRoute.key,JSON.stringify({version:1,seed:j.seed,current:j.current,rooms,player,meta:Save.data,stats:this.runStats}));j.saveTimer=0;
  } catch(error){j.notice='Браузер не разрешил сохранение. Забег продолжается.';j.noticeTime=5;}
};
Game.prototype.resumeJourney=function(){
  let data;
  try{
    data=JSON.parse(localStorage.getItem(RoomRoute.key));
    if(!data||data.version!==1||!Number.isInteger(data.seed)||!Number.isInteger(data.current)||data.current<0||data.current>15||data.rooms.length!==16||!Number.isFinite(data.player.hp)||data.player.hp<=0||!data.meta.heroes.arator)throw Error('Invalid checkpoint');
    // Validate entities before replacing either the live run or its save snapshot.
    for(const r of data.rooms)if(r.world){
      if(!Array.isArray(r.world.chests)||!Array.isArray(r.world.pickups)||!Array.isArray(r.world.enemies))throw Error('Invalid room');
      for(const e of r.world.enemies)if(!(e.isBoss?BOSSES[e.type]:MONSTERS[e.type])||![e.x,e.y,e.hp,e.maxHp].every(Number.isFinite))throw Error('Invalid enemy');
    }
    if(!data.rooms[data.current].initialized||!data.rooms[data.current].world)throw Error('Invalid current room');
  }catch(error){this.ui.showMenu();return false;}
  endVisualRoomPreview();VisualRoomPreview.save={data:Save.data,dirty:Save.dirty,timer:Save.timer};Save.data=data.meta;Save.dirty=false;Save.timer=0;
  this.resetRunState();this.journey=RoomRoute.create(data.seed);this.hero=HERO_BY_ID.arator;
  this.player=Object.assign(new Player(this.hero,data.player.level,Save.bonuses()),data.player);this.runStats=data.stats;
  this.journey.rooms.forEach((r,i)=>{Object.assign(r,data.rooms[i]);if(r.world){
    r.world.enemies=r.world.enemies.map(e=>{const v=this.makeJourneyEnemy(e.type,e.x,e.y,e.isBoss);v.maxHp=e.maxHp;v.hp=e.hp;return v;});
    r.world.chests=r.world.chests.map(c=>Object.assign(new Chest(c.x,c.y),c));
    r.world.pickups=r.world.pickups.map(p=>Object.assign(new Pickup(p.x,p.y,p.kind,{}),p));
  }});
  const items=[...this.player.bag,...Object.values(this.player.equipment),...this.journey.rooms.flatMap(r=>(r.world?r.world.pickups:[]).filter(p=>p.kind==='item').map(p=>p.item))].filter(Boolean);
  ITEM_UID=Math.max(ITEM_UID,...items.map(it=>(Number(it.uid)||0)+1));
  this.floor=1;this.state='run';this.enterJourneyRoom(data.current,null,{x:data.player.x,y:data.player.y});return true;
};
Game.prototype.makeJourneyEnemy=function(type,x,y,boss=false){
  const level=this.journey?.seamless?ExpeditionLevels.get(this.journey.levelId):null;
  const def=boss?(level?.nativeBosses?{...BOSSES[type]}:level?.bossDef?{...level.bossDef}:{...BOSSES.grazgot,name:'Хранитель Пепельной Короны',hp:520,dmg:18}):undefined;
  const e=new Enemy(type,x,y,1,def);e.def={...e.def,sight:1200};e.state='chase';e.memory=999;e.attackTimer=1.1;return e;
};
Game.prototype.enterJourneyRoom=function(id,from=null,resumePosition=null){
  const j=this.journey;if(!j)return;this.captureJourneyRoom();j.current=id;
  const room=j.rooms[id];this.map=RoomRoute.makeMap(room);this.camera={x:0,y:32};
  this.projectiles=[];this.particles=[];this.effects=[];this.texts=[];this.messages=[];this.flow=null;this.flowTimer=0;this.merchant=null;this.boss=null;
  const back=this.map.doors.find(d=>d.to===from),t=this.map.template;
  let spawn=back?{x:back.x,y:back.y+(back.socket==='back'?-76:82)}:RoomRoute.point(t,[768,720]);
  if(resumePosition&&!this.map.circleBlocked(resumePosition.x,resumePosition.y,this.player.r))spawn=resumePosition;
  if(this.map.circleBlocked(spawn.x,spawn.y,this.player.r))spawn=RoomRoute.point(t,[768,610]);
  Object.assign(this.player,spawn,{dash:null,invulnTime:1,lastTx:-1,lastTy:-1});
  if(!room.initialized){
    room.initialized=true;room.world={enemies:[],chests:[],pickups:[]};
    if(['combat','elite','boss'].includes(room.role)){
      const rng=new RNG(j.seed+id*8191),types=room.role==='boss'?['grazgot','goblin','goblin']:room.role==='elite'?['troll','goblin','warg']:room.id===8?['warg','goblin','spider','goblin']:rng.pick([['goblin','goblin','warg'],['spider','goblin','goblin'],['warg','goblin']]);
      const candidates=[];
      for(let y=260;y<=440;y+=32)for(let x=260;x<=760;x+=32)if(!this.map.circleBlocked(x,y,32)&&dist(x,y,spawn.x,spawn.y)>145&&this.map.doors.every(d=>dist(x,y,d.x,d.y)>110))candidates.push({x,y});
      rng.shuffle(candidates);
      for(const type of types){const q=candidates.find(q=>room.world.enemies.every(e=>dist(q.x,q.y,e.x,e.y)>65));if(!q)throw Error('Room has no safe enemy socket: '+id);
        room.world.enemies.push(this.makeJourneyEnemy(type,q.x,q.y,type==='grazgot'));}
    }else room.cleared=true;
    if(room.role==='treasure'||room.role==='elite'){
      const q=RoomRoute.point(t,[888,575]);const chest=new Chest(q.x,q.y);chest.reward=room.role==='elite'?'rare':'normal';room.world.chests.push(chest);
    }
  }
  this.enemies=room.world.enemies;this.chests=room.world.chests;this.pickups=room.world.pickups;
  this.boss=this.enemies.find(e=>e.isBoss&&e.alive)||null;this.stairs=null;this.stairsOpen=false;
  room.visited=true;room.discovered=true;room.links.forEach(to=>j.rooms[to].discovered=true);
  j.near=null;j.transition=.85;j.notice=room.role==='start'?'Выберите проход. Карта — M, действие — E.':room.cleared?'Можно исследовать комнату и выбрать путь':'Победите стражей — печати на проходах исчезнут';j.noticeTime=4;
  this.input.keys={};this.input.pressed={};this.input.mouse.down=false;
  Object.assign(this.input.touch,{move:{x:0,y:0},stick:null,aimDrag:null,attack:false,pressed:{},buttons:{}});
  this.ui.hide();this.saveJourney();
};
Game.prototype.journeyTargets=function(){
  const j=this.journey,r=j.rooms[j.current],t=this.map.template;
  const targets=this.map.doors.map(d=>({...d,kind:'door',label:r.cleared?'В '+j.rooms[d.to].name:'Проход запечатан · остались враги'}));
  for(const c of this.chests)if(!c.opened)targets.push({...c,kind:'chest',chest:c,label:r.cleared?'Открыть сундук':'Сначала победите стражей'});
  if(r.role==='rest'&&!r.restUsed)targets.push({...RoomRoute.point(t,[768,525]),kind:'rest',label:'Отдохнуть · +40% здоровья и зелье'});
  if(r.role==='boss'&&r.cleared)targets.push({x:512,y:213,kind:'stairs',label:'Спуститься · завершить этаж'});
  return targets;
};
Game.prototype.journeyInteract=function(target){
  const j=this.journey;if(!j||this.state!=='run'||j.transition>0)return false;
  const r=j.rooms[j.current];if(!r.cleared||!target||dist(this.player.x,this.player.y,target.x,target.y)>65)return false;
  if(target.kind==='door'){
    const door=this.map.doors.find(d=>d.to===target.to&&d.socket===target.socket);if(!door)return false;
    this.enterJourneyRoom(door.to,r.id);return true;
  }
  if(target.kind==='chest'){
    if(!this.chests.includes(target.chest)||target.chest.opened)return false;
    j.interacting=true;this.openChest(target.chest);j.interacting=false;this.saveJourney();return true;
  }
  if(target.kind==='rest'&&r.role==='rest'&&!r.restUsed){
    r.restUsed=true;this.healPlayer(this.player.maxHp*.4);this.player.consumables.potion++;this.player.poisonTime=0;
    j.notice='Родник иссяк. Вы восстановили силы и получили зелье.';j.noticeTime=5;this.burst(target.x,target.y,'#8de4cf',26,100);this.saveJourney();return true;
  }
  if(target.kind==='stairs'&&r.role==='boss'&&!this.enemies.some(e=>e.alive)){this.endRun(true);return true;}return false;
};
const routeBaseOpenChest=Game.prototype.openChest;
Game.prototype.openChest=function(c){
  if(this.journey&&(!this.journey.interacting||c.opened))return;
  const before=this.pickups.length;
  routeBaseOpenChest.call(this,c);
  if(this.journey){
    if(c.reward==='rare')for(const p of this.pickups.slice(before))if(p.kind==='item'&&p.item.rarity==='common')p.item=makeItem(p.item.base,'rare');
    this.player.consumables.potion++;this.journey.notice='Сундук открыт · снаряжение, золото и зелье';this.journey.noticeTime=4;
  }
};
const routeBaseUpdateEnemy=Game.prototype.updateEnemy;
Game.prototype.updateEnemy=function(e,dt){if(this.journey&&this.state!=='run')return;return routeBaseUpdateEnemy.call(this,e,dt);};
const routeBaseEnd=Game.prototype.endRun;
Game.prototype.endRun=function(win){
  if(!this.journey)return routeBaseEnd.call(this,win);
  this.journey.completed=true;this.state=win?'win':'dead';this.saveJourney();this.ui.showJourneyResult(win);
};
const routeBaseUpdate=Game.prototype.update;
Game.prototype.update=function(dt){
  const j=this.journey;if(!j)return routeBaseUpdate.call(this,dt);this.time+=dt;
  const inp=this.input;
  if(this.state==='route-map'){
    if(inp.hit('KeyM')||inp.hit('Escape')){this.state='run';j.mapOpen=false;this.ui.hide();}inp.endFrame();return;
  }
  if(this.state!=='run'){
    if(['paused','inventory'].includes(this.state)&&(inp.hit('Escape')||inp.hit('KeyI')||inp.hit('Tab'))){this.state='run';this.ui.hide();}
    inp.endFrame();return;
  }
  if(inp.hit('KeyM')){this.ui.showJourneyMap();inp.endFrame();return;}
  if(inp.hit('Escape')||inp.tHit('pause')){this.state='paused';this.saveJourney();this.ui.showPause();inp.endFrame();return;}
  if(inp.hit('KeyI')||inp.hit('Tab')||inp.tHit('bag')){this.state='inventory';this.ui.showInventory();inp.endFrame();return;}
  const use=inp.hit('KeyE')||inp.tHit('use');this.runStats.time+=dt;j.transition=Math.max(0,j.transition-dt);j.noticeTime=Math.max(0,j.noticeTime-dt);j.saveTimer+=dt;
  // A death in poison, enemy AI or a projectile must stop all later phases.
  for(const phase of ['updatePlayer','updateEnemies','updateProjectiles','updatePickups','updateWorld']){this[phase](dt);if(this.state!=='run'){inp.endFrame();return;}}
  this.camera.x=0;this.camera.y=32;
  const room=j.rooms[j.current];
  if(!room.cleared&&!this.enemies.some(e=>e.alive)){
    room.cleared=true;this.projectiles=this.projectiles.filter(p=>p.owner!=='enemy');
    j.notice=room.role==='boss'?'Хранитель повержен. Лестница открыта.':'Комната зачищена. Выберите открытый проход.';j.noticeTime=5;this.saveJourney();
  }
  // Base boss logic opens stairs on the boss kill; the expedition also requires
  // all remaining guards and summoned minions to be defeated.
  this.stairsOpen=room.role==='boss'&&room.cleared;
  const near=this.journeyTargets().sort((a,b)=>dist(this.player.x,this.player.y,a.x,a.y)-dist(this.player.x,this.player.y,b.x,b.y))[0];
  j.near=near&&dist(this.player.x,this.player.y,near.x,near.y)<65?near:null;inp.touch.showUse=!!j.near&&room.cleared;
  if((use&&j.near)||(j.near&&j.near.kind==='door'&&dist(this.player.x,this.player.y,j.near.x,j.near.y)<22))this.journeyInteract(j.near);
  if(this.state!=='run'){inp.endFrame();return;}
  if(j.saveTimer>5)this.saveJourney();this.updateEffects(dt);inp.endFrame();
};
// Save on tab close as well as room transitions. A denied localStorage write is
// shown in the HUD and never prevents playing the standalone file.
window.addEventListener('pagehide',()=>{if(window.game&&window.game.journey)window.game.saveJourney();});


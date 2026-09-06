'use strict';
Game.prototype.startSeamlessJourney=function(seed=R.int(1,0x7fffffff),heroId='arator',levelId='undermountain'){
  if(!ExpeditionLevels.get(levelId))return false;
  endVisualRoomPreview();VisualRoomPreview.save={data:Save.data,dirty:Save.dirty,timer:Save.timer};
  Save.data=JSON.parse(JSON.stringify(Save.data));Save.dirty=false;Save.timer=0;this.resetRunState();
  this.journey=SeamlessFloor.create(seed,levelId);this.map=SeamlessFloor.mapFor(this.journey);
  this.hero=HERO_BY_ID[heroId]||HERO_BY_ID.arator;this.player=new Player(this.hero,Save.hero(this.hero.id).level,Save.bonuses());
  this.player.equipment.weapon=makeItem('rustySword','common');this.player.consumables.potion=3;this.player.consumables.lembas=1;this.player.hp=this.player.maxHp;AdventureProgress.init(this);
  Object.assign(this.player,SeamlessFloor.spawn(this.journey));this.player.invulnTime=1;
  this.floor=ExpeditionLevels.get(levelId).floor;this.runStats.floor=this.floor;this.state='run';this.stairsOpen=false;this.populateSeamlessFloor();
  this.camera={x:clamp(this.player.x-512,0,SeamlessFloor.width-1024),y:clamp(this.player.y-320,0,SeamlessFloor.height-640)};
  this.input.keys={};this.input.pressed={};this.input.mouse.down=false;Object.assign(this.input.touch,{move:{x:0,y:0},stick:null,aimDrag:null,attack:false,pressed:{},buttons:{}});
  this.updateSeamlessZones();this.map.updateVisibility(Math.floor(this.player.x/TILE),Math.floor(this.player.y/TILE));this.ui.hide();this.saveJourney();
};
Game.prototype.populateSeamlessFloor=function(){
  const j=this.journey,level=ExpeditionLevels.get(j.levelId);
  for(const r of j.rooms){
    const rng=new RNG(j.seed+r.id*8191);
    if(!r.cleared){
      const types=level.roomEncounters?.[r.id]||(level.encounters?(r.role==='boss'?level.boss:r.role==='elite'?level.elite:rng.pick(level.encounters)):r.role==='boss'?['grazgot','goblin','goblin']:r.role==='elite'?['troll','goblin','warg']:r.id===8?['warg','goblin','spider','goblin']:r.id===4?['archer','goblin','warg']:r.id===12?['wraith','goblin']:rng.pick([['goblin','goblin','warg'],['spider','goblin','goblin'],['warg','goblin']]));
      const sockets=[];
      for(let y=r.center.y-84;y<=r.center.y+84;y+=42)for(let x=r.center.x-168;x<=r.center.x+168;x+=42)if(!this.map.circleBlocked(x,y,32)&&r.polygons.some(p=>RoomVisualArt.inside(x,y,p)))sockets.push({x,y});rng.shuffle(sockets);
      for(const type of types){const q=sockets.find(p=>this.enemies.every(e=>dist(p.x,p.y,e.x,e.y)>72));if(!q)throw Error('No enemy socket in room '+r.id);
        const e=this.makeJourneyEnemy(type,q.x,q.y,!!BOSSES[type]);e.homeRoom=r.id;e.state='idle';e.def={...e.def,sight:600};this.enemies.push(e);}
    }
    if(['treasure','elite'].includes(r.role)){
      const q=r.chestPoint;const c=new Chest(q.x,q.y);c.homeRoom=r.id;c.reward=r.role==='elite'?'rare':'normal';this.chests.push(c);
    }
  }
};
Game.prototype.descendSeamlessFloor=function(){
  const current=this.journey,level=ExpeditionLevels.get(current?.levelId);
  if(!current?.seamless||!current.rooms[15].cleared||!level?.next)return false;
  const journey=SeamlessFloor.create((current.seed^0x51a7c3)>>>0,level.next),map=SeamlessFloor.mapFor(journey);
  // Only world state resets. Gear, HP, hero progression and run totals carry on.
  const player=this.player,hero=this.hero,stats=this.runStats;
  this.resetRunState();this.player=player;this.hero=hero;this.runStats=stats;
  this.journey=journey;this.map=map;this.floor=ExpeditionLevels.get(level.next).floor;stats.floor=Math.max(stats.floor,this.floor);
  Object.assign(player,SeamlessFloor.spawn(journey));player.dash=null;player.vx=0;player.vy=0;player.invulnTime=1.5;
  this.state='run';this.stairsOpen=false;this.populateSeamlessFloor();
  this.camera={x:clamp(player.x-512,0,SeamlessFloor.width-1024),y:clamp(player.y-320,0,SeamlessFloor.height-640)};
  this.input.keys={};this.input.pressed={};this.input.mouse.down=false;
  Object.assign(this.input.touch,{move:{x:0,y:0},stick:null,aimDrag:null,attack:false,pressed:{},buttons:{},showUse:false});
  this.updateSeamlessZones();map.updateVisibility(Math.floor(player.x/TILE),Math.floor(player.y/TILE));this.ui.hide();this.saveJourney();return true;
};
Game.prototype.updateSeamlessZones=function(){
  const j=this.journey,here=this.map.roomAt(this.player.x,this.player.y);
  const old=j.current;j.current=here?here.id:null;
  if(here){
    const first=!here.visited;here.visited=true;here.discovered=true;here.active=true;here.links.forEach(id=>j.rooms[id].discovered=true);
    if(first){j.notice=here.cleared?here.name:here.name+' · стража заметила вас';j.noticeTime=3;}
  }
  let cleared=false;
  for(const r of j.rooms)if(r.active&&!r.cleared&&!this.enemies.some(e=>e.alive&&e.homeRoom===r.id)){
    r.cleared=true;cleared=true;j.notice=r.role==='boss'?'Зал босса зачищен. Найдите лестницу в зале.':r.name+' зачищен. Награда доступна.';j.noticeTime=4;
  }
  this.boss=this.enemies.filter(e=>e.isBoss&&e.alive&&j.rooms[e.homeRoom].active).sort((a,b)=>dist(a.x,a.y,this.player.x,this.player.y)-dist(b.x,b.y,this.player.x,this.player.y))[0]||null;
  this.stairsOpen=j.rooms[15].cleared;
  if(old!==j.current||cleared)this.saveJourney();
};
const seamlessOldTargets=Game.prototype.journeyTargets;
Game.prototype.journeyTargets=function(){
  const j=this.journey;if(!j?.seamless)return seamlessOldTargets.call(this);
  const targets=[];
  for(const c of this.chests)if(!c.opened&&dist(this.player.x,this.player.y,c.x,c.y)<100)targets.push({...c,kind:'chest',chest:c,enabled:j.rooms[c.homeRoom].cleared,label:j.rooms[c.homeRoom].cleared?'Открыть сундук':'Сначала победите охрану сундука'});
  for(const r of j.rooms)if(r.role==='rest'&&!r.restUsed)targets.push({...r.restPoint,kind:'rest',homeRoom:r.id,enabled:true,label:'Отдохнуть · +40% здоровья и зелье'});
  const boss=j.rooms[15],next=ExpeditionLevels.get(j.levelId).next;if(boss.cleared)targets.push({x:boss.origin.x+512,y:boss.origin.y+213,kind:'stairs',enabled:true,label:next?'Спуститься · '+ExpeditionLevels.get(next).name:'Завершить поход · лестница'});
  return targets;
};
const seamlessOldInteract=Game.prototype.journeyInteract;
Game.prototype.journeyInteract=function(target){
  const j=this.journey;if(!j?.seamless)return seamlessOldInteract.call(this,target);
  if(this.state!=='run'||!target||dist(this.player.x,this.player.y,target.x,target.y)>65)return false;
  if(target.kind==='chest'){
    const c=target.chest;if(!this.chests.includes(c)||c.opened||!j.rooms[c.homeRoom].cleared)return false;
    j.interacting=true;this.openChest(c);j.interacting=false;this.saveJourney();return true;
  }
  if(target.kind==='rest'){
    const r=j.rooms[target.homeRoom];if(!r||r.role!=='rest'||r.restUsed||dist(this.player.x,this.player.y,r.restPoint.x,r.restPoint.y)>65)return false;
    r.restUsed=true;this.healPlayer(this.player.maxHp*.4);this.player.poisonTime=0;this.player.consumables.potion++;j.notice='Вы восстановили силы. Родник иссяк.';j.noticeTime=4;this.saveJourney();return true;
  }
  if(target.kind==='stairs'&&j.rooms[15].cleared&&dist(this.player.x,this.player.y,j.rooms[15].origin.x+512,j.rooms[15].origin.y+213)<65){if(!this.descendSeamlessFloor())this.endRun(true);return true;}return false;
};
const seamlessLegacyEnter=Game.prototype.enterJourneyRoom;
Game.prototype.enterJourneyRoom=function(...args){if(this.journey?.seamless)return false;return seamlessLegacyEnter.apply(this,args);};
const seamlessOldSave=Game.prototype.saveJourney;
Game.prototype.saveJourney=function(){
  const j=this.journey;if(!j?.seamless)return seamlessOldSave.call(this);
  try{
    if(j.completed||this.player.hp<=0){localStorage.setItem(SeamlessFloor.key,'null');return;}
    const player={};for(const k of ['x','y','hp','level','gold','equipment','bag','consumables','buffs','shield','shieldTime','poison','poisonTime','skillCds','dodgeCd','expeditionBoons','relics','talents','combatV11','attackTimer','sneak'])player[k]=this.player[k];
    const enemies=this.enemies.filter(e=>e.alive).map(e=>({type:e.type,isBoss:e.isBoss,homeRoom:e.homeRoom,x:e.x,y:e.y,hp:e.hp,maxHp:e.maxHp,state:e.state,memory:e.memory,poisonDps:e.poisonDps,poisonTime:e.poisonTime,rootState:e.def.rootvault?RootCombat.snapshot(e):undefined,eliteState:EliteTrials.snapshot(e)}));
    const rooms=j.rooms.map(r=>({visited:r.visited,discovered:r.discovered,active:r.active,cleared:r.cleared,restUsed:r.restUsed,featureChoice:r.featureChoice,reward:r.reward,talentCounted:r.talentCounted}));
    const explored=[];this.map.explored.forEach((v,i)=>{if(v)explored.push(i);});
    localStorage.setItem(SeamlessFloor.key,JSON.stringify({version:4,levelId:j.levelId,seed:j.seed,heroId:this.hero.id,player,enemies,chests:this.chests,pickups:this.pickups,rooms,explored,meta:Save.data,stats:this.runStats,rootHazards:this.rootHazards||[]}));j.saveTimer=0;
  }catch(error){j.notice='Не удалось сохранить забег. Игра продолжается.';j.noticeTime=5;}
};
Game.prototype.resumeSeamlessJourney=function(){
  let data,j,map;
  try{
    data=JSON.parse(localStorage.getItem(SeamlessFloor.key));
    if(!data||![3,4].includes(data.version)||!Number.isInteger(data.seed)||data.rooms.length!==16||!data.meta.heroes.arator||!Number.isFinite(data.player.hp)||data.player.hp<=0)throw Error('Invalid checkpoint');
    data.levelId=data.version===3?'undermountain':data.levelId;if(!ExpeditionLevels.get(data.levelId))throw Error('Invalid level');
    if(data.heroId!==undefined&&(!HERO_BY_ID[data.heroId]||!data.meta.heroes[data.heroId]))throw Error('Invalid hero');
    if(!Array.isArray(data.enemies)||!Array.isArray(data.chests)||!Array.isArray(data.pickups)||!Array.isArray(data.explored))throw Error('Invalid entities');
    for(const e of data.enemies)if(!(e.isBoss?BOSSES[e.type]:MONSTERS[e.type])||!Number.isInteger(e.homeRoom)||e.homeRoom<0||e.homeRoom>15||![e.x,e.y,e.hp,e.maxHp].every(Number.isFinite))throw Error('Invalid enemy');
    RootCombat.validateSave(data);StormChapter.validateSave(data);RunRelics.validateSave(data);EliteTrials.validateSave(data);AdventureProgress.validate(data);
    j=SeamlessFloor.create(data.seed,data.levelId);
    if(j.rooms.some((r,i)=>data.rooms[i].reward&&!['combat','elite'].includes(r.role)))throw Error('Invalid reward room');
    map=SeamlessFloor.mapFor(j);
    if(![data.player.x,data.player.y].every(Number.isFinite)||map.circleBlocked(data.player.x,data.player.y,12))throw Error('Invalid player position');
  }catch(error){return false;}
  endVisualRoomPreview();VisualRoomPreview.save={data:Save.data,dirty:Save.dirty,timer:Save.timer};Save.data=data.meta;Save.dirty=false;Save.timer=0;this.resetRunState();
  this.journey=j;this.map=map;j.rooms.forEach((r,i)=>Object.assign(r,data.rooms[i]));
  this.hero=HERO_BY_ID[data.heroId||'arator'];this.player=Object.assign(new Player(this.hero,data.player.level,Save.bonuses()),data.player);
  this.enemies=data.enemies.map(o=>{const e=Object.assign(this.makeJourneyEnemy(o.type,o.x,o.y,o.isBoss),o);e.def={...e.def,sight:600};e.state=o.state==='idle'?'idle':'chase';e.attackTimer=.7;if(e.def.rootvault)RootCombat.restore(e,o.rootState);EliteTrials.restore(e,o.eliteState);return e;});
  this.rootHazards=data.rootHazards||[];
  this.chests=data.chests.map(c=>Object.assign(new Chest(c.x,c.y),c));this.pickups=data.pickups.map(p=>Object.assign(new Pickup(p.x,p.y,p.kind,{}),p));
  const items=[...this.player.bag,...Object.values(this.player.equipment),...this.pickups.filter(p=>p.kind==='item').map(p=>p.item)].filter(Boolean);ITEM_UID=Math.max(ITEM_UID,...items.map(it=>(Number(it.uid)||0)+1));
  for(const i of data.explored)if(Number.isInteger(i)&&i>=0&&i<map.explored.length)map.explored[i]=1;
  RunRelics.prepareRooms(this);AdventureProgress.prepare(this);this.runStats=data.stats;this.floor=ExpeditionLevels.get(j.levelId).floor;this.state='run';this.camera={x:clamp(this.player.x-512,0,SeamlessFloor.width-1024),y:clamp(this.player.y-320,0,SeamlessFloor.height-640)};
  this.updateSeamlessZones();map.updateVisibility(Math.floor(this.player.x/TILE),Math.floor(this.player.y/TILE));this.ui.hide();return true;
};
const seamlessOldUpdateEnemy=Game.prototype.updateEnemy,seamlessOldSummon=Game.prototype.summonMinions,seamlessOldKill=Game.prototype.killEnemy;
Game.prototype.updateEnemy=function(e,dt){
  if(this.journey?.seamless){
    if(!this.journey.rooms[e.homeRoom]?.active)return;
    if(dist(e.x,e.y,this.player.x,this.player.y)>1200&&e.poisonTime<=0)return;
    if(e.state==='idle'&&dist(e.x,e.y,this.player.x,this.player.y)<700){e.state='chase';e.memory=8;}
  }return seamlessOldUpdateEnemy.call(this,e,dt);
};
Game.prototype.summonMinions=function(e,...args){const n=this.enemies.length;seamlessOldSummon.call(this,e,...args);if(this.journey?.seamless)for(const v of this.enemies.slice(n))v.homeRoom=e.homeRoom;};
Game.prototype.killEnemy=function(e){seamlessOldKill.call(this,e);if(this.journey?.seamless&&e.isBoss&&!this.journey.rooms[15].cleared){this.stairsOpen=false;this.banner=null;if(this.messages.length)this.messages.pop();this.message(e.homeRoom===15?'Босс повержен. Победите оставшуюся охрану.':e.def.name+' повержен. Победите охрану и заберите награду.');}};
const seamlessOldUpdate=Game.prototype.update;
Game.prototype.update=function(dt){
  const j=this.journey;if(!j?.seamless)return seamlessOldUpdate.call(this,dt);const inp=this.input;this.time+=dt;
  if(this.state==='route-map'){if(inp.hit('KeyM')||inp.hit('Escape')){this.state='run';j.mapOpen=false;this.ui.hide();}inp.endFrame();return;}
  if(this.state!=='run'){if(['paused','inventory'].includes(this.state)&&(inp.hit('Escape')||inp.hit('KeyI')||inp.hit('Tab'))){this.state='run';this.ui.hide();}inp.endFrame();return;}
  if(inp.hit('KeyM')){this.ui.showJourneyMap();inp.endFrame();return;}
  if(inp.hit('Escape')||inp.tHit('pause')){this.state='paused';this.saveJourney();this.ui.showPause();inp.endFrame();return;}
  if(inp.hit('KeyI')||inp.hit('Tab')||inp.tHit('bag')){this.state='inventory';this.ui.showInventory();inp.endFrame();return;}
  const use=inp.hit('KeyE')||inp.tHit('use');this.runStats.time+=dt;j.saveTimer+=dt;j.noticeTime=Math.max(0,j.noticeTime-dt);
  this.updatePlayer(dt);if(this.state!=='run'){inp.endFrame();return;}
  this.updateSeamlessZones();
  for(const phase of ['updateEnemies','updateProjectiles','updatePickups','updateWorld']){this[phase](dt);if(this.state!=='run'){inp.endFrame();return;}}
  this.updateSeamlessZones();
  const near=this.journeyTargets().sort((a,b)=>dist(this.player.x,this.player.y,a.x,a.y)-dist(this.player.x,this.player.y,b.x,b.y))[0];
  j.near=near&&dist(this.player.x,this.player.y,near.x,near.y)<65?near:null;inp.touch.showUse=!!j.near&&j.near.enabled;
  if(use&&j.near)this.journeyInteract(j.near);
  if(this.state!=='run'){inp.endFrame();return;}
  if(j.saveTimer>5)this.saveJourney();this.updateEffects(dt);inp.endFrame();
};


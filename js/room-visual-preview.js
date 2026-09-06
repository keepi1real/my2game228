'use strict';
// A reversible playable art review in the current GitHub engine. Campaign saves are untouched.
const VisualRoomPreview={save:null,obstacles:[{x:330,y:365,r:27},{x:694,y:365,r:27}]};
const visualBaseUIRender=UI.prototype.render;
UI.prototype.render=function(html){
  const menu=this.g.state==='menu'&&html.includes('data-a="heroes"');
  if(menu&&!html.includes('data-a="room-visual"'))html=html.replace('<div class="menu-buttons">','<div class="menu-buttons"><button data-a="room-visual">Стражная галерея · новое оформление</button>');
  visualBaseUIRender.call(this,html);if(menu)this.bind('[data-a=room-visual]','click',()=>this.g.startVisualRoom());
};
function makeVisualRoomMap(){
  const map=new GameMap(32,22);map.visualRoom=true;map.obstacles=VisualRoomPreview.obstacles;
  map.circleBlocked=(x,y,r)=>{
    if(!RoomVisualArt.floorContains(x,y))return true;
    if(map.obstacles.some(o=>Math.hypot(x-o.x,y-o.y)<o.r+r))return true;
    for(let i=0;i<24;i++){const a=i*Math.PI/12;if(!RoomVisualArt.floorContains(x+Math.cos(a)*r,y+Math.sin(a)*r))return true;}return false;
  };
  for(let y=0;y<map.h;y++)for(let x=0;x<map.w;x++)map.set(x,y,map.circleBlocked((x+.5)*TILE,(y+.5)*TILE,12)?T_WALL:T_FLOOR);
  map.updateVisibility=()=>{map.visible.fill(1);map.explored.fill(1);};map.updateVisibility();return map;
}
const visualBaseSave=Save.save;
Save.save=function(){if(VisualRoomPreview.save){this.dirty=false;this.timer=0;return;}return visualBaseSave.call(this);};
function endVisualRoomPreview(){if(!VisualRoomPreview.save)return;Object.assign(Save,VisualRoomPreview.save);VisualRoomPreview.save=null;}
const visualBaseReset=Game.prototype.resetRunState,visualBaseStart=Game.prototype.startRun,visualBaseMenu=Game.prototype.toMenu,visualBaseEnd=Game.prototype.endRun;
Game.prototype.resetRunState=function(){visualBaseReset.call(this);this.visualRoom=null;};
Game.prototype.startRun=function(...args){endVisualRoomPreview();return visualBaseStart.apply(this,args);};
Game.prototype.toMenu=function(){endVisualRoomPreview();return visualBaseMenu.call(this);};
Game.prototype.endRun=function(win){if(!this.visualRoom)return visualBaseEnd.call(this,win);this.state='paused';this.visualRoom.failed=true;this.ui.showVisualRoomToolbar();};
Game.prototype.startVisualRoom=function(combat=false){
  endVisualRoomPreview();VisualRoomPreview.save={data:Save.data,dirty:Save.dirty,timer:Save.timer};Save.data=JSON.parse(JSON.stringify(Save.data));Save.dirty=false;Save.timer=0;
  this.resetRunState();this.visualRoom={combat,debug:false,clean:false,failed:false};this.state='run';this.floor=1;
  this.hero=HERO_BY_ID.arator;this.player=new Player(this.hero,1,Save.bonuses());this.player.x=512;this.player.y=482;this.player.hp=this.player.maxHp;this.player.consumables.potion=3;
  this.map=makeVisualRoomMap();this.camera={x:0,y:32};this.input.keys={};this.input.pressed={};this.input.mouse.down=false;
  Object.assign(this.input.touch,{move:{x:0,y:0},stick:null,aimDrag:null,attack:false,pressed:{},buttons:{}});
  if(combat)this.enemies=[new Enemy('goblin',450,292,1),new Enemy('warg',594,300,1),new Enemy('goblin',512,225,1)];
  this.ui.showVisualRoomToolbar();
};
const visualBasePlayer=Game.prototype.updatePlayer;
Game.prototype.updatePlayer=function(dt){
  visualBasePlayer.call(this,dt);if(this.visualRoom){this.camera.x=0;this.camera.y=32;}
};
const visualBaseHide=UI.prototype.hide;
UI.prototype.hide=function(){if(this.g.visualRoom)this.showVisualRoomToolbar();else visualBaseHide.call(this);};
UI.prototype.showVisualRoomToolbar=function(){
  const v=this.g.visualRoom;if(!v)return;
  this.render(`<div class="visual-room-toolbar"><span>${v.failed?'Герой пал':v.combat?'Проверка боя':'Стражная галерея'}</span><button data-visual-action="view">Осмотр</button><button data-visual-action="fight">Бой</button><button data-visual-action="mask" aria-pressed="${v.debug}">Коллизии</button><button data-visual-action="clean" aria-pressed="${v.clean}">Только зал</button><button data-visual-action="menu">Меню</button></div>`);
  this.bind('[data-visual-action]','click',el=>{
    const action=el.dataset.visualAction;
    if(action==='view')this.g.startVisualRoom();else if(action==='fight')this.g.startVisualRoom(true);
    else if(action==='menu')this.g.toMenu();else{v[action==='mask'?'debug':'clean']=!v[action==='mask'?'debug':'clean'];this.showVisualRoomToolbar();}
  });
};
const visualBaseRender=Renderer.prototype.render;
Renderer.prototype.render=function(){
  const g=this.g,v=g.visualRoom;if(!v)return visualBaseRender.call(this);const ctx=this.ctx;
  ctx.fillStyle='#071321';ctx.fillRect(0,0,VIEW_W,VIEW_H);ctx.save();ctx.translate(0,-32);
  if(!RoomVisualArt.base(ctx)){ctx.fillStyle='#dac48d';ctx.font='16px sans-serif';ctx.fillText('Загрузка оформления…',410,320);ctx.restore();return;}
  RoomVisualArt.ground(ctx,g.time);RoomVisualArt.flames(ctx,g.time);
  const open=!g.enemies.some(e=>e.alive);for(const socket of ['left','right'])RoomVisualArt.portal(ctx,socket,open,g.time);
  this.drawChests();this.drawPickups();this.drawTelegraphs();
  for(const o of g.map.obstacles)RoomVisualArt.columnShadow(ctx,o);
  const enemies=g.enemies;const entries=[...enemies.filter(e=>e.alive).map(e=>({y:e.y,kind:'enemy',e})),...g.map.obstacles.map(o=>({y:o.y,kind:'column',o})),{y:g.player.y,kind:'player'}];
  for(const e of entries.sort((a,b)=>a.y-b.y)){
    if(e.kind==='column')RoomVisualArt.drawColumn(ctx,e.o,g.player);
    else if(e.kind==='player'){if(!v.clean)this.drawPlayer();}
    else if(!v.clean){g.enemies=[e.e];this.drawEnemies();}
  }
  g.enemies=enemies;
  this.drawProjectiles();this.drawEffects();this.drawParticles();
  RoomVisualArt.front(ctx,v.clean?null:g.player,g.time);RoomVisualArt.atmosphere(ctx,g.time);
  if(v.debug)RoomVisualArt.debug(ctx,g.map.obstacles);if(!v.clean)this.drawTexts();ctx.restore();
  if(!v.clean){
    ctx.fillStyle='rgba(6,16,27,.86)';ctx.fillRect(15,58,185,49);ctx.fillStyle='#efce88';ctx.font='bold 13px sans-serif';ctx.textAlign='left';ctx.fillText('Аратор',27,77);
    ctx.fillStyle='#40303b';ctx.fillRect(27,87,158,7);ctx.fillStyle='#df785b';ctx.fillRect(27,87,158*Math.max(0,g.player.hp/g.player.maxHp),7);
    ctx.fillStyle='rgba(6,16,27,.85)';ctx.fillRect(275,58,474,28);ctx.textAlign='center';ctx.fillStyle='#bde0d8';ctx.font='12px sans-serif';
    ctx.fillText(v.combat?(open?'Комната зачищена · проходы открыты':'Победите врагов, чтобы открыть проходы'):'Осмотр комнаты · WASD / стрелки · мышь / пробел — атака',512,77);
    if(g.input.touchMode){
      this.drawTouchControls();
      for(let i=0;i<CONSUMABLE_ORDER.length;i++){
        const b=touchConsumableRect(i),id=CONSUMABLE_ORDER[i],c=CONSUMABLES[id];ctx.fillStyle='rgba(8,18,28,.75)';ctx.fillRect(b.x,b.y,b.w,b.h);
        ctx.fillStyle=c.color;ctx.font='16px sans-serif';ctx.fillText(c.icon,b.x+20,b.y+18);ctx.fillStyle='#e3d8ba';ctx.font='11px sans-serif';ctx.fillText('×'+g.player.consumables[id],b.x+20,b.y+36);
      }
    }
  }
};


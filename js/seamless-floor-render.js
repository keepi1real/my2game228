'use strict';
const SeamlessPaint=(()=>{
  function path(c,p){c.moveTo(p[0][0],p[0][1]);for(let i=1;i<p.length;i++)c.lineTo(p[i][0],p[i][1]);c.closePath();}
  function intersects(a,b){return a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;}
  function corridorBounds(v){return {x:Math.min(...v.polygon.map(p=>p[0]))-30,y:Math.min(...v.polygon.map(p=>p[1]))-30,w:Math.max(...v.polygon.map(p=>p[0]))-Math.min(...v.polygon.map(p=>p[0]))+60,h:Math.max(...v.polygon.map(p=>p[1]))-Math.min(...v.polygon.map(p=>p[1]))+60};}
  function roomBounds(r){return {x:r.origin.x,y:r.origin.y-80,w:1024,h:840};}
  function outsidePassages(c,r,links){const b=roomBounds(r);c.beginPath();c.rect(b.x,b.y,b.w,b.h);for(const link of links)if(intersects(corridorBounds(link),b))path(c,link.polygon);c.clip('evenodd');}
  function room(c,r,links,time){
    if(r.id!==15||r.biome!=='forge')return;
    const t=r.templateData,b={x:r.origin.x,y:r.origin.y,w:1024,h:1024*2/3};if(!RoomVisualArt.ready(t.image))return;
    // The runtime cuts open the decorative shell wherever the shared corridor
    // mesh crosses it. Restore only its walkable interior to keep the room art.
    c.save();outsidePassages(c,r,links);c.beginPath();path(c,[[100,350],[315,160],[400,20],[585,0],[920,0],[1120,20],[1230,170],[1460,350],[1440,720],[1240,905],[955,970],[580,970],[320,890],[70,740]].map(([x,y])=>[x*2/3+b.x,y*2/3+b.y]));c.clip();c.drawImage(t.image,b.x,b.y,b.w,b.h);c.restore();
    c.save();c.beginPath();for(const p of r.polygons)path(c,p);c.clip();c.drawImage(t.image,b.x,b.y,b.w,b.h);c.restore();
  }
  function floorplan(c,g,large=false){
    const j=g.journey,P=RoutePaint,box=large?{x:136,y:56,w:752,h:532}:{x:14,y:464,w:207,h:161};
    const level=ExpeditionLevels.get(j.levelId);
    P.plate(c,box.x,box.y,box.w,box.h);P.text(c,large?level.name.toUpperCase():'КАРТА · ЭТАЖ '+level.floor,box.x+box.w/2,box.y+17,'#e4c990',large?18:11);
    const scale=Math.min((box.w-38)/SeamlessFloor.width,(box.h-(large?98:46))/SeamlessFloor.height);
    const ox=box.x+(box.w-SeamlessFloor.width*scale)/2,oy=box.y+32;
    c.save();c.translate(ox,oy);c.scale(scale,scale);
    c.lineWidth=SeamlessFloor.bridgeHalf*2;c.lineCap='round';c.strokeStyle='#273746';
    for(const v of j.corridors){c.beginPath();path(c,v.polygon);c.fillStyle='#35464e';c.fill();}
    for(const r of j.rooms){c.beginPath();for(const p of r.polygons)path(c,p);c.fillStyle=r.visited?(r.cleared?'#649b91':'#a07967'):r.discovered?'#516171':'#283946';c.fill();}
    // Draw explored corridor cells using the same coordinates as the world.
    c.fillStyle='#8ab3a6';
    for(let y=0;y<g.map.h;y++)for(let x=0;x<g.map.w;x++){const i=g.map.idx(x,y);if(g.map.explored[i]&&g.map.tiles[i]===T_FLOOR)c.fillRect(x*TILE,y*TILE,TILE,TILE);}
    c.restore();
    if(large){for(const r of j.rooms){const x=ox+r.center.x*scale,y=oy+r.center.y*scale;P.text(c,r.discovered?(r.reward?.status==='available'?'◆ Реликвия':r.feature?(r.feature.kind==='beacon'?(r.featureChoice?'Погашен':'Маяк'):r.feature.kind==='forge'?'Кузница':'Карты'):r.role==='boss'?'Босс':RoomRoute.roles[r.role].label):'?',x,y,r.reward?.status==='available'?'#ffe1a0':'#e0d9c1',10);}}
    else for(const r of j.rooms)if(r.discovered&&r.reward?.status==='available'){c.fillStyle='#f2d18a';c.fillRect(ox+r.center.x*scale-2,oy+r.center.y*scale-2,4,4);}
    const px=ox+g.player.x*scale,py=oy+g.player.y*scale;c.fillStyle='#fff0a5';c.beginPath();c.arc(px,py,large?4.5:3.5,0,6.28);c.fill();
    if(large){c.strokeStyle='#e4d69b';c.lineWidth=1;c.strokeRect(ox+g.camera.x*scale,oy+g.camera.y*scale,1024*scale,640*scale);P.text(c,'Точка — герой. Прямоугольник — область камеры.',512,box.y+box.h-45,'#bdc8bf',12);P.text(c,level.mapLegend+' · открытые переходы',512,box.y+box.h-23,'#97adaa',11);}
    else P.text(c,`${j.rooms.filter(r=>r.visited).length} / 16 зон  ·  M`,box.x+box.w/2,box.y+box.h-13,'#c1cfbf',10);
  }
  return {path,intersects,corridorBounds,roomBounds,outsidePassages,room,floorplan};
})();
Renderer.prototype.drawSeamlessWorld=function(view){
  const g=this.g,j=g.journey,c=this.ctx,P=RoutePaint,S=SeamlessPaint;
  const rooms=j.rooms.filter(r=>S.intersects(S.roomBounds(r),view)),corridors=j.corridors.filter(v=>S.intersects(S.corridorBounds(v),view));
  BiomeArtV3.background(c,j,view);BiomeArtV3.ground(c,g,rooms,corridors,view);
  for(const r of rooms)S.room(c,r,j.corridors,g.time);
  const onScreen=e=>e.x>view.x-100&&e.x<view.x+view.w+100&&e.y>view.y-40&&e.y<view.y+view.h+160;
  const decor=g.map.decor.filter(o=>o.x>view.x-160&&o.x<view.x+view.w+160&&o.y>view.y-50&&o.y<view.y+view.h+270);
  const enemies=g.enemies,entries=[...enemies.filter(e=>e.alive&&onScreen(e)).map(e=>({y:e.y,kind:'enemy',value:e})),...decor.map(o=>({y:o.y,kind:o.kind,value:o})),...g.chests.filter(onScreen).map(o=>({y:o.y,kind:'chest',value:o})),{y:g.player.y,kind:'player'}];
  for(const r of rooms)if(r.role==='rest')entries.push({y:r.restPoint.y,kind:'rest',value:r});
  for(const r of rooms)if(r.reward?.status==='available')entries.push({y:r.rewardPoint.y,kind:'relic',value:r});
  for(const f of g.motionCorpses||[])if(onScreen(f))entries.push({y:f.y,kind:'corpse',value:f});
  for(const o of decor)BiomeArtV3.light(c,o,g.time);
  this.drawPickups();this.drawTelegraphs();
  try{for(const e of entries.sort((a,b)=>a.y-b.y)){
    if(e.kind==='corpse')ActorMotion.corpse(c,e.value);
    else if(e.kind==='biome-prop')BiomeArtV3.prop(c,e.value,g.player,g.time);
    else if(e.kind==='column')RoomVisualArt.drawColumn(c,e.value,g.player);
    else if(e.kind==='crate')P.crate(c,e.value);
    else if(e.kind==='chest')P.chest(c,e.value,g.time,!j.rooms[e.value.homeRoom].cleared);
    else if(e.kind==='rest')P.shrine(c,e.value.restPoint,e.value.restUsed,g.time);
    else if(e.kind==='relic')this.drawRoomRelic(e.value);
    else if(e.kind==='player'){
      c.save();const p=g.player;c.translate(p.x,p.y);c.scale(1,.5);const halo=c.createRadialGradient(0,0,5,0,0,45);halo.addColorStop(0,'rgba(243,201,115,.15)');halo.addColorStop(1,'rgba(243,201,115,0)');c.fillStyle=halo;c.fillRect(-45,-45,90,90);c.restore();
      c.save();c.filter='brightness(1.32)';c.shadowColor='rgba(255,220,150,.55)';c.shadowBlur=2;this.drawPlayer();c.restore();
    }else {g.enemies=[e.value];this.drawEnemies();}
  }}finally{g.enemies=enemies;}
  this.drawProjectiles();this.drawEffects();this.drawParticles();this.drawTexts();
  const boss=j.rooms[15];if(boss.cleared&&rooms.includes(boss)){
    c.save();c.translate(boss.origin.x+512,boss.origin.y+213);c.scale(2.3,1.6);this.drawStairs(-16,-16,true);c.restore();P.text(c,'ЛЕСТНИЦА ВНИЗ',boss.origin.x+512,boss.origin.y+248,'#e7d195',12);
  }
  // Small sparks in world coordinates remain continuous when the camera moves.
  for(const r of rooms)for(let i=0;i<5;i++){const x=r.center.x+Math.sin(i*19+g.time*.07)*280,y=r.center.y+Math.cos(i*13+g.time*.11)*140;if(g.map.floorContains(x,y)){c.fillStyle='rgba(201,201,157,.25)';c.fillRect(x,y,1.5,1.5);}}
};
const seamlessOldRender=Renderer.prototype.render;
Renderer.prototype.render=function(){
  const g=this.g,j=g.journey;if(!j?.seamless)return seamlessOldRender.call(this);
  const c=this.ctx,P=RoutePaint;
  c.save();c.translate(-g.camera.x,-g.camera.y);this.drawSeamlessWorld({x:g.camera.x,y:g.camera.y,w:1024,h:640});c.restore();
  P.plate(c,14,12,231,69);P.text(c,g.hero.name.toUpperCase()+' / ЭТАЖ '+g.floor,27,28,'#dcc58e',11,'left');c.fillStyle='#482e36';c.fillRect(27,43,201,8);c.fillStyle='#d17664';c.fillRect(27,43,201*Math.max(0,g.player.hp/g.player.maxHp),8);
  P.text(c,`${Math.ceil(g.player.hp)} / ${g.player.maxHp}    ◆ ${g.player.gold}    F: зелья ${g.player.consumables.potion}`,27,65,'#c5cdc1',11,'left');
  const r=j.current===null?null:j.rooms[j.current];P.plate(c,416,12,329,57);P.text(c,r?r.name:'Галереи и дворики',580,31,'#efdaa8',15);
  P.text(c,r?(r.cleared?'ЗОНА ЗАЧИЩЕНА':`СТРАЖА: ${g.enemies.filter(e=>e.alive&&e.homeRoom===r.id).length}`):'К СОСЕДНИМ ЗАЛАМ · ПУТЬ СВОБОДЕН',580,53,r?.cleared?'#9ed4be':'#c8bc9f',9);
  SeamlessPaint.floorplan(c,g);
  if(g.boss?.alive&&dist(g.boss.x,g.boss.y,g.player.x,g.player.y)<1000){
    const compact=['tide','sunforge','amber','glass'].includes(j.levelId),x=compact?756:315,y=compact?12:86,w=compact?254:395,h=compact?57:41;
    P.plate(c,x,y,w,h);P.text(c,g.boss.def.name,x+w/2,y+(compact?19:13),'#e9b18e',compact?11:12);
    c.fillStyle='#422832';c.fillRect(x+15,y+h-15,w-30,7);c.fillStyle='#ba6260';c.fillRect(x+15,y+h-15,(w-30)*g.boss.hp/g.boss.maxHp,7);
  }
  const help=j.near?(j.near.enabled?'E · ':'')+j.near.label:j.noticeTime>0?j.notice:'WASD — шаг · ЛКМ / пробел — удар · Shift — рывок · M — карта';
  if(!g.input.touchMode){P.plate(c,232,617,778,22);P.text(c,help,621,628,'#c1cdc3',11);}
  else {this.drawTouchControls();for(let i=0;i<CONSUMABLE_ORDER.length;i++){const b=touchConsumableRect(i),id=CONSUMABLE_ORDER[i];P.plate(c,b.x,b.y,b.w,b.h);P.text(c,['Леч.','Хлеб','Огонь','Сила'][i],b.x+20,b.y+13,CONSUMABLES[id].color,9);P.text(c,'×'+g.player.consumables[id],b.x+20,b.y+33,'#dacfb8',11);}if(j.near){P.plate(c,260,78,530,25);P.text(c,j.near.label,525,91,'#dbe3c9',12);}}
  if(g.state==='route-map'){c.fillStyle='rgba(3,10,17,.9)';c.fillRect(0,0,1024,640);SeamlessPaint.floorplan(c,g,true);}
};


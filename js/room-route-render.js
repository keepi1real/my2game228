'use strict';
const routeBaseUIRender=UI.prototype.render,routeBaseUIHide=UI.prototype.hide,routeBasePause=UI.prototype.showPause;
UI.prototype.render=function(html){
  const menu=this.g.state==='menu'&&html.includes('data-a="heroes"');
  if(menu){
    let saved=false;try{const s=JSON.parse(localStorage.getItem(SeamlessFloor.key));saved=!!s&&s.version===3;}catch(error){}
    html=html.replace('<div class="menu-buttons">',`<div class="menu-buttons"><button class="primary" data-route="new">Бесшовное Подгорье · 16 зон</button>${saved?'<button data-route="resume">Продолжить путь</button>':''}`);
  }
  routeBaseUIRender.call(this,html);
  if(menu){this.bind('[data-route=new]','click',()=>this.g.startSeamlessJourney());this.bind('[data-route=resume]','click',()=>this.g.resumeSeamlessJourney());}
};
UI.prototype.hide=function(){
  if(!this.g.journey)return routeBaseUIHide.call(this);
  this.render('<div class="route-toolbar"><button data-route-ui="map">Карта · M</button><button data-route-ui="pause">Пауза</button></div>');
  this.bind('[data-route-ui=map]','click',()=>this.showJourneyMap());
  this.bind('[data-route-ui=pause]','click',()=>{this.g.state='paused';this.g.saveJourney();this.showPause();});
};
UI.prototype.showPause=function(){
  if(!this.g.journey)return routeBasePause.call(this);
  this.render('<div class="overlay"><div class="panel" style="--w:470px"><h2>Привал</h2><p>Этаж сохраняется автоматически. Можно вернуться к нему из меню.</p><div class="menu-buttons"><button class="primary" data-route-pause="resume">Продолжить</button><button data-route-pause="map">Карта этажа</button><button data-route-pause="talents">Таланты героя</button><button data-route-pause="menu">Сохранить и выйти в меню</button></div></div></div>');
  this.bind('[data-route-pause=resume]','click',()=>{this.g.state='run';this.hide();});
  this.bind('[data-route-pause=talents]','click',()=>this.showTalents());
  this.bind('[data-route-pause=map]','click',()=>this.showJourneyMap());
  this.bind('[data-route-pause=menu]','click',()=>this.g.toMenu());
};
UI.prototype.showJourneyMap=function(){
  this.g.state='route-map';this.g.journey.mapOpen=true;this.g.saveJourney();
  this.render('<div class="route-map-controls"><button data-route-close>Вернуться в комнату · M / Esc</button></div>');
  this.bind('[data-route-close]','click',()=>{this.g.state='run';this.g.journey.mapOpen=false;this.hide();});
};
UI.prototype.showJourneyResult=function(win){
  const g=this.g,j=g.journey;
  const title=j.seamless?ExpeditionLevels.get(j.levelId).name.toUpperCase():'ПУТЬ К ПЕПЕЛЬНОЙ КОРОНЕ';
  this.render(`<div class="overlay"><div class="panel" style="--w:510px"><div class="subtitle">${title}</div><h2>${win?'Поход завершён':'Поход окончен'}</h2><p>${win?'Стража повержена. Вы нашли финальную лестницу.':'Следующий поход начнётся с нового входа.'}</p><p>Этаж: ${g.floor} · Исследовано здесь: ${j.rooms.filter(r=>r.visited).length} / 16 · Побеждено врагов за поход: ${g.runStats.kills} · Золото: ${g.player.gold}</p><div class="menu-buttons"><button class="primary" data-route-result="new">Новый маршрут</button><button data-route-result="menu">В меню</button></div></div></div>`);
  this.bind('[data-route-result=new]','click',()=>g.journey?.seamless?g.startSeamlessJourney(undefined,g.hero.id):g.startJourney());this.bind('[data-route-result=menu]','click',()=>g.toMenu());
};
const RoutePaint = (()=>{
  function poly(c,points,fill,stroke='#091a29',width=2){c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fillStyle=fill;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.stroke();}}
  function glow(c,x,y,r,color){const g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,color);g.addColorStop(1,'rgba(0,0,0,0)');c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);}
  function plate(c,x,y,w,h){c.fillStyle='rgba(6,17,27,.93)';c.fillRect(x,y,w,h);c.strokeStyle='rgba(171,141,82,.45)';c.lineWidth=1;c.strokeRect(x+.5,y+.5,w-1,h-1);}
  function text(c,txt,x,y,color='#dcd4bd',size=12,align='center'){c.font=`${size}px sans-serif`;c.fillStyle=color;c.textAlign=align;c.textBaseline='middle';c.fillText(txt,x,y);}
  function chest(c,o,time,locked){
    c.save();c.translate(o.x,o.y);c.scale(1.15,1.15);
    if(!o.opened&&!locked)glow(c,0,-6,46,'rgba(236,184,60,.27)');
    c.fillStyle='rgba(0,7,13,.6)';c.beginPath();c.ellipse(3,7,26,10,0,0,Math.PI*2);c.fill();
    poly(c,[[-21,-17],[8,-24],[23,-16],[-6,-8]],'#b98440');
    poly(c,[[-21,-17],[-6,-8],[-6,11],[-21,2]],'#4a3430');
    poly(c,[[-6,-8],[23,-16],[23,3],[-6,11]],o.opened?'#4d463e':'#76532f');
    if(o.opened)poly(c,[[-21,-17],[-24,-34],[6,-40],[8,-24]],'#c2924b');
    else {poly(c,[[-21,-17],[-17,-27],[11,-34],[23,-16],[-6,-8]],'#95683a');poly(c,[[-14,-22],[-10,-28],[15,-20],[13,-16]],'#e5bc64',null);}
    c.strokeStyle='#d3a752';c.lineWidth=3;c.beginPath();c.moveTo(1,-10);c.lineTo(1,9);c.moveTo(16,-13);c.lineTo(16,5);c.stroke();
    poly(c,[[6,-9],[12,-11],[12,-2],[6,0]],locked?'#b35e5b':'#ffe298','#3c3227',1);
    if(locked){c.strokeStyle='#c88177';c.lineWidth=2;c.beginPath();c.moveTo(-17,-18);c.lineTo(21,3);c.stroke();}
    c.restore();
  }
  function crate(c,o){c.save();c.translate(o.x,o.y);poly(c,[[-26,-23],[6,-34],[29,-20],[-4,-9]],'#966c48');poly(c,[[-26,-23],[-4,-9],[-4,9],[-26,-4]],'#4e3b34');poly(c,[[-4,-9],[29,-20],[29,-1],[-4,9]],'#73533c');c.strokeStyle='#c19864';c.lineWidth=3;c.beginPath();c.moveTo(0,-10);c.lineTo(24,-1);c.moveTo(24,-17);c.lineTo(0,6);c.stroke();c.restore();}
  function shrine(c,q,used,time){
    c.save();c.translate(q.x,q.y);if(!used)glow(c,0,-15,65,'rgba(72,190,174,.25)');
    poly(c,[[-32,0],[0,-14],[32,0],[0,16]],'#253e4c');poly(c,[[-32,0],[0,16],[32,0],[27,12],[0,26],[-27,12]],'#152633');
    poly(c,[[-23,-10],[0,-22],[23,-10],[0,3]],used?'#344b54':'#75c9bc','#b29861',2);
    if(!used){c.strokeStyle='#c6e9d5';c.lineWidth=2;c.beginPath();c.ellipse(0,-8,12+Math.sin(time*2)*3,5,0,0,6.28);c.stroke();}c.restore();
  }
  function door(c,d,room,dest,time){
    const role=RoomRoute.roles[dest.role],open=room.cleared,color=open?'#8adac5':'#c97a70',labelColor=open?(dest.cleared?'#a9c7bd':role.color):'#c97a70';
    c.save();c.translate(d.x,d.y);
    if(open){glow(c,0,-22,48,'rgba(72,168,155,.21)');c.strokeStyle=color;c.lineWidth=2;
      for(let i=0;i<3;i++){const back=d.socket==='back',y=back?-34-i*13:25+i*13;c.globalAlpha=.25+.6*((time*.8+i/3)%1);c.beginPath();c.moveTo(-8,y+(back?-5:5));c.lineTo(0,y);c.lineTo(8,y+(back?-5:5));c.stroke();}c.globalAlpha=1;}
    poly(c,[[-25,1],[-25,-41],[0,-60],[25,-41],[25,1]],open?'rgba(28,70,77,.19)':'rgba(26,17,27,.7)',color,2);
    if(!open){c.strokeStyle=color;c.lineWidth=3;c.beginPath();c.moveTo(-20,-37);c.lineTo(20,-3);c.moveTo(20,-37);c.lineTo(-20,-3);c.stroke();}
    const labelY=d.socket==='back'?35:48;
    plate(c,-87,labelY,174,34);text(c,`${open?(dest.cleared?'✓ ':'→ '):'× '}${dest.role==='boss'?'Зал Короны':dest.role==='rest'?'Отдых':dest.role==='treasure'?'Сундук':dest.role==='start'?'Ко входу':dest.role==='elite'?'Элита · награда':'Бой'}`,0,labelY+10,labelColor,12);
    text(c,dest.name,0,labelY+25,'#a8b7b4',9);
    c.restore();
  }
  function sealed(c,q){c.save();c.translate(q.x,q.y);poly(c,[[-23,0],[-23,-36],[0,-54],[23,-36],[23,0]],'rgba(6,12,20,.64)','#334653');c.strokeStyle='#60616a';c.lineWidth=5;for(const y of [-29,-12]){c.beginPath();c.moveTo(-24,y+6);c.lineTo(24,y-3);c.stroke();}c.restore();}
  function map(c,j,large=false){
    const area=large?{x:150,y:54,w:724,h:536}:{x:14,y:473,w:187,h:153};plate(c,area.x,area.y,area.w,area.h);
    text(c,large?'ПУТЬ К ПЕПЕЛЬНОЙ КОРОНЕ':'КАРТА ЭТАЖА',area.x+area.w/2,area.y+19,'#e6c98d',large?18:11);
    const pos=r=>large?{x:277+r.x*112,y:548-(8-r.y)*38}:{x:51+r.x*28,y:602-(8-r.y)*9};
    for(const [a,b] of RoomRoute.edges){const ra=j.rooms[a],rb=j.rooms[b],pa=pos(ra),pb=pos(rb);c.strokeStyle=ra.visited&&rb.visited?'#72b5a5':'#344653';c.lineWidth=large?2:1;c.setLineDash(ra.discovered&&rb.discovered?[]:[3,5]);c.beginPath();c.moveTo(pa.x,pa.y);c.lineTo(pb.x,pb.y);c.stroke();}c.setLineDash([]);
    for(const r of j.rooms){const q=pos(r),role=RoomRoute.roles[r.role],active=r.id===j.current,color=active?'#fff1b9':r.visited?role.color:r.discovered?'#9eaaac':'#455763';
      if(large){c.fillStyle=active?'#475745':'#101f2a';c.fillRect(q.x-45,q.y-13,90,26);c.strokeStyle=color;c.lineWidth=active?2:1;c.strokeRect(q.x-45,q.y-13,90,26);text(c,r.discovered?role.label:r.role==='boss'?'Корона':'?',q.x+3,q.y,color,12);
        if(r.cleared){c.strokeStyle='#91cdb6';c.lineWidth=1.5;c.beginPath();c.moveTo(q.x-38,q.y);c.lineTo(q.x-35,q.y+3);c.lineTo(q.x-30,q.y-4);c.stroke();}}
      else {c.fillStyle=active?'#ffe5a5':color;c.beginPath();c.arc(q.x,q.y,active?4:2.8,0,6.28);c.fill();}
    }
    if(large){text(c,'Светлая рамка — вы · ✓ — зачищено · ? — ещё не разведано',512,99,'#a8bab8',12);text(c,'Карта не переносит героя: переходите через двери в комнате.',512,573,'#8fa4a8',11);}
    else text(c,`${j.rooms.filter(r=>r.visited).length} / 16  ·  M — открыть`,108,615,'#aebbb9',10);
  }
  return {poly,glow,plate,text,chest,crate,shrine,door,sealed,map};
})();
const routeBaseRenderer=Renderer.prototype.render;
Renderer.prototype.render=function(){
  const g=this.g,j=g.journey;if(!j)return routeBaseRenderer.call(this);
  const c=this.ctx,room=j.rooms[j.current],t=g.map.template,P=RoutePaint;
  c.save();c.fillStyle='#06121e';c.fillRect(0,0,VIEW_W,VIEW_H);c.translate(0,-32);
  if(!RoomVisualArt.ready(t.image)){P.text(c,'Загрузка комнаты…',512,320);c.restore();return;}
  c.drawImage(t.image,t.offset[0],t.offset[1],1024*t.size,1024*2/3*t.size);
  if(room.template==='gallery'){RoomVisualArt.ground(c,g.time);RoomVisualArt.flames(c,g.time);}
  else {
    c.save();c.beginPath();for(const p of g.map.polygons){p.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();}c.clip();
    P.glow(c,330,330,170,room.role==='rest'?'rgba(70,166,156,.12)':'rgba(222,147,64,.07)');c.restore();
  }
  for(const [socket,sp] of Object.entries(t.sockets))if(!room.doors.some(d=>d.socket===socket))P.sealed(c,RoomRoute.point(t,sp));
  for(const d of g.map.doors)P.door(c,d,room,j.rooms[d.to],g.time);
  if(room.role==='boss'&&room.cleared){c.save();c.translate(512,213);c.scale(2.3,1.6);this.drawStairs(-16,-16,true);c.restore();P.text(c,'ЛЕСТНИЦА ВНИЗ',512,249,'#efd48c',12);}
  this.drawPickups();this.drawTelegraphs();
  for(const o of g.map.obstacles)RoomVisualArt.columnShadow(c,o);
  const original=g.enemies,entries=[...original.filter(e=>e.alive).map(e=>({y:e.y,kind:'enemy',value:e})),...g.map.obstacles.map(o=>({y:o.y,kind:o.kind||'column',value:o})),...g.chests.map(o=>({y:o.y,kind:'chest',value:o})),{y:g.player.y,kind:'player'}];
  if(room.role==='rest'){const q=RoomRoute.point(t,[768,525]);entries.push({y:q.y,kind:'rest',value:q});}
  try{for(const e of entries.sort((a,b)=>a.y-b.y)){
    if(e.kind==='column')RoomVisualArt.drawColumn(c,e.value,g.player);
    else if(e.kind==='crate')P.crate(c,e.value);
    else if(e.kind==='chest')P.chest(c,e.value,g.time,!room.cleared);
    else if(e.kind==='rest')P.shrine(c,e.value,room.restUsed,g.time);
    else if(e.kind==='player')this.drawPlayer();else {g.enemies=[e.value];this.drawEnemies();}
  }}finally{g.enemies=original;}
  this.drawProjectiles();this.drawEffects();this.drawParticles();
  if(room.template==='gallery')RoomVisualArt.front(c,g.player,g.time);
  RoomVisualArt.atmosphere(c,g.time);this.drawTexts();c.restore();
  P.plate(c,14,12,231,69);P.text(c,'АРАТОР  /  ПУТЬ К КОРОНЕ',27,28,'#dec994',11,'left');
  c.fillStyle='#482e36';c.fillRect(27,43,201,8);c.fillStyle='#d17664';c.fillRect(27,43,201*Math.max(0,g.player.hp/g.player.maxHp),8);
  P.text(c,`${Math.ceil(g.player.hp)} / ${g.player.maxHp}    ◆ ${g.player.gold}    F: зелья ${g.player.consumables.potion}`,27,65,'#c2cfc9',11,'left');
  P.plate(c,416,12,329,57);P.text(c,room.name,580,31,'#f0dcae',17);P.text(c,room.cleared?'ПРОХОДЫ ОТКРЫТЫ':`ПЕЧАТЬ БОЯ  ·  ВРАГОВ: ${g.enemies.filter(e=>e.alive).length}`,580,53,room.cleared?'#9ecfc1':'#e29882',10);
  P.map(c,j);
  if(g.boss&&g.boss.alive){P.plate(c,315,571,395,39);P.text(c,g.boss.def.name,512,582,'#eab591',12);c.fillStyle='#422832';c.fillRect(330,594,365,7);c.fillStyle='#ba6260';c.fillRect(330,594,365*g.boss.hp/g.boss.maxHp,7);}
  const help=j.near?(room.cleared?'E · ':'')+j.near.label:j.noticeTime>0?j.notice:'WASD — шаг · ЛКМ / пробел — удар · Shift — рывок · I — сумка';
  if(!g.input.touchMode){P.plate(c,232,617,778,22);P.text(c,help,621,628,'#bfd0cb',11);}
  else {
    this.drawTouchControls();
    for(let i=0;i<CONSUMABLE_ORDER.length;i++){const b=touchConsumableRect(i),id=CONSUMABLE_ORDER[i];P.plate(c,b.x,b.y,b.w,b.h);P.text(c,['Леч.','Хлеб','Огонь','Сила'][i],b.x+20,b.y+13,CONSUMABLES[id].color,9);P.text(c,'×'+g.player.consumables[id],b.x+20,b.y+33,'#dacfb8',11);}
    if(j.near){P.plate(c,260,78,530,25);P.text(c,j.near.label,525,91,'#dbe3c9',12);}
  }
  if(j.transition>.45){c.fillStyle=`rgba(3,10,17,${(j.transition-.45)*1.3})`;c.fillRect(0,0,1024,640);}
  if(g.state==='route-map'){c.fillStyle='rgba(3,10,17,.86)';c.fillRect(0,0,1024,640);P.map(c,j,true);}
};
// Reuse the existing troll sprite for the crown guardian in this expedition.
// The regular campaign's boss artwork and definitions remain independent.
const routeBaseDrawArt=Renderer.prototype.drawArt,routeBaseBodyTop=Renderer.prototype.bodyTop;
Renderer.prototype.drawArt=function(group,id,ent,radius,color){
  if(this.g.journey&&group==='bosses'&&id==='grazgot'){
    const c=this.ctx;c.save();c.translate(ent.x,ent.y);c.scale(1.3,1.3);c.translate(-ent.x,-ent.y);const ok=drawEntityArt(c,'enemies','troll',ent,radius,color,this.g.time);c.restore();return ok;
  }return routeBaseDrawArt.call(this,group,id,ent,radius,color);
};
Renderer.prototype.bodyTop=function(group,id,ent,r){if(this.g.journey&&group==='bosses'&&id==='grazgot')return ent.y-114;return routeBaseBodyTop.call(this,group,id,ent,r);};
const routeBaseTouchButton=Renderer.prototype.drawTouchButton;
Renderer.prototype.drawTouchButton=function(button,label,color,options){
  if(this.g.journey){
    const u=TOUCH_UI,index=u.skills.indexOf(button);
    label=button===u.use?'E':button===u.attack?'Удар':button===u.dodge?'Рывок':button===u.bag?'I':button===u.pause?'II':index>=0?String(index+1):label;
    options={...options,size:button===u.dodge?13:button===u.attack?18:20};
  }return routeBaseTouchButton.call(this,button,label,color,options);
};


'use strict';
// Canvas artwork and native button hitboxes use the same layout. The dialog
// adapts to a portrait phone without squeezing three cards into one short row.
const RelicUI=(()=>{
  function layout(w,h){
    const portrait=h>w,u=portrait?Math.min(w/720,h/1120):Math.min(w/1024,h/640),margin=(portrait?40:64)*u;
    const top=portrait?245*u+Math.max(0,h-1120*u)*.12:188*u;
    const cardW=portrait?w-margin*2:(w-margin*2-36*u)/3,cardH=portrait?(h-200*u-top)/3:318*u;
    const boxes=[0,1,2].map(i=>({id:i,x:margin+(portrait?0:i*(cardW+18*u)),y:top+(portrait?i*(cardH+18*u):0),w:cardW,h:cardH}));
    boxes.push({id:'close',x:portrait?margin:w/2-180*u,y:h-(portrait?132:111)*u,w:portrait?w-2*margin:360*u,h:58*u});
    return {w,h,u,portrait,boxes};
  }
  function closeCanvas(g){
    if(!g.relicLayout)return;g.relicLayout=null;g.relicBackdrop=null;g.relicFocus=null;
    g.canvas.width=VIEW_W;g.canvas.height=VIEW_H;if(g.canvas.style)g.canvas.style.cssText='';
  }
  function text(c,s,x,y,size,color='#eee1c4',align='center',serif=false){c.fillStyle=color;c.font=(serif?'':'500 ')+size+'px '+(serif?'Georgia, serif':'Arial, sans-serif');c.textAlign=align;c.textBaseline='middle';c.fillText(s,x,y);}
  function wrap(c,s,x,y,maxWidth,size,color,align='center'){
    c.font='500 '+size+'px Arial, sans-serif';const lines=[''];for(const word of s.split(' ')){const i=lines.length-1,n=lines[i]?lines[i]+' '+word:word;if(c.measureText(n).width>maxWidth&&lines[i])lines.push(word);else lines[i]=n;}
    lines.forEach((line,i)=>text(c,line,x,y+i*size*1.4,size,color,align));return lines.length;
  }
  function icon(c,id,x,y,size,color){
    c.save();c.translate(x,y);c.scale(size/64,size/64);c.strokeStyle=color;c.fillStyle=color;c.lineWidth=2.2;c.lineCap='round';c.lineJoin='round';
    c.globalAlpha=.3;c.beginPath();for(let i=0;i<6;i++){const a=i*Math.PI/3-Math.PI/2;i?c.lineTo(Math.cos(a)*37,Math.sin(a)*37):c.moveTo(Math.cos(a)*37,Math.sin(a)*37);}c.closePath();c.stroke();c.globalAlpha=1;c.beginPath();
    if(id==='scarab'){c.ellipse(0,1,14,22,0,0,Math.PI*2);for(const y of [-12,0,12]){c.moveTo(-14,y);c.lineTo(-27,y-7);c.moveTo(14,y);c.lineTo(27,y-7);}c.moveTo(0,-20);c.lineTo(0,23);}
    else if(id==='hourglass'){c.moveTo(-20,-26);c.lineTo(20,-26);c.lineTo(-18,26);c.lineTo(18,26);c.lineTo(-20,-26);}
    else if(id==='mirror'){c.ellipse(0,0,20,28,0,0,Math.PI*2);c.moveTo(-9,-17);c.lineTo(5,-3);c.lineTo(-2,12);c.lineTo(9,22);}
    else if(id==='petal'){for(let i=0;i<5;i++){c.save();c.rotate(i*Math.PI*2/5);c.moveTo(0,0);c.quadraticCurveTo(-20,-32,0,-28);c.quadraticCurveTo(20,-32,0,0);c.restore();}}
    else if(id==='glassheart'){c.moveTo(0,27);for(const q of [[-26,-6],[-12,-25],[0,-13],[12,-25],[26,-6],[0,27]])c.lineTo(...q);c.moveTo(0,-13);c.lineTo(-6,4);c.lineTo(8,11);c.lineTo(0,27);}
    else if(id==='incense'){c.moveTo(-25,10);c.quadraticCurveTo(0,42,25,10);c.lineTo(-25,10);c.moveTo(0,9);c.bezierCurveTo(-20,-6,19,-9,0,-28);}
    else if(id==='blade'){c.moveTo(-16,18);c.lineTo(15,-23);c.lineTo(22,-26);c.lineTo(21,-16);c.lineTo(-9,24);c.closePath();c.stroke();c.beginPath();c.moveTo(-21,10);c.lineTo(0,25);c.moveTo(-14,20);c.lineTo(-23,30);}
    else if(id==='heart'){c.moveTo(0,23);c.bezierCurveTo(-45,-6,-16,-36,0,-13);c.bezierCurveTo(16,-36,45,-6,0,23);}
    else if(id==='ward'){c.moveTo(0,-27);c.lineTo(23,-16);c.lineTo(18,11);c.quadraticCurveTo(14,23,0,28);c.quadraticCurveTo(-14,23,-18,11);c.lineTo(-23,-16);c.closePath();c.moveTo(0,-15);c.lineTo(0,17);c.moveTo(-11,0);c.lineTo(11,0);}
    else if(id==='stride'){for(let i=0;i<3;i++){c.moveTo(-26+i*5,-15+i*15);c.bezierCurveTo(12,-27+i*15,34,-3+i*10,12,1+i*15);}}
    else if(id==='focus'){c.moveTo(0,-29);c.lineTo(8,-8);c.lineTo(28,0);c.lineTo(8,8);c.lineTo(0,29);c.lineTo(-8,8);c.lineTo(-28,0);c.lineTo(-8,-8);c.closePath();c.moveTo(-24,-24);c.lineTo(24,24);c.moveTo(24,-24);c.lineTo(-24,24);}
    else if(id==='fang'){c.moveTo(-29,0);c.quadraticCurveTo(0,-29,29,0);c.quadraticCurveTo(0,29,-29,0);c.moveTo(9,0);c.arc(0,0,9,0,Math.PI*2);}
    else if(id==='fire'){c.moveTo(-20,-24);c.lineTo(22,-24);c.lineTo(22,20);c.quadraticCurveTo(22,28,14,26);c.lineTo(-22,26);c.lineTo(-22,-18);c.quadraticCurveTo(-22,-29,-15,-24);c.moveTo(-16,-16);c.lineTo(16,-16);c.moveTo(0,-11);c.bezierCurveTo(-22,5,-8,21,2,16);c.bezierCurveTo(22,12,1,-1,0,-11);}
    else {c.moveTo(-8,-24);c.lineTo(8,-24);c.lineTo(8,-10);c.bezierCurveTo(34,8,22,28,0,28);c.bezierCurveTo(-22,28,-34,8,-8,-10);c.closePath();c.moveTo(-18,7);c.lineTo(18,7);c.moveTo(-11,-29);c.lineTo(11,-29);}
    c.stroke();c.restore();
  }
  function paint(c,g){
    const L=g.relicLayout,{w,h,u,portrait}=L,r=g.journey.rooms[g.pendingRelic];c.save();c.fillStyle='#071318';c.fillRect(0,0,w,h);
    if(g.relicBackdrop){const s=Math.max(w/VIEW_W,h/VIEW_H);c.drawImage(g.relicBackdrop,(w-VIEW_W*s)/2,(h-VIEW_H*s)/2,VIEW_W*s,VIEW_H*s);}
    const shade=c.createLinearGradient(0,0,0,h);shade.addColorStop(0,'rgba(5,14,20,.93)');shade.addColorStop(.5,'rgba(5,14,20,.86)');shade.addColorStop(1,'rgba(5,14,20,.97)');c.fillStyle=shade;c.fillRect(0,0,w,h);
    c.strokeStyle='rgba(206,175,110,.3)';c.lineWidth=u;c.strokeRect(20*u,20*u,w-40*u,h-40*u);
    text(c,'НАСЛЕДИЕ ПОДГОРЬЯ',w/2,(portrait?64:43)*u,(portrait?18:11)*u,'#c5ae7a');
    text(c,'Выбери свою силу',w/2,(portrait?120:87)*u,(portrait?43:38)*u,'#f0dfb6','center',true);
    text(c,'Одна награда. Решение останется с героем.',w/2,(portrait?172:128)*u,(portrait?21:14)*u,'#b8c4bd');
    text(c,r.name+' · зал зачищен',w/2,(portrait?207:157)*u,(portrait?17:11)*u,'#c5af81');
    for(const b of L.boxes){
      if(b.id==='close'){c.fillStyle='rgba(20,34,40,.96)';c.fillRect(b.x,b.y,b.w,b.h);c.strokeStyle='#65756d';c.strokeRect(b.x,b.y,b.w,b.h);text(c,'Вернуться в зал',b.x+b.w/2,b.y+b.h/2,(portrait?23:17)*u);continue;}
      const id=r.reward.offers[b.id],d=RunRelics.describe(g.player,id),hover=g.relicFocus===String(b.id),gr=c.createLinearGradient(b.x,b.y,b.x,b.y+b.h);
      gr.addColorStop(0,hover?'#2e3f43':'#23333b');gr.addColorStop(1,'#0b191f');c.fillStyle=gr;c.fillRect(b.x,b.y,b.w,b.h);
      c.strokeStyle=hover?'#f5dfab':d.color;c.lineWidth=(hover?2:1)*u;c.strokeRect(b.x,b.y,b.w,b.h);
      c.strokeStyle='rgba(198,184,150,.16)';c.strokeRect(b.x+7*u,b.y+7*u,b.w-14*u,b.h-14*u);
      const contentY=b.y+(portrait?(b.h-178*u)/2:0),ix=portrait?b.x+74*u:b.x+b.w/2,iy=contentY+(portrait?87:80)*u;
      ActorMotion.glow(c,ix,iy,60*u,d.color,.15);icon(c,id,ix,iy,(portrait?60:66)*u,d.color);
      const tx=portrait?b.x+143*u:b.x+b.w/2,align=portrait?'left':'center',tw=portrait?b.w-162*u:b.w-35*u;
      text(c,d.name,tx,contentY+(portrait?39:149)*u,(portrait?27:22)*u,'#ecdfc1',align,true);
      text(c,d.line,tx,contentY+(portrait?78:190)*u,(portrait?23:16)*u,d.color,align);
      wrap(c,d.detail,tx,contentY+(portrait?111:225)*u,tw,(portrait?19:13)*u,'#aebdb9',align);
      text(c,d.footer,tx,contentY+(portrait?152:287)*u,(portrait?14:9)*u,'#bfac80',align);
      if(!portrait)text(c,String(b.id+1),b.x+20*u,b.y+22*u,12*u,'#bca77e');
    }
    text(c,portrait?'Бой на паузе · можно вернуться позже':'Бой на паузе · 1 / 2 / 3 — выбрать · Esc — вернуться',w/2,h-39*u,(portrait?18:11)*u,'#adbbb3');
    c.restore();
  }
  return {layout,closeCanvas,paint,icon};
})();

UI.prototype.showRelicChoice=function(){
  const g=this.g,r=g.journey.rooms[g.pendingRelic],s=FrontMenu.size();g.relicLayout=RelicUI.layout(s.w,s.h);const L=g.relicLayout;
  g.canvas.width=L.w;g.canvas.height=L.h;if(g.canvas.style)g.canvas.style.cssText='width:100vw;height:100vh;max-width:none;max-height:none;image-rendering:auto;cursor:default';
  this.render(`<div class="front-surface" data-relic-surface role="dialog" aria-modal="true" aria-label="Награда за зал. Выберите одну из трёх. Бой на паузе"><h2 class="front-sr">Выбери свою силу</h2>${L.boxes.map(b=>{const d=b.id==='close'?null:RunRelics.describe(g.player,r.reward.offers[b.id]),label=d?d.name+'. '+d.line+'. '+d.detail+'. '+d.footer:'Вернуться в зал без выбора';return `<button class="front-hit" data-relic-choice="${b.id}" style="left:${b.x/L.w*100}%;top:${b.y/L.h*100}%;width:${b.w/L.w*100}%;height:${b.h/L.h*100}%" aria-label="${label}"><span class="front-sr">${label}</span></button>`;}).join('')}</div>`);
  this.bind('[data-relic-choice]','click',el=>{const id=el.dataset.relicChoice;if(id==='close')g.closeRelicChoice();else if(/^[0-2]$/.test(id))g.chooseRelic(r.id,r.reward.offers[Number(id)]);});
  this.bind('[data-relic-choice]','focus',el=>{g.relicFocus=el.dataset.relicChoice;});
  this.bind('[data-relic-choice]','pointerenter',el=>{g.relicFocus=el.dataset.relicChoice;});
  this.bind('[data-relic-choice]','pointerleave',()=>{g.relicFocus=null;});
  this.root.querySelector('[data-relic-choice="0"]')?.focus?.();
};
const relicUIHide=UI.prototype.hide;
UI.prototype.hide=function(){RelicUI.closeCanvas(this.g);return relicUIHide.call(this);};
const relicRender=Renderer.prototype.render;
Renderer.prototype.render=function(){
  const g=this.g;if(g.state==='relic-choice'&&g.relicLayout)return RelicUI.paint(this.ctx,g);
  relicRender.call(this);if(!g.journey?.seamless||g.state==='route-map'||g.frontMenu)return;
  const total=Object.values(g.player.relics||{}).reduce((a,b)=>a+b,0),c=this.ctx;
  RoutePaint.plate(c,254,12,151,57);RoutePaint.text(c,'РЕЛИКВИИ  '+total+' / 24',329,29,'#d9c495',10);
  RunRelics.permanent.filter(id=>!RunRelics.catalog[id].biome).forEach((id,i)=>{const n=RunRelics.rank(g.player,id);c.save();c.globalAlpha=n?1:.25;RelicUI.icon(c,id,270+i*23,51,13,RunRelics.catalog[id].color);c.restore();});
};
Renderer.prototype.drawRoomRelic=function(r){
  const g=this.g,c=this.ctx,p=r.rewardPoint,t=g.motionClock||0;
  ActorMotion.glow(c,p.x,p.y-20,54,'#e8c987',.16);ActorMotion.rune(c,p.x,p.y,24,t*.35,'#ebc988',.75);
  const y=p.y-24+Math.sin(t*2)*3;c.save();c.translate(p.x,y);c.strokeStyle='#fff0b6';c.lineWidth=1.5;c.fillStyle='#c29d56';
  c.beginPath();c.moveTo(0,-12);c.lineTo(8,0);c.lineTo(0,14);c.lineTo(-8,0);c.closePath();c.fill();c.stroke();c.beginPath();c.moveTo(0,-12);c.lineTo(0,14);c.stroke();c.restore();
  RoutePaint.text(c,'РЕЛИКВИЯ',p.x,p.y+31,'#f2dfac',10);
};
window.addEventListener('resize',()=>{const g=window.game;if(g?.state==='relic-choice')g.ui.showRelicChoice();});


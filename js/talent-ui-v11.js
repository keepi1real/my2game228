'use strict';
const TalentUI=(()=>{
  function layout(w,h,branch='assault'){
    const portrait=h>w,u=portrait?Math.min(w/720,h/1150):Math.min(w/1024,h/640),margin=portrait?40*u:42*u;
    const nodes=Object.values(AdventureProgress.nodes).filter(n=>!portrait||n.branch===branch);
    const top=(portrait?290:168)*u,cw=portrait?w-2*margin:(w-2*margin-32*u)/3,gap=(portrait?18:12)*u,ch=portrait?(h-top-170*u-3*gap)/4:86*u;
    const boxes=nodes.map(n=>({id:n.id,node:n,x:margin+(portrait?0:AdventureProgress.branches.findIndex(b=>b.id===n.branch)*(cw+16*u)),y:top+(n.tier-1)*(ch+gap),w:cw,h:ch}));
    if(portrait)AdventureProgress.branches.forEach((b,i)=>boxes.push({id:'branch-'+b.id,x:margin+i*(w-2*margin)/3,y:210*u,w:(w-2*margin)/3-6*u,h:54*u,branch:b}));
    boxes.push({id:'close',x:margin,y:h-85*u,w:w-2*margin,h:48*u});return {w,h,u,portrait,boxes,top};
  }
  function text(c,s,x,y,size,color='#e6dcc4',align='left'){c.font=size+'px Arial, sans-serif';c.fillStyle=color;c.textAlign=align;c.textBaseline='middle';c.fillText(s,x,y);}
  function wrap(c,s,x,y,width,size,color){c.font=size+'px Arial, sans-serif';let line='',row=0;for(const word of s.split(' ')){const next=line?line+' '+word:word;if(c.measureText(next).width>width&&line){text(c,line,x,y+row*size*1.35,size,color);line=word;row++;}else line=next;}text(c,line,x,y+row*size*1.35,size,color);}
  function paint(c,g){
    const L=g.talentLayout,{w,h,u,portrait}=L,p=g.player,t=p.talents;c.save();
    c.fillStyle='#08141c';c.fillRect(0,0,w,h);const gr=c.createRadialGradient(w*.65,h*.2,10,w*.65,h*.2,w*.9);gr.addColorStop(0,'rgba(74,66,95,.4)');gr.addColorStop(1,'rgba(9,21,27,0)');c.fillStyle=gr;c.fillRect(0,0,w,h);
    c.strokeStyle='#665b47';c.strokeRect(18*u,18*u,w-36*u,h-36*u);
    text(c,'ПУТЬ ГЕРОЯ · БОЙ НА ПАУЗЕ',w/2,44*u,12*u,'#bca679','center');text(c,p.hero.name+' · таланты',w/2,(portrait?95:78)*u,(portrait?36:28)*u,'#f0dfb5','center');
    text(c,'Очки: '+t.points+'  ·  Изучено: '+t.nodes.length+' / 9',w/2,(portrait?146:111)*u,(portrait?23:15)*u,'#d8c899','center');
    text(c,t.earned<9?'Следующее очко: '+(4-t.clears%4)+' зачистки':'Все 9 очков похода получены',w/2,(portrait?178:137)*u,(portrait?18:11)*u,'#a9b9b4','center');
    for(const b of L.boxes){
      if(b.branch){const selected=g.talentBranch===b.branch.id;c.fillStyle=selected?'#3c3a48':'#18252f';c.fillRect(b.x,b.y,b.w,b.h);text(c,b.branch.name,b.x+b.w/2,b.y+b.h/2,18*u,b.branch.color,'center');continue;}
      if(b.id==='close'){c.fillStyle='#273539';c.fillRect(b.x,b.y,b.w,b.h);text(c,'Вернуться в игру',w/2,b.y+b.h/2,(portrait?22:16)*u,'#e6dbc2','center');continue;}
      const n=b.node,owned=AdventureProgress.has(p,n.id),can=AdventureProgress.available(p,n.id),color=AdventureProgress.branches.find(v=>v.id===n.branch).color;
      if(n.tier>1){c.strokeStyle=owned?color:'#516064';c.lineWidth=2*u;c.beginPath();c.moveTo(b.x+26*u,b.y-14*u);c.lineTo(b.x+26*u,b.y);c.stroke();}
      c.fillStyle=owned?'#2b393b':can?'#22313c':'#111f29';c.fillRect(b.x,b.y,b.w,b.h);c.strokeStyle=owned||can?color:'#35464e';c.lineWidth=owned?2*u:u;c.strokeRect(b.x,b.y,b.w,b.h);
      const pad=portrait?25*u:13*u;text(c,(owned?'◆ ':n.tier+'. ')+n.name,b.x+pad,b.y+(portrait?32:19)*u,(portrait?25:16)*u,owned||can?color:'#95a4ac');
      wrap(c,n.detail,b.x+pad,b.y+(portrait?70:43)*u,b.w-pad*2,(portrait?21:12)*u,'#b9c5c7');
      if(portrait)text(c,owned?'ИЗУЧЕНО':can?'ИЗУЧИТЬ · 1 ОЧКО':n.requires&&!AdventureProgress.has(p,n.requires)?'НУЖЕН ПРЕДЫДУЩИЙ ТАЛАНТ':'НЕТ СВОБОДНЫХ ОЧКОВ',b.x+pad,b.y+b.h-22*u,13*u,owned?color:'#93a4ac');
    }
    if(!portrait)AdventureProgress.branches.forEach((b,i)=>text(c,b.name,42*u+i*(w-84*u)/3,155*u,10*u,b.color));
    if(portrait)text(c,'Выбор действует до конца похода',w/2,h-102*u,16*u,'#aab5b3','center');c.restore();
  }
  function closeCanvas(g){if(!g.talentLayout)return;g.talentLayout=null;g.canvas.width=VIEW_W;g.canvas.height=VIEW_H;if(g.canvas.style)g.canvas.style.cssText='';}
  return {layout,paint,closeCanvas};
})();
UI.prototype.showTalents=function(){
  const g=this.g;if(!g.journey?.seamless||!['run','paused','talents'].includes(g.state)||g.player.hp<=0)return false;
  g.state='talents';g.talentBranch=g.talentBranch||'assault';const size=FrontMenu.size(),L=TalentUI.layout(size.w,size.h,g.talentBranch);g.talentLayout=L;
  g.canvas.width=L.w;g.canvas.height=L.h;if(g.canvas.style)g.canvas.style.cssText='width:100vw;height:100vh;max-width:none;max-height:none;image-rendering:auto';
  g.input.keys={};g.input.pressed={};g.input.mouse.down=false;g.input.touch.attack=false;
  this.render(`<div class="front-surface" data-talents role="dialog" aria-modal="true" aria-label="Таланты героя. Бой на паузе">${L.boxes.map(b=>{const n=b.node,owned=n&&AdventureProgress.has(g.player,n.id),label=n?n.name+'. '+n.detail+(owned?' Изучено.':' Требуется: '+(n.requires?AdventureProgress.nodes[n.requires].name:'1 очко')):b.branch?b.branch.name:'Вернуться в игру';return `<button class="front-hit" data-talent="${b.id}" ${n&&!AdventureProgress.available(g.player,n.id)?'disabled':''} ${b.branch?`aria-pressed="${g.talentBranch===b.branch.id}"`:''} style="left:${b.x/L.w*100}%;top:${b.y/L.h*100}%;width:${b.w/L.w*100}%;height:${b.h/L.h*100}%" aria-label="${label}"><span class="front-sr">${label}</span></button>`;}).join('')}</div>`);
  this.bind('[data-talent]','click',el=>{const id=el.dataset.talent;if(id==='close')g.closeTalents();else if(id.startsWith('branch-')){g.talentBranch=id.slice(7);this.showTalents();}else AdventureProgress.learn(g,id);});g.saveJourney();return true;
};
Game.prototype.closeTalents=function(){if(this.state!=='talents')return false;TalentUI.closeCanvas(this);this.state='run';this.ui.hide();this.input.keys={};this.input.pressed={};this.input.mouse.down=false;Object.assign(this.input.touch,{attack:false,move:{x:0,y:0},stick:null,aimDrag:null,pressed:{}});return true;};
const talentHide=UI.prototype.hide,talentReset=Game.prototype.resetRunState,talentUpdate=Game.prototype.update,talentRender=Renderer.prototype.render;
UI.prototype.hide=function(){TalentUI.closeCanvas(this.g);return talentHide.call(this);};
Game.prototype.resetRunState=function(){TalentUI.closeCanvas(this);talentReset.call(this);};
Game.prototype.update=function(dt){
  if(this.state==='talents'){if(this.input.hit('Escape')||this.input.hit('KeyK')||this.input.tHit('pause'))this.closeTalents();this.input.endFrame();return;}
  if(this.journey?.seamless&&['run','paused'].includes(this.state)&&this.input.hit('KeyK')){this.ui.showTalents();this.input.endFrame();return;}return talentUpdate.call(this,dt);
};
Renderer.prototype.render=function(){if(this.g.state==='talents'&&this.g.talentLayout)return TalentUI.paint(this.ctx,this.g);talentRender.call(this);const g=this.g;if(!g.journey?.seamless||g.state!=='run')return;RoutePaint.plate(this.ctx,14,86,275,25);RoutePaint.text(this.ctx,'ТАЛАНТЫ: '+g.player.talents.points+' ОЧК. · K / ПАУЗА',151,99,'#e2c995',10);};
window.addEventListener('resize',()=>{if(window.game?.state==='talents')window.game.ui.showTalents();});

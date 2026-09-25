/* V20 P0 accessibility fixes. Load after design / other presentation modules. */
(() => {
  'use strict';
  if(window.V20Readability)return;
  const MIN_TARGET=44,PIP=7,GAP=3;
  const style=document.createElement('style');style.id='v20-readability-style';
  style.textContent=`
    #ui .front-surface .front-hit{min-width:44px;min-height:44px;box-sizing:border-box;touch-action:manipulation}
    #ui .front-surface .front-difficulty{box-sizing:border-box}
    #ui .front-surface .front-difficulty select{min-width:44px;min-height:44px;height:44px;box-sizing:border-box;font-size:16px;touch-action:manipulation}
    #ui .overlay .panel button,#ui .world-index button{min-width:44px;min-height:44px;box-sizing:border-box;touch-action:manipulation}
    @media(max-height:480px){#ui .overlay .panel{max-height:94dvh;overflow-y:auto}#ui .overlay .panel .footer-row{flex-wrap:wrap}}
  `;document.head.appendChild(style);
  const oldLayout=FrontMenu.layout;
  FrontMenu.layout=function(w,h,...args){
    const L=oldLayout.call(this,w,h,...args),sx=(window.innerWidth||w)/w,sy=(window.innerHeight||h)/h;
    // Update the shared drawing/hitbox geometry together: enlarged invisible
    // targets alone would overlap adjacent controls in the short landscape menu.
    const main=L.boxes.filter(b=>b.primary),secondary=L.boxes.filter(b=>!b.hero&&!b.primary),heroes=L.boxes.filter(b=>b.hero);
    const unit=1/sy,gap=8*unit;
    for(const b of L.boxes){b.w=Math.max(b.w,MIN_TARGET/sx);b.h=Math.max(b.h,MIN_TARGET*unit);}
    if(secondary.length){
      const sh=Math.max(...secondary.map(b=>b.h)),y=Math.min(...secondary.map(b=>b.y),h-32*unit-sh);
      for(const b of secondary)b.y=y;
      const mh=Math.max(...main.map(b=>b.h),MIN_TARGET*unit),my=Math.min(...main.map(b=>b.y),y-gap-mh);
      for(const b of main)b.y=my;
      L.difficulty.h=Math.max(L.difficulty.h,52*unit);
      L.difficulty.y=Math.min(L.difficulty.y,my-gap-L.difficulty.h);
      const hh=Math.max(...heroes.map(b=>b.h),MIN_TARGET*unit),hy=Math.min(...heroes.map(b=>b.y),L.difficulty.y-gap-hh);
      for(const b of heroes)b.y=hy;
      L.rosterY=hy;L.cardH=hh;
    }
    return L;
  };
  function scales(canvas,c){
    const r=canvas.getBoundingClientRect(),t=c.getTransform();
    return {x:Math.max(.001,Math.hypot(t.a*r.width/canvas.width,t.b*r.height/canvas.height)),
      y:Math.max(.001,Math.hypot(t.c*r.width/canvas.width,t.d*r.height/canvas.height))};
  }
  const oldEnemies=Renderer.prototype.drawEnemies;
  Renderer.prototype.drawEnemies=function(){
    const result=oldEnemies.apply(this,arguments),g=this.g,c=this.ctx;
    if(!g?.journey?.seamless||!g.canvas)return result;
    const {x:sx,y:sy}=scales(g.canvas,c);
    c.save();c.globalAlpha=1;
    for(const e of g.enemies||[]){
      const t=e.telegraph;if(!e.alive||!(t?.total>0)||!t.shapes?.length||!this.visibleAt(e.x,e.y))continue;
      const k=Math.max(0,Math.min(1,1-t.time/t.total)),width=(PIP*4+GAP*3)/sx,height=PIP/sy;
      const x=e.x-width/2,y=e.y+18-height/2;
      // 7 CSS px squares on every canvas scale, 3 px spacing, opaque contrasting plate.
      c.fillStyle='#07131f';c.fillRect(x-3/sx,y-3/sy,width+6/sx,height+6/sy);
      for(let n=0;n<4;n++){
        const px=x+n*(PIP+GAP)/sx;
        c.fillStyle=k>=(n+1)/4?'#ffe4b8':'#233d50';c.fillRect(px,y,PIP/sx,height);
        c.strokeStyle='#d1e2e8';c.lineWidth=1/sx;c.strokeRect(px+.5/sx,y+.5/sy,(PIP-1)/sx,(PIP-1)/sy);
      }
    }
    c.restore();return result;
  };
  window.V20Readability=Object.freeze({version:20,minTapCSS:MIN_TARGET,pipCSS:PIP,gapCSS:GAP,scales});
})();

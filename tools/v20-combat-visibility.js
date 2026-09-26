/* Presentation only; after readability/interactables. No persisted state. */
(() => {
  'use strict';
  if(window.V20CombatVisibility)return;
  const scopes=new WeakMap(),TAU=Math.PI*2;
  const metrics={frames:0,occlusionSignals:0,overlapSignals:0,shapeChecks:0};
  function covers(prop,player,top) {
    if(!prop||!player||!(prop.height>=80)||prop.y<=player.y)return false;
    const rect=BiomeArtV3.sprites[prop.sprite]?.rect;
    const width=rect?.[3]>0?rect[2]/rect[3]*prop.height:Math.max(24,(prop.r||20)*3);
    // Test the drawn torso, rather than only the collision disc at the feet.
    const half=Math.max(9,Math.min(20,player.r||12));
    return prop.x+width*.43>player.x-half && prop.x-width*.43<player.x+half &&
      prop.y-prop.height+9<player.y-8 && prop.y+9>top+12;
  }
  function threats(g) {
    const earliest=[];let count=0,checked=0;
    for(const enemy of g.enemies||[]) {
      const t=enemy.telegraph;
      if(!enemy.alive||t?.type!=='root'||t.kind==='summon'||!(t.total>0)||!(t.time>0))continue;
      let overlap=false;
      for(let i=0;i<Math.min(16,t.shapes?.length||0);i++) {
        const shape=t.shapes[i];
        checked++;
        if(RootCombat.contains(shape,g.player)){overlap=true;break;}
      }
      if(!overlap)continue;
      count++;
      // At most three visual tracks; sorting remains constant size.
      earliest.push({time:t.time,progress:Math.max(0,Math.min(1,1-t.time/t.total))});
      earliest.sort((a,b)=>a.time-b.time);if(earliest.length>3)earliest.pop();
    }
    return {count,earliest,checked};
  }
  function signal(c,p,top,occluded,danger) {
    c.save();
    try {
      c.globalAlpha=1;c.setLineDash([]);c.lineJoin='round';
      if(occluded) {
        // Small x-ray locator, not a second sprite: keep attack poses legible.
        for(const [color,width] of [['#07131f',5],['#b8f4e5',2]]) {
          c.strokeStyle=color;c.lineWidth=width;c.beginPath();
          c.ellipse(p.x,p.y,Math.max(15,p.r+4),7,0,0,TAU);
          c.moveTo(p.x-7,top+12);c.lineTo(p.x,top+5);c.lineTo(p.x+7,top+12);
          c.stroke();
        }
      }
      if(danger.count>=2) {
        // Consolidate overlapping zones into distinct timings without another
        // floor fill. Counts describe geometry, not a guarantee of damage/LOS.
        const y=p.y+29;
        c.fillStyle='#081521';c.beginPath();c.arc(p.x,y,12,0,TAU);c.fill();
        c.fillStyle='#ffe7bd';c.font='bold 12px sans-serif';c.textAlign='center';c.textBaseline='middle';
        c.fillText(danger.count>9?'9+':String(danger.count),p.x,y);
        danger.earliest.forEach((entry,i)=>{
          const radius=15+i*4;c.lineWidth=2;c.strokeStyle='#07131f';c.beginPath();c.arc(p.x,y,radius,0,TAU);c.stroke();
          c.strokeStyle=['#fff1cf','#ffc895','#f7a4a4'][i];c.beginPath();
          c.arc(p.x,y,radius,-Math.PI/2,-Math.PI/2+TAU*entry.progress);c.stroke();
        });
      }
    } finally {c.restore();}
  }
  const prop=BiomeArtV3.prop;
  BiomeArtV3.prop=function(c,o,player,...args) {
    const state=scopes.get(c);
    if(state&&!state.occluded&&covers(o,player,state.top))state.occluded=true;
    return prop.call(this,c,o,player,...args);
  };
  const world=Renderer.prototype.drawSeamlessWorld;
  Renderer.prototype.drawSeamlessWorld=function(...args) {
    const g=this.g,c=this.ctx,p=g.player;
    if(g.journey?.v20MapVersion!==20||!p||!(p.hp>0))return world.apply(this,args);
    const previous=scopes.get(c),state={occluded:false,top:this.bodyTop('heroes',g.hero.id,p,p.r)};
    scopes.set(c,state);let result;
    try {result=world.apply(this,args);} finally {if(previous)scopes.set(c,previous);else scopes.delete(c);}
    const danger=threats(g);metrics.frames++;metrics.shapeChecks+=danger.checked;
    if(state.occluded||danger.count>=2)signal(c,p,state.top,state.occluded,danger);
    if(state.occluded)metrics.occlusionSignals++;
    if(danger.count>=2)metrics.overlapSignals++;
    return result;
  };
  window.V20CombatVisibility=Object.freeze({version:20,covers,threats,metrics});
})();

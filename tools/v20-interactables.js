/* V20 interactable silhouettes. Original ceramic material studies, no new images.
 * Install after presentation patches. Only rendering changes: all interaction
 * positions, ranges, locks, rewards and saved flags remain owned by the game. */
(() => {
 'use strict';if(window.V20Interactables)return;
 const TAU=Math.PI*2,scope=new WeakMap();
 const materials=Object.freeze({
  roots:Object.freeze({body:'#29483d',side:'#152d2b',rim:'#9abb8e',trim:'#c9b781',motif:'fiber'}),
  bastion:Object.freeze({body:'#465365',side:'#232d3c',rim:'#bcc7ca',trim:'#d3af73',motif:'rivet'}),
  forge:Object.freeze({body:'#52434a',side:'#2c2733',rim:'#b1a8a0',trim:'#d0a16c',motif:'vent'})
 });
 const fallback=materials.bastion;
 function roomFor(g,o){return g?.journey?.rooms?.find(r=>r.id===o?.homeRoom)||g?.journey?.rooms?.find(r=>r.restPoint===o)||g?.journey?.rooms?.[g.journey.current];}
 function material(g,o){return materials[roomFor(g,o)?.biome]||fallback;}
 function poly(c,pts,fill,stroke){c.beginPath();pts.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fillStyle=fill;c.fill();if(stroke){c.strokeStyle=stroke;c.stroke();}}
 function shadow(c,x,y,r){c.fillStyle='rgba(3,9,16,.5)';c.beginPath();c.ellipse(x+3,y+5,r,r*.25,0,0,TAU);c.fill();}
 function marks(c,m,x,y,width){
  c.save();c.translate(x,y);c.strokeStyle=m.trim;c.lineWidth=1.6;c.beginPath();
  if(m.motif==='fiber'){for(let i=-1;i<=1;i++){c.moveTo(i*width*.24-4,5);c.quadraticCurveTo(i*width*.24+5,0,i*width*.24,-5);}}
  else if(m.motif==='vent'){for(let i=-2;i<=2;i++){c.moveTo(i*width*.15-2,-4);c.lineTo(i*width*.15+2,4);}}
  else{for(const dx of [-width*.35,width*.35]){c.moveTo(dx,-5);c.lineTo(dx,5);c.moveTo(dx-3,-3);c.lineTo(dx+3,-3);}}
  c.stroke();c.restore();
 }
 function badge(c,x,y,kind,on){
  c.save();c.translate(x,y);c.fillStyle='#0b1922';c.strokeStyle=on?'#f5ecd2':'#98a5ad';c.lineWidth=2;
  c.beginPath();c.roundRect(-9,-10,18,20,3);c.fill();c.stroke();c.strokeStyle=on?'#f5ecd2':'#98a5ad';c.lineWidth=2.5;c.beginPath();
  if(kind==='heal'){c.moveTo(-5,0);c.lineTo(5,0);c.moveTo(0,-5);c.lineTo(0,5);}
  else if(kind==='lock'){c.moveTo(-4,0);c.lineTo(-4,-3);c.arc(0,-3,4,Math.PI,0);c.lineTo(4,0);c.rect(-5,0,10,6);}
  else if(kind==='used'){c.moveTo(-5,0);c.lineTo(-1,4);c.lineTo(5,-4);}
  else{c.moveTo(0,-6);c.lineTo(5,0);c.lineTo(0,6);c.lineTo(-5,0);c.closePath();}
  c.stroke();c.restore();
 }
 function chest(c,o,m,locked){
  c.save();c.translate(o.x,o.y);c.lineWidth=1.7;shadow(c,0,0,36);
  // Low, wide six-sided body; the visible lid state is independent of light.
  poly(c,[[-33,-20],[23,-20],[33,-12],[33,3],[-24,9],[-33,1]],m.side,m.rim);
  poly(c,[[-33,-20],[23,-20],[23,0],[-24,7],[-33,1]],m.body,m.rim);
  if(o.opened){
   poly(c,[[-31,-23],[-25,-40],[28,-40],[24,-23]],m.body,m.rim);
   poly(c,[[-27,-19],[22,-19],[28,-13],[-23,-7]],'#101d25',m.trim);
  }else poly(c,[[-33,-20],[-24,-31],[29,-31],[34,-22],[23,-15]],m.body,m.trim);
  marks(c,m,-3,-4,49);
  if(!o.opened){c.fillStyle=locked?'#95a3ac':'#e9c27c';c.fillRect(-5,-19,10,14);badge(c,0,-37,locked?'lock':'loot',!locked);}
  else{c.strokeStyle='#a1b0ad';c.lineWidth=2;c.beginPath();c.moveTo(-4,-33);c.lineTo(0,-29);c.lineTo(8,-36);c.stroke();}
  c.restore();
 }
 function shrine(c,q,used,m){
  c.save();c.translate(q.x,q.y);c.lineWidth=1.7;shadow(c,0,0,30);
  // Vertical branching vessel: distinct from the horizontal reward cassette.
  poly(c,[[-18,-5],[0,-11],[18,-5],[12,3],[-12,3]],m.side,m.rim);
  poly(c,[[-8,-7],[-7,-26],[7,-26],[8,-7],[0,-3]],m.body,m.trim);
  poly(c,[[-25,-44],[-15,-48],[-8,-34],[0,-28],[8,-34],[15,-48],[25,-44],[19,-24],[0,-17],[-19,-24]],m.body,m.rim);
  c.fillStyle=used?'#475b5b':'#91d8c8';c.beginPath();c.ellipse(0,-28,17,5,0,0,TAU);c.fill();
  marks(c,m,0,-14,25);badge(c,0,-50,used?'used':'heal',!used);
  if(!used){c.strokeStyle='#b6f1dd';c.lineWidth=2;c.beginPath();c.moveTo(-19,-34);c.lineTo(-22,-42);c.moveTo(19,-34);c.lineTo(22,-42);c.stroke();}
  c.restore();
 }
 function exit(c,x,y,m){
  c.save();c.translate(x+16,y+20);c.lineWidth=1;
  shadow(c,0,5,22);
  for(let i=0;i<4;i++){const yy=i*5-10,ww=13+i*2;poly(c,[[-ww,yy],[ww,yy],[ww+2,yy+5],[-ww-2,yy+5]],i%2?m.body:m.side,m.rim);}
  // Paired bright posts, open center and downward chevrons identify the route.
  for(const sign of [-1,1]){const xx=sign*21;poly(c,[[xx-3,-23],[xx+3,-26],[xx+3,7],[xx-3,10]],m.side,m.trim);c.strokeStyle='#dfefdc';c.lineWidth=1.7;c.beginPath();c.moveTo(xx,-21);c.lineTo(xx,1);c.stroke();}
  c.strokeStyle='#e5f3d7';c.lineWidth=1.7;c.beginPath();for(const yy of [-10,-3]){c.moveTo(-5,yy);c.lineTo(0,yy+4);c.lineTo(5,yy);}c.stroke();c.restore();
 }
 const oldWorld=Renderer.prototype.drawSeamlessWorld;
 Renderer.prototype.drawSeamlessWorld=function(){
  const c=this.ctx,g=this.g,previous=scope.get(c);
  if(g?.journey?.v20MapVersion===20)scope.set(c,g);
  try{return oldWorld.apply(this,arguments);}finally{if(previous)scope.set(c,previous);else scope.delete(c);}
 };
 const oldChest=RoutePaint.chest,oldShrine=RoutePaint.shrine,oldStairs=Renderer.prototype.drawStairs;
 RoutePaint.chest=function(c,o,time,locked){const g=scope.get(c);if(!g)return oldChest.apply(this,arguments);chest(c,o,material(g,o),locked);};
 RoutePaint.shrine=function(c,q,used,time){const g=scope.get(c);if(!g)return oldShrine.apply(this,arguments);shrine(c,q,used,material(g,q));};
 Renderer.prototype.drawStairs=function(x,y,open){if(this.g?.journey?.v20MapVersion!==20||!open)return oldStairs.apply(this,arguments);exit(this.ctx,x,y,material(this.g,{homeRoom:15}));};
 window.V20Interactables=Object.freeze({version:20,materials,paint:Object.freeze({chest,shrine,exit}),features:Object.freeze(['wide-reward-cassette','branching-heal-vessel','paired-exit-posts','shape-coded-state','three-biome-materials'])});
})();

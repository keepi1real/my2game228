/* Original v20 map presentation: glazed terraces / inlaid light.
 * Install after v20-design and v20-map-placement. Ground-only accents stay below
 * actors and telegraphs; existing props retain their geometry and colliders. */
(() => {
  'use strict';
  if (window.V20MapArt) return;
  const TAU=Math.PI*2;
  const profiles=Object.freeze({
    roots:    {base:'#193f38',edge:'#9abf91',light:'#b5dbc0',motif:'reed',beam:-.36},
    bastion:  {base:'#363c47',edge:'#c9b78b',light:'#d8cbb1',motif:'plate',beam:.22},
    forge:    {base:'#422d35',edge:'#c58b63',light:'#e8b681',motif:'vent',beam:-.55},
    eclipse:  {base:'#252e50',edge:'#acb1db',light:'#b8c9e9',motif:'orbit',beam:.42},
    rootvault:{base:'#3d382a',edge:'#ba966f',light:'#d3bf8c',motif:'vein',beam:-.28},
    storm:    {base:'#224658',edge:'#a4ccd8',light:'#d1e9ed',motif:'ice',beam:.58},
    tide:     {base:'#194b4c',edge:'#88c9bd',light:'#afe1d1',motif:'wave',beam:-.46},
    sunforge: {base:'#4b3730',edge:'#d7ac76',light:'#f0d5a2',motif:'vent',beam:.34},
    amber:    {base:'#493c29',edge:'#d6b877',light:'#e4cf98',motif:'resin',beam:-.3},
    glass:    {base:'#303b53',edge:'#bfc7e1',light:'#d2e0ef',motif:'shard',beam:.5},
    citadel:  {base:'#343f43',edge:'#cdb67e',light:'#dbd3b3',motif:'plate',beam:-.42},
    ashen:    {base:'#382f40',edge:'#ac9299',light:'#cdb9c6',motif:'ash',beam:.27}
  });
  const rgb=(h,a)=>`rgba(${parseInt(h.slice(1,3),16)},${parseInt(h.slice(3,5),16)},${parseInt(h.slice(5,7),16)},${a})`;
  const active=g=>g?.journey?.v20MapVersion===20;
  const scope=new WeakMap(),roomBounds=new WeakMap();
  const metrics={rooms:0,marks:0,props:0};
  const inView=(x,y,v,pad=36)=>x>=v.x-pad&&x<=v.x+v.w+pad&&y>=v.y-pad&&y<=v.y+v.h+pad;
  function bounds(r){
    if(roomBounds.has(r))return roomBounds.get(r);
    let x=Infinity,y=Infinity,right=-Infinity,bottom=-Infinity;
    for(const poly of r.polygons||[])for(const p of poly){x=Math.min(x,p[0]);y=Math.min(y,p[1]);right=Math.max(right,p[0]);bottom=Math.max(bottom,p[1]);}
    const b={x,y,w:right-x,h:bottom-y};roomBounds.set(r,b);return b;
  }
  function clip(c,r){c.beginPath();for(const poly of r.polygons){poly.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();}c.clip();}
  function facet(c,points,fill,stroke){
    c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();
    c.fillStyle=fill;c.fill();if(stroke){c.strokeStyle=stroke;c.stroke();}
  }
  function motif(c,p,m){
    const extent=Math.max(1,Math.min(Number.isFinite(m.radius)?m.radius:22*(m.scale||1),22*(m.scale||1)));
    c.save();c.translate(m.x,m.y);c.rotate(m.angle||0);c.scale(extent/22,extent/22);
    c.lineWidth=1.2;c.strokeStyle=rgb(p.edge,.38);
    const fill=rgb(p.base,.65),edge=rgb(p.edge,.35),v=m.variant||0;
    // Every motif fits a disc of radius 22; no drawing can escape placement margins.
    if(p.motif==='plate'){
      facet(c,[[-17,-8],[11,-8],[17,0],[11,8],[-17,8]],fill,edge);
      c.beginPath();c.moveTo(-10,-4);c.lineTo(8,-4);c.moveTo(-10,4);c.lineTo(8,4);c.stroke();
      c.fillStyle=rgb(p.edge,.42);c.fillRect(-14,-1,2,2);c.fillRect(11,-1,2,2);
    }else if(p.motif==='shard'||p.motif==='ice'){
      facet(c,[[-17,5],[-2,-11],[5,5]],fill,edge);
      facet(c,[[1,10],[9,-9],[18,4]],rgb(p.edge,.11),edge);
      c.beginPath();c.moveTo(-2,-11);c.lineTo(-4,3);c.moveTo(9,-9);c.lineTo(10,6);c.stroke();
    }else if(p.motif==='reed'||p.motif==='vein'){
      c.lineWidth=p.motif==='vein'?2:1.2;c.beginPath();
      for(let i=0;i<4;i++){const x=i*7-11;c.moveTo(x,8);c.quadraticCurveTo(x-5,0,x+(i%2?5:-5),-9);}
      c.stroke();c.lineWidth=1;c.strokeStyle=rgb(p.light,.25);c.beginPath();c.moveTo(-15,10);c.quadraticCurveTo(1,-1,16,-6);c.stroke();
    }else if(p.motif==='orbit'||p.motif==='wave'){
      c.beginPath();
      for(let i=0;i<3;i++){c.ellipse(0,i*5-5,17-i*3,4,0,.15,Math.PI-.15);}
      c.stroke();
      if(p.motif==='orbit'){c.fillStyle=rgb(p.edge,.45);c.beginPath();c.arc(-12,-6,2,0,TAU);c.fill();}
    }else if(p.motif==='resin'){
      facet(c,[[-16,-3],[-7,-10],[4,-4],[9,8],[-9,10]],fill,edge);
      facet(c,[[6,-9],[16,-4],[12,4]],rgb(p.edge,.18),edge);
      c.beginPath();c.moveTo(-7,-7);c.lineTo(-2,5);c.stroke();
    }else if(p.motif==='vent'){
      facet(c,[[-18,-8],[14,-8],[18,8],[-14,8]],fill,edge);
      c.lineWidth=2;c.beginPath();for(let i=0;i<4;i++){c.moveTo(-10+i*6,-4);c.lineTo(-12+i*6,4);}c.stroke();
      c.strokeStyle=rgb(p.light,.42);c.lineWidth=1;c.beginPath();c.moveTo(-10,-4);c.lineTo(8,-4);c.stroke();
    }else{
      c.beginPath();for(let i=0;i<5;i++){const x=i*6-12;c.moveTo(x,-4+(i%2)*3);c.lineTo(x+3,4);}c.stroke();
      facet(c,[[-9,8],[-2,4],[4,9]],fill,edge);
    }
    // One reflected edge ties different materials to the same lighting direction.
    if(m.kind==='cluster' && v%2===0){c.strokeStyle=rgb(p.light,.2);c.beginPath();c.moveTo(-11,12);c.lineTo(8,12);c.stroke();}
    c.restore();
  }
  function roomLight(c,r,p,b){
    // Off-centre broad illumination, not a bright circle resembling an attack.
    const left=b.x+b.w*.14,right=b.x+b.w*.86,top=b.y+b.h*.12;
    const gradient=c.createLinearGradient(left,top,right,b.y+b.h*.8);
    gradient.addColorStop(0,rgb(p.light,.095));gradient.addColorStop(.48,rgb(p.base,.025));gradient.addColorStop(1,rgb(p.base,.12));
    c.fillStyle=gradient;c.fillRect(b.x,b.y,b.w,b.h);
    // A pair of quiet light strips only at the flanks, leaving the central fight clear.
    c.save();c.translate(r.center.x,r.center.y);c.rotate(p.beam);
    const span=Math.max(b.w,b.h),offset=Math.min(b.w*.35,300);
    for(const sign of [-1,1]){
      const x=sign*offset;c.fillStyle=rgb(p.light,.035);
      c.beginPath();c.moveTo(x-15,-span);c.lineTo(x+8,-span);c.lineTo(x+34,span);c.lineTo(x-2,span);c.closePath();c.fill();
    }
    c.restore();
  }
  const oldGround=BiomeArtV3.ground;
  BiomeArtV3.ground=function(c,g,rooms,corridors,view){
    scope.set(c,active(g));const result=oldGround.apply(this,arguments);
    metrics.rooms=metrics.marks=metrics.props=0;if(!active(g))return result;
    for(const room of rooms){
      const p=profiles[room.biome];if(!p||!room.polygons?.length)continue;
      const b=bounds(room);if(b.x>view.x+view.w||b.y>view.y+view.h||b.x+b.w<view.x||b.y+b.h<view.y)continue;
      c.save();clip(c,room);roomLight(c,room,p,b);metrics.rooms++;
      for(const m of window.V20MapPlacement?.forRoom(g.journey,room)||[]){if(!inView(m.x,m.y,view,m.radius||36))continue;motif(c,p,m);metrics.marks++;}
      c.restore();
    }
    return result;
  };
  const oldProp=BiomeArtV3.prop;
  BiomeArtV3.prop=function(c,o,player,time){
    const p=profiles[o?.biome];
    if(scope.get(c)&&p&&o.kind==='biome-prop'){
      const r=Math.max(8,Math.min(38,o.r||18));
      c.save();c.fillStyle='rgba(6,13,20,.19)';c.beginPath();c.ellipse(o.x+r*.27,o.y+8,r*1.2,r*.27,-.12,0,TAU);c.fill();
      c.fillStyle=rgb(p.base,.45);c.beginPath();c.ellipse(o.x,o.y+3,r*.83,r*.18,0,0,TAU);c.fill();c.restore();metrics.props++;
    }
    return oldProp.apply(this,arguments);
  };
  window.V20MapArt=Object.freeze({version:20,profiles,metrics,
    features:Object.freeze(['twelve-material-motifs','clipped-flank-light','placement-aware-decals','directional-contact-shadows'])});
})();

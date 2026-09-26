/* Presentation only. After v20-matte-floor, before v20-combat-visibility.
 * Geometry, collider radii, game RNG and saved state are never modified. */
(() => {
  'use strict';
  if (window.V21TideObservatoryArt) return;
  const BIOME='tideobservatory', TAU=Math.PI*2;
  const palette=Object.freeze({floor:'#24343d',slate:'#344b55',side:'#172933',top:'#61777b',brass:'#b49a67',water:'#7bb9b1'});
  const metrics={rooms:0,props:0,faded:0},scopes=new WeakMap(),cache=new WeakMap();
  const roles=Object.freeze({start:2,combat:3,elite:5,treasure:2,rest:1,boss:7,event:3});
  const instruments=Object.freeze({tidepillar:'gauge',tidebasin:'basin',tidescholar:'vane',tideshelves:'register'});
  function bounds(room){
    if(cache.has(room))return cache.get(room);
    const points=room.polygons.flat(),xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
    const b={x:Math.min(...xs),y:Math.min(...ys),right:Math.max(...xs),bottom:Math.max(...ys)};
    cache.set(room,b);return b;
  }
  function polygon(c,points,fill){c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fillStyle=fill;c.fill();}
  function clip(c,room){c.beginPath();for(const p of room.polygons){p.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();}c.clip();}
  function gauge(c,x,y,size,count){
    // Open measuring arcs, flat inlaid metal: never a closed attack circle.
    c.save();c.translate(x,y);c.strokeStyle='rgba(180,154,103,.26)';c.lineWidth=2;
    for(let i=0;i<2;i++){c.beginPath();c.ellipse(0,0,size-i*9,(size-i*9)*.36,0,Math.PI*1.12,Math.PI*1.86);c.stroke();}
    c.lineWidth=1;
    for(let i=0;i<count;i++){const a=Math.PI*(1.16+.64*i/Math.max(1,count-1));c.beginPath();c.moveTo(Math.cos(a)*(size+4),Math.sin(a)*(size+4)*.36);c.lineTo(Math.cos(a)*(size+12),Math.sin(a)*(size+12)*.36);c.stroke();}
    c.restore();
  }
  function floor(c,room,b){
    const w=b.right-b.x,h=b.bottom-b.y,cx=room.center.x,cy=room.center.y;
    // Broad opaque matte cover suppresses legacy tide ornaments at the centre.
    c.fillStyle=palette.floor;c.fillRect(b.x,b.y,w,h);
    const light=c.createLinearGradient(b.x,b.y,b.right,b.bottom);
    light.addColorStop(0,'rgba(124,165,165,.12)');light.addColorStop(1,'rgba(6,16,23,.12)');c.fillStyle=light;c.fillRect(b.x,b.y,w,h);
    // Dry recessed channels at the flanks. They are flush with the walkable floor.
    for(const sign of [-1,1]){
      const x=cx+sign*w*.34;
      polygon(c,[[x-10,b.y+28],[x+10,b.y+28],[x+10,b.bottom-28],[x-10,b.bottom-28]],'#1e3039');
      c.strokeStyle='rgba(123,185,177,.14)';c.lineWidth=1;c.beginPath();c.moveTo(x-9,b.y+28);c.lineTo(x-9,b.bottom-28);c.stroke();
      for(let i=0;i<4;i++){const y=b.y+h*(.21+i*.19);c.fillStyle='rgba(180,154,103,.2)';c.fillRect(x-13,y,26,3);}
    }
    // A small number of large slab joints; no grid under the player.
    c.strokeStyle='rgba(5,16,23,.25)';c.lineWidth=2;c.beginPath();
    c.moveTo(b.x,cy-h*.28);c.lineTo(cx-w*.2,cy-h*.28);
    c.moveTo(cx+w*.19,cy+h*.29);c.lineTo(b.right,cy+h*.29);c.stroke();
    const count=roles[room.role]||3;
    gauge(c,cx,b.y+h*.17,Math.min(120,w*.19),count);
    if(room.role==='boss'||room.role==='elite')gauge(c,cx,b.bottom-h*.08,Math.min(150,w*.23),count);
    if(room.role==='rest'){
      c.fillStyle='rgba(123,185,177,.08)';c.fillRect(b.x+w*.1,b.y+h*.21,Math.min(90,w*.16),h*.12);
    }
    if(room.role==='treasure'){
      for(let i=0;i<3;i++){c.fillStyle='rgba(180,154,103,.18)';c.fillRect(b.right-w*.21+i*7,cy-h*.25,3,24-i*5);}
    }
  }
  const ground=BiomeArtV3.ground;
  BiomeArtV3.ground=function(c,g,rooms,corridors,view){
    const active=g?.journey?.v21MapVersion===21;scopes.set(c,active?g.journey:null);
    const result=ground.apply(this,arguments);metrics.rooms=metrics.props=metrics.faded=0;
    if(!active)return result;
    for(const room of rooms){
      if(room.biome!==BIOME||!room.polygons?.length)continue;
      const b=bounds(room);
      if(b.x>view.x+view.w||b.y>view.y+view.h||b.right<view.x||b.bottom<view.y)continue;
      c.save();try{clip(c,room);floor(c,room,b);metrics.rooms++;}finally{c.restore();}
    }
    return result;
  };
  const prop=BiomeArtV3.prop;
  BiomeArtV3.prop=function(c,o,player,time){
    const journey=scopes.get(c),alias=o?.sprite==='landmark-v15-tideobservatory';
    if(!journey||o?.biome!==BIOME||!(o.kind==='biome-prop'||o.landmark||instruments[o.sprite]||alias))return prop.apply(this,arguments);
    // RoomCraft aliases landmark sprites. Recover their original room design so
    // the four instruments retain distinct silhouettes after the runtime alias.
    const original=alias?journey.rooms?.find(room=>room.id===o.homeRoom)?.design?.landmark:o.sprite;
    const family=instruments[original]||(alias?'vane':'gauge');
    const r=Math.max(8,o.r||18),heightLimit=family==='basin'?48:family==='register'?78:106;
    const h=Math.min(heightLimit,Math.max(32,o.height||70)),x=o.x,y=o.y;
    c.save();try{
      c.fillStyle='rgba(4,12,19,.3)';c.beginPath();c.ellipse(x+r*.3,y+5,r*1.1,r*.38,0,0,TAU);c.fill();
      // Match the existing transparency behavior using the new drawn silhouette.
      if(player&&player.y<y+5&&player.y>y-h-12&&Math.abs(player.x-x)<r+18){c.globalAlpha*=.32;metrics.faded++;}
      polygon(c,[[x-r,y-6],[x,y+r*.42],[x,y-h],[x-r,y-h-r*.42]],palette.slate);
      polygon(c,[[x,y+r*.42],[x+r,y-6],[x+r,y-h-r*.42],[x,y-h]],palette.side);
      polygon(c,[[x-r,y-h-r*.42],[x,y-h-r*.84],[x+r,y-h-r*.42],[x,y-h]],palette.top);
      // Vertical calibrated brass spine identifies the original instrument family.
      c.strokeStyle=palette.brass;c.lineWidth=2;c.beginPath();c.moveTo(x-r*.52,y-12);c.lineTo(x-r*.52,y-h+5);c.stroke();
      c.lineWidth=1;for(let i=0;i<5;i++){const yy=y-17-i*(h-24)/5;c.beginPath();c.moveTo(x-r*.52,yy);c.lineTo(x-r*.52+(i%2?4:7),yy);c.stroke();}
      c.strokeStyle=palette.water;c.lineWidth=2;c.beginPath();c.moveTo(x-r*.6,y-h+11);c.lineTo(x-r*.15,y-h+17);c.stroke();
      // Wide existing landmarks become paired tide vanes on the same base.
      if(family==='basin'){
        // A low dry calibration bowl: an inset top, not a pillar or a water hazard.
        polygon(c,[[x-r*.7,y-h-r*.42],[x,y-h-r*.68],[x+r*.7,y-h-r*.42],[x,y-h-r*.16]],palette.side);
        c.strokeStyle=palette.brass;c.lineWidth=2;c.beginPath();c.moveTo(x-r*.72,y-h-r*.42);c.lineTo(x,y-h-r*.14);c.lineTo(x+r*.72,y-h-r*.42);c.stroke();
      }else if(family==='register'){
        // Stacked measuring ledgers remain a broad, low cabinet.
        for(let i=1;i<=3;i++){const yy=y-h+h*i/4;c.strokeStyle=palette.brass;c.lineWidth=2;c.beginPath();c.moveTo(x-r*.8,yy-5);c.lineTo(x,yy+r*.27);c.lineTo(x+r*.8,yy-5);c.stroke();}
      }else if(family==='vane'||o.landmark||r>=28){
        c.strokeStyle=palette.brass;c.lineWidth=3;c.beginPath();c.ellipse(x,y-h*.64,r*.85,h*.24,-.25,Math.PI*1.06,Math.PI*1.89);c.stroke();
        c.lineWidth=1;c.strokeStyle=palette.top;c.beginPath();c.moveTo(x-r*.65,y-h*.82);c.lineTo(x+r*.7,y-h*.47);c.stroke();
      }
      metrics.props++;
    }finally{c.restore();}
  };
  window.V21TideObservatoryArt=Object.freeze({version:21,biome:BIOME,palette,roles,metrics});
})();

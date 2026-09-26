/* Presentation only. After v20-matte-floor, before v20-combat-visibility.
 * Geometry, collider radii, game RNG and saved state are never modified. */
(() => {
  'use strict';
  if (window.V21TideObservatoryArt) return;
  const BIOME='tideobservatory', TAU=Math.PI*2;
  const palette=Object.freeze({floor:'#24343d',slate:'#344b55',side:'#172933',top:'#61777b',brass:'#b49a67',water:'#7bb9b1'});
  const metrics={rooms:0,props:0,faded:0,roleMarks:0,landmarks:0},scopes=new WeakMap(),cache=new WeakMap();
  const roles=Object.freeze({start:2,combat:3,elite:5,treasure:2,rest:1,boss:7,event:3});
  // Broad flank silhouettes carry room identity at gameplay zoom. All are
  // flush service inlays, with no new obstacles or markings in the fight lane.
  const serviceLayouts={
    start:{rows:[.25,.60],width:.16,height:.22,cut:10,ink:'#30464e',marks:1},
    combat:{rows:[.22,.43,.64],width:.18,height:.13,cut:5,ink:'#354950',marks:3},
    elite:{rows:[.29,.61],width:.19,height:.24,cut:24,ink:'#3b484b',marks:2},
    treasure:{rows:[.20,.36,.52,.68],width:.15,height:.10,cut:7,ink:'#414b4b',marks:4},
    rest:{rows:[.43],width:.20,height:.48,cut:28,ink:'#304e52',marks:1},
    boss:{rows:[.25,.63],width:.22,height:.27,cut:30,ink:'#3b4c53',marks:5},
    event:{rows:[.21,.45,.69],width:.14,height:.17,cut:18,ink:'#344b51',marks:2}
  };
  const instruments=Object.freeze({tidepillar:'gauge',tidebasin:'basin',tidescholar:'vane',tideshelves:'register',tidewall:'sluice',cistern:'basin',wall:'sluice',armory:'register'});
  function roleSign(c,role,x,y,sx,sy){
    c.save();c.translate(x,y);c.scale(sx,sy);c.lineWidth=2.5;c.beginPath();
    if(role==='rest'){
      c.moveTo(-26,-22);c.bezierCurveTo(-27,25,27,25,26,-22);c.moveTo(-16,-28);c.lineTo(-6,7);c.moveTo(16,-28);c.lineTo(6,7);
    }else if(role==='treasure'){
      for(let i=0;i<3;i++){const yy=i*13-20;c.moveTo(-27,yy);c.lineTo(0,yy+11);c.lineTo(27,yy);}
    }else if(role==='combat'){
      for(let i=0;i<3;i++){const xx=(i-1)*20;c.moveTo(xx,23);c.lineTo(xx,-28+Math.abs(i-1)*14);c.lineTo(xx+7,-24+Math.abs(i-1)*14);}
    }else if(role==='elite'){
      c.moveTo(-26,20);c.lineTo(22,-24);c.lineTo(6,-24);c.moveTo(26,20);c.lineTo(-22,-24);c.lineTo(-6,-24);c.moveTo(-28,28);c.lineTo(28,28);
    }else if(role==='boss'){
      c.ellipse(0,0,31,30,0,Math.PI*.87,Math.PI*2.13);c.moveTo(-22,-22);c.lineTo(0,10);c.lineTo(22,-22);c.moveTo(0,-32);c.lineTo(0,27);
    }else if(role==='event'){
      c.ellipse(0,0,29,25,-.3,Math.PI*.65,Math.PI*1.9);c.moveTo(-22,18);c.lineTo(26,-18);c.moveTo(-8,-22);c.lineTo(12,22);
    }else{
      c.moveTo(-25,-26);c.lineTo(-25,22);c.lineTo(25,22);c.lineTo(25,-26);c.moveTo(0,22);c.lineTo(0,-31);
      for(let i=0;i<5;i++){c.moveTo(0,-23+i*8);c.lineTo(i%2?11:17,-23+i*8);}
    }
    c.stroke();c.restore();
  }
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
    c.save();c.translate(x,y);c.strokeStyle='rgba(180,154,103,.46)';c.lineWidth=2;
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
    // Large slate maintenance plates, confined to the flanks. Their bevel is
    // flush inlay rather than a raised obstacle. Broad scale survives zoom-out.
    const service=serviceLayouts[room.role]||serviceLayouts.start;
    for(const side of [-1,1])for(let i=0;i<service.rows.length;i++){
      const stagger=room.role==='event'?side*(i%2?.018:-.018)*w:0;
      const px=cx+side*w*.39+stagger,py=b.y+h*service.rows[i],pw=Math.min(158,w*service.width),ph=Math.min(240,h*service.height),cut=Math.min(service.cut,pw*.3,ph*.3);
      polygon(c,[[px-pw*.5+cut,py-ph*.5],[px+pw*.5,py-ph*.5],[px+pw*.5,py+ph*.5-cut],[px+pw*.5-cut,py+ph*.5],[px-pw*.5,py+ph*.5],[px-pw*.5,py-ph*.5+cut]],service.ink);
      c.strokeStyle='rgba(143,173,172,.22)';c.lineWidth=1;c.beginPath();c.moveTo(px-pw*.5+cut,py-ph*.5+2);c.lineTo(px+pw*.5-3,py-ph*.5+2);c.stroke();
      // Sparse brass register bars distinguish long stilling beds, slotted
      // sluice covers and archive drawers without resembling attack telegraphs.
      c.fillStyle='rgba(180,154,103,.25)';
      for(let mark=0;mark<service.marks;mark++){
        const my=py+ph*((mark+1)/(service.marks+1)-.5);
        c.fillRect(px-pw*.27,my,pw*.54,room.role==='rest'?3:2);
      }
      // Recessed fasteners identify a bolted service plate without texture noise.
      c.fillStyle='rgba(180,154,103,.45)';for(const a of [-1,1])for(const d of [-1,1])c.fillRect(px+a*(pw*.5-13)-2,py+d*(ph*.5-13)-2,4,4);
    }
    // Dry recessed channels and brass rulers stay flush with the walkable floor.
    for(const sign of [-1,1]){
      const x=cx+sign*w*.28;
      polygon(c,[[x-12,b.y+35],[x+12,b.y+35],[x+12,b.bottom-35],[x-12,b.bottom-35]],'#152a33');
      c.strokeStyle='rgba(123,185,177,.36)';c.lineWidth=2;c.beginPath();c.moveTo(x-11,b.y+35);c.lineTo(x-11,b.bottom-35);c.stroke();
      c.fillStyle='rgba(180,154,103,.46)';c.fillRect(x+10,b.y+40,3,h-80);
      for(let i=0;i<19;i++){const y=b.y+48+(h-96)*i/18;c.fillStyle=i%3?'rgba(180,154,103,.36)':'rgba(199,177,126,.58)';c.fillRect(x+13,y,i%3?7:16,i%3?1:2);}
      for(let i=0;i<4;i++){const y=b.y+h*(.21+i*.19);c.fillStyle='#40565a';c.fillRect(x-16,y,32,5);c.fillStyle='rgba(180,154,103,.6)';c.fillRect(x-17,y,4,5);c.fillRect(x+13,y,4,5);}
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
    // One broad role-specific calibration diagram on the south service apron.
    // It is matte, flat and open; the central combat socket remains undecorated.
    const ey=b.bottom-h*.12;
    c.strokeStyle='rgba(180,154,103,.40)';roleSign(c,room.role,cx,ey,1.8,.57);
    gauge(c,cx,ey+12,Math.min(124,w*.18),9);
    c.strokeStyle='rgba(180,154,103,.25)';c.lineWidth=2;c.beginPath();
    c.moveTo(cx-w*.23,ey+17);c.lineTo(cx-74,ey+17);c.moveTo(cx+74,ey+17);c.lineTo(cx+w*.23,ey+17);c.stroke();
    metrics.roleMarks++;
  }
  const ground=BiomeArtV3.ground;
  BiomeArtV3.ground=function(c,g,rooms,corridors,view){
    const active=g?.journey?.v21MapVersion===21;scopes.set(c,active?g.journey:null);
    const result=ground.apply(this,arguments);metrics.rooms=metrics.props=metrics.faded=metrics.roleMarks=metrics.landmarks=0;
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
    const room=journey.rooms?.find(room=>room.id===o.homeRoom);
    const original=alias?room?.design?.landmark:o.sprite;
    const family=instruments[original]||(alias?'vane':'gauge');
    const principal=room?.decor?.find(item=>item.landmark);
    const major=Boolean(o.landmark||alias)&&(!principal||(principal.x===o.x&&principal.y===o.y));
    const r=Math.max(8,o.r||18),heightLimit=major?126:family==='basin'?35:family==='register'?47:family==='sluice'?29:55;
    const h=Math.min(heightLimit,Math.max(32,o.height||70)),x=o.x,y=o.y;
    c.save();try{
      c.fillStyle='rgba(4,12,19,.3)';c.beginPath();c.ellipse(x+r*.3,y+5,r*1.1,r*.38,0,0,TAU);c.fill();
      // Match the existing transparency behavior using the new drawn silhouette.
      if(player&&player.y<y+5&&player.y>y-h-12&&Math.abs(player.x-x)<r+18){c.globalAlpha*=.32;metrics.faded++;}
      const bodyH=major?28:h;
      polygon(c,[[x-r,y-6],[x,y+r*.42],[x,y-bodyH],[x-r,y-bodyH-r*.42]],palette.slate);
      polygon(c,[[x,y+r*.42],[x+r,y-6],[x+r,y-bodyH-r*.42],[x,y-bodyH]],palette.side);
      polygon(c,[[x-r,y-bodyH-r*.42],[x,y-bodyH-r*.84],[x+r,y-bodyH-r*.42],[x,y-bodyH]],palette.top);
      if(major){
        // Only the existing principal collider gets the tall open instrument.
        // Its negative space keeps the hero readable and breaks the pillar row.
        c.strokeStyle=palette.side;c.lineWidth=8;c.beginPath();c.moveTo(x-r*.65,y-24);c.lineTo(x-r*.65,y-h*.77);c.moveTo(x+r*.65,y-24);c.lineTo(x+r*.65,y-h*.77);c.stroke();
        c.strokeStyle=palette.brass;c.lineWidth=3;c.beginPath();c.moveTo(x-r*.65,y-24);c.lineTo(x-r*.65,y-h*.77);c.moveTo(x+r*.65,y-24);c.lineTo(x+r*.65,y-h*.77);c.stroke();
        const role=room?.role||'start';c.strokeStyle='#d0b77e';roleSign(c,role,x,y-h*.65,r*.038,h*.0105);
        c.strokeStyle=palette.water;c.lineWidth=2;c.beginPath();c.moveTo(x-r*.6,y-h*.87);c.lineTo(x-r*.24,y-h*.87);c.stroke();
        metrics.landmarks++;metrics.props++;return;
      }
      // Vertical calibrated brass spine identifies the original instrument family.
      c.strokeStyle=palette.brass;c.lineWidth=2;c.beginPath();c.moveTo(x-r*.52,y-12);c.lineTo(x-r*.52,y-h+5);c.stroke();
      c.lineWidth=1;for(let i=0;i<5;i++){const yy=y-17-i*(h-24)/5;c.beginPath();c.moveTo(x-r*.52,yy);c.lineTo(x-r*.52+(i%2?4:7),yy);c.stroke();}
      c.strokeStyle=palette.water;c.lineWidth=2;c.beginPath();c.moveTo(x-r*.6,y-h+11);c.lineTo(x-r*.15,y-h+17);c.stroke();
      // Wide existing landmarks become paired tide vanes on the same base.
      if(family==='basin'){
        // A low dry calibration bowl: an inset top, not a pillar or a water hazard.
        polygon(c,[[x-r*.7,y-h-r*.42],[x,y-h-r*.68],[x+r*.7,y-h-r*.42],[x,y-h-r*.16]],palette.side);
        c.strokeStyle=palette.brass;c.lineWidth=2;c.beginPath();c.moveTo(x-r*.72,y-h-r*.42);c.lineTo(x,y-h-r*.14);c.lineTo(x+r*.72,y-h-r*.42);c.stroke();
      }else if(family==='register'||family==='sluice'){
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

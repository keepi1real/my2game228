/* Presentation only. Install after v20-matte-floor, before combat visibility.
 * A continuous, world-anchored stone surface and the original painted props.
 * No geometry, collider, random number generator or saved-state changes. */
(() => {
  'use strict';
  if (window.V21TideObservatoryArt) return;
  const BIOME='tideobservatory',TAU=Math.PI*2;
  const palette=Object.freeze({floor:'#344549',brass:'#b49a67',water:'#7bb9b1'});
  const roles=Object.freeze({start:2,combat:3,elite:5,treasure:4,rest:1,boss:7,event:3});
  const metrics={rooms:0,corridors:0,props:0,faded:0,roleMarks:0,landmarks:0,materials:0};
  const scopes=new WeakMap(),patterns=new WeakMap(),boxes=new WeakMap();
  let material=null,source=null;
  function path(c,poly){poly.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();}
  function bounds(room){
    if(boxes.has(room))return boxes.get(room);
    const p=room.polygons.flat(),xs=p.map(q=>q[0]),ys=p.map(q=>q[1]);
    const b={x:Math.min(...xs),y:Math.min(...ys),right:Math.max(...xs),bottom:Math.max(...ys)};boxes.set(room,b);return b;
  }
  function visible(b,v){return b.x<v.x+v.w&&b.y<v.y+v.h&&b.right>v.x&&b.bottom>v.y;}
  function stone(c){
    const image=BiomeArtV3.slate;
    if(!image||!image.width||image.complete===false)return null;
    // Retain the hand-painted slab bevels, chips and fissures. A single cached
    // glaze unifies the old stone with the tide atlas without hiding its detail.
    if(source!==image){
      source=image;material=document.createElement('canvas');material.width=image.width;material.height=image.height;
      const m=material.getContext('2d');m.drawImage(image,0,0);
      m.fillStyle='rgba(32,67,72,.23)';m.fillRect(0,0,material.width,material.height);metrics.materials++;
    }
    const saved=patterns.get(c);if(saved?.image===image)return saved.pattern;
    const pattern=c.createPattern(material,'repeat');
    // Same isometric material coordinates in every room AND every passage.
    // Translation is fixed in world space: moving the camera cannot slide tiles.
    pattern.setTransform({a:.36,b:.18,c:-.36,d:.18,e:0,f:0});
    patterns.set(c,{image,pattern});return pattern;
  }
  function inlay(c,r){
    const b=bounds(r),w=b.right-b.x,h=b.bottom-b.y,n=roles[r.role]||3;
    c.save();c.beginPath();for(const p of r.polygons)path(c,p);c.clip();
    // Worn brass calibration sectors on the peripheral stone apron. No filled
    // panels, central logo, false walls, water hazards or full attack-like rings.
    const radius=Math.min(130,w*.19),cy=b.bottom-h*.15,cx=r.center.x;
    c.strokeStyle='rgba(9,19,22,.52)';c.lineWidth=4;c.beginPath();
    c.ellipse(cx,cy,radius,radius*.34,0,Math.PI*.08,Math.PI*.92);c.stroke();
    c.strokeStyle='rgba(184,158,103,.55)';c.lineWidth=1.25;c.beginPath();
    c.ellipse(cx,cy-1,radius,radius*.34,0,Math.PI*.08,Math.PI*.92);c.stroke();
    for(let i=0;i<n*2+3;i++){
      const a=Math.PI*(.12+.76*i/(n*2+2)),cs=Math.cos(a),sn=Math.sin(a),len=i%2?5:10;
      c.strokeStyle=i%2?'rgba(176,155,109,.34)':'rgba(195,174,128,.52)';c.lineWidth=1;c.beginPath();
      c.moveTo(cx+cs*(radius+3),cy+sn*(radius+3)*.34);c.lineTo(cx+cs*(radius+len),cy+sn*(radius+len)*.34);c.stroke();
    }
    // Small warm metal repairs sit on existing stones, never on traversal seams.
    for(const side of [-1,1]){
      const x=cx+side*w*.32,y=b.y+h*.28;
      c.save();c.translate(x,y);c.transform(.8,.4,-.8,.4,0,0);
      c.fillStyle='rgba(13,26,28,.48)';c.fillRect(-22,-4,44,8);
      c.fillStyle='rgba(156,138,96,.55)';c.fillRect(-20,-2,40,3);
      c.fillStyle='rgba(219,202,158,.60)';c.fillRect(-17,-2,2,2);c.fillRect(15,-2,2,2);c.restore();
    }
    c.restore();metrics.roleMarks++;
  }
  const ground=BiomeArtV3.ground;
  BiomeArtV3.ground=function(c,g,rooms,corridors,view){
    const active=g?.journey?.v21MapVersion===21;scopes.set(c,active?g.journey:null);
    const result=ground.apply(this,arguments);
    metrics.rooms=metrics.corridors=metrics.props=metrics.faded=metrics.roleMarks=metrics.landmarks=0;
    if(!active)return result;
    const selected=rooms.filter(r=>r.biome===BIOME&&r.polygons?.length&&visible(bounds(r),view));
    const links=corridors.filter(l=>l.polygon&&g.journey.rooms?.[l.a]?.biome===BIOME&&g.journey.rooms?.[l.b]?.biome===BIOME);
    if(!selected.length&&!links.length)return result;
    c.save();try{
      c.imageSmoothingEnabled=true;c.globalAlpha=1;
      c.beginPath();for(const r of selected)for(const p of r.polygons)path(c,p);for(const l of links)path(c,l.polygon);c.clip();
      // One union clip and one fill: overlapping mouths get exactly the same
      // material as both sides. Never outline an individual room's hidden edge.
      const texture=stone(c);
      if(texture){c.fillStyle=texture;c.fillRect(view.x,view.y,view.w,view.h);}
      else {c.fillStyle='rgba(32,58,63,.12)';c.fillRect(view.x,view.y,view.w,view.h);}
      const edges=g.map?.boundary||[];
      c.beginPath();for(const [a,b]of edges){c.moveTo(...a);c.lineTo(...b);}
      c.lineJoin='round';c.strokeStyle='rgba(11,23,27,.52)';c.lineWidth=17;c.stroke();
      c.strokeStyle='rgba(166,146,107,.30)';c.lineWidth=5;c.stroke();
      c.strokeStyle='rgba(216,205,166,.45)';c.lineWidth=1.25;c.stroke();
      for(const r of selected){inlay(c,r);metrics.rooms++;}metrics.corridors=links.length;
    }finally{c.restore();}
    return result;
  };
  const prop=BiomeArtV3.prop;
  BiomeArtV3.prop=function(c,o,player,time){
    const journey=scopes.get(c);
    if(!journey||o?.biome!==BIOME)return prop.apply(this,arguments);
    const alias=o.sprite==='landmark-v15-tideobservatory';
    const room=alias?journey.rooms?.find(r=>r.id===o.homeRoom):null;
    const sprite=alias?(room?.design?.landmark||'tidepillar'):o.sprite;
    const spec=BiomeArtV3.sprites?.[sprite];
    if(!spec)return prop.apply(this,arguments);
    // A shallow presentation copy restores RoomCraft's source sprite. Collision
    // data, original object height/radius and save serialization remain intact.
    const visual=alias?{...o,sprite,height:Math.min(o.height||spec.height,spec.height)}:o;
    c.save();try{
      c.imageSmoothingEnabled=true;
      metrics.props++;if(o.landmark||alias)metrics.landmarks++;
      const width=spec.rect[2]/spec.rect[3]*visual.height;
      if(player&&player.y<o.y&&player.y>o.y-visual.height&&Math.abs(player.x-o.x)<width*.43)metrics.faded++;
      return prop.call(this,c,visual,player,time);
    }finally{c.restore();}
  };
  window.V21TideObservatoryArt=Object.freeze({version:21,biome:BIOME,palette,roles,metrics});
})();

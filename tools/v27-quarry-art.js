/* Red Quarry presentation. Installs after biome art and map registration.
 * Paint only: room polygons, passage polygons, boundary and prop colliders are read,
 * never changed. No game RNG, camera-relative texture shift or extra animation loop. */
(() => {
  'use strict';
  if (window.V27QuarryArt) return;
  const ID = 'redquarry', TAU = Math.PI * 2;
  const scopes = new WeakMap(), patterns = new WeakMap(), boundsCache = new WeakMap();
  const metrics = {rooms:0, passages:0, props:0, cliffs:0, veins:0};
  let groundImage, propImage;
  function assets(){
    if(!groundImage){groundImage=new Image();groundImage.src='../assets/v27/quarry/quarry-ground.png';}
    if(!propImage){propImage=new Image();propImage.src='../assets/v27/quarry/quarry-props.png';}
  }
  function active(j) { return j?.levelId === ID; }
  function path(c, poly) {
    poly.forEach(([x,y], i) => i ? c.lineTo(x,y) : c.moveTo(x,y));
    c.closePath();
  }
  function bounds(r) {
    let b = boundsCache.get(r);
    if (!b) {
      const pts = r.polygons.flat(), xs = pts.map(p=>p[0]), ys = pts.map(p=>p[1]);
      b = {x:Math.min(...xs),y:Math.min(...ys),right:Math.max(...xs),bottom:Math.max(...ys)};
      boundsCache.set(r,b);
    }
    return b;
  }
  function visible(b,v,pad=80) {
    return b.x < v.x+v.w+pad && b.right > v.x-pad && b.y < v.y+v.h+pad && b.bottom > v.y-pad;
  }
  // Original generated clay texture: quiet mineral grain, no false walls.
  function earth(c) {
    assets();
    const im = groundImage;
    if (!im || !im.width || im.complete === false) return null;
    const cached = patterns.get(c);
    if (cached?.image === im) return cached.pattern;
    const p = c.createPattern(im,'repeat');
    if (p?.setTransform) p.setTransform({a:1,b:0,c:0,d:1,e:0,f:0});
    patterns.set(c,{image:im,pattern:p});
    return p;
  }
  function mineral(c,r) {
    // Short fractured seams live on the flanks. They never fill a circle or
    // stripe an attack lane through the open combat socket.
    const cx=r.center.x, cy=r.center.y, s=r.id%2?-1:1;
    c.save();c.beginPath();for(const p of r.polygons)path(c,p);c.clip();
    for (let i=0;i<3;i++) {
      const x=cx+s*(245+i*22), y=cy-155+i*79;
      c.beginPath();c.moveTo(x-52,y-26);c.lineTo(x-17,y-11);
      c.lineTo(x+5,y+2);c.lineTo(x+39,y+10);c.lineTo(x+65,y+29);
      c.lineJoin='bevel';c.strokeStyle='rgba(42,24,21,.64)';c.lineWidth=12;c.stroke();
      c.strokeStyle='rgba(245,222,197,.74)';c.lineWidth=5;c.stroke();
      c.strokeStyle='rgba(255,246,221,.47)';c.lineWidth=1.5;c.stroke();
      metrics.veins++;
    }
    // Sparse chip clusters echo exposed porcelain without drawing false cover.
    for(let i=0;i<8;i++){
      const a=(i*2.399+r.id)*.93, x=cx+Math.cos(a)*315, y=cy+Math.sin(a)*170;
      c.beginPath();path(c,[[x-9,y-2],[x+1,y-5],[x+12,y+2],[x-2,y+5]]);
      c.fillStyle=i%3?'rgba(239,207,180,.18)':'rgba(252,229,198,.31)';c.fill();
    }
    c.restore();
  }
  const background=BiomeArtV3.background;
  BiomeArtV3.background=function(c,j,view){
    if(!active(j))return background.apply(this,arguments);
    c.save();try{
      c.fillStyle='#452820';c.fillRect(view.x,view.y,view.w,view.h);
      const t=earth(c);
      if(t){c.globalAlpha=.42;c.fillStyle=t;c.fillRect(view.x,view.y,view.w,view.h);c.globalAlpha=1;}
      c.fillStyle='rgba(84,33,25,.51)';c.fillRect(view.x,view.y,view.w,view.h);
    }finally{c.restore();}
  };
  const ground=BiomeArtV3.ground;
  BiomeArtV3.ground=function(c,g,rooms,corridors,view){
    const enabled=active(g?.journey);scopes.set(c,enabled);
    const result=ground.apply(this,arguments);
    metrics.rooms=metrics.passages=metrics.cliffs=metrics.veins=metrics.props=0;
    if(!enabled)return result;
    const selected=rooms.filter(r=>r.biome===ID&&r.polygons?.length&&visible(bounds(r),view));
    const links=corridors.filter(l=>l.polygon&&g.journey.rooms?.[l.a]?.biome===ID&&g.journey.rooms?.[l.b]?.biome===ID);
    if(!selected.length&&!links.length)return result;
    c.save();try{
      const edges=(g.map?.boundary||[]).filter(([a,b])=>visible({x:Math.min(a[0],b[0]),y:Math.min(a[1],b[1]),right:Math.max(a[0],b[0]),bottom:Math.max(a[1],b[1])},view));
      // Outward cliff drop and a hard contact shadow; the native union's edge
      // is the only cliff boundary, so linked rooms have no artificial seams.
      c.lineCap='round';c.lineJoin='round';c.beginPath();
      for(const [a,b] of edges){c.moveTo(a[0],a[1]+21);c.lineTo(b[0],b[1]+21);}
      c.strokeStyle='#291710';c.lineWidth=48;c.stroke();
      c.strokeStyle=earth(c)||'#663021';c.lineWidth=37;c.stroke();
      c.strokeStyle='rgba(57,25,17,.43)';c.lineWidth=37;c.stroke();
      // Short fracture faces break the quarry rim; no architectural trim.
      c.strokeStyle='rgba(30,16,13,.48)';c.lineWidth=3;c.beginPath();
      for(const [a,b] of edges){const n=Math.max(1,Math.floor(Math.hypot(b[0]-a[0],b[1]-a[1])/44));
        for(let i=0;i<n;i++){const t=(i+.37)/n,x=a[0]+(b[0]-a[0])*t,y=a[1]+(b[1]-a[1])*t;c.moveTo(x,y+10);c.lineTo(x-4,y+30);c.lineTo(x+1,y+42);}}
      c.stroke();
      metrics.cliffs=edges.length;
      c.beginPath();for(const r of selected)for(const p of r.polygons)path(c,p);
      for(const l of links)path(c,l.polygon);
      c.clip();
      c.fillStyle='#9b5942';c.fillRect(view.x,view.y,view.w,view.h);
      const t=earth(c);
      if(t){c.globalAlpha=.40;c.fillStyle=t;c.fillRect(view.x,view.y,view.w,view.h);c.globalAlpha=1;}
      const gr=c.createLinearGradient(0,0,SeamlessFloor.width,SeamlessFloor.height);
      gr.addColorStop(0,'rgba(236,164,117,.18)');gr.addColorStop(1,'rgba(75,27,20,.37)');
      c.fillStyle=gr;c.fillRect(view.x,view.y,view.w,view.h);
      for(const r of selected){mineral(c,r);metrics.rooms++;}
      metrics.passages=links.length;
    }finally{c.restore();}
    return result;
  };
  const prop=BiomeArtV3.prop;
  BiomeArtV3.prop=function(c,o,player,time){
    if (!scopes.get(c)||o?.biome!==ID)return prop.apply(this,arguments);
    assets();
    const index=o.sprite?.includes('wall')?1:o.landmark?2:0;
    const sprites=[{rect:[0,0,380,384],anchor:[188,362]},{rect:[380,170,370,200],anchor:[185,184]},{rect:[750,0,274,384],anchor:[137,367]}];
    const s=sprites[index], [sx,sy,sw,sh]=s.rect;
    // Every quarry cover object retains its exact solid footprint; the raster
    // replaces the inherited palace silhouette. Foreground walls remain low.
    const width=Math.max(36,o.r*3.3),scale=width/sw,height=sh*scale;
    c.save();try{
      c.fillStyle='rgba(38,17,13,.45)';c.beginPath();
      c.ellipse(o.x+8,o.y+6,Math.max(13,o.r*1.2),Math.max(5,o.r*.40),-.2,0,TAU);c.fill();
      if(player&&player.y<o.y&&player.y>o.y-height&&Math.abs(player.x-o.x)<width*.65)c.globalAlpha*=.40;
      if(propImage.complete&&propImage.naturalWidth)c.drawImage(propImage,sx,sy,sw,sh,o.x-s.anchor[0]*scale,o.y-s.anchor[1]*scale,width,height);
      else {c.fillStyle='#653a2c';c.beginPath();c.ellipse(o.x,o.y-8,o.r*1.15,o.r*.78,0,0,TAU);c.fill();}
      metrics.props++;
    }finally{c.restore();}
    return true;
  };
  window.V27QuarryArt=Object.freeze({version:27,biome:ID,metrics});
})();

/* Red Quarry actor atlas overlay: separate from the map painter above. */
(() => {
  'use strict';
  if (window.V27QuarrySprites || typeof ActorMotion === 'undefined') return;
  const previousDraw = ActorMotion.draw;
  // Literal asset paths allow the offline build to package only referenced files.
  const actors = {
    quarry_cleaver: {path:'../assets/v27/quarry/quarry_cleaver.png',height:68,figureHeight:139,footWidth:58},
    quarry_scorcher: {path:'../assets/v27/quarry/quarry_scorcher.png',height:63,figureHeight:148,footWidth:42},
    quarry_cutter: {path:'../assets/v27/quarry/quarry_cutter.png',height:102,figureHeight:94,footWidth:92}
  };
  const previousWidth=Renderer.prototype.spriteWidth,previousTop=Renderer.prototype.bodyTop;
  Renderer.prototype.spriteWidth=function(group,id){
    const spec=actors[id];
    if(spec&&(group==='enemies'||group==='bosses'))return spec.footWidth;
    return previousWidth.apply(this,arguments);
  };
  Renderer.prototype.bodyTop=function(group,id,e,radius){
    const spec=actors[id];
    if(spec&&(group==='enemies'||group==='bosses'))return e.y-spec.height;
    return previousTop.apply(this,arguments);
  };
  const cell = 192, anchorX = 96, anchorY = 186;
  function imageFor(spec) {
    if (!spec.image) {
      const img = new Image();
      img.src = spec.path;
      spec.image = img;
    }
    return spec.image;
  }
  function clamp01(n) { return Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0)); }
  function frame(e, s, id) {
    const t = e.telegraph;
    if (e.state === 'windup' || t) {
      const progress = t && t.total > 0 ? 1-t.time/t.total : 1-(e.windup||0)/(e.def?.windup||.4);
      return {state:id === 'quarry_scorcher' || t?.quarryCast ? 'cast' : 'attack',row:2,index:Math.min(1, Math.floor(clamp01(progress)*2))};
    }
    if (s.left > 0 && (s.action === 'attack' || s.action === 'cast' || s.action === 'roar' || s.action === 'skill')) {
      const progress = 1-s.left/(s.total||1);
      return {state:s.action === 'cast' || id === 'quarry_scorcher' ? 'cast' : 'attack',row:2,index:2+Math.min(1,Math.floor(clamp01(progress)*2))};
    }
    if ((s.walk||0) > .2) return {state:'walk',row:1,index:Math.floor((s.age||0)*9)%4};
    return {state:'idle',row:0,index:Math.floor((s.age||0)*5)%4};
  }
  ActorMotion.draw = function(c, group, id, e, options = {}) {
    const spec = actors[id];
    if (!spec || (group !== 'enemies' && group !== 'bosses')) return previousDraw.apply(this, arguments);
    const img = imageFor(spec);
    if (!img.complete || !img.naturalWidth) return previousDraw.apply(this, arguments);
    const s = options.state || ActorMotion.state(e);
    const pose = frame(e,s,id), k = (options.height||spec.height)/spec.figureHeight;
    c.save();
    try {
      c.translate(e.x,e.y);
      c.scale((s.facing||1)*k,k);
      c.imageSmoothingEnabled = true;
      c.drawImage(img,pose.index*cell,pose.row*cell,cell,cell,-anchorX,-anchorY,cell,cell);
      if (s.hit > 0) {
        c.globalAlpha *= Math.min(.65,s.hit/.12);
        c.filter = 'brightness(0) invert(1)';
        c.drawImage(img,pose.index*cell,pose.row*cell,cell,cell,-anchorX,-anchorY,cell,cell);
      }
    } finally { c.restore(); }
    return true;
  };
  window.V27QuarrySprites = Object.freeze({frame, imageFor, ids:Object.freeze(Object.keys(actors)), cell, anchor:Object.freeze([anchorX,anchorY])});
})();

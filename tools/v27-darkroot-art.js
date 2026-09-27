/* Darkroot environment and collision silhouettes. Load after BiomeArtV3 and
 * before the first SeamlessFloor.create/resume. The room polygons below are the
 * actual walkable floor; every painted bank follows their union boundary. */
(() => {
  'use strict';
  if (window.V27DarkrootArt) return;
  const BIOME='darkroot', TAU=Math.PI*2;
  const rootAtlas=loadImage('../assets/v27/darkroot/root-props.png');
  const soilAtlas=loadImage('../assets/v27/darkroot/root-soil.png');
  // Measured from the generated 1254px alpha atlas, not an assumed equal grid.
  const propFrames={
    dr_stump:{rect:[10,0,706,720],anchor:[360,690]},
    dr_ring:{rect:[778,0,470,699],anchor:[233,675]},
    dr_cluster:{rect:[10,815,790,385],anchor:[390,348]},
    dr_seedpod:{rect:[758,700,493,540],anchor:[250,515]}
  };
  const shapes={
    dr_mouth:[[-423,-92],[-365,-176],[-258,-209],[-156,-193],[-58,-253],[73,-210],[176,-236],[323,-176],[409,-100],[431,12],[374,102],[283,166],[176,220],[63,204],[-52,245],[-163,217],[-290,230],[-392,133],[-439,21]],
    dr_warren:[[-433,-62],[-376,-159],[-265,-235],[-136,-201],[-12,-246],[107,-212],[207,-250],[337,-173],[427,-67],[410,54],[346,156],[230,207],[107,186],[-17,249],[-150,208],[-284,223],[-392,137],[-439,33]],
    dr_fork:[[-426,-121],[-352,-207],[-238,-224],[-127,-191],[-18,-251],[113,-226],[258,-230],[376,-156],[433,-55],[397,60],[436,127],[342,203],[208,235],[92,196],[-39,238],[-161,192],[-285,220],[-401,112]],
    dr_nest:[[-412,-94],[-365,-176],[-244,-236],[-118,-209],[6,-253],[155,-224],[283,-208],[388,-130],[440,-14],[390,98],[316,189],[197,231],[70,208],[-58,247],[-184,216],[-314,205],[-402,100],[-436,3]],
    dr_heart:[[-448,-96],[-377,-198],[-255,-247],[-115,-232],[0,-291],[141,-241],[268,-257],[390,-178],[458,-73],[446,66],[380,183],[249,253],[101,267],[-29,241],[-175,276],[-309,214],[-422,117],[-463,8]]
  };
  Object.assign(BiomeArtV3.shapes,shapes);
  // The generator reads height/radius before it populates each room. Only four
  // darkroot types are registered; the paint below uses these same footprints.
  const props={
    dr_stump:{rect:[0,0,128,224],height:188,r:35},
    dr_ring:{rect:[0,0,128,204],height:146,r:31},
    dr_cluster:{rect:[0,0,128,142],height:98,r:29},
    dr_seedpod:{rect:[0,0,128,220],height:172,r:35}
  };
  Object.assign(BiomeArtV3.sprites,props);
  const previousCreate=SeamlessFloor.create;
  SeamlessFloor.create=function(...args){
    const j=previousCreate.apply(this,args);
    if(j?.levelId!==BIOME)return j;
    for(const r of j.rooms){
      // Older decorators have generic obelisk/armory fallback paths for an
      // unknown biome. Preserve each already-built collider and replace only
      // its presentation ID, before mapFor copies room decor into the map.
      r.decor.forEach((o,i)=>{
        if(o.kind==='biome-prop'&&o.biome===BIOME&&!props[o.sprite]&&o.sprite!=='landmark-v15-darkroot')
          o.sprite=o.landmark?r.design.landmark:['dr_stump','dr_ring','dr_cluster'][(r.id+i)%3];
      });
      const local=shapes[r.design.shape];if(!local)continue;
      const expected=local.map(([x,y])=>[x+r.center.x,y+r.center.y]);
      const actual=r.polygons?.[0];
      // RoomCraft or a later geometry wrapper may have changed the silhouette.
      // The v20 seed-based <20 px terrace relief is intentionally preserved.
      if(actual?.length===expected.length&&actual.every(([x,y],i)=>Math.hypot(x-expected[i][0],y-expected[i][1])<35))continue;
      r.polygons=[expected];
      const valid=o=>RoomVisualArt.inside(o.x,o.y,expected)||j.corridors.some(l=>RoomVisualArt.inside(o.x,o.y,l.polygon));
      r.decor=r.decor.filter(valid);r.obstacles=r.obstacles.filter(valid);
    }
    return j;
  };
  const previousBackground=BiomeArtV3.background;
  const previousGround=BiomeArtV3.ground;
  const previousProp=BiomeArtV3.prop;
  const previousLight=BiomeArtV3.light;
  const scopes=new WeakMap(), patterns=new WeakMap();
  const metrics={rooms:0,corridors:0,props:0,seedpods:0};
  const path=(c,poly)=>{poly.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();};
  const near=(r,v,pad=80)=>Math.abs(r.center.x-(v.x+v.w/2))<v.w/2+pad+500&&Math.abs(r.center.y-(v.y+v.h/2))<v.h/2+pad+350;
  const isDark=g=>g?.journey?.levelId===BIOME;
  function texture(c){
    const im=soilAtlas;
    if(!im?.width||im.complete===false)return null;
    let item=patterns.get(c);
    if(item?.image===im)return item.pattern;
    // Original generated soil, world-anchored; no paved tiles below the roots.
    const tile=document.createElement('canvas');tile.width=im.width;tile.height=im.height;
    const t=tile.getContext('2d');t.drawImage(im,0,0);
    t.fillStyle='rgba(18,34,27,.24)';t.fillRect(0,0,tile.width,tile.height);
    const p=c.createPattern(tile,'repeat');
    p?.setTransform?.({a:.4,b:0,c:0,d:.4,e:0,f:0});
    patterns.set(c,{image:im,pattern:p});return p;
  }
  function strand(c,x,y,side,scale){
    c.save();c.translate(x,y);c.scale(side*scale,scale);
    c.strokeStyle='rgba(5,15,17,.70)';c.lineWidth=43;c.lineCap='round';c.beginPath();
    c.moveTo(-260,-137);c.bezierCurveTo(-184,-152,-123,-75,-66,-98);c.bezierCurveTo(-24,-122,11,-90,51,-87);c.stroke();
    c.strokeStyle='rgba(39,59,52,.67)';c.lineWidth=9;c.beginPath();
    c.moveTo(-260,-151);c.bezierCurveTo(-173,-146,-111,-89,-64,-106);c.bezierCurveTo(-18,-125,20,-99,48,-97);c.stroke();
    c.strokeStyle='rgba(170,205,188,.16)';c.lineWidth=2;c.beginPath();
    c.moveTo(-202,-146);c.bezierCurveTo(-139,-110,-87,-99,-39,-112);c.stroke();
    c.restore();
  }
  BiomeArtV3.background=function(c,j,view){
    if(j?.levelId!==BIOME)return previousBackground.apply(this,arguments);
    c.save();try{
      c.fillStyle='#061b1a';c.fillRect(view.x,view.y,view.w,view.h);
      for(const r of j.rooms)if(near(r,view,100)){
        for(const side of [-1,1])strand(c,r.center.x+side*340,r.center.y-112,side,1.09);
        // Distant cavities are recesses, not extra traversable passages.
        const x=r.center.x,y=r.center.y-240;
        const g=c.createRadialGradient(x,y,4,x,y,310);
        g.addColorStop(0,'rgba(67,133,120,.13)');g.addColorStop(1,'rgba(67,133,120,0)');
        c.fillStyle=g;c.fillRect(x-310,y-310,620,620);
      }
    }finally{c.restore();}
  };
  function roomGrain(c,r){
    // Fine, broken fibers are peripheral and do not form a false attack zone.
    c.save();c.beginPath();for(const p of r.polygons)path(c,p);c.clip();
    for(let i=0;i<18;i++){
      const angle=i*2.399963+r.id*1.173;
      const x=r.center.x+Math.cos(angle)*(285+i%3*20);
      const y=r.center.y+Math.sin(angle)*(168+i%4*13);
      c.strokeStyle=i%4?'rgba(185,213,188,.13)':'rgba(112,176,151,.19)';
      c.lineWidth=i%5===0?2:1;c.beginPath();c.moveTo(x-18,y+5);
      c.quadraticCurveTo(x,y-7,x+19,y-12);c.stroke();
      if(i%3===0){c.strokeStyle='rgba(9,30,29,.36)';c.lineWidth=5;c.beginPath();c.moveTo(x-13,y+8);c.lineTo(x+10,y+3);c.stroke();}
    }
    c.restore();
  }
  BiomeArtV3.ground=function(c,g,rooms,corridors,view){
    scopes.set(c,isDark(g)?g.journey:null);
    metrics.rooms=metrics.corridors=metrics.props=metrics.seedpods=0;
    if(!isDark(g))return previousGround.apply(this,arguments);
    const selected=rooms.filter(r=>r.biome===BIOME&&r.polygons?.length&&near(r,view));
    const links=corridors.filter(l=>l.polygon&&g.journey.rooms?.[l.a]?.biome===BIOME&&g.journey.rooms?.[l.b]?.biome===BIOME);
    c.save();try{
      // Earthen cut bank replaces the old masonry terrace outside the floor.
      c.beginPath();for(const [a,b]of g.map?.boundary||[]){c.moveTo(a[0],a[1]+13);c.lineTo(b[0],b[1]+13);}
      c.lineJoin='round';c.lineCap='round';c.strokeStyle='#102320';c.lineWidth=39;c.stroke();
      c.strokeStyle='#263c31';c.lineWidth=17;c.stroke();
      if(rootAtlas?.width&&rootAtlas.complete!==false){
        c.globalAlpha=.76;
        for(const [a,b]of g.map?.boundary||[]){
          if(Math.max(a[0],b[0])<view.x-160||Math.min(a[0],b[0])>view.x+view.w+160||Math.max(a[1],b[1])<view.y-120||Math.min(a[1],b[1])>view.y+view.h+120)continue;
          const dx=b[0]-a[0],dy=b[1]-a[1],n=Math.max(1,Math.ceil(Math.hypot(dx,dy)/112));
          for(let i=0;i<n;i++){const t=(i+.5)/n,x=a[0]+dx*t,y=a[1]+dy*t;c.drawImage(rootAtlas,10,815,790,385,x-88,y-26,176,86);}
        }
        c.globalAlpha=1;
      }
      c.beginPath();for(const r of selected)for(const p of r.polygons)path(c,p);
      for(const l of links)path(c,l.polygon);c.clip();
      c.fillStyle='#34392e';c.fillRect(view.x,view.y,view.w,view.h);
      const soil=texture(c);if(soil){c.fillStyle=soil;c.fillRect(view.x,view.y,view.w,view.h);}
      const light=c.createLinearGradient(view.x,view.y,view.x+view.w,view.y+view.h);
      light.addColorStop(0,'rgba(110,148,114,.055)');light.addColorStop(1,'rgba(7,27,27,.22)');
      c.fillStyle=light;c.fillRect(view.x,view.y,view.w,view.h);
      for(const r of selected){roomGrain(c,r);metrics.rooms++;}
      metrics.corridors=links.length;
    }finally{c.restore();}
    // Draw only exposed union segments. Hidden room/passage overlaps have no seam.
    c.save();try{
      c.lineJoin='round';c.lineCap='round';c.beginPath();
      for(const [a,b] of g.map?.boundary||[]){if(Math.max(a[0],b[0])<view.x-32||Math.min(a[0],b[0])>view.x+view.w+32||Math.max(a[1],b[1])<view.y-32||Math.min(a[1],b[1])>view.y+view.h+32)continue;c.moveTo(...a);c.lineTo(...b);}
      c.strokeStyle='rgba(2,11,13,.70)';c.lineWidth=12;c.stroke();
      c.strokeStyle='rgba(46,70,48,.65)';c.lineWidth=5;c.stroke();
      c.strokeStyle='rgba(143,190,164,.19)';c.lineWidth=1.25;c.stroke();
    }finally{c.restore();}
  };
  function ceramic(c,y,r){
    c.fillStyle='#aab8a4';c.beginPath();c.ellipse(0,y,r,r*.26,-.13,0,TAU);c.fill();
    c.fillStyle='#526e67';c.beginPath();c.ellipse(0,y-3,r*.78,r*.16,-.13,0,TAU);c.fill();
    c.strokeStyle='rgba(218,232,201,.78)';c.lineWidth=2;c.beginPath();c.ellipse(0,y-2,r*.9,r*.22,-.13,Math.PI*.08,Math.PI*.82);c.stroke();
  }
  function paintProp(c,o,player,time){
    const kind=o.sprite, r=Math.max(12,o.r||28),h=Math.min(kind==='dr_seedpod'?154:kind==='dr_cluster'?108:230,o.height||props[kind].height);
    const frame=propFrames[kind];
    if(rootAtlas?.width&&rootAtlas.complete!==false&&frame){
      const [sx,sy,sw,sh]=frame.rect, scale=h/sh, ax=frame.anchor[0],ay=frame.anchor[1];
      c.save();try{
        if(player&&player.y<o.y&&player.y>o.y-h&&Math.abs(player.x-o.x)<sw*scale*.48)c.globalAlpha=.34;
        c.fillStyle='rgba(1,11,12,.55)';c.beginPath();c.ellipse(o.x+5,o.y+4,Math.max(r,sw*scale*.32),Math.max(6,r*.27),0,0,TAU);c.fill();
        c.drawImage(rootAtlas,sx,sy,sw,sh,o.x-ax*scale,o.y-ay*scale,sw*scale,sh*scale);
        metrics.props++;if(kind==='dr_seedpod')metrics.seedpods++;
      }finally{c.restore();}
      return;
    }
    c.save();try{
      if(player&&player.y<o.y&&player.y>o.y-h&&Math.abs(player.x-o.x)<r*2.3)c.globalAlpha=.38;
      c.translate(o.x,o.y);
      c.fillStyle='rgba(1,11,12,.65)';c.beginPath();c.ellipse(7,7,r*1.55,Math.max(9,r*.44),-.12,0,TAU);c.fill();
      // Every elevated mass grows directly from its circular blocker.
      if(kind==='dr_cluster'){
        for(let i=-1;i<=1;i++){
          const dx=i*r*.55,t=h*(i===0?.83:.52);
          c.fillStyle=i===0?'#172c29':'#203b36';c.beginPath();
          c.moveTo(dx-r*.32,0);c.quadraticCurveTo(dx-r*.47,-t*.55,dx-r*.09,-t);
          c.lineTo(dx+r*.19,-t*.92);c.quadraticCurveTo(dx+r*.48,-t*.54,dx+r*.42,0);c.fill();
          c.strokeStyle='rgba(124,190,170,.46)';c.lineWidth=1.5;c.beginPath();c.moveTo(dx-r*.12,-t*.78);c.lineTo(dx-r*.07,-t*.24);c.stroke();
        }
      }else{
        c.fillStyle='#0d2424';c.beginPath();c.moveTo(-r*.88,0);
        c.bezierCurveTo(-r*1.2,-h*.3,-r*.6,-h*.83,-r*.28,-h);
        c.quadraticCurveTo(0,-h*1.08,r*.23,-h*.91);
        c.bezierCurveTo(r*.48,-h*.61,r*1.14,-h*.35,r*.88,0);c.closePath();c.fill();
        c.strokeStyle='rgba(83,121,101,.74)';c.lineWidth=Math.max(2,r*.12);c.beginPath();c.moveTo(-r*.43,-h*.87);c.bezierCurveTo(-r*.52,-h*.5,-r*.14,-h*.43,-r*.4,-h*.05);c.stroke();
        c.strokeStyle='rgba(185,217,194,.55)';c.lineWidth=1.5;c.beginPath();c.moveTo(r*.12,-h*.79);c.bezierCurveTo(r*.25,-h*.48,r*.09,-h*.19,r*.38,-h*.04);c.stroke();
        if(kind==='dr_ring')ceramic(c,-h*.38,r*.93);
        if(kind==='dr_seedpod'){
          ceramic(c,-h*.23,r*.96);
          const glow=c.createRadialGradient(0,-h*.67,2,0,-h*.67,r*1.35);
          glow.addColorStop(0,'rgba(226,245,180,.48)');glow.addColorStop(1,'rgba(197,233,168,0)');
          c.fillStyle=glow;c.fillRect(-r*1.5,-h*.67-r*1.5,r*3,r*3);
          c.fillStyle='#dcecad';c.beginPath();c.ellipse(0,-h*.68,r*.42,h*.19,.1,0,TAU);c.fill();
          c.strokeStyle='#f5f6d5';c.lineWidth=1.5;c.beginPath();c.moveTo(-r*.12,-h*.8);c.quadraticCurveTo(r*.13,-h*.7,r*.07,-h*.56);c.stroke();
          metrics.seedpods++;
        }
      }
      metrics.props++;
    }finally{c.restore();}
  }
  BiomeArtV3.prop=function(c,o,player,time){
    if(!scopes.get(c)||o?.biome!==BIOME)return previousProp.apply(this,arguments);
    const alias=o.sprite==='landmark-v15-darkroot';
    const r=alias?scopes.get(c).rooms?.[o.homeRoom]:null;
    const sprite=alias?(r?.design?.landmark||'dr_stump'):o.sprite;
    if(!props[sprite])return previousProp.apply(this,arguments);
    paintProp(c,alias?{...o,sprite}:o,player,time);return undefined;
  };
  BiomeArtV3.light=function(c,o,time){
    if(!scopes.get(c)||o?.biome!==BIOME)return previousLight.apply(this,arguments);
    // Restrict ambient bloom to actual seedpods; no apparent damage circles.
    return undefined;
  };
  window.V27DarkrootArt=Object.freeze({version:27,biome:BIOME,shapes:Object.freeze(Object.keys(shapes)),props:Object.freeze(Object.keys(props)),metrics});
})();

/* Darkroot creature atlases. Append after the environment IIFE so its room
 * geometry and prop paint remain independent of these cosmetic actor poses. */
(() => {
  'use strict';
  if (window.V27DarkrootMobs) return;
  const files = {
    root_reaper: {group:'enemies',height:78,width:76,src:'../assets/v27/darkroot/root_reaper-atlas.png',rects:[
      [46,5,396,439],[501,2,372,413],[926,0,404,415],[1330,12,429,416],
      [39,444,405,419],[444,463,443,401],[887,460,443,387],[1330,460,437,405]]},
    root_grafter: {group:'enemies',height:76,width:70,src:'../assets/v27/darkroot/root_grafter-atlas.png',rects:[
      [87,7,320,416],[514,5,319,415],[960,6,341,438],[1395,6,328,416],
      [24,462,363,402],[449,460,438,406],[887,444,443,414],[1330,448,433,409]]},
    root_heart: {group:'bosses',height:154,width:150,src:'../assets/v27/darkroot/root_heart-atlas.png',rects:[
      [12,6,393,438],[476,5,379,439],[898,7,428,437],[1352,5,405,432],
      [10,444,434,426],[444,444,443,415],[887,444,443,431],[1330,454,433,421]]}
  };
  for (const spec of Object.values(files)) spec.image=loadImage(spec.src);
  const previousDraw=Renderer.prototype.drawArt;
  const previousWidth=Renderer.prototype.spriteWidth;
  const previousTop=Renderer.prototype.bodyTop;
  const selected=(renderer,group,id)=>renderer.g?.journey?.levelId==='darkroot'&&files[id]?.group===group?files[id]:null;
  const releaseKinds=new WeakMap();
  function pose(g,e,id) {
    const s=typeof ActorMotion!=='undefined'?ActorMotion.state(e):null;
    const t=e.telegraph;
    const cast=!!(e.def?.ranged||t&&t.kind!=='sweep'&&t.kind!=='lunge'&&t.kind!=='basic'||id==='root_heart'&&t&&t.kind!=='sweep');
    if(t||e.state==='windup'){
      releaseKinds.set(e,cast?'cast':'attack');
      return cast?6:4;
    }
    if(s?.left>0&&(s.action==='attack'||s.action==='cast')){
      return (s.action==='cast'||releaseKinds.get(e)==='cast')?7:5;
    }
    if(e.rootRecovery>0)return releaseKinds.get(e)==='cast'?7:5;
    const phase=s?.phase||0;
    if(s?.walk>.2)
      return 2+(Math.floor(phase/Math.PI)&1);
    return Math.floor((g.time||0)*1.6)%2;
  }
  Renderer.prototype.spriteWidth=function(group,id){
    const spec=selected(this,group,id);
    return spec?.image?.width&&spec.image.complete!==false?spec.width:previousWidth.apply(this,arguments);
  };
  Renderer.prototype.bodyTop=function(group,id,ent,radius){
    const spec=selected(this,group,id);
    return spec?.image?.width&&spec.image.complete!==false?ent.y-spec.height:previousTop.apply(this,arguments);
  };
  Renderer.prototype.drawArt=function(group,id,ent,radius,color){
    const spec=selected(this,group,id);
    if(!spec||!spec.image?.width||spec.image.complete===false)
      return previousDraw.apply(this,arguments);
    const index=pose(this.g,ent,id),rect=spec.rects[index];
    const [sx,sy,sw,sh]=rect,cell=Math.round(index%4*1774/4),next=Math.round((index%4+1)*1774/4);
    const cellCenter=(cell+next)/2,scale=spec.height/444;
    const state=typeof ActorMotion!=='undefined'?ActorMotion.state(ent):null;
    const facing=(ent.windupDir?.x&&ent.state==='windup'?ent.windupDir.x:ent.dir?.x||state?.facing||1)<0?-1:1;
    const c=this.ctx;c.save();
    try{
      c.translate(ent.x,ent.y);
      c.scale(facing,1);
      c.imageSmoothingEnabled=true;
      if(ent.hitFlash>0)c.filter='brightness(1.7)';
      // Every measured alpha rect ends at the foot baseline of its own pose.
      // The source-cell center remains fixed during lunges; only the painted
      // sickle/fiber shifts, while hitboxes stay at the actual actor position.
      c.drawImage(spec.image,sx,sy,sw,sh,(sx-cellCenter)*scale,-sh*scale,sw*scale,sh*scale);
    }finally{c.restore();}
    return true;
  };
  window.V27DarkrootMobs=Object.freeze({version:27,frames:8,canvas:[1774,887],ids:Object.freeze(Object.keys(files)),files});
})();

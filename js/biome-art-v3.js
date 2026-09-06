'use strict';
// World-native geometry and sprite composition. Generated paintings provide
// materials/props; every walkable edge and solid prop comes from this geometry.
const BiomeArtV3=(()=>{
  const images=Object.fromEntries(Object.entries(BiomeV3.biomes).map(([id,b])=>[id,loadImage(b.backdrop)]));
  const sheet=loadImage('assets/recovered-v9/b404977b38812d98.png');
  const eclipseSheet=loadImage('assets/recovered-v9/47214fe4696649b3.png');
  const eclipseSlate=loadImage('assets/recovered-v9/40622ae1a1ba2752.png');
  const rootSheet=loadImage('assets/recovered-v9/4a8aa437eaf2f6b9.png');
  const stormSheet=loadImage('assets/recovered-v9/d09a3eda17fc4ccd.png');
  const tideSheet=loadImage('assets/recovered-v9/c339c2ecd2a7da88.png');
  const forgeSheet=loadImage('assets/recovered-v9/b22bb4347cd681a2.png');
  const amberSheet=loadImage('assets/crown-v11/amber-atlas.png');
  const glassSheet=loadImage('assets/crown-v11/glass-atlas.png');
  const slate=loadImage('assets/recovered-v9/5003907889809929.png');
  const shapes={
    burialquay:[[-425,-80],[-280,-215],[-60,-215],[90,-175],[310,-205],[420,-60],[345,125],[180,220],[-75,195],[-315,220],[-425,95]],
    burialcourt:[[-410,-125],[-280,-235],[280,-235],[420,-110],[365,55],[410,130],[260,235],[-260,235],[-410,130],[-365,55]],
    resingarden:[[-410,-70],[-290,-200],[-140,-245],[30,-180],[195,-245],[395,-115],[420,50],[290,225],[45,190],[-155,245],[-385,130]],
    urnhall:[[-425,-100],[-305,-225],[-185,-225],[-185,-175],[190,-175],[190,-225],[315,-225],[425,-90],[400,140],[265,215],[-270,215],[-425,100]],
    amberthrone:[[-440,-100],[-300,-245],[-130,-245],[-130,-300],[150,-300],[150,-245],[320,-235],[440,-95],[415,140],[250,255],[0,280],[-270,255],[-440,105]],
    petalquay:[[-425,-65],[-295,-205],[-120,-235],[50,-175],[230,-220],[405,-100],[425,65],[290,210],[90,240],[-100,205],[-335,185]],
    mirrorcourt:[[-415,-110],[-265,-230],[-95,-190],[95,-190],[265,-230],[415,-110],[380,155],[205,235],[-205,235],[-380,155]],
    glassgallery:[[-435,-80],[-280,-210],[-140,-210],[-140,-175],[165,-175],[165,-245],[320,-205],[435,-55],[370,175],[200,220],[-275,195],[-435,90]],
    willowgarden:[[-410,-100],[-280,-235],[-95,-190],[115,-245],[335,-155],[425,10],[315,205],[95,185],[-105,250],[-370,160]],
    glasscrown:[[-440,-125],[-305,-230],[-130,-245],[0,-300],[155,-260],[320,-220],[440,-95],[425,105],[280,245],[65,280],[-140,265],[-370,155]],
    tidalquay:[[-425,-90],[-330,-180],[-125,-205],[25,-155],[170,-230],[350,-145],[420,25],[310,190],[105,215],[-90,185],[-260,225],[-415,100]],
    tidalhall:[[-420,-125],[-285,-205],[-90,-205],[-90,-250],[115,-250],[115,-205],[325,-205],[420,-70],[380,175],[190,230],[-235,205],[-420,90]],
    cloister:[[-380,-175],[-205,-235],[165,-235],[385,-135],[425,10],[330,120],[245,120],[245,235],[-210,235],[-210,135],[-405,100]],
    reservoir:[[-410,-85],[-310,-205],[-130,-250],[80,-180],[270,-220],[415,-60],[355,170],[145,245],[-85,190],[-305,215],[-420,80]],
    tideapse:[[-430,-115],[-305,-215],[-145,-240],[0,-295],[160,-255],[320,-210],[430,-90],[435,100],[280,240],[70,270],[-155,250],[-370,165]],
    furnacehall:[[-420,-135],[-310,-215],[-175,-215],[-175,-175],[165,-175],[165,-230],[320,-230],[420,-100],[420,110],[270,220],[-270,220],[-420,110]],
    anvilcourt:[[-405,-165],[-175,-235],[175,-235],[415,-150],[340,-45],[395,90],[270,220],[-265,220],[-395,90],[-340,-45]],
    slagterrace:[[-420,-85],[-300,-215],[-100,-185],[80,-240],[320,-160],[420,-25],[310,115],[180,115],[180,240],[-155,240],[-300,150],[-420,150]],
    solarwheel:[[-415,-75],[-300,-180],[-105,-240],[105,-240],[315,-170],[425,-35],[350,160],[155,235],[-115,220],[-330,145]],
    solarcrucible:[[-445,-125],[-320,-245],[-120,-245],[-120,-300],[145,-300],[145,-245],[330,-235],[445,-100],[420,120],[270,255],[60,280],[-160,265],[-375,155]],
    rampart:[[-415,-125],[-310,-225],[-145,-225],[-145,-170],[150,-170],[150,-225],[315,-225],[415,-110],[390,155],[235,225],[-250,225],[-415,130]],
    icegarden:[[-390,-100],[-255,-235],[-60,-175],[135,-240],[345,-150],[410,20],[305,205],[110,180],[-100,240],[-375,145]],
    sunwheel:[[-400,-75],[-290,-195],[-100,-245],[140,-225],[340,-135],[420,35],[305,190],[90,235],[-150,210],[-355,135]],
    stormthrone:[[-425,-140],[-265,-245],[-130,-245],[-130,-295],[130,-295],[130,-245],[265,-245],[425,-140],[440,80],[310,230],[120,275],[-120,275],[-310,230],[-440,80]],
    fungal:[[-390,-105],[-290,-215],[-130,-230],[-55,-165],[95,-235],[305,-195],[405,-45],[355,145],[170,230],[10,195],[-165,240],[-355,125]],
    grove:[[-395,-140],[-260,-245],[-95,-195],[90,-250],[310,-180],[400,-25],[370,155],[160,235],[-105,210],[-355,170]],
    belfry:[[-405,-125],[-305,-225],[-135,-225],[-135,-180],[140,-180],[140,-225],[305,-225],[405,-125],[405,145],[240,225],[-240,225],[-405,145]],
    heartwood:[[-425,-100],[-315,-210],[-130,-235],[0,-285],[130,-235],[315,-210],[425,-100],[440,75],[320,215],[140,270],[-140,270],[-320,215],[-440,75]],
    archive:[[-390,-140],[-290,-220],[-130,-220],[-130,-175],[140,-175],[140,-220],[300,-220],[390,-125],[390,165],[235,215],[-235,215],[-390,135]],
    crescent:[[-380,-60],[-300,-195],[-145,-235],[0,-170],[180,-240],[365,-135],[390,65],[290,185],[85,235],[-100,205],[-165,100],[-345,140]],
    orrery:[[-395,-80],[-260,-205],[-65,-245],[140,-220],[330,-145],[410,10],[340,155],[115,230],[-150,220],[-355,135]],
    observatory:[[-390,-130],[-255,-225],[-130,-225],[-130,-280],[130,-280],[130,-225],[255,-225],[390,-130],[425,80],[300,220],[100,265],[-100,265],[-300,220],[-425,80]],
    courtyard:[[-375,-135],[-255,-230],[265,-230],[390,-105],[350,170],[210,235],[-275,215],[-390,65]],
    longhall:[[-410,-95],[-250,-205],[255,-205],[410,-70],[380,155],[235,215],[-280,170],[-410,45]],
    broken:[[-365,-155],[-105,-245],[245,-210],[385,-90],[340,210],[65,250],[15,145],[-345,145],[-395,20]],
    garden:[[-390,-90],[-280,-230],[-70,-195],[105,-245],[335,-175],[415,-5],[350,160],[155,245],[-110,210],[-375,105]],
    terrace:[[-405,-110],[-275,-190],[60,-190],[125,-250],[340,-165],[405,-30],[340,100],[175,100],[175,240],[-215,240],[-310,155],[-405,130]],
    cruciform:[[-245,-230],[245,-230],[245,-100],[385,-40],[385,115],[225,115],[225,225],[-225,225],[-225,115],[-390,115],[-390,-45],[-245,-100]],
    sanctum:[[-350,-135],[-150,-240],[170,-240],[365,-115],[400,100],[175,235],[-175,235],[-385,85]],
  };
  const sprites={
    glasspillar:{rect:[103,14,206,396],height:226,r:22,image:glassSheet},
    glassmirror:{rect:[494,10,289,394],height:204,r:27,image:glassSheet},
    glasswillow:{rect:[854,13,378,399],height:231,r:33,image:glassSheet},
    glassbasin:{rect:[21,848,385,371],height:137,r:36,image:glassSheet},
    glasswall:{rect:[440,894,399,314],height:84,r:25,image:glassSheet},
    glasscluster:{rect:[868,851,372,361],height:114,r:25,image:glassSheet},

    amberpillar:{rect:[81,4,257,413],height:226,r:23,image:amberSheet},
    ambersarcophagus:{rect:[445,73,378,328],height:151,r:36,image:amberSheet},
    ambertree:{rect:[870,13,365,405],height:229,r:33,image:amberSheet},
    amberbasin:{rect:[79,855,261,367],height:120,r:32,image:amberSheet},
    amberwall:{rect:[431,879,399,348],height:87,r:25,image:amberSheet},
    ambercluster:{rect:[866,871,377,346],height:113,r:25,image:amberSheet},

    tidepillar:{rect:[186,15,182,486],height:224,r:22,image:tideSheet},
    tideshelves:{rect:[599,6,335,495],height:212,r:31,image:tideSheet},
    tidescholar:{rect:[1152,22,299,483],height:208,r:31,image:tideSheet},
    tidebasin:{rect:[559,619,419,262],height:102,r:38,image:tideSheet},
    tidewall:{rect:[1067,614,449,340],height:90,r:25,image:tideSheet},
    sunpillar:{rect:[181,0,210,514],height:226,r:24,image:forgeSheet},
    sunfurnace:{rect:[621,4,291,512],height:215,r:35,image:forgeSheet},
    sunanvil:{rect:[1040,44,460,480],height:152,r:34,image:forgeSheet},
    slagbasin:{rect:[542,630,447,297],height:112,r:38,image:forgeSheet},
    slagwall:{rect:[1018,580,514,396],height:86,r:25,image:forgeSheet},
    frostpillar:{rect:[105,0,330,525],height:218,r:24,storm:true},
    stormbeacon:{rect:[574,0,395,520],height:166,r:28,storm:true},
    stormforge:{rect:[1048,65,488,442],height:148,r:34,storm:true},
    charttable:{rect:[0,566,510,438],height:126,r:39,storm:true},
    icecluster:{rect:[532,533,475,469],height:122,r:24,storm:true},
    frostwall:{rect:[1031,573,505,405],height:84,r:24,storm:true},
    bloodtree:{rect:[0,0,536,510],height:232,r:34,rootvault:true},
    bellframe:{rect:[550,0,490,507],height:218,r:36,rootvault:true},
    fungi:{rect:[1060,0,476,519],height:148,r:24,rootvault:true},
    rootpillar:{rect:[20,521,410,503],height:206,r:23,rootvault:true},
    rootpool:{rect:[505,580,510,419],height:133,r:42,rootvault:true},
    roothedge:{rect:[1020,648,516,334],height:81,r:26,rootvault:true},
    astrolabe:{rect:[104,0,365,565],height:238,r:35,eclipse:true},
    starbooks:{rect:[602,0,330,565],height:208,r:30,eclipse:true},
    moonpillar:{rect:[1132,0,291,564],height:215,r:22,eclipse:true},
    moonwell:{rect:[8,565,525,450],height:136,r:45,eclipse:true},
    crystal:{rect:[580,596,383,403],height:107,r:23,eclipse:true},
    moonwall:{rect:[1050,572,472,431],height:87,r:25,eclipse:true},
    tree:{rect:[0,0,400,506],height:226,r:40}, statue:{rect:[428,8,302,498],height:216,r:28},
    cistern:{rect:[770,178,375,289],height:112,r:46}, forge:{rect:[1167,0,369,502],height:222,r:42},
    obelisk:{rect:[87,514,195,493],height:184,r:19}, wall:{rect:[365,641,391,323],height:88,r:22},
    armory:{rect:[775,552,376,410],height:100,r:26}, books:{rect:[1170,510,326,506],height:167,r:26},
  };
  const inside=(x,y,p)=>RoomVisualArt.inside(x,y,p);
  function path(c,p){c.moveTo(p[0][0],p[0][1]);for(let i=1;i<p.length;i++)c.lineTo(...p[i]);c.closePath();}
  function canvas(w,h){const a=document.createElement('canvas');a.width=w;a.height=h;return a;}
  function atlas(){return RoomVisualArt.ready(sheet)?sheet:null;}
  function populate(j){
    const distanceToLink=(p,l)=>{const dx=l.to.x-l.from.x,dy=l.to.y-l.from.y,t=clamp(((p.x-l.from.x)*dx+(p.y-l.from.y)*dy)/(dx*dx+dy*dy),0,1);return Math.hypot(p.x-l.from.x-dx*t,p.y-l.from.y-dy*t);};
    for(const r of j.rooms){
      if(r.id===15&&j.levelId==='undermountain')continue;const rng=new RNG(j.seed+r.id*1237),poly=r.polygons[0],links=j.corridors.filter(l=>l.a===r.id||l.b===r.id),candidates=[];
      for(let i=0;i<poly.length;i++){
        const a=poly[i],b=poly[(i+1)%poly.length],n=Math.max(1,Math.floor(Math.hypot(b[0]-a[0],b[1]-a[1])/142));
        for(let k=0;k<n;k++){const t=(k+.5)/n,x=a[0]+(b[0]-a[0])*t,y=a[1]+(b[1]-a[1])*t,dx=r.center.x-x,dy=r.center.y-y,len=Math.hypot(dx,dy);
          const q={x:x+dx/len*38,y:y+dy/len*38};
          if(links.some(l=>distanceToLink(q,l)<l.half+42))continue;
          if(Math.abs(q.x-r.center.x)<185&&Math.abs(q.y-r.center.y)<130)continue;
          if([r.restPoint,r.chestPoint,r.featureUsePoint,{x:r.center.x,y:r.center.y+110}].filter(Boolean).some(p=>Math.hypot(p.x-q.x,p.y-q.y)<110))continue;
          if(candidates.every(p=>Math.hypot(p.x-q.x,p.y-q.y)>112))candidates.push(q);
        }
      }
      const fs=sprites[r.design.landmark]||sprites.statue,theme=BiomeV3.biomes[r.biome];
      const focal=['eclipse','rootvault','storm','tide','sunforge','amber','glass'].includes(r.biome)?[[-230,-130],[230,-130],[-255,110],[255,110],[0,-180]].map(([x,y])=>({x:x+r.center.x,y:y+r.center.y})).find(q=>inside(q.x,q.y,poly)&&links.every(l=>distanceToLink(q,l)>fs.r+90)&&[r.restPoint,r.chestPoint,r.featureUsePoint].filter(Boolean).every(p=>Math.hypot(p.x-q.x,p.y-q.y)>110)):{x:r.center.x+(r.id%2?-210:210),y:r.center.y-38};
      if(focal&&r.decor.every(o=>Math.hypot(o.x-focal.x,o.y-focal.y)>90)){
        const o={...focal,kind:'biome-prop',sprite:r.design.landmark,height:fs.height*1.05,r:fs.r,homeRoom:r.id,biome:r.biome,landmark:true};r.decor.push(o);r.obstacles.push(o);
      }
      candidates.sort((a,b)=>a.y-b.y);
      // One large landmark on the north flank; a clear middle lane always
      // remains between spawn, combat sockets, chests and the open passages.
      for(let i=0;i<candidates.length;i++){
        const q=candidates[i],sprite=i===0?r.design.landmark:i%3===0?r.design.propStyle:theme.pillar?(i%3===1?theme.pillar:theme.cluster):r.biome==='storm'?(i%3===1?'frostpillar':'icecluster'):r.biome==='rootvault'?(i%3===1?'rootpillar':'fungi'):r.biome==='eclipse'?(i%3===1?'moonpillar':'crystal'):i%3===1?'obelisk':r.biome==='roots'?'tree':'armory';
        const s=sprites[sprite]||sprites.statue,scale=i===0?1.08:i%3===1?.82:.72+rng.next()*.12;
        const o={...q,kind:'biome-prop',sprite,height:s.height*scale,r:s.r*scale,homeRoom:r.id,biome:r.biome,landmark:i===0};
        r.decor.push(o);r.obstacles.push(o);
        if(i===0||i===3){const p={x:o.x+62,y:o.y+24};
          if(inside(p.x,p.y,poly)&&!links.some(l=>distanceToLink(p,l)<l.half+76)&&Math.hypot(p.x-r.chestPoint.x,p.y-r.chestPoint.y)>100&&(!r.featureUsePoint||Math.hypot(p.x-r.featureUsePoint.x,p.y-r.featureUsePoint.y)>110)){
            const cluster={...p,kind:'biome-prop',sprite:theme.cluster||(r.biome==='storm'?'icecluster':r.biome==='rootvault'?'fungi':r.biome==='eclipse'?'crystal':'armory'),height:74,r:19,homeRoom:r.id,biome:r.biome};r.decor.push(cluster);r.obstacles.push(cluster);
          }
        }
      }
    }
  }
  function rimDecor(map,j){
    for(let k=0;k<map.boundary.length;k++){
      const [a,b]=map.boundary[k],dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy),n=Math.floor(length/150);
      for(let i=0;i<n;i++){
        const t=(i+.5)/n,x=a[0]+dx*t,y=a[1]+dy*t;
        let nx=-dy/length,ny=dx/length;if(map.floorContains(x+nx*4,y+ny*4)){nx=-nx;ny=-ny;}
        const q={x:x-nx*14,y:y-ny*14};
        if(j.rooms.some(r=>r.featureUsePoint&&Math.hypot(r.featureUsePoint.x-q.x,r.featureUsePoint.y-q.y)<110))continue;
        if(!map.floorContains(q.x,q.y)||map.decor.some(o=>Math.hypot(o.x-q.x,o.y-q.y)<118))continue;
        const r=j.rooms.reduce((a,b)=>Math.hypot(a.center.x-x,a.center.y-y)<Math.hypot(b.center.x-x,b.center.y-y)?a:b);
        if(r.id===15&&j.levelId==='undermountain')continue;
        const north=ny<-.3,theme=BiomeV3.biomes[r.biome],sprite=theme.pillar?(north&&(k+i)%4===0?theme.pillar:theme.wall):r.biome==='storm'?(north&&(k+i)%4===0?'frostpillar':(k+i)%3===0?'icecluster':'frostwall'):r.biome==='rootvault'?(north&&(k+i)%4===0?'bloodtree':(k+i)%3===0?'fungi':'roothedge'):r.biome==='eclipse'?(north&&(k+i)%3===0?'moonpillar':(k+i)%4===0?'crystal':'moonwall'):r.biome==='roots'?'tree':north&&(k+i)%3===0?'obelisk':'wall';
        const height=['tree','bloodtree'].includes(sprite)?(north?143:88):['obelisk','moonpillar','frostpillar',theme.pillar].includes(sprite)?154:north?100:74;
        const o={...q,sprite,height,r:sprites[sprite].r*height/sprites[sprite].height,kind:'biome-prop',biome:r.biome,homeRoom:r.id};map.decor.push(o);map.obstacles.push(o);
      }
    }
  }
  // Exposed segments of the polygon union. Internal seams between a court and
  // a passage are discarded, so the same physical surface gets a single rim.
  function boundary(polys){
    const edges=polys.flatMap((p,id)=>p.map((a,i)=>({a,b:p[(i+1)%p.length],id}))),result=[];
    const cross=(x,y,u,v)=>x*v-y*u,contains=(x,y)=>polys.some(p=>inside(x,y,p));
    for(const e of edges){const dx=e.b[0]-e.a[0],dy=e.b[1]-e.a[1],length=Math.hypot(dx,dy),cuts=[0,1];
      for(const f of edges){if(e.id===f.id)continue;const ux=f.b[0]-f.a[0],uy=f.b[1]-f.a[1],den=cross(dx,dy,ux,uy);if(Math.abs(den)<1e-8)continue;
        const qx=f.a[0]-e.a[0],qy=f.a[1]-e.a[1],t=cross(qx,qy,ux,uy)/den,u=cross(qx,qy,dx,dy)/den;if(t>0&&t<1&&u>=0&&u<=1)cuts.push(t);
      }
      cuts.sort((a,b)=>a-b);for(let i=1;i<cuts.length;i++){const lo=cuts[i-1],hi=cuts[i];if((hi-lo)*length<.1)continue;const t=(lo+hi)/2,x=e.a[0]+dx*t,y=e.a[1]+dy*t,nx=-dy/length*.2,ny=dx/length*.2;
        if(contains(x+nx,y+ny)===contains(x-nx,y-ny))continue;
        result.push([[e.a[0]+dx*lo,e.a[1]+dy*lo],[e.a[0]+dx*hi,e.a[1]+dy*hi]]);
      }
    }return result;
  }
  const materialCache=new Map();
  function material(id){
    if(materialCache.has(id))return materialCache.get(id);const im=images[id];if(!RoomVisualArt.ready(im))return null;
    // Periodic edge blending keeps every wall upright in the same projection.
    // Complementary feather weights add to one, including the four corners.
    const w=1024,h=683,overlap=80,source=canvas(w,h),sc=source.getContext('2d');sc.drawImage(im,0,0,w,h);sc.globalCompositeOperation='destination-in';
    for(const [horizontal,length]of [[true,w],[false,h]]){const gr=sc.createLinearGradient(0,0,horizontal?w:0,horizontal?0:h);gr.addColorStop(0,'rgba(0,0,0,0)');gr.addColorStop(overlap/length,'#000');gr.addColorStop(1-overlap/length,'#000');gr.addColorStop(1,'rgba(0,0,0,0)');sc.fillStyle=gr;sc.fillRect(0,0,w,h);}
    const a=canvas(w-overlap,h-overlap),c=a.getContext('2d');c.globalCompositeOperation='lighter';
    for(const y of [0,-a.height])for(const x of [0,-a.width])c.drawImage(source,x,y);
    c.globalCompositeOperation='source-over';
    c.fillStyle='rgba(5,9,18,.23)';c.fillRect(0,0,a.width,a.height);materialCache.set(id,a);return a;
  }
  const terrainCache=new WeakMap(),chunkSize=512;
  function terrain(j){
    if(terrainCache.has(j))return terrainCache.get(j);const w=SeamlessFloor.width/8,h=SeamlessFloor.height/8,ids=[...new Set(j.rooms.map(r=>r.biome))],masks={};
    for(const id of ids)masks[id]=canvas(w,h);
    const buffers=ids.map(id=>masks[id].getContext('2d').createImageData(w,h)),groups=ids.map(id=>j.rooms.filter(r=>r.biome===id));
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      const ds=groups.map(rooms=>Math.min(...rooms.map(r=>(r.center.x-x*8)**2+(r.center.y-y*8)**2))),min=Math.min(...ds),weights=ds.map(d=>Math.exp(-(d-min)/90000)),sum=weights.reduce((a,b)=>a+b,0),i=(y*w+x)*4;
      weights.forEach((v,k)=>{const d=buffers[k].data;d[i]=255;d[i+1]=255;d[i+2]=255;d[i+3]=Math.round(v/sum*255);});
    }
    ids.forEach((id,i)=>masks[id].getContext('2d').putImageData(buffers[i],0,0));
    const t={masks,ids,chunks:new Map()};terrainCache.set(j,t);return t;
  }
  function background(c,j,view){
    if(![...new Set(j.rooms.map(r=>r.biome))].every(id=>material(id))){c.fillStyle='#142c33';c.fillRect(view.x,view.y,view.w,view.h);return;}
    const t=terrain(j),minX=Math.floor(Math.max(0,view.x)/chunkSize),minY=Math.floor(Math.max(0,view.y)/chunkSize),maxX=Math.floor(Math.min(SeamlessFloor.width-1,view.x+view.w)/chunkSize),maxY=Math.floor(Math.min(SeamlessFloor.height-1,view.y+view.h)/chunkSize);
    c.fillStyle='#101923';c.fillRect(view.x,view.y,view.w,view.h);
    for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++){
      const key=x+','+y;let chunk=t.chunks.get(key);
      if(!chunk){chunk=canvas(chunkSize,chunkSize);const cc=chunk.getContext('2d'),temp=canvas(chunkSize,chunkSize),tc=temp.getContext('2d');
        for(const id of t.ids){
          tc.globalCompositeOperation='source-over';tc.clearRect(0,0,chunkSize,chunkSize);tc.save();tc.translate(-x*chunkSize,-y*chunkSize);tc.fillStyle=tc.createPattern(material(id),'repeat');tc.fillRect(x*chunkSize,y*chunkSize,chunkSize,chunkSize);tc.restore();
          tc.globalCompositeOperation='destination-in';tc.drawImage(t.masks[id],-x*chunkSize,-y*chunkSize,SeamlessFloor.width,SeamlessFloor.height);
          cc.globalCompositeOperation='lighter';cc.drawImage(temp,0,0);
        }t.chunks.set(key,chunk);if(t.chunks.size>12)t.chunks.delete(t.chunks.keys().next().value);
      }else {t.chunks.delete(key);t.chunks.set(key,chunk);}
      c.drawImage(chunk,x*chunkSize,y*chunkSize);
    }
  }
  function rgba(hex,alpha){return 'rgba('+[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)).join(',')+','+alpha+')';}
  function ground(c,g,rooms,corridors,view){
    const polys=[...rooms.flatMap(r=>r.polygons),...corridors.map(l=>l.polygon)],bounds=g.map.boundary.filter(([a,b])=>Math.max(a[0],b[0])>view.x-50&&Math.min(a[0],b[0])<view.x+view.w+50&&Math.max(a[1],b[1])>view.y-50&&Math.min(a[1],b[1])<view.y+view.h+50);
    c.save();c.lineCap='round';c.lineJoin='round';
    c.beginPath();for(const [a,b]of bounds){c.moveTo(a[0],a[1]+16);c.lineTo(b[0],b[1]+16);}c.strokeStyle='#101a21';c.lineWidth=30;c.stroke();
    if(RoomVisualArt.ready(slate)){const lip=c.createPattern(slate,'repeat');lip.setTransform({a:.18,b:0,c:0,d:.12,e:0,f:0});c.save();c.globalAlpha=.42;c.strokeStyle=lip;c.lineWidth=26;c.stroke();c.restore();}
    c.beginPath();for(const p of polys)path(c,p);c.fillStyle='#4c4c58';c.fill();
    const tile=['eclipse','storm','tide','glass'].includes(g.journey.levelId)?eclipseSlate:slate;
    if(RoomVisualArt.ready(tile)){const p=c.createPattern(tile,'repeat');p.setTransform({a:.37,b:.185,c:-.37,d:.185,e:0,f:0});c.fillStyle=p;c.fill();}
    for(const l of corridors){const a=BiomeV3.biomes[g.journey.rooms[l.a].biome],b=BiomeV3.biomes[g.journey.rooms[l.b].biome],gr=c.createLinearGradient(l.from.x,l.from.y,l.to.x,l.to.y);gr.addColorStop(0,rgba(a.floor,.30));gr.addColorStop(1,rgba(b.floor,.30));c.beginPath();path(c,l.polygon);c.fillStyle=gr;c.fill();}
    for(const r of rooms){const b=BiomeV3.biomes[r.biome];c.beginPath();for(const p of r.polygons)path(c,p);c.fillStyle=rgba(b.floor,.30);c.fill();
      c.save();c.clip();c.translate(r.center.x,r.center.y);
      // Inlaid bands differ by silhouette. Their low contrast leaves actors and
      // attack telegraphs as the brightest elements of the combat floor.
      c.strokeStyle=rgba(b.accent,.22);c.lineWidth=2;
      if(r.biome==='amber'){
        for(const y of [-125,130]){c.strokeRect(-250,y,500,7);for(let x=-225;x<250;x+=50){c.beginPath();c.moveTo(x,y-9);c.lineTo(x+10,y);c.lineTo(x,y+9);c.stroke();}}
        if(r.design.shape!=='urnhall')for(const rad of [85,130]){c.beginPath();c.ellipse(0,0,rad,rad*.5,0,0,Math.PI*2);c.stroke();}
      }else if(r.biome==='glass'){
        for(let i=0;i<6;i++){const a=i*Math.PI/3;c.beginPath();c.ellipse(Math.cos(a)*65,Math.sin(a)*32,90,38,a*.25,0,Math.PI*2);c.stroke();}
        for(const x of [-220,220]){c.beginPath();c.moveTo(x,-120);c.bezierCurveTo(x-35,-20,x+35,40,x,130);c.stroke();}
      }else if(r.biome==='tide'){
        c.strokeStyle='rgba(192,205,175,.24)';
        if(['tidalhall','archive'].includes(r.design.shape)){for(const y of [-118,128]){c.beginPath();c.moveTo(-255,y);c.bezierCurveTo(-80,y-25,80,y+25,255,y);c.stroke();}}
        else for(const radius of [80,120,160]){c.beginPath();c.ellipse(0,0,radius,radius*.48,-.16,0,Math.PI*1.7);c.stroke();}
        for(let i=0;i<14;i++){const a=i*2.399+r.id,x=Math.cos(a)*315,y=Math.sin(a)*178;c.fillStyle='rgba(73,127,115,.2)';c.beginPath();c.ellipse(x,y,23,8,a,0,Math.PI*2);c.fill();}
      }else if(r.biome==='sunforge'){
        c.strokeStyle='rgba(205,142,83,.23)';
        if(['solarwheel','solarcrucible'].includes(r.design.shape)){for(const radius of [94,158]){c.beginPath();c.ellipse(0,0,radius,radius*.53,0,0,Math.PI*2);c.stroke();}for(let i=0;i<12;i++){const a=i*Math.PI/6;c.beginPath();c.moveTo(Math.cos(a)*174,Math.sin(a)*92);c.lineTo(Math.cos(a+.12)*214,Math.sin(a+.12)*113);c.stroke();}}
        else for(const x of [-205,205]){c.strokeRect(x,-130,10,260);for(let y=-120;y<130;y+=36){c.fillStyle='rgba(210,156,86,.22)';c.fillRect(x+3,y,4,4);}}
      }else if(r.biome==='storm'){
        c.strokeStyle='rgba(219,213,177,.26)';
        if(r.design.shape==='rampart'){for(const x of [-220,220])c.strokeRect(x,-135,10,270);}
        else {for(const radius of [84,150]){c.beginPath();c.ellipse(0,0,radius,radius*.54,0,0,Math.PI*2);c.stroke();}for(let i=0;i<8;i++){const a=i*Math.PI/4;c.beginPath();c.moveTo(Math.cos(a)*160,Math.sin(a)*86);c.lineTo(Math.cos(a)*195,Math.sin(a)*105);c.stroke();}}
        for(let i=0;i<18;i++){const a=i*2.399+r.id,x=Math.cos(a)*320,y=Math.sin(a)*178;c.fillStyle='rgba(206,219,224,.17)';c.beginPath();path(c,[[x-14,y],[x,y-4],[x+26,y+1],[x+8,y+7]]);c.fill();}
      }else if(r.biome==='rootvault'){
        c.strokeStyle='rgba(195,167,108,.22)';
        if(r.design.shape==='belfry'){for(const x of [-210,210])c.strokeRect(x,-150,14,300);}
        else for(let i=0;i<6;i++){c.save();c.rotate(i*Math.PI/3);c.beginPath();c.moveTo(0,0);c.bezierCurveTo(45,-26,80,-10,130,0);c.bezierCurveTo(80,10,45,26,0,0);c.stroke();c.restore();}
        for(let i=0;i<20;i++){const a=i*2.399+r.id,x=Math.cos(a)*315,y=Math.sin(a)*175;c.fillStyle=i%2?'rgba(125,56,46,.5)':'rgba(187,114,65,.26)';c.beginPath();path(c,[[x,y-4],[x+11,y],[x+4,y+6],[x-6,y+2]]);c.fill();}
      }else if(r.biome==='eclipse'){
        c.strokeStyle='rgba(212,193,139,.24)';
        if(r.design.shape==='archive'){
          for(const y of [-118,130]){c.strokeRect(-235,y,470,9);for(let x=-220;x<=220;x+=44){c.beginPath();path(c,[[x,y-9],[x+7,y],[x,y+9],[x-7,y]]);c.stroke();}}
        }else if(['orrery','observatory'].includes(r.design.shape)){
          for(const rad of [96,143,190]){c.beginPath();c.ellipse(0,0,rad,rad*.54,0,0,Math.PI*2);c.stroke();}
          for(let i=0;i<12;i++){const a=i*Math.PI/6;c.beginPath();c.moveTo(Math.cos(a)*151,Math.sin(a)*82);c.lineTo(Math.cos(a)*181,Math.sin(a)*98);c.stroke();}
        }else{
          c.beginPath();c.ellipse(0,-8,135,68,-.18,.2,Math.PI*1.55);c.stroke();
          c.beginPath();c.ellipse(25,-12,106,52,-.18,.2,Math.PI*1.55);c.stroke();
        }
        c.beginPath();path(c,[[0,-54],[13,-9],[82,0],[13,9],[0,54],[-13,9],[-82,0],[-13,-9]]);c.stroke();
        // Broken inlay and scattered chips stay at the perimeter of the arena.
        for(let i=0;i<14;i++){const a=i*2.399+r.id,x=Math.cos(a)*305,y=Math.sin(a)*170;c.fillStyle=i%3?'rgba(158,173,195,.13)':'rgba(206,185,131,.2)';c.beginPath();path(c,[[x,y],[x+12,y-4],[x+18,y+1],[x+5,y+5]]);c.fill();}
      }else if(r.design.shape==='longhall'){
        c.beginPath();path(c,[[-102,0],[0,-56],[102,0],[0,56]]);c.stroke();c.beginPath();path(c,[[-78,0],[0,-40],[78,0],[0,40]]);c.stroke();
      }else {c.beginPath();c.ellipse(0,0,r.id%2?105:125,r.id%2?56:67,0,0,Math.PI*2);c.stroke();c.beginPath();path(c,[[0,-60],[16,-10],[95,0],[16,10],[0,60],[-16,10],[-95,0],[-16,-10]]);c.stroke();}
      c.restore();
    }
    c.beginPath();for(const [a,b]of bounds){c.moveTo(...a);c.lineTo(...b);}c.strokeStyle='#17232a';c.lineWidth=9;c.stroke();c.strokeStyle='rgba(165,162,139,.48)';c.lineWidth=1.5;c.stroke();
    // A few vertical joints give the exposed stone lip depth without outlining
    // the invisible joins between overlapping floor polygons.
    for(const [a,b]of bounds){const n=Math.floor(Math.hypot(b[0]-a[0],b[1]-a[1])/56);for(let i=0;i<n;i++){const t=(i+.5)/n,x=a[0]+(b[0]-a[0])*t,y=a[1]+(b[1]-a[1])*t;c.strokeStyle='#28353a';c.lineWidth=2;c.beginPath();c.moveTo(x,y+6);c.lineTo(x,y+23);c.stroke();}}
    c.restore();
  }
  function light(c,o,time){
    if(!['forge','cistern','books','moonwell','crystal','astrolabe','fungi','rootpool','stormforge','stormbeacon','tidebasin','sunfurnace','slagbasin','amberbasin','glassbasin'].includes(o.sprite)&&!o.landmark)return;
    const b=BiomeV3.biomes[o.biome],radius=o.landmark?154:95,gr=c.createRadialGradient(o.x,o.y-8,0,o.x,o.y-8,radius);
    gr.addColorStop(0,rgba(b.accent,.12+Math.sin(time*2+o.x)*.015));gr.addColorStop(1,rgba(b.accent,0));c.fillStyle=gr;c.fillRect(o.x-radius,o.y-radius-8,radius*2,radius*2);
  }
  function prop(c,o,player,time=0){
    const s=sprites[o.sprite],a=s?.image||(s?.storm?stormSheet:s?.rootvault?rootSheet:s?.eclipse?eclipseSheet:atlas());if(!RoomVisualArt.ready(a)||!s)return;
    const [sx,sy,sw,sh]=s.rect,h=o.height,w=sw/sh*h;
    c.save();c.fillStyle='rgba(3,9,14,.46)';c.beginPath();c.ellipse(o.x+9,o.y+5,w*.40,Math.max(8,w*.12),-.06,0,Math.PI*2);c.fill();
    if(player&&player.y<o.y&&player.y>o.y-h&&Math.abs(player.x-o.x)<w*.43)c.globalAlpha=.38;
    c.drawImage(a,sx,sy,sw,sh,o.x-w/2,o.y-h+9,w,h);
    if(o.sprite==='astrolabe'){
      const cx=o.x,cy=o.y-h*.64,radius=w*.29,angle=time*.35+o.x;
      c.strokeStyle='rgba(188,190,239,.36)';c.lineWidth=1;c.beginPath();c.ellipse(cx,cy,radius,radius*.37,-.5,0,Math.PI*2);c.stroke();
      c.fillStyle='#d5c5f1';c.beginPath();c.arc(cx+Math.cos(angle)*radius,cy+Math.sin(angle)*radius*.37,2,0,Math.PI*2);c.fill();
    }c.restore();
  }
  return {images,sheet,eclipseSheet,tideSheet,forgeSheet,amberSheet,glassSheet,slate,atlas,shapes,sprites,populate,rimDecor,boundary,background,ground,prop,light};
})();


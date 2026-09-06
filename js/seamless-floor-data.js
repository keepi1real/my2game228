'use strict';
// One physical floor: the graph is embedded into world space once. Corridors
// are walkable polygons, not interaction triggers or destinations for teleports.
const SeamlessFloor=(()=>{
  const positions=[[0,4],[1,4],[2,4],[1,3],[3,3],[0,3],[1,2],[3,2],[2,2],[2,1],[4,2],[1,0],[3,0],[2,-1],[3,-1],[4,-1]];
  const key='undermountain-biomes-v3',width=4736,height=4032,cell=256,bridgeHalf=124;
  function segment(a,b,half=bridgeHalf){const n=Math.hypot(b.x-a.x,b.y-a.y),dx=(b.y-a.y)/n*half,dy=-(b.x-a.x)/n*half;return [[a.x+dx,a.y+dy],[b.x+dx,b.y+dy],[b.x-dx,b.y-dy],[a.x-dx,a.y-dy]];}
  function create(seed,levelId='undermountain'){
    const level=ExpeditionLevels.get(levelId);if(!level)throw Error('Unknown expedition level: '+levelId);
    const j=RoomRoute.create(seed);j.version=4;j.levelId=levelId;j.seamless=true;j.transition=0;j.current=null;
    const eclipse=levelId==='eclipse',rootvault=levelId==='rootvault';
    j.notice='Исследуйте Подгорье. Сундуки и родники — E, карта — M.';j.noticeTime=6;
    if(rootvault)j.notice='Багряный корнесвод. Звонарь — награда в ответвлении. Матерь корней — путь к лестнице.';
    if(eclipse)j.notice='Обсерватория затмения. Найдите Астронома Пустоты. Карта — M.';
    if(level.notice)j.notice=level.notice;
    for(const r of j.rooms){
      [r.x,r.y]=positions[r.id];r.origin={x:128+r.x*864,y:128+(r.y+1)*624};
      if(eclipse){r.x=4-r.x;r.origin={x:128+r.x*832,y:128+(r.y+1)*576};}
      if(rootvault)r.origin={x:128+r.x*816,y:128+(r.y+1)*552};
      if(level.positions){[r.x,r.y]=level.positions[r.id];r.origin={x:128+r.x*level.spacing[0],y:128+(r.y+1)*level.spacing[1]};}
      const local=RoomRoute.geometry(r);r.templateData=local.template;
      r.center={x:r.origin.x+512,y:r.origin.y+365};
      r.design=level.rooms?level.rooms[r.id]:BiomeV3.forRoom(r.id);r.name=r.design.name;r.biome=r.design.biome;
      r.polygons=r.id===15&&levelId==='undermountain'?local.polygons.map(poly=>poly.map(([x,y])=>[x+r.origin.x,y+r.origin.y])):[BiomeArtV3.shapes[r.design.shape].map(([x,y])=>[x+r.center.x,y+r.center.y])];
      r.obstacles=[];r.decor=[];
      r.restPoint={x:r.center.x,y:r.center.y+52};
      r.chestPoint={x:r.center.x+110,y:r.center.y+75};
      if(level.features?.[r.id]){
        r.feature=level.features[r.id];r.featurePoint={x:r.center.x-115,y:r.center.y+65};r.featureUsePoint={x:r.featurePoint.x,y:r.featurePoint.y+88};
        if(r.feature.kind!=='beacon')r.role='event';
      }
      r.active=false;r.initialized=true;r.cleared=!['combat','elite','boss'].includes(r.role);r.world=null;
    }
    const edges=level.edges||(rootvault?[...RoomRoute.edges.filter(([a,b])=>!((a===11&&b===13)||(a===13&&b===14))),[11,12],[12,14],[4,10],[1,5]]:eclipse?[...RoomRoute.edges,[1,5],[4,10]]:RoomRoute.edges);
    for(const r of j.rooms)r.links=[];for(const [a,b]of edges){j.rooms[a].links.push(b);j.rooms[b].links.push(a);}
    j.corridors=edges.map(([a,b],id)=>{
      const from=j.rooms[a].center,to=j.rooms[b].center,half=112+id%3*12;
      const dx=to.x-from.x,dy=to.y-from.y,n=Math.hypot(dx,dy),nx=-dy/n,ny=dx/n;
      // Flared landings and a wider middle court, all part of the real floor.
      const stations=[[0,half+40],[.32,half],[.5,half+(level.passageFlare??(rootvault?86:eclipse?70:id%2?48:24))],[.68,half],[1,half+40]];
      const side=s=>stations.map(([t,w])=>[from.x+dx*t+nx*w*s,from.y+dy*t+ny*w*s]);
      const polygon=[...side(1),...side(-1).reverse()];polygon.reverse();
      return {id,a,b,from,to,half,polygon};
    });
    BiomeArtV3.populate(j);
    for(const r of j.rooms)if(r.feature){const s=BiomeArtV3.sprites[r.feature.sprite],o={...r.featurePoint,kind:'biome-prop',sprite:r.feature.sprite,height:s.height,r:s.r,homeRoom:r.id,biome:r.biome,featureRoom:r.id};r.decor.push(o);r.obstacles.push(o);}
    return j;
  }
  function mapFor(j){
    const map=new GameMap(width/TILE,height/TILE);map.seamless=true;map.rooms=j.rooms;map.corridors=j.corridors;
    map.obstacles=j.rooms.flatMap(r=>r.obstacles);map.decor=j.rooms.flatMap(r=>r.decor);map.polygons=[...j.rooms.flatMap(r=>r.polygons),...j.corridors.map(c=>c.polygon)];
    map.boundary=BiomeArtV3.boundary(map.polygons);
    const buckets=new Map(),obstacles=new Map();
    function register(table,entry,minX,minY,maxX,maxY){for(let y=Math.floor(minY/cell);y<=Math.floor(maxY/cell);y++)for(let x=Math.floor(minX/cell);x<=Math.floor(maxX/cell);x++){const key=x+','+y;if(!table.has(key))table.set(key,[]);table.get(key).push(entry);}}
    for(const p of map.polygons)register(buckets,p,Math.min(...p.map(q=>q[0])),Math.min(...p.map(q=>q[1])),Math.max(...p.map(q=>q[0])),Math.max(...p.map(q=>q[1])));
    for(const o of map.obstacles)register(obstacles,o,o.x-o.r-40,o.y-o.r-40,o.x+o.r+40,o.y+o.r+40);
    map.floorContains=(x,y)=>(buckets.get(Math.floor(x/cell)+','+Math.floor(y/cell))||[]).some(p=>RoomVisualArt.inside(x,y,p));
    const originalObstacles=map.obstacles.length;BiomeArtV3.rimDecor(map,j);
    for(const o of map.obstacles.slice(originalObstacles))register(obstacles,o,o.x-o.r-40,o.y-o.r-40,o.x+o.r+40,o.y+o.r+40);
    map.circleBlocked=(x,y,r)=>{
      if(!map.floorContains(x,y))return true;
      if((obstacles.get(Math.floor(x/cell)+','+Math.floor(y/cell))||[]).some(o=>Math.hypot(o.x-x,o.y-y)<o.r+r))return true;
      for(let i=0;i<16;i++){const a=i*Math.PI/8;if(!map.floorContains(x+Math.cos(a)*r,y+Math.sin(a)*r))return true;}return false;
    };
    for(let y=0;y<map.h;y++)for(let x=0;x<map.w;x++)map.set(x,y,map.circleBlocked((x+.5)*TILE,(y+.5)*TILE,24)?T_WALL:T_FLOOR);
    // Eroded navigation can leave isolated single cells between two perimeter
    // props. They are not useful AI destinations; physical collision still uses
    // the exact polygons and circles, so the smaller player can pass naturally.
    const start=spawn(j),nav=GameMap.prototype.flowField.call(map,Math.floor(start.x/TILE),Math.floor(start.y/TILE));map.prunedNavCells=0;
    for(let i=0;i<map.tiles.length;i++)if(map.tiles[i]===T_FLOOR&&nav[i]<0){map.tiles[i]=T_WALL;map.prunedNavCells++;}
    map.roomAt=(x,y)=>j.rooms.find(r=>r.polygons.some(p=>RoomVisualArt.inside(x,y,p)))||null;
    map.updateVisibility=(tx,ty)=>{
      map.visible.fill(0);
      for(let y=Math.max(0,ty-21);y<=Math.min(map.h-1,ty+21);y++)for(let x=Math.max(0,tx-24);x<=Math.min(map.w-1,tx+24);x++){
        const i=map.idx(x,y);map.visible[i]=1;if((x-tx)**2+(y-ty)**2<21**2)map.explored[i]=1;
      }
    };
    const baseFlow=GameMap.prototype.flowField;
    map.flowField=(tx,ty)=>{
      if(map.isWall(tx,ty)){
        let best=null;
        for(let y=ty-4;y<=ty+4;y++)for(let x=tx-4;x<=tx+4;x++)if(!map.isWall(x,y)&&(!best||(x-tx)**2+(y-ty)**2<best.d))best={x,y,d:(x-tx)**2+(y-ty)**2};
        if(best){tx=best.x;ty=best.y;}
      }
      return baseFlow.call(map,tx,ty);
    };
    return map;
  }
  function spawn(j){const r=j.rooms[j.start];return {x:r.center.x,y:r.center.y+110};}
  return {create,mapFor,spawn,segment,key,width,height,bridgeHalf};
})();


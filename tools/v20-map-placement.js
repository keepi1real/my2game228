// Deterministic presentation-only placements. Load before v20-map-art.js.
(() => {
  'use strict';
  if (window.V20MapPlacement) return;
  const MAX_MARKS = 12, MAX_CANDIDATES = 96;
  const EMPTY = Object.freeze([]), cache = new WeakMap();
  const metrics = {rooms:0,candidates:0,marks:0,cacheHits:0};
  function hash(seed, index) {
    let x = (seed ^ Math.imul(index + 1, 0x9e3779b9)) >>> 0;
    x ^= x >>> 16; x = Math.imul(x, 0x7feb352d);
    x ^= x >>> 15; x = Math.imul(x, 0x846ca68b);
    return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
  }
  function segmentDistance(x,y,a,b) {
    const dx=b[0]-a[0],dy=b[1]-a[1],len=dx*dx+dy*dy;
    const t=len ? Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/len)) : 0;
    return Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy);
  }
  function inside(x,y,poly) {
    let yes=false;
    for(let i=0,k=poly.length-1;i<poly.length;k=i++) {
      const a=poly[i],b=poly[k];
      if((a[1]>y)!==(b[1]>y) && x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])yes=!yes;
    }
    return yes;
  }
  function boundaryDistance(x,y,poly) {
    let best=Infinity;
    for(let i=0;i<poly.length;i++) best=Math.min(best,segmentDistance(x,y,poly[i],poly[(i+1)%poly.length]));
    return best;
  }
  function allowed(j,room,p,accepted=EMPTY) {
    const radius=p.radius;
    // A full disc must fit inside one room polygon. This is conservative around
    // overlapping polygons and exact for edges, unlike sampling a few angles.
    if(!(room.polygons||[]).some(poly=>inside(p.x,p.y,poly)&&boundaryDistance(p.x,p.y,poly)>=radius+10))return false;
    // Keep the entire reinforcement grid quiet, not just its current occupants.
    const dx=Math.max(0,Math.abs(p.x-room.center.x)-336);
    const dy=Math.max(0,Math.abs(p.y-room.center.y)-168);
    if(Math.hypot(dx,dy)<radius+28)return false;
    for(const corridor of j.corridors||[]) {
      if(corridor.polygon?.length) {
        if(inside(p.x,p.y,corridor.polygon)||boundaryDistance(p.x,p.y,corridor.polygon)<radius+36)return false;
      } else if(corridor.from&&corridor.to && segmentDistance(p.x,p.y,[corridor.from.x,corridor.from.y],[corridor.to.x,corridor.to.y])<(corridor.half||124)+radius+36)return false;
    }
    const points=[room.center,room.restPoint,room.chestPoint,room.featurePoint,room.featureUsePoint,
      {x:room.center.x,y:room.center.y+110}];
    if(points.some(q=>q&&Math.hypot(p.x-q.x,p.y-q.y)<radius+100))return false;
    if((room.obstacles||[]).some(q=>Math.hypot(p.x-q.x,p.y-q.y)<radius+(q.r||0)+24))return false;
    if(accepted.some(q=>Math.hypot(p.x-q.x,p.y-q.y)<radius+q.radius+22))return false;
    return true;
  }
  function forRoom(j,room) {
    if(j?.v20MapVersion!==20||!room?.polygons?.length)return EMPTY;
    let rooms=cache.get(j);if(!rooms){rooms=new WeakMap();cache.set(j,rooms);}
    if(rooms.has(room)){metrics.cacheHits++;return rooms.get(room);}
    let seed=(j.seed^Math.imul(room.id+1,0x85ebca6b))>>>0;
    for(const ch of String(j.levelId||''))seed=(Math.imul(seed,31)^ch.charCodeAt(0))>>>0;
    const marks=[];let attempts=0;
    // Generate at most 96 edge candidates once, never from the render loop RNG.
    for(const poly of room.polygons) {
      for(let edge=0;edge<poly.length&&marks.length<MAX_MARKS&&attempts<MAX_CANDIDATES;edge++) {
        const a=poly[edge],b=poly[(edge+1)%poly.length],length=Math.hypot(b[0]-a[0],b[1]-a[1]);
        const count=Math.min(12,Math.max(1,Math.floor(length/70)));
        for(let n=0;n<count&&marks.length<MAX_MARKS&&attempts<MAX_CANDIDATES;n++) {
          const index=attempts++,scale=.6+hash(seed,index*3)*.8,radius=22*scale;
          const t=(n+.2+hash(seed,index*3+1)*.6)/count;
          let x=a[0]+(b[0]-a[0])*t,y=a[1]+(b[1]-a[1])*t;
          const vx=room.center.x-x,vy=room.center.y-y,d=Math.hypot(vx,vy)||1;
          x+=vx/d*(radius+16);y+=vy/d*(radius+16);
          const p={x,y,angle:Math.atan2(b[1]-a[1],b[0]-a[0]),scale,radius,
            variant:Math.floor(hash(seed,index*3+2)*4),kind:index%3===0?'cluster':'rim'};
          if(allowed(j,room,p,marks))marks.push(Object.freeze(p));
        }
      }
      if(marks.length>=MAX_MARKS||attempts>=MAX_CANDIDATES)break;
    }
    const result=Object.freeze(marks);rooms.set(room,result);
    metrics.rooms++;metrics.candidates+=attempts;metrics.marks+=marks.length;
    return result;
  }
  window.V20MapPlacement=Object.freeze({version:20,forRoom,allowed,metrics,MAX_MARKS,MAX_CANDIDATES});
})();

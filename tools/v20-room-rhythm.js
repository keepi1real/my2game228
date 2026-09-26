// Ground-only encounter cues. Install after v20-map-placement.js and v20-map-art.js.
// All marks reuse collision-safe cached placement slots; no journey state is written.
(() => {
  'use strict';
  if (window.V20RoomRhythm) return;
  const cache=new WeakMap(), EMPTY=Object.freeze([]);
  const quotas=Object.freeze({start:1,rest:1,treasure:2,event:2,combat:3,elite:4,boss:0});
  const tint=Object.freeze({roots:'#a5c5a4',bastion:'#d4bf96',forge:'#e4ad7e'});
  function hash(seed,id){
    let v=((seed>>>0)^Math.imul(id+1,0x9e3779b9))>>>0;
    v^=v>>>16;v=Math.imul(v,0x7feb352d);v^=v>>>15;
    return (v^Math.imul(v,0x846ca68b))>>>0;
  }
  function forRoom(j,r){
    if(j?.v20MapVersion!==20||!r||r.id===15)return EMPTY;
    let rooms=cache.get(j);if(!rooms){rooms=new WeakMap();cache.set(j,rooms);}
    if(rooms.has(r))return rooms.get(r);
    const slots=window.V20MapPlacement?.forRoom(j,r)||EMPTY;
    const quota=quotas[r.role]||0, start=slots.length?hash(j.seed,r.id)%slots.length:0;
    const marks=[];
    // A stride of one avoids retries and makes a bounded selection even in a
    // narrow chamber with fewer than four valid slots.
    for(let i=0;i<Math.min(quota,slots.length);i++){
      const p=slots[(start+i)%slots.length];
      marks.push(Object.freeze({x:p.x,y:p.y,radius:Math.min(13,p.radius*.56),role:r.role}));
    }
    const result=Object.freeze(marks);rooms.set(r,result);return result;
  }
  const oldGround=BiomeArtV3.ground;
  BiomeArtV3.ground=function(c,g,rooms,corridors,view){
    const result=oldGround.apply(this,arguments),j=g?.journey;
    if(j?.v20MapVersion!==20||!view||!c)return result;
    for(const r of rooms||[]){
      const color=tint[r.biome];if(!color)continue;
      for(const m of forRoom(j,r)){
        if(m.x+m.radius<view.x||m.y+m.radius<view.y||m.x-m.radius>view.x+view.w||m.y-m.radius>view.y+view.h)continue;
        c.save();c.translate(m.x,m.y);c.rotate(((hash(j.seed,r.id)&3)-1.5)*.12);
        c.strokeStyle=color;c.globalAlpha=m.role==='elite'?.35:.22;c.lineWidth=1.25;
        // Small angular inlays communicate encounter intensity from the flank.
        // Each stroke fits inside the slot's existing collision-safe radius.
        const n=m.role==='elite'?3:m.role==='combat'?2:1;
        for(let i=0;i<n;i++){
          const x=(i-(n-1)/2)*6;
          c.beginPath();c.moveTo(x-3,4);c.lineTo(x,-4);c.lineTo(x+3,4);c.stroke();
        }
        c.restore();
      }
    }
    return result;
  };
  window.V20RoomRhythm=Object.freeze({version:20,forRoom,quotas});
})();

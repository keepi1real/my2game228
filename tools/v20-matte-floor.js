/* Presentation only. Install after v20-map-art. Ground finishes before real
 * telegraphs and Y-sorted actors; no new geometry, RNG, assets or saved state. */
(() => {
  'use strict';
  if (window.V20MatteFloor) return;
  const profiles = Object.freeze({
    roots: '#102b26', bastion: '#232932', forge: '#2e2026', glass: '#1e293b'
  });
  const cache = new WeakMap();
  const metrics = {rooms: 0};
  function bounds(room) {
    if (cache.has(room)) return cache.get(room);
    let x=Infinity,y=Infinity,right=-Infinity,bottom=-Infinity;
    for (const polygon of room.polygons || []) for (const point of polygon) {
      x=Math.min(x,point[0]); y=Math.min(y,point[1]);
      right=Math.max(right,point[0]); bottom=Math.max(bottom,point[1]);
    }
    const result={x,y,right,bottom}; cache.set(room,result); return result;
  }
  function rgba(hex,alpha) {
    return `rgba(${parseInt(hex.slice(1,3),16)},${parseInt(hex.slice(3,5),16)},${parseInt(hex.slice(5,7),16)},${alpha})`;
  }
  const ground=BiomeArtV3.ground;
  BiomeArtV3.ground=function(c,g,rooms,corridors,view) {
    const result=ground.apply(this,arguments);
    metrics.rooms=0;
    if (g?.journey?.v20MapVersion!==20) return result;
    for (const room of rooms) {
      const color=profiles[room.biome];
      if (!color || !room.polygons?.length) continue;
      const b=bounds(room);
      const x=Math.max(b.x,view.x), y=Math.max(b.y,view.y);
      const right=Math.min(b.right,view.x+view.w), bottom=Math.min(b.bottom,view.y+view.h);
      if (!(right>x && bottom>y)) continue;
      c.save();
      try {
        c.globalAlpha=1; c.globalCompositeOperation='source-over';
        c.beginPath();
        for (const polygon of room.polygons) {
          polygon.forEach(([px,py],i)=>i?c.lineTo(px,py):c.moveTo(px,py));
          c.closePath();
        }
        c.clip();
        // A broad, static material finish with no boundary, pulse or floor ring.
        // The centre loses 40% of texture contrast; the rim retains its details.
        // Coordinates belong to the room, so the finish never follows the camera.
        const glaze=c.createLinearGradient(0,b.y,0,b.bottom);
        for (const [at,alpha] of [[0,.08],[.18,.24],[.36,.4],[.64,.4],[.82,.24],[1,.08]])
          glaze.addColorStop(at,rgba(color,alpha));
        c.fillStyle=glaze; c.fillRect(x,y,right-x,bottom-y);
        metrics.rooms++;
      } finally { c.restore(); }
    }
    return result;
  };
  window.V20MatteFloor=Object.freeze({version:20,profiles,metrics});
})();

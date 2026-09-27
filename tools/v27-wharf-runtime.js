/* Drowned wharf: isolated chapter geometry. Rebuilt from seed and level ID on
 * start/resume; no new save schema or global route/storage mutation. */
(() => {
  'use strict';
  if (window.V27Wharf) return;
  const ID='drownedwharf';
  WorldDetail.themes[ID]={...WorldDetail.themes.tide,base:'#253a3d',trim:'#a49478',light:'#a5c1bd',water:false};
  RoomCraft.palettes[ID]=['#263b3a','#97846a'];
  for(const row of [0,1])BiomeArtV3.sprites[`detail-${ID}-${row}`]=BiomeArtV3.sprites[`detail-tide-${row}`];
  BiomeArtV3.sprites[`landmark-v15-${ID}`]=BiomeArtV3.sprites['landmark-v15-tide'];
  if(!WorldTour.order.includes(ID))WorldTour.order.push(ID);
  WorldTour.descriptions[ID]='Отмели, мокрые мостки и керамические рёбра недостроенных судов.';
  const roomBounds=SeamlessPaint.roomBounds;
  SeamlessPaint.roomBounds=function(r){
    if(r?.biome!==ID)return roomBounds.apply(this,arguments);
    const points=r.polygons.flat(),xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
    const x=Math.min(...xs),y=Math.min(...ys);return {x:x-10,y:y-150,w:Math.max(...xs)-x+20,h:Math.max(...ys)-y+175};
  };
  const create=SeamlessFloor.create;
  function outline(w,h,k,profile){
    // All shapes contain the legacy 450×262 half-extent room; decoration and
    // reward positions stay valid. Unequal shoreline cuts break stone symmetry.
    if(profile==='slipway')return [[-w+k,-h],[w-35,-h],[w,-h+70],[w,h-38],[w-80,h],[-w+42,h],[-w,h-70],[-w,-h+45]];
    if(profile==='drydock')return [[-w+50,-h],[w-90,-h],[w,-h+50],[w,h-80],[w-45,h],[-w+80,h],[-w,h-45],[-w,-h+85]];
    return [[-w+k,-h],[w-110,-h],[w,-h+80],[w-20,h-100],[w-80,h],[-w+90,h],[-w,h-60],[-w,-h+85]];
  }
  SeamlessFloor.create=function(seed,levelId,...args){
    const j=create.call(this,seed,levelId,...args);
    if(levelId!==ID)return j;
    const level=ExpeditionLevels.get(ID);j.v27WharfVersion=27;
    for(const r of j.rooms){
      const design=level.rooms[r.id],size=design.deckSize||[470+r.id%3*18,280+r.id%2*16];
      r.polygons=[outline(size[0],size[1],55+(r.id%3)*13,design.deckProfile).map(([x,y])=>[x+r.center.x,y+r.center.y])];
      // Six cover sockets keep broad dry arenas readable. This deterministic
      // chapter geometry is reconstructed identically for every save resume.
      const retained=new Set((r.obstacles||[]).slice(0,r.role==='boss'?8:6));
      r.obstacles=(r.obstacles||[]).filter(o=>retained.has(o));
      // Retain only solid prop sockets; painted extra columns without a
      // collision disc would misrepresent the low, open shoreline.
      r.decor=(r.decor||[]).filter(o=>o.kind!=='biome-prop'||(r.obstacles||[]).includes(o));
      for(const [index,o]of (r.decor||[]).entries()){
        if(!(r.obstacles||[]).includes(o))continue;
        o.kind='biome-prop';o.biome=ID;
        o.sprite=o.landmark||o.v15Landmark?'wharf_hull':['wharf_piles','wharf_winch','wharf_hull'][(r.id+index)%3];
        o.height=Math.max(48,Math.min(135,o.r*(o.sprite==='wharf_hull'?3.2:2.4)));
      }
    }
    for(const l of j.corridors){
      const dx=l.to.x-l.from.x,dy=l.to.y-l.from.y,n=Math.hypot(dx,dy),nx=-dy/n,ny=dx/n;
      l.half=112+(l.id%3)*8;
      const stations=[[0,l.half+26],[.25,l.half],[.75,l.half],[1,l.half+26]];
      const side=s=>stations.map(([t,w])=>[l.from.x+dx*t+nx*w*s,l.from.y+dy*t+ny*w*s]);
      l.polygon=[...side(1),...side(-1).reverse()].reverse();
    }
    return j;
  };
  window.V27Wharf=Object.freeze({version:27,id:ID,outline});
})();

// V20 maps: seeded ceramic terraces across the existing sixteen-room chapters.
// A separate mapVersion checkpoint marker keeps gameplay layoutVersion 16:
// combat, reward, validation, and ten-chapter routing all depend on that value.
(() => {
  const VERSION = 20;
  const oldStart = Game.prototype.startSeamlessJourney;
  const oldDescend = Game.prototype.descendSeamlessFloor;
  const oldResume = Game.prototype.resumeSeamlessJourney;
  const oldSave = Game.prototype.saveJourney;
  let mapVariant = false;
  Game.prototype.startSeamlessJourney = function (...args) {
    mapVariant = true;
    try { return oldStart.apply(this, args); }
    finally { mapVariant = false; }
  };
  Game.prototype.descendSeamlessFloor = function (...args) {
    mapVariant = this.journey?.v20MapVersion === VERSION;
    try { return oldDescend.apply(this,args); }
    finally { mapVariant = false; }
  };
  Game.prototype.resumeSeamlessJourney = function (...args) {
    let data;
    try { data=JSON.parse(localStorage.getItem(SeamlessFloor.key)); } catch (_) {}
    mapVariant = data?.mapVersion === VERSION;
    try { return oldResume.apply(this,args); }
    finally { mapVariant = false; }
  };
  Game.prototype.saveJourney = function (...args) {
    const result=oldSave.apply(this,args);
    if (this.journey?.v20MapVersion !== VERSION) return result;
    try {
      const data=JSON.parse(localStorage.getItem(SeamlessFloor.key));
      if (data?.version === 4 && data.seed === this.journey.seed) {
        data.mapVersion=VERSION;
        localStorage.setItem(SeamlessFloor.key,JSON.stringify(data));
      }
    } catch (_) {} // Existing save error handling keeps the running game playable.
    return result;
  };

  const originalCreate = SeamlessFloor.create;
  const originalMapFor = SeamlessFloor.mapFor;
  const hash = (seed, room, index) => {
    let x = (seed ^ Math.imul(room + 1, 0x9e3779b9) ^ Math.imul(index + 1, 0x85ebca6b)) >>> 0;
    x ^= x >>> 16; x = Math.imul(x, 0x7feb352d); x ^= x >>> 15;
    x = Math.imul(x, 0x846ca68b); return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
  };
  const clamp01 = x => Math.max(0, Math.min(1, x));
  const distanceToSegment = (p, a, b) => {
    const dx = b.x - a.x, dy = b.y - a.y;
    const t = clamp01(((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy));
    return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);
  };
  const near = (a,b,range) => a && b && Math.hypot(a.x-b.x,a.y-b.y) < range;
  const schemes = Object.freeze({
    roots:['tree','cistern','obelisk'],bastion:['statue','armory','obelisk'],forge:['forge','armory','wall'],
    eclipse:['moonpillar','crystal','astrolabe'],rootvault:['rootpillar','fungi','bloodtree'],
    storm:['frostpillar','icecluster','frostwall'],tide:['tidebasin','cistern','wall'],
    sunforge:['sunfurnace','forge','slagbasin'],amber:['amberbasin','obelisk','statue'],
    glass:['crystal','moonpillar','glassbasin'],citadel:['armory','statue','wall'],ashen:['obelisk','statue','wall']
  });
  function widenTerraces(j) {
    const rank = Math.max(0, AdventureRun.floor(j)-1);
    for (const r of j.rooms) {
      // Preserve the specially built final room and all graph nodes/links.
      if (r.id === 15 || !r.polygons?.length) continue;
      const outline = r.polygons[0], n = outline.length;
      // Alternate small setbacks and projecting corners. The center stays fixed
      // so corridors continue to overlap the room by hundreds of pixels.
      const phase = hash(j.seed,r.id,101) * Math.PI * 2;
      r.polygons[0] = outline.map(([x,y],i) => {
        const corner = Math.sin(i * 2.39996 + phase);
        const scale = 1 + .035 * corner + .015 * (hash(j.seed,r.id,i)-.5);
        return [r.center.x + (x-r.center.x)*scale,r.center.y+(y-r.center.y)*scale];
      });
      r.v20Map = {pattern:(r.id+rank)%4,threat:Math.min(3,Math.floor((r.id+rank*2)/5))};
    }
  }
  function decorate(j) {
    const rank=Math.max(0,AdventureRun.floor(j)-1);
    for (const r of j.rooms) {
      if (r.id === 15 || r.id === j.start) continue;
      const poly=r.polygons[0], style=schemes[r.biome]||schemes.bastion;
      // Added cover progresses from single flanking columns to offset pairs.
      // The 336 x 168 center combat socket remains clear at every difficulty.
      const count=1+(r.id>5?1:0)+(rank>=5&&r.id>9?1:0);
      const candidates=[[-235,-125],[235,-125],[-250,135],[250,135],[-295,-45],[295,45],[-185,-175],[185,175]];
      const rotated=(r.id*3+Math.floor(hash(j.seed,r.id,60)*candidates.length))%candidates.length;
      let added=0;
      for(let k=0;k<candidates.length&&added<count;k++){
        const [dx,dy]=candidates[(rotated+k*3)%candidates.length];
        const p={x:r.center.x+dx,y:r.center.y+dy};
        const sprite=style[(r.id+k+rank)%style.length];
        const art=BiomeArtV3.sprites[sprite];if(!art)continue;
        const height=Math.min(146,Math.max(80,art.height*(.49+.07*r.v20Map.threat)));
        const radius=Math.min(30,Math.max(17,art.r*height/art.height));
        // Check the entire collision disc. Props never mask doors, prizes,
        // healing, the stage center, or existing scenery.
        if(Math.abs(dx)<200&&Math.abs(dy)<110)continue;
        if(!Array.from({length:12},(_,i)=>i*Math.PI/6).every(a=>RoomVisualArt.inside(p.x+Math.cos(a)*(radius+30),p.y+Math.sin(a)*(radius+30),poly)))continue;
        if(j.corridors.some(l=>distanceToSegment(p,l.from,l.to)<l.half+radius+70))continue;
        if([r.restPoint,r.chestPoint,r.featurePoint,r.featureUsePoint].some(q=>near(p,q,radius+100)))continue;
        if(r.obstacles.some(q=>near(p,q,radius+q.r+54)))continue;
        const o={...p,r:radius,height,sprite,kind:'biome-prop',biome:r.biome,homeRoom:r.id,v20:true};
        r.decor.push(o);r.obstacles.push(o);added++;
      }
    }
  }
  SeamlessFloor.create=function(seed,levelId,layoutVersion,...rest){
    const j=originalCreate.call(this,seed,levelId,layoutVersion,...rest);
    if(!mapVariant)return j;
    j.v20MapVersion=VERSION;
    // Map generation reconstructs these from the seed; saved visits and rewards
    // remain associated with the same persistent room IDs.
    widenTerraces(j);decorate(j);
    return j;
  };
  SeamlessFloor.mapFor=function(j){
    const map=originalMapFor.call(this,j);
    if(j?.v20MapVersion===VERSION)map.v20Geometry=true;
    return map;
  };
  window.V20Maps={version:VERSION,schemes};
})();

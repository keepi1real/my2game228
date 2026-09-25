// Must install BEFORE v20-design.js. Only these two external v20 PNGs are lazy.
(() => {
  'use strict';
  if (window.V20AssetLoading) return;
  if (window.V20Design) throw new Error('v20-asset-loading must precede v20-design');
  const urls = {
    seamCrab:'../assets/v20/seam-crab.png',
    ceramicFloor:'../assets/v20/ceramic-observatory-floor.png'
  };
  const entries = new Map(), byURL = new Map(Object.entries(urls).map(([id,url])=>[url,id]));
  const originalLoad = loadImage;
  function deferred(id) {
    if (entries.has(id)) return entries.get(id);
    const image = new Image(); image.decoding = 'async';
    const entry = {image,url:urls[id],requested:false,failed:false};
    // Failure leaves ready(image) false; old geometry/sprite fallbacks remain.
    // One attempt per document prevents repeated requests from the render loop.
    image.onerror = () => {entry.failed=true;};
    entries.set(id,entry);return entry;
  }
  loadImage = function(src) {
    const id=byURL.get(src);
    return id ? deferred(id).image : originalLoad.apply(this,arguments);
  };
  function request(id) {
    const entry=deferred(id);
    if(!entry.requested) {
      entry.requested=true;
      try {entry.image.src=entry.url;} catch (_) {entry.failed=true;}
    }
    return entry.image;
  }
  function glass(g) {
    if(g?.journey?.levelId==='glass')request('seamCrab');
  }
  const start=Game.prototype.startSeamlessJourney;
  Game.prototype.startSeamlessJourney=function(...args) {
    if(args[2]==='glass')request('seamCrab');
    const result=start.apply(this,args);glass(this);return result;
  };
  for(const name of ['resumeSeamlessJourney','descendSeamlessFloor']) {
    const previous=Game.prototype[name];
    Game.prototype[name]=function(...args) {
      const result=previous.apply(this,args);glass(this);return result;
    };
  }
  const makeEnemy=Game.prototype.makeJourneyEnemy;
  Game.prototype.makeJourneyEnemy=function(...args) {
    const enemy=makeEnemy.apply(this,args);
    if(enemy?.type==='seamcrab')request('seamCrab');
    return enemy;
  };
  const ground=BiomeArtV3.ground;
  BiomeArtV3.ground=function(c,g,rooms,...args) {
    // This runs inside the later design wrapper, before its ready() checks.
    if(g?.journey?.seamless && rooms?.some(room=>room.biome==='glass')) {
      request('ceramicFloor');glass(g);
    }
    return ground.call(this,c,g,rooms,...args);
  };
  window.V20AssetLoading=Object.freeze({version:20,urls:Object.freeze(urls),
    status:()=>Object.fromEntries([...entries].map(([id,e])=>[id,{requested:e.requested,failed:e.failed}]))});
})();

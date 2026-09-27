(() => {
  'use strict';
  const ids=['drownedwharf','redquarry','darkroot'];
  const key=id=>'undermountain-v27-'+id;
  const oldKey=SeamlessFloor.key;
  const start=Game.prototype.startSeamlessJourney;
  Game.prototype.startSeamlessJourney=function(seed,hero,level,...rest){
    SeamlessFloor.key=ids.includes(level)?key(level):oldKey;
    const result=start.call(this,seed,hero,level,...rest);
    if(ids.includes(level)&&this.journey){this.journey.notice=ExpeditionLevels.get(level).name+' · самостоятельный поход. M — карта.';this.journey.noticeTime=6;}
    return result;
  };
  const query=typeof URLSearchParams==='function'?new URLSearchParams(window.location?.search||''):null;
  if(ids.includes(query?.get('map')))SeamlessFloor.key=key(query.get('map'));
  const render=Renderer.prototype.render;
  Renderer.prototype.render=function(...args){
    if(ids.includes(this.g.journey?.levelId)&&this.g.canvas.style)this.g.canvas.style.imageRendering='auto';
    return render.apply(this,args);
  };
  window.V27Preview=Object.freeze({version:27,ids,key});
})();

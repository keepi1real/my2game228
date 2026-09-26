// Install after v20-storage and v20-maps. Stage only the synchronous checkpoint
// writes of saveJourney; publish one complete value through native setItem.
(() => {
  'use strict';
  if(window.V20SaveAtomic)return;
  const key=SeamlessFloor.key;
  if(!['undermountain-biomes-v20-preview','undermountain-biomes-v21-observatory-preview'].includes(key))
    throw new Error('v20-save-atomic requires isolated preview storage');
  let storage;
  try {storage=localStorage;} catch (_) {
    // The base game already handles inaccessible storage and cannot write here.
    window.V20SaveAtomic=Object.freeze({version:20,available:false});return;
  }
  // Browser Storage objects have exotic property setters; patch their methods
  // on the prototype, not the instance. Plain test doubles use their own methods.
  const target=typeof Storage!=='undefined'&&storage instanceof Storage?Storage.prototype:storage;
  const get=target.getItem,set=target.setItem;
  let active=null;
  target.getItem=function(name) {
    if(this===storage&&active&&String(name)===key) {
      if(active.written)return active.value;
      active.readBeforeWrite=true;
    }
    return get.apply(this,arguments);
  };
  target.setItem=function(name,value) {
    if(this===storage&&active&&String(name)===key) {
      active.value=String(value);active.written=true;return;
    }
    return set.apply(this,arguments);
  };
  const previous=Game.prototype.saveJourney;
  Game.prototype.saveJourney=function(...args) {
    if(!this.journey?.seamless||active)return previous.apply(this,args);
    const transaction={written:false,value:null,readBeforeWrite:false},timer=this.journey.saveTimer;
    active=transaction;let result;
    try {result=previous.apply(this,args);} finally {active=null;}
    if(transaction.written) {
      try {
        // An inner save may catch its own serialization error. In that case
        // maps must not relabel an older checkpoint read from native storage.
        if(transaction.readBeforeWrite)throw Error('Inner save did not stage fresh data');
        // v20-maps sees staged reads and appends its marker to the same pending
        // JSON. Recheck it before committing; never store v20 coordinates under
        // an implicit legacy generator if an inner wrapper changes later.
        if(this.journey.v20MapVersion===20&&transaction.value!=='null') {
          const data=JSON.parse(transaction.value);
          if(!data||data.version!==4||data.seed!==this.journey.seed)throw Error('Invalid pending checkpoint');
          data.mapVersion=20;transaction.value=JSON.stringify(data);
        }
        set.call(storage,key,transaction.value);
      } catch (_) {
        this.journey.saveTimer=timer;
        this.journey.notice='Не удалось сохранить забег. Игра продолжается.';
        this.journey.noticeTime=5;
      }
    }
    return result;
  };
  window.V20SaveAtomic=Object.freeze({version:20,available:true,key});
})();

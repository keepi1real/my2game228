// Darkroot's registry additions and presentation aliases. Install after maps,
// before save-atomic. Geometry is keyed by the unique darkroot level ID; the
// existing layoutVersion 16 / mapVersion 20 checkpoint contract is unchanged.
(() => {
  'use strict';
  if (window.V27Darkroot) return;
  const id = 'darkroot';
  const roster = {
    root_reaper: {name:'Корневой косарь',symbol:'⌁',shape:'hex',color:'#a7c7a6',size:20,hp:132,dmg:16,speed:131,armor:2,xp:62,shards:3,gold:[9,16],sight:690,attackRange:88,attackCd:2.65,windup:1.03,rootvault:true,pattern:'sweep',minFloor:99,weight:0},
    root_grafter: {name:'Прививочник',symbol:'⋔',shape:'diamond',color:'#b6d6bc',size:17,hp:94,dmg:13,speed:105,armor:1,xp:58,shards:3,gold:[9,17],sight:720,attackRange:365,keepDistance:170,ranged:true,projSpeed:225,projColor:'#c6e6c9',attackCd:3.8,windup:1.25,rootvault:true,pattern:'spores',minFloor:99,weight:0}
  };
  Object.assign(MONSTERS,roster);
  // Save validation resolves boss IDs through BOSSES even for custom bossDef
  // chapters, so register the exact chapter definition before first creation.
  BOSSES.root_heart = {...ExpeditionLevels.get(id).bossDef};
  WorldDetail.themes[id] = {...WorldDetail.themes.rootvault,base:'#172d28',trim:'#817c5b',light:'#bdcfaa',water:false};
  RoomCraft.palettes[id] = ['#23392e','#a3ae84'];
  for (const row of [0,1]) BiomeArtV3.sprites[`detail-${id}-${row}`] = BiomeArtV3.sprites[`detail-rootvault-${row}`] || BiomeArtV3.sprites[`detail-roots-${row}`];
  BiomeArtV3.sprites[`landmark-v15-${id}`] = BiomeArtV3.sprites['landmark-v15-rootvault'] || BiomeArtV3.sprites.rootpillar;
  WorldTour.descriptions[id] = 'Замкнутые залы огромного корня, прививочные кольца и светлое семя-сердце.';
  if (!WorldTour.order.includes(id)) WorldTour.order.push(id);
  window.V27Darkroot = Object.freeze({version:27,id,roster:Object.freeze(roster),isActive:g=>g?.journey?.seamless&&g.journey.levelId===id});
})();

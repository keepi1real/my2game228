// Red Quarry actors and presentation aliases. Registry geometry belongs to the
// shared build-time chapter extension; this module only installs its own IDs.
(() => {
  'use strict';
  if (window.V27Quarry) return;
  const roster = {
    quarry_cleaver: {name:'Сколоруб',symbol:'К',shape:'square',color:'#b46c52',size:22,hp:148,dmg:17,speed:102,armor:3,xp:60,shards:3,gold:[10,17],sight:700,attackRange:89,attackCd:2.65,windup:1.02,rootvault:true,pattern:'sweep',minFloor:1,weight:3},
    quarry_scorcher: {name:'Прожигатель',symbol:'П',shape:'circle',color:'#dab386',size:17,hp:96,dmg:14,speed:90,armor:1,xp:56,shards:3,gold:[9,16],sight:720,attackRange:350,keepDistance:180,ranged:true,projSpeed:260,projColor:'#edb16a',attackCd:3.35,windup:1.2,rootvault:true,pattern:'spores',minFloor:1,weight:2}
  };
  Object.assign(MONSTERS, roster);
  const level = ExpeditionLevels.get('redquarry');
  if (level?.id === 'redquarry' && level.bossDef) BOSSES.quarry_cutter = {...level.bossDef,abilities:{...level.bossDef.abilities}};
  WorldDetail.themes.redquarry = {...WorldDetail.themes.forge,base:'#663e34',trim:'#b69a78',light:'#d5ba93',water:false};
  RoomCraft.palettes.redquarry = ['#693f31','#c4aa87'];
  for (const row of [0,1]) BiomeArtV3.sprites[`detail-redquarry-${row}`] = BiomeArtV3.sprites[`detail-forge-${row}`];
  BiomeArtV3.sprites['landmark-v15-redquarry'] ??= BiomeArtV3.sprites['landmark-v15-forge'];
  if (!WorldTour.order.includes('redquarry')) WorldTour.order.push('redquarry');
  WorldTour.descriptions.redquarry = 'Глиняный спуск, фарфоровые жилы и последний резец.';
  window.V27Quarry = Object.freeze({version:27,id:'redquarry',enemyTypes:Object.freeze(Object.keys(roster)),isActive:g=>g?.journey?.seamless&&g.journey.levelId==='redquarry'});
})();

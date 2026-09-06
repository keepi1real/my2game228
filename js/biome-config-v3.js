'use strict';
// Environment metadata only. RoomRoute owns roles, graph edges, seeded starts,
// rewards and progression; a visual biome must never change those rules.
const BiomeV3 = (() => {
  const biomes = {
    amber:{name:'Янтарный некрополь',floor:'#89745b',floorAlt:'#a09175',edge:'#3d302b',accent:'#e1bb78',mist:'#856043',backdrop:'assets/crown-v11/amber-terrain.png',pillar:'amberpillar',cluster:'ambersarcophagus',wall:'amberwall'},
    glass:{name:'Сады Лунного Стекла',floor:'#68697e',floorAlt:'#8c8ba3',edge:'#28283e',accent:'#d5bedf',mist:'#665b90',backdrop:'assets/crown-v11/glass-terrain.png',pillar:'glasspillar',cluster:'glassmirror',wall:'glasswall'},
    tide:{name:'Затопленные архивы',floor:'#53736c',floorAlt:'#81908a',edge:'#163638',accent:'#9edbcd',mist:'#327d79',backdrop:'assets/recovered-v9/22a81fe6245d6d38.png',pillar:'tidepillar',cluster:'tideshelves',wall:'tidewall'},
    sunforge:{name:'Кузня Чёрного Солнца',floor:'#655752',floorAlt:'#827067',edge:'#2f2027',accent:'#efb478',mist:'#854333',backdrop:'assets/recovered-v9/1ce53d80bb775b0d.png',pillar:'sunpillar',cluster:'sunanvil',wall:'slagwall'},
    storm:{name:'Цитадель Белой Бури',floor:'#5b6b79',floorAlt:'#7c8791',edge:'#1e314b',accent:'#a2cee5',mist:'#466d9a',backdrop:'assets/recovered-v9/396d4bea8ed61311.png'},
    rootvault:{name:'Багряный корнесвод',floor:'#4e5547',floorAlt:'#656456',edge:'#142a25',accent:'#e6b277',mist:'#6c3c39',backdrop:'assets/recovered-v9/a30ea68273459456.png'},
    eclipse: {
      name:'Обсерватория затмения',floor:'#4a526b',floorAlt:'#626b83',
      edge:'#161e39',accent:'#c5b7ed',mist:'#424c8d',
      backdrop:'assets/recovered-v9/00ba704ad91c157b.png',
    },
    roots: {
      name: 'Затопленные корни',
      floor: '#304c4d',
      floorAlt: '#3b5957',
      edge: '#112d35',
      accent: '#78d9b7',
      mist: '#2d867d',
      backdrop: 'assets/recovered-v9/5852ca97ad774164.png',
    },
    bastion: {
      name: 'Бронзовый бастион',
      floor: '#464553',
      floorAlt: '#585565',
      edge: '#202636',
      accent: '#d5b774',
      mist: '#416783',
      backdrop: 'assets/recovered-v9/9fa3609406a4d3d2.png',
    },
    forge: {
      name: 'Пепельные горны',
      floor: '#494349',
      floorAlt: '#5b5055',
      edge: '#251f2d',
      accent: '#f7ae69',
      mist: '#793f47',
      backdrop: 'assets/recovered-v9/aeaed9ebed580575.png',
    },
  };

  // Index equals the persistent RoomRoute room ID. Each zone has its own
  // silhouette + focal landmark, while repeated prop styles tie a biome together.
  const rooms = [
    { biome:'roots', shape:'broken', name:'Затопленная пристань', landmark:'cistern', propStyle:'tree' },
    { biome:'roots', shape:'garden', name:'Сад забытых стражей', landmark:'tree', propStyle:'statue' },
    { biome:'roots', shape:'courtyard', name:'Двор расколотого обелиска', landmark:'obelisk', propStyle:'tree' },
    { biome:'bastion', shape:'cruciform', name:'Крестовый караул', landmark:'statue', propStyle:'armory' },
    { biome:'roots', shape:'terrace', name:'Террасы затопленных щитов', landmark:'cistern', propStyle:'statue' },
    { biome:'bastion', shape:'longhall', name:'Оружейная летописца', landmark:'books', propStyle:'armory' },
    { biome:'bastion', shape:'broken', name:'Сломанный бастион', landmark:'statue', propStyle:'armory' },
    { biome:'roots', shape:'sanctum', name:'Родник под корнями', landmark:'cistern', propStyle:'tree' },
    { biome:'bastion', shape:'longhall', name:'Стражная галерея', landmark:'obelisk', propStyle:'statue' },
    { biome:'forge', shape:'cruciform', name:'Распутье горнов', landmark:'forge', propStyle:'armory' },
    { biome:'roots', shape:'garden', name:'Укрытый корнями тайник', landmark:'books', propStyle:'tree' },
    { biome:'forge', shape:'broken', name:'Сломанная литейная', landmark:'forge', propStyle:'armory' },
    { biome:'forge', shape:'courtyard', name:'Двор угольных чаш', landmark:'forge', propStyle:'obelisk' },
    { biome:'forge', shape:'longhall', name:'Караул чёрных цепей', landmark:'statue', propStyle:'armory' },
    { biome:'forge', shape:'terrace', name:'Остывшая купель', landmark:'cistern', propStyle:'statue' },
    { biome:'forge', shape:'sanctum', name:'Зал Пепельной Короны', landmark:'throne', propStyle:'statue' },
  ];

  // Invalid IDs do not silently borrow another room's art: callers can fall
  // back to their legacy renderer without corrupting the persistent ID mapping.
  function forRoom(id) {
    return Number.isInteger(id) && id >= 0 && id < rooms.length ? rooms[id] : null;
  }

  for (const biome of Object.values(biomes)) Object.freeze(biome);
  for (const room of rooms) Object.freeze(room);
  return Object.freeze({ biomes:Object.freeze(biomes), rooms:Object.freeze(rooms), forRoom });
})();


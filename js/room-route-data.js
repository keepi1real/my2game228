'use strict';
// Hand-authored room geometry + a seeded route. Coordinates in the source art are
// converted once; collision and rendering then share the same world coordinates.
const RoomRoute = (() => {
  const guard = new Image(); guard.src = 'assets/recovered-v9/1097ec1be6494cdc.png';
  const crown = new Image(); crown.src = 'assets/recovered-v9/2b5a7e25da393de7.png';
  const guardFloor = [
    [[235,427],[475,256],[658,221],[800,272],[1065,266],[1320,444],[1300,571],[1090,735],[893,800],[869,920],[661,920],[640,799],[455,752],[232,578]],
    [[475,285],[468,172],[574,172],[611,267]],
    [[947,304],[956,190],[1075,206],[1070,319]],
  ];
  const crownFloor = [
    [[235,413],[566,278],[658,252],[904,252],[996,285],[1270,409],[1320,595],[1068,758],[906,782],[881,925],[660,925],[642,785],[467,753],[223,592]],
    [[670,283],[669,185],[866,185],[868,283]],
  ];
  const templates = {
    guard: { image:guard, size:.86, offset:[72,46], polygons:guardFloor, sockets:{left:[520,229],right:[1011,261],back:[768,864]}, columns:[] },
    store: { image:guard, size:.78, offset:[113,85], polygons:guardFloor, sockets:{left:[520,229],right:[1011,261],back:[768,864]}, columns:[] },
    gallery: { image:RoomVisualArt.image, size:1, offset:[0,0], polygons:RoomVisualArt.polygons, sockets:RoomVisualArt.sockets, columns:[{x:330,y:365,r:27},{x:694,y:365,r:27}] },
    crown: { image:crown, size:1, offset:[0,0], polygons:crownFloor, sockets:{back:[768,864]}, columns:[] },
  };
  const roles = {
    event:{label:'Событие',icon:'✦',color:'#b7d9e5'},
    start:{label:'Вход',icon:'◇',color:'#b8d7d9'}, combat:{label:'Бой',icon:'×',color:'#d68a72'},
    elite:{label:'Элита',icon:'!',color:'#df827c'}, treasure:{label:'Сундук',icon:'◆',color:'#edc56d'},
    rest:{label:'Отдых',icon:'+',color:'#8ed8c5'}, boss:{label:'Корона',icon:'♛',color:'#ef9c76'},
  };
  const layout = [
    ['Вход у старой шахты','treasure',1,8],['Караульная палата','combat',1,7],['Развилка дозора','combat',2,6],
    ['Западный дозор','combat',1,5],['Зал разбитых щитов','combat',3,5],['Тайник оружейника','treasure',0,4],
    ['Страж бронзовых врат','elite',1,3],['Тихий родник','rest',3,3],['Стражная галерея','combat',2,2],
    ['Верхняя развилка','combat',2,1],['Забытая кладовая','treasure',4,4],['Караул цепного моста','combat',1,0],
    ['Палата углей','combat',3,0],['Последний дозор','elite',2,-1],['Привал у Короны','rest',2,-2],
    ['Зал Пепельной Короны','boss',2,-3],
  ];
  const edges = [[0,1],[1,2],[2,3],[2,4],[3,5],[3,6],[4,7],[7,10],[6,8],[7,8],[8,9],[9,11],[9,12],[11,13],[12,13],[13,14],[14,15]];
  function point(t,p) { return {x:t.offset[0]+p[0]*2/3*t.size,y:t.offset[1]+p[1]*2/3*t.size}; }
  function create(seed) {
    const rng=new RNG(seed),start=rng.pick([0,5,10]);
    const rooms=layout.map(([name,role,x,y],id)=>({id,name,role,x,y,links:[],visited:false,discovered:false,cleared:false,initialized:false,restUsed:false,world:null,variant:rng.int(0,2)}));
    rooms[start].role='start'; rooms[start].name=['Спуск старой шахты','Вход через оружейную','Потайной вход'][[0,5,10].indexOf(start)];
    // A small seeded change alters where the early elite encounter lies.
    if(rng.chance(.5)){rooms[3].role='elite';rooms[6].role='combat';}
    edges.forEach(([a,b])=>{rooms[a].links.push(b);rooms[b].links.push(a);});
    rooms.forEach(r=>{
      r.template=r.id===15?'crown':r.id===8?'gallery':['start','rest','treasure'].includes(r.role)?'store':'guard';
      const neighbors=r.links.slice().sort((a,b)=>rooms[b].y-rooms[a].y||rooms[a].x-rooms[b].x);
      r.doors=[];
      if(r.role==='boss')r.doors.push({to:neighbors[0],socket:'back'});
      else if(neighbors.length===1)r.doors.push({to:neighbors[0],socket:r.role==='start'?'left':'back'});
      else {
        r.doors.push({to:neighbors.shift(),socket:'back'});
        neighbors.sort((a,b)=>rooms[a].x-rooms[b].x).forEach((to,i)=>r.doors.push({to,socket:i?'right':'left'}));
      }
    });
    return {version:1,seed:seed>>>0,start,current:start,rooms,completed:false,mapOpen:false,saveTimer:0,transition:0,notice:'Найдите путь к Залу Пепельной Короны',noticeTime:5};
  }
  function geometry(room) {
    const t=templates[room.template];
    const polygons=t.polygons.map(poly=>poly.map(p=>{const q=point(t,p);return [q.x,q.y];}));
    const obstacles=t.columns.map(o=>({...o}));
    if(room.template==='guard'&&room.variant!==0){
      const q=point(t,room.variant===1?[605,537]:[951,553]);obstacles.push({...q,r:25,kind:'crate'});
    }
    const doors=room.doors.map(d=>({...d,...point(t,t.sockets[d.socket])}));
    return {template:t,polygons,obstacles,doors};
  }
  function makeMap(room) {
    const map=new GameMap(32,22),geo=geometry(room);Object.assign(map,geo);map.routeRoom=true;
    const inside=(x,y)=>geo.polygons.some(poly=>RoomVisualArt.inside(x,y,poly));
    map.circleBlocked=(x,y,r)=>{
      if(!inside(x,y)||geo.obstacles.some(o=>Math.hypot(x-o.x,y-o.y)<r+o.r))return true;
      for(let i=0;i<24;i++){const a=i*Math.PI/12;if(!inside(x+Math.cos(a)*r,y+Math.sin(a)*r))return true;}return false;
    };
    for(let y=0;y<map.h;y++)for(let x=0;x<map.w;x++)map.set(x,y,map.circleBlocked((x+.5)*TILE,(y+.5)*TILE,10)?T_WALL:T_FLOOR);
    map.updateVisibility=()=>{map.visible.fill(1);map.explored.fill(1);};map.updateVisibility();return map;
  }
  return {templates,roles,edges,point,create,geometry,makeMap,key:'undermountain-room-route-v1'};
})();


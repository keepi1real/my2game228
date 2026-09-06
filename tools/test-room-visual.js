'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const {createCanvas,Image}=require('@napi-rs/canvas');
const root=path.resolve(__dirname,'..'),out=path.join(root,'dist/room-visual');
async function harness(options={}){
  const pending=[],events={},writes=[],storage=new Map();
  function LocalImage(){const img=new Image(),src=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(img),'src');
    Object.defineProperty(img,'src',{set(v){src.set.call(img,v.startsWith('assets/')?path.join(root,v):v);},get(){return src.get.call(img);}});
    pending.push(new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;}));return img;
  }
  const canvas=createCanvas(1024,640);canvas.addEventListener=()=>{};canvas.getBoundingClientRect=()=>({x:0,y:0,left:0,top:0,width:1024,height:640});
  const ui=options.ui||{innerHTML:'',querySelectorAll:()=>[],querySelector:()=>null},document={readyState:'loading',createElement:()=>createCanvas(1,1),getElementById:id=>id==='game'?canvas:ui};
  const env={Image:LocalImage,document,console,performance:{now:()=>0},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>{storage.set(k,v);writes.push(k);}},addEventListener:(id,fn)=>(events[id]??=[]).push(fn)};
  env.window=env;vm.createContext(env);
  env.requestAnimationFrame=fn=>{env.lastFrame=fn;return 1;};
  if(options.bundle)vm.runInContext(fs.readFileSync(options.bundle,'utf8').match(/<script>([\s\S]*)<\/script>/)[1],env,{filename:'standalone.html'});
  else for(const [,file] of fs.readFileSync(path.join(root,'index.html'),'utf8').matchAll(/<script src="([^"]+)"><\/script>/g))if(file!=='js/main.js')vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),env,{filename:file});
  await Promise.all(pending);
  const a=vm.runInContext('({Game,Save,RoomVisualArt,VisualRoomPreview,makeVisualRoomMap,TILE,T_FLOOR})',env),g=new a.Game(canvas);env.game=g;
  return {env,a,g,canvas,ui,storage,writes,events};
}
module.exports={harness};
if(require.main===module)(async()=>{
  fs.mkdirSync(out,{recursive:true});const h=await harness(),{g,a}=h;
  const original=a.Save.data,originalJSON=JSON.stringify(original);a.Save.dirty=true;a.Save.timer=.7;
  g.startVisualRoom();assert.equal(g.state,'run');assert(g.visualRoom);assert.equal(g.enemies.length,0);
  assert(h.ui.innerHTML.includes('data-visual-action="fight"'));
  assert.equal(a.RoomVisualArt.image.width,1536);assert.equal(a.RoomVisualArt.image.height,1024);
  function shot(name){g.banner=null;g.messages=[];g.shake=0;g.time=2;g.player.invulnTime=0;g.renderer.render();fs.writeFileSync(path.join(out,name+'.png'),h.canvas.toBuffer('image/png'));}
  // Model collision connectivity for the full hero radius; all three exits remain reachable.
  const map=g.map,cell=8,w=128,grid=new Set();
  for(let y=0;y<88;y++)for(let x=0;x<w;x++)if(!map.circleBlocked((x+.5)*cell,(y+.5)*cell,12))grid.add(y*w+x);
  const seed=Math.floor(g.player.y/cell)*w+Math.floor(g.player.x/cell),seen=new Set([seed]),q=[seed];assert(grid.has(seed));
  for(let i=0;i<q.length;i++)for(const d of [1,-1,w,-w]){const n=q[i]+d;if(grid.has(n)&&!seen.has(n)){seen.add(n);q.push(n);}}
  for(const [name,p] of Object.entries(a.RoomVisualArt.sockets)){
    const x=p[0]*2/3,y=p[1]*2/3;assert(!map.circleBlocked(x,y,12),name+' exit collider');
    assert(seen.has(Math.floor(y/cell)*w+Math.floor(x/cell)),name+' connected exit');
  }
  assert.equal(seen.size,grid.size,'No isolated walkable floor');
  // Move the actual hero with normal engine input, then push into a column at dash speed.
  const before=g.player.y;g.input.keys.KeyW=true;for(let i=0;i<60;i++)g.update(1/60);g.input.keys={};
  assert(g.player.y<before-100);assert.deepStrictEqual(JSON.parse(JSON.stringify(g.camera)),{x:0,y:32});
  const o=map.obstacles[0];g.player.x=o.x-90;g.player.y=o.y;g.moveEntity(g.player,180,0);
  assert(g.player.x<=o.x-o.r-g.player.r+1);assert(!map.circleBlocked(g.player.x,g.player.y,g.player.r));
  g.player.x=512;g.player.y=482;shot('room-gameplay');g.visualRoom.clean=true;shot('room-complete');g.visualRoom.clean=false;g.visualRoom.debug=true;shot('room-collision');g.visualRoom.debug=false;
  const full=createCanvas(1536,1024),fc=full.getContext('2d'),artLayer=a.RoomVisualArt;fc.scale(1.5,1.5);
  artLayer.base(fc);artLayer.ground(fc,2);artLayer.flames(fc,2);
  for(const socket of ['left','right'])artLayer.portal(fc,socket,true,2);
  for(const o of map.obstacles){artLayer.columnShadow(fc,o);artLayer.drawColumn(fc,o,null);}
  artLayer.front(fc,null,2);artLayer.atmosphere(fc,2);fs.writeFileSync(path.join(out,'room-full.png'),full.toBuffer('image/png'));
  g.player.x=o.x;g.player.y=o.y-65;assert(!map.circleBlocked(g.player.x,g.player.y,g.player.r));shot('room-occlusion');
  g.startVisualRoom(true);assert.equal(g.enemies.length,3);for(const e of g.enemies)assert(!g.map.circleBlocked(e.x,e.y,e.r));
  shot('room-combat');for(const e of g.enemies.slice())g.hitEnemy(e,999999,{});for(let i=0;i<150;i++)g.update(1/60);
  assert(!g.enemies.some(e=>e.alive));assert.equal(h.writes.length,0,'Art review cannot write campaign/meta saves');
  g.player.hp=1;g.player.invulnTime=0;g.damagePlayer(999999,null);assert.equal(g.state,'paused');assert(g.visualRoom.failed);assert(h.ui.innerHTML.includes('Герой пал'));
  g.startVisualRoom();g.input.touch.enabled=true;g.renderer.render();shot('room-touch');g.input.touch.enabled=false;
  g.toMenu();assert.strictEqual(a.Save.data,original);assert.equal(JSON.stringify(a.Save.data),originalJSON);assert(a.Save.dirty);assert.equal(a.Save.timer,.7);
  assert.equal(h.writes.length,0);assert.equal(g.visualRoom,null);
  // The regular campaign remains available after leaving the art preview.
  g.startRun('arator','startNone');assert(!g.visualRoom);assert(!g.map.visualRoom);assert(h.writes.length>0);
  // Export exact source-coordinate geometry and runtime sprite clipping metadata.
  const art=a.RoomVisualArt;
  fs.writeFileSync(path.join(out,'room-manifest.json'),JSON.stringify({id:art.id,sourceSize:[1536,1024],gameSize:[1024,640],worldSize:[1024,704],scale:art.scale,camera:{x:0,y:32},
    layers:['GroundAndArchitecture','GroundLighting','RearFlames','Shadows','DepthSortedActorsAndColumns','Foreground','FrontFlames','Atmosphere'],
    navigationPolygons:art.polygons,exitSockets:art.sockets,foreground:art.foreground,fires:art.fires,lightPools:art.pools,
    obstacles:a.VisualRoomPreview.obstacles,column:{image:'assets/room-visual-v1/column-sheet.png',sourceSize:[1024,1536],sourceHasAlpha:false,clip:art.columnClip,anchor:[513,1425],baseWidth:462}},null,2));
  console.log('PASS: full-radius floor connectivity, 3 exits, actual movement and collision, render layers, combat/death, touch rendering and save isolation.');
})().catch(e=>{console.error(e);process.exitCode=1;});

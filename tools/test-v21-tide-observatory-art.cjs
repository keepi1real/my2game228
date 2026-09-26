/* Real Canvas regression: node tools/test-v21-tide-observatory-art.cjs */
'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const {createCanvas,loadImage}=require('@napi-rs/canvas');
(async()=>{
  const source=fs.readFileSync(path.join(__dirname,'v21-tide-observatory-art.js'),'utf8');
  const slate=await loadImage(path.join(__dirname,'../assets/recovered-v9/5003907889809929.png'));
  const atlas=await loadImage(path.join(__dirname,'../assets/recovered-v9/c339c2ecd2a7da88.png'));
  let oldGround=0,oldProp=0,allocated=0,lastProp=null;
  const sprites={tidepillar:{rect:[186,15,182,486],height:224},tidebasin:{rect:[559,619,419,262],height:102},tidescholar:{rect:[1152,22,299,483],height:208},tideshelves:{rect:[599,6,335,495],height:212}};
  const math=Object.create(Math);math.random=()=>{throw Error('Presentation consumed gameplay RNG');};
  const env={window:{},Math:math,document:{createElement(){allocated++;return createCanvas(1,1);}},BiomeArtV3:{slate,sprites,
    ground(){oldGround++;return 'ground';},
    prop(c,o,player){oldProp++;lastProp=o;const s=sprites[o.sprite];if(s){c.save();if(player&&player.y<o.y&&player.y>o.y-o.height)c.globalAlpha=.38;const [sx,sy,sw,sh]=s.rect;c.drawImage(atlas,sx,sy,sw,sh,o.x-sw/sh*o.height/2,o.y-o.height+9,sw/sh*o.height,o.height);c.restore();}return 'prop';}
  }};
  vm.createContext(env);vm.runInContext(source,env);
  const room=(id,x)=>({id,biome:'tideobservatory',role:'combat',center:{x:x+100,y:110},polygons:[[[x,0],[x+200,0],[x+200,220],[x,220]]]});
  const rooms=[room(0,0),room(1,300)],links=[{a:0,b:1,polygon:[[150,80],[350,80],[350,140],[150,140]]}];
  const g={journey:{v21MapVersion:21,rooms},map:{boundary:[]}},view={x:0,y:0,w:500,h:220};
  const canvas=createCanvas(500,220),c=canvas.getContext('2d'),initial=JSON.stringify({g,rooms,links});
  const art=env.window.V21TideObservatoryArt;
  for(const role of Object.keys(art.roles)){
    rooms[0].role=role;c.clearRect(0,0,500,220);c.imageSmoothingEnabled=false;
    assert.equal(env.BiomeArtV3.ground(c,g,rooms,links,view),'ground');
    assert.equal(art.metrics.rooms,2);assert.equal(art.metrics.corridors,1);assert.equal(art.metrics.roleMarks,2);
    assert.equal(c.imageSmoothingEnabled,false,'Canvas state restored');assert.equal(c.globalAlpha,1);
  }
  rooms[0].role='combat';assert.equal(JSON.stringify({g,rooms,links}),initial);
  assert.equal(allocated,1,'Stone glaze allocated once, never per frame');assert.equal(art.metrics.materials,1);
  const pixels=()=>Buffer.from(c.getImageData(0,0,500,220).data);
  c.clearRect(0,0,500,220);env.BiomeArtV3.ground(c,g,rooms,links,view);const joined=pixels();
  c.clearRect(0,0,500,220);env.BiomeArtV3.ground(c,g,rooms,links,view);assert(joined.equals(pixels()),'Repeated frames deterministic');
  assert.equal(joined[(20*500+250)*4+3],0,'Floor cannot leak outside room/corridor union');
  assert.equal(joined[(110*500+250)*4+3],255,'Corridor has an opaque textured floor');
  const full={...rooms[0],polygons:[[[0,0],[500,0],[500,220],[0,220]]]};
  c.clearRect(0,0,500,220);env.BiomeArtV3.ground(c,g,[full],[],view);const uninterrupted=pixels();
  for(let y=90;y<130;y++)for(let x=170;x<330;x++){
    const i=(y*500+x)*4;
    assert(joined.subarray(i,i+4).equals(uninterrupted.subarray(i,i+4)),`No material seam at ${x},${y}`);
  }
  // Shifting the camera changes the screen crop, not the pattern's world origin.
  const shifted=createCanvas(500,220),sc=shifted.getContext('2d');sc.translate(-50,0);
  env.BiomeArtV3.ground(sc,g,rooms,links,{...view,x:50});
  const crop=sc.getImageData(120,90,160,40).data;
  for(let y=0;y<40;y++)for(let x=0;x<160;x++)for(let k=0;k<4;k++)assert(Math.abs(crop[(y*160+x)*4+k]-joined[((y+90)*500+x+170)*4+k])<=2,'World-anchored material (subpixel raster rounding tolerance 2/255)');
  const o={biome:'tideobservatory',kind:'biome-prop',sprite:'tidepillar',x:100,y:210,height:180,r:22,homeRoom:0,landmark:true};
  for(const sprite of Object.keys(sprites)){
    rooms[0].design={landmark:sprite};env.BiomeArtV3.ground(c,g,rooms,links,view);
    const native={...o,sprite},alias={...o,sprite:'landmark-v15-tideobservatory'},snap=JSON.stringify(alias);
    assert.equal(env.BiomeArtV3.prop(c,native,{x:100,y:160},0),'prop');assert.strictEqual(lastProp,native,'Native atlas renderer receives original prop');
    assert.equal(env.BiomeArtV3.prop(c,alias,{x:100,y:160},0),'prop');assert.equal(lastProp.sprite,sprite,'RoomCraft aliases recover the actual atlas family');
    assert.equal(JSON.stringify(alias),snap);assert.equal(c.globalAlpha,1);assert.equal(c.imageSmoothingEnabled,false);assert(art.metrics.faded>=1);
  }
  const snapshot=pixels();env.BiomeArtV3.ground(c,{journey:{v20MapVersion:20}},rooms,links,view);assert(snapshot.equals(pixels()));
  const untouched={...o,biome:'tide'};env.BiomeArtV3.prop(c,untouched,null,0);assert.strictEqual(lastProp,untouched);
  env.BiomeArtV3.ground(c,g,rooms,[],{x:2000,y:2000,w:100,h:100});assert.equal(art.metrics.rooms,0);
  const installed=env.BiomeArtV3.ground;vm.runInContext(source,env);assert.strictEqual(installed,env.BiomeArtV3.ground);
  assert(oldGround>10&&oldProp===9);
  console.log('PASS: real loaded slate + tide atlas; pixel-exact continuous room/corridor material; no floor leakage; camera-anchored and cached texture; deterministic draws; native/aliased raster prop delegation; fade and canvas state; version/viewport gates; no geometry/state/RNG mutation.');
})().catch(e=>{console.error(e);process.exitCode=1;});

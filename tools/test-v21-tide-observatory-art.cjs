/* node tools/test-v21-tide-observatory-art.cjs */
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(require('node:path').join(__dirname,'v21-tide-observatory-art.js'),'utf8');
let depth=0,calls=0,oldGround=0,oldProp=0;const stack=[];
const context=new Proxy({globalAlpha:1,save(){depth++;stack.push(this.globalAlpha);},restore(){depth--;this.globalAlpha=stack.pop();assert(depth>=0);},createLinearGradient(){return {addColorStop(){}};}},{get(t,k){if(k in t)return t[k];return (...args)=>{for(const value of args)if(typeof value==='number')assert(Number.isFinite(value),`${k}: nonfinite coordinate`);calls++;};},set(t,k,v){t[k]=v;return true;}});
const math=Object.create(Math);math.random=()=>{throw Error('Art consumed gameplay RNG');};
const env={window:{},Math:math,BiomeArtV3:{ground(){oldGround++;return 'ground';},prop(){oldProp++;return 'prop';}}};vm.createContext(env);vm.runInContext(source,env);
const g={journey:{v21MapVersion:21}},room={id:1,biome:'tideobservatory',role:'combat',center:{x:300,y:200},polygons:[[[0,0],[600,0],[580,400],[30,400]]]};
const view={x:0,y:0,w:800,h:600},o={kind:'biome-prop',biome:'tideobservatory',x:230,y:180,r:30,height:140,landmark:true};
const initial=JSON.stringify({g,room,o});
for(const role of Object.keys(env.window.V21TideObservatoryArt.roles)){
  assert.equal(env.BiomeArtV3.ground(context,g,[{...room,role}],[],view),'ground');
  assert.equal(env.window.V21TideObservatoryArt.metrics.rooms,1);
  assert.equal(env.window.V21TideObservatoryArt.metrics.roleMarks,1);
  env.BiomeArtV3.prop(context,o,{x:230,y:140},0);
  assert.equal(env.window.V21TideObservatoryArt.metrics.props,1);
  assert.equal(env.window.V21TideObservatoryArt.metrics.faded,1);
  assert.equal(context.globalAlpha,1);assert.equal(depth,0);
}
assert.equal(initial,JSON.stringify({g,room,o}));assert.equal(oldProp,0);
// Compare the large filled service-panel silhouettes, excluding role glyphs.
// Identity must survive zoom-out, while the middle half stays free for combat.
let path=[],panels=[];
context.beginPath=()=>{path=[];};
context.moveTo=context.lineTo=(x,y)=>{assert(Number.isFinite(x)&&Number.isFinite(y));path.push([x,y]);};
context.fill=()=>{if(path.length===6)panels.push(path.slice());};
const panelSignatures=new Set(),panelCounts=new Set();
for(const role of Object.keys(env.window.V21TideObservatoryArt.roles)){
  panels=[];
  env.BiomeArtV3.ground(context,g,[{...room,role}],[],view);
  assert(panels.length>=2&&panels.length<=8,`${role}: bounded service-panel density`);
  for(const panel of panels)for(const [x,y] of panel){
    assert(Math.abs(x-room.center.x)>=150,`${role}: panel intrudes into central fight lane`);
    assert(y>=0&&y<=400,`${role}: panel exceeds room bounds`);
  }
  panelSignatures.add(JSON.stringify(panels));panelCounts.add(panels.length);
  const signature=JSON.stringify(panels);panels=[];
  env.BiomeArtV3.ground(context,g,[{...room,role}],[],view);
  assert.equal(JSON.stringify(panels),signature,`${role}: deterministic drawing`);
}
assert.equal(panelSignatures.size,7,'all seven roles need different large floor silhouettes');
assert.equal(panelCounts.size,4,'room rhythm spans one to four panels on each flank');
// Native landmarks and RoomCraft's alias must use the new renderer even when
// the adapter does not provide the generic biome-prop kind.
for(const sprite of ['tidepillar','tidebasin','tidescholar','tideshelves']){
  const landmark={...o,sprite,kind:'landmark',landmark:true,homeRoom:3};
  const snapshot=JSON.stringify(landmark),beforeProps=env.window.V21TideObservatoryArt.metrics.props;
  env.BiomeArtV3.prop(context,landmark,{x:230,y:160},0);
  assert.equal(env.window.V21TideObservatoryArt.metrics.props,beforeProps+1);assert.equal(oldProp,0);
  assert.equal(JSON.stringify(landmark),snapshot);assert.equal(depth,0);
  const variantGame={journey:{v21MapVersion:21,rooms:[{id:3,design:{landmark:sprite}}]}};
  env.BiomeArtV3.ground(context,variantGame,[],[],view);
  env.BiomeArtV3.prop(context,{...landmark,sprite:'landmark-v15-tideobservatory'},null,0);
  assert.equal(env.window.V21TideObservatoryArt.metrics.props,1);assert.equal(oldProp,0);assert.equal(depth,0);
}
// Several existing decorations may carry landmark=true. Only the principal
// fixture gets the tall role-specific silhouette; all others stay low.
for(const role of Object.keys(env.window.V21TideObservatoryArt.roles)){
  const first={...o,sprite:'landmark-v15-tideobservatory',homeRoom:3};
  const second={...first,x:first.x+90};
  const r={...room,id:3,role,design:{landmark:'tidepillar'},decor:[first,second]};
  const state={journey:{v21MapVersion:21,rooms:[r]}},unchanged=JSON.stringify(state);
  env.BiomeArtV3.ground(context,state,[r],[],view);
  env.BiomeArtV3.prop(context,first,null,0);env.BiomeArtV3.prop(context,second,null,0);
  assert.equal(env.window.V21TideObservatoryArt.metrics.landmarks,1,role);
  assert.equal(env.window.V21TideObservatoryArt.metrics.props,2,role);
  assert.equal(env.window.V21TideObservatoryArt.metrics.roleMarks,1,role);
  assert.equal(JSON.stringify(state),unchanged);assert.equal(depth,0);
}
const before=calls;
env.BiomeArtV3.ground(context,g,[{...room,biome:'tide'}],[],view);assert.equal(calls,before);
env.BiomeArtV3.ground(context,g,[room],[],{x:5000,y:5000,w:100,h:100});assert.equal(calls,before);
env.BiomeArtV3.ground(context,{journey:{v20MapVersion:20}},[room],[],view);assert.equal(calls,before);
assert.equal(env.BiomeArtV3.prop(context,o,null,0),'prop');assert.equal(oldProp,1);
const installed=env.BiomeArtV3.ground;vm.runInContext(source,env);assert.equal(installed,env.BiomeArtV3.ground);
assert(oldGround>=10);assert.equal(depth,0);
console.log('PASS: 7 distinct deterministic floor silhouettes with clear central fight lane; 7 role-specific landmarks/inlays; only one tall landmark per room; 4 native/aliased families; finite coordinates; v21/biome/viewport gates; prop fade; no RNG/state mutation; balanced canvas stack; idempotent install.');

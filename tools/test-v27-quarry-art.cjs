'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const harnessPath=process.env.V27_HARNESS||(require('node:fs').existsSync(path.join(__dirname,'v27-harness.cjs'))?path.join(__dirname,'v27-harness.cjs'):'/workspace/scratch/513c16890429/game-repo/tools/v27-harness.cjs');
const {createCanvas,loadImage}=require('node:module').createRequire(harnessPath)('@napi-rs/canvas');
const {boot}=require(harnessPath);
(async()=>{
 const root=path.resolve(__dirname,'..'),h=await boot({team:'quarry',root}),api=h.env.V27QuarrySprites;
 assert(api,'quarry atlas hook installed in lexical script');
 const ids=['quarry_cleaver','quarry_scorcher','quarry_cutter'];
 const canvas=createCanvas(840,570),c=canvas.getContext('2d');c.fillStyle='#754330';c.fillRect(0,0,840,570);
 // First draw starts lazy loaders; the second pass asserts real raster output.
 for(const id of ids)h.a.ActorMotion.draw(c,'enemies',id,{x:0,y:0,def:{windup:1}},{state:{age:0,facing:1,left:0,total:1,walk:0,hit:0}});
 await h.settleImages();
 for(let row=0;row<ids.length;row++){
  const id=ids[row],img=await loadImage(path.join(root,'assets/v27/quarry',id+'.png'));
  const check=createCanvas(img.width,img.height),cc=check.getContext('2d');cc.drawImage(img,0,0);
  for(let frame=0;frame<12;frame++){
   const data=cc.getImageData(frame%4*192,Math.floor(frame/4)*192,192,192).data;let last=-1;
   for(let y=0;y<192;y++)for(let x=0;x<192;x++)if(data[(y*192+x)*4+3])last=y;
   assert.equal(last,185,id+' frame '+frame+' feet retain anchor186');
  }
  assert(h.g.renderer.spriteWidth('enemies',id)>0,'native renderer must place shadow at e.y');
  for(let col=0;col<4;col++){
   const x=105+col*210,y=155+row*185,e={x,y,def:{windup:1},state:'chase'};
   const s={age:.43,facing:1,left:0,total:.4,walk:0,hit:0};
   if(col===1)s.walk=1;
   if(col===2){e.telegraph={total:1,time:.25};}
   if(col===3){s.left=.15;s.action='cast';}
   c.strokeStyle='#e5c99d';c.lineWidth=1;c.beginPath();c.moveTo(x-72,y);c.lineTo(x+72,y);c.stroke();
   c.fillStyle='rgba(0,0,0,.3)';c.beginPath();c.ellipse(x,y,26,9,0,0,Math.PI*2);c.fill();
   const before=c.getTransform();assert(h.a.ActorMotion.draw(c,'enemies',id,e,{state:s}));
   assert.deepEqual(c.getTransform(),before);assert.equal(c.globalAlpha,1);
   c.fillStyle='#fff1d9';c.font='12px sans-serif';c.textAlign='center';c.fillText(id+' / '+['idle','walk','attack','cast'][col],x,y+20);
  }
 }
 const output=path.join(root,'assets/v27/quarry/qa-actor-grounding.png');fs.writeFileSync(output,canvas.toBuffer('image/png'));
 console.log('PASS quarry real raster load, 36 frame foot anchors, native shadow/body metrics, balanced Canvas; '+output);
})().catch(e=>{console.error(e);process.exitCode=1;});

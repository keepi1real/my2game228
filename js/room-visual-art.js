'use strict';
// Engine-neutral room art. Source coordinates are 1536×1024, gameplay uses scale 2/3.
const RoomVisualArt=(()=>{
  const scale=2/3,image=new Image(),column=new Image();
  image.src='assets/recovered-v9/9168b5109cb1e05b.png';column.src='assets/recovered-v9/5267ab2daaf73f8a.png';
  const polygons=[[[250,405],[550,280],[990,280],[1280,405],[1340,590],[1080,750],[905,775],[875,925],[660,925],[635,780],[470,750],[225,590]],
    [[540,295],[540,202],[640,202],[675,295]],[[850,295],[880,202],[985,202],[995,295]]];
  const sockets={back:[768,866],left:[601,240],right:[935,240]};
  const foreground=[{depth:780,polygon:[[220,598],[361,598],[355,707],[463,696],[466,781],[233,816]]},
    {depth:780,polygon:[[1180,598],[1290,598],[1300,810],[1071,800],[1069,702],[1177,695]]}];
  // A traced sprite silhouette is applied by the renderer. The source image is kept intact.
  const columnClip=[[457,96],[446,98],[415,113],[405,114],[366,137],[360,144],[350,147],[309,172],[304,178],[304,222],[315,233],[321,245],[323,290],[357,323],[370,346],[376,362],[382,398],[373,408],[373,419],[374,426],[381,431],[381,449],[389,456],[388,688],[378,701],[378,772],[370,785],[378,806],[378,853],[385,860],[385,1049],[356,1076],[355,1102],[326,1131],[326,1175],[284,1212],[278,1220],[278,1296],[282,1303],[388,1413],[414,1427],[612,1427],[636,1414],[747,1297],[747,1219],[699,1175],[699,1130],[671,1101],[671,1080],[669,1076],[641,1049],[640,1044],[640,860],[648,852],[648,807],[656,785],[648,772],[648,703],[637,688],[637,456],[645,448],[644,433],[652,425],[653,407],[644,397],[651,358],[659,338],[670,320],[701,292],[703,246],[721,219],[721,179],[713,170],[674,146],[666,144],[663,139],[624,115],[611,113],[580,97],[561,96]];
  const fires=[[216,303],[520,159],[688,148],[850,149],[1017,160],[1320,305],[400,706],[1135,706]];
  const pools=[[280,418,120],[535,302,100],[687,292,84],[848,292,84],[1000,302,100],[1240,418,120],[500,751,122],[1037,751,122]];
  const ready=img=>img.complete&&img.naturalWidth>0;
  function path(ctx,points,s=1){ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x*s,y*s):ctx.moveTo(x*s,y*s));ctx.closePath();}
  function inside(x,y,p){let hit=false;for(let i=0,j=p.length-1;i<p.length;j=i++){
    const [ax,ay]=p[i],[bx,by]=p[j];if((ay>y)!==(by>y)&&x<(bx-ax)*(y-ay)/(by-ay)+ax)hit=!hit;
  }return hit;}
  function floorContains(x,y){return polygons.some(p=>inside(x/scale,y/scale,p));}
  function clipFloor(ctx){ctx.beginPath();for(const p of polygons){p.forEach(([x,y],i)=>i?ctx.lineTo(x*scale,y*scale):ctx.moveTo(x*scale,y*scale));ctx.closePath();}ctx.clip();}
  function glow(ctx,x,y,rx,ry,color,alpha){ctx.save();ctx.translate(x,y);ctx.scale(rx,ry);
    const g=ctx.createRadialGradient(0,0,0,0,0,1);g.addColorStop(0,`rgba(${color},${alpha})`);g.addColorStop(1,`rgba(${color},0)`);
    ctx.fillStyle=g;ctx.fillRect(-1,-1,2,2);ctx.restore();}
  function ground(ctx,time=0){
    ctx.save();clipFloor(ctx);ctx.globalCompositeOperation='screen';
    pools.forEach(([x,y,r],i)=>glow(ctx,x*scale,y*scale,r*scale,r*scale*.55,'246,156,55',.18+.025*Math.sin(time*3+i)));
    glow(ctx,240,350,120,180,'25,106,149',.08);glow(ctx,790,350,120,180,'25,106,149',.08);ctx.restore();
  }
  function flame(ctx,x,y,time,i){
    ctx.save();ctx.translate(x*scale,y*scale);ctx.scale(scale,scale);
    const bend=Math.sin(time*4+i)*5,height=44+Math.sin(time*6+i)*5;
    ctx.globalCompositeOperation='screen';glow(ctx,0,-18,48,70,'255,161,54',.25);ctx.globalCompositeOperation='source-over';
    ctx.fillStyle='#e85f2b';ctx.beginPath();ctx.moveTo(-14,0);ctx.quadraticCurveTo(-23,-19,-7,-29);ctx.quadraticCurveTo(-9,-12,bend,-height);ctx.quadraticCurveTo(12,-32,16,-14);ctx.quadraticCurveTo(16,0,0,5);ctx.closePath();ctx.fill();
    ctx.fillStyle='#ffbf4c';ctx.beginPath();ctx.moveTo(-9,1);ctx.quadraticCurveTo(-14,-10,-3,-23);ctx.lineTo(bend*.4,-height*.75);ctx.quadraticCurveTo(8,-15,9,-5);ctx.quadraticCurveTo(7,5,0,5);ctx.closePath();ctx.fill();
    ctx.fillStyle='#fff0af';ctx.beginPath();ctx.moveTo(-5,1);ctx.quadraticCurveTo(-5,-8,2,-16);ctx.quadraticCurveTo(7,-1,3,3);ctx.closePath();ctx.fill();
    for(let k=0;k<3;k++){const t=(time*.35+i*.13+k/3)%1;ctx.globalAlpha=(1-t)*.75;ctx.fillStyle='#ffce68';ctx.fillRect(Math.sin(t*6+i+k)*14,-17-t*65,2,3);}
    ctx.restore();
  }
  function flames(ctx,time,front=false){fires.forEach(([x,y],i)=>{if((i>=6)===front)flame(ctx,x,y,time,i);});}
  function base(ctx){if(!ready(image))return false;ctx.drawImage(image,0,0,1024,1024*scale);return true;}
  function columnShadow(ctx,o){glow(ctx,o.x+8,o.y+5,o.r*1.6,o.r*.65,'0,5,16',.5);}
  function drawColumn(ctx,o,player){
    if(!ready(column))return;
    const s=o.r*2/462;ctx.save();
    if(player&&Math.abs(player.x-o.x)<o.r+18&&player.y<o.y&&player.y>o.y-160)ctx.globalAlpha=.3;
    ctx.translate(o.x-513*s,o.y-1425*s);ctx.scale(s,s);path(ctx,columnClip);ctx.clip();ctx.drawImage(column,0,0);ctx.restore();
  }
  function front(ctx,player,time=0){
    if(!ready(image))return;
    foreground.forEach((part,i)=>{
      const overlap=player&&player.y<part.depth*scale&&inside(player.x/scale,(player.y-24)/scale,part.polygon);
      ctx.save();path(ctx,part.polygon,scale);ctx.clip();if(overlap)ctx.globalAlpha=.3;base(ctx);ctx.restore();
      const [x,y]=fires[i+6];flame(ctx,x,y,time,i+6);
    });
  }
  function portal(ctx,socket,open,time=0){
    const [sx,sy]=sockets[socket],x=sx*scale,y=sy*scale;ctx.save();ctx.translate(x,y);
    const color=open?'#8de4cf':'#d2796c';ctx.strokeStyle=color;ctx.fillStyle=open?'rgba(55,125,125,.2)':'rgba(29,15,28,.35)';
    ctx.beginPath();ctx.moveTo(-27,3);ctx.lineTo(-27,-46);ctx.lineTo(0,-65);ctx.lineTo(27,-46);ctx.lineTo(27,3);ctx.closePath();ctx.fill();
    ctx.lineWidth=2;ctx.stroke();
    if(open){glow(ctx,0,-21,38,61,'93,235,209',.15);ctx.setLineDash([3,8]);ctx.lineDashOffset=-time*10;ctx.stroke();}
    else {ctx.beginPath();ctx.moveTo(-20,-44);ctx.lineTo(20,-5);ctx.moveTo(20,-44);ctx.lineTo(-20,-5);ctx.stroke();}
    ctx.restore();
  }
  function atmosphere(ctx,time=0){
    ctx.save();for(let i=0;i<22;i++){
      const x=50+(i*137)%920,y=130+(i*97+time*7)%410;
      if(floorContains(x,y)){ctx.fillStyle=`rgba(207,207,165,${.09+.1*Math.sin(i+time*.5)**2})`;ctx.fillRect(x+Math.sin(time*.2+i)*9,y,1.4,1.4);}
    }ctx.restore();
  }
  function debug(ctx,obstacles=[]){ctx.save();polygons.forEach(p=>{path(ctx,p,scale);ctx.fillStyle='rgba(40,208,160,.13)';ctx.fill();ctx.strokeStyle='#5bffd0';ctx.lineWidth=1;ctx.stroke();});
    for(const o of obstacles){ctx.beginPath();ctx.arc(o.x,o.y,o.r,0,Math.PI*2);ctx.fillStyle='rgba(247,91,102,.32)';ctx.fill();ctx.strokeStyle='#ff7884';ctx.stroke();}ctx.restore();}
  return {id:'gallery-visual-v1',scale,image,column,ready,polygons,sockets,foreground,columnClip,fires,pools,inside,floorContains,base,ground,flames,front,drawColumn,columnShadow,portal,atmosphere,debug};
})();


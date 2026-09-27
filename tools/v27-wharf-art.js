/* Chapter-only world presentation. The dry union is the collision geometry;
 * replacing legacy stone ground on this chapter avoids false high terraces. */
(() => {
  'use strict';
  if(window.V27WharfArt)return;
  const ID='drownedwharf',scope=new WeakMap(),patterns=new WeakMap(),tiles={};
  const images={},metrics={rooms:0,corridors:0,props:0,faded:0};
  const urls={floor:'../assets/v27/wharf/wharf-floor.png',props:'../assets/v27/wharf/wharf-props.png',mobs:'../assets/v27/wharf/wharf-mobs.png'};
  function image(key){return images[key]||(images[key]=loadImage(urls[key]));}
  function available(im){return !!im&&im.width>0&&im.height>0&&im.complete!==false;}
  function path(c,p){
    // Nonzero clipping is a union only when every input has the same winding.
    const area=p.reduce((sum,a,i)=>{const b=p[(i+1)%p.length];return sum+a[0]*b[1]-b[0]*a[1];},0);
    const points=area<0?[...p].reverse():p;
    points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();
  }
  const active=j=>j?.levelId===ID;
  const background=BiomeArtV3.background;
  BiomeArtV3.background=function(c,j,v){
    if(!active(j))return background.apply(this,arguments);
    const gr=c.createLinearGradient(0,v.y,0,v.y+v.h);gr.addColorStop(0,'#172e36');gr.addColorStop(1,'#233b41');
    c.save();c.fillStyle=gr;c.fillRect(v.x,v.y,v.w,v.h);
    // World-anchored, low contrast broken ripples outside the dry polygon union.
    c.lineWidth=1;
    for(let y=Math.floor(v.y/37)*37;y<v.y+v.h;y+=37){
      for(let x=Math.floor(v.x/118)*118;x<v.x+v.w;x+=118){
        const shift=Math.sin(y*.016+x*.004)*19;
        c.strokeStyle=((x+y)%3)?'rgba(130,169,170,.10)':'rgba(8,23,29,.18)';
        c.beginPath();c.moveTo(x+shift,y);c.quadraticCurveTo(x+31+shift,y-3,x+62+shift,y);c.stroke();
      }
    }c.restore();
  };
  const ground=BiomeArtV3.ground;
  BiomeArtV3.ground=function(c,g,rooms,corridors,v){
    scope.set(c,active(g?.journey));
    if(!active(g?.journey))return ground.apply(this,arguments);
    metrics.rooms=rooms.length;metrics.corridors=corridors.length;metrics.props=metrics.faded=0;
    const floor=image('floor');image('props');
    c.save();try{
      c.beginPath();for(const r of rooms)for(const p of r.polygons)path(c,p);for(const l of corridors)path(c,l.polygon);c.clip();
      c.fillStyle='#48443a';c.fillRect(v.x,v.y,v.w,v.h);
      let texture=BiomeArtV3.slate;
      if(available(floor)){
        if(!tiles.shore){
          for(const [key,x]of [['wood',26],['shore',750]]){
            const tile=document.createElement('canvas');tile.width=tile.height=672;tile.getContext('2d').drawImage(floor,x,24,672,672,0,0,672,672);tiles[key]=tile;
          }
        }
        texture=tiles.shore;
      }
      if(available(texture)){
        let saved=patterns.get(c);
        if(!saved||saved.image!==texture){const pattern=c.createPattern(texture,'repeat');pattern.setTransform({a:.8,b:0,c:0,d:.8,e:0,f:0});saved={image:texture,pattern};patterns.set(c,saved);}
        c.fillStyle=saved.pattern;c.fillRect(v.x,v.y,v.w,v.h);
      }
      if(tiles.wood)for(const r of rooms){
        if(r.design?.deckProfile==='shoal')continue;
        c.save();c.beginPath();for(const p of r.polygons)path(c,p);c.clip();const timber=c.createPattern(tiles.wood,'repeat');timber.setTransform({a:.6,b:0,c:0,d:.6,e:0,f:0});c.fillStyle=timber;c.fillRect(v.x,v.y,v.w,v.h);c.restore();
      }
      c.fillStyle='rgba(20,34,34,.14)';c.fillRect(v.x,v.y,v.w,v.h);
      // Repair seams on bridge planks share the exact bridge polygon and stay
      // flat: no rails, cubes or raised structures appear in navigable space.
      for(const l of corridors){
        c.save();c.beginPath();path(c,l.polygon);c.clip();
        if(tiles.wood){
          c.save();c.beginPath();c.rect(v.x,v.y,v.w,v.h);for(const r of rooms)for(const p of r.polygons)path(c,p);c.clip('evenodd');
          const timber=c.createPattern(tiles.wood,'repeat');timber.setTransform({a:.42,b:0,c:0,d:.42,e:0,f:0});c.fillStyle=timber;c.fillRect(v.x,v.y,v.w,v.h);c.restore();
        }
        c.strokeStyle='rgba(14,25,25,.18)';c.lineWidth=1;
        const dx=l.to.x-l.from.x,dy=l.to.y-l.from.y,len=Math.hypot(dx,dy),nx=-dy/len,ny=dx/len;
        for(let d=0;d<len;d+=24){const x=l.from.x+dx*d/len,y=l.from.y+dy*d/len;c.beginPath();c.moveTo(x+nx*150,y+ny*150);c.lineTo(x-nx*150,y-ny*150);c.stroke();}c.restore();
      }
      c.beginPath();for(const [a,b]of g.map?.boundary||[]){c.moveTo(...a);c.lineTo(...b);}
      c.lineJoin='round';c.strokeStyle='rgba(18,24,22,.8)';c.lineWidth=12;c.stroke();
      c.strokeStyle='rgba(149,140,110,.7)';c.lineWidth=3;c.stroke();
      c.strokeStyle='rgba(198,192,162,.55)';c.lineWidth=1;c.stroke();
    }finally{c.restore();}
  };
  // Entries are updated with verified atlas rectangles during art integration.
  const props={
    wharf_winch:{rect:[45,144,735,463],anchor:[.49,.96]},
    wharf_hull:{rect:[786,140,855,507],anchor:[.50,.96]},
    wharf_piles:{rect:[1697,105,434,556],anchor:[.50,.96]}
  };
  for(const [id,spec]of Object.entries(props))BiomeArtV3.sprites[id]={...spec,height:120,r:36};
  const prop=BiomeArtV3.prop;
  BiomeArtV3.prop=function(c,o,p,t){
    if(o?.biome!==ID)return prop.apply(this,arguments);
    const spec=props[o.sprite]||props.wharf_piles,im=image('props');
    if(!spec||!available(im)){
      const fallback={...o,sprite:o.sprite==='wharf_hull'?'tidewall':'tidepillar'};
      return prop.call(this,c,fallback,p,t);
    }
    const [sx,sy,sw,sh]=spec.rect,h=props[o.sprite]?o.height:Math.min(64,o.height),w=h*sw/sh;
    c.save();try{
      metrics.props++;c.fillStyle='rgba(4,14,17,.42)';c.beginPath();c.ellipse(o.x+4,o.y+3,o.r*1.1,Math.max(4,o.r*.35),0,0,Math.PI*2);c.fill();
      if(p&&p.y<o.y&&p.y>o.y-h&&Math.abs(p.x-o.x)<w*.47){c.globalAlpha*=.36;metrics.faded++;}
      c.drawImage(im,sx,sy,sw,sh,o.x-w*spec.anchor[0],o.y-h*spec.anchor[1],w,h);
    }finally{c.restore();}
  };
  const mobSpecs={"wharf_crab":{"height":85,"anchor":[0.5,0.94],"frames":{"idle":[0,0,512,512],"walk":[512,0,512,512],"attack":[1024,0,512,512],"cast":[1536,0,512,512]},"inkBounds":{"idle":[101,306,309,173],"walk":[621,302,293,177],"attack":[1078,311,403,168],"cast":[1662,213,259,266]},"renderHeight":251.56},"wharf_harpooner":{"height":96,"anchor":[0.5,0.94],"frames":{"idle":[0,512,512,512],"walk":[512,512,512,512],"attack":[1024,512,512,512],"cast":[1536,512,512,512]},"inkBounds":{"idle":[99,702,313,289],"walk":[608,711,319,280],"attack":[1102,739,356,252],"cast":[1664,661,256,330]},"renderHeight":170.08},"wharf_foreman":{"height":160,"anchor":[0.5,0.94],"frames":{"idle":[0,1024,512,512],"walk":[512,1024,512,512],"attack":[1024,1024,512,512],"cast":[1536,1024,512,512]},"inkBounds":{"idle":[83,1214,345,289],"walk":[606,1203,323,300],"attack":[1076,1235,407,268],"cast":[1646,1197,291,306]},"renderHeight":283.46}};
  const asset=ActorMotion.asset;
  ActorMotion.asset=function(group,id){const spec=mobSpecs[id];return spec?{group,id,height:spec.height}:asset.apply(this,arguments);};
  const bodyTop=Renderer.prototype.bodyTop;
  Renderer.prototype.bodyTop=function(group,id,e,r){
    const spec=mobSpecs[id];if(!spec)return bodyTop.apply(this,arguments);
    const state=e.telegraph||e.state==='windup'?'cast':ActorMotion.state(e).left>0?'attack':'idle';
    const ink=spec.inkBounds[state],frame=spec.frames[state];
    return e.y-(spec.anchor[1]*frame[3]-(ink[1]-frame[1]))*spec.renderHeight/frame[3];
  };
  const draw=ActorMotion.draw;
  ActorMotion.draw=function(c,group,id,e,options={}){
    const spec=mobSpecs[id];if(!spec)return draw.apply(this,arguments);
    const im=image('mobs');if(!available(im))return draw.apply(this,arguments);
    const s=options.state||ActorMotion.state(e);
    const state=e.telegraph||e.state==='windup'?'cast':s.left>0?'attack':s.walk>.2?'walk':'idle';
    const f=spec.frames[state],h=options.height||spec.renderHeight||spec.height,w=h*f[2]/f[3];
    c.save();try{
      c.translate(e.x,e.y+(state==='walk'?Math.sin(s.phase||0)*1.1:0));c.scale(s.facing||1,1);
      c.drawImage(im,...f,-w*spec.anchor[0],-h*spec.anchor[1],w,h);
    }finally{c.restore();}return true;
  };
  window.V27WharfArt=Object.freeze({version:27,images,urls,props,mobSpecs,metrics});
})();

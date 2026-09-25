/* v20 / Kiln of Daybreak. Inject after v19 patches, before js/main.js.
   Presentation only: no RNG, collision, actor stats or storage mutations. */
(() => {
  'use strict';
  if (window.V20Design) return;

  // Original generated raster art; sibling assets served beside adventure-v20/.
  const raster = {
    seamCrab: loadImage('../assets/v20/seam-crab.png'),
    ceramicFloor: loadImage('../assets/v20/ceramic-observatory-floor.png')
  };
  BestiaryArt.specs.seamcrab = {rect:[0,0,1254,1254],height:96,image:raster.seamCrab};
  const TAU = Math.PI * 2;
  const palettes = Object.freeze({
    roots: { ink:'#133831', light:'#8bd8b2', material:'reed' },
    bastion: { ink:'#2e3038', light:'#d4c19b', material:'staple' },
    forge: { ink:'#382c31', light:'#f3aa78', material:'vent' },
    eclipse: { ink:'#22283d', light:'#bfb9ed', material:'orbit' },
    rootvault: { ink:'#303328', light:'#cda37d', material:'vein' },
    storm: { ink:'#253e50', light:'#b6e2ef', material:'fracture' },
    tide: { ink:'#194248', light:'#8dddd0', material:'ripple' },
    sunforge: { ink:'#42312e', light:'#f4b675', material:'vent' },
    amber: { ink:'#40362b', light:'#e4c181', material:'drop' },
    glass: { ink:'#30374e', light:'#c5d6ee', material:'prism' },
    citadel: { ink:'#303840', light:'#dfba7a', material:'staple' },
    ashen: { ink:'#362e37', light:'#d99f93', material:'notch' }
  });
  const rgba = (hex, a) => `rgba(${parseInt(hex.slice(1,3),16)},${parseInt(hex.slice(3,5),16)},${parseInt(hex.slice(5,7),16)},${a})`;
  const cache = new WeakMap();
  const scope = new WeakMap();
  const on = g => !!g?.journey?.seamless;
  const seen = (x,y,v,p=32) => x>=v.x-p && y>=v.y-p && x<=v.x+v.w+p && y<=v.y+v.h+p;
  function rim(room) {
    if (cache.has(room)) return cache.get(room);
    const marks = [];
    for (const poly of room.polygons || []) for(let i=0;i<poly.length;i++) {
      const a=poly[i], b=poly[(i+1)%poly.length], dx=b[0]-a[0], dy=b[1]-a[1], len=Math.hypot(dx,dy);
      if(len<60) continue;
      const count=Math.min(12,Math.floor(len/82));
      for(let j=0;j<count;j++) {
        const t=(j+.5)/count, x=a[0]+dx*t, y=a[1]+dy*t;
        // Move toward the room centre; clip still restricts this to actual floor.
        const cx=room.center.x-x, cy=room.center.y-y, d=Math.hypot(cx,cy)||1;
        marks.push({x:x+cx/d*24,y:y+cy/d*24,a:Math.atan2(dy,dx),i:j});
      }
    }
    cache.set(room,marks); return marks;
  }
  function mark(c, type, i) {
    c.beginPath();
    if(type==='ripple' || type==='orbit') {
      c.ellipse(0,0,12,4,0,type==='orbit'?.3:Math.PI,TAU-.3);
      c.ellipse(0,4,8,3,0,Math.PI,TAU);
    } else if(type==='prism'||type==='fracture') {
      c.moveTo(-10,4); c.lineTo(0,-5); c.lineTo(11,3); c.lineTo(-10,4);
      c.moveTo(0,-5); c.lineTo(3,4);
      if(type==='fracture'){c.moveTo(11,3);c.lineTo(18,-3);}
    } else if(type==='staple') {
      c.moveTo(-8,4);c.lineTo(-8,-3);c.lineTo(8,-3);c.lineTo(8,4);
      c.moveTo(-5,1);c.lineTo(5,1);
    } else if(type==='drop') {
      c.moveTo(0,-6);c.bezierCurveTo(-11,2,-8,7,0,7);c.bezierCurveTo(8,7,11,2,0,-6);
    } else if(type==='vein'||type==='reed') {
      c.moveTo(-12,5);c.quadraticCurveTo(0,2,10,-5);c.moveTo(-2,2);c.lineTo(-3,-5);
      c.moveTo(4,-1);c.lineTo(10,4);
    } else {
      for(let n=0;n<3;n++){c.moveTo(n*6-6,3);c.lineTo(n*6-3,-3-(i%2)*2);}
    }
    c.stroke();
  }
  function ground(c,g,rooms,view) {
    if(!on(g)) return;
    c.save();c.lineWidth=1.25;
    for(const room of rooms) {
      const p=palettes[room.biome];if(!p || !room.polygons?.length) continue;
      c.save();c.beginPath();
      for(const poly of room.polygons){poly.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();}
      c.clip();
      if(room.biome==='glass' && ready(raster.ceramicFloor)) {
        let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
        for(const poly of room.polygons)for(const [x,y] of poly){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}
        if(x1>=view.x && y1>=view.y && x0<=view.x+view.w && y0<=view.y+view.h){
          c.globalAlpha=room.biome==='glass'?.52:.29;
          c.drawImage(raster.ceramicFloor,x0,y0,x1-x0,y1-y0);
          c.globalAlpha=1;
        }
      }
      // Quiet center and tactile rim. These marks have no collision semantics.
      for(const m of rim(room)) if(seen(m.x,m.y,view)) {
        c.save();c.translate(m.x,m.y);c.rotate(m.a);
        c.strokeStyle=rgba(p.ink,.5);c.translate(1,2);mark(c,p.material,m.i);
        c.translate(-1,-2);c.strokeStyle=rgba(p.light,.25);mark(c,p.material,m.i);c.restore();
      }
      c.restore();
    }
    c.restore();
  }
  const oldGround=BiomeArtV3.ground;
  BiomeArtV3.ground=function(c,g,rooms,corridors,view) {
    scope.set(c,on(g));const result=oldGround.apply(this,arguments);
    ground(c,g,rooms,view);return result;
  };
  const oldProp=BiomeArtV3.prop;
  BiomeArtV3.prop=function(c,o,player,time) {
    const result=oldProp.apply(this,arguments),p=palettes[o?.biome];
    if(!scope.get(c)||!p||o.kind!=='biome-prop'||o.r<15) return result;
    // A small foot bevel, always below the prop body, reinforces the shared plane.
    const r=Math.min(40,o.r),x=o.x,y=o.y+6;
    c.save();c.lineWidth=1.1;c.strokeStyle=rgba(p.light,.36);c.beginPath();
    c.ellipse(x,y,r*.7,Math.max(3,r*.19),0,.12,Math.PI-.12);c.stroke();c.restore();
    return result;
  };
  const oldTelegraphs=Renderer.prototype.drawTelegraphs;
  Renderer.prototype.drawTelegraphs=function() {
    const result=oldTelegraphs.apply(this,arguments),g=this.g,c=this.ctx;
    if(!on(g))return result;
    c.save();
    if(g.map?.polygons?.length){c.beginPath();for(const poly of g.map.polygons){poly.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();}c.clip();}
    for(const e of g.enemies || []) {
      const t=e.telegraph;if(!e.alive||!t?.shapes?.length||!(t.total>0))continue;
      // Match legacy visibility: room warnings remain useful at screen edge.
      const k=Math.max(0,Math.min(1,1-t.time/t.total)),ink=t.kind==='summon'?'#d4dfad':'#ffba91';
      for(const s of t.shapes) {
        RootCombat.path(c,s);c.setLineDash([]);c.strokeStyle='rgba(10,13,23,.8)';c.lineWidth=5;c.stroke();
        c.setLineDash(k<.75?[7,5]:[]);c.strokeStyle=ink;c.lineWidth=1.75;c.stroke();c.setLineDash([]);
        if(s.shape==='lane' && s.len>45) {
          c.save();c.translate(s.x,s.y);c.rotate(s.angle||0);c.strokeStyle=rgba(ink,.65);c.lineWidth=1.5;c.beginPath();
          const end=Math.min(s.len-12,Math.max(18,s.len*k));
          c.moveTo(end-7,-4);c.lineTo(end,0);c.lineTo(end-7,4);c.stroke();c.restore();
        }
      }
      // Four progressive beats remain legible without relying on color.
      c.save();c.translate(e.x,e.y+18);
      for(let n=0;n<4;n++){c.fillStyle=k>=(n+1)/4?ink:'#17202b';c.fillRect(n*5-9,-2,3,4);}
      c.restore();
    }
    c.restore();return result;
  };
  const style=document.createElement('style');style.id='v20-design-style';
  style.textContent=`
    :root{--panel:rgba(18,27,36,.98);--panel-border:#53636d;--accent:#e1bb85;--accent2:#9fd2ce;--muted:#acb9c1}
    .panel{border-radius:5px;box-shadow:0 18px 65px #0009,inset 0 1px #d2e2e21f;border-top:2px solid #b99a72}
    .panel h1{letter-spacing:1.2px}.panel h2{letter-spacing:.35px}
    button{border-radius:3px;background:#24333e}button:hover{background:#31444e}
    button.primary{background:#494031;border-color:#bb9b70;color:#ffe1b3}
    button:focus-visible{outline:2px solid #b8efed;outline-offset:3px}
    @media(prefers-reduced-motion:reduce){.overlay{animation:none}button{transition:none}}
  `;
  document.head.appendChild(style);
  window.V20Design=Object.freeze({version:20,concept:'Керамика и световые швы',palettes,raster,
    features:Object.freeze(['generated-seam-crab','generated-ceramic-floor','biome-rim-materials','prop-foot-bevel','dual-contrast-threats','four-beat-warnings','ceramic-interface'])});
})();

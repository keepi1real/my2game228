'use strict';
// Expedition encounters opt in explicitly; the original campaign pool stays intact.
Object.assign(MONSTERS, {
  thornstalker:{name:'Терновый ловчий',symbol:'Л',shape:'tri',color:'#d69063',size:14,hp:58,dmg:12,speed:156,xp:26,shards:2,gold:[5,11],sight:600,attackRange:195,attackCd:2.5,windup:.65,minFloor:99,weight:0,rootvault:true,pattern:'lunge'},
  carapace:{name:'Панцирник',symbol:'П',shape:'hex',color:'#a8b5a6',size:24,hp:142,dmg:21,speed:70,armor:3,xp:45,shards:3,gold:[9,17],sight:600,attackRange:94,attackCd:2.8,windup:.9,minFloor:99,weight:0,rootvault:true,pattern:'sweep'},
  sporecantor:{name:'Споровый певчий',symbol:'С',shape:'circle',color:'#e7b874',size:16,hp:67,dmg:11,speed:84,xp:30,shards:2,gold:[6,13],sight:600,attackRange:310,attackCd:3.8,windup:1.05,keepDistance:210,ranged:true,projSpeed:210,minFloor:99,weight:0,rootvault:true,pattern:'spores'},
  embermoth:{name:'Искровая моль',symbol:'М',shape:'diamond',color:'#ef9561',size:14,hp:44,dmg:10,speed:118,xp:25,shards:2,gold:[4,10],sight:600,attackRange:300,attackCd:2.8,windup:.8,keepDistance:190,ranged:true,projSpeed:235,projColor:'#ffa55f',minFloor:99,weight:0,rootvault:true,pattern:'fan'},
});
Object.assign(BOSSES, {
  bellwarden:{id:'bellwarden',name:'Слепой звонарь',symbol:'З',shape:'hex',color:'#d7b36b',size:30,hp:470,dmg:19,speed:66,armor:3,xp:250,shards:20,gold:[55,85],sight:700,attackRange:92,attackCd:3,windup:1,abilities:{toll:5.5},rootvault:true,pattern:'sweep'},
  rootmother:{id:'rootmother',name:'Матерь корней',symbol:'К',shape:'circle',color:'#e89970',size:30,hp:920,dmg:19,speed:72,armor:2,xp:520,shards:42,gold:[100,150],sight:700,attackRange:96,attackCd:3,windup:.9,abilities:{rupture:5.8,summon:14},rootvault:true,pattern:'sweep'},
});

// One alpha atlas, normalized once into the existing 256 px animation rig.
// Crop polygons exclude neighbouring wing tips without changing source artwork.
const BestiaryArt = (()=>{
  const image=loadImage('assets/recovered-v9/8eb1f4ea83897334.png'),cache=new Map();
  const specs={
    thornstalker:{rect:[20,0,490,478],height:78},
    carapace:{rect:[523,0,530,478],height:96},
    sporecantor:{rect:[1092,0,441,483],height:88},
    embermoth:{rect:[0,478,609,492],height:98,clip:[[0,478],[609,491],[551,681],[476,928],[275,970],[80,931],[0,845]]},
    bellwarden:{rect:[551,478,500,546],height:144,clip:[[828,478],[970,478],[1028,660],[1051,900],[984,1024],[604,1024],[551,863],[581,674],[652,562],[780,540]]},
    rootmother:{rect:[1063,484,470,540],height:164},
  };
  function sprite(id){
    const s=specs[id],source=s?.image||image;if(!s||!ready(source))return null;if(cache.has(id))return cache.get(id);
    const c=document.createElement('canvas');c.width=c.height=256;const ctx=c.getContext('2d'),[x,y,w,h]=s.rect,scale=244/Math.max(w,h),left=(256-w*scale)/2,top=249-h*scale;
    ctx.save();ctx.translate(left-x*scale,top-y*scale);ctx.scale(scale,scale);
    if(s.clip){ctx.beginPath();s.clip.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.clip();}
    ctx.drawImage(source,x,y,w,h,x,y,w,h);ctx.restore();cache.set(id,c);return c;
  }
  return {specs,sprite,image};
})();


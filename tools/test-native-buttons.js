'use strict';
// Tiny DOM adapter for production button handlers, not a browser substitute.
function buttons(){
  let html='',els=[];
  const key=s=>s.replace(/-([a-z])/g,(_,c)=>c.toUpperCase());
  function matches(el,selector){const m=selector.match(/^\[([^\]^=]+)(\^?=)?["']?([^\]"']*)["']?\]$/);if(!m)return false;return m[2]==='^='?(el.attrs[m[1]]||'').startsWith(m[3]):m[2]==='='?el.attrs[m[1]]===m[3]:Object.hasOwn(el.attrs,m[1]);}
  return {get innerHTML(){return html;},set innerHTML(v){html=v;els=[...v.matchAll(/<button\b([^>]*)>/g)].map(m=>{const attrs={};for(const a of m[1].matchAll(/([\w-]+)(?:="([^"]*)")?/g))attrs[a[1]]=a[2]||'';const events={};return {attrs,dataset:Object.fromEntries(Object.entries(attrs).filter(([k])=>k.startsWith('data-')).map(([k,v])=>[key(k.slice(5)),v])),style:{},classList:{add(){}},addEventListener(k,fn){events[k]=fn;},setAttribute(k,v){attrs[k]=v;},focus(){events.focus?.({});},click(){if(!Object.hasOwn(attrs,'disabled'))events.click?.({preventDefault(){}});}};});},querySelectorAll(s){return els.filter(e=>matches(e,s));},querySelector(s){return this.querySelectorAll(s)[0]||null;},click(attr,value){const e=this.querySelector(`[${attr}="${value}"]`);if(!e)throw Error('Missing button '+attr+'='+value);e.click();}};
}
module.exports={buttons};

'use strict';
// Export the exact playable preview as one downloadable HTML document.
// Only packaging and direct chapter entry differ from the published build.
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const args=process.argv.slice(2);
function option(name,fallback){const i=args.indexOf(name);return i<0?fallback:args[i+1];}
const input=path.resolve(option('--input',path.join(root,'adventure-v20/adventure-v20-play.html.gz')));
const output=path.resolve(option('--out',path.join(root,'Observatory-play.html')));
let html=zlib.gunzipSync(fs.readFileSync(input)).toString('utf8');
const embedded={};
for(const [id,file] of [['seamCrab','seam-crab.png'],['ceramicFloor','ceramic-observatory-floor.png']]){
  const token="'../assets/v20/"+file+"'";
  if(html.split(token).length!==3)throw Error('Unexpected asset references: '+file);
  embedded[id]='data:image/png;base64,'+fs.readFileSync(path.join(root,'assets/v20',file)).toString('base64');
  html=html.split(token).join('window.V20EmbeddedAssets.'+id);
}
const standalone='window.STANDALONE_GAME = true;';
if(html.split(standalone).length!==2)throw Error('Missing standalone marker');
html=html.replace(standalone,standalone+'\nwindow.V20EmbeddedAssets='+JSON.stringify(embedded)+';');
for(const query of ["new URLSearchParams(window.location?.search || '')","new URLSearchParams(window.location?.search||'')"]){
  if(html.split(query).length!==2)throw Error('Unexpected startup query');
  html=html.replace(query,"new URLSearchParams('debug=1&map=tideobservatory')");
}
if(html.includes('../assets/v20/'))throw Error('Unbundled v20 asset');
for(const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi))new vm.Script(match[1]);
fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,html);
console.log(JSON.stringify({output,bytes:Buffer.byteLength(html),embedded:Object.keys(embedded),chapter:'tideobservatory'}));

'use strict';
// From the exported kit: node install-room-visual.js /path/to/project [--build]
const fs=require('fs'),path=require('path'),crypto=require('crypto'),{execFileSync}=require('child_process');
function install(target,payload,build=false){
  const index=path.join(target,'index.html');if(!fs.existsSync(index))throw new Error('Target must contain index.html');
  let html=fs.readFileSync(index,'utf8');const v6=fs.existsSync(path.join(target,'js/room-floor.js'));
  for(const file of ['js/game.js','js/render.js','js/visual-assets.js'])if(!fs.existsSync(path.join(target,file)))throw new Error('Not the game project: missing '+file);
  if(v6&&!fs.existsSync(path.join(target,'js/room-save.js')))throw new Error('Room campaign lacks room-save.js');
  if(!html.includes('<script src="js/main.js"></script>'))throw new Error('Cannot locate game startup');
  const files=['assets/room-visual-v1/gallery.png','assets/room-visual-v1/column-sheet.png','js/room-visual-art.js',v6?'js/room-visual-v6.js':'js/room-visual-preview.js'];
  if(!v6)files.push('css/room-visual.css');
  // Preflight all files before changing the target. Never overwrite a different custom asset.
  const contents=files.map(file=>({file,data:fs.readFileSync(path.join(payload,file))}));
  for(const {file,data} of contents){const dest=path.join(target,file);if(fs.existsSync(dest)&&!data.equals(fs.readFileSync(dest)))throw new Error('Existing file differs; keep or rename it first: '+file);}
  const scripts=['js/room-visual-art.js',v6?'js/room-visual-v6.js':'js/room-visual-preview.js'];
  const additions=scripts.filter(file=>!html.includes(`src="${file}"`)).map(file=>`  <script src="${file}"></script>`).join('\n');
  if(additions)html=html.replace('<script src="js/main.js"></script>',additions.trimStart()+'\n  <script src="js/main.js"></script>');
  if(!v6&&!html.includes('href="css/room-visual.css"'))html=html.replace('</head>','  <link rel="stylesheet" href="css/room-visual.css">\n</head>');
  const original=fs.readFileSync(index,'utf8');
  if(html!==original){const hash=crypto.createHash('sha256').update(original).digest('hex').slice(0,10);const backup=path.join(target,`index-before-room-visual-${hash}.html`);if(!fs.existsSync(backup))fs.writeFileSync(backup,original,{flag:'wx'});}
  for(const {file,data} of contents){const dest=path.join(target,file);if(!fs.existsSync(dest)){fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,data,{flag:'wx'});}}
  if(html!==original)fs.writeFileSync(index,html);
  if(build){
    const output=path.join(target,'dist',v6?'undermountain-v6-visual.html':'room-visual-game.html');
    execFileSync(process.execPath,[path.join(target,'tools/bundle.js'),...(v6?['--room-expedition']:[]),output],{stdio:'inherit'});
  }
  return {mode:v6?'v6 gallery replacement':'current game art preview',files};
}
module.exports={install};
if(require.main===module){
  try{
    const target=process.argv.slice(2).find(a=>!a.startsWith('--'));if(!target)throw new Error('Usage: node install-room-visual.js /path/to/project [--build]');
    const bundled=path.join(__dirname,'payload'),payload=fs.existsSync(bundled)?bundled:path.resolve(__dirname,'..');
    const result=install(path.resolve(target),payload,process.argv.includes('--build'));
    console.log('Installed: '+result.mode+'. Original art and boss rooms retained.');
  }catch(e){console.error(e.message);process.exitCode=1;}
}

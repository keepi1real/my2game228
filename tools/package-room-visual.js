'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),{execFileSync}=require('child_process');
const root=path.resolve(__dirname,'..'),out=path.join(root,'dist/room-visual'),kit=path.join(out,'room-visual-kit');
const frames=['room-full.png','room-complete.png','room-gameplay.png','room-combat.png','room-collision.png','room-occlusion.png','room-touch.png'];
for(const name of [...frames,'room-manifest.json'])if(!fs.existsSync(path.join(out,name)))throw new Error('Run tools/test-room-visual.js first');
execFileSync(process.execPath,[path.join(__dirname,'bundle.js'),'--room-visual',path.join(out,'room-visual.html')],{stdio:'inherit'});
const html=fs.readFileSync(path.join(out,'room-visual.html'),'utf8'),script=html.match(/<script>([\s\S]*)<\/script>/)[1];new vm.Script(script);
if(/(?:src|href)="(?:assets|js|css)\//.test(html)||/assets\/room-visual-v1\//.test(script))throw new Error('Unbundled art resource');
fs.mkdirSync(kit,{recursive:true});
for(const file of ['assets/room-visual-v1/gallery.png','assets/room-visual-v1/column-sheet.png','js/room-visual-art.js','js/room-visual-preview.js','js/room-visual-v6.js','css/room-visual.css']){
  const dest=path.join(kit,'payload',file);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(path.join(root,file),dest);
}
fs.copyFileSync(path.join(root,'tools/install-room-visual.js'),path.join(kit,'install-room-visual.js'));
fs.copyFileSync(path.join(root,'ROOM_VISUAL.md'),path.join(kit,'README.md'));
fs.copyFileSync(path.join(root,'assets/room-visual-v1/PROMPTS.md'),path.join(kit,'PROMPTS.md'));
for(const file of [...frames,'room-manifest.json','room-visual.html'])fs.copyFileSync(path.join(out,file),path.join(kit,file));
const zip=path.join(out,'room-visual-kit.zip');if(fs.existsSync(zip))fs.unlinkSync(zip);
execFileSync('zip',['-q','-r',zip,'.'],{cwd:kit});
console.log('Ready: room-visual.html and room-visual-kit.zip');

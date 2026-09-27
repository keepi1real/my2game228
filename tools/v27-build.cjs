'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {compose}=require('./v20-compose.js');
const root=path.resolve(__dirname,'..');
const ids={wharf:'drownedwharf',quarry:'redquarry',darkroot:'darkroot'};
function assemble(options={}){
  const teams=options.teams||Object.keys(ids),roots=options.roots||{};
  const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,'v20-manifest.json'),'utf8'));
  manifest.chapter=path.join(__dirname,manifest.chapter);
  for(const p of manifest.patches)p.file=path.join(__dirname,p.file);
  manifest.chapters=teams.map(team=>path.join(roots[team]||root,'tools',`v27-${team}-level.json`));
  const end=manifest.patches.splice(manifest.patches.findIndex(p=>p.id==='combat-visibility'));
  manifest.patches.push({id:'v27-preview',file:path.join(__dirname,'v27-preview.js')});
  for(const team of teams)for(const kind of ['runtime','art','mob-art','combat']){
    const file=path.join(roots[team]||root,'tools',`v27-${team}-${kind}.js`);
    if(fs.existsSync(file))manifest.patches.push({id:`v27-${team}-${kind}`,file});
  }
  manifest.patches.push(...end);
  manifest.patches.push({id:'v27-menu',file:path.join(__dirname,'v27-menu.js')});
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'v27-compose-'));
  try{
    const mf=path.join(temp,'manifest.json');fs.writeFileSync(mf,JSON.stringify(manifest));
    const result=compose(path.join(root,'adventure-v19-play.html.gz'),mf);
    // Bundle every external local image, including team worktree art. Standalone
    // files then work from file:// without fetching or losing mobile art.
    const embedded=new Map(),assetData={};
    result.html=result.html.replace(/(['"])((?:\.\.\/)?assets\/(?:v20|v27)\/[^'"\s]+\.(?:png|webp|jpg))\1/g,(all,quote,asset)=>{
      const normalized=asset.replace(/^\.\.\//,'');
      const team=teams.find(t=>normalized.startsWith('assets/v27/'+t+'/'));
      const file=path.join(team?(roots[team]||root):root,normalized);
      if(!fs.existsSync(file))throw Error('Missing raster asset: '+file);
      if(!embedded.has(file)){const id='asset'+embedded.size;embedded.set(file,id);assetData[id]='data:image/'+(file.endsWith('.jpg')?'jpeg':file.split('.').pop())+';base64,'+fs.readFileSync(file).toString('base64');}
      return 'window.V27EmbeddedAssets.'+embedded.get(file);
    });
    const marker='window.STANDALONE_GAME = true;';
    if(result.html.split(marker).length!==2)throw Error('Missing standalone packaging marker');
    result.html=result.html.replace(marker,marker+'\nwindow.V27EmbeddedAssets='+JSON.stringify(assetData)+';');
    result.teams=teams;result.embedded=embedded.size;
    if(options.out){fs.mkdirSync(path.dirname(options.out),{recursive:true});fs.writeFileSync(options.out,result.html);}
    return result;
  }finally{fs.rmSync(temp,{recursive:true,force:true});}
}
if(require.main===module){
  const out=path.join(root,'dist/Three-frontiers-play.html');const r=assemble({out});
  if(process.argv.includes('--publish')){
    const dir=path.join(root,'three-frontiers');fs.mkdirSync(dir,{recursive:true});
    const bytes=require('node:zlib').gzipSync(r.html,{level:9}),chunk=18*1024*1024,parts=[];
    for(let i=0;i<bytes.length;i+=chunk){const name='three-frontiers-'+String(parts.length+1).padStart(2,'0')+'.bin';fs.writeFileSync(path.join(dir,name),bytes.subarray(i,i+chunk));parts.push(name);}
    fs.writeFileSync(path.join(dir,'payload.json'),JSON.stringify({version:27,parts,bytes:bytes.length,sha256:require('node:crypto').createHash('sha256').update(bytes).digest('hex')}));
  }
  console.log(JSON.stringify({out,teams:r.teams,embedded:r.embedded}));
}
module.exports={assemble,ids,root};

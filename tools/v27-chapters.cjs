'use strict';
// Optional build-time registry entries; old manifests produce identical output.
const palettes={
  drownedwharf:{base:'tide',name:'Верфь утонувшего света',floor:'#384c49',floorAlt:'#54665d',edge:'#102d32',accent:'#97c1b6',mist:'#27494d'},
  redquarry:{base:'sunforge',name:'Красный карьер',floor:'#925641',floorAlt:'#a96649',edge:'#452b2a',accent:'#e6c5a1',mist:'#6c3b30'},
  darkroot:{base:'rootvault',name:'Сердце тёмного корня',floor:'#304238',floorAlt:'#455647',edge:'#162c29',accent:'#afc8a3',mist:'#1f3933',pillar:'dr_stump',cluster:'dr_cluster',wall:'dr_cluster'}
};
function extendChapters(html,levels){
  const ids=levels.map(l=>l.id);
  if(new Set(ids).size!==ids.length)throw Error('Duplicate additional chapter');
  for(const level of levels)if(!palettes[level.id]||level.rooms?.length!==16||level.next!==null)throw Error('Invalid standalone chapter: '+level.id);
  const replace=(a,b)=>{if(html.split(a).length!==2)throw Error('v27 chapter anchor mismatch: '+a.slice(0,90));html=html.replace(a,b);};
  const json=v=>JSON.stringify(v).replace(/</g,'\\u003c');
  const member=j=>json(ids)+'.includes('+j+'.levelId)';
  const bf='  for (const biome of Object.values(biomes)) Object.freeze(biome);';
  replace(bf,levels.map(l=>{const {base,...p}=palettes[l.id];return '  biomes.'+l.id+'={...biomes.'+base+',...'+json(p)+'};';}).join('\n')+'\n'+bf);
  const lf='  for(const level of Object.values(levels))Object.freeze(level);';
  replace(lf,levels.map(l=>'  levels.'+l.id+'='+json(l)+';').join('\n')+'\n'+lf);
  replace("const floor=j=>j.levelId==='tideobservatory'?11:","const floor=j=>"+member('j')+"?1:j.levelId==='tideobservatory'?11:");
  replace("const next=j=>j.levelId==='tideobservatory'?null:","const next=j=>"+member('j')+"?null:j.levelId==='tideobservatory'?null:");
  replace("const rotation=j.levelId==='tideobservatory'?10:signatures[j.levelId],sequences=","const rotation=signatures[j.levelId]??10,sequences=");
  replace("sequence=j.levelId==='tideobservatory'?['terrace','gallery','court','cross','terrace']:sequences[j.levelId];","sequence=sequences[j.levelId]||['terrace','gallery','court','cross','terrace'];");
  replace("motif:(r.id*5+(j.levelId==='tideobservatory'?10:signatures[j.levelId]))%6","motif:(r.id*5+(signatures[j.levelId]??10))%6");
  replace("l.half=(j.levelId==='tideobservatory'?116:widths[j.levelId])+l.id%2*10;","l.half=(widths[j.levelId]??116)+l.id%2*10;");
  replace("roster=j.levelId==='tideobservatory'?ExpeditionLevels.get(j.levelId).encounters:rosters[j.levelId]","roster=rosters[j.levelId]||ExpeditionLevels.get(j.levelId).encounters");
  replace("(g.journey.levelId==='tideobservatory'?ExpeditionLevels.get(g.journey.levelId).encounters:rosters[g.journey.levelId])[s.bossPhases]","(rosters[g.journey.levelId]||ExpeditionLevels.get(g.journey.levelId).encounters)[s.bossPhases]");
  replace('const profile=j=>modes[j.difficulty]||modes.veteran;',ids.map(id=>'ranks.'+id+'=1;').join('')+'\n  const profile=j=>modes[j.difficulty]||modes.veteran;');
  replace("g.hero.name.toUpperCase()+' / ЭТАЖ '+g.floor","g.hero.name.toUpperCase()+("+member('g.journey')+"?' / ИСПЫТАНИЕ':' / ЭТАЖ '+g.floor)");
  replace("'КАРТА · ЭТАЖ '+g.floor","("+member('g.journey')+"?'КАРТА ИСПЫТАНИЯ':'КАРТА · ЭТАЖ '+g.floor)");
  replace('if(AdventureRun.enabled(j))j.notice=',"if("+member('j')+")j.notice=level.name+' · самостоятельный поход. Найдите хранителя. M — карта.';else if(AdventureRun.enabled(j))j.notice=");
  return html;
}
module.exports={extendChapters,palettes};

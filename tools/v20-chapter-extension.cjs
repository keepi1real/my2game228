'use strict';
// Build-time registry extension for the pinned v19 source. Existing level
// entries and old-run generation paths remain untouched.
const crypto = require('node:crypto');
const BASE_SHA256 = '62d8a85503ed1db2293792fc72e993cd77117199d6d125bcd3926bf687649a19';
const ID = 'tideobservatory';
function extendChapter(html, level) {
  if (crypto.createHash('sha256').update(html).digest('hex') !== BASE_SHA256)
    throw Error('Chapter extension requires the pinned original v19 base');
  if (!level || level.id !== ID || !Array.isArray(level.rooms) || level.rooms.length !== 16)
    throw Error('Chapter extension requires tideobservatory with 16 rooms');
  const replace = (anchor, replacement) => {
    if (html.split(anchor).length !== 2) throw Error('Chapter extension anchor mismatch: ' + anchor.slice(0, 100));
    html = html.replace(anchor, replacement);
  };
  const biomeFreeze = '  for (const biome of Object.values(biomes)) Object.freeze(biome);';
  replace(biomeFreeze, "  biomes.tideobservatory={...biomes.tide,name:'Обсерватория прилива',floor:'#556675',floorAlt:'#758999',edge:'#223542',accent:'#74c7c4',mist:'#477785'};\n" + biomeFreeze);
  const frozen = '  for(const level of Object.values(levels))Object.freeze(level);';
  const json = JSON.stringify(level).replace(/</g, '\\u003c');
  replace(frozen, '  levels.' + ID + '=' + json + ';\n' + frozen);
  replace("const floor=j=>enabled(j)?order.indexOf(j.levelId)+1:ExpeditionLevels.get(j.levelId).floor;",
    "const floor=j=>j.levelId==='tideobservatory'?11:enabled(j)?order.indexOf(j.levelId)+1:ExpeditionLevels.get(j.levelId).floor;");
  replace("const next=j=>enabled(j)?order[order.indexOf(j.levelId)+1]||null:ExpeditionLevels.get(j.levelId).next;",
    "const next=j=>j.levelId==='tideobservatory'?null:j.v21MapVersion===21&&j.levelId==='ashen'?'tideobservatory':enabled(j)?order[order.indexOf(j.levelId)+1]||null:ExpeditionLevels.get(j.levelId).next;");
  replace('Глава ${AdventureRun.floor(j)} / 10 · ${level.name}', "Глава ${AdventureRun.floor(j)} / ${j.levelId==='tideobservatory'?11:10} · ${level.name}");
  replace('const rotation=signatures[j.levelId],sequences=', "const rotation=j.levelId==='tideobservatory'?10:signatures[j.levelId],sequences=");
  replace('sequence=sequences[j.levelId];', "sequence=j.levelId==='tideobservatory'?['terrace','gallery','court','cross','terrace']:sequences[j.levelId];");
  replace('motif:(r.id*5+signatures[j.levelId])%6', "motif:(r.id*5+(j.levelId==='tideobservatory'?10:signatures[j.levelId]))%6");
  replace('l.half=widths[j.levelId]+l.id%2*10;', "l.half=(j.levelId==='tideobservatory'?116:widths[j.levelId])+l.id%2*10;");
  replace('const m=profile(j),roster=rosters[j.levelId],rank=', "const m=profile(j),roster=j.levelId==='tideobservatory'?ExpeditionLevels.get(j.levelId).encounters:rosters[j.levelId],rank=");
  return html;
}
module.exports = {extendChapter, BASE_SHA256, ID};

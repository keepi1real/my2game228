#!/usr/bin/env python3
"""Rebuild 3 x 5 x 8 transparent frames plus engine manifests and previews."""
from pathlib import Path
import json, hashlib
from PIL import Image,ImageDraw
import new_heroes as H

OUT=Path(__file__).resolve().parents[2]/'assets'/'hero-rigs'
STATES={'idle':8,'walk':12,'run':16,'attack':14,'cast':12}
NAMES={'baldin':'Таррок','mithrandir':'Элира','peregrin':'Шелт'}
def main():
    summary={}
    all_preview=Image.new('RGB',(8*192,3*5*192),(22,27,39))
    for hi,hero in enumerate(H.BUILD):
        dest=OUT/hero; (dest/'gifs').mkdir(parents=True,exist_ok=True); (dest/'frames').mkdir(exist_ok=True)
        atlas=Image.new('RGBA',(1536,960)); rows={}; layout={}; qa={}
        for ri,(state,fps) in enumerate(STATES.items()):
            frames=[H.draw(hero,p) for p in H.poses(hero,state)]
            for i,im in enumerate(frames):
                atlas.alpha_composite(im,(192*i,192*ri)); im.save(dest/'frames'/f'{state}-{i:02}.png')
                all_preview.paste(im,(192*i,192*(hi*5+ri)),im)
            dur=round(1000/fps)
            rows[state]={'row':ri,'frames':8,'fps':fps,'durations_ms':[dur]*8,'loop':state in ('idle','walk','run')}
            layout[state]=[{'x':i*192,'y':ri*192,'w':192,'h':192} for i in range(8)]
            preview=[]
            for im in frames:
                bg=Image.new('RGBA',(192,192),(22,27,39,255)); bg.alpha_composite(im); preview.append(bg.convert('RGB'))
            preview[0].save(dest/'gifs'/f'{state}.gif',save_all=True,append_images=preview[1:],duration=dur,loop=0 if rows[state]['loop'] else 1,disposal=2)
            qa[state]={'unique_frames':len(set(hashlib.sha256(im.tobytes()).hexdigest() for im in frames)), 'alpha_bboxes':[im.getbbox() for im in frames]}
            assert qa[state]['unique_frames']==8, (hero,state)
            for im in frames:
                bb=im.getbbox(); assert bb and bb[0]>0 and bb[1]>0 and bb[2]<192 and bb[3]<192,(hero,state,bb)
        atlas.save(dest/'sprite-sheet-alpha.png')
        manifest={'characterId':hero,'displayName':NAMES[hero],'engine':'articulated-rig','game_input':'sprite-sheet-alpha.png','sprite_sheet_alpha':'sprite-sheet-alpha.png','degraded_static_fallback':False,'cell':{'width':192,'height':192,'size':192},'anchor':{'x':88,'y':178},'facing':'right','animation':{'cellWidth':192,'cellHeight':192,'columns':8,'rows':rows},'frame_layout':{'columns':8,'rows':layout},'qa':qa}
        (dest/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
        summary[hero]={'displayName':NAMES[hero],'states':list(STATES),'frames':40,'atlas':[1536,960],'cell':[192,192],'anchor':[88,178]}
    all_preview.resize((768,1440)).save(OUT/'contact-sheet.png')
    (OUT/'summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2))
    print(json.dumps(summary,ensure_ascii=False,indent=2))
if __name__=='__main__':main()

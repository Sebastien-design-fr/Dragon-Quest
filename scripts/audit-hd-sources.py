#!/usr/bin/env python3
"""Audit uniquement : aucune modification des sprites installés et aucun upscale."""
import base64, io, json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageChops
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'hd-audit-output'
OUT.mkdir(exist_ok=True)
variants=('dragon','dragonne')
stages=('baby','young','adult','legendary')
def origin(variant,stage,pose):
    if pose=='full':
        folder='dragons' if variant=='dragon' else 'dragonne'
        return ROOT/'art'/folder/(stage+'.png')
    if pose=='flyMid' and not (variant=='dragon' and stage=='adult'):
        return None
    suffix={'sleep':'sleep','flyUp':'wings_up','flyMid':'wings_mid','flyDown':'wings_down'}[pose]
    return ROOT/'art'/'poses-v2'/f'{variant}_{stage}_{suffix}.png'
records=[]
for v in variants:
    for stage in stages:
        bundle=json.loads((ROOT/'assets'/'dragon-mission-approved'/f'{v}-{stage}.json').read_text())
        for name,encoded in sorted(bundle.items()):
            pose=name.rsplit('_',1)[1].replace('.webp','')
            before=Image.open(io.BytesIO(base64.b64decode(encoded)))
            before.load()
            source=origin(v,stage,pose)
            row={'name':name,'before_px':list(before.size),'before_alpha':before.getchannel('A').getextrema()[0]<255 if 'A' in before.getbands() else False,
                 'source':str(source.relative_to(ROOT)) if source is not None else None}
            if source is not None and source.exists():
                with Image.open(source) as img:
                    row['source_px']=list(img.size)
                    row['source_alpha']=img.getchannel('A').getextrema()[0]<255 if 'A' in img.getbands() else False
                    row['source_candidate']=img.width>=1600 and row['source_alpha']
            else:
                row['source_px']=None;row['source_alpha']=False;row['source_candidate']=False
            records.append(row)
(OUT/'dimensions-40.json').write_text(json.dumps(records,ensure_ascii=False,indent=2),encoding='utf8')
cellw,cellh=360,235
sheet=Image.new('RGB',(cellw*4,cellh*4),(27,34,49))
draw=ImageDraw.Draw(sheet)
for index,(v,stage) in enumerate((v,s) for v in variants for s in stages):
    row=next(r for r in records if r['name']==f'{v}_{stage}_full.webp')
    bundle=json.loads((ROOT/'assets'/'dragon-mission-approved'/f'{v}-{stage}.json').read_text())
    before=Image.open(io.BytesIO(base64.b64decode(bundle[f'{v}_{stage}_full.webp']))).convert('RGBA')
    source=origin(v,stage,'full')
    y=(index//2)*cellh;x=(index%2)*(cellw*2)
    for k,image in enumerate((before,Image.open(source).convert('RGBA') if source.exists() else None)):
        tx=x+k*cellw
        draw.text((tx+10,y+9),f'{v} / {stage} — '+('AVANT' if k==0 else 'SOURCE HD'),fill='white')
        if image is None:continue
        thumb=image.copy();thumb.thumbnail((cellw-30,cellh-47),Image.Resampling.LANCZOS)
        bg=Image.new('RGBA',thumb.size,(230,235,239,255));bg.alpha_composite(thumb)
        sheet.paste(bg.convert('RGB'),(tx+(cellw-thumb.width)//2,y+35+(cellh-47-thumb.height)//2))
sheet.save(OUT/'comparaison-8-full.jpg',quality=92)
from collections import Counter
summary={'count':len(records),'source_candidate_count':sum(r['source_candidate'] for r in records),
         'missing_sources':[r['name'] for r in records if r['source_px'] is None],
         'below_minimum':[r['name'] for r in records if r['source_px'] and r['source_px'][0]<1600],
         'sources_without_alpha':[r['name'] for r in records if r['source_px'] and not r['source_alpha']]}
(OUT/'resume.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf8')
print(json.dumps(summary,ensure_ascii=False))
print('Fichiers produits : hd-audit-output/{dimensions-40.json,comparaison-8-full.jpg,resume.json}')

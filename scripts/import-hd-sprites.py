#!/usr/bin/env python3
"""Prépare 40 sprites HD réellement peints; aucun redimensionnement.
Entrée : dossier de 40 PNG sources <variante>_<stade>_<pose>.png
Commande: python3 scripts/import-hd-sprites.py /chemin/vers/40_png
Produit des bundles dans hd-import-output/ uniquement pour revue, jamais directement dans les bundles approuvés.
"""
import base64, hashlib, io, json, sys
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
STAGES=('baby','young','adult','legendary')
VARIANTS=('dragon','dragonne')
OUT=ROOT/'hd-import-output'
def expected():
    for v in VARIANTS:
        for s in STAGES:
            poses=('full','sleep','flyUp','flyDown','flyMid') if (v,s)==('dragon','adult') else ('full','sleep','flyUp','flyDown','flyMid')
            for p in poses:yield v,s,p
def main(folder):
    source=Path(folder)
    OUT.mkdir(exist_ok=True)
    report=[];bundles={}
    for v,s,p in expected():
        file=source/f'{v}_{s}_{p}.png'
        if not file.is_file():raise ValueError(f'Source HD manquante: {file}')
        with Image.open(file) as img:
            if img.width<1600:raise ValueError(f'Largeur < 1600: {file} ({img.width})')
            if img.mode!='RGBA':raise ValueError(f'Image non RGBA: {file} ({img.mode})')
            a=img.getchannel('A')
            if a.getextrema()[0]==255:raise ValueError(f'Pas de transparence réelle: {file}')
            if a.getextrema()[1]==0:raise ValueError(f'Image vide: {file}')
            if sum(a.getpixel(x)>16 for x in ((0,0),(img.width-1,0),(0,img.height-1),(img.width-1,img.height-1)))>1:
                raise ValueError(f'Fond / coins opaques: {file}')
            key=(v,s)
            dims=bundles.get(key,{}).get('_dimensions')
            if dims and dims!=(img.width,img.height):raise ValueError(f'Cadrage incompatible pour {v}/{s}: {file}')
            bundles.setdefault(key,{'_dimensions':(img.width,img.height)})
            data=io.BytesIO()
            img.save(data,format='WEBP',quality=94,method=6,exact=True)
            payload=data.getvalue()
            name=f'{v}_{s}_{p}.webp'
            bundles[key][name]=base64.b64encode(payload).decode('ascii')
            report.append({'sprite':name,'width':img.width,'height':img.height,'bytes':len(payload),
                           'source_sha256':hashlib.sha256(file.read_bytes()).hexdigest()})
    for (v,s),bundle in bundles.items():
        bundle.pop('_dimensions')
        (OUT/f'{v}-{s}.json').write_text(json.dumps(bundle,ensure_ascii=False),encoding='utf8')
    (OUT/'sources-hd.json').write_text(json.dumps(report,indent=2),encoding='utf8')
    print(f'{len(report)} sprites HD exportés vers {OUT}. Relecture graphique OBLIGATOIRE avant intégration.')
if __name__=='__main__':
    if len(sys.argv)!=2:raise SystemExit('Usage: import-hd-sprites.py <dossier_40_png_HD>')
    main(sys.argv[1])

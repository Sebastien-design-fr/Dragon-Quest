#!/usr/bin/env python3
"""Preflight an illustrated rig's exported WebP layers before integration.

Usage: python3 scripts/check-baby-layers.py www/assets/layers/dragon/baby
Requires Pillow. This intentionally rejects opaque concept-sheet crops.
"""
import json, sys
from pathlib import Path
from PIL import Image

REQUIRED = {'body','head','neck','jaw','eye','eyelid','tail','wingNear','wingFar',
            'legFrontNear','legFrontFar','legRearNear','legRearFar'}

def check(directory):
    errors=[]
    directory=Path(directory)
    rig_path=directory/'rig.json'
    if not rig_path.exists(): return ['rig.json manquant']
    try: rig=json.loads(rig_path.read_text(encoding='utf-8'))
    except Exception as exc: return [f'rig.json illisible: {exc}']
    parts=rig.get('parts',[])
    names=[part.get('name') for part in parts]
    for missing in sorted(REQUIRED-set(names)): errors.append(f'Calque manquant: {missing}')
    if len(names)!=len(set(names)): errors.append('Noms de calques en double')
    for part in parts:
        texture=part.get('texture','')
        if not texture or Path(texture).name!=texture or not texture.endswith('.webp'):
            errors.append(f'Chemin de texture invalide: {texture}'); continue
        file=directory/texture
        if not file.exists():errors.append(f'Image absente: {file.name}');continue
        try:
            with Image.open(file) as img:
                rgba=img.convert('RGBA')
                if min(rgba.size)<24:errors.append(f'Image trop petite: {file.name}')
                alpha=rgba.getchannel('A')
                low,high=alpha.getextrema()
                if low==255:errors.append(f'Sans transparence: {file.name}')
                if high==0:errors.append(f'Calque invisible: {file.name}')
                corners=[rgba.getpixel(p)[3] for p in [(0,0),(rgba.width-1,0),(0,rgba.height-1),(rgba.width-1,rgba.height-1)]]
                if sum(v>16 for v in corners)>=3:
                    errors.append(f'Coins opaques suspects (fond de planche): {file.name}')
        except Exception as exc:errors.append(f'Image invalide {file.name}: {exc}')
    return errors

if __name__=='__main__':
    if len(sys.argv)<2:raise SystemExit('Usage: check-baby-layers.py <dossier du rig>')
    problems=check(sys.argv[1])
    if problems:
        print('\n'.join('ERREUR: '+p for p in problems))
        raise SystemExit(1)
    print('Contrôles techniques des calques réussis (contrôle artistique encore nécessaire).')

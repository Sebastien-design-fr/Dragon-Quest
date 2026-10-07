"""
Inventaire des dragons à partir du dépôt (source de vérité) :
stades, variantes, poses, résolutions, squelettes, ancrages, équipements compatibles,
et taille réellement affichée de chaque illustration sur des écrans de référence.

  python3 scripts/audit-dragons.py            -> docs/visual/DRAGON_MATRIX.md + docs/visual/dragon-matrix.json

Aucune donnée n'est codée en dur sur le nombre de stades ou de variantes : tout est lu dans
www/data/stages.json, www/data/rigs/, www/data/poses.json, www/assets/ et www/data/equipment.json.
"""
import glob
import json
import math
import os
import re

from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..')
WWW = os.path.join(ROOT, 'www')
OUT = os.path.join(ROOT, 'docs', 'visual')

# Écrans de référence : largeur CSS, hauteur CSS, densité. La scène occupe 60 % de la hauteur sur l'écran Dragon.
SCREENS = [
    ('Android 1080×2400 (densité 2,625)', 412, 915, 2.625),
    ('Android 1080×2400 (densité 3)', 360, 800, 3.0),
    ('Android 1440×3120 (densité 3,5)', 412, 891, 3.5),
]
STAGE_FRACTION = 0.60
# Plafond de densité du canvas : avant (HIGH = 2) et après le LOT 1 (HIGH = densité réelle, max 3).
CAP_BEFORE, CAP_AFTER = 2.0, 3.0
# Ce que chaque fichier de pose représente.
POSE_LABEL = {'full': 'NORMAL', 'sleep': 'SLEEP', 'flyUp': 'WINGS_UP', 'flyMid': 'WINGS_MID', 'flyDown': 'WINGS_DOWN'}
ANCHORS_EXPECTED = ['head_anchor', 'mouth_anchor', 'neck_anchor', 'chest_anchor', 'front_leg_anchor', 'rear_leg_anchor',
                    'front_leg_far_anchor', 'rear_leg_far_anchor', 'left_wing_anchor', 'right_wing_anchor', 'tail_anchor',
                    'tail_tip_anchor', 'body_center']


def load(p):
    with open(os.path.join(WWW, p), encoding='utf-8') as f:
        return json.load(f)


def size(path):
    with Image.open(path) as im:
        return im.size


def main():
    stages = load('data/stages.json')['stages']
    poses_idx = load('data/poses.json').get('poses', {})
    equipment = load('data/equipment.json')
    items = equipment.get('items', equipment)
    fits = load('data/fits.json')

    # Variantes : un dossier d'assets contenant <variante>_<stade>_full.*
    variants = []
    for d in sorted(glob.glob(os.path.join(WWW, 'assets', '*'))):
        v = os.path.basename(d)
        if glob.glob(os.path.join(d, '*', f'{v}_*_full.*')):
            variants.append(v)

    rows = []
    for v in variants:
        for st in stages:
            sid = st['id']
            # rig : <stade>.<variante>.json s'il existe, sinon celui du stade (comme DragonView.setStage)
            own = st['rig'].replace('.sprite.json', f'.{v}.json') if v != 'dragon' else None
            rig_path = own if own and os.path.exists(os.path.join(WWW, own)) else st['rig']
            rig = load(rig_path)
            body = next(b for b in rig['bones'] if b.get('part'))
            ds = body['scaleX']
            files = {}
            for f in glob.glob(os.path.join(WWW, 'assets', v, sid, f'{v}_{sid}_*.*')):
                key = re.sub(rf'^{v}_{sid}_', '', os.path.splitext(os.path.basename(f))[0])
                files[key] = f
            poses = {}
            for key, f in sorted(files.items()):
                w, h = size(f)
                prig_path = None if key == 'full' else f'data/rigs/{sid}.{v}.{key}.json'
                prig = load(prig_path) if prig_path and os.path.exists(os.path.join(WWW, prig_path)) else None
                pds = ds if key == 'full' else (next(b for b in prig['bones'] if b.get('part'))['scaleX'] if prig else None)
                poses[key] = {'file': os.path.relpath(f, WWW), 'w': w, 'h': h, 'bytes': os.path.getsize(f), 'drawScale': pds,
                              'rig': rig_path if key == 'full' else prig_path, 'rigExists': key == 'full' or prig is not None,
                              'declared': key == 'full' or key in poses_idx.get(v, {}).get(sid, [])}
            cam = rig['camera']
            # taille affichée (pixels physiques) sur chaque écran de référence
            for key, p in poses.items():
                p['display'] = []
                if p['drawScale'] is None:
                    continue
                for name, cw, ch, dpr in SCREENS:
                    out = {}
                    for label, cap in (('before', CAP_BEFORE), ('after', CAP_AFTER)):
                        rd = min(dpr, cap)
                        W, H = cw * rd, ch * STAGE_FRACTION * rd
                        s0 = min(W / cam['w'], H / cam['h']) * 0.94
                        scale_fly = 0.8 if key.startswith('fly') else 1.0
                        canvas_w = p['w'] * p['drawScale'] * s0 * scale_fly
                        phys_w = canvas_w * dpr / rd
                        out[label] = {'renderDpr': rd, 'canvasW': round(canvas_w), 'physicalW': round(phys_w),
                                      'texToCanvas': round(canvas_w / p['w'], 3), 'canvasToScreen': round(dpr / rd, 3),
                                      'sourceToScreen': round(phys_w / p['w'], 3)}
                    p['display'].append({'screen': name, **out})
            anchors = [a['name'] for a in rig.get('anchors', [])]
            deform = [b['name'] for b in rig['bones'] if b.get('radius')]
            compat = [i for i in items if sid in i.get('compatibleDragonStages', [])]
            rows.append({'variant': v, 'stage': sid, 'label': st.get('label', sid), 'minLevel': st.get('minLevel'),
                         'rig': rig_path, 'bones': len(rig['bones']), 'deformBones': deform, 'grid': rig.get('skin', {}).get('grid'),
                         'anchors': anchors, 'missingAnchors': [a for a in ANCHORS_EXPECTED if a not in anchors],
                         'equipScale': rig.get('scale'), 'camera': cam, 'poses': poses,
                         'equipmentCompatible': len(compat)})

    # équipements : fichiers par stade et taille affichée
    eq_rows = []
    for it in items:
        if it['category'] == 'effects':
            continue
        cat = it['category']
        base = os.path.join(WWW, 'assets', 'equipment', cat, it['asset'])
        fit = {}
        for k in ('*',):
            fit.update(fits['categories'].get(cat, {}).get(k, {}))
        for st in stages:
            sid = st['id']
            if sid not in it.get('compatibleDragonStages', []):
                continue
            cand = [p for p in (glob.glob(base + f'_{sid}.*') + glob.glob(base + '.*')) if not p.endswith('_icon.webp')]
            if not cand:
                continue
            f = cand[0]
            w, h = size(f)
            rig = load(st['rig'])
            ds = next(b for b in rig['bones'] if b.get('part'))['scaleX']
            width_world = (fit.get('width') or 100) * rig['scale']   # largeur dans le repère du corps
            cam = rig['camera']
            name, cw, ch, dpr = SCREENS[0]
            res = {}
            for label, cap in (('before', CAP_BEFORE), ('after', CAP_AFTER)):
                rd = min(dpr, cap)
                s0 = min(cw * rd / cam['w'], ch * STAGE_FRACTION * rd / cam['h']) * 0.94
                phys = width_world * ds * s0 * dpr / rd
                res[label] = round(phys)
            eq_rows.append({'id': it['id'], 'category': cat, 'stage': sid, 'file': os.path.relpath(f, WWW), 'w': w, 'h': h,
                            'displayW': res, 'ratio': round(res['after'] / w, 3)})

    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, 'dragon-matrix.json'), 'w', encoding='utf-8') as f:
        json.dump({'screens': SCREENS, 'stageFraction': STAGE_FRACTION, 'dragons': rows, 'equipment': eq_rows}, f, ensure_ascii=False, indent=1)

    # ---------- Markdown ----------
    L = ['# Matrice des dragons', '',
         'Générée par `scripts/audit-dragons.py` à partir du dépôt (ne pas modifier à la main).', '',
         f'Variantes trouvées : {", ".join(variants)}. Stades trouvés : {", ".join(s["id"] for s in stages)}. '
         'Pas de distinction mâle/femelle en dehors de ces deux variantes (le dragon de l’enfant, la dragonne du parent).', '',
         '## Couverture des poses', '',
         '| Variante | Stade | NORMAL | SLEEP | WINGS_UP | WINGS_MID | WINGS_DOWN | Autres | Squelette (os / os souples / maille) | Ancrages | Équipements compatibles |',
         '|---|---|---|---|---|---|---|---|---|---|---|']
    for r in rows:
        cell = lambda k: f"{r['poses'][k]['w']}×{r['poses'][k]['h']}" if k in r['poses'] else '**manquant**'
        others = [k for k in r['poses'] if k not in POSE_LABEL]
        L.append(f"| {r['variant']} | {r['stage']} | {cell('full')} | {cell('sleep')} | {cell('flyUp')} | {cell('flyMid')} | {cell('flyDown')} | "
                 f"{', '.join(others) or '—'} | {r['rig'].split('/')[-1]} ({r['bones']} / {len(r['deformBones'])} / {r['grid']} px) | "
                 f"{len(r['anchors'])}/13{' — manque ' + ', '.join(r['missingAnchors']) if r['missingAnchors'] else ''} | {r['equipmentCompatible']} |")
    L += ['', 'Assets absents partout : WINGS_MID, yeux fermés, gueule ouverte, ailes séparées du corps (voir DRAGON_ASSET_REQUIREMENTS.md).', '',
          '## Résolution : source → affichage', '',
          'Taille de l’illustration sur l’écran Dragon (scène = 60 % de la hauteur), en pixels physiques. '
          '« Rapport » = pixels affichés / pixels de la source : < 1 = réduction (risque de scintillement sans mipmaps), > 1 = agrandissement (flou, résolution insuffisante). '
          'Les poses de vol sont mesurées à la taille de vol (×0,8). Avant = canvas plafonné à densité 2 puis agrandi par l’écran ; après = canvas à la densité réelle (max 3).', '']
    for name, cw, ch, dpr in SCREENS:
        L += [f'### {name}', '', '| Variante | Stade | Pose | Source (px) | Affiché avant (canvas → écran) | Affiché après | Rapport après | Diagnostic |', '|---|---|---|---|---|---|---|---|']
        for r in rows:
            for k, p in r['poses'].items():
                d = next((x for x in p['display'] if x['screen'] == name), None)
                if not d:
                    continue
                b, a = d['before'], d['after']
                ratio = a['sourceToScreen']
                if ratio > 1.05:
                    diag = f'**agrandi ×{ratio:.2f} : résolution insuffisante, flou**'
                elif ratio < 0.55:
                    diag = 'forte réduction : mipmaps indispensables'
                elif ratio < 0.85:
                    diag = 'réduction : mipmaps recommandés'
                else:
                    diag = 'proche du 1:1'
                L.append(f"| {r['variant']} | {r['stage']} | {POSE_LABEL.get(k, k)} | {p['w']}×{p['h']} | {b['canvasW']} → {b['physicalW']} (×{b['canvasToScreen']}) | {a['physicalW']} | {ratio:.2f} | {diag} |")
        L.append('')
    L += ['## Équipements (écran de référence 1)', '', '| Objet | Catégorie | Stade | Source | Affiché après | Rapport |', '|---|---|---|---|---|---|']
    for e in eq_rows:
        L.append(f"| {e['id']} | {e['category']} | {e['stage']} | {e['w']}×{e['h']} | {e['displayW']['after']} | {e['ratio']:.2f} |")
    with open(os.path.join(OUT, 'DRAGON_MATRIX.md'), 'w', encoding='utf-8') as f:
        f.write('\n'.join(L) + '\n')
    print(f'{len(rows)} combinaisons variante × stade, {len(eq_rows)} lignes d’équipement')


if __name__ == '__main__':
    main()

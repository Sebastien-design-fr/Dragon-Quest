"""
Importe les illustrations du dragon (art/dragons/<stade>.png, fond transparent, tête à droite)
dans le jeu :
  - découpe au plus près + conversion WebP -> www/assets/dragon/<stade>/dragon_<stade>_full.webp
  - génère le squelette « image entière » -> www/data/rigs/<stade>.sprite.json

Les points d'ancrage des équipements sont donnés ci-dessous en pixels de l'image source
(1254 x 1254). Pour une nouvelle illustration : remplacer le PNG, ajuster les points si la
pose a changé, puis relancer :  python3 scripts/import-dragons.py
"""
import json
import math
import os

from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..')
SRC = os.path.join(ROOT, 'art', 'dragons')
ASSETS = os.path.join(ROOT, 'www', 'assets', 'dragon')
RIGS = os.path.join(ROOT, 'www', 'data', 'rigs')

# feet       : point au sol, sous le centre du corps (pivot des animations)
# drawScale  : taille du dragon à l'écran (croissance d'un stade à l'autre)
# equipScale : taille des équipements (proportionnelle à la tête dans l'image)
# anchors    : nom -> (x, y, rotation en degrés)
STAGES = {
    'baby': {
        'feet': (820, 1045), 'drawScale': 0.62, 'equipScale': 3.3,
        'anchors': {
            'head_anchor': (1050, 425, 0), 'mouth_anchor': (1238, 548, 0), 'neck_anchor': (985, 640, 0),
            'chest_anchor': (1035, 770, 0), 'front_leg_anchor': (1115, 960, 0), 'rear_leg_anchor': (620, 965, 0),
            'front_leg_far_anchor': (935, 985, 0), 'rear_leg_far_anchor': (800, 990, 0),
            'left_wing_anchor': (780, 590, -10), 'right_wing_anchor': (560, 472, -13),
            'tail_anchor': (310, 935, 0), 'tail_tip_anchor': (235, 738, 0), 'body_center': (830, 820, 0),
        },
    },
    'young': {
        'feet': (810, 1100), 'drawScale': 0.82, 'equipScale': 2.5,
        'anchors': {
            'head_anchor': (1065, 372, 0), 'mouth_anchor': (1238, 482, 0), 'neck_anchor': (1015, 605, 0),
            'chest_anchor': (1065, 765, 0), 'front_leg_anchor': (1110, 1000, 0), 'rear_leg_anchor': (560, 1010, 0),
            'front_leg_far_anchor': (930, 1020, 0), 'rear_leg_far_anchor': (760, 1020, 0),
            'left_wing_anchor': (800, 560, -10), 'right_wing_anchor': (455, 292, -6),
            'tail_anchor': (330, 960, 0), 'tail_tip_anchor': (265, 732, 0), 'body_center': (810, 830, 0),
        },
    },
    'adult': {
        'feet': (840, 1095), 'drawScale': 1.0, 'equipScale': 2.2,
        'anchors': {
            'head_anchor': (1082, 362, 0), 'mouth_anchor': (1228, 488, 0), 'neck_anchor': (1030, 565, 0),
            'chest_anchor': (1072, 725, 0), 'front_leg_anchor': (1150, 1000, 0), 'rear_leg_anchor': (540, 1000, 0),
            'front_leg_far_anchor': (950, 1010, 0), 'rear_leg_far_anchor': (760, 1010, 0),
            'left_wing_anchor': (800, 470, -10), 'right_wing_anchor': (480, 172, -8),
            'tail_anchor': (320, 975, 0), 'tail_tip_anchor': (205, 745, 0), 'body_center': (840, 790, 0),
        },
    },
    'legendary': {
        'feet': (850, 1115), 'drawScale': 1.06, 'equipScale': 2.3,
        'anchors': {
            'head_anchor': (1092, 335, 0), 'mouth_anchor': (1242, 492, 0), 'neck_anchor': (1030, 565, 0),
            'chest_anchor': (1082, 725, 0), 'front_leg_anchor': (1150, 1020, 0), 'rear_leg_anchor': (540, 1030, 0),
            'front_leg_far_anchor': (960, 1040, 0), 'rear_leg_far_anchor': (770, 1040, 0),
            'left_wing_anchor': (810, 470, -10), 'right_wing_anchor': (440, 162, -8),
            'tail_anchor': (320, 990, 0), 'tail_tip_anchor': (235, 745, 0), 'body_center': (850, 790, 0),
        },
    },
}

# Profondeur de dessin des équipements par ancrage (le dragon est à 20, l'aile lointaine fait partie de l'image).
Z = {
    'head_anchor': 34, 'mouth_anchor': 35, 'neck_anchor': 30, 'chest_anchor': 28, 'front_leg_anchor': 42,
    'rear_leg_anchor': 42, 'front_leg_far_anchor': 22, 'rear_leg_far_anchor': 22, 'left_wing_anchor': 22,
    'right_wing_anchor': 38, 'tail_anchor': 26, 'tail_tip_anchor': 26, 'body_center': 0,
}

PALETTE = {
    'base': '#141318', 'mid': '#211f27', 'edge': '#3a3541', 'belly': '#3d3227', 'bellyLine': '#6b5434',
    'membrane': '#18161c', 'membraneEdge': '#2e2a33', 'horn': '#1c1a1f', 'hornTip': '#6a5e50',
    'claw': '#b9ad99', 'eye': '#f2a33a', 'eyeGlow': '#ffb84a', 'gold': '#e8b64c',
}


def r(v):
    return round(v, 1)


def build(stage, cfg):
    img = Image.open(os.path.join(SRC, stage + '.png')).convert('RGBA')
    alpha = img.getchannel('A')
    x0, y0, x1, y1 = alpha.point(lambda a: 255 if a > 8 else 0).getbbox()
    m = 6
    x0, y0, x1, y1 = max(0, x0 - m), max(0, y0 - m), min(img.width, x1 + m), min(img.height, y1 + m)
    crop = img.crop((x0, y0, x1, y1))
    out_dir = os.path.join(ASSETS, stage)
    os.makedirs(out_dir, exist_ok=True)
    path = os.path.join(out_dir, f'dragon_{stage}_full.webp')
    crop.save(path, 'WEBP', quality=86, method=6)

    w, h = crop.size
    fx, fy = cfg['feet']
    ds = cfg['drawScale']
    pivot = [round((fx - x0) / w, 4), round((fy - y0) / h, 4)]

    anchors = []
    for name, (ax, ay, rot) in cfg['anchors'].items():
        anchors.append({'name': name, 'bone': 'body', 'x': r(ax - fx), 'y': r(ay - fy), 'rotation': rot, 'z': Z[name]})

    bounds = {'x': r((x0 - fx) * ds), 'y': r((y0 - fy) * ds), 'w': r(w * ds), 'h': r(h * ds)}
    rig = {
        'id': stage,
        'version': 2,
        'kind': 'sprite',
        'note': 'Généré par scripts/import-dragons.py — illustration entière, ancrages en pixels de l’image.',
        'scale': cfg['equipScale'],
        'motionScale': round(2.6 * ds, 3),
        'fxScale': round(cfg['equipScale'] * ds, 3),
        'params': {'horn': 1, 'spikes': 1, 'gold': 1 if stage == 'legendary' else 0},
        'palette': PALETTE,
        'bounds': bounds,
        'bones': [
            {'name': 'root', 'parent': None, 'x': 0, 'y': 0, 'rotation': 0, 'scaleX': 1, 'scaleY': 1, 'length': 0, 'part': None},
            {'name': 'body', 'parent': 'root', 'x': 0, 'y': 0, 'rotation': 0, 'scaleX': ds, 'scaleY': ds, 'length': 0,
             'part': {'key': 'full', 'shape': 'sprite', 'w': w, 'h': h, 'pivot': pivot, 'z': 20}},
        ],
        'anchors': anchors,
    }
    return rig, os.path.getsize(path)


def main():
    rigs = {}
    for stage, cfg in STAGES.items():
        rig, size = build(stage, cfg)
        rigs[stage] = rig
        print(f'{stage}: {rig["bones"][1]["part"]["w"]}x{rig["bones"][1]["part"]["h"]}  {size // 1024} Ko')
    # Cadrage : chaque stade un peu plus large que lui-même, en direction du légendaire,
    # avec de la place à droite pour le souffle de feu.
    L = rigs['legendary']['bounds']
    for rig in rigs.values():
        b = rig['bounds']
        k = 0.35
        cam = {key: b[key] + (L[key] - b[key]) * k for key in ('x', 'y', 'w', 'h')}
        pad = 0.06 * cam['w']
        cam['x'] -= pad * 0.5
        cam['w'] += pad * 2.2
        cam['y'] -= pad * 0.6
        cam['h'] += pad * 0.9
        rig['camera'] = {k2: r(v) for k2, v in cam.items()}
        with open(os.path.join(RIGS, rig['id'] + '.sprite.json'), 'w', encoding='utf-8') as f:
            json.dump(rig, f, ensure_ascii=False, indent=2)


if __name__ == '__main__':
    main()

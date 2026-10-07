"""
Dragonne (le dragon de la maman) : art/dragonne/<stade>.png -> www/assets/dragonne/<stade>/dragonne_<stade>_full.webp
et son squelette www/data/rigs/<stade>.dragonne.json (mêmes os et ancrages que le dragon : mêmes animations,
mêmes équipements, mêmes sons).   python3 scripts/import-dragonne.py
"""
import importlib.util
import json
import os

from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..')
spec = importlib.util.spec_from_file_location('imp', os.path.join(ROOT, 'scripts', 'import-dragons.py'))
imp = importlib.util.module_from_spec(spec)
spec.loader.exec_module(imp)
chain, r = imp.chain, imp.r


def anchors(head, mouth, neck, chest, fl, rl, flf, rlf, lwing, rwing, tail, tip, center):
    return {'head_anchor': (*head, 0), 'mouth_anchor': (*mouth, 0), 'neck_anchor': (*neck, 0), 'chest_anchor': (*chest, 0),
            'front_leg_anchor': (*fl, 0), 'rear_leg_anchor': (*rl, 0), 'front_leg_far_anchor': (*flf, 0), 'rear_leg_far_anchor': (*rlf, 0),
            'left_wing_anchor': (*lwing, -10), 'right_wing_anchor': (*rwing, -8), 'tail_anchor': (*tail, 0), 'tail_tip_anchor': (*tip, 0),
            'body_center': (*center, 0)}


def deform(spine, neck, head, w1, w2, tail, fl, flf, rl, rlf):
    return {
        'spine': ('body', *spine, 220),
        **chain('neck', 'body', neck, 95),
        'head': ('neck2', *head, 150),
        'wing1': ('body', *w1, 150),
        'wing2': ('wing1', *w2, 330),
        'wingFar': ('body', (w1[0][0] + 30, w1[0][1]), (w1[0][0] + 70, w1[0][1] - 80), 50),
        **chain('tail', 'body', tail, 105),
        'legFront': ('ground', *fl, 95),
        'legFrontFar': ('ground', *flf, 80),
        'legRear': ('ground', *rl, 95),
        'legRearFar': ('ground', *rlf, 80),
    }


# Coordonnées en pixels des images (1536 x 1024). drawScale : taille à l'écran (même progression que le dragon).
STAGES = {
    'baby': {
        'feet': (1080, 975), 'drawScale': 0.47, 'equipScale': 3.3 * 0.62 / 0.47 * 0.95,
        'anchors': anchors((1390, 250), (1505, 300), (1320, 470), (1320, 640), (1430, 880), (770, 890), (1240, 890), (980, 860),
                           (1000, 440), (640, 160), (700, 790), (110, 680), (1080, 640)),
        'deform': deform(((820, 680), (1250, 640)), [(1300, 620), (1320, 430), (1350, 300)], ((1350, 300), (1510, 300)),
                         ((980, 480), (1030, 270)), ((1030, 270), (220, 230)),
                         [(820, 650), (600, 760), (350, 850), (120, 860), (20, 760), (150, 640)],
                         ((1440, 930), (1370, 760)), ((1240, 930), (1200, 780)), ((760, 940), (770, 760)), ((980, 890), (960, 760)))
    },
    'young': {
        'feet': (1100, 985), 'drawScale': 0.62, 'equipScale': 2.5 * 0.82 / 0.62 * 0.95,
        'anchors': anchors((1400, 240), (1505, 290), (1330, 460), (1310, 650), (1460, 900), (850, 900), (1290, 900), (1060, 880),
                           (1010, 440), (650, 130), (700, 810), (110, 650), (1080, 650)),
        'deform': deform(((860, 690), (1260, 640)), [(1300, 640), (1330, 440), (1360, 300)], ((1360, 300), (1510, 290)),
                         ((1000, 480), (1060, 290)), ((1060, 290), (220, 230)),
                         [(880, 690), (650, 800), (400, 880), (150, 880), (30, 760), (160, 600)],
                         ((1470, 975), (1400, 790)), ((1290, 960), (1250, 800)), ((840, 975), (850, 790)), ((1060, 930), (1040, 800)))
    },
    'adult': {
        'feet': (1100, 990), 'drawScale': 0.76, 'equipScale': 2.2 * 1.0 / 0.76 * 0.95,
        'anchors': anchors((1400, 230), (1510, 290), (1320, 450), (1300, 640), (1440, 900), (870, 900), (1270, 900), (1050, 880),
                           (1030, 420), (700, 120), (700, 820), (120, 640), (1050, 650)),
        'deform': deform(((850, 680), (1260, 630)), [(1300, 620), (1330, 420), (1360, 290)], ((1360, 290), (1515, 290)),
                         ((1000, 470), (1090, 290)), ((1090, 290), (250, 250)),
                         [(900, 700), (650, 820), (400, 900), (150, 880), (30, 760), (150, 620)],
                         ((1460, 970), (1380, 800)), ((1300, 960), (1250, 800)), ((870, 970), (870, 780)), ((1060, 950), (1030, 820)))
    },
    'legendary': {
        'feet': (1110, 990), 'drawScale': 0.81, 'equipScale': 2.3 * 1.06 / 0.81 * 0.95,
        'anchors': anchors((1390, 250), (1505, 330), (1320, 470), (1300, 650), (1480, 900), (830, 900), (1330, 900), (1120, 880),
                           (1030, 430), (700, 110), (650, 830), (120, 600), (1060, 660)),
        'deform': deform(((840, 690), (1260, 640)), [(1290, 640), (1320, 440), (1350, 300)], ((1350, 300), (1510, 330)),
                         ((1000, 480), (1080, 280)), ((1080, 280), (230, 230)),
                         [(860, 720), (600, 810), (350, 880), (120, 850), (30, 720), (180, 560)],
                         ((1500, 980), (1420, 800)), ((1330, 970), (1280, 800)), ((820, 980), (830, 790)), ((1120, 960), (1090, 820)))
    },
}


def main():
    rigs = {}
    for stage, cfg in STAGES.items():
        img = Image.open(os.path.join(ROOT, 'art', 'dragonne', stage + '.png')).convert('RGBA')
        a = img.getchannel('A').point(lambda v: 255 if v > 30 else 0)
        x0, y0, x1, y1 = a.getbbox()
        crop = img.crop((x0, y0, x1, y1))
        out = os.path.join(ROOT, 'www', 'assets', 'dragonne', stage)
        os.makedirs(out, exist_ok=True)
        crop.save(os.path.join(out, f'dragonne_{stage}_full.webp'), 'WEBP', quality=86, method=6)
        w, h = crop.size
        fx, fy = cfg['feet']
        ds = cfg['drawScale']
        imp.DEFORM[stage] = cfg['deform']
        rig = {
            'id': stage, 'version': 2, 'kind': 'sprite',
            'note': 'Généré par scripts/import-dragonne.py',
            'scale': round(cfg['equipScale'], 3), 'motionScale': round(2.6 * ds, 3), 'fxScale': round(cfg['equipScale'] * ds, 3),
            'params': {'horn': 1, 'spikes': 1, 'gold': 1 if stage == 'legendary' else 0}, 'palette': imp.PALETTE,
            'bounds': {'x': r((x0 - fx) * ds), 'y': r((y0 - fy) * ds), 'w': r(w * ds), 'h': r(h * ds)},
            'bones': [
                {'name': 'root', 'parent': None, 'x': 0, 'y': 0, 'rotation': 0, 'scaleX': 1, 'scaleY': 1, 'length': 0, 'part': None},
                {'name': 'body', 'parent': 'root', 'x': 0, 'y': 0, 'rotation': 0, 'scaleX': ds, 'scaleY': ds, 'length': 0,
                 'part': {'key': 'full', 'shape': 'sprite', 'w': w, 'h': h, 'pivot': [round((fx - x0) / w, 4), round((fy - y0) / h, 4)], 'z': 20}},
                {'name': 'ground', 'parent': 'root', 'x': 0, 'y': 0, 'rotation': 0, 'scaleX': ds, 'scaleY': ds, 'length': 0, 'part': None},
                *imp.deform_bones(stage, fx, fy, ds),
            ],
            'skin': {'grid': 30},
            'anchors': [{'name': n, 'bone': 'body', 'x': r(ax - fx), 'y': r(ay - fy), 'rotation': rot, 'z': imp.Z[n]} for n, (ax, ay, rot) in cfg['anchors'].items()],
        }
        rigs[stage] = rig
        print(stage, w, h)
    L = rigs['legendary']['bounds']
    for rig in rigs.values():
        b = rig['bounds']
        cam = {k: b[k] + (L[k] - b[k]) * 0.35 for k in ('x', 'y', 'w', 'h')}
        pad = 0.06 * cam['w']
        cam['x'] -= pad * 0.5; cam['w'] += pad * 2.2; cam['y'] -= pad * 0.6; cam['h'] += pad * 0.9
        rig['camera'] = {k: r(v) for k, v in cam.items()}
        with open(os.path.join(ROOT, 'www', 'data', 'rigs', rig['id'] + '.dragonne.json'), 'w', encoding='utf-8') as f:
            json.dump(rig, f, ensure_ascii=False, indent=2)


if __name__ == '__main__':
    main()

"""
Squelettes des poses peintes (couché, ailes hautes, ailes basses) : www/data/rigs/<stade>.<variante>.<pose>.json
+ www/data/poses.json.   python3 scripts/build-pose-rigs.py [apercu.png]

Les points (ancrages d'équipement, os souples) sont donnés en % de l'image découpée (x vers la droite,
y vers le bas), réglés sur l'adulte et valables pour les autres stades (même composition).
Taille : la pose est mise à l'échelle du dragon debout ; « ailes basses » est recalée sur « ailes hautes »
(même tête au même endroit) pour que les battements ne fassent pas sauter le dragon.
"""
import json
import math
import os
import sys

import numpy as np
from PIL import Image, ImageDraw

ROOT = os.path.join(os.path.dirname(__file__), '..')
STAGES = ['baby', 'young', 'adult', 'legendary']
VARIANTS = {'dragon': 'sprite', 'dragonne': 'dragonne'}
Z = {
    'head_anchor': 34, 'mouth_anchor': 35, 'neck_anchor': 30, 'chest_anchor': 28, 'front_leg_anchor': 42,
    'rear_leg_anchor': 42, 'front_leg_far_anchor': 22, 'rear_leg_far_anchor': 22, 'left_wing_anchor': 22,
    'right_wing_anchor': 38, 'tail_anchor': 26, 'tail_tip_anchor': 26, 'body_center': 0,
}

# ancrage : (x %, y %, rotation en degrés)
ANCHORS = {
    'sleep': {
        'dragon': {'head_anchor': (85, 42, 8), 'mouth_anchor': (98, 85, 8), 'neck_anchor': (74, 52, 10), 'chest_anchor': (68, 66, 0),
                   'front_leg_anchor': (80, 90, 0), 'rear_leg_anchor': (47, 88, 0), 'front_leg_far_anchor': (90, 92, 0), 'rear_leg_far_anchor': (55, 90, 0),
                   'left_wing_anchor': (60, 15, -10), 'right_wing_anchor': (40, 12, -14), 'tail_anchor': (25, 76, 10), 'tail_tip_anchor': (5, 45, 0),
                   'body_center': (55, 62, 0)},
        'dragonne': {'head_anchor': (88, 50, 8), 'mouth_anchor': (99, 88, 8), 'neck_anchor': (78, 56, 10), 'chest_anchor': (71, 68, 0),
                     'front_leg_anchor': (82, 90, 0), 'rear_leg_anchor': (50, 88, 0), 'front_leg_far_anchor': (90, 92, 0), 'rear_leg_far_anchor': (58, 90, 0),
                     'left_wing_anchor': (62, 15, -10), 'right_wing_anchor': (40, 12, -14), 'tail_anchor': (22, 84, 6), 'tail_tip_anchor': (5, 55, 0),
                     'body_center': (57, 60, 0)},
    },
    'flyUp': {
        'dragon': {'head_anchor': (87, 46, 0), 'mouth_anchor': (99, 60, 0), 'neck_anchor': (78, 57, 0), 'chest_anchor': (72, 70, 0),
                   'front_leg_anchor': (68, 90, 0), 'rear_leg_anchor': (54, 90, 0), 'front_leg_far_anchor': (72, 92, 0), 'rear_leg_far_anchor': (58, 92, 0),
                   'left_wing_anchor': (80, 15, -10), 'right_wing_anchor': (40, 10, -8), 'tail_anchor': (25, 82, 0), 'tail_tip_anchor': (3, 50, 0),
                   'body_center': (55, 72, 0)},
        'dragonne': {'head_anchor': (88, 44, 0), 'mouth_anchor': (99, 58, 0), 'neck_anchor': (80, 55, 0), 'chest_anchor': (73, 68, 0),
                     'front_leg_anchor': (68, 92, 0), 'rear_leg_anchor': (55, 90, 0), 'front_leg_far_anchor': (72, 92, 0), 'rear_leg_far_anchor': (58, 92, 0),
                     'left_wing_anchor': (80, 15, -10), 'right_wing_anchor': (40, 12, -8), 'tail_anchor': (25, 85, 0), 'tail_tip_anchor': (4, 55, 0),
                     'body_center': (57, 72, 0)},
    },
    'flyDown': {
        'dragon': {'head_anchor': (88, 24, 0), 'mouth_anchor': (99, 40, 0), 'neck_anchor': (78, 32, 0), 'chest_anchor': (70, 42, 0),
                   'front_leg_anchor': (56, 50, 0), 'rear_leg_anchor': (44, 48, 0), 'front_leg_far_anchor': (60, 50, 0), 'rear_leg_far_anchor': (48, 48, 0),
                   'left_wing_anchor': (72, 45, -10), 'right_wing_anchor': (60, 50, -5), 'tail_anchor': (25, 40, 0), 'tail_tip_anchor': (5, 10, 0),
                   'body_center': (52, 38, 0)},
        'dragonne': {'head_anchor': (88, 30, 0), 'mouth_anchor': (99, 45, 0), 'neck_anchor': (78, 38, 0), 'chest_anchor': (70, 48, 0),
                     'front_leg_anchor': (55, 55, 0), 'rear_leg_anchor': (42, 52, 0), 'front_leg_far_anchor': (60, 55, 0), 'rear_leg_far_anchor': (46, 52, 0),
                     'left_wing_anchor': (72, 48, -10), 'right_wing_anchor': (62, 54, -5), 'tail_anchor': (25, 45, 0), 'tail_tip_anchor': (5, 8, 0),
                     'body_center': (52, 42, 0)},
    },
}
# Retouches par image : (pose, variante, stade) -> {ancrage: (x, y, rot)}
OVERRIDES = {}

# Os souples : spine (2 points), cou (3), tête (2), queue (6) — en %.
DEFORM = {
    'sleep': {'spine': [(45, 65), (72, 58)], 'neck': [(72, 58), (78, 50), (84, 45)], 'head': [(84, 45), (99, 75)],
              'tail': [(40, 85), (28, 85), (15, 80), (6, 65), (4, 45), (10, 32)]},
    'flyUp': {'spine': [(50, 72), (75, 62)], 'neck': [(75, 60), (81, 52), (86, 48)], 'head': [(86, 48), (99, 60)],
              'tail': [(50, 80), (38, 85), (22, 85), (8, 75), (3, 60), (8, 48)]},
    'flyDown': {'spine': [(45, 38), (72, 35)], 'neck': [(72, 34), (80, 30), (86, 26)], 'head': [(86, 26), (99, 40)],
                'tail': [(45, 40), (32, 42), (18, 40), (6, 30), (4, 15), (12, 5)]},
}

# Taille de la pose par rapport à la largeur du dragon debout.
WIDTH_RATIO = {'sleep': 1.03, 'flyUp': 1.15}


def r(v):
    return round(float(v), 1)


def alpha(path):
    return np.array(Image.open(path).getchannel('A')) > 128


def head_box(a, frac=0.24):
    ys, xs = np.nonzero(a)
    x1 = xs.max()
    return a[:, int(x1 - frac * a.shape[1]):x1 + 1]


def register(up, down):
    """Échelle et décalage qui posent la tête de « ailes basses » sur celle de « ailes hautes » (flyUp px -> flyDown px)."""
    ys, xs = np.nonzero(up)
    nose_up = (xs.max(), ys[xs >= xs.max() - 3].mean())
    ys2, xs2 = np.nonzero(down)
    nose_dn = (xs2.max(), ys2[xs2 >= xs2.max() - 3].mean())
    # tête de flyUp : petite fenêtre autour du nez
    def sample(a, nose):
        win = int(0.24 * a.shape[1])
        x0 = max(0, int(nose[0]) - win)
        yy, xx = np.nonzero(a[:, x0:int(nose[0]) + 1])
        sel = np.random.default_rng(1).choice(len(xx), min(4000, len(xx)), replace=False)
        return xx[sel] + x0 - nose[0], yy[sel] - nose[1]
    ux, uy = sample(up, nose_up)
    vx, vy = sample(down, nose_dn)

    def inside(a, x, y):
        x, y = np.round(x).astype(int), np.round(y).astype(int)
        ok = (x >= 0) & (x < a.shape[1]) & (y >= 0) & (y < a.shape[0])
        return a[y[ok], x[ok]].sum() / len(x)
    best = (-1, 1, 0, 0)
    for s in (1.0,):  # même échelle dans les deux planches (la recherche d’échelle se trompe sur les crêtes)
        for dy in range(-25, 26, 2):
            for dx in range(-12, 13, 2):
                p1 = inside(down, nose_dn[0] + dx + ux * s, nose_dn[1] + dy + uy * s)
                # et dans l'autre sens : la tête de « ailes basses » retombe dans celle de « ailes hautes »
                p2 = inside(up, nose_up[0] + (vx - dx) / s, nose_up[1] + (vy - dy) / s)
                score = min(p1, p2)
                if score > best[0]:
                    best = (score, s, dx, dy)
    score, s, dx, dy = best
    return lambda x, y: (nose_dn[0] + dx + (x - nose_up[0]) * s, nose_dn[1] + dy + (y - nose_up[1]) * s), s, score


def chain(prefix, parent, pts, radius):
    out = {}
    for i in range(len(pts) - 1):
        out[f'{prefix}{i + 1}'] = (parent if i == 0 else f'{prefix}{i}', pts[i], pts[i + 1], radius)
    return out


def bones_from(segs, fx, fy):
    bones, absang, start = [], {'body': 0.0, 'ground': 0.0}, {'body': (fx, fy), 'ground': (fx, fy)}
    for name, (parent, a, b, radius) in segs.items():
        ang = math.degrees(math.atan2(b[1] - a[1], b[0] - a[0]))
        pa = absang[parent]
        px, py = start[parent]
        dx, dy = a[0] - px, a[1] - py
        c, s_ = math.cos(math.radians(-pa)), math.sin(math.radians(-pa))
        bones.append({'name': name, 'parent': parent, 'x': r(dx * c - dy * s_), 'y': r(dx * s_ + dy * c), 'rotation': r(ang - pa),
                      'scaleX': 1, 'scaleY': 1, 'length': r(math.hypot(b[0] - a[0], b[1] - a[1])), 'radius': r(radius), 'part': None})
        absang[name], start[name] = ang, a
    return bones


def main():
    poses_index = {}
    previews = []
    for variant, suffix in VARIANTS.items():
        poses_index[variant] = {}
        for stage in STAGES:
            stand = json.load(open(os.path.join(ROOT, 'www', 'data', 'rigs', f'{stage}.{suffix}.json')))
            sds = stand['bones'][1]['scaleX']
            sb = stand['bounds']
            # centre du corps debout, au-dessus des pieds (unités écran)
            bc = next(a for a in stand['anchors'] if a['name'] == 'body_center')
            center_h = -bc['y'] * sds
            paths = {p: os.path.join(ROOT, 'www', 'assets', variant, stage, f'{variant}_{stage}_{p}.webp') for p in ('sleep', 'flyUp', 'flyDown')}
            if not all(os.path.exists(p) for p in paths.values()):
                continue
            sizes = {p: Image.open(paths[p]).size for p in paths}
            ds, feet = {}, {}
            for p in ('sleep', 'flyUp'):
                w, h = sizes[p]
                ds[p] = sb['w'] * WIDTH_RATIO[p] / w
                cx, cy = ANCHORS[p][variant]['body_center'][:2]
                if p == 'sleep':
                    feet[p] = (cx / 100 * w, h * 0.97)
                else:
                    feet[p] = (cx / 100 * w, cy / 100 * h + center_h / ds[p])
            up, down = alpha(paths['flyUp']), alpha(paths['flyDown'])
            T, s, score = register(up, down)
            ds['flyDown'] = ds['flyUp'] / s
            feet['flyDown'] = T(*feet['flyUp'])
            print(variant, stage, 'ds', {k: round(v, 3) for k, v in ds.items()}, 'recalage', round(s, 3), round(score, 3))
            for pose in ('sleep', 'flyUp', 'flyDown'):
                w, h = sizes[pose]
                fx, fy = feet[pose]
                d = ds[pose]
                P = lambda q: (q[0] / 100 * w, q[1] / 100 * h)
                anchors = {**ANCHORS[pose][variant], **OVERRIDES.get((pose, variant, stage), {})}
                df = DEFORM[pose]
                rad = lambda k: k * w
                segs = {'spine': ('body', P(df['spine'][0]), P(df['spine'][1]), rad(0.15)),
                        **chain('neck', 'body', [P(q) for q in df['neck']], rad(0.06)),
                        'head': ('neck2', P(df['head'][0]), P(df['head'][1]), rad(0.09)),
                        **chain('tail', 'body', [P(q) for q in df['tail']], rad(0.055))}
                rig = {
                    'id': stage, 'version': 2, 'kind': 'sprite', 'pose': pose,
                    'note': 'Généré par scripts/build-pose-rigs.py',
                    'scale': round(stand['scale'] * sds / d, 3), 'motionScale': stand['motionScale'], 'fxScale': stand['fxScale'],
                    'params': stand['params'], 'palette': stand['palette'],
                    'bounds': {'x': r(-fx * d), 'y': r(-fy * d), 'w': r(w * d), 'h': r(h * d)},
                    'camera': stand.get('camera'),
                    'bones': [
                        {'name': 'root', 'parent': None, 'x': 0, 'y': 0, 'rotation': 0, 'scaleX': 1, 'scaleY': 1, 'length': 0, 'part': None},
                        {'name': 'body', 'parent': 'root', 'x': 0, 'y': 0, 'rotation': 0, 'scaleX': round(d, 4), 'scaleY': round(d, 4), 'length': 0,
                         'part': {'key': pose, 'shape': 'sprite', 'w': w, 'h': h, 'pivot': [round(fx / w, 4), round(fy / h, 4)], 'z': 20}},
                        {'name': 'ground', 'parent': 'root', 'x': 0, 'y': 0, 'rotation': 0, 'scaleX': round(d, 4), 'scaleY': round(d, 4), 'length': 0, 'part': None},
                        *bones_from(segs, fx, fy),
                    ],
                    'skin': {'grid': 26},
                    'anchors': [{'name': n, 'bone': 'body', 'x': r(P(v)[0] - fx), 'y': r(P(v)[1] - fy), 'rotation': v[2], 'z': Z[n]} for n, v in anchors.items()],
                }
                with open(os.path.join(ROOT, 'www', 'data', 'rigs', f'{stage}.{variant}.{pose}.json'), 'w', encoding='utf-8') as f:
                    json.dump(rig, f, ensure_ascii=False, indent=1)
                if len(sys.argv) > 1:
                    im = Image.open(paths[pose]).convert('RGBA')
                    bg = Image.new('RGBA', im.size, (60, 70, 90, 255)); bg.alpha_composite(im)
                    dr = ImageDraw.Draw(bg)
                    for n, v in anchors.items():
                        x, y = P(v)
                        dr.ellipse([x - 5, y - 5, x + 5, y + 5], fill=(0, 255, 120) if 'head' in n or 'neck' in n or 'chest' in n else (255, 220, 0))
                        L = 25; a = math.radians(v[2])
                        dr.line([(x, y), (x + L * math.cos(a), y + L * math.sin(a))], fill=(255, 0, 0), width=2)
                    for name, (_, a0, b0, _) in segs.items():
                        dr.line([a0, b0], fill=(0, 200, 255), width=2)
                    dr.ellipse([fx - 6, fy - 6, fx + 6, fy + 6], outline=(255, 255, 255), width=2)
                    previews.append(bg)
            poses_index[variant][stage] = ['sleep', 'flyUp', 'flyDown']
    with open(os.path.join(ROOT, 'www', 'data', 'poses.json'), 'w', encoding='utf-8') as f:
        json.dump({'note': 'Poses peintes disponibles (variante -> stade -> poses). Généré par scripts/build-pose-rigs.py', 'poses': poses_index}, f, ensure_ascii=False, indent=1)
    if len(sys.argv) > 1 and previews:
        B = Image.new('RGB', (3 * 520, 8 * 230), (30, 30, 40))
        for i, p in enumerate(previews):
            q = p.copy(); q.thumbnail((510, 220))
            B.paste(q, ((i % 3) * 520 + 5, (i // 3) * 230 + 5))
        B.save(sys.argv[1])


if __name__ == '__main__':
    main()

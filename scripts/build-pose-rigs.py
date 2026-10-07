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

# Poses « image seule » (une grande image par dragon, scripts/import-single-poses.py) : même composition
# pour tous les dragons (prompt commun), repères communs, en % de l'image découpée.
def _a(head, mouth, neck, chest, fl, rl, flf, rlf, lw, rw, tail, tip, center):
    return {'head_anchor': head, 'mouth_anchor': mouth, 'neck_anchor': neck, 'chest_anchor': chest, 'front_leg_anchor': fl,
            'rear_leg_anchor': rl, 'front_leg_far_anchor': flf, 'rear_leg_far_anchor': rlf, 'left_wing_anchor': lw,
            'right_wing_anchor': rw, 'tail_anchor': tail, 'tail_tip_anchor': tip, 'body_center': center}
ANCHORS_SINGLE = {
    'flyUp': _a((89, 62, 0), (98, 68, 0), (82, 70, 0), (77, 80, 0), (77, 95, 0), (55, 90, 0), (80, 96, 0), (58, 92, 0), (72, 40, -10), (55, 30, -8), (42, 80, 0), (5, 75, 0), (62, 82, 0)),
    'flyMid': _a((90, 48, 0), (98, 55, 0), (84, 60, 0), (78, 72, 0), (77, 95, 0), (55, 92, 0), (80, 96, 0), (58, 93, 0), (80, 30, -10), (60, 25, -8), (42, 75, 0), (5, 70, 0), (62, 72, 0)),
    'flyDown': _a((91, 18, 0), (98, 22, 0), (84, 28, 0), (78, 36, 0), (77, 52, 0), (52, 46, 0), (80, 52, 0), (55, 47, 0), (72, 48, -10), (62, 62, -5), (42, 36, 0), (5, 28, 0), (62, 38, 0)),
    'sleep': _a((92, 62, 8), (99, 80, 8), (82, 62, 10), (76, 72, 0), (88, 88, 0), (55, 82, 0), (93, 90, 0), (60, 85, 0), (62, 22, -10), (45, 20, -14), (30, 85, 6), (5, 60, 0), (58, 65, 0)),
}
DEFORM_SINGLE = {
    'flyUp': {'spine': [(50, 82), (78, 78)], 'neck': [(78, 76), (84, 70), (89, 64)], 'head': [(89, 64), (99, 68)],
              'tail': [(50, 85), (35, 82), (20, 82), (8, 78), (3, 68), (10, 64)]},
    'flyMid': {'spine': [(50, 75), (78, 70)], 'neck': [(78, 68), (84, 60), (89, 52)], 'head': [(89, 52), (99, 56)],
               'tail': [(50, 78), (35, 72), (20, 72), (8, 70), (3, 60), (10, 55)]},
    'flyDown': {'spine': [(50, 38), (78, 33)], 'neck': [(78, 32), (85, 24), (90, 18)], 'head': [(90, 18), (99, 22)],
                'tail': [(50, 38), (35, 38), (20, 32), (8, 26), (3, 20), (10, 15)]},
    'sleep': {'spine': [(45, 65), (76, 62)], 'neck': [(76, 62), (84, 60), (90, 62)], 'head': [(90, 62), (99, 80)],
              'tail': [(40, 85), (28, 82), (15, 78), (6, 68), (4, 55), (10, 48)]},
}

# Images seules : museau (S) et œil (E) relevés à la main, en % de l'image découpée.
# Ils servent à recaler les images de vol entre elles et à placer les repères de la tête, du cou et du poitrail.
HEADS = {
    ('dragon', 'baby', 'flyUp'): ((92.5, 71), (85, 63)), ('dragon', 'baby', 'flyDown'): ((92.5, 44), (86, 38)),
    ('dragon', 'baby', 'sleep'): ((95, 74), (91, 66)),
    ('dragon', 'young', 'flyUp'): ((96, 59), (89, 53)), ('dragon', 'young', 'flyDown'): ((94, 25), (89, 21)),
    ('dragon', 'young', 'sleep'): ((97.5, 59), (92.5, 51)),
    ('dragon', 'adult', 'flyUp'): ((99.5, 68), (95, 64)), ('dragon', 'adult', 'flyMid'): ((99, 56), (94.5, 51)),
    ('dragon', 'adult', 'flyDown'): ((99, 22), (95, 18)), ('dragon', 'adult', 'sleep'): ((99, 72), (92.5, 62)),
    ('dragon', 'legendary', 'flyUp'): ((95, 49), (91, 45)), ('dragon', 'legendary', 'flyDown'): ((92.5, 27), (88, 21.5)),
    ('dragon', 'legendary', 'sleep'): ((97, 68), (92.5, 59)),
}
# Repères de la tête exprimés depuis l'œil, en longueurs « œil → museau » (valables pour tous les stades)
HEAD_FRAME = {'head_anchor': (-1.18, -0.24), 'neck_anchor': (-2.6, 0.67), 'chest_anchor': (-3.6, 1.8)}

# Taille de la pose par rapport à la largeur du dragon debout.
WIDTH_RATIO = {'sleep': 1.03, 'flyUp': 1.15}
# Images seules : la taille est réglée sur la tête et le cou (cohérence avec le dragon debout), pas sur la largeur.
HEAD_RATIO_SINGLE = {'sleep': 0.8, 'flyUp': 0.74}


def head_points(key, w, h):
    S, E = HEADS[key]
    S = (S[0] / 100 * w, S[1] / 100 * h); E = (E[0] / 100 * w, E[1] / 100 * h)
    return S, E, math.hypot(S[0] - E[0], S[1] - E[1])


def r(v):
    return round(float(v), 1)


def alpha(path):
    return np.array(Image.open(path).getchannel('A')) > 128


def head_box(a, frac=0.24):
    ys, xs = np.nonzero(a)
    x1 = xs.max()
    return a[:, int(x1 - frac * a.shape[1]):x1 + 1]


def register(up, down, single=False):
    """Échelle et décalage qui posent la tête de « ailes basses » sur celle de « ailes hautes » (flyUp px -> flyDown px)."""
    ys, xs = np.nonzero(up)
    nose_up = (xs.max(), ys[xs >= xs.max() - 3].mean())
    ys2, xs2 = np.nonzero(down)
    nose_dn = (xs2.max(), ys2[xs2 >= xs2.max() - 3].mean())
    # tête de flyUp : petite fenêtre autour du nez
    def sample(a, nose):
        win = int((0.13 if single else 0.24) * a.shape[1])
        x0 = max(0, int(nose[0]) - win)
        if single:
            # image seule : uniquement la tête (au-dessus et un peu sous le museau), pas les ailes voisines
            y0, y1 = max(0, int(nose[1] - 0.13 * a.shape[1])), int(nose[1] + 0.04 * a.shape[1])
            yy, xx = np.nonzero(a[y0:y1, x0:int(nose[0]) + 1]); yy = yy + y0
        else:
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
    for s in (np.arange(0.8, 1.26, 0.02) if single else (1.0,)):  # même échelle dans les deux planches (la recherche d’échelle se trompe sur les crêtes)
        for dy in range(-40 if single else -25, 41 if single else 26, 3 if single else 2):
            for dx in range(-20 if single else -12, 21 if single else 13, 3 if single else 2):
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
    src_path = os.path.join(ROOT, 'www', 'data', 'pose-sources.json')
    sources = json.load(open(src_path)) if os.path.exists(src_path) else {}
    for variant, suffix in VARIANTS.items():
        poses_index[variant] = {}
        for stage in STAGES:
            stand = json.load(open(os.path.join(ROOT, 'www', 'data', 'rigs', f'{stage}.{suffix}.json')))
            sds = stand['bones'][1]['scaleX']
            sb = stand['bounds']
            # centre du corps debout, au-dessus des pieds (unités écran)
            bc = next(a for a in stand['anchors'] if a['name'] == 'body_center')
            center_h = -bc['y'] * sds
            src = sources.get(variant, {}).get(stage, {})
            single = lambda p: src.get(p) == 'single'
            all_poses = ('sleep', 'flyUp', 'flyMid', 'flyDown')
            paths = {p: os.path.join(ROOT, 'www', 'assets', variant, stage, f'{variant}_{stage}_{p}.webp') for p in all_poses}
            paths = {p: f for p, f in paths.items() if os.path.exists(f) and (p != 'flyMid' or single(p))}
            if not all(p in paths for p in ('sleep', 'flyUp', 'flyDown')):
                continue
            def anchors_for(p):
                if not single(p):
                    return ANCHORS[p][variant]
                a = dict(ANCHORS_SINGLE[p])
                key = (variant, stage, p)
                if key in HEADS:
                    w, h = Image.open(paths[p]).size
                    S, E, L = head_points(key, w, h)
                    pct = lambda x, y: (x / w * 100, y / h * 100)
                    for n, (kx, ky) in HEAD_FRAME.items():
                        a[n] = (*pct(E[0] + kx * L, E[1] + ky * L), a[n][2])
                    a['mouth_anchor'] = (*pct(S[0] - 0.3 * L, S[1] + 0.1 * L), a['mouth_anchor'][2])
                return a
            def deform_for(p):
                if not single(p):
                    return DEFORM[p]
                d = {k: list(v) for k, v in DEFORM_SINGLE[p].items()}
                key = (variant, stage, p)
                if key in HEADS:
                    w, h = Image.open(paths[p]).size
                    S, E, L = head_points(key, w, h)
                    pct = lambda x, y: (x / w * 100, y / h * 100)
                    a = anchors_for(p)
                    hb = pct(E[0] - 1.0 * L, E[1] + 0.2 * L)
                    d['head'] = [hb, pct(*S)]
                    d['neck'] = [a['chest_anchor'][:2], a['neck_anchor'][:2], hb]
                    d['spine'] = [d['spine'][0], a['chest_anchor'][:2]]
                return d
            sizes = {p: Image.open(paths[p]).size for p in paths}
            ds, feet = {}, {}
            for p in ('sleep', 'flyUp'):
                w, h = sizes[p]
                if single(p):
                    sa = {a['name']: (a['x'], a['y']) for a in stand['anchors']}
                    hd = lambda A, B: math.hypot(A[0] - B[0], A[1] - B[1])
                    d_stand = (hd(sa['head_anchor'], sa['neck_anchor']) + hd(sa['neck_anchor'], sa['chest_anchor'])) * sds
                    aa = {n: (v[0] / 100 * w, v[1] / 100 * h) for n, v in anchors_for(p).items()}
                    d_px = hd(aa['head_anchor'], aa['neck_anchor']) + hd(aa['neck_anchor'], aa['chest_anchor'])
                    by_head = HEAD_RATIO_SINGLE[p] * d_stand / d_px
                    by_width = sb['w'] * (0.95 if p == 'sleep' else 1.0) / w
                    # compromis : tête cohérente avec le dragon debout ET taille d'ensemble cohérente
                    ds[p] = math.sqrt(by_head * by_width)
                    # doit tenir dans le cadre de la scène (les poses très étalées sont réduites)
                    cam_w = stand['camera']['w'] * 0.96
                    if w * ds[p] > cam_w:
                        ds[p] = cam_w / w
                else:
                    ds[p] = sb['w'] * WIDTH_RATIO[p] / w
                cx, cy = anchors_for(p)['body_center'][:2]
                if single(p):
                    # image seule : centrée horizontalement sur la silhouette debout
                    mid_x = (sb['x'] + sb['w'] / 2) / ds[p]
                    fx = w / 2 - mid_x
                    feet[p] = (fx, h * 0.97) if p == 'sleep' else (fx, cy / 100 * h + center_h / ds[p])
                elif p == 'sleep':
                    feet[p] = (cx / 100 * w, h * 0.97)
                else:
                    feet[p] = (cx / 100 * w, cy / 100 * h + center_h / ds[p])
            up = alpha(paths['flyUp'])
            for other in [p for p in ('flyMid', 'flyDown') if p in paths]:
                ku, ko = (variant, stage, 'flyUp'), (variant, stage, other)
                if ku in HEADS and ko in HEADS:
                    wu, hu = sizes['flyUp']; wo, ho = sizes[other]
                    Su, Eu, Lu = head_points(ku, wu, hu); So, Eo, Lo = head_points(ko, wo, ho)
                    s_ = Lo / Lu
                    T = (lambda So, Su, s_: (lambda x, y: (So[0] + (x - Su[0]) * s_, So[1] + (y - Su[1]) * s_)))(So, Su, s_)
                    s, score = s_, 1.0
                else:
                    T, s, score = register(up, alpha(paths[other]), single(other) and single('flyUp'))
                ds[other] = ds['flyUp'] / s
                feet[other] = T(*feet['flyUp'])
                print(variant, stage, other, 'recalage', round(s, 3), round(score, 3))
            print(variant, stage, 'ds', {k: round(v, 3) for k, v in ds.items()})
            for pose in [p for p in all_poses if p in paths]:
                w, h = sizes[pose]
                fx, fy = feet[pose]
                d = ds[pose]
                P = lambda q: (q[0] / 100 * w, q[1] / 100 * h)
                anchors = {**anchors_for(pose), **OVERRIDES.get((pose, variant, stage), {})}
                df = deform_for(pose)
                rad = lambda k: k * w
                segs = {'spine': ('body', P(df['spine'][0]), P(df['spine'][1]), rad(0.15)),
                        **chain('neck', 'body', [P(q) for q in df['neck']], rad(0.06)),
                        'head': ('neck2', P(df['head'][0]), P(df['head'][1]), rad(0.09)),
                        **chain('tail', 'body', [P(q) for q in df['tail']], rad(0.055))}
                # taille des équipements : proportionnelle à la taille de la tête/du cou à l'écran (pose vs debout)
                eq_k = 1.0
                if single(pose):
                    sa = {a['name']: (a['x'], a['y']) for a in stand['anchors']}
                    dist = lambda A, B: math.hypot(A[0] - B[0], A[1] - B[1])
                    d_stand = (dist(sa['head_anchor'], sa['neck_anchor']) + dist(sa['neck_anchor'], sa['chest_anchor'])) * sds
                    pa = {n: P(v) for n, v in anchors.items()}
                    d_pose = (dist(pa['head_anchor'], pa['neck_anchor']) + dist(pa['neck_anchor'], pa['chest_anchor'])) * d
                    eq_k = d_pose / d_stand if d_stand else 1.0
                    print('   ', pose, 'équipements ×', round(eq_k, 2))
                rig = {
                    'id': stage, 'version': 2, 'kind': 'sprite', 'pose': pose,
                    'note': 'Généré par scripts/build-pose-rigs.py',
                    'scale': round(stand['scale'] * sds / d * eq_k, 3), 'motionScale': stand['motionScale'], 'fxScale': stand['fxScale'],
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
            poses_index[variant][stage] = [p for p in all_poses if p in paths]
    with open(os.path.join(ROOT, 'www', 'data', 'poses.json'), 'w', encoding='utf-8') as f:
        json.dump({'note': 'Poses peintes disponibles (variante -> stade -> poses). Généré par scripts/build-pose-rigs.py', 'poses': poses_index}, f, ensure_ascii=False, indent=1)
    if len(sys.argv) > 1 and previews:
        B = Image.new('RGB', (4 * 520, 8 * 230), (30, 30, 40))
        for i, p in enumerate(previews):
            q = p.copy(); q.thumbnail((510, 220))
            B.paste(q, ((i % 4) * 520 + 5, (i // 4) * 230 + 5))
        B.save(sys.argv[1])


if __name__ == '__main__':
    main()

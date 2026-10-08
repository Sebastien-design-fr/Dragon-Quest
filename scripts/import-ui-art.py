# Usage : python3 scripts/import-ui-art.py [modele isnet-general-use.onnx]
"""
Illustrations peintes de l'interface (refonte UX), fond gris uni, une image par fichier :
  art/ui/quest_<clé>.png        -> www/assets/icons/quests/<clé>.webp   (256 × 256, icônes des quêtes)
  art/ui/egg_<variante>.png     -> www/assets/egg/egg_<variante>.webp   (œuf intact, premier lancement)
  art/ui/egg_<variante>_cracked.png -> www/assets/egg/egg_<variante>_cracked.webp
Clés des quêtes : cat, books, read, bed, shower, trash, bag, kitchen, sport, car, plant, room, star.
Le fond gris uni est retiré (découpe ISNet en plus si le modèle est fourni). Relancer ensuite :
  node scripts/gen-manifest.mjs
"""
import glob
import importlib.util
import os
import re
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = os.path.join(os.path.dirname(__file__), '..')
KEYS = {'cat', 'books', 'read', 'bed', 'shower', 'trash', 'bag', 'kitchen', 'sport', 'car', 'plant', 'room', 'star'}


def cutout(im: Image.Image, sess) -> Image.Image:
    arr = np.array(im.convert('RGB')).astype(float)
    border = np.concatenate([arr[:8].reshape(-1, 3), arr[-8:].reshape(-1, 3), arr[:, :8].reshape(-1, 3), arr[:, -8:].reshape(-1, 3)])
    bgc = np.median(border, axis=0)
    dist = np.sqrt(((arr - bgc) ** 2).sum(-1))
    g = arr.mean(-1)
    sd = np.sqrt(np.maximum(0, ndimage.uniform_filter(g * g, 9) - ndimage.uniform_filter(g, 9) ** 2))
    flat = ndimage.binary_opening((dist < 14) & (sd < 2.5), iterations=2)
    # seul le fond relié aux bords est retiré
    lab, _ = ndimage.label(flat)
    edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    bg = np.isin(lab, list(edge))
    alpha = 1 - ndimage.gaussian_filter(bg.astype(float), 1.0)
    if sess is not None:
        spec = importlib.util.spec_from_file_location('ip', os.path.join(ROOT, 'scripts', 'import-poses.py'))
        ip = importlib.util.module_from_spec(spec); spec.loader.exec_module(ip)
        alpha = np.minimum(alpha, np.clip((ip.isnet(sess, im.convert('RGB')) / 255 - 0.04) * 1.6, 0, 1))
    a3 = np.maximum(alpha, 0.25)[..., None]
    rgb = np.where(alpha[..., None] > 0.97, arr, np.clip((arr - (1 - a3) * bgc) / a3, 0, 255))
    alpha[alpha < 0.03] = 0
    out = np.dstack([rgb, alpha * 255]).astype(np.uint8)
    ys, xs = np.nonzero(alpha > 0.05)
    if len(xs):
        out = out[max(0, ys.min() - 4):ys.max() + 5, max(0, xs.min() - 4):xs.max() + 5]
    return Image.fromarray(out, 'RGBA')


def fit_square(im: Image.Image, size: int) -> Image.Image:
    w, h = im.size
    s = max(w, h)
    canvas = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    canvas.paste(im, ((s - w) // 2, (s - h) // 2))
    return canvas.resize((size, size), Image.LANCZOS)


def main():
    sess = None
    if len(sys.argv) > 1:
        import onnxruntime as ort
        sess = ort.InferenceSession(sys.argv[1], providers=['CPUExecutionProvider'])
    files = sorted(glob.glob(os.path.join(ROOT, 'art', 'ui', '*.png')))
    if not files:
        print('aucune image dans art/ui/'); return
    for f in files:
        name = os.path.basename(f)[:-4]
        im = Image.open(f)
        m = re.match(r'quest_(\w+)$', name)
        if m and m.group(1) in KEYS:
            out = os.path.join(ROOT, 'www', 'assets', 'icons', 'quests', f'{m.group(1)}.webp')
            os.makedirs(os.path.dirname(out), exist_ok=True)
            fit_square(cutout(im, sess), 256).save(out, 'WEBP', quality=90, method=6)
            print('icône', m.group(1), '->', os.path.relpath(out, ROOT)); continue
        m = re.match(r'egg_(\w+?)(_cracked)?$', name)
        if m:
            out = os.path.join(ROOT, 'www', 'assets', 'egg', f'{name}.webp')
            os.makedirs(os.path.dirname(out), exist_ok=True)
            img = cutout(im, sess)
            k = min(1, 768 / max(img.size))
            img.resize((round(img.size[0] * k), round(img.size[1] * k)), Image.LANCZOS).save(out, 'WEBP', quality=90, method=6)
            print('œuf', name, '->', os.path.relpath(out, ROOT)); continue
        print('ignoré :', name)


if __name__ == '__main__':
    main()

# Usage : python3 scripts/import-single-poses.py <modele isnet-general-use.onnx>
"""
Poses peintes en grand, une image par dragon (fond gris uni, tête à droite) :
art/poses-v2/<variante>_<stade>_{wings_up,wings_mid,wings_down,sleep}.png
-> www/assets/<variante>/<stade>/<variante>_<stade>_{flyUp,flyMid,flyDown,sleep}.webp
et www/data/pose-sources.json (ces poses utilisent les repères « image seule » de build-pose-rigs.py).
Remplace les poses découpées dans les anciennes planches pour les dragons concernés.
"""
import glob
import importlib.util
import json
import os
import re
import sys

import numpy as np
import onnxruntime as ort
from PIL import Image
from scipy import ndimage

ROOT = os.path.join(os.path.dirname(__file__), '..')
spec = importlib.util.spec_from_file_location('ip', os.path.join(ROOT, 'scripts', 'import-poses.py'))
ip = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ip)

KEY = {'wings_up': 'flyUp', 'wings_mid': 'flyMid', 'wings_down': 'flyDown', 'sleep': 'sleep'}


def main():
    sess = ort.InferenceSession(sys.argv[1], providers=['CPUExecutionProvider'])
    src_path = os.path.join(ROOT, 'www', 'data', 'pose-sources.json')
    sources = json.load(open(src_path)) if os.path.exists(src_path) else {}
    for f in sorted(glob.glob(os.path.join(ROOT, 'art', 'poses-v2', '*.png'))):
        m = re.match(r'(\w+?)_(baby|young|adult|legendary)_(wings_up|wings_mid|wings_down|sleep)\.png$', os.path.basename(f))
        if not m:
            print('ignoré :', f); continue
        variant, stage, pose = m.group(1), m.group(2), KEY[m.group(3)]
        im = Image.open(f).convert('RGB')
        arr = np.array(im).astype(float)
        full = ip.isnet(sess, im)
        # fond gris uni : tout pixel gris neutre proche de la couleur du fond est retiré (trous entre ailes et queue)
        bgc = np.median(arr[(full < 10)], axis=0) if (full < 10).any() else np.array([128, 128, 128])
        dist = np.sqrt(((arr - bgc) ** 2).sum(-1))
        sat = arr.max(-1) - arr.min(-1)
        g = arr.mean(-1)
        sd = np.sqrt(np.maximum(0, ndimage.uniform_filter(g * g, 9) - ndimage.uniform_filter(g, 9) ** 2))
        # vrai fond : gris neutre ET parfaitement uni (les membranes d'ailes sont texturées, elles restent)
        flat = ndimage.binary_opening((dist < 10) & (sat < 10) & (sd < 2.2), iterations=3)
        lab, n = ndimage.label(flat)
        if n:
            sizes = ndimage.sum(flat, lab, range(1, n + 1))
            flat = np.isin(lab, 1 + np.nonzero(sizes > 300)[0])
        alpha = np.clip((full / 255 - 0.04) * 1.6, 0, 1) * (1 - ndimage.gaussian_filter(flat.astype(float), 1.0))
        # bords : on retire la part de gris du fond mélangée aux pixels semi-transparents
        a3 = np.maximum(alpha, 0.25)[..., None]
        rgb = np.where(alpha[..., None] > 0.97, arr, np.clip((arr - (1 - a3) * bgc) / a3, 0, 255))
        alpha[alpha < 0.03] = 0
        # garder le dragon (plus gros morceau) et ce qui le touche
        big = ndimage.binary_dilation(alpha > 0.3, iterations=3)
        lab, n = ndimage.label(big)
        if n > 1:
            sizes = ndimage.sum(big, lab, range(1, n + 1))
            alpha = np.where(np.isin(lab, 1 + np.nonzero(sizes > sizes.max() * 0.03)[0]), alpha, 0)
        out = Image.fromarray(np.dstack([rgb, alpha * 255]).astype(np.uint8), 'RGBA')
        bb = Image.fromarray(((alpha > 0.05) * 255).astype(np.uint8)).getbbox()
        pad = 6
        out = out.crop((max(0, bb[0] - pad), max(0, bb[1] - pad), min(out.width, bb[2] + pad), min(out.height, bb[3] + pad)))
        d = os.path.join(ROOT, 'www', 'assets', variant, stage)
        os.makedirs(d, exist_ok=True)
        out.save(os.path.join(d, f'{variant}_{stage}_{pose}.webp'), 'WEBP', quality=92, method=6)
        sources.setdefault(variant, {}).setdefault(stage, {})[pose] = 'single'
        print(variant, stage, pose, out.size)
    with open(src_path, 'w', encoding='utf-8') as fh:
        json.dump(sources, fh, ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main()

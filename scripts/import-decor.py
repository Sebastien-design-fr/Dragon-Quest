# Usage : python3 scripts/import-decor.py <modele isnet-general-use.onnx> <racine du projet> <apercu.png>
# (modèle : https://github.com/danielgatis/rembg/releases — isnet-general-use.onnx)
"""Découpe des planches de décor (grille) + détourage par IA (ISNet), sortie www/assets/decor/<nom>.webp"""
import os, sys, numpy as np, onnxruntime as ort
from PIL import Image
from scipy import ndimage
ROOT = sys.argv[2]
sess = ort.InferenceSession(sys.argv[1], providers=['CPUExecutionProvider'])
inp = sess.get_inputs()[0].name
SHEETS = {
    'lights': (3, 2, ['torch', 'banner', 'lanterns', 'crystals', 'candelabra', 'brazier']),
    'floor': (3, 2, ['rug', 'nest', 'chest', 'gold', 'statue', 'basin']),
    'debris': (4, 2, ['bone', 'bones', 'rocks', 'scales', 'pot', 'straw', 'eggshell', 'rag']),
}
out = os.path.join(ROOT, 'www', 'assets', 'decor'); os.makedirs(out, exist_ok=True)
prev = []
for sheet, (cols, rows, names) in SHEETS.items():
    im = Image.open(os.path.join(ROOT, 'art', 'decor', sheet + '.png')).convert('RGB')
    W, H = im.size
    # Détourage de toute la planche, puis un objet = un groupe de pixels ; rangé dans la case de son centre.
    x = np.array(im.resize((1024, 1024), Image.BILINEAR)).astype(np.float32) / 255 - 0.5
    m = sess.run(None, {inp: x.transpose(2, 0, 1)[None]})[0][0, 0]
    m = (m - m.min()) / (m.max() - m.min() + 1e-9)
    full = np.array(Image.fromarray((m * 255).astype(np.uint8)).resize((W, H), Image.LANCZOS)).astype(float)
    full[full < 30] = 0
    lab, n = ndimage.label(ndimage.binary_dilation(full > 60, iterations=2))
    yy, xx = np.mgrid[0:H, 0:W]
    cellmap = (np.minimum(rows - 1, yy // (H / rows)) * cols + np.minimum(cols - 1, xx // (W / cols))).astype(int)
    owner = np.full((H, W), -1)
    for i in range(1, n + 1):
        sel_i = lab == i
        cnt = np.bincount(cellmap[sel_i], minlength=rows * cols)
        if cnt.sum() < 40: continue
        main = int(np.argmax(cnt))
        if cnt[main] >= 0.85 * cnt.sum(): owner[sel_i] = main      # objet qui déborde un peu : entier
        else: owner[sel_i] = cellmap[sel_i]                            # deux objets soudés : coupés par case
    for k, name in enumerate(names):
        sel = owner == k
        mask = np.where(sel, full, 0)
        rgba = im.copy(); rgba.putalpha(Image.fromarray(mask.astype(np.uint8)))
        bb = Image.fromarray((mask > 20).astype(np.uint8) * 255).getbbox()
        rgba = rgba.crop(bb)
        rgba.thumbnail((600, 600), Image.LANCZOS)
        rgba.save(os.path.join(out, name + '.webp'), 'WEBP', quality=86, method=6)
        prev.append(rgba)
        print(name, rgba.size)
B = Image.new('RGB', (200 * 10, 200 * 2), (30, 26, 34))
for i, p in enumerate(prev):
    q = p.copy(); q.thumbnail((190, 190)); B.paste(q, ((i % 10) * 200 + 5, (i // 10) * 200 + 5), q)
B.save(sys.argv[3])

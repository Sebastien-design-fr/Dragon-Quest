# Usage : python3 scripts/import-poses.py <modele isnet-general-use.onnx> [apercu.png]
# (modèle : https://github.com/danielgatis/rembg/releases — isnet-general-use.onnx)
"""
Poses peintes (ChatGPT) : art/poses/{sleep,flyUp,flyDown}.png, planches 2 colonnes (dragon, dragonne)
x 4 lignes (bébé, jeune, adulte, légendaire), tête à droite.
Sortie : www/assets/<variante>/<stade>/<variante>_<stade>_<pose>.webp
puis lancer scripts/build-pose-rigs.py pour les squelettes.
"""
import os
import sys

import numpy as np
import onnxruntime as ort
from PIL import Image
from scipy import ndimage

ROOT = os.path.join(os.path.dirname(__file__), '..')
POSES = ['sleep', 'flyUp', 'flyDown']
STAGES = ['baby', 'young', 'adult', 'legendary']
VARIANTS = ['dragon', 'dragonne']


# Retouches à la main (morceau d'une autre ligne), en pixels de la découpe automatique.
CLEAN = {
    ('flyDown', 'dragonne', 'legendary'): [[(395, 78), (405, 25), (490, -5), (532, 30), (526, 46), (492, 75), (440, 68)]],
}


def isnet(sess, im):
    inp = sess.get_inputs()[0].name
    W, H = im.size
    x = np.array(im.resize((1024, 1024), Image.BILINEAR)).astype(np.float32) / 255 - 0.5
    m = sess.run(None, {inp: x.transpose(2, 0, 1)[None]})[0][0, 0]
    m = (m - m.min()) / (m.max() - m.min() + 1e-9)
    return np.array(Image.fromarray((m * 255).astype(np.uint8)).resize((W, H), Image.LANCZOS)).astype(float)


def seam(m, y0, band):
    """Chemin de gauche à droite qui coupe le moins de dragon possible (pour séparer deux lignes qui se touchent)."""
    H, W = m.shape
    lo, hi = max(0, y0 - band), min(H, y0 + band)
    c = (m[lo:hi] / 255) ** 2 * 50 + 0.001
    R = hi - lo
    acc = c[:, 0].copy()
    back = np.zeros((R, W), int)
    for x in range(1, W):
        best, arg = acc.copy(), np.arange(R)
        for d in (-2, -1, 1, 2):
            sh = np.roll(acc, d)
            if d > 0: sh[:d] = np.inf
            else: sh[d:] = np.inf
            sh = sh + 0.02 * abs(d)
            better = sh < best
            best[better] = sh[better]
            arg[better] = (np.arange(R) - d)[better]
        acc = best + c[:, x]
        back[:, x] = arg
    path, r = np.zeros(W, int), int(np.argmin(acc))
    for x in range(W - 1, -1, -1):
        path[x] = r + lo
        r = back[r, x]
    return path


def holes(im, full):
    """Fond visible entre l'aile et la queue : zones lisses et proches de la couleur du fond, retirées du masque."""
    bgm = (full < 15).astype(float)
    bg = np.stack([ndimage.gaussian_filter(im[..., c] * bgm, 40) / (ndimage.gaussian_filter(bgm, 40) + 1e-6) for c in range(3)], -1)
    g = im.mean(-1)
    std = lambda w: np.sqrt(np.maximum(0, ndimage.uniform_filter(g * g, w) - ndimage.uniform_filter(g, w) ** 2))
    d = np.sqrt(((im - bg) ** 2).sum(-1))
    a = ndimage.binary_opening((d < 22) & (std(7) < 6) & (full > 15), iterations=2)
    b = ndimage.binary_opening((np.maximum(std(5), std(13) * 0.7) < 5) & (full > 15), iterations=3)
    keep = np.zeros_like(a)
    for cand, minsize in ((a, 600), (b, 1500)):
        lab, n = ndimage.label(cand)
        sizes = ndimage.sum(cand, lab, range(1, n + 1))
        keep |= np.isin(lab, 1 + np.nonzero(sizes > minsize)[0])
    keep = ndimage.binary_dilation(ndimage.binary_closing(keep, iterations=3), iterations=3)
    return full * (1 - ndimage.gaussian_filter(keep.astype(float), 2)), bg


def main():
    sess = ort.InferenceSession(sys.argv[1], providers=['CPUExecutionProvider'])
    previews = []
    for pose in POSES:
        im = Image.open(os.path.join(ROOT, 'art', 'poses', pose + '.png')).convert('RGB')
        arr = np.array(im).astype(float)
        H, W = arr.shape[:2]
        full, bg = holes(arr, isnet(sess, im))
        alpha = np.clip((full / 255 - 0.04) * 1.7, 0, 1)        # membranes translucides : plus opaques
        # voile de fond resté semi-opaque (dans la boucle de la queue) : effacé là où le masque hésite
        dist = np.sqrt(((arr - bg) ** 2).sum(-1))
        unsure = full < 220
        alpha = np.where(unsure, alpha * np.clip((dist - 8) / 30, 0, 1), alpha)
        if pose == 'sleep':
            # fond gris uni : le voile gris lisse resté dans la boucle de la queue disparaît
            g = arr.mean(-1)
            sd = np.sqrt(np.maximum(0, ndimage.uniform_filter(g * g, 5) - ndimage.uniform_filter(g, 5) ** 2))
            sat = arr.max(-1) - arr.min(-1)
            haze = (sat < 28) & (np.abs(g - 128) < 45) & (sd < 7)
            haze = ndimage.binary_opening(haze, iterations=2)
            alpha = alpha * (1 - ndimage.gaussian_filter(haze.astype(float), 1.2))
        alpha[alpha < 0.03] = 0
        # couleurs des bords : on retire la lueur du fond qui s'y mélange
        a3 = np.maximum(alpha, 0.25)[..., None]
        rgb = np.clip((arr - (1 - a3) * bg) / a3, 0, 255)
        rgb = np.where(alpha[..., None] > 0.97, arr, rgb)
        half = W // 2
        for col, variant in enumerate(VARIANTS):
            x0, x1 = col * half, (col + 1) * half
            m = full[:, x0:x1]
            prof = (m > 60).sum(1).astype(float)
            cuts = []
            for gy in (200, 450, 735):
                win = np.convolve(prof[gy - 90:gy + 90], np.ones(9) / 9, 'same')
                cuts.append(seam(m, int(gy - 90 + np.argmin(win)), 70))
            yy = np.arange(H)[:, None]
            lab = sum((yy > c[None, :]).astype(int) for c in cuts)
            for row, stage in enumerate(STAGES):
                a = np.where(lab == row, alpha[:, x0:x1], 0)
                # garder le dragon (plus gros morceau) et ce qui le touche presque
                big = ndimage.binary_dilation(a > 0.3, iterations=4)
                cl, n = ndimage.label(big)
                if n > 1:
                    sizes = ndimage.sum(big, cl, range(1, n + 1))
                    # bout d'aile de la ligne voisine, coupé par la séparation : petit et collé à la coupure
                    edge = np.zeros_like(big)
                    for c in cuts:
                        for dy in range(-6, 7):
                            edge[np.clip(c + dy, 0, H - 1), np.arange(half)] = True
                    touch = ndimage.maximum(edge, cl, range(1, n + 1))
                    ok = (sizes > sizes.max() * 0.04) & ~((sizes < sizes.max() * 0.2) & touch)
                    a = np.where(np.isin(cl, 1 + np.nonzero(ok)[0]), a, 0)
                rgba = np.dstack([rgb[:, x0:x1], a * 255]).astype(np.uint8)
                img = Image.fromarray(rgba, 'RGBA')
                bb = Image.fromarray(((a > 0.05) * 255).astype(np.uint8)).getbbox()
                for poly in CLEAN.get((pose, variant, stage), []):
                    from PIL import ImageDraw
                    er = Image.new('L', (half, H), 0)
                    ImageDraw.Draw(er).polygon([(bb[0] - 4 + x, bb[1] - 4 + y) for x, y in poly], fill=255)
                    a = a * (np.array(er) == 0)
                    rgba = np.dstack([rgb[:, x0:x1], a * 255]).astype(np.uint8)
                    img = Image.fromarray(rgba, 'RGBA')
                bb = Image.fromarray(((a > 0.05) * 255).astype(np.uint8)).getbbox()
                pad = 4
                img = img.crop((max(0, bb[0] - pad), max(0, bb[1] - pad), min(half, bb[2] + pad), min(H, bb[3] + pad)))
                out = os.path.join(ROOT, 'www', 'assets', variant, stage)
                os.makedirs(out, exist_ok=True)
                img.save(os.path.join(out, f'{variant}_{stage}_{pose}.webp'), 'WEBP', quality=90, method=6)
                previews.append(img)
                print(pose, variant, stage, img.size)
    if len(sys.argv) > 2:
        B = Image.new('RGB', (8 * 380, 3 * 200), (60, 70, 90))
        for i, p in enumerate(previews):
            q = p.copy(); q.thumbnail((370, 190))
            B.paste(q, ((i % 8) * 380 + 5, (i // 8) * 200 + 5), q)
        B.save(sys.argv[2])


if __name__ == '__main__':
    main()

"""
Icône de l'application : tête du dragon légendaire (art/dragons/legendary.png) sur fond sombre.
Génère les icônes Android (classiques, rondes et adaptatives) dans resources/android/res/,
copiées dans le projet Android par le build (GitHub Actions).
    python3 scripts/make-icon.py
"""
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.join(os.path.dirname(__file__), '..')
OUT = os.path.join(ROOT, 'resources', 'android', 'res')
DENS = {'mdpi': 1, 'hdpi': 1.5, 'xhdpi': 2, 'xxhdpi': 3, 'xxxhdpi': 4}


def head() -> Image.Image:
    im = Image.open(os.path.join(ROOT, 'art', 'dragons', 'legendary.png')).convert('RGBA')
    h = im.crop((885, 115, 1254, 600))
    a = np.array(h).astype(np.float32)
    H, W = a.shape[:2]
    # le cou s'efface vers le bas, l'arrière de la crinière vers la gauche
    fade = np.clip((H - np.arange(H)) / (H * 0.32), 0, 1)[:, None]
    left = np.clip(np.arange(W) / (W * 0.22), 0, 1)[None, :]
    a[..., 3] *= fade * left
    return Image.fromarray(a.astype(np.uint8), 'RGBA')


def background(size: int, ring: bool) -> Image.Image:
    yy, xx = np.mgrid[0:size, 0:size].astype(np.float32) / size
    d = np.sqrt((xx - 0.55) ** 2 + (yy - 0.42) ** 2)
    t = np.clip(d / 0.75, 0, 1)[..., None]
    c0, c1 = np.array([58, 36, 22]), np.array([12, 10, 16])
    rgb = c0 * (1 - t) + c1 * t
    bg = Image.fromarray(np.dstack([rgb, np.full((size, size, 1), 255)]).astype(np.uint8), 'RGBA')
    if ring:
        dr = ImageDraw.Draw(bg)
        m = size * 0.035
        dr.ellipse((m, m, size - m, size - m), outline=(217, 168, 74, 200), width=max(1, int(size * 0.012)))
    return bg


def compose(size: int, scale: float, ring: bool, with_bg: bool = True) -> Image.Image:
    base = background(size, ring) if with_bg else Image.new('RGBA', (size, size), (0, 0, 0, 0))
    hd = head()
    w = int(size * scale)
    hd = hd.resize((w, int(hd.height * w / hd.width)), Image.LANCZOS)
    # halo doré derrière la tête
    glow = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    gl = Image.new('RGBA', hd.size, (255, 190, 80, 0))
    gl.putalpha(hd.getchannel('A').point(lambda v: int(v * 0.55)))
    x, y = (size - hd.width) // 2 - int(size * 0.02), int(size * 0.5 - hd.height * 0.5)
    glow.alpha_composite(gl, (x, y))
    glow = glow.filter(ImageFilter.GaussianBlur(size * 0.03))
    if with_bg:
        base.alpha_composite(glow)
    base.alpha_composite(hd, (x, y))
    return base


def main():
    master = compose(1024, 0.7, True)
    os.makedirs(os.path.join(ROOT, 'art', 'icon'), exist_ok=True)
    master.save(os.path.join(ROOT, 'art', 'icon', 'icon-1024.png'))
    for dens, k in DENS.items():
        d = os.path.join(OUT, f'mipmap-{dens}')
        os.makedirs(d, exist_ok=True)
        s = round(48 * k)
        sq = master.resize((s, s), Image.LANCZOS)
        # coins arrondis pour l'icône classique
        mask = Image.new('L', (s * 4, s * 4), 0)
        ImageDraw.Draw(mask).rounded_rectangle((0, 0, s * 4 - 1, s * 4 - 1), radius=s * 4 * 0.18, fill=255)
        r = sq.copy(); r.putalpha(mask.resize((s, s), Image.LANCZOS)); r.save(os.path.join(d, 'ic_launcher.png'))
        circ = Image.new('L', (s * 4, s * 4), 0)
        ImageDraw.Draw(circ).ellipse((0, 0, s * 4 - 1, s * 4 - 1), fill=255)
        rr = sq.copy(); rr.putalpha(circ.resize((s, s), Image.LANCZOS)); rr.save(os.path.join(d, 'ic_launcher_round.png'))
        # adaptative : 108 dp, zone sûre au centre (66 dp)
        a = round(108 * k)
        compose(a * 2, 0.5, False, with_bg=False).resize((a, a), Image.LANCZOS).save(os.path.join(d, 'ic_launcher_foreground.png'))
        background(a, False).save(os.path.join(d, 'ic_launcher_background.png'))
    any_dir = os.path.join(OUT, 'mipmap-anydpi-v26')
    os.makedirs(any_dir, exist_ok=True)
    xml = ('<?xml version="1.0" encoding="utf-8"?>\n<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n'
           '    <background android:drawable="@mipmap/ic_launcher_background"/>\n'
           '    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>\n</adaptive-icon>\n')
    for n in ('ic_launcher.xml', 'ic_launcher_round.xml'):
        with open(os.path.join(any_dir, n), 'w') as f:
            f.write(xml)
    print('icônes générées')


if __name__ == '__main__':
    main()

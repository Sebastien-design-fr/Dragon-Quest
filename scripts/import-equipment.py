"""
Importe les planches d'équipements générées (art/equipment/<categorie>.png) :
  1. retire le fond (vrai fond transparent, ou faux damier gris/blanc dessiné dans l'image) ;
  2. trouve les 4 objets de la planche et les range dans l'ordre commun, rare, épique, légendaire
     (lecture de gauche à droite puis de haut en bas : grille 2 x 2 ou 4 lignes) ;
  3. enregistre chaque objet découpé :
     www/assets/equipment/<categorie>/eq_<categorie>_<rarete>_01.webp
     + une vignette eq_..._icon.webp pour la boutique.

Relancer après avoir remplacé une planche :  python3 scripts/import-equipment.py [categorie ...]
"""
import os
import sys

import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

ROOT = os.path.join(os.path.dirname(__file__), '..')
SRC = os.path.join(ROOT, 'art', 'equipment')
OUT = os.path.join(ROOT, 'www', 'assets', 'equipment')
PREVIEW = os.path.join(ROOT, 'art', 'equipment', '_apercu')
RARITIES = ['common', 'rare', 'epic', 'legendary']


def remove_background(img: Image.Image) -> np.ndarray:
    """Retourne une image RGBA (numpy) dont le fond est transparent."""
    rgba = np.array(img.convert('RGBA')).astype(np.int16)
    if (rgba[..., 3] < 250).mean() > 0.2:
        return rgba.astype(np.uint8)  # vraie transparence : rien à faire

    rgb = rgba[..., :3]
    mx, mn = rgb.max(axis=2), rgb.min(axis=2)
    # Damier : gris neutre et clair (cases blanches et grises).
    cand = ((mx - mn) < 16) & (mn > 178)
    lab, n = ndimage.label(cand)
    sizes = np.bincount(lab.ravel(), minlength=n + 1)
    keep = sizes > 1200  # grandes zones de damier, même enfermées (anneau du collier…)
    keep[np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))] = True
    keep[0] = False
    bg = keep[lab]
    # Les cases du damier sont séparées par de fines lignes : on referme le fond.
    bg = ndimage.binary_closing(bg, iterations=2) & (cand | ndimage.binary_dilation(bg, iterations=1))
    obj = ~bg
    obj = ndimage.binary_opening(obj, iterations=1)
    obj = ndimage.binary_fill_holes(obj) & ~(bg & ndimage.binary_erosion(bg, iterations=3))
    # Halo clair (reste du damier mêlé à une lueur) : on ronge les pixels gris clair du bord.
    pale = (((mx - mn) < 34) & (mn > 150)) | (mn > 196)
    for _ in range(6):
        edge = obj & ndimage.binary_dilation(~obj, iterations=1) & pale
        if not edge.any():
            break
        obj = obj & ~edge
    alpha = (obj * 255).astype(np.uint8)
    alpha = np.array(Image.fromarray(alpha).filter(ImageFilter.GaussianBlur(0.8)))
    out = rgba.astype(np.uint8)
    out[..., 3] = alpha
    return out


def split_objects(rgba: np.ndarray):
    """Les 4 objets, dans l'ordre de lecture (lignes, puis colonnes).
    Si des objets se touchent (planche en 4 lignes qui se chevauchent), découpe par bandes."""
    mask = rgba[..., 3] > 40
    H, W = mask.shape
    lab, n = ndimage.label(ndimage.binary_dilation(mask, iterations=3))
    sizes = np.bincount(lab.ravel(), minlength=n + 1)
    sizes[0] = 0
    total = sizes.sum()
    big = [i for i in np.argsort(sizes)[::-1] if sizes[i] > 0.06 * total][:4]
    groups = np.zeros_like(lab)
    if len(big) == 4:
        # Chaque petit morceau (étincelles…) rejoint l'objet le plus proche.
        cents = {i: ndimage.center_of_mass(lab == i) for i in big}
        for i in range(1, n + 1):
            if sizes[i] == 0:
                continue
            if i in big:
                target = i
            else:
                cy, cx = ndimage.center_of_mass(lab == i)
                target = min(big, key=lambda b: (cents[b][0] - cy) ** 2 + (cents[b][1] - cx) ** 2)
            groups[lab == i] = big.index(target) + 1
        centers = [cents[b] for b in big]
    else:
        # Objets soudés : découpe en 4 bandes horizontales (planche en lignes) ou en 4 quarts.
        ys, xs = np.where(mask)
        rows_layout = (xs.max() - xs.min()) > 0.8 * W
        if rows_layout:
            prof = mask.sum(axis=1).astype(float)
            cuts = []
            for k in range(1, 4):
                c = int(ys.min() + (ys.max() - ys.min()) * k / 4)
                lo, hi = c - 90, c + 90
                cuts.append(lo + int(np.argmin(prof[lo:hi])))  # coupe là où il y a le moins de matière
            bands = [ys.min()] + cuts + [ys.max() + 1]
            yy = np.arange(H)[:, None].repeat(W, 1)
            for k in range(4):
                groups[(yy >= bands[k]) & (yy < bands[k + 1]) & mask] = k + 1
            centers = [((bands[k] + bands[k + 1]) / 2, W / 2) for k in range(4)]
        else:
            yy, xx = np.mgrid[0:H, 0:W]
            q = (yy >= H // 2) * 2 + (xx >= W // 2)
            groups = np.where(mask, q + 1, 0)
            centers = [(H / 4, W / 4), (H / 4, 3 * W / 4), (3 * H / 4, W / 4), (3 * H / 4, 3 * W / 4)]

    # Ordre de lecture : regroupe par ligne (centres verticaux proches), puis de gauche à droite.
    idx = sorted(range(len(centers)), key=lambda k: centers[k][0])
    rows, cur = [], [idx[0]]
    for k in idx[1:]:
        if abs(centers[k][0] - centers[cur[-1]][0]) < 150:
            cur.append(k)
        else:
            rows.append(cur)
            cur = [k]
    rows.append(cur)
    ordered = [k for r in rows for k in sorted(r, key=lambda k: centers[k][1])]

    pieces = []
    for k in ordered:
        sel = (groups == k + 1) & mask
        ys, xs = np.where(sel)
        if not len(ys):
            continue
        m = 4
        y0, y1 = max(0, ys.min() - m), min(H - 1, ys.max() + m)
        x0, x1 = max(0, xs.min() - m), min(W - 1, xs.max() + m)
        piece = rgba[y0:y1 + 1, x0:x1 + 1].copy()
        s2 = sel[y0:y1 + 1, x0:x1 + 1]
        # Retire les fragments d'objets voisins : petits morceaux collés au bord haut ou bas de la bande.
        lab2, n2 = ndimage.label(s2)
        if n2 > 1:
            sz = np.bincount(lab2.ravel())
            sz[0] = 0
            hh = s2.shape[0]
            for j in range(1, n2 + 1):
                if sz[j] == 0 or sz[j] >= 0.15 * sz.max():
                    continue
                ys_j = np.where(lab2 == j)[0]
                # morceau collé au bord, ou flottant tout en haut / tout en bas : vient d'un objet voisin
                if ys_j.min() <= 2 or ys_j.max() >= hh - 3 or ys_j.mean() < 0.18 * hh or ys_j.mean() > 0.85 * hh:
                    s2 = s2 & (lab2 != j)
            ys2, xs2 = np.where(s2)
            piece = piece[ys2.min():ys2.max() + 1, xs2.min():xs2.max() + 1]
            s2 = s2[ys2.min():ys2.max() + 1, xs2.min():xs2.max() + 1]
        piece[..., 3] = np.where(s2, piece[..., 3], 0)
        pieces.append(Image.fromarray(piece, 'RGBA'))
    return pieces


def main(categories):
    os.makedirs(PREVIEW, exist_ok=True)
    for cat in categories:
        path = os.path.join(SRC, cat + '.png')
        if not os.path.exists(path):
            print(f'{cat}: planche absente, ignorée')
            continue
        rgba = remove_background(Image.open(path))
        pieces = split_objects(rgba)
        if len(pieces) != 4:
            print(f'{cat}: {len(pieces)} objet(s) trouvé(s) au lieu de 4 — planche à vérifier')
        os.makedirs(os.path.join(OUT, cat), exist_ok=True)
        for rarity, piece in zip(RARITIES, pieces):
            name = f'eq_{cat}_{rarity}_01'
            piece.save(os.path.join(OUT, cat, name + '.webp'), 'WEBP', quality=88, method=6)
            icon = piece.copy()
            icon.thumbnail((256, 256), Image.LANCZOS)
            sq = Image.new('RGBA', (256, 256), (0, 0, 0, 0))
            sq.alpha_composite(icon, ((256 - icon.width) // 2, (256 - icon.height) // 2))
            sq.save(os.path.join(OUT, cat, name + '_icon.webp'), 'WEBP', quality=85, method=6)
            print(f'{cat}/{name}: {piece.width}x{piece.height}')
        # Aperçu de contrôle sur fond sombre.
        W = sum(p.width for p in pieces) + 20 * (len(pieces) + 1)
        H = max(p.height for p in pieces) + 40
        prev = Image.new('RGBA', (W, H), (40, 36, 46, 255))
        x = 20
        for p in pieces:
            prev.alpha_composite(p, (x, 20))
            x += p.width + 20
        prev.convert('RGB').save(os.path.join(PREVIEW, cat + '.jpg'), quality=80)


if __name__ == '__main__':
    main(sys.argv[1:] or ['head', 'neck', 'body', 'legs', 'wings', 'tail'])

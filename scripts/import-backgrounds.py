"""Décors derrière le dragon : art/backgrounds/<stade>.png -> www/assets/backgrounds/bg_<stade>.webp
    python3 scripts/import-backgrounds.py"""
import os
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..')
for stage in ('baby', 'young', 'adult', 'legendary'):
    src = os.path.join(ROOT, 'art', 'backgrounds', stage + '.png')
    if not os.path.exists(src):
        continue
    im = Image.open(src).convert('RGB')
    if im.width > 1536:
        im = im.resize((1536, round(im.height * 1536 / im.width)), Image.LANCZOS)
    out = os.path.join(ROOT, 'www', 'assets', 'backgrounds', f'bg_{stage}.webp')
    im.save(out, 'WEBP', quality=80, method=6)
    print(stage, im.size, os.path.getsize(out) // 1024, 'Ko')

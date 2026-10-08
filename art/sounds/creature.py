"""Voix de créature plus réalistes (refonte des sons, octobre 2026).

Principes (inspirés des grands animaux : félins, crocodiliens, chevaux) :
- source = impulsions de glotte une à une, avec de petites irrégularités de période et d'amplitude
  (raucité naturelle) — jamais de modulation « en créneau » à basse fréquence (c'est elle qui donnait
  l'impression d'un bruit de pet) ;
- conduit vocal d'une grande bête : formants bas, larges ;
- beaucoup de souffle (expirations par les naseaux, « chuff » des félins pour saluer) ;
- résonance de grotte courte.
Usage : python3 art/sounds/creature.py  -> art/sounds/out2/*.wav puis conversion mp3 dans www/assets/sounds/.
"""
import os
import subprocess

import numpy as np
from scipy import signal
from scipy.io import wavfile

SR = 44100
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'out2')
DEST = os.path.join(HERE, '..', '..', 'www', 'assets', 'sounds')
rng = np.random.default_rng(11)


def n_(d): return int(d * SR)


def lowpass(x, f, o=2):
    b, a = signal.butter(o, min(f, SR / 2 - 200) / (SR / 2), 'low'); return signal.lfilter(b, a, x)


def highpass(x, f, o=2):
    b, a = signal.butter(o, f / (SR / 2), 'high'); return signal.lfilter(b, a, x)


def band(x, lo, hi, o=2):
    b, a = signal.butter(o, [lo / (SR / 2), min(hi, SR / 2 - 200) / (SR / 2)], 'band'); return signal.lfilter(b, a, x)


def reson(x, f, bw):
    """Résonance (formant) de largeur bw Hz."""
    r = np.exp(-np.pi * bw / SR)
    th = 2 * np.pi * f / SR
    return signal.lfilter([1 - r], [1, -2 * r * np.cos(th), r * r], x)


def curve(points, dur):
    t = np.linspace(0, 1, n_(dur)); xs, ys = zip(*points); return np.interp(t, xs, ys)


def slow_noise(n, rate):
    k = max(2, int(n / SR * rate) + 2)
    return np.interp(np.linspace(0, k - 1, n), np.arange(k), rng.standard_normal(k))


def glottal(f0, jitter=0.03, shimmer=0.08, open_q=0.6):
    """Train d'impulsions de glotte (une par cycle) suivant la courbe f0, avec irrégularités naturelles."""
    n = len(f0)
    out = np.zeros(n + 4000)
    t = 0.0
    while t < n - 1:
        f = max(20.0, f0[int(t)])
        period = SR / f * (1 + jitter * rng.standard_normal())
        L = max(8, int(period * open_q))
        k = np.arange(L) / L
        pulse = (np.sin(np.pi * k) ** 2) * (1 - k) - 0.15 * np.sin(np.pi * k)   # ouverture puis fermeture rapide
        a = 1 + shimmer * rng.standard_normal()
        i = int(t)
        out[i:i + L] += a * pulse
        t += max(4.0, period)
    src = np.diff(out[:n + 1])       # dérivée du débit : spectre riche comme une vraie voix
    return src / (np.abs(src).max() + 1e-9)


def reson_tv(x, f, bw):
    """Résonance dont la fréquence varie dans le temps (sans à-coups)."""
    r = np.exp(-np.pi * bw / SR)
    c = 2 * r * np.cos(2 * np.pi * f / SR)
    y = np.zeros_like(x); y1 = y2 = 0.0
    for i in range(len(x)):
        v = (1 - r) * x[i] + c[i] * y1 - r * r * y2
        y[i] = v; y2 = y1; y1 = v
    return y


def tract(src, formants):
    y = np.zeros_like(src)
    for f, bw, g in formants:
        y += g * reson(src, f, bw)
    return y


def breath(dur, lo, hi, env):
    x = band(rng.standard_normal(n_(dur)), lo, hi, 2)
    return x / (np.abs(x).max() + 1e-9) * env


def cave(x, size=0.9, wet=0.18):
    n = n_(size)
    ir = rng.standard_normal(n) * np.exp(-np.arange(n) / SR / (size / 6))
    ir = lowpass(ir, 2800); ir[:n_(0.015)] = 0
    y = signal.fftconvolve(x, ir)[: len(x) + n]
    y /= np.abs(y).max() + 1e-9
    dry = np.concatenate([x, np.zeros(len(y) - len(x))]) / (np.abs(x).max() + 1e-9)
    return (1 - wet) * dry + wet * y


def env(dur, pts):
    return curve(pts, dur)


def norm(x, p=0.9): return x / (np.abs(x).max() + 1e-9) * p


def place(total, *parts):
    out = np.zeros(n_(total))
    for x, at, g in parts:
        i = n_(at); m = min(len(x), len(out) - i)
        out[i:i + m] += g * x[:m]
    return out


# ---------------- Sons ----------------
def chuff(size=1.0):
    """Salut amical des grands félins : 2 à 3 courtes expirations par le nez, à peine voisées."""
    parts = []
    for k, (at, g) in enumerate([(0.0, 1.0), (0.17, 0.85), (0.33, 0.6)]):
        d = 0.16
        e = env(d, [(0, 0), (0.08, 1), (0.35, 0.55), (1, 0)])
        nose = breath(d, 350 / size, 2200 / size, e)
        nose = reson(nose, 900 / size, 500) + 0.6 * nose
        f0 = curve([(0, 120 / size), (1, 95 / size)], d)
        v = tract(glottal(f0, 0.05, 0.15), [(300 / size, 120, 1.0), (750 / size, 200, 0.5)]) * e
        parts.append((norm(nose) + 0.35 * norm(v), at, g))
    x = place(0.6, *parts)
    return cave(lowpass(x, 5000), 0.6, 0.12)


def snort(size=1.0):
    """Ébrouement : forte expiration nasale (réveil, tête qui tourne)."""
    d = 0.5
    e = env(d, [(0, 0), (0.04, 1), (0.25, 0.6), (1, 0)])
    x = breath(d, 250 / size, 3500 / size, e)
    # balayage des naseaux : la résonance descend
    fs = curve([(0, 1400 / size), (1, 600 / size)], d)
    sweep = reson_tv(x, fs, 400)
    thump = lowpass(rng.standard_normal(n_(d)), 120, 2) * env(d, [(0, 0), (0.03, 1), (0.2, 0), (1, 0)])
    return cave(norm(0.6 * norm(sweep) + 0.5 * norm(x) + 0.35 * norm(thump)), 0.7, 0.15)


def rumble(size=1.0):
    """Contentement (caresse) : grondement de gorge très grave et doux, sur deux respirations."""
    d = 3.2
    parts = []
    for at, dd, g in [(0.0, 1.7, 1.0), (1.55, 1.6, 0.8)]:
        f0 = curve([(0, 52 / size), (0.5, 48 / size), (1, 44 / size)], dd) * (1 + 0.02 * slow_noise(n_(dd), 3))
        src = glottal(f0, 0.015, 0.05, 0.7)
        v = tract(src, [(160 / size, 60, 1.0), (420 / size, 120, 0.35)])
        v = lowpass(v, 520 / size, 4)
        e = env(dd, [(0, 0), (0.3, 1), (0.75, 0.8), (1, 0)])
        air = lowpass(breath(dd, 150, 900, env(dd, [(0, 0), (0.4, 0.7), (1, 0)])), 700)
        parts.append((norm(v) * e + 0.07 * norm(air), at, g))
    return cave(place(d, *parts), 1.0, 0.16)


def yawn(size=1.0):
    """Bâillement / étirement : inspiration, longue expiration grave qui descend, petit claquement final."""
    inh = breath(0.6, 400, 3000, env(0.6, [(0, 0), (0.7, 0.6), (1, 0)]))
    d = 1.4
    f0 = curve([(0, 95 / size), (0.3, 80 / size), (1, 52 / size)], d)
    src = glottal(f0, 0.035, 0.1)
    v = tract(src, [(320 / size, 90, 1.0), (850 / size, 160, 0.55), (2100 / size, 300, 0.15)])
    e = env(d, [(0, 0), (0.15, 1), (0.7, 0.7), (1, 0)])
    air = breath(d, 300, 2500, e * 0.8)
    exh = norm(v) * e + 0.45 * air
    click = highpass(rng.standard_normal(n_(0.03)), 1500) * np.linspace(1, 0, n_(0.03))
    return cave(place(2.3, (inh, 0, 0.5), (exh, 0.55, 1.0), (norm(click), 2.05, 0.25)), 0.9, 0.16)


def hatchling():
    """Bébé : petit grognement rauque et soufflé (jeune crocodilien / félin), pas de couinement."""
    parts = []
    for at, d, f_hi, f_lo in [(0.0, 0.32, 230, 190), (0.42, 0.42, 250, 170)]:
        f0 = curve([(0, f_hi), (0.4, f_hi * 1.05), (1, f_lo)], d)
        src = glottal(f0, 0.09, 0.2, 0.55)
        v = tract(src, [(700, 220, 1.0), (1500, 300, 0.5), (2600, 400, 0.2)])
        e = env(d, [(0, 0), (0.1, 1), (0.6, 0.7), (1, 0)])
        hiss = breath(d, 1200, 6000, e)
        parts.append((norm(v) * e + 0.4 * hiss, at, 1.0 if at == 0 else 0.85))
    return cave(place(0.95, *parts), 0.5, 0.1)


def eat(size=1.0):
    """Repas : trois bouchées croquantes, puis un grondement satisfait."""
    parts = []
    for k, at in enumerate([0.0, 0.34, 0.66]):
        d = 0.22
        # croquant : une volée de petits craquements secs (grains), de plus en plus espacés
        cr = np.zeros(n_(d))
        for _ in range(26):
            i = int(n_(d) * rng.random() ** 1.8)
            L = n_(0.004 + 0.006 * rng.random())
            g = band(rng.standard_normal(L + 64), 900 + 2500 * rng.random(), 7000)[:L] * np.exp(-np.arange(L) / (L / 4))
            cr[i:i + L] += g[: len(cr[i:i + L])] * (0.4 + rng.random())
        thud = lowpass(rng.standard_normal(n_(d)), 140, 2) * env(d, [(0, 0), (0.02, 1), (0.25, 0.1), (1, 0)])
        parts.append((norm(cr) + 0.45 * norm(thud), at, 0.9 - k * 0.1))
    r = rumble(size)[: n_(1.0)] * np.linspace(1, 0, n_(1.0)) ** 0.7
    parts.append((norm(r), 0.95, 0.6))
    return place(2.1, *parts)


SOUNDS = {
    'chuff': chuff, 'snort': snort, 'rumble': rumble, 'yawn': yawn, 'baby': hatchling, 'eat': eat,
}


def export(name, x):
    x = norm(x, 0.89)
    f = n_(0.008); x[:f] *= np.linspace(0, 1, f); x[-f:] *= np.linspace(1, 0, f)
    os.makedirs(OUT, exist_ok=True)
    wav = os.path.join(OUT, name + '.wav')
    wavfile.write(wav, SR, (x * 32767).astype(np.int16))
    mp3 = os.path.join(DEST, name + '.mp3')
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', wav, '-ac', '1', '-codec:a', 'libmp3lame', '-q:a', '4', mp3], check=True)
    return mp3


if __name__ == '__main__':
    for name, fn in SOUNDS.items():
        x = fn()
        print(name, f'{len(x) / SR:.2f}s', export(name, x))

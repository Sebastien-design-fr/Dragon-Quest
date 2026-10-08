"""Sons de dragon à partir d'enregistrements Mixkit (licence Mixkit : usage commercial, sans attribution,
pas de redistribution des fichiers bruts — ils restent hors du dépôt, dans art/sounds/mixkit/).

Traitement : mono, silence retiré, voix abaissée selon la taille du dragon, graves renforcés,
résonance de grotte, volume harmonisé (même intensité perçue d'un son à l'autre).
Usage : python3 art/sounds/mixkit_design.py
"""
import os
import subprocess

import numpy as np
from scipy import signal
from scipy.io import wavfile

SR = 44100
HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, 'mixkit')
OUT = os.path.join(HERE, 'out3')
DEST = os.path.join(HERE, '..', '..', 'www', 'assets', 'sounds')
rng = np.random.default_rng(5)


def load(name, start=0.0, end=None):
    sr, x = wavfile.read(os.path.join(SRC, name + '.wav'))
    x = x.astype(float)
    if x.ndim > 1: x = x.mean(1)
    if sr != SR: x = signal.resample_poly(x, SR, sr)
    x = x[int(start * SR): int(end * SR) if end else None]
    a = np.abs(x) > 0.02 * np.abs(x).max()
    i0, i1 = np.argmax(a), len(a) - np.argmax(a[::-1])
    x = x[i0:i1]
    return x / (np.abs(x).max() + 1e-9)


def pitch(x, k):
    """k < 1 : plus grave et un peu plus lent (créature plus grande)."""
    if k == 1: return x
    return signal.resample_poly(x, int(round(1000 / k)), 1000)


def lowpass(x, f, o=2):
    b, a = signal.butter(o, f / (SR / 2), 'low'); return signal.lfilter(b, a, x)


def highpass(x, f, o=2):
    b, a = signal.butter(o, f / (SR / 2), 'high'); return signal.lfilter(b, a, x)


def bass(x, f=180, g=0.5):
    return x + g * lowpass(x, f, 2)


def fade(x, a=0.01, r=0.15):
    x = x.copy(); na, nr = int(a * SR), min(len(x) // 2, int(r * SR))
    if na: x[:na] *= np.linspace(0, 1, na)
    if nr: x[-nr:] *= np.linspace(1, 0, nr) ** 1.5
    return x


def cave(x, size=1.2, wet=0.2):
    n = int(size * SR)
    ir = rng.standard_normal(n) * np.exp(-np.arange(n) / SR / (size / 6))
    ir = lowpass(ir, 3000); ir[: int(0.018 * SR)] = 0
    y = signal.fftconvolve(x, ir)
    y /= np.abs(y).max() + 1e-9
    dry = np.concatenate([x / (np.abs(x).max() + 1e-9), np.zeros(len(y) - len(x))])
    return (1 - wet) * dry + wet * y


def mix(total, *parts):
    out = np.zeros(int(total * SR))
    for x, at, g in parts:
        i = int(at * SR); m = min(len(x), len(out) - i)
        if m > 0: out[i:i + m] += g * x[:m]
    return out


def loud(x, target_rms=0.16, peak=0.92):
    """Volume perçu harmonisé (RMS de la partie active), sans dépasser le pic."""
    act = x[np.abs(x) > 0.05 * np.abs(x).max()]
    r = np.sqrt(np.mean(act ** 2)) if len(act) else 1
    y = x * (target_rms / (r + 1e-9))
    p = np.abs(y).max()
    if p > peak: y = np.tanh(y / p * 1.3) / np.tanh(1.3) * peak   # léger compresseur plutôt que de baisser tout
    return y


# ---------------- Rugissements (le dernier mot de chaque stade) ----------------
def roar_legendary():
    r = pitch(load('big-dragon-in-the-wild-roar-16'), 0.86)
    sub = lowpass(rng.standard_normal(len(r)), 70, 4)
    sub = sub / (np.abs(sub).max() + 1e-9) * np.interp(np.arange(len(r)), [0, len(r) * 0.15, len(r) * 0.6, len(r)], [0, 1, 0.6, 0])
    return loud(cave(fade(bass(r, 160, 0.7) + 0.25 * sub, 0.02, 1.2), 2.2, 0.3), 0.18)


def roar_adult():
    r = pitch(load('aggressive-monster-beast-roar-14'), 0.9)
    return loud(cave(fade(bass(lowpass(r, 7000), 200, 0.5), 0.01, 0.6), 1.8, 0.26), 0.17)


def roar_young():
    r = pitch(load('wild-creature-growl-1957'), 1.0)
    return loud(cave(fade(lowpass(r, 8000), 0.01, 0.35), 1.3, 0.2), 0.16)


def baby():
    """Bébé : petit grognement (sert aussi de « rugissement » et de voix de joie au stade bébé)."""
    g = pitch(load('small-monster-growl-1968'), 1.05)
    return loud(cave(fade(g, 0.005, 0.15), 0.6, 0.12), 0.14)


# ---------------- Vie de tous les jours ----------------
def rumble():
    """Contentement (caresse) : grondement calme, plus grave et adouci."""
    g = pitch(load('monster-calm-growl-1956'), 0.88)
    g = lowpass(g, 2200, 2)
    return loud(cave(fade(bass(g, 150, 0.4), 0.06, 0.5), 1.0, 0.18), 0.12)


def snort():
    """Ébrouement : la partie la plus forte de la grosse respiration."""
    b = load('monster-breath-1978', 1.2, 2.6)
    return loud(cave(fade(highpass(b, 60), 0.01, 0.35), 0.8, 0.16), 0.14)


def yawn():
    s = pitch(load('monster-snore-short-1967'), 0.92)
    tail = load('monster-breath-1978', 2.6, 4.2)
    return loud(cave(mix(len(s) / SR + 1.2, (fade(s, 0.04, 0.2), 0, 1.0), (fade(tail, 0.2, 0.6), len(s) / SR - 0.1, 0.45)), 1.0, 0.16), 0.13)


def eat():
    c = pitch(load('animal-eating-herb-2241'), 0.85)
    g = pitch(load('monster-calm-growl-1956'), 0.95)[: int(0.9 * SR)]
    return loud(cave(mix(len(c) / SR + 1.1, (fade(bass(c, 200, 0.4), 0.005, 0.1), 0, 1.0), (fade(lowpass(g, 2000), 0.05, 0.4), len(c) / SR + 0.05, 0.5)), 0.8, 0.12), 0.14)


def sleep_loop():
    """Ronflement très doux pendant le sommeil (boucle d'environ 16 s)."""
    s = load('monster-sleep-snore-1962', 0.0, 16.5)
    s = lowpass(s, 1800, 2)
    n = len(s); f = int(0.6 * SR)
    s[:f] *= np.linspace(0, 1, f); s[-f:] *= np.linspace(1, 0, f)
    return loud(s, 0.07, 0.5)


def fire():
    """Souffle de feu : inspiration rauque, puis le souffle existant (flammes)."""
    sr, f = wavfile.read(os.path.join(OUT, '_fire_old.wav'))
    f = f.astype(float) / 32768
    inh = load('monster-breath-1978', 0.2, 1.1)
    return loud(mix(len(f) / SR + 0.6, (fade(inh, 0.05, 0.25), 0, 0.6), (f, 0.55, 1.0)), 0.17)


def evolution():
    """Montée d'énergie pendant la transformation (le rugissement du nouveau stade vient à la révélation)."""
    d = 5.4
    t = np.arange(int(d * SR)) / SR
    k = (t / d) ** 2
    rum = lowpass(rng.standard_normal(len(t)), 90, 4); rum /= np.abs(rum).max()
    air = signal.lfilter(*signal.butter(2, [300 / (SR / 2), 3000 / (SR / 2)], 'band'), rng.standard_normal(len(t))); air /= np.abs(air).max()
    shimmer = np.zeros(len(t))
    for fr in (1568, 2093, 2637, 3136):
        shimmer += np.sin(2 * np.pi * fr * t * (1 + 0.002 * np.sin(2 * np.pi * 5 * t)))
    shimmer /= 4
    br = load('monster-breath-1978', 0.0, 3.0)
    br = pitch(br, 0.8)[: len(t)]
    br = np.pad(br, (0, len(t) - len(br)))
    x = rum * (0.3 + 0.7 * k) + 0.35 * air * k + 0.12 * shimmer * k ** 1.5 + 0.35 * br * np.linspace(0.2, 1, len(t))
    x[-int(0.15 * SR):] *= np.linspace(1, 0, int(0.15 * SR))
    return loud(cave(x, 1.5, 0.25), 0.15)


SOUNDS = {
    'roar_legendary': roar_legendary, 'roar_adult': roar_adult, 'roar_young': roar_young, 'baby': baby,
    'rumble': rumble, 'snort': snort, 'yawn': yawn, 'eat': eat, 'sleep': sleep_loop, 'fire': fire, 'evolution': evolution,
}


def export(name, x):
    os.makedirs(OUT, exist_ok=True)
    f = int(0.006 * SR); x = x.copy(); x[:f] *= np.linspace(0, 1, f); x[-f:] *= np.linspace(1, 0, f)
    wav = os.path.join(OUT, name + '.wav')
    wavfile.write(wav, SR, (np.clip(x, -1, 1) * 32767).astype(np.int16))
    mp3 = os.path.join(DEST, name + '.mp3')
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', wav, '-ac', '1', '-codec:a', 'libmp3lame', '-q:a', '4', mp3], check=True)
    return mp3


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    # le souffle de flammes actuel sert de base au nouveau son de feu
    old = os.path.join(OUT, '_fire_old.wav')
    if not os.path.exists(old):
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', os.path.join(DEST, 'fire.mp3'), '-ac', '1', '-ar', str(SR), old], check=True)
    for name, fn in SOUNDS.items():
        x = fn()
        print(f'{name:16s} {len(x) / SR:5.2f}s', export(name, x))

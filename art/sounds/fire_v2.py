"""Souffle de feu v2 (0.29.3), calé sur l'animation « fire » de 3,9 s :
0 bond en arrière (battement d'ailes) · 0,48 réception (choc sourd) · 0,55 inspiration rauque ·
1,1 flammes (souffle existant + grondement du feu + crépitements) · 3,45 et 3,78 petits bonds de retour."""
import os, subprocess
import numpy as np
from scipy.io import wavfile
from mixkit_design import SR, OUT, DEST, load, lowpass, highpass, fade, cave

rng = np.random.default_rng(7)

def rd(path):
    sr, x = wavfile.read(path)
    x = x.astype(float) / 32768
    if x.ndim > 1: x = x.mean(axis=1)
    return x

def mp3(name):
    tmp = os.path.join(OUT, '_' + name + '.wav')
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', os.path.join(DEST, name + '.mp3'), '-ac', '1', '-ar', str(SR), tmp], check=True)
    return rd(tmp)

def thud(d=0.16, f=70, g=1.0):
    n = int(d * SR); t = np.arange(n) / SR
    body = np.sin(2 * np.pi * f * t * (1 - 0.3 * t / d)) * np.exp(-t / 0.05)
    grit = lowpass(rng.standard_normal(n), 400, 3) * np.exp(-t / 0.03)
    grit /= np.abs(grit).max()
    return g * (0.8 * body + 0.5 * grit)

D = 4.3
out = np.zeros(int(D * SR))
def put(x, at, g=1.0):
    i = int(at * SR); x = x[: len(out) - i]; out[i:i + len(x)] += g * x

wings = mp3('wings')
put(fade(wings[: int(0.45 * SR)], 0.01, 0.12), 0.0, 0.55)
put(thud(), 0.47, 0.55)
put(fade(load('monster-breath-1978', 0.2, 1.1), 0.05, 0.25), 0.52, 0.6)

flame = rd(os.path.join(OUT, '_fire_old.wav'))
put(flame, 1.08, 1.0)
# grondement du feu (corps de la flamme) et crépitements pendant le jet
fd = 2.3; n = int(fd * SR); t = np.arange(n) / SR
envf = np.clip(t / 0.12, 0, 1) * np.clip((fd - t) / 0.7, 0, 1)
roar = lowpass(rng.standard_normal(n), 260, 3); roar /= np.abs(roar).max()
flutter = 1 + 0.35 * np.sin(2 * np.pi * 7.3 * t) * np.sin(2 * np.pi * 2.1 * t)
put(roar * envf * flutter, 1.12, 0.35)
cr = np.zeros(n)
for _ in range(220):
    i = rng.integers(0, n - 400); L = rng.integers(30, 260)
    cr[i:i + L] += rng.standard_normal(L) * np.exp(-np.arange(L) / (L / 5)) * rng.uniform(0.2, 1)
cr = highpass(cr, 1800); cr /= np.abs(cr).max()
put(cr * envf, 1.15, 0.22)
put(thud(0.12, 85), 3.45, 0.3)
put(thud(0.12, 80), 3.78, 0.35)

x = cave(out, 1.0, 0.15)
x /= np.abs(x).max() + 1e-9; x *= 0.89
f = int(0.006 * SR); x[-f:] *= np.linspace(1, 0, f)
wav = os.path.join(OUT, 'fire.wav')
wavfile.write(wav, SR, (np.clip(x, -1, 1) * 32767).astype(np.int16))
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', wav, '-ac', '1', '-codec:a', 'libmp3lame', '-q:a', '4', os.path.join(DEST, 'fire.mp3')], check=True)
print('fire.mp3', len(x) / SR, 's')

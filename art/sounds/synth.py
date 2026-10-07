"""Essais de sons de dragon synthétisés (aucun enregistrement) : voix = source harmonique + souffle,
filtrée par des formants (la « gorge »), grain de grognement, saturation, réverbération de caverne."""
import os
import numpy as np
from scipy import signal
from scipy.io import wavfile

SR = 44100
rng = np.random.default_rng(7)
OUT = os.path.dirname(os.path.abspath(__file__))


def t_axis(dur):
    return np.arange(int(dur * SR)) / SR


def smooth_noise(n, rate_hz, amp=1.0):
    """Bruit lent (jitter naturel)."""
    k = max(2, int(n / SR * rate_hz) + 2)
    pts = rng.standard_normal(k)
    x = np.linspace(0, k - 1, n)
    return np.interp(x, np.arange(k), pts) * amp


def curve(points, dur):
    """Courbe par points (temps relatif 0..1, valeur), interpolation douce."""
    t = np.linspace(0, 1, int(dur * SR))
    xs, ys = zip(*points)
    return np.interp(t, xs, ys)


def bandpass(x, f, q):
    b, a = signal.iirpeak(min(f, SR / 2 - 100) / (SR / 2), q)
    return signal.lfilter(b, a, x)


def lowpass(x, f, order=2):
    b, a = signal.butter(order, f / (SR / 2), 'low')
    return signal.lfilter(b, a, x)


def highpass(x, f, order=2):
    b, a = signal.butter(order, f / (SR / 2), 'high')
    return signal.lfilter(b, a, x)


def voice(f0, dur, formants, rough=0.0, growl_hz=28, breath=0.15, sub=0.0, bright=0.8, drive=1.5):
    """Voix : f0 = courbe de fréquence (Hz) ; formants = [(fréquence, Q, gain)]."""
    n = int(dur * SR)
    f0 = f0[:n] * (1 + smooth_noise(n, 9, 0.012) + 0.006 * np.sin(2 * np.pi * 5.5 * t_axis(dur)))
    ph = np.cumsum(2 * np.pi * f0 / SR)
    src = np.zeros(n)
    nh = int(min(60, (SR / 2 - 500) / max(f0.max(), 1)))
    for k in range(1, nh + 1):
        amp = 1 / (k ** bright)
        src += amp * np.sin(k * ph + rng.uniform(0, 6.28))
    if sub:
        src += sub * np.sin(0.5 * ph) * 2.0
    src /= np.max(np.abs(src)) + 1e-9
    noise = rng.standard_normal(n)
    src = src + breath * noise
    if rough:
        # grain du grognement : modulation irrégulière à basse fréquence
        g = growl_hz * (1 + smooth_noise(n, 6, 0.25))
        gp = np.cumsum(2 * np.pi * g / SR)
        am = 1 - rough + rough * (0.5 + 0.5 * np.sign(np.sin(gp)) * np.abs(np.sin(gp)) ** 0.3)
        src *= am
    out = np.zeros(n)
    for f, q, gain in formants:
        out += gain * bandpass(src, f, q)
    out += 0.15 * src  # un peu de source directe
    out = np.tanh(drive * out / (np.max(np.abs(out)) + 1e-9))
    return out


def env(dur, a, r, shape=None):
    n = int(dur * SR)
    e = np.ones(n)
    na, nr = int(a * SR), int(r * SR)
    e[:na] = np.linspace(0, 1, na) ** 1.5
    e[n - nr:] *= np.linspace(1, 0, nr) ** 1.8
    if shape is not None:
        e *= shape
    return e


def cave(x, size=1.6, wet=0.28):
    n = int(size * SR)
    ir = rng.standard_normal(n) * np.exp(-np.arange(n) / SR / (size / 5))
    ir = lowpass(ir, 3500)
    ir[:int(0.02 * SR)] = 0
    dry = np.concatenate([x, np.zeros(n)])
    y = signal.fftconvolve(x, ir)[: len(dry)]
    y = np.pad(y, (0, len(dry) - len(y)))
    y /= np.max(np.abs(y)) + 1e-9
    return (1 - wet) * dry + wet * y


def save(name, x, gain_db=-1.5):
    x = x / (np.max(np.abs(x)) + 1e-9) * 10 ** (gain_db / 20)
    fade = int(0.01 * SR)
    x[:fade] *= np.linspace(0, 1, fade); x[-fade:] *= np.linspace(1, 0, fade)
    path = os.path.join(OUT, name + '.wav')
    wavfile.write(path, SR, (x * 32767).astype(np.int16))
    return path


def silence(s):
    return np.zeros(int(s * SR))


# ---------------- Les sons ----------------
def purr(dur=4.2, size=1.0):
    """Ronronnement : pulsations graves (~24 /s) qui suivent la respiration (expire / inspire)."""
    t = t_axis(dur)
    n = len(t)
    breath_cycle = 2.1
    phase = (t % breath_cycle) / breath_cycle
    exhale = phase < 0.58
    level = np.where(exhale, 1.0, 0.55)
    level = lowpass(level, 6, 1)
    rate = np.where(exhale, 23.0, 27.0) / size
    rate = lowpass(rate, 5, 1)
    pp = np.cumsum(2 * np.pi * rate / SR)
    pulses = (0.5 + 0.5 * np.sin(pp)) ** 6
    body = lowpass(rng.standard_normal(n), 260 / size, 4) * 3 + 0.8 * np.sin(2 * np.pi * (55 / size) * t)
    x = body * pulses * level
    x = bandpass(x, 110 / size, 1.2) * 0.8 + lowpass(x, 400, 2)
    x *= env(dur, 0.25, 0.6)
    return np.tanh(2.2 * x / (np.max(np.abs(x)) + 1e-9))


def chirp_happy(size=0.7):
    """Petit cri content : deux trilles montantes, voix claire."""
    parts = []
    for i, (d, pts) in enumerate([(0.32, [(0, 520), (0.4, 860), (1, 740)]), (0.42, [(0, 600), (0.35, 980), (0.7, 900), (1, 700)])]):
        f0 = curve([(x, y / size * 0.7) for x, y in pts], d)
        v = voice(f0, d, [(900 / size, 4, 1.0), (2300 / size, 6, 0.6), (3600 / size, 8, 0.25)], rough=0.12, growl_hz=40, breath=0.12, bright=1.1, drive=1.2)
        parts += [v * env(d, 0.03, 0.12), silence(0.07)]
    return cave(np.concatenate(parts), 0.8, 0.12)


def baby_cry():
    """Cri de bébé dragon : un « kriiii » aigu un peu éraillé, qui monte puis retombe."""
    d = 0.95
    f0 = curve([(0, 480), (0.18, 820), (0.55, 760), (0.8, 640), (1, 420)], d)
    v = voice(f0, d, [(1100, 3.5, 1.0), (2600, 5, 0.7), (4200, 7, 0.3)], rough=0.35, growl_hz=55, breath=0.22, bright=0.9, drive=1.8)
    v *= env(d, 0.05, 0.3)
    return cave(v, 0.9, 0.15)


def legendary_roar():
    """Rugissement du légendaire : fondamental très grave, sous-harmonique, grain rauque, souffle, caverne."""
    d = 3.0
    f0 = curve([(0, 70), (0.12, 105), (0.35, 118), (0.7, 100), (1, 62)], d)
    v = voice(f0, d, [(260, 2.0, 1.0), (620, 3, 0.9), (1150, 4, 0.55), (2400, 5, 0.25)], rough=0.6, growl_hz=24, breath=0.45, sub=0.5, bright=0.55, drive=3.0)
    shape = curve([(0, 0.2), (0.12, 1), (0.6, 0.85), (1, 0.4)], d)
    v *= env(d, 0.12, 1.1, shape)
    # souffle chaud mêlé au cri
    air = bandpass(rng.standard_normal(len(v)), 900, 0.7) * curve([(0, 0), (0.15, 0.5), (0.8, 0.35), (1, 0)], d)
    x = v + 0.25 * air / (np.max(np.abs(air)) + 1e-9)
    # grondement au sol
    rumble = lowpass(rng.standard_normal(len(x)), 70, 4)
    x += 0.6 * rumble / (np.max(np.abs(rumble)) + 1e-9) * curve([(0, 0), (0.1, 1), (0.9, 0.6), (1, 0)], d)
    return cave(x, 2.4, 0.32)


def young_roar():
    """Rugissement du jeune dragon : plus court, plus aigu, encore un peu éraillé."""
    d = 1.6
    f0 = curve([(0, 150), (0.15, 230), (0.5, 240), (1, 140)], d)
    v = voice(f0, d, [(480, 2.5, 1.0), (1100, 4, 0.8), (2300, 5, 0.4)], rough=0.45, growl_hz=32, breath=0.3, sub=0.2, bright=0.7, drive=2.4)
    v *= env(d, 0.08, 0.6, curve([(0, 0.4), (0.15, 1), (1, 0.5)], d))
    return cave(v, 1.6, 0.25)


def grumble():
    """Réveil grognon : un « mmmh » grave et traînant, bouche fermée."""
    d = 1.4
    f0 = curve([(0, 95), (0.3, 110), (0.7, 88), (1, 75)], d)
    v = voice(f0, d, [(180, 2.0, 1.0), (420, 3, 0.5)], rough=0.5, growl_hz=18, breath=0.1, bright=1.0, drive=1.6)
    v = lowpass(v, 900, 2)
    return cave(v * env(d, 0.15, 0.5), 0.9, 0.12)


def fire_breath():
    """Souffle de feu : bruit filtré qui gonfle, crépitements, grondement."""
    d = 2.2
    n = int(d * SR)
    t = t_axis(d)
    noise = rng.standard_normal(n)
    sweep = curve([(0, 300), (0.25, 1800), (0.8, 1400), (1, 600)], d)
    x = np.zeros(n)
    hop = 512
    # filtre passe-bande qui balaie (par blocs)
    zi = None
    for i in range(0, n, hop):
        f = sweep[i]
        b, a = signal.butter(2, [max(80, f * 0.35) / (SR / 2), min(SR / 2 - 200, f * 1.8) / (SR / 2)], 'band')
        if zi is None:
            zi = signal.lfilter_zi(b, a) * 0
        seg, zi = signal.lfilter(b, a, noise[i:i + hop], zi=zi)
        x[i:i + hop] = seg
    x /= np.max(np.abs(x)) + 1e-9
    x *= curve([(0, 0), (0.1, 0.9), (0.75, 1), (1, 0)], d) * (1 + 0.25 * smooth_noise(n, 14))
    crackle = np.zeros(n)
    for _ in range(120):
        i = rng.integers(int(0.1 * n), int(0.9 * n))
        L = rng.integers(40, 300)
        crackle[i:i + L] += rng.standard_normal(min(L, n - i)) * np.exp(-np.arange(min(L, n - i)) / (L / 4)) * rng.uniform(0.3, 1)
    crackle = highpass(crackle, 2000)
    rumble = lowpass(rng.standard_normal(n), 120, 4)
    rumble /= np.max(np.abs(rumble)) + 1e-9
    y = x + 0.35 * crackle / (np.max(np.abs(crackle)) + 1e-9) + 0.5 * rumble * curve([(0, 0), (0.15, 1), (1, 0)], d)
    return cave(np.tanh(1.4 * y), 1.2, 0.18)


def wings():
    """Trois battements d'ailes."""
    out = []
    for k in range(3):
        d = 0.42
        n = int(d * SR)
        nz = lowpass(rng.standard_normal(n), 700 - k * 60, 3)
        e = np.exp(-np.arange(n) / SR / 0.07) * (1 - np.exp(-np.arange(n) / SR / 0.012))
        whoosh = bandpass(rng.standard_normal(n), 1200, 0.8) * np.exp(-np.arange(n) / SR / 0.12) * (1 - np.exp(-np.arange(n) / SR / 0.03)) * 0.25
        out += [nz * e / (np.max(np.abs(nz * e)) + 1e-9) + whoosh]
    return cave(np.concatenate(out), 1.0, 0.15)


if __name__ == '__main__':
    sounds = {
        '1-ronronnement-caresse': purr(),
        '2-petit-cri-content': chirp_happy(),
        '3-cri-bebe-dragon': baby_cry(),
        '4-rugissement-jeune': young_roar(),
        '5-rugissement-legendaire': legendary_roar(),
        '6-reveil-grognon': grumble(),
        '7-souffle-de-feu': fire_breath(),
        '8-battements-ailes': wings(),
    }
    for name, x in sounds.items():
        print(save(name, x), f'{len(x) / SR:.1f}s')

"""Sound design : sons CC0 (OpenGameArt, rubberduck & trazzz123) ralentis / abaissés selon la taille du
dragon, superposés à des couches synthétiques, avec l'écho d'une caverne."""
import os
import sys
import numpy as np
from scipy import signal
from scipy.io import wavfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'sons'))
import synth  # noqa: E402  (couches synthétiques)

SR = 44100
OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True)
rng = np.random.default_rng(3)


def load(name):
    sr, x = wavfile.read(os.path.join(HERE, 'wav', name + '.wav'))
    x = x.astype(float) / 32768
    # retire le silence au début / à la fin
    a = np.abs(x) > 0.01 * np.abs(x).max()
    i0, i1 = np.argmax(a), len(a) - np.argmax(a[::-1])
    return x[i0:i1] / (np.abs(x).max() + 1e-9)


def speed(x, k):
    """k < 1 : plus grave et plus lent (créature plus grande)."""
    n = int(len(x) / k)
    return signal.resample_poly(x, int(1000 / k), 1000)[:n] if k != 1 else x


def fade(x, a=0.01, r=0.12):
    x = x.copy()
    na, nr = int(a * SR), min(len(x) // 2, int(r * SR))
    x[:na] *= np.linspace(0, 1, na)
    x[-nr:] *= np.linspace(1, 0, nr) ** 1.5
    return x


def mix(*layers):
    """layers : (signal, décalage en s, gain)"""
    n = max(int(off * SR) + len(s) for s, off, g in layers)
    out = np.zeros(n)
    for s, off, g in layers:
        i = int(off * SR)
        out[i:i + len(s)] += g * s
    return out


def eq_low(x, f, gain):
    """Renforce les graves sous f."""
    return x + gain * synth.lowpass(x, f, 2)


def cut_high(x, f):
    return synth.lowpass(x, f, 4)


def cave(x, size=1.6, wet=0.28):
    return synth.cave(x, size, wet)


def norm(x, peak=0.9):
    return x / (np.abs(x).max() + 1e-9) * peak


def comp(x, drive=1.6):
    return np.tanh(drive * norm(x)) / np.tanh(drive)


def save(name, x):
    x = norm(x, 0.89)
    fade_n = int(0.008 * SR)
    x[:fade_n] *= np.linspace(0, 1, fade_n)
    x[-fade_n:] *= np.linspace(1, 0, fade_n)
    p = os.path.join(OUT, name + '.wav')
    wavfile.write(p, SR, (x * 32767).astype(np.int16))
    return p


def rumble(dur, f=70, env_pts=((0, 0), (0.1, 1), (0.85, 0.6), (1, 0))):
    r = synth.lowpass(rng.standard_normal(int(dur * SR)), f, 4)
    return norm(r) * synth.curve(list(env_pts), dur)


# ---------------- Rugissements selon le stade ----------------
def roar_legendary():
    big = fade(speed(load('big_monster_roar')[int(0.3 * SR): int(3.6 * SR)], 0.92), 0.02, 1.2)
    head = fade(speed(load('c2_roar_04'), 0.58), 0.01, 0.6)
    grit = fade(speed(load('rpg_creature_roar_02'), 0.62), 0.02, 0.5)
    x = mix((big, 0.0, 1.0), (head, 0.05, 0.75), (grit, 0.12, 0.45), (rumble(len(big) / SR, 60), 0, 0.5))
    return cave(comp(eq_low(cut_high(x, 5000), 180, 0.8), 1.8), 2.0, 0.32)


def roar_adult():
    a = fade(speed(load('c2_roar_05'), 0.7), 0.01, 0.5)
    b = fade(speed(load('c1_roar_02'), 0.72), 0.01, 0.5)
    x = mix((a, 0, 1.0), (b, 0.06, 0.6), (rumble(len(a) / SR, 80), 0, 0.35))
    return cave(comp(eq_low(cut_high(x, 6000), 220, 0.5), 1.6), 2.0, 0.3)


def roar_young():
    a = fade(speed(load('c1_roar_02'), 0.9), 0.01, 0.35)
    b = fade(speed(load('rpg_creature_roar_03'), 0.88), 0.01, 0.4)
    x = mix((a, 0, 1.0), (b, 0.04, 0.55))
    return cave(comp(cut_high(x, 7000), 1.4), 1.5, 0.24)


def cry_baby():
    a = fade(speed(load('c1_cute_09'), 0.95), 0.005, 0.2)
    b = fade(speed(load('c1_howl'), 1.15), 0.01, 0.25)
    x = mix((a, 0, 1.0), (b, 0.08, 0.35))
    return cave(comp(x, 1.3), 0.9, 0.14)


# ---------------- Petits sons ----------------
def happy_chirp():
    a = fade(speed(load('c1_cute_10'), 0.8), 0.005, 0.12)
    b = fade(speed(load('c1_cute_01'), 0.82), 0.005, 0.12)
    return cave(mix((a, 0, 1.0), (b, len(a) / SR + 0.05, 0.9)), 0.8, 0.12)


def purr():
    syn = synth.purr(4.2)
    sn = speed(load('c2_snore_02'), 0.55)
    sn = cut_high(sn, 1200)
    layer = np.zeros(len(syn))
    for off in (0.1, 2.2):
        i = int(off * SR)
        seg = fade(sn, 0.1, 0.4)[: len(layer) - i]
        layer[i:i + len(seg)] += seg
    return norm(syn) + 0.45 * norm(layer)


def grumble():
    a = fade(speed(load('c2_grunt_07'), 0.78), 0.03, 0.4)
    b = fade(speed(load('c1_troll_01'), 0.7), 0.03, 0.3)
    snort = fade(speed(load('c1_nose'), 0.8), 0.005, 0.1)
    x = mix((a, 0, 1.0), (b, 0.15, 0.4), (snort, len(a) / SR + 0.05, 0.5))
    return cave(cut_high(x, 3500), 0.9, 0.12)


def eat():
    parts = []
    for k, name in enumerate(['c1_eat_01', 'c1_eat_02', 'c1_eat_04']):
        parts.append((fade(speed(load(name), 0.72), 0.003, 0.06), k * 0.33, 0.9))
    happy = fade(speed(load('c2_grunt_08'), 0.85), 0.02, 0.25)
    parts.append((happy, 1.05, 0.7))
    return cave(cut_high(mix(*parts), 6000), 0.8, 0.1)


def fire():
    syn = synth.fire_breath()
    f = speed(load('rpg_spell_fire_03'), 0.85)
    inhale = fade(speed(load('c1_breath'), 0.7), 0.05, 0.2)
    x = mix((inhale, 0, 0.6), (norm(syn), 0.35, 0.8), (fade(norm(f), 0.05, 0.6), 0.4, 0.9))
    return comp(x, 1.3)


def attack():
    g = fade(speed(load('c1_monster_06'), 0.75), 0.01, 0.2)
    slash = fade(load('rpg_blade_01'), 0.002, 0.1)
    stomp = fade(speed(load('c2_stomp_01'), 0.8), 0.002, 0.2)
    return cave(mix((g, 0, 1.0), (slash, 0.12, 0.7), (stomp, 0.3, 0.8)), 1.2, 0.18)


def wings():
    return synth.wings()


# ---------------- Interface ----------------
def coins():
    return fade(load('rpg_item_coins_02'), 0.002, 0.15)


def gem():
    a = fade(load('rpg_item_gem_01'), 0.002, 0.1)
    return cave(mix((a, 0, 1.0), (speed(a, 1.5), 0.09, 0.5)), 0.7, 0.2)


def chest():
    creak = fade(speed(load('rpg_item_wood_01'), 0.8), 0.01, 0.15)
    lock = fade(load('rpg_lock_02'), 0.002, 0.1)
    gold = fade(load('rpg_item_coins_04'), 0.01, 0.4)
    spark = fade(load('rpg_spell_01'), 0.01, 0.3)
    return cave(mix((lock, 0, 0.8), (creak, 0.25, 1.0), (gold, 0.6, 0.9), (spark, 0.65, 0.5)), 1.2, 0.2)


def level_up():
    spark = fade(load('rpg_spell_01'), 0.01, 0.3)
    g = fade(speed(load('c1_cute_04'), 0.75), 0.005, 0.15)
    gem_ = fade(load('rpg_item_gem_01'), 0.002, 0.1)
    return cave(mix((spark, 0, 1.0), (gem_, 0.1, 0.6), (g, 0.35, 0.8)), 1.0, 0.2)


def evolution():
    charge = synth.lowpass(rng.standard_normal(int(2.0 * SR)), 300, 2) * np.linspace(0, 1, int(2.0 * SR)) ** 2
    rise = fade(speed(load('rpg_spell_02'), 0.5), 0.3, 0.3)
    boom = rumble(1.2, 50, ((0, 1), (0.1, 0.9), (1, 0)))
    roar = roar_legendary()
    x = mix((norm(charge), 0, 0.5), (rise, 0.6, 0.6), (boom, 1.95, 1.0), (roar, 2.0, 0.9))
    return comp(x, 1.4)


SOUNDS = {
    '01-ronronnement-caresse': purr, '02-petit-cri-content': happy_chirp, '03-cri-bebe': cry_baby,
    '04-rugissement-jeune': roar_young, '05-rugissement-adulte': roar_adult, '06-rugissement-legendaire': roar_legendary,
    '07-reveil-grognon': grumble, '08-souffle-de-feu': fire, '09-manger': eat, '10-attaque': attack, '11-ailes': wings,
    '12-pieces-or': coins, '13-gemme': gem, '14-coffre': chest, '15-niveau': level_up, '16-evolution': evolution
}

if __name__ == '__main__':
    for name, fn in SOUNDS.items():
        x = fn()
        print(name, f'{len(x) / SR:.1f}s', save(name, x))

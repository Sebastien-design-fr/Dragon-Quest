// Génère les animations des dragons illustrés (www/data/animations/<id>@sprite.json).
// Os : body / ground (déplacements à l'échelle adulte), spine, neck1, neck2, head, wing1 (bras de l'aile),
// wing2 (main de l'aile), wingFar, tail1..tail5, legFront, legFrontFar, legRear, legRearFar (pixels de l'image).
// Rotation en degrés, sens horaire à l'écran : neck +  = le cou se penche vers l'avant ; head + = museau vers le bas ;
// wing2 + = pointe de l'aile vers le haut ; wing1 + = poignet vers l'avant ; tail + = la queue remonte.
//   node scripts/build-sprite-clips.mjs
import { writeFileSync } from 'node:fs';

const OUT = new URL('../www/data/animations/', import.meta.url);
const TAU = Math.PI * 2;
const r2 = v => Math.round(v * 1000) / 1000;

/** Piste échantillonnée d'une fonction du temps (boucle : la dernière clé reprend la première). */
function wave(dur, fn, step = 0.2) {
  const keys = [];
  const n = Math.max(2, Math.round(dur / step));
  for (let i = 0; i <= n; i++) { const t = (dur * i) / n; keys.push([r2(t), r2(fn(t)), 'linear']); }
  return keys;
}
/** Somme de pistes : clés ponctuelles + oscillation (pour garder la vie pendant une action). */
function mix(dur, keys, osc, step = 0.1) {
  return wave(dur, t => sample(keys, t) + (osc ? osc(t) : 0), step);
}
function sample(keys, t) {
  if (!keys.length) return 0;
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [t1, v1] = keys[i];
    if (t <= t1) {
      const [t0, v0] = keys[i - 1];
      const u = (t - t0) / (t1 - t0 || 1);
      const e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
      return v0 + (v1 - v0) * e;
    }
  }
  return keys[keys.length - 1][1];
}
const sin = (t, period, phase = 0) => Math.sin((TAU * t) / period + phase);
const TAIL = ['tail1', 'tail2', 'tail3', 'tail4', 'tail5'];

/** Ondulation de queue qui se propage de la base vers la pointe. */
function tailWave(tracks, dur, amp, period, extra = () => 0, step = 0.2) {
  TAIL.forEach((b, i) => {
    tracks[b] = { rot: wave(dur, t => amp * (0.5 + i * 0.25) * sin(t, period, -i * 0.75) + extra(t, i), step) };
  });
}

const clips = {};

// ---------- Repos : respiration, cou qui ondule, ailes qui frémissent, queue vivante ----------
{
  const D = 6, B = 3; // respiration toutes les 3 s
  const t = {
    body: { y: wave(D, t => -1.2 * sin(t, B)), sy: wave(D, t => 1 + 0.006 * sin(t, B)) },
    spine: { sy: wave(D, t => 1 + 0.03 * sin(t, B)), sx: wave(D, t => 1 + 0.008 * sin(t, B)) },
    neck1: { rot: wave(D, t => 2.6 * sin(t, D, 0.4) + 1.0 * sin(t, B, 0.5)) },
    neck2: { rot: wave(D, t => 2.4 * sin(t, D, 1.0)) },
    head: { rot: wave(D, t => -3.2 * sin(t, D, 1.6) + 1.8 * sin(t, B, 1.2)) },
    wing1: { rot: wave(D, t => 2.0 * sin(t, B, 0.3)) },
    wing2: { rot: wave(D, t => 4.5 * sin(t, B, 0.9) + 1.2 * sin(t, D / 4, 0.2)) },
    wingFar: { rot: wave(D, t => 4 * sin(t, B, 1.2)) }
  };
  tailWave(t, D, 4.5, D / 2);
  clips.idle = { duration: D, loop: true, tracks: t };
}

// ---------- Sommeil : couché, tête basse, ailes repliées, respiration lente ----------
{
  const D = 6;
  const t = {
    body: { y: wave(D, t => 7 + 0.8 * sin(t, D)), rot: wave(D, () => 1.2) },
    ground: {},
    spine: { sy: wave(D, t => 1 + 0.04 * sin(t, D)) },
    neck1: { rot: wave(D, t => 16 + 1 * sin(t, D, 0.6)) },
    neck2: { rot: wave(D, t => 16 + 0.8 * sin(t, D, 0.9)) },
    head: { rot: wave(D, t => 14 - 0.8 * sin(t, D, 1.2)) },
    wing1: { rot: wave(D, () => -4) },
    wing2: { rot: wave(D, t => -9 + 1 * sin(t, D, 0.5)) },
    wingFar: { rot: wave(D, () => -6) }
  };
  tailWave(t, D, 1.0, D, (_, i) => 3 + i * 1.5);
  clips.sleep = {
    duration: D, loop: true, tracks: t,
    events: [{ t: 1.0, type: 'emit', preset: 'sleepZ', anchor: 'head_anchor' }, { t: 4.0, type: 'emit', preset: 'sleepZ', anchor: 'head_anchor' }]
  };
}

// ---------- Joie : deux bonds, ailes qui battent, queue qui fouette ----------
{
  const D = 2.0;
  const hop = [[0, 0], [0.18, 4], [0.45, -22], [0.72, 0], [0.86, 3], [1.12, -14], [1.38, 0], [2.0, 0]];
  const t = {
    body: { y: mix(D, hop), sy: mix(D, [[0, 1], [0.18, 0.95], [0.45, 1.04], [0.72, 0.96], [0.86, 1], [1.12, 1.03], [1.38, 0.98], [1.6, 1]]) },
    ground: { y: mix(D, hop.map(([a, v]) => [a, Math.min(0, v + 4)])) },
    neck1: { rot: mix(D, [[0, 0], [0.45, -6], [0.8, 2], [1.12, -5], [1.5, 0]]) },
    head: { rot: mix(D, [[0, 0], [0.45, -10], [0.8, 3], [1.12, -8], [1.6, 0]]) },
    wing1: { rot: mix(D, [[0, 0], [0.3, -4], [0.6, 3], [1.0, -4], [1.4, 2], [1.8, 0]]) },
    wing2: { rot: mix(D, [[0, 0], [0.25, 16], [0.5, -8], [0.75, 14], [1.0, -6], [1.25, 12], [1.5, -3], [1.8, 0]]) },
    wingFar: { rot: mix(D, [[0, 0], [0.25, 10], [0.5, -5], [0.75, 9], [1.0, -4], [1.4, 0]]) }
  };
  tailWave(t, D, 7, 0.6, t2 => (t2 < 1.6 ? 4 : 4 * (D - t2) / 0.4), 0.05);
  clips.happy = {
    duration: D, loop: false, tracks: t,
    events: [{ t: 0.45, type: 'emit', preset: 'happySparkle', anchor: 'head_anchor' }, { t: 1.12, type: 'emit', preset: 'happySparkle', anchor: 'head_anchor' }]
  };
}

// ---------- Manger : la tête plonge, mâche, se redresse satisfaite ----------
{
  const D = 2.4;
  const chew = t => (t > 0.45 && t < 1.5 ? 4 * Math.sin((t - 0.45) * TAU * 3.2) : 0);
  const t = {
    body: { rot: mix(D, [[0, 0], [0.4, 2], [1.5, 2], [1.9, 0]]) },
    neck1: { rot: mix(D, [[0, 0], [0.4, 14], [1.5, 14], [1.9, -3], [2.4, 0]]) },
    neck2: { rot: mix(D, [[0, 0], [0.4, 12], [1.5, 12], [1.9, -2], [2.4, 0]]) },
    head: { rot: mix(D, [[0, 0], [0.4, 18], [1.5, 18], [1.9, -8], [2.4, 0]], chew, 0.05) },
    wing2: { rot: mix(D, [[0, 0], [1.6, 0], [1.9, 8], [2.2, 0]]) }
  };
  tailWave(t, D, 4, 0.9, () => 0, 0.1);
  clips.eat = {
    duration: D, loop: false, tracks: t,
    events: [{ t: 0.6, type: 'emit', preset: 'crumbs', anchor: 'mouth_anchor' }, { t: 1.1, type: 'emit', preset: 'crumbs', anchor: 'mouth_anchor' },
      { t: 1.9, type: 'emit', preset: 'happySparkle', anchor: 'head_anchor' }]
  };
}

// ---------- Attaque : il se ramasse, patte levée, bond en avant et coup de griffe ----------
{
  const D = 1.5;
  const t = {
    body: { x: mix(D, [[0, 0], [0.4, -10], [0.62, 22], [1.1, 0]]), y: mix(D, [[0, 0], [0.4, 4], [0.62, -3], [1.1, 0]]),
      rot: mix(D, [[0, 0], [0.4, -3], [0.62, 3], [1.1, 0]]) },
    ground: { x: mix(D, [[0, 0], [0.5, 0], [0.66, 14], [1.2, 0]]) },
    neck1: { rot: mix(D, [[0, 0], [0.4, -8], [0.62, 12], [1.2, 0]]) },
    neck2: { rot: mix(D, [[0, 0], [0.4, -6], [0.62, 8], [1.2, 0]]) },
    head: { rot: mix(D, [[0, 0], [0.4, -6], [0.62, 4], [1.2, 0]]) },
    wing1: { rot: mix(D, [[0, 0], [0.4, -6], [0.62, 6], [1.2, 0]]) },
    wing2: { rot: mix(D, [[0, 0], [0.4, 18], [0.62, -6], [1.2, 0]]) },
    wingFar: { rot: mix(D, [[0, 0], [0.4, 12], [0.62, -4], [1.2, 0]]) },
    legFront: { x: mix(D, [[0, 0], [0.4, -20], [0.62, 90], [1.05, 0]]), y: mix(D, [[0, 0], [0.4, -120], [0.62, -40], [1.05, 0]]),
      rot: mix(D, [[0, 0], [0.4, -18], [0.62, 22], [1.05, 0]]) }
  };
  tailWave(t, D, 6, 0.7, (tt) => (tt < 0.62 ? 6 : 0), 0.05);
  clips.attack = {
    duration: D, loop: false, tracks: t,
    events: [{ t: 0.62, type: 'shake', value: 8 }, { t: 0.62, type: 'emit', preset: 'clawSlash', anchor: 'front_leg_anchor' }]
  };
}

// ---------- Feu : il inspire (cou en arrière), puis crache en tendant le cou ----------
{
  const D = 2.8;
  const t = {
    body: { x: mix(D, [[0, 0], [0.6, -7], [0.85, 5], [2.1, 4], [2.8, 0]]), rot: mix(D, [[0, 0], [0.6, -2.5], [0.85, 1], [2.2, 1], [2.8, 0]]) },
    spine: { sy: mix(D, [[0, 1], [0.6, 1.07], [0.85, 0.97], [2.1, 0.98], [2.6, 1]]) },
    neck1: { rot: mix(D, [[0, 0], [0.6, -14], [0.85, 12], [2.1, 10], [2.7, 0]]) },
    neck2: { rot: mix(D, [[0, 0], [0.6, -10], [0.85, 8], [2.1, 7], [2.7, 0]]) },
    head: { rot: mix(D, [[0, 0], [0.6, -14], [0.85, -2], [2.1, -1], [2.7, 0]], t2 => (t2 > 0.85 && t2 < 2.1 ? 1.2 * Math.sin(t2 * 30) : 0), 0.05) },
    wing1: { rot: mix(D, [[0, 0], [0.6, -6], [0.85, 2], [2.1, 2], [2.7, 0]]) },
    wing2: { rot: mix(D, [[0, 0], [0.6, 20], [0.85, 6], [2.1, 8], [2.7, 0]]) },
    wingFar: { rot: mix(D, [[0, 0], [0.6, 12], [0.85, 4], [2.1, 4], [2.7, 0]]) }
  };
  tailWave(t, D, 4, 0.8, (tt) => (tt > 0.6 && tt < 2.2 ? 5 : 0), 0.05);
  clips.fire = {
    duration: D, loop: false, tracks: t,
    events: [{ t: 0.85, type: 'emit', preset: 'fireBreath', anchor: 'mouth_anchor', value: 1.2 }, { t: 0.85, type: 'shake', value: 3 }]
  };
}

// ---------- Niveau : il se ramasse, bondit ailes déployées, rugit vers le ciel ----------
{
  const D = 2.0;
  const t = {
    body: { y: mix(D, [[0, 0], [0.3, 7], [0.65, -30], [1.05, 0], [1.3, 0]]), sy: mix(D, [[0, 1], [0.3, 0.93], [0.65, 1.05], [1.05, 0.97], [1.3, 1]]) },
    ground: { y: mix(D, [[0, 0], [0.35, 0], [0.65, -24], [1.0, 0]]) },
    neck1: { rot: mix(D, [[0, 0], [0.3, 6], [0.65, -10], [1.3, -6], [1.9, 0]]) },
    neck2: { rot: mix(D, [[0, 0], [0.3, 4], [0.65, -8], [1.3, -6], [1.9, 0]]) },
    head: { rot: mix(D, [[0, 0], [0.3, 8], [0.65, -16], [1.3, -14], [1.9, 0]]) },
    wing1: { rot: mix(D, [[0, 0], [0.3, -5], [0.65, -9], [1.3, -7], [1.9, 0]]) },
    wing2: { rot: mix(D, [[0, 0], [0.3, -8], [0.65, 22], [0.9, 10], [1.1, 20], [1.4, 14], [1.9, 0]]) },
    wingFar: { rot: mix(D, [[0, 0], [0.3, -5], [0.65, 14], [1.4, 10], [1.9, 0]]) }
  };
  tailWave(t, D, 5, 0.8, (tt) => (tt > 0.5 && tt < 1.5 ? 6 : 0), 0.05);
  clips.level_up = {
    duration: D, loop: false, tracks: t,
    events: [{ t: 0.65, type: 'emit', preset: 'levelUpBurst', anchor: 'body_center' }, { t: 0.65, type: 'flash', value: 0.35 }]
  };
}

// ---------- Évolution : il se recroqueville, l'énergie monte, puis éclate ailes grandes ouvertes ----------
{
  const D = 3.6;
  const tremble = tt => (tt > 0.4 && tt < 1.7 ? 0.8 * Math.sin(tt * 55) : 0);
  const t = {
    body: { y: mix(D, [[0, 0], [1.0, 8], [1.7, 8], [1.95, -34], [2.7, 0]], tremble, 0.04),
      sy: mix(D, [[0, 1], [1.7, 0.88], [1.95, 1.08], [2.5, 1]]), sx: mix(D, [[0, 1], [1.7, 1.04], [1.95, 0.97], [2.5, 1]]) },
    ground: { y: mix(D, [[0, 0], [1.75, 0], [1.95, -26], [2.6, 0]]) },
    neck1: { rot: mix(D, [[0, 0], [1.0, 14], [1.7, 16], [1.95, -12], [2.8, -6], [3.5, 0]]) },
    neck2: { rot: mix(D, [[0, 0], [1.0, 12], [1.7, 14], [1.95, -8], [2.8, -5], [3.5, 0]]) },
    head: { rot: mix(D, [[0, 0], [1.0, 16], [1.7, 18], [1.95, -18], [2.8, -12], [3.5, 0]]) },
    wing1: { rot: mix(D, [[0, 0], [1.0, -5], [1.7, -6], [1.95, -10], [2.8, -6], [3.5, 0]]) },
    wing2: { rot: mix(D, [[0, 0], [1.0, -10], [1.7, -12], [1.95, 24], [2.3, 12], [2.6, 22], [3.0, 14], [3.5, 0]]) },
    wingFar: { rot: mix(D, [[0, 0], [1.0, -6], [1.7, -8], [1.95, 16], [3.0, 8], [3.5, 0]]) }
  };
  tailWave(t, D, 4, 0.9, (tt, i) => (tt < 1.7 ? 5 + i : tt < 2.8 ? -2 : 0), 0.05);
  clips.evolution = {
    duration: D, loop: false, tracks: t,
    events: [{ t: 0.1, type: 'emit', preset: 'evolutionCharge', anchor: 'body_center', value: 1.6 }, { t: 1.8, type: 'flash', value: 1 },
      { t: 1.85, type: 'swapStage' }, { t: 1.95, type: 'emit', preset: 'evolutionBurst', anchor: 'body_center' }, { t: 1.95, type: 'shake', value: 12 }]
  };
}


// ---------- Caresse : il penche la tête vers la main, ferme à moitié les yeux, la queue frétille ----------
{
  const D = 1.6;
  const t = {
    body: { y: mix(D, [[0, 0], [0.4, 2], [1.2, 2], [1.6, 0]]), rot: mix(D, [[0, 0], [0.4, 1.2], [1.2, 1.2], [1.6, 0]]) },
    neck1: { rot: mix(D, [[0, 0], [0.4, 8], [1.2, 8], [1.6, 0]]) },
    neck2: { rot: mix(D, [[0, 0], [0.4, 6], [1.2, 6], [1.6, 0]]) },
    head: { rot: mix(D, [[0, 0], [0.4, 10], [1.2, 10], [1.6, 0]], t2 => (t2 > 0.4 && t2 < 1.2 ? 2.5 * Math.sin((t2 - 0.4) * 14) : 0), 0.05) },
    wing2: { rot: mix(D, [[0, 0], [0.5, 5], [1.2, 3], [1.6, 0]]) }
  };
  tailWave(t, D, 8, 0.45, () => 3, 0.05);
  clips.pet = { duration: D, loop: false, tracks: t, events: [{ t: 0.4, type: 'emit', preset: 'hearts', anchor: 'head_anchor' }] };
}

// ---------- Triste (boucle) : tête basse, ailes tombantes, queue au sol ----------
{
  const D = 7;
  const t = {
    body: { y: wave(D, t => 3 + 0.8 * sin(t, 3.5)) },
    spine: { sy: wave(D, t => 1 + 0.02 * sin(t, 3.5)) },
    neck1: { rot: wave(D, t => 12 + 1.5 * sin(t, D, 0.3)) },
    neck2: { rot: wave(D, t => 9 + 1.2 * sin(t, D, 0.8)) },
    head: { rot: wave(D, t => 12 + 1.5 * sin(t, D, 1.3)) },
    wing1: { rot: wave(D, () => -3) },
    wing2: { rot: wave(D, t => -7 + 1.2 * sin(t, 3.5, 0.6)) },
    wingFar: { rot: wave(D, () => -4) }
  };
  tailWave(t, D, 1.4, D, (_, i) => 2 + i);
  clips.sad = { duration: D, loop: true, tracks: t };
}

// ---------- Révérence ----------
{
  const D = 2.4;
  const t = {
    body: { rot: mix(D, [[0, 0], [0.6, 3], [1.5, 3], [2.1, 0]]), y: mix(D, [[0, 0], [0.6, 4], [1.5, 4], [2.1, 0]]) },
    neck1: { rot: mix(D, [[0, 0], [0.6, 22], [1.5, 22], [2.1, -3], [2.4, 0]]) },
    neck2: { rot: mix(D, [[0, 0], [0.6, 16], [1.5, 16], [2.1, -2], [2.4, 0]]) },
    head: { rot: mix(D, [[0, 0], [0.6, 20], [1.5, 20], [2.1, -6], [2.4, 0]]) },
    wing1: { rot: mix(D, [[0, 0], [0.6, 6], [1.5, 6], [2.1, 0]]) },
    wing2: { rot: mix(D, [[0, 0], [0.6, -14], [1.5, -14], [2.1, 4], [2.4, 0]]) },
    legFront: { x: mix(D, [[0, 0], [0.6, 40], [1.5, 40], [2.1, 0]]), y: mix(D, [[0, 0], [0.3, -40], [0.6, 0], [1.5, 0], [1.8, -30], [2.1, 0]]) }
  };
  tailWave(t, D, 3, 1.2);
  clips.bow = { duration: D, loop: false, tracks: t, events: [{ t: 2.1, type: 'emit', preset: 'happySparkle', anchor: 'head_anchor' }] };
}

// ---------- Danse : balancement, ailes en rythme, petits sauts ----------
{
  const D = 3.2, beat = 0.8;
  const t = {
    body: { x: wave(D, t => 4 * sin(t, beat * 2), 0.05), y: wave(D, t => -6 * Math.abs(sin(t, beat * 2)), 0.05), rot: wave(D, t => 3 * sin(t, beat * 2), 0.05) },
    ground: { y: wave(D, t => -4 * Math.max(0, sin(t, beat * 2, Math.PI / 2)), 0.05) },
    neck1: { rot: wave(D, t => -6 * sin(t, beat * 2, 0.5), 0.05) },
    neck2: { rot: wave(D, t => -4 * sin(t, beat * 2, 0.8), 0.05) },
    head: { rot: wave(D, t => 8 * sin(t, beat, 0.3), 0.05) },
    wing1: { rot: wave(D, t => 5 * sin(t, beat, 0.2), 0.05) },
    wing2: { rot: wave(D, t => 16 * sin(t, beat, 0.6), 0.05) },
    wingFar: { rot: wave(D, t => 10 * sin(t, beat, 0.9), 0.05) },
    legFront: { y: wave(D, t => -30 * Math.max(0, sin(t, beat * 2)), 0.05) },
    legRear: { y: wave(D, t => -26 * Math.max(0, -sin(t, beat * 2)), 0.05) }
  };
  tailWave(t, D, 10, beat * 2, () => 0, 0.05);
  clips.dance = { duration: D, loop: false, tracks: t, events: [0.4, 1.2, 2.0, 2.8].map(tt => ({ t: tt, type: 'emit', preset: 'happySparkle', anchor: 'head_anchor' })) };
}

// ---------- Anneau de feu : tête vers le ciel, anneau de flammes ----------
{
  const D = 2.6;
  const t = {
    body: { y: mix(D, [[0, 0], [0.5, 4], [0.9, -4], [2.0, 0]]) },
    spine: { sy: mix(D, [[0, 1], [0.6, 1.07], [0.9, 0.97], [1.6, 1]]) },
    neck1: { rot: mix(D, [[0, 0], [0.6, -10], [0.9, -16], [1.8, -12], [2.5, 0]]) },
    neck2: { rot: mix(D, [[0, 0], [0.6, -8], [0.9, -12], [1.8, -10], [2.5, 0]]) },
    head: { rot: mix(D, [[0, 0], [0.6, -20], [0.9, -34], [1.8, -28], [2.5, 0]]) },
    wing2: { rot: mix(D, [[0, 0], [0.6, 10], [0.9, 18], [1.8, 10], [2.5, 0]]) }
  };
  tailWave(t, D, 4, 0.8);
  clips.ring = { duration: D, loop: false, tracks: t,
    events: [{ t: 0.95, type: 'emit', preset: 'fireRing', anchor: 'mouth_anchor' }, { t: 1.25, type: 'emit', preset: 'fireRing', anchor: 'mouth_anchor' }, { t: 0.95, type: 'shake', value: 2 }] };
}

// ---------- Rugissement : il se dresse, ailes grandes ouvertes, tête au ciel ----------
{
  const D = 2.8;
  const roar = t2 => (t2 > 0.8 && t2 < 2.0 ? 1.5 * Math.sin(t2 * 40) : 0);
  const t = {
    body: { rot: mix(D, [[0, 0], [0.7, -6], [2.0, -6], [2.6, 0]]), y: mix(D, [[0, 0], [0.7, -6], [2.0, -6], [2.6, 0]]) },
    spine: { sy: mix(D, [[0, 1], [0.7, 1.06], [2.0, 1.04], [2.6, 1]]) },
    neck1: { rot: mix(D, [[0, 0], [0.7, -12], [2.0, -12], [2.6, 0]]) },
    neck2: { rot: mix(D, [[0, 0], [0.7, -10], [2.0, -10], [2.6, 0]]) },
    head: { rot: mix(D, [[0, 0], [0.7, -26], [2.0, -24], [2.6, 0]], roar, 0.04) },
    wing1: { rot: mix(D, [[0, 0], [0.7, -10], [2.0, -10], [2.6, 0]]) },
    wing2: { rot: mix(D, [[0, 0], [0.7, 26], [2.0, 24], [2.6, 0]]) },
    wingFar: { rot: mix(D, [[0, 0], [0.7, 18], [2.0, 16], [2.6, 0]]) }
  };
  tailWave(t, D, 5, 0.6, (tt) => (tt > 0.6 && tt < 2.1 ? 8 : 0), 0.05);
  clips.roar = { duration: D, loop: false, tracks: t, events: [{ t: 0.85, type: 'shake', value: 10 }, { t: 0.85, type: 'flash', value: 0.15 }] };
}

// ---------- Vol sur place : il bat des ailes et décolle un instant ----------
{
  const D = 3.4, flap = 0.42;
  const lift = [[0, 0], [0.4, 6], [0.8, -40], [2.6, -46], [3.2, 0]];
  const t = {
    body: { y: mix(D, lift, t2 => (t2 > 0.7 && t2 < 2.8 ? 4 * sin(t2, flap) : 0), 0.04), rot: mix(D, [[0, 0], [0.8, -3], [2.6, -3], [3.2, 0]]) },
    ground: { y: mix(D, lift.map(([a, v]) => [a, Math.min(0, v + 6)]), t2 => (t2 > 0.7 && t2 < 2.8 ? 4 * sin(t2, flap) : 0), 0.04) },
    neck1: { rot: mix(D, [[0, 0], [0.8, -6], [2.6, -6], [3.2, 0]]) },
    head: { rot: mix(D, [[0, 0], [0.8, -6], [2.6, -6], [3.2, 0]]) },
    wing1: { rot: wave(D, t2 => (t2 > 0.3 && t2 < 3.0 ? 6 * sin(t2, flap, Math.PI) : 0), 0.04) },
    wing2: { rot: wave(D, t2 => (t2 > 0.3 && t2 < 3.0 ? 26 * sin(t2, flap) : 0), 0.04) },
    wingFar: { rot: wave(D, t2 => (t2 > 0.3 && t2 < 3.0 ? 18 * sin(t2, flap, 0.3) : 0), 0.04) },
    legFront: { rot: mix(D, [[0, 0], [0.8, 10], [2.6, 10], [3.2, 0]]) },
    legRear: { rot: mix(D, [[0, 0], [0.8, -10], [2.6, -10], [3.2, 0]]) }
  };
  tailWave(t, D, 6, 0.8, (tt) => (tt > 0.8 && tt < 2.6 ? -4 : 0), 0.05);
  clips.hover = { duration: D, loop: false, tracks: t, events: [{ t: 3.2, type: 'emit', preset: 'dust', anchor: 'front_leg_anchor' }, { t: 3.2, type: 'emit', preset: 'dust', anchor: 'rear_leg_anchor' }] };
}

// ---------- Réveil grognon ----------
{
  const D = 1.6;
  const t = {
    body: { y: mix(D, [[0, 7], [0.5, 2], [1.6, 0]]) },
    neck1: { rot: mix(D, [[0, 16], [0.6, 4], [1.6, 0]]) },
    neck2: { rot: mix(D, [[0, 16], [0.6, 4], [1.6, 0]]) },
    head: { rot: mix(D, [[0, 14], [0.6, -4], [0.9, 3], [1.2, -3], [1.6, 0]]) },
    wing2: { rot: mix(D, [[0, -9], [0.6, 6], [1.0, -3], [1.6, 0]]) }
  };
  clips.wake = { duration: D, loop: false, tracks: t };
}

// ---------- Fête des retrouvailles ----------
{
  const base = clips.happy;
  clips.welcome = { ...base, duration: base.duration, events: [{ t: 0.3, type: 'emit', preset: 'hearts', anchor: 'head_anchor' }, { t: 1.0, type: 'emit', preset: 'hearts', anchor: 'head_anchor' }] };
}

// ---------- Il s'ébroue (lavage fini) ----------
{
  const D = 1.2;
  const shakeF = t2 => (t2 < 0.9 ? 5 * Math.sin(t2 * 34) * (1 - t2 / 0.9) : 0);
  const t = {
    body: { rot: wave(D, t2 => shakeF(t2) * 0.5, 0.03) },
    neck1: { rot: wave(D, shakeF, 0.03) },
    head: { rot: wave(D, t2 => -shakeF(t2), 0.03) },
    wing2: { rot: wave(D, t2 => shakeF(t2) * 2, 0.03) }
  };
  tailWave(t, D, 6, 0.3, () => 0, 0.03);
  clips.shake = { duration: D, loop: false, tracks: t, events: [{ t: 0.1, type: 'emit', preset: 'bubbles', anchor: 'body_center' }, { t: 0.5, type: 'emit', preset: 'shine', anchor: 'body_center' }] };
}


// ================= Comportements au repos (joués au hasard) =================
// S'étirer : il allonge les pattes avant, creuse le dos, tend le cou, puis se secoue un peu.
{
  const D = 2.6;
  const t = {
    body: { y: mix(D, [[0, 0], [0.7, 6], [1.6, 6], [2.2, 0]]), rot: mix(D, [[0, 0], [0.7, 4], [1.6, 4], [2.2, 0]]) },
    spine: { sy: mix(D, [[0, 1], [0.7, 0.94], [1.6, 0.94], [2.2, 1]]) },
    neck1: { rot: mix(D, [[0, 0], [0.7, 14], [1.6, 14], [2.2, -2], [2.6, 0]]) },
    neck2: { rot: mix(D, [[0, 0], [0.7, 8], [1.6, 8], [2.2, 0]]) },
    head: { rot: mix(D, [[0, 0], [0.7, -6], [1.6, -6], [2.2, 0]]) },
    legFront: { x: mix(D, [[0, 0], [0.7, 45], [1.6, 45], [2.2, 0]]), rot: mix(D, [[0, 0], [0.7, 14], [1.6, 14], [2.2, 0]]) },
    wing1: { rot: mix(D, [[0, 0], [0.8, -5], [1.6, -5], [2.2, 0]]) },
    wing2: { rot: mix(D, [[0, 0], [0.8, 14], [1.4, 18], [1.8, 6], [2.2, 0]]) },
    wingFar: { rot: mix(D, [[0, 0], [0.8, 10], [1.6, 10], [2.2, 0]]) }
  };
  tailWave(t, D, 4, 1.3, (tt, i) => (tt > 0.7 && tt < 1.6 ? 4 + i : 0), 0.05);
  clips.stretch = { duration: D, loop: false, tracks: t };
}
// Bâiller : tête vers le ciel, cou en arrière, petit tremblement, puis il se détend.
{
  const D = 2.4;
  const tr = tt => (tt > 0.6 && tt < 1.5 ? 1.2 * Math.sin(tt * 38) : 0);
  const t = {
    body: { y: mix(D, [[0, 0], [0.6, -2], [1.5, -2], [2.0, 2], [2.4, 0]]) },
    spine: { sy: mix(D, [[0, 1], [0.6, 1.06], [1.5, 1.06], [2.0, 0.98], [2.4, 1]]) },
    neck1: { rot: mix(D, [[0, 0], [0.6, -10], [1.5, -10], [2.0, 4], [2.4, 0]]) },
    neck2: { rot: mix(D, [[0, 0], [0.6, -8], [1.5, -8], [2.0, 3], [2.4, 0]]) },
    head: { rot: mix(D, [[0, 0], [0.6, -24], [1.5, -24], [2.0, 6], [2.4, 0]], tr, 0.04) },
    wing2: { rot: mix(D, [[0, 0], [0.6, 6], [1.5, 6], [2.0, -2], [2.4, 0]]) }
  };
  tailWave(t, D, 2, 1.2);
  clips.yawn = { duration: D, loop: false, tracks: t };
}
// Se gratter : la patte arrière s'agite, la tête se penche.
{
  const D = 2.0;
  const sc = tt => (tt > 0.4 && tt < 1.6 ? 14 * Math.sin((tt - 0.4) * 30) : 0);
  const t = {
    body: { rot: mix(D, [[0, 0], [0.4, 3], [1.6, 3], [2.0, 0]]), y: mix(D, [[0, 0], [0.4, 3], [1.6, 3], [2.0, 0]]) },
    legRear: { y: mix(D, [[0, 0], [0.4, -55], [1.6, -55], [2.0, 0]]), x: mix(D, [[0, 0], [0.4, 40], [1.6, 40], [2.0, 0]]), rot: mix(D, [[0, 0], [0.4, -20], [1.6, -20], [2.0, 0]], sc, 0.03) },
    neck1: { rot: mix(D, [[0, 0], [0.4, 8], [1.6, 8], [2.0, 0]]) },
    head: { rot: mix(D, [[0, 0], [0.4, 10], [1.6, 10], [2.0, 0]], tt => sc(tt) * 0.15, 0.03) }
  };
  tailWave(t, D, 3, 0.8);
  clips.scratch = { duration: D, loop: false, tracks: t };
}
// Regarder autour : la tête se lève, s'abaisse, observe.
{
  const D = 3.2;
  const t = {
    neck1: { rot: mix(D, [[0, 0], [0.6, -8], [1.4, -8], [2.0, 8], [2.6, 8], [3.2, 0]]) },
    neck2: { rot: mix(D, [[0, 0], [0.6, -6], [1.4, -6], [2.0, 6], [2.6, 6], [3.2, 0]]) },
    head: { rot: mix(D, [[0, 0], [0.6, -14], [1.4, -10], [2.0, 12], [2.6, 10], [3.2, 0]]) },
    wing2: { rot: mix(D, [[0, 0], [0.6, 3], [2.6, 3], [3.2, 0]]) }
  };
  tailWave(t, D, 2.5, 1.6);
  clips.look_around = { duration: D, loop: false, tracks: t };
}
// Renifler le sol : museau au sol, petits coups de tête.
{
  const D = 2.4;
  const sn = tt => (tt > 0.6 && tt < 1.8 ? 3 * Math.sin(tt * 26) : 0);
  const t = {
    body: { rot: mix(D, [[0, 0], [0.6, 3], [1.8, 3], [2.4, 0]]) },
    neck1: { rot: mix(D, [[0, 0], [0.6, 22], [1.8, 22], [2.4, 0]]) },
    neck2: { rot: mix(D, [[0, 0], [0.6, 16], [1.8, 16], [2.4, 0]]) },
    head: { rot: mix(D, [[0, 0], [0.6, 22], [1.8, 22], [2.4, 0]], sn, 0.03) }
  };
  tailWave(t, D, 3, 0.9);
  clips.sniff = { duration: D, loop: false, tracks: t };
}
// Coup de queue : la queue fouette l'air.
{
  const D = 1.6;
  const t = {
    body: { rot: wave(D, tt => 1.2 * Math.sin(tt * 8) * Math.max(0, 1 - tt / D), 0.04) },
    wing2: { rot: wave(D, tt => 3 * Math.sin(tt * 8) * Math.max(0, 1 - tt / D), 0.04) }
  };
  tailWave(t, D, 14, 0.55, (tt) => 0, 0.03);
  clips.tail_swish = { duration: D, loop: false, tracks: t };
}

// ================= Clips pour les poses peintes =================
// Couché (image « couché ») : seulement la respiration et un frémissement de queue.
{
  const D = 6;
  const t = {
    body: { sy: wave(D, tt => 1 + 0.012 * sin(tt, 3)) },
    spine: { sy: wave(D, tt => 1 + 0.035 * sin(tt, 3)) },
    head: { rot: wave(D, tt => 0.8 * sin(tt, D, 0.4)) }
  };
  tailWave(t, D, 0.8, D);
  clips.sleep_pose = { duration: D, loop: true, tracks: t, events: [{ t: 1.0, type: 'emit', preset: 'sleepZ', anchor: 'head_anchor' }, { t: 4.0, type: 'emit', preset: 'sleepZ', anchor: 'head_anchor' }] };
}
// En vol (images « ailes hautes / basses ») : le corps monte et descend au rythme des battements.
{
  const D = 3.4;
  const lift = [[0, 0], [0.4, 6], [0.8, -40], [2.6, -46], [3.2, 0]];
  const bob = t2 => (t2 > 0.7 && t2 < 2.8 ? 5 * sin(t2, 0.5) : 0);
  const t = {
    body: { y: mix(D, lift, bob, 0.03), rot: mix(D, [[0, 0], [0.8, -2], [2.6, -2], [3.2, 0]]) },
    ground: { y: mix(D, lift.map(([a, v]) => [a, Math.min(0, v + 6)]), bob, 0.03) },
    neck1: { rot: wave(D, t2 => 2 * sin(t2, 0.5, 0.6), 0.04) },
    head: { rot: wave(D, t2 => -2 * sin(t2, 0.5, 0.9), 0.04) }
  };
  tailWave(t, D, 6, 0.9, () => 0, 0.05);
  clips.fly_pose = { duration: D, loop: false, tracks: t, events: [{ t: 3.2, type: 'emit', preset: 'dust', anchor: 'front_leg_anchor' }] };
}


// ================= Interactions au toucher =================
// Attraper au vol : il suit la nourriture des yeux, tend le cou vers le haut et happe.
{
  const D = 0.7;
  const t = {
    body: { y: mix(D, [[0, 0], [0.15, 3], [0.35, -8], [0.7, 0]]) },
    ground: { y: mix(D, [[0, 0], [0.35, -2], [0.7, 0]]) },
    neck1: { rot: mix(D, [[0, 0], [0.2, -10], [0.38, 4], [0.7, 0]]) },
    neck2: { rot: mix(D, [[0, 0], [0.2, -8], [0.38, 3], [0.7, 0]]) },
    head: { rot: mix(D, [[0, 0], [0.2, -16], [0.36, 6], [0.7, 0]]) },
    wing2: { rot: mix(D, [[0, 0], [0.3, 10], [0.7, 0]]) }
  };
  tailWave(t, D, 6, 0.35, () => 0, 0.05);
  clips.catch = { duration: D, loop: false, tracks: t };
}
// Chatouilles : il se tortille, la tête rejetée en arrière, petits soubresauts de rire.
{
  const D = 1.8;
  const giggle = t2 => (t2 < 1.5 ? Math.sin(t2 * 30) * (1 - t2 / 1.5) : 0);
  const t = {
    body: { y: mix(D, [[0, 0], [0.2, 3], [1.5, 2], [1.8, 0]], t2 => 2.2 * giggle(t2), 0.03), rot: wave(D, t2 => 1.5 * giggle(t2), 0.03) },
    spine: { sy: wave(D, t2 => 1 + 0.03 * giggle(t2), 0.03) },
    neck1: { rot: mix(D, [[0, 0], [0.2, -8], [1.4, -6], [1.8, 0]], t2 => 3 * giggle(t2), 0.03) },
    head: { rot: mix(D, [[0, 0], [0.2, -14], [1.4, -10], [1.8, 0]], t2 => -4 * giggle(t2), 0.03) },
    wing2: { rot: mix(D, [[0, 0], [0.3, 12], [1.4, 8], [1.8, 0]], t2 => 5 * giggle(t2), 0.03) },
    legFront: { rot: wave(D, t2 => 4 * giggle(t2), 0.03) }
  };
  tailWave(t, D, 12, 0.3, () => 5, 0.03);
  clips.giggle = { duration: D, loop: false, tracks: t, events: [{ t: 0.3, type: 'emit', preset: 'happySparkle', anchor: 'head_anchor' }, { t: 0.9, type: 'emit', preset: 'happySparkle', anchor: 'head_anchor' }] };
}
// Il court après sa queue : il se ramasse, bondit en tournant la tête vers l'arrière, la queue s'enroule.
{
  const D = 2.4;
  const hop = [[0, 0], [0.25, 4], [0.5, -16], [0.8, 0], [1.1, 4], [1.35, -14], [1.65, 0], [2.4, 0]];
  const t = {
    body: { y: mix(D, hop), rot: mix(D, [[0, 0], [0.5, -4], [0.8, 3], [1.35, -4], [1.65, 2], [2.4, 0]]) },
    ground: { y: mix(D, hop.map(([a, v]) => [a, Math.min(0, v + 4)])) },
    neck1: { rot: mix(D, [[0, 0], [0.4, -18], [0.9, -18], [1.2, -14], [1.7, -16], [2.4, 0]]) },
    neck2: { rot: mix(D, [[0, 0], [0.4, -14], [1.7, -12], [2.4, 0]]) },
    head: { rot: mix(D, [[0, 0], [0.4, 12], [1.7, 10], [2.4, 0]]) },
    wing2: { rot: mix(D, [[0, 0], [0.5, 14], [0.8, -4], [1.35, 12], [1.65, -3], [2.2, 0]]) }
  };
  tailWave(t, D, 16, 0.4, (tt, i) => (tt < 2 ? 6 + i * 2 : 0), 0.04);
  clips.tail_chase = { duration: D, loop: false, tracks: t, events: [{ t: 0.8, type: 'emit', preset: 'dust', anchor: 'rear_leg_anchor' }, { t: 1.65, type: 'emit', preset: 'dust', anchor: 'front_leg_anchor' }] };
}
// Ronronnement : yeux mi-clos, tête qui se frotte contre la main, vibration douce.
{
  const D = 2.0;
  const t = {
    body: { y: wave(D, t2 => 1.5 + 0.6 * Math.sin(t2 * 40), 0.025) },
    neck1: { rot: mix(D, [[0, 0], [0.4, 9], [1.6, 9], [2.0, 0]]) },
    neck2: { rot: mix(D, [[0, 0], [0.4, 7], [1.6, 7], [2.0, 0]]) },
    head: { rot: mix(D, [[0, 0], [0.4, 12], [1.6, 12], [2.0, 0]], t2 => 3 * Math.sin(t2 * 6), 0.04) },
    wing2: { rot: mix(D, [[0, 0], [0.5, 4], [1.6, 4], [2.0, 0]]) }
  };
  tailWave(t, D, 5, 0.8, () => 2, 0.05);
  clips.purr = { duration: D, loop: false, tracks: t, events: [{ t: 0.5, type: 'emit', preset: 'hearts', anchor: 'head_anchor' }] };
}
// Tout étourdi (téléphone secoué) : la tête tourne en rond, il titube.
{
  const D = 2.2;
  const t = {
    body: { rot: wave(D, t2 => 3 * Math.sin(t2 * 7) * Math.max(0, 1 - t2 / D), 0.04), x: wave(D, t2 => 4 * Math.sin(t2 * 5) * Math.max(0, 1 - t2 / D), 0.04) },
    neck1: { rot: wave(D, t2 => 7 * Math.sin(t2 * 9) * Math.max(0, 1 - t2 / D), 0.03) },
    head: { rot: wave(D, t2 => 10 * Math.cos(t2 * 9) * Math.max(0, 1 - t2 / D), 0.03) },
    wing2: { rot: wave(D, t2 => -6 + 4 * Math.sin(t2 * 6), 0.05) }
  };
  tailWave(t, D, 6, 0.6, () => -3, 0.05);
  clips.dizzy = { duration: D, loop: false, tracks: t, events: [{ t: 0.2, type: 'emit', preset: 'happySparkle', anchor: 'head_anchor' }] };
}


// Réaction à une quête validée : anticipation (il se ramasse) → bond joyeux, ailes qui s'ouvrent → impact → retour.
{
  const D = 1.5;
  const hop = [[0, 0], [0.22, 5], [0.5, -20], [0.78, 0], [0.9, 3], [1.15, 0], [1.5, 0]];
  const t = {
    body: { y: mix(D, hop), sy: mix(D, [[0, 1], [0.22, 0.96], [0.5, 1.03], [0.78, 0.97], [0.95, 1.01], [1.2, 1]]) },
    ground: { y: mix(D, hop.map(([a, v]) => [a, Math.min(0, v + 5)])) },
    neck1: { rot: mix(D, [[0, 0], [0.22, 5], [0.5, -7], [0.85, 2], [1.3, 0]]) },
    head: { rot: mix(D, [[0, 0], [0.22, 6], [0.5, -12], [0.85, 3], [1.3, 0]]) },
    wing1: { rot: mix(D, [[0, 0], [0.4, -5], [0.7, 2], [1.2, 0]]) },
    wing2: { rot: mix(D, [[0, 0], [0.25, -4], [0.5, 18], [0.75, 4], [1.0, 9], [1.4, 0]]) },
    wingFar: { rot: mix(D, [[0, 0], [0.5, 12], [1.0, 5], [1.4, 0]]) }
  };
  tailWave(t, D, 8, 0.5, t2 => (t2 > 0.3 && t2 < 1.2 ? 5 : 0), 0.05);
  clips.cheer = { duration: D, loop: false, tracks: t, events: [{ t: 0.5, type: 'emit', preset: 'rewardBurst', anchor: 'head_anchor' }] };
}

for (const [id, c] of Object.entries(clips)) {
  for (const tr of Object.values(c.tracks)) for (const k of Object.keys(tr)) if (!tr[k].length) delete tr[k];
  const clip = { id: `${id}@sprite`, note: 'Généré par scripts/build-sprite-clips.mjs', duration: c.duration, loop: c.loop, tracks: c.tracks, ...(c.events ? { events: c.events } : {}) };
  writeFileSync(new URL(`${id}@sprite.json`, OUT), JSON.stringify(clip));
  console.log(`${id}@sprite : ${Object.keys(c.tracks).length} os, ${c.duration}s`);
}

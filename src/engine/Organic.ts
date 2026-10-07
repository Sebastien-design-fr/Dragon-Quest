// LOT 3 — Vie organique du dragon au repos, commune à toutes les évolutions et pilotée par data/visual.json
// (bloc « personality », hérité default → stade → variante.default → variante.stade).
//
// 1. Mouvements de fond procéduraux : respiration à rythme variable, balancement, dérive de la tête,
//    de la queue et des ailes. Bruit lisse à plusieurs octaves : jamais deux fois le même mouvement.
// 2. Micro-comportements choisis dans une table pondérée par stade, avec temps de repos par comportement
//    et priorités (un comportement important n'est pas interrompu par un petit).
// 3. Gestes procéduraux (inclinaison de tête, ajustement d'aile, transfert de poids, regard) avec
//    anticipation → action → retour amorti, et légère inertie dépendant du stade.
// Les comportements que les illustrations ne permettent pas proprement (clignement : pas d'yeux fermés)
// restent désactivés (poids 0) et sont listés dans DRAGON_ASSET_REQUIREMENTS.md.
import type { Skeleton } from './Skeleton.js';

export type BehaviorId = 'look' | 'head_tilt' | 'tail_move' | 'wing_adjust' | 'shift' | 'stretch' | 'yawn' | 'sniff' | 'scratch' | 'look_around' | 'fly' | 'blink';

export interface Personality {
  /** Vitesse générale (bébé > 1 : plus vif ; légendaire < 1 : plus posé). */
  tempo: number;
  /** Respiration : amplitude (fraction d'échelle) et période moyenne (s). */
  breathe: { amp: number; period: number };
  /** Amplitudes des mouvements de fond (degrés ; balancement en unités de déplacement). */
  sway: number; head: number; neck: number; tail: number; wing: number;
  /** Inertie des parties souples (ressorts) : raideur et amortissement. */
  inertia: { k: number; c: number };
  /** Intervalle entre deux micro-comportements (s, avant tempo). */
  interval: [number, number];
  /** Amplitude des gestes procéduraux (1 = référence). */
  gesture: number;
  weights: Partial<Record<BehaviorId, number>>;
}

const DEFAULT: Personality = {
  tempo: 1, breathe: { amp: 0.012, period: 3.4 }, sway: 0.8, head: 3, neck: 2, tail: 5, wing: 2.5,
  inertia: { k: 140, c: 15 }, interval: [5, 11], gesture: 1,
  weights: { look: 3, head_tilt: 2, tail_move: 2, wing_adjust: 1.5, shift: 1.5, look_around: 1, sniff: 0.8, stretch: 0.6, yawn: 0.5, scratch: 0.6, fly: 0.25, blink: 0 }
};

/** Priorité : un comportement n'interrompt qu'un comportement de priorité inférieure. Temps de repos en secondes. */
const META: Record<BehaviorId, { prio: number; cooldown: number; clip?: string }> = {
  look: { prio: 1, cooldown: 3 }, head_tilt: { prio: 1, cooldown: 6 }, wing_adjust: { prio: 1, cooldown: 9 }, shift: { prio: 1, cooldown: 8 },
  tail_move: { prio: 2, cooldown: 10, clip: 'tail_swish' }, look_around: { prio: 2, cooldown: 14, clip: 'look_around' },
  sniff: { prio: 2, cooldown: 25, clip: 'sniff' }, scratch: { prio: 2, cooldown: 35, clip: 'scratch' },
  stretch: { prio: 3, cooldown: 45, clip: 'stretch' }, yawn: { prio: 3, cooldown: 50, clip: 'yawn' },
  fly: { prio: 4, cooldown: 120 }, blink: { prio: 0, cooldown: 4 }
};

export function personalityFor(cfg: { dragons?: Record<string, { personality?: Partial<Personality> }> } | undefined, stage: string, variant: string): Personality {
  const d = cfg?.dragons ?? {};
  const out: Personality = { ...DEFAULT, breathe: { ...DEFAULT.breathe }, inertia: { ...DEFAULT.inertia }, weights: { ...DEFAULT.weights } };
  for (const c of [d.default, d[stage], d[`${variant}.default`], d[`${variant}.${stage}`]]) {
    const p = c?.personality;
    if (!p) continue;
    const { breathe, inertia, weights, ...rest } = p;
    Object.assign(out, rest);
    if (breathe) Object.assign(out.breathe, breathe);
    if (inertia) Object.assign(out.inertia, inertia);
    if (weights) Object.assign(out.weights, weights);
  }
  return out;
}

/** Bruit 1D lisse (valeurs aléatoires interpolées en quintique), déterministe par graine. */
class Noise {
  private v: Float32Array;
  constructor(seed: number) {
    this.v = new Float32Array(256);
    let s = seed * 9301 + 49297;
    for (let i = 0; i < 256; i++) { s = (s * 9301 + 49297) % 233280; this.v[i] = (s / 233280) * 2 - 1; }
  }
  at(t: number): number {
    const i = Math.floor(t), f = t - i;
    const a = this.v[i & 255], b = this.v[(i + 1) & 255];
    const u = f * f * f * (f * (f * 6 - 15) + 10);
    return a + (b - a) * u;
  }
  /** Deux octaves : lent + petit frémissement. */
  fbm(t: number): number { return this.at(t) * 0.75 + this.at(t * 2.3 + 17) * 0.25; }
}

/** Geste procédural : enveloppe anticipation → action → tenue → retour, avec léger dépassement. */
interface Gesture { bones: Array<[string, number]>; t: number; dur: number; hold: number; anticip: number; prio: number }

function envelope(g: Gesture): number {
  const a = g.dur * 0.18, b = g.dur * 0.32, h = g.hold, r = g.dur * 0.5;
  const t = g.t;
  const ease = (x: number) => x * x * (3 - 2 * x);
  if (t < a) return -g.anticip * ease(t / a);                               // anticipation (petit contre-mouvement)
  if (t < a + b) { const x = (t - a) / b; return -g.anticip + (1 + g.anticip) * (1 - Math.pow(1 - x, 3)) * 1.06; } // action, léger dépassement
  if (t < a + b + h) { const x = (t - a - b) / Math.max(1e-3, h); return 1.06 - 0.06 * ease(x); }        // tenue, retour du dépassement
  const x = Math.min(1, (t - a - b - h) / r);
  return 1 - ease(x);                                                        // retour amorti
}

export class OrganicLife {
  p: Personality = DEFAULT;
  private n: Noise[] = [];
  private t = Math.random() * 100;
  private breathPhase = Math.random();
  private timer = 3;
  private gestures: Gesture[] = [];
  private lastUsed = new Map<BehaviorId, number>();
  private clock = 0;
  /** Dernier comportement lancé (panneau développeur). */
  last = '';

  constructor() { for (let i = 0; i < 8; i++) this.n.push(new Noise(1 + i * 7 + Math.floor(Math.random() * 1000))); }

  setPersonality(p: Personality): void { this.p = p; }

  /** Ralentissement de la boucle de repos (le cycle de 6 s n'est plus reconnaissable). */
  idleRate(): number { return 0.82 + 0.3 * (0.5 + 0.5 * this.n[7].at(this.t * 0.11)); }

  /**
   * Couches de fond, appliquées après l'animateur.
   * mode 'idle' : vie complète ; 'sleep' : respiration lente et profonde seulement ; 'off' : rien.
   */
  apply(dt: number, sk: Skeleton, mode: 'idle' | 'sleep' | 'off', unit: number): void {
    if (mode === 'off') { this.gestures = []; return; }
    const p = this.p, n = this.n;
    this.t += dt * p.tempo;
    this.clock += dt;
    const T = this.t;
    const add = (name: string, ch: 'rot' | 'y' | 'x' | 'sy' | 'sx', v: number) => { const b = sk.bone(name); if (b) b.offset[ch] += v; };
    const mul = (name: string, ch: 'sy' | 'sx', v: number) => { const b = sk.bone(name); if (b) b.offset[ch] *= v; };

    // Respiration : période qui varie lentement (±25 %), inspiration un peu plus courte que l'expiration.
    const period = (mode === 'sleep' ? 1.6 : 1) * p.breathe.period * (1 + 0.25 * n[0].at(T * 0.07));
    this.breathPhase += dt / period;
    const ph = this.breathPhase % 1;
    const breath = ph < 0.42 ? Math.sin((ph / 0.42) * Math.PI / 2) : Math.cos(((ph - 0.42) / 0.58) * Math.PI / 2);
    const depth = (mode === 'sleep' ? 1.5 : 1) * p.breathe.amp * (0.8 + 0.4 * (0.5 + 0.5 * n[1].at(T * 0.05)));
    mul('spine', 'sy', 1 + depth * 2.2 * (breath - 0.5));
    mul('body', 'sy', 1 + depth * 0.35 * (breath - 0.5));
    add('body', 'y', -depth * 60 * unit * (breath - 0.5));
    if (mode === 'sleep') return;

    // Balancement et dérives lentes (jamais périodiques)
    add('body', 'rot', p.sway * 0.6 * n[2].fbm(T * 0.13));
    add('body', 'x', p.sway * 1.2 * unit * n[3].fbm(T * 0.09));
    add('neck1', 'rot', p.neck * n[4].fbm(T * 0.16));
    add('neck2', 'rot', p.neck * 0.7 * n[4].fbm(T * 0.16 + 3.1));
    add('head', 'rot', p.head * n[5].fbm(T * 0.21));
    for (let i = 1; i <= 5; i++) add('tail' + i, 'rot', p.tail * (0.4 + i * 0.15) * n[6].fbm(T * 0.19 - i * 0.35));
    add('wing2', 'rot', p.wing * 0.6 * n[7].fbm(T * 0.12));
    add('wingFar', 'rot', p.wing * 0.4 * n[7].fbm(T * 0.12 + 5));

    // Gestes en cours
    const g = p.gesture;
    for (const ge of this.gestures) {
      ge.t += dt * p.tempo;
      const e = envelope(ge);
      for (const [bone, amp] of ge.bones) add(bone, 'rot', amp * g * e);
    }
    this.gestures = this.gestures.filter(ge => ge.t < ge.dur * 1.0 + ge.hold);
  }

  /** Choisit le prochain micro-comportement. Retourne un clip à jouer, 'fly', un regard, ou null. */
  tick(dt: number, canAct: boolean): { clip?: string; fly?: boolean; look?: [number, number, number] } | null {
    if (!canAct) { this.timer = Math.max(this.timer, 2); return null; }
    this.timer -= dt * this.p.tempo;
    if (this.forced) { const id = this.forced; this.forced = null; return this.run(id); }
    if (this.timer > 0) return null;
    const [a, b] = this.p.interval;
    this.timer = a + Math.random() * (b - a);
    const busy = this.gestures.reduce((m, x) => Math.max(m, x.prio), 0);
    // table pondérée, hors temps de repos et hors priorité insuffisante
    const cands = (Object.entries(this.p.weights) as Array<[BehaviorId, number]>).filter(([id, w]) => {
      if (!w || w <= 0) return false;
      const m = META[id];
      if (m.prio <= busy) return false;
      return this.clock - (this.lastUsed.get(id) ?? -1e9) >= m.cooldown;
    });
    const total = cands.reduce((s, [, w]) => s + w, 0);
    if (!total) return null;
    let r = Math.random() * total, id: BehaviorId = cands[0][0];
    for (const [k, w] of cands) { r -= w; if (r <= 0) { id = k; break; } }
    return this.run(id);
  }

  private run(id: BehaviorId): { clip?: string; fly?: boolean; look?: [number, number, number] } | null {
    this.lastUsed.set(id, this.clock);
    this.last = id;
    const m = META[id];
    if (id === 'fly') return { fly: true };
    if (m.clip) return { clip: m.clip };
    const s = () => (Math.random() < 0.5 ? -1 : 1);
    switch (id) {
      case 'look': {
        // regarde un point au hasard (devant, en haut, vers le sol), quelques secondes
        const x = (Math.random() * 1.6 - 0.6), y = (Math.random() * 1.4 - 0.8);
        return { look: [x, y, 1.5 + Math.random() * 2.5] };
      }
      case 'head_tilt':
        this.gestures.push({ bones: [['head', 9 * s()], ['neck2', 3]], t: 0, dur: 1.4, hold: 0.6 + Math.random() * 0.8, anticip: 0.15, prio: 1 });
        break;
      case 'wing_adjust':
        this.gestures.push({ bones: [['wing2', 7], ['wing1', -3], ['wingFar', 4]], t: 0, dur: 1.2, hold: 0.2, anticip: 0.25, prio: 1 });
        break;
      case 'shift':
        this.gestures.push({ bones: [['body', 1.6 * s()], ['spine', 1.2], ['neck1', -2]], t: 0, dur: 1.8, hold: 1.5 + Math.random() * 2, anticip: 0.1, prio: 1 });
        break;
    }
    return null;
  }

  /** Force un comportement (panneau développeur). */
  force(id: BehaviorId): void { this.forced = id; }
  private forced: BehaviorId | null = null;
}

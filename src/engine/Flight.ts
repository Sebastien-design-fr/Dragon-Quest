// LOT 4 — Vol procédural commun à toutes les évolutions. Réglages par stade dans data/visual.json (bloc « flight »,
// hérité default → stade → variante.default → variante.stade) : un bébé léger saute vite et bat des ailes rapidement,
// un légendaire s'accroupit plus longtemps, bat lentement et pèse à l'atterrissage.

export interface FlightConfig {
  /** Durées (s) : accroupi, montée, vol, descente, récupération au sol. */
  crouch: number; rise: number; cruise: number; descend: number; recover: number;
  /** Profondeur de l'accroupissement (unités de déplacement). */
  crouchDepth: number;
  /** Hauteur de vol (fraction de la scène), amplitude du rebond à chaque battement (même unité). */
  height: number; bob: number;
  /** Déplacement horizontal (fraction de largeur) et recul en profondeur (fraction de taille). */
  travel: number; recede: number;
  /** Inclinaison maximale (degrés). */
  tilt: number;
  /** Durée d'un battement (s) et facteurs : montée (plus rapide), descente (plané, plus lent). */
  flapPeriod: number; riseFlap: number; glideFlap: number;
  /** Atterrissage : écrasement (0..0.06), poussière (1 = pattes, 2 = + corps), secousse de caméra (0 = aucune). */
  impact: number; landingDust: number; shake: number;
}

const DEFAULT: FlightConfig = {
  crouch: 0.4, rise: 0.75, cruise: 3.2, descend: 0.9, recover: 0.6, crouchDepth: 9,
  height: 0.14, bob: 0.018, travel: 0.1, recede: 0.18, tilt: 7,
  flapPeriod: 0.6, riseFlap: 0.65, glideFlap: 1.5, impact: 0.035, landingDust: 1, shake: 0
};

export function flightConfig(cfg: { dragons?: Record<string, { flight?: Partial<FlightConfig> }> } | undefined, stage: string, variant: string): FlightConfig {
  const d = cfg?.dragons ?? {};
  const out = { ...DEFAULT };
  for (const c of [d.default, d[stage], d[`${variant}.default`], d[`${variant}.${stage}`]]) if (c?.flight) Object.assign(out, c.flight);
  return out;
}

export interface FlightPhase {
  /** Accroupissement (1 = au plus bas, négatif = détente). */
  crouch: number;
  airborne: boolean;
  /** Hauteur relative (0 au sol, 1 en vol). */
  height: number;
  /** Avancement du vol (0..1), pour la trajectoire horizontale. */
  cruise: number;
  flapRate: number;
  touchdown: boolean;
  done: boolean;
}

const smooth = (x: number) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
const outCubic = (x: number) => 1 - Math.pow(1 - Math.max(0, Math.min(1, x)), 3);

export function flightPhase(c: FlightConfig, t: number): FlightPhase {
  const t1 = c.crouch, t2 = t1 + c.rise, t3 = t2 + c.cruise, t4 = t3 + c.descend, t5 = t4 + c.recover;
  const p: FlightPhase = { crouch: 0, airborne: false, height: 0, cruise: 0, flapRate: 1, touchdown: false, done: t >= t5 };
  if (t < t1) {
    // anticipation : il se ramasse, puis se détend juste avant de quitter le sol
    const u = t / t1;
    p.crouch = u < 0.75 ? smooth(u / 0.75) : 1 - 1.3 * smooth((u - 0.75) / 0.25);
    return p;
  }
  if (t < t2) {
    p.airborne = true; p.height = outCubic((t - t1) / c.rise); p.flapRate = c.riseFlap; p.crouch = -0.3 * (1 - (t - t1) / c.rise);
    return p;
  }
  if (t < t3) {
    p.airborne = true; p.height = 1; p.cruise = (t - t2) / c.cruise;
    return p;
  }
  p.cruise = 1;
  if (t < t4) {
    p.airborne = true; p.height = 1 - smooth((t - t3) / c.descend); p.flapRate = c.glideFlap;
    // il repasse sur l'image debout juste avant de toucher le sol (pattes tendues vers le sol)
    if (p.height < 0.12) p.airborne = false;
    return p;
  }
  // au sol : il absorbe l'impact puis se redresse
  p.touchdown = true;
  const u = (t - t4) / c.recover;
  p.crouch = 0.75 * (1 - smooth(u)) * (u < 0.15 ? u / 0.15 : 1);
  return p;
}

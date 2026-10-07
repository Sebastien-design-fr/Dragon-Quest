// LOT 6 — Transformation spectaculaire au passage de stade (N → N+1), commune à tous les stades et variantes.
// Réglages dans data/visual.json, bloc « evolution » (hérité default → stade d'arrivée → variante.default → variante.stade).
//
// Déroulé :
//  1. charge      : il se ramasse, tremble, s'élève un peu ; la lumière converge sur lui, la scène s'assombrit autour.
//  2. silhouette  : il devient une silhouette de lumière (illustration et équipements).
//  3. métamorphose: l'ancienne et la nouvelle silhouette alternent de plus en plus vite, rayons de lumière tournants.
//  4. révélation  : éclair, onde de choc au sol, éclats ; la lumière se retire du nouveau dragon, qui se pose.
//  5. retour      : la scène retrouve son éclairage, le dragon rugit / se réjouit.
// Le décor change pendant la métamorphose (fondu enchaîné) ; ses images ne sont jamais modifiées.

export type RGB = [number, number, number];

export interface EvolutionConfig {
  /** Durées (s). */
  charge: number; silhouette: number; morph: number; reveal: number; settle: number;
  /** Nombre d'alternances ancienne / nouvelle silhouette (impair : on finit sur la nouvelle). */
  swaps: number;
  /** Couleur de la lumière d'évolution et couleur d'accent (rayons, onde). */
  color: RGB; accent: RGB;
  /** Assombrissement temporaire autour du dragon (0..1), intensité des rayons et du faisceau. */
  dim: number; rays: number; rayCount: number; raySpin: number; beam: number;
  /** Lévitation (fraction de la hauteur de scène), accroupi (unités de déplacement), tremblement, secousse. */
  levitate: number; crouch: number; tremble: number; shake: number;
  /** Zoom de caméra pendant la charge (0.06 = +6 %). */
  zoom: number;
  /** Halo autour de la silhouette (pixels CSS). */
  halo: number;
  /** Particules : convergence pendant la charge, gerbes à la révélation. */
  gather: string; burst: string[];
  /** Animation jouée à la révélation (rugissement, joie…). */
  revealClip: string;
  /** Onde de choc au sol (rayon final en fraction de la largeur de scène). */
  ring: number;
}

const DEFAULT: EvolutionConfig = {
  charge: 2.2, silhouette: 0.6, morph: 2.4, reveal: 1.5, settle: 0.8, swaps: 9,
  color: [255, 236, 190], accent: [255, 200, 110],
  dim: 0.5, rays: 0.8, rayCount: 14, raySpin: 22, beam: 0.8,
  levitate: 0.05, crouch: 8, tremble: 1, shake: 5, zoom: 0.06, halo: 26,
  gather: 'evoGather', burst: ['evolutionBurst', 'evoShards', 'evoGlow'], revealClip: 'roar', ring: 0.55
};

type Chain = { dragons?: unknown; evolution?: Record<string, Partial<EvolutionConfig>> } | undefined;

export function evolutionConfig(cfg: Chain, to: string, variant: string): EvolutionConfig {
  const e = cfg?.evolution ?? {};
  const out: EvolutionConfig = { ...DEFAULT, burst: [...DEFAULT.burst] };
  for (const c of [e.default, e[to], e[`${variant}.default`], e[`${variant}.${to}`]]) if (c) Object.assign(out, c);
  out.swaps = Math.max(1, Math.round(out.swaps) | 1); // toujours impair : la dernière silhouette est la nouvelle
  return out;
}

export type EvoPhase = 'charge' | 'silhouette' | 'morph' | 'reveal' | 'settle' | 'done';

export interface EvoFrame {
  phase: EvoPhase;
  /** Blanchiment du dragon (0 = normal, 1 = silhouette de lumière). */
  sil: number;
  /** Halo autour du dragon (0..1+). */
  halo: number;
  dim: number; rays: number; beam: number;
  /** Lévitation (0..1), accroupi (0..1), tremblement (0..1), zoom (0..1). */
  lift: number; crouch: number; tremble: number; zoom: number;
  /** Métamorphose : silhouette affichée (false = ancienne), temps depuis la dernière alternance (s). */
  showNew: boolean; sinceSwitch: number;
  /** Révélation : avancement de l'onde de choc (0..1, -1 = pas d'onde). */
  ring: number;
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const smooth = (x: number) => { x = clamp01(x); return x * x * (3 - 2 * x); };

/** Fin de chaque phase (s). */
export function evolutionMarks(c: EvolutionConfig): { charged: number; lit: number; morphed: number; revealed: number; end: number; land: number; clip: number } {
  const charged = c.charge, lit = charged + c.silhouette, morphed = lit + c.morph, revealed = morphed + c.reveal;
  return { charged, lit, morphed, revealed, end: revealed + c.settle, land: morphed + c.reveal * 0.42, clip: morphed + c.reveal * 0.3 };
}

/** Débuts des alternances pendant la métamorphose (fractions 0..1), de plus en plus rapprochées. */
function switchTimes(swaps: number): number[] {
  const r = 0.78, seg: number[] = [];
  for (let i = 0; i <= swaps; i++) seg.push(Math.pow(r, i));
  const span = 0.86, total = seg.reduce((a, b) => a + b, 0);
  const out = [0];
  let acc = 0;
  for (let i = 0; i < swaps; i++) { acc += seg[i] / total * span; out.push(acc); }
  return out; // out[k] = début du segment k ; segment pair = ancienne silhouette, impair = nouvelle
}
const switchCache = new Map<number, number[]>();

export function evolutionFrame(c: EvolutionConfig, t: number): EvoFrame {
  const m = evolutionMarks(c);
  const f: EvoFrame = { phase: 'charge', sil: 0, halo: 0, dim: 0, rays: 0, beam: 0, lift: 0, crouch: 0, tremble: 0, zoom: 0, showNew: false, sinceSwitch: 0, ring: -1 };
  if (t < m.charged) {
    const u = t / c.charge;
    f.crouch = smooth(u / 0.3) * (1 - smooth((u - 0.55) / 0.3));
    f.lift = smooth((u - 0.5) / 0.5);
    f.tremble = u * u;
    f.halo = 0.15 + 0.55 * u;
    f.sil = 0.4 * u * u;
    f.dim = smooth(u / 0.7);
    f.beam = smooth(u / 0.8);
    f.rays = 0.35 * smooth((u - 0.45) / 0.55);
    f.zoom = smooth(u);
    return f;
  }
  f.lift = 1; f.dim = 1; f.zoom = 1;
  if (t < m.lit) {
    const v = (t - m.charged) / c.silhouette;
    f.phase = 'silhouette';
    f.sil = 0.4 + 0.6 * smooth(v);
    f.halo = 0.7 + 0.3 * v;
    f.tremble = 1; f.beam = 1 - 0.4 * v;
    f.rays = 0.35 + 0.3 * v;
    return f;
  }
  if (t < m.morphed) {
    const w = (t - m.lit) / c.morph;
    f.phase = 'morph';
    f.sil = 1; f.tremble = 0.5; f.beam = 0.6 * (1 - w);
    f.rays = 0.65 + 0.35 * w;
    f.halo = 1 + 0.5 * smooth((w - 0.85) / 0.15);
    let st = switchCache.get(c.swaps);
    if (!st) { st = switchTimes(c.swaps); switchCache.set(c.swaps, st); }
    let k = 0;
    while (k + 1 < st.length && w >= st[k + 1]) k++;
    f.showNew = k % 2 === 1;
    f.sinceSwitch = (w - st[k]) * c.morph;
    return f;
  }
  if (t < m.revealed) {
    const r = (t - m.morphed) / c.reveal;
    f.phase = 'reveal';
    f.showNew = true;
    f.sil = 1 - smooth(r / 0.75);
    f.halo = 1.5 * (1 - smooth(r / 0.8));
    f.dim = 1 - smooth(r / 0.9);
    f.rays = Math.pow(1 - r, 2);
    f.lift = 1 - smooth(r / 0.42);
    f.zoom = 1 - smooth(r);
    f.ring = r < 0.7 ? r / 0.7 : -1;
    return f;
  }
  f.phase = t < m.end ? 'settle' : 'done';
  f.lift = 0; f.dim = 0; f.zoom = 0; f.showNew = true;
  return f;
}

export const rgba = (c: RGB, a: number) => `rgba(${c[0]},${c[1]},${c[2]},${Math.max(0, Math.min(1, a))})`;

/** Faisceau vertical (dégradé pré-rendu par couleur). */
const beamCache = new Map<string, HTMLCanvasElement>();
function beamSprite(c: RGB): HTMLCanvasElement {
  const key = c.join(',');
  let s = beamCache.get(key);
  if (s) return s;
  s = document.createElement('canvas'); s.width = 64; s.height = 256;
  const g = s.getContext('2d')!;
  const h = g.createLinearGradient(0, 0, 64, 0);
  h.addColorStop(0, rgba(c, 0)); h.addColorStop(0.5, rgba(c, 1)); h.addColorStop(1, rgba(c, 0));
  g.fillStyle = h; g.fillRect(0, 0, 64, 256);
  g.globalCompositeOperation = 'destination-in';
  const v = g.createLinearGradient(0, 0, 0, 256);
  v.addColorStop(0, 'rgba(0,0,0,0.15)'); v.addColorStop(0.75, 'rgba(0,0,0,1)'); v.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = v; g.fillRect(0, 0, 64, 256);
  beamCache.set(key, s);
  return s;
}

/** Couches de mise en scène dessinées derrière le dragon (coordonnées écran, pixels du canvas). */
export function drawEvolutionBackLayers(ctx: CanvasRenderingContext2D, c: EvolutionConfig, f: EvoFrame, W: number, H: number,
  center: { x: number; y: number }, feetY: number, size: number, time: number): void {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  // assombrissement temporaire, plus léger autour du dragon (le décor lui-même n'est pas modifié)
  if (f.dim > 0.01 && c.dim > 0) {
    const R = Math.max(W, H);
    const g = ctx.createRadialGradient(center.x, center.y, size * 0.35, center.x, center.y, R * 0.9);
    const a = c.dim * f.dim;
    g.addColorStop(0, `rgba(6,4,14,${a * 0.2})`); g.addColorStop(0.45, `rgba(6,4,14,${a * 0.75})`); g.addColorStop(1, `rgba(6,4,14,${a})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  ctx.globalCompositeOperation = 'lighter';
  // faisceau tombant sur le dragon
  if (f.beam > 0.01 && c.beam > 0) {
    ctx.globalAlpha = Math.min(1, f.beam * c.beam);
    const bw = size * 0.9;
    ctx.drawImage(beamSprite(c.color), center.x - bw / 2, 0, bw, feetY + size * 0.05);
  }
  // rayons tournants derrière la silhouette
  if (f.rays > 0.01 && c.rays > 0 && c.rayCount > 0) {
    const R = size * 1.6;
    const g = ctx.createRadialGradient(center.x, center.y, size * 0.1, center.x, center.y, R);
    g.addColorStop(0, rgba(c.accent, 0.55)); g.addColorStop(0.5, rgba(c.accent, 0.18)); g.addColorStop(1, rgba(c.accent, 0));
    ctx.globalAlpha = Math.min(1, f.rays * c.rays);
    ctx.fillStyle = g;
    ctx.beginPath();
    const n = c.rayCount, a0 = (time * c.raySpin * Math.PI) / 180;
    for (let i = 0; i < n; i++) {
      const a = a0 + (i / n) * Math.PI * 2, wdt = (Math.PI / n) * (0.35 + 0.25 * Math.sin(time * 3 + i * 1.7));
      ctx.moveTo(center.x, center.y);
      ctx.lineTo(center.x + Math.cos(a - wdt) * R, center.y + Math.sin(a - wdt) * R);
      ctx.lineTo(center.x + Math.cos(a + wdt) * R, center.y + Math.sin(a + wdt) * R);
      ctx.closePath();
    }
    ctx.fill();
    // cœur lumineux
    const core = ctx.createRadialGradient(center.x, center.y, 0, center.x, center.y, size * 0.7);
    core.addColorStop(0, rgba(c.color, 0.5)); core.addColorStop(1, rgba(c.color, 0));
    ctx.fillStyle = core; ctx.fillRect(center.x - size, center.y - size, size * 2, size * 2);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

/** Onde de choc au sol à la révélation. */
export function drawEvolutionRing(ctx: CanvasRenderingContext2D, c: EvolutionConfig, f: EvoFrame, W: number, x: number, feetY: number, dpr: number): void {
  if (f.ring < 0 || c.ring <= 0) return;
  const u = f.ring, R = W * c.ring * (0.15 + 0.85 * (1 - Math.pow(1 - u, 3)));
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'lighter';
  for (const [k, a] of [[1, 0.8], [0.72, 0.45]] as const) {
    ctx.globalAlpha = a * (1 - u);
    ctx.strokeStyle = rgba(k === 1 ? c.color : c.accent, 1);
    ctx.lineWidth = (10 * (1 - u) + 2) * dpr * k;
    ctx.beginPath(); ctx.ellipse(x, feetY, R * k, R * k * 0.22, 0, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

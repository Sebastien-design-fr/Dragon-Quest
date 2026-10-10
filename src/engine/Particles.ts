// Système de particules léger (pool réutilisé, aucune allocation en régime établi).
// Les presets viennent de data/effects.json ; la qualité graphique applique un multiplicateur
// (LOW = 0 : aucune particule).
import { rand } from '../core/math.js';
import type { ParticlePreset } from '../core/types.js';

interface P {
  alive: boolean; x: number; y: number; vx: number; vy: number; rot: number; vr: number;
  life: number; max: number; size: number; color: string; seed: number;
  preset: ParticlePreset;
}

export interface EmitterSource { (): { x: number; y: number; scale: number } | null }

interface Emitter { id: string; preset: ParticlePreset; source: EmitterSource; acc: number }

const MAX = 600;

export class ParticleSystem {
  private pool: P[] = [];
  private emitters = new Map<string, Emitter>();
  multiplier = 1;

  constructor(private presets: Map<string, ParticlePreset>) {
    for (let i = 0; i < MAX; i++) this.pool.push({ alive: false } as P);
  }

  preset(id: string): ParticlePreset | undefined { return this.presets.get(id); }

  /** Prochaine particule libre (recherche circulaire depuis la dernière trouvée : pas de parcours complet à chaque émission). */
  private cursor = 0;
  private free(): P | null {
    const n = this.pool.length;
    for (let i = 0; i < n; i++) {
      const j = (this.cursor + i) % n;
      if (!this.pool[j].alive) { this.cursor = (j + 1) % n; return this.pool[j]; }
    }
    return null;
  }

  /** Particules vivantes (panneau développeur). */
  count(): number { let n = 0; for (const p of this.pool) if (p.alive) n++; return n; }

  /** Émetteur continu (effet équipé, aura permanente…). */
  setEmitter(id: string, presetId: string, source: EmitterSource): void {
    const preset = this.presets.get(presetId);
    if (!preset) { console.warn(`Effet inconnu : ${presetId}`); return; }
    this.emitters.set(id, { id, preset, source, acc: 0 });
  }
  removeEmitter(id: string): void { this.emitters.delete(id); }
  clearEmitters(prefix = ''): void {
    for (const id of [...this.emitters.keys()]) if (id.startsWith(prefix)) this.emitters.delete(id);
  }

  burst(presetId: string, x: number, y: number, scale: number): void {
    const p = this.presets.get(presetId);
    if (!p) return;
    const n = Math.round((p.burst ?? 20) * this.multiplier);
    for (let i = 0; i < n; i++) this.spawn(p, x, y, scale);
  }

  update(dt: number): void {
    if (this.multiplier > 0) {
      for (const e of this.emitters.values()) {
        const src = e.source();
        if (!src) continue;
        e.acc += e.preset.rate * this.multiplier * dt;
        while (e.acc >= 1) { e.acc--; this.spawn(e.preset, src.x, src.y, src.scale); }
      }
    }
    for (const p of this.pool) {
      if (!p.alive) continue;
      p.life += dt;
      if (p.life >= p.max) { p.alive = false; continue; }
      p.vy += p.preset.gravity * dt;
      if (p.preset.turb) { // flamme : ondulation qui grandit avec l'âge (langues de feu)
        const a = p.life / p.max;
        p.vy += Math.sin(p.life * 17 + p.seed) * p.preset.turb * (0.3 + a) * dt;
        p.vx += Math.cos(p.life * 11 + p.seed * 1.7) * p.preset.turb * 0.4 * a * dt;
      }
      if (p.preset.drag) { const k = Math.exp(-p.preset.drag * dt); p.vx *= k; p.vy *= k; }
      p.rot += p.vr * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
    }
  }

  draw(ctx: CanvasRenderingContext2D, layer: 'magical' | 'foreground'): void {
    for (const p of this.pool) {
      if (!p.alive || p.preset.layer !== layer) continue;
      const t = p.life / p.max;
      const alpha = p.preset.fade === 'inout' ? Math.sin(Math.PI * t) : 1 - t;
      ctx.globalAlpha = Math.max(0, alpha);
      ctx.globalCompositeOperation = p.preset.blend;
      ctx.fillStyle = p.color;
      const s = p.size * (p.preset.shape === 'smoke' ? 0.6 + t : 1) * (p.preset.grow !== undefined ? 1 + (p.preset.grow - 1) * t : 1);
      if (p.preset.shape === 'flame') {
        // langue de feu : texture irrégulière (bruit), étirée dans le sens du mouvement ;
        // chaude = lumière additive (blanc → jaune → orange), refroidie = rouge sombre opaque qui se mêle à la fumée
        const step = Math.min(FLAME_STEPS - 1, Math.floor(t * FLAME_STEPS));
        const heat = flameSprite(step, (p.seed * 10) & 3);
        const flick = 0.8 + 0.3 * Math.sin(p.life * 37 + p.seed * 3);
        const env = t < 0.1 ? t / 0.1 : 1 - (t - 0.1) / 0.9;
        ctx.globalCompositeOperation = t < 0.55 ? 'lighter' : 'source-over';
        ctx.globalAlpha = Math.max(0, env) * flick * (t < 0.55 ? 0.42 : 0.6);
        const st = (p.preset.stretch ?? 1.6) * (0.75 + 0.5 * (1 - t));
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(Math.atan2(p.vy, p.vx) + 0.25 * Math.sin(p.rot + p.life * 6));
        ctx.drawImage(heat, -s * 1.2 * st, -s, s * 2 * st, s * 2);
        ctx.restore();
      } else if (p.preset.shape === 'glow') {
        // lueur douce pré-rendue (aucun dégradé recalculé)
        const g = glowSprite(p.color);
        ctx.drawImage(g, p.x - s * 2, p.y - s * 2, s * 4, s * 4);
      } else if (p.preset.shape === 'star') {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.beginPath();
        for (let k = 0; k < 8; k++) { const r = k % 2 ? s * 0.32 : s; const a = (k * Math.PI) / 4; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
        ctx.closePath(); ctx.fill(); ctx.restore();
      } else if (p.preset.shape === 'spark') {
        ctx.fillRect(p.x - s / 2, p.y - s * 1.5, s, s * 3);
      } else if (p.preset.shape === 'heart') {
        ctx.beginPath();
        ctx.moveTo(p.x, p.y + s * 0.9);
        ctx.bezierCurveTo(p.x - s * 1.6, p.y - s * 0.2, p.x - s * 0.7, p.y - s * 1.4, p.x, p.y - s * 0.5);
        ctx.bezierCurveTo(p.x + s * 0.7, p.y - s * 1.4, p.x + s * 1.6, p.y - s * 0.2, p.x, p.y + s * 0.9);
        ctx.fill();
      } else if (p.preset.shape === 'bubble') {
        ctx.strokeStyle = p.color; ctx.lineWidth = Math.max(1, s * 0.18);
        ctx.beginPath(); ctx.arc(p.x, p.y, s, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha *= 0.25; ctx.fill();
        ctx.globalAlpha /= 0.25;
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.beginPath(); ctx.arc(p.x - s * 0.35, p.y - s * 0.35, s * 0.2, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.beginPath(); ctx.arc(p.x, p.y, s, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  private spawn(pr: ParticlePreset, x: number, y: number, scale: number): void {
    const p = this.free();
    if (!p) return;
    const ang = (rand(pr.angle[0], pr.angle[1]) * Math.PI) / 180;
    const sp = rand(pr.speed[0], pr.speed[1]) * scale;
    const r = pr.spread * scale;
    p.alive = true; p.preset = pr; p.life = 0;
    p.max = rand(pr.life[0], pr.life[1]);
    p.x = x + rand(-r, r); p.y = y + rand(-r * 0.6, r * 0.6);
    p.vx = Math.cos(ang) * sp; p.vy = Math.sin(ang) * sp;
    p.size = rand(pr.size[0], pr.size[1]) * scale;
    p.rot = Math.random() * Math.PI * 2;
    p.vr = ((pr.spin ?? 0) * Math.PI / 180) * (Math.random() < 0.5 ? -1 : 1) * (0.5 + Math.random() * 0.5);
    p.color = pr.colors[(Math.random() * pr.colors.length) | 0];
    p.seed = Math.random() * 6.283;
    if (pr.converge !== undefined) {
      // départ sur un cercle autour de la source, arrivée au centre en fin de vie (avec un tourbillon)
      const a = Math.random() * Math.PI * 2, R = r * rand(0.75, 1.25);
      const ox = Math.cos(a) * R, oy = Math.sin(a) * R * 0.75;
      p.x = x + ox; p.y = y + oy;
      const k = 1 / p.max, w = pr.converge;
      p.vx = (-ox - oy * w) * k; p.vy = (-oy + ox * w) * k;
    }
  }
}

/** Lueurs pré-rendues par couleur (cache). */
const glowCache = new Map<string, HTMLCanvasElement>();
function glowSprite(color: string): HTMLCanvasElement {
  let c = glowCache.get(color);
  if (c) return c;
  c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, color); grd.addColorStop(0.25, color); grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.globalAlpha = 1; g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  // cœur plus clair
  const core = g.createRadialGradient(32, 32, 0, 32, 32, 10);
  core.addColorStop(0, 'rgba(255,255,255,0.9)'); core.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = core; g.fillRect(0, 0, 64, 64);
  glowCache.set(color, c);
  return c;
}

/** Rampe de chaleur des flammes : sprites pré-rendus (bruit fractal, 4 formes), aucun calcul à l'image. */
const FLAME_STEPS = 14;
const FLAME_RAMP: Array<[number, [number, number, number]]> = [
  [0, [255, 250, 220]], [0.1, [255, 232, 140]], [0.25, [255, 186, 56]], [0.42, [250, 120, 22]],
  [0.6, [205, 58, 14]], [0.78, [110, 26, 14]], [1, [34, 24, 26]]
];
const flameCache = new Map<number, HTMLCanvasElement>();
function hash(x: number, y: number, s: number): number { const h = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453; return h - Math.floor(h); }
function vnoise(x: number, y: number, s: number): number {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function flameSprite(i: number, variant: number): HTMLCanvasElement {
  const key = i * 4 + variant;
  const hit = flameCache.get(key);
  if (hit) return hit;
  const u = i / (FLAME_STEPS - 1);
  let k = 0; while (k < FLAME_RAMP.length - 2 && FLAME_RAMP[k + 1][0] < u) k++;
  const [u0, c0] = FLAME_RAMP[k], [u1, c1] = FLAME_RAMP[k + 1];
  const f = Math.max(0, Math.min(1, (u - u0) / (u1 - u0)));
  const col = c0.map((v, j) => Math.round(v + (c1[j] - v) * f));
  const W = 72, H = 48;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d')!;
  const img = g.createImageData(W, H);
  const seed = variant * 13.7 + 1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    // goutte : tête arrondie à droite, traîne effilée à gauche
    const nx = (x - W * 0.62) / (W * 0.4), ny = (y - H / 2) / (H * 0.42);
    const taper = nx < 0 ? 1 + nx * 0.55 : 1;           // plus mince vers l'arrière
    const r = Math.sqrt(nx * nx * (nx < 0 ? 0.45 : 1) + (ny / Math.max(0.2, taper)) ** 2);
    const n = 0.55 * vnoise(x / 9, y / 9, seed) + 0.3 * vnoise(x / 4.5, y / 4.5, seed + 3) + 0.15 * vnoise(x / 2.2, y / 2.2, seed + 7);
    // bords déchiquetés : le bruit ronge la silhouette (davantage en refroidissant)
    const edge = 1 - r + (n - 0.5) * (0.9 + u * 0.8);
    let al = Math.max(0, Math.min(1, edge * 2.2));
    al *= 0.65 + 0.35 * n;
    // cœur plus clair au centre des jeunes flammes
    const hot = u < 0.4 ? Math.max(0, 1 - r * 1.6) * (1 - u / 0.4) : 0;
    const o = (y * W + x) * 4;
    img.data[o] = Math.min(255, col[0] + hot * 60);
    img.data[o + 1] = Math.min(255, col[1] + hot * 90 + (n - 0.5) * 40);
    img.data[o + 2] = Math.min(255, col[2] + hot * 120);
    img.data[o + 3] = Math.round(al * 255 * (1 - u * 0.25));
  }
  g.putImageData(img, 0, 0);
  flameCache.set(key, c);
  return c;
}

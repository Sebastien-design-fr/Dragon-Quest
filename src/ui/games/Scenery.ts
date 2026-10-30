// Habillage commun des mini-jeux, pour qu'ils aient le même rendu peint que la grotte :
//  - fond : le décor peint du stade (cadré « cover »), étalonné selon l'ambiance du jeu, avec vignette ;
//  - ambiance : poussières, braises ou étoiles qui dérivent (deux profondeurs) ;
//  - impacts : secousse d'écran, éclair coloré, gains qui jaillissent (police du jeu, contour, rebond).
import { Sound } from '../../engine/Sound.js';
import { gameEffects } from '../../game/StagePowers.js';
import { h } from '../dom.js';

export function loadImage(url: string | undefined): { img: HTMLImageElement; ok: () => boolean } {
  const img = new Image();
  let ok = false;
  img.onload = () => { ok = img.naturalWidth > 0; };
  if (url) img.src = url;
  return { img, ok: () => ok };
}

/** Étalonnage du fond : dégradé posé sur le décor (haut → bas) et force de la vignette. */
export interface Grade { top: string; mid: string; bottom: string; vignette: number }

export const GRADES = {
  /** Nuit chaude (tir de feu) : ciel sombre, lueur orangée près du sol. */
  dusk: { top: 'rgba(14,9,26,0.78)', mid: 'rgba(40,20,36,0.45)', bottom: 'rgba(60,24,14,0.55)', vignette: 0.7 },
  /** Grotte (course) : très sombre pour que les rochers ressortent. */
  cave: { top: 'rgba(10,7,12,0.72)', mid: 'rgba(30,18,22,0.55)', bottom: 'rgba(10,7,9,0.8)', vignette: 0.8 },
  /** Trésor (gemmes) : lumière dorée au centre, bords sombres. */
  hoard: { top: 'rgba(12,9,20,0.6)', mid: 'rgba(30,20,20,0.35)', bottom: 'rgba(16,10,8,0.7)', vignette: 0.75 }
} satisfies Record<string, Grade>;

/**
 * Peint le décor dans `g` (déjà mis à l'échelle en pixels CSS). Sans image, un dégradé de repli.
 * `focus` : point de cadrage horizontal de l'image (0 gauche … 1 droite).
 */
export function paintBackdrop(g: CanvasRenderingContext2D, W: number, H: number, img: HTMLImageElement | null, grade: Grade, focus = 0.5): void {
  if (img && img.naturalWidth) {
    const s = Math.max(W / img.naturalWidth, H / img.naturalHeight);
    const w = img.naturalWidth * s, hh = img.naturalHeight * s;
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.drawImage(img, (W - w) * focus, (H - hh) / 2, w, hh);
  } else {
    const base = g.createLinearGradient(0, 0, 0, H);
    base.addColorStop(0, '#120d16'); base.addColorStop(0.6, '#2a1a22'); base.addColorStop(1, '#0d0a0c');
    g.fillStyle = base; g.fillRect(0, 0, W, H);
  }
  const tint = g.createLinearGradient(0, 0, 0, H);
  tint.addColorStop(0, grade.top); tint.addColorStop(0.55, grade.mid); tint.addColorStop(1, grade.bottom);
  g.fillStyle = tint; g.fillRect(0, 0, W, H);
  const vig = g.createRadialGradient(W / 2, H * 0.48, Math.min(W, H) * 0.3, W / 2, H * 0.48, Math.hypot(W, H) * 0.62);
  vig.addColorStop(0, 'rgba(0,0,0,0)'); vig.addColorStop(1, `rgba(0,0,0,${grade.vignette})`);
  g.fillStyle = vig; g.fillRect(0, 0, W, H);
}

/** Poussières, braises ou étoiles : deux profondeurs (les proches bougent plus vite et sont plus floues). */
export class Ambience {
  private motes: Array<{ x: number; y: number; z: number; s: number; vx: number; vy: number; p: number }> = [];

  constructor(private kind: 'embers' | 'dust' | 'stars', count = 36) {
    for (let i = 0; i < count; i++) this.motes.push({ x: Math.random(), y: Math.random(), z: Math.random() < 0.3 ? 1 : 0, s: Math.random(), vx: Math.random() - 0.5, vy: Math.random(), p: Math.random() * 6 });
  }

  draw(ctx: CanvasRenderingContext2D, W: number, H: number, dt: number, now: number): void {
    const color = this.kind === 'embers' ? '255,160,80' : this.kind === 'dust' ? '255,225,170' : '245,232,210';
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const m of this.motes) {
      const speed = (m.z ? 1.8 : 1) * (this.kind === 'stars' ? 0 : 1);
      m.x += (m.vx * 0.012 + (this.kind === 'dust' ? 0.004 : 0)) * speed * dt;
      m.y -= (this.kind === 'embers' ? 0.05 + m.vy * 0.06 : m.vy * 0.012) * speed * dt;
      if (m.y < -0.02) { m.y = 1.02; m.x = Math.random(); }
      if (m.x < -0.02) m.x = 1.02; else if (m.x > 1.02) m.x = -0.02;
      const tw = this.kind === 'stars' ? 0.35 + 0.65 * Math.abs(Math.sin(now / 900 + m.p)) : 0.5 + 0.5 * Math.sin(now / 500 + m.p);
      const r = (this.kind === 'stars' ? 0.6 + m.s * 0.9 : 0.8 + m.s * 1.8) * (m.z ? 1.8 : 1);
      const x = m.x * W, y = m.y * (this.kind === 'stars' ? H * 0.55 : H);
      const a = (m.z ? 0.35 : 0.55) * tw;
      const glow = ctx.createRadialGradient(x, y, 0, x, y, r * 3);
      glow.addColorStop(0, `rgba(${color},${a})`); glow.addColorStop(1, `rgba(${color},0)`);
      ctx.fillStyle = glow;
      ctx.fillRect(x - r * 3, y - r * 3, r * 6, r * 6);
    }
    ctx.restore();
  }
}

export interface Pop { x: number; y: number; t: number; text: string; color: string; big?: boolean }

const DISPLAY_FONT = (() => {
  try { return getComputedStyle(document.documentElement).getPropertyValue('--display').trim() || 'Georgia, serif'; } catch { return 'Georgia, serif'; }
})();

/** Secousse, éclair et gains qui jaillissent : à appeler autour du dessin de la scène. */
export class Juice {
  private shakeT = 0;
  private shakeAmp = 0;
  private flashA = 0;
  private flashColor = '255,220,140';
  readonly pops: Pop[] = [];

  /** Secousse d'écran (amplitude en pixels CSS). */
  kick(amp = 8, time = 0.25): void { this.shakeAmp = Math.max(this.shakeAmp, amp); this.shakeT = Math.max(this.shakeT, time); }
  /** Éclair plein écran très court ; `rgb` « r,g,b ». */
  flash(rgb: string, alpha = 0.35): void { this.flashColor = rgb; this.flashA = Math.max(this.flashA, alpha); }
  pop(x: number, y: number, text: string, color: string, big = false): void { this.pops.push({ x, y, t: 0, text, color, big }); }

  /** Avant le dessin de la scène : décale tout pendant une secousse. */
  begin(ctx: CanvasRenderingContext2D, dt: number): void {
    ctx.save();
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      const a = this.shakeAmp * Math.max(0, this.shakeT) * 4;
      ctx.translate((Math.random() - 0.5) * a, (Math.random() - 0.5) * a);
      if (this.shakeT <= 0) this.shakeAmp = 0;
    }
  }

  /** Après le dessin de la scène : gains, puis éclair par-dessus. */
  end(ctx: CanvasRenderingContext2D, W: number, H: number, dt: number): void {
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const p of this.pops) {
      p.t += dt;
      const k = Math.min(1, p.t / 0.18);
      const scale = k < 1 ? 0.5 + 0.7 * k : 1.2 - Math.min(0.2, (p.t - 0.18) * 0.6);
      const size = (p.big ? 34 : 26) * scale;
      ctx.globalAlpha = Math.max(0, 1 - Math.max(0, p.t - 0.5) / 0.6);
      ctx.font = `700 ${size.toFixed(1)}px ${DISPLAY_FONT}`;
      const y = p.y - p.t * 46;
      ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(14,9,10,0.85)'; ctx.lineJoin = 'round';
      ctx.strokeText(p.text, p.x, y);
      ctx.fillStyle = p.color; ctx.fillText(p.text, p.x, y);
    }
    ctx.globalAlpha = 1;
    for (let i = this.pops.length - 1; i >= 0; i--) if (this.pops[i].t > 1.1) this.pops.splice(i, 1);
    ctx.restore();
    if (this.flashA > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgba(${this.flashColor},${this.flashA})`;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
      this.flashA = Math.max(0, this.flashA - dt * 2.2);
    }
  }
}

/** Ligne « pouvoirs actifs » pour l'écran d'intro d'un jeu (rien si le stade n'apporte rien à ce jeu). */
export function powerNote(stage: string | undefined, gameId: string): HTMLElement | null {
  const effects = stage ? gameEffects(stage, gameId) : [];
  if (!effects.length) return null;
  return h('ul', { class: 'game-powers', 'aria-label': 'Pouvoirs actifs' }, ...effects.map(e => h('li', null, e)));
}

/**
 * Fin de partie commune à tous les mini-jeux : le dragon saute de joie, les étoiles s'allument une à une
 * (au moins une : on ne rate jamais tout), le score défile jusqu'à sa valeur, puis la phrase du dragon.
 * Sons : une pièce par étoile, la petite fanfare seulement pour trois étoiles (pas la nuit).
 */
export function endCard(o: {
  score: number; stars: number; dragon?: string; lines: Array<string | HTMLElement | null>;
  record?: boolean; button?: string; onDone: () => void;
}): HTMLElement {
  const stars = Math.max(1, Math.min(3, Math.round(o.stars)));
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const night = document.documentElement.hasAttribute('data-night-soft');
  const scoreEl = h('span', { class: 'ge-score' }, calm ? String(o.score) : '0');
  const starEls = [0, 1, 2].map(i => h('span', { class: `ge-star${i < stars ? ' on' : ''}`, style: `--d:${0.35 + i * 0.32}s` }));
  const box = h('div', { class: `game-intro game-end ge${stars === 3 ? ' ge-top' : ''}${o.dragon ? ' ge-has-dragon' : ''}` },
    o.dragon ? h('img', { class: 'ge-dragon', src: o.dragon, alt: '' }) : null,
    h('div', { class: 'ge-stars', 'aria-label': `${stars} étoile${stars > 1 ? 's' : ''} sur 3` }, ...starEls),
    h('h2', null, scoreEl, ` point${o.score > 1 ? 's' : ''}`),
    o.record ? h('p', { class: 'ge-record' }, 'Nouveau record !') : null,
    ...o.lines.filter((x): x is string | HTMLElement => !!x).map(x => typeof x === 'string' ? h('p', null, x) : x),
    h('button', { class: 'btn primary', onclick: () => { Sound.ui('tap'); o.onDone(); } }, o.button ?? 'Retour au dragon'));
  if (!calm) {
    // score qui défile (0,8 s), étoiles qui sonnent au moment où elles s'allument
    const t0 = performance.now();
    const roll = (now: number) => {
      const k = Math.min(1, (now - t0) / 800);
      scoreEl.textContent = String(Math.round(o.score * (1 - Math.pow(1 - k, 3))));
      if (k < 1 && box.isConnected) requestAnimationFrame(roll);
    };
    requestAnimationFrame(roll);
  }
  for (let i = 0; i < stars; i++) setTimeout(() => { if (box.isConnected) Sound.ui('coin'); }, calm ? 0 : (350 + i * 320));
  if (stars === 3 && !night) setTimeout(() => { if (box.isConnected) Sound.ui('success'); }, calm ? 0 : 1350);
  if (navigator.vibrate) navigator.vibrate(stars === 3 ? [20, 60, 20, 60, 40] : 20);
  return box;
}

/** Étoiles d'une partie : 1 pour avoir joué, 2 au-delà de « bien », 3 au-delà de « très bien ». */
export function starsFor(score: number, good: number, great: number): number { return score >= great ? 3 : score >= good ? 2 : 1; }

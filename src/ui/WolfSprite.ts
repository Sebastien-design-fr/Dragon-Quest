// Le loup compagnon, vivant : l'illustration peinte est déformée en fines bandes verticales, comme les dragons
// (respiration du torse, tête qui bouge doucement, queue qui se balance, oreilles qui frémissent de temps en temps).
// Course : petits bonds et queue plus rapide. Sans illustration, repli sur le dessin vectoriel.
import { Assets } from '../engine/AssetManager.js';
import { wolfImage } from './WolfArt.js';

export interface WolfPose { run: boolean; mirror: boolean; bag: boolean; happy: boolean; sleep: boolean }

const BAG = (() => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 50"><path d="M14 10 C20 0 40 0 46 10" stroke="#5a341a" stroke-width="4" fill="none"/>
  <rect x="6" y="12" width="48" height="34" rx="9" fill="#8a5630" stroke="#4a2a14" stroke-width="3"/><path d="M6 24 C20 32 40 32 54 24 L54 18 C40 26 20 26 6 18 Z" fill="#a8703f"/><circle cx="30" cy="28" r="4" fill="#f2c14e"/></svg>`;
  const im = new Image(); im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); return im;
})();

/** Courbe en cloche (0..1) centrée sur c, de demi-largeur w. */
const bell = (x: number, c: number, w: number) => { const d = (x - c) / w; return d * d >= 1 ? 0 : (1 - d * d) * (1 - d * d); };
const smooth = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export class WolfSprite {
  readonly canvas: HTMLCanvasElement;
  private img = new Image();
  private ready = false;
  /** Rapport largeur / hauteur de l'illustration. */
  aspect = 900 / 626;
  private twitchAt = 0;

  constructor() {
    this.canvas = document.createElement('canvas');
    const painted = Assets.art('companions/wolf');
    this.img.decoding = 'async';
    this.img.onload = () => { this.ready = true; this.aspect = this.img.naturalWidth / this.img.naturalHeight; };
    this.img.src = painted ?? wolfImage('run2', false);
  }

  /** Dessine le loup (taille en pixels CSS) au temps t (secondes). */
  draw(w: number, h: number, t: number, p: WolfPose): void {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cw = Math.max(1, Math.round(w * dpr)), ch = Math.max(1, Math.round(h * dpr * 1.12));
    const c = this.canvas;
    if (c.width !== cw || c.height !== ch) { c.width = cw; c.height = ch; }
    c.style.width = `${w}px`; c.style.height = `${h * 1.12}px`;
    const g = c.getContext('2d')!;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, cw, ch);
    if (!this.ready) return;
    const top = ch - h * dpr;          // marge au-dessus pour la respiration et les bonds
    const W = w * dpr, H = h * dpr;
    // ombre au sol
    g.fillStyle = 'rgba(0,0,0,.3)';
    g.beginPath(); g.ellipse(W * 0.52, ch - H * 0.025, W * 0.36, H * 0.045, 0, 0, Math.PI * 2); g.fill();
    if (p.mirror) { g.translate(cw, 0); g.scale(-1, 1); }

    const breathT = p.sleep ? 4.6 : p.run ? 0.9 : 3.2;
    const b = Math.sin((t * Math.PI * 2) / breathT);
    const wag = p.run ? 6 : p.happy ? 4.5 : p.sleep ? 0.4 : 1.1;
    const wagAmp = p.run ? 0.035 : p.happy ? 0.05 : 0.018;
    const hop = p.run ? Math.abs(Math.sin(t * Math.PI * 3.2)) * H * 0.09 : 0;
    // oreilles : petit frémissement de temps en temps
    if (!p.run && !p.sleep && t > this.twitchAt + 4 + Math.random() * 6) this.twitchAt = t;
    const tw = t - this.twitchAt < 0.35 ? Math.sin((t - this.twitchAt) * Math.PI * 6) : 0;

    const iw = this.img.naturalWidth, ih = this.img.naturalHeight;
    const strips = Math.max(24, Math.min(120, Math.round(W / 3)));
    const sw = iw / strips, dw = W / strips;
    for (let i = 0; i < strips; i++) {
      const x = (i + 0.5) / strips;            // 0 = bout de la queue, 1 = museau
      // respiration : le torse gonfle (ancré au sol)
      const sy = 1 + (p.sleep ? 0.03 : 0.022) * b * bell(x, 0.5, 0.3);
      // queue : balancement vertical, plus fort vers le bout
      const tail = (1 - smooth(0, 0.32, x)) ** 2;
      let dy = Math.sin(t * Math.PI * 2 * (wag / 2) + x * 3) * wagAmp * H * tail;
      // tête : léger mouvement décalé de la respiration, frémissement des oreilles
      const head = smooth(0.62, 0.8, x);
      dy += Math.sin((t * Math.PI * 2) / breathT + 0.9) * H * 0.012 * head;
      dy += tw * H * 0.012 * bell(x, 0.78, 0.08);
      if (p.sleep) dy += H * 0.06 * head; // tête baissée quand il dort
      const dh = H * sy;
      g.drawImage(this.img, i * sw, 0, sw + 0.6, ih, i * dw, top + (H - dh) + dy - hop, dw + 0.6, dh);
    }
    if (p.bag && BAG.complete) {
      const bw = W * 0.16;
      g.drawImage(BAG, W * 0.42, top + H * (0.3 + 0.012 * b) - hop, bw, bw * 50 / 60);
    }
  }
}

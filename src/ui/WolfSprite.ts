// Le loup compagnon, vivant : l'illustration peinte est déformée en fines bandes verticales, comme les dragons
// (respiration du torse, tête qui bouge doucement, queue qui se balance, oreilles qui frémissent de temps en temps).
// Course : petits bonds et queue plus rapide. Sans illustration, repli sur le dessin vectoriel.
import { Assets } from '../engine/AssetManager.js';
import { wolfImage } from './WolfArt.js';

export interface WolfPose { run: boolean; mirror: boolean; bag: boolean; happy: boolean; sleep: boolean; wear?: string[] }

const BAG = (() => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 50"><path d="M14 10 C20 0 40 0 46 10" stroke="#5a341a" stroke-width="4" fill="none"/>
  <rect x="6" y="12" width="48" height="34" rx="9" fill="#8a5630" stroke="#4a2a14" stroke-width="3"/><path d="M6 24 C20 32 40 32 54 24 L54 18 C40 26 20 26 6 18 Z" fill="#a8703f"/><circle cx="30" cy="28" r="4" fill="#f2c14e"/></svg>`;
  const im = new Image(); im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); return im;
})();

/** Accessoires peints : [centre x, centre y, largeur, rotation°] sur l'illustration du loup. */
const PAINTED_BOX: Record<string, [number, number, number, number]> = {
  collier_cuir: [0.775, 0.48, 0.24, -12], collier_or: [0.775, 0.48, 0.25, -12],
  foulard_rouge: [0.775, 0.53, 0.25, -8], foulard_bleu: [0.775, 0.53, 0.25, -8],
  medaille: [0.79, 0.61, 0.07, 0]
};

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

  private painted = new Map<string, HTMLImageElement | null>();
  /** Illustration peinte d'un accessoire (assets/companions/acc_<id>.webp), sinon null. */
  private accImage(id: string): HTMLImageElement | null {
    if (!this.painted.has(id)) {
      const src = Assets.art('companions/acc_' + id);
      if (!src) this.painted.set(id, null);
      else { const im = new Image(); im.src = src; this.painted.set(id, im); }
    }
    const im = this.painted.get(id);
    return im && im.complete && im.naturalWidth ? im : null;
  }

  /** Accessoire posé sur le loup (cou, médaille) ; la sacoche est dessinée à part. */
  private drawAccessory(g: CanvasRenderingContext2D, id: string, W: number, H: number, top: number, dy: number, b: number, hop: number): void {
    if (id === 'sacoche') return;
    const X = (u: number) => u * W, Y = (v: number) => top + v * H + dy;
    const im = this.accImage(id);
    if (im) {
      // centre (fractions du loup), largeur (fraction de W), rotation (degrés) : réglés sur l'illustration du loup
      const [cx, cy, fw, rot] = PAINTED_BOX[id] ?? PAINTED_BOX.collier_cuir;
      const bw = fw * W, bh = bw * im.naturalHeight / im.naturalWidth;
      g.save(); g.translate(X(cx), Y(cy)); g.rotate((rot * Math.PI) / 180);
      g.drawImage(im, -bw / 2, -bh / 2, bw, bh);
      g.restore();
      return;
    }
    void b; void hop;
    if (id.startsWith('foulard')) {
      const col = id === 'foulard_bleu' ? '#2c4f9e' : '#c8323a';
      g.fillStyle = col; g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = Math.max(1, W * 0.004);
      g.beginPath(); g.moveTo(X(0.61), Y(0.44)); g.quadraticCurveTo(X(0.71), Y(0.52), X(0.81), Y(0.46)); g.lineTo(X(0.72), Y(0.68)); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = 'rgba(255,255,255,.18)'; g.beginPath(); g.moveTo(X(0.66), Y(0.5)); g.lineTo(X(0.72), Y(0.66)); g.lineTo(X(0.7), Y(0.5)); g.fill();
      g.fillStyle = col; g.beginPath(); g.arc(X(0.63), Y(0.46), W * 0.018, 0, Math.PI * 2); g.fill(); g.stroke();
      return;
    }
    if (id.startsWith('collier')) {
      const gold = id === 'collier_or';
      g.strokeStyle = gold ? '#e3b23c' : '#6b3f1e'; g.lineWidth = H * 0.035; g.lineCap = 'round';
      g.beginPath(); g.moveTo(X(0.62), Y(0.43)); g.quadraticCurveTo(X(0.71), Y(0.56), X(0.8), Y(0.47)); g.stroke();
      g.strokeStyle = gold ? '#fff0b0' : '#9c6b3c'; g.lineWidth = H * 0.008;
      g.beginPath(); g.moveTo(X(0.63), Y(0.425)); g.quadraticCurveTo(X(0.71), Y(0.54), X(0.79), Y(0.46)); g.stroke();
      if (gold) for (const u of [0.66, 0.71, 0.76]) { g.fillStyle = '#3cc2e2'; g.beginPath(); g.arc(X(u), Y(u === 0.71 ? 0.505 : 0.49), H * 0.012, 0, Math.PI * 2); g.fill(); }
      else { g.strokeStyle = '#c9c9d4'; g.lineWidth = H * 0.008; g.beginPath(); g.arc(X(0.71), Y(0.52), H * 0.018, 0, Math.PI * 2); g.stroke(); }
      return;
    }
    if (id === 'medaille') {
      g.strokeStyle = '#8a6a2a'; g.lineWidth = H * 0.006; g.beginPath(); g.moveTo(X(0.71), Y(0.5)); g.lineTo(X(0.71), Y(0.565)); g.stroke();
      const r = H * 0.04, cx = X(0.71), cy = Y(0.6);
      const gr = g.createRadialGradient(cx - r * 0.3, cy - r * 0.3, 1, cx, cy, r);
      gr.addColorStop(0, '#fff3c0'); gr.addColorStop(0.5, '#e3b23c'); gr.addColorStop(1, '#8a5a12');
      g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(90,50,10,.7)'; g.lineWidth = H * 0.005; g.beginPath(); g.arc(cx, cy, r * 0.62, 0, Math.PI * 2); g.stroke();
    }
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
    // décalage vertical de la zone du cou (suit la tête et la respiration)
    const neckDy = Math.sin((t * Math.PI * 2) / breathT + 0.9) * H * 0.012 * smooth(0.62, 0.8, 0.72) + (p.sleep ? H * 0.06 * smooth(0.62, 0.8, 0.72) : 0) - hop;
    const wear = p.wear ?? [];
    const order = (id: string) => id === 'medaille' ? 2 : id.startsWith('collier') ? 1 : 0;
    for (const id of [...wear].sort((a, z) => order(a) - order(z))) this.drawAccessory(g, id, W, H, top, neckDy, b, hop);
    const bigBag = wear.includes('sacoche');
    const paintedBag = this.accImage('sacoche');
    if ((p.bag || bigBag) && paintedBag) {
      // sacoche peinte sur le flanc (plus grande quand c'est l'accessoire acheté)
      const bw = W * (bigBag ? 0.17 : 0.13), bh = bw * paintedBag.naturalHeight / paintedBag.naturalWidth;
      g.drawImage(paintedBag, W * 0.48 - bw / 2, top + H * (0.5 + 0.012 * b) - bh / 2 - hop, bw, bh);
    } else if ((p.bag || bigBag) && BAG.complete) {
      const bw = W * (bigBag ? 0.2 : 0.16);
      g.drawImage(BAG, W * (bigBag ? 0.39 : 0.42), top + H * ((bigBag ? 0.26 : 0.3) + 0.012 * b) - hop, bw, bw * 50 / 60);
    }
  }
}

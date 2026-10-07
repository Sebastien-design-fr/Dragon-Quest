// Décor derrière le dragon (un par stade) : image peinte si elle existe (assets/backgrounds/bg_<stade>),
// sinon un décor de grotte dessiné. Par-dessus : lueurs qui vacillent et particules d'ambiance.
// Le décor bouge à peine avec la caméra (parallaxe) pour donner de la profondeur.
import type { Mat2D } from '../core/math.js';

export interface BackdropDef {
  floor: number;
  ambient: 'motes' | 'embers' | 'crystals' | 'gold';
  warm: string;
  cool: string;
  lights: Array<{ x: number; y: number; r: number; color: string; flicker: number }>;
}

interface Mote { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number }

export class Backdrop {
  private def: BackdropDef | null = null;
  private img: HTMLImageElement | HTMLCanvasElement | null = null;
  private painted: HTMLCanvasElement | null = null;
  private paintedKey = '';
  private motes: Mote[] = [];
  private stageId = '';
  /** Nuit : décor assombri et bleuté. */
  night = 0;

  setStage(stageId: string, def: BackdropDef | null, imagePath: string | null): void {
    this.stageId = stageId;
    this.def = def;
    this.img = null;
    this.painted = null;
    this.motes = [];
    if (imagePath) {
      const im = new Image();
      im.decoding = 'async';
      im.onload = () => { if (this.stageId === stageId) this.img = soften(im); };
      im.src = imagePath;
    }
  }

  /** feetY : position écran (pixels) du sol sous le dragon ; shiftX : décalage de caméra pour la parallaxe. */
  draw(ctx: CanvasRenderingContext2D, W: number, H: number, feetY: number, shiftX: number, time: number, dt: number, effects: boolean): void {
    const def = this.def;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (!def) return;
    const iw = this.img?.width || 1536, ih = this.img?.height || 1024;
    // « cover » un peu agrandi (marge pour la parallaxe et la respiration lente)
    const zoom = 1.06 + Math.sin(time * 0.05) * 0.01;
    const s = Math.max(W / iw, H / ih) * zoom;
    const dw = iw * s, dh = ih * s;
    let top = feetY - def.floor * dh;
    top = Math.min(0, Math.max(H - dh, top));
    const left = (W - dw) / 2 - shiftX * 0.15;
    if (this.img) ctx.drawImage(this.img, left, top, dw, dh);
    else ctx.drawImage(this.paint(def, Math.round(W), Math.round(H), feetY), 0, 0);

    if (!effects) { this.nightTint(ctx, W, H); return; }
    // Lueurs (torches, braseros, lave…)
    ctx.globalCompositeOperation = 'lighter';
    for (const [i, l] of def.lights.entries()) {
      const f = 1 - l.flicker * 0.5 + l.flicker * 0.5 * (Math.sin(time * 9 + i * 2) * 0.5 + Math.sin(time * 13.7 + i) * 0.3 + 0.2);
      const x = left + l.x * dw, y = top + l.y * dh, r = l.r * Math.max(dw, dh) * 0.5;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(${l.color},${0.16 * f})`);
      g.addColorStop(1, `rgba(${l.color},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    ctx.globalCompositeOperation = 'source-over';
    this.ambient(ctx, W, H, dt, def.ambient);
    this.nightTint(ctx, W, H);
  }

  private nightTint(ctx: CanvasRenderingContext2D, W: number, H: number): void {
    if (this.night <= 0) return;
    ctx.fillStyle = `rgba(8,10,28,${0.45 * this.night})`;
    ctx.fillRect(0, 0, W, H);
  }

  /** Particules d'ambiance en espace écran : poussière, braises, éclats de cristal, paillettes d'or. */
  private ambient(ctx: CanvasRenderingContext2D, W: number, H: number, dt: number, kind: BackdropDef['ambient']): void {
    const want = kind === 'embers' || kind === 'gold' ? 26 : 18;
    while (this.motes.length < want) this.motes.push(this.spawn(W, H, kind, true));
    for (let i = 0; i < this.motes.length; i++) {
      const m = this.motes[i];
      m.life += dt; m.x += m.vx * dt; m.y += m.vy * dt;
      if (m.life > m.max || m.y < -10 || m.y > H + 10) { this.motes[i] = this.spawn(W, H, kind, false); continue; }
      const a = Math.sin(Math.PI * (m.life / m.max));
      const col = kind === 'embers' ? `rgba(255,${120 + (i % 5) * 20},50,${a * 0.85})`
        : kind === 'gold' ? `rgba(255,${200 + (i % 4) * 12},110,${a * 0.9})`
        : kind === 'crystals' ? `rgba(150,200,255,${a * 0.7})`
        : `rgba(230,215,190,${a * 0.35})`;
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(m.x, m.y, m.size, 0, Math.PI * 2); ctx.fill();
    }
  }

  private spawn(W: number, H: number, kind: BackdropDef['ambient'], anywhere: boolean): Mote {
    const rising = kind === 'embers' || kind === 'gold';
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    return {
      x: Math.random() * W,
      y: anywhere ? Math.random() * H : rising ? H + 5 : Math.random() * H,
      vx: (Math.random() - 0.5) * 12 * dpr,
      vy: (rising ? -(18 + Math.random() * 30) : (Math.random() - 0.5) * 6) * dpr,
      life: anywhere ? Math.random() * 4 : 0,
      max: 3 + Math.random() * 5,
      size: (rising ? 0.8 + Math.random() * 1.6 : 0.6 + Math.random() * 1.4) * dpr
    };
  }

  /** Décor de secours dessiné (en attendant les images peintes), mis en cache par taille. */
  private paint(def: BackdropDef, W: number, H: number, feetY: number): HTMLCanvasElement {
    const key = `${W}x${H}x${Math.round(feetY)}`;
    if (this.painted && this.paintedKey === key) return this.painted;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d')!;
    const floorY = Math.min(H * 0.95, feetY);
    const bg = g.createRadialGradient(W * 0.5, floorY - H * 0.25, 10, W * 0.5, floorY - H * 0.25, Math.max(W, H) * 0.8);
    bg.addColorStop(0, def.warm); bg.addColorStop(0.45, mixHex(def.warm, def.cool, 0.6)); bg.addColorStop(1, '#0b0a0d');
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    // parois rocheuses lointaines
    let seed = 11;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    for (let layer = 0; layer < 3; layer++) {
      g.fillStyle = `rgba(10,8,12,${0.35 + layer * 0.2})`;
      g.beginPath(); g.moveTo(0, 0);
      const steps = 14;
      for (let i = 0; i <= steps; i++) {
        const x = (W * i) / steps;
        const edge = Math.abs(i / steps - 0.5) * 2; // plus bas sur les côtés
        g.lineTo(x, H * (0.08 + 0.08 * layer) + edge * H * (0.25 + 0.1 * layer) + rnd() * H * 0.05);
      }
      g.lineTo(W, 0); g.closePath(); g.fill();
      // piliers sur les côtés
      g.beginPath();
      g.moveTo(0, H); g.lineTo(0, H * 0.1);
      g.quadraticCurveTo(W * (0.08 + layer * 0.05), H * 0.5, W * (0.04 + layer * 0.04), floorY);
      g.lineTo(0, H); g.fill();
      g.beginPath();
      g.moveTo(W, H); g.lineTo(W, H * 0.1);
      g.quadraticCurveTo(W * (0.92 - layer * 0.05), H * 0.5, W * (0.96 - layer * 0.04), floorY);
      g.lineTo(W, H); g.fill();
    }
    // sol
    const fl = g.createLinearGradient(0, floorY - H * 0.06, 0, H);
    fl.addColorStop(0, mixHex(def.warm, '#000000', 0.55)); fl.addColorStop(1, '#0b0a0d');
    g.fillStyle = fl;
    g.beginPath(); g.moveTo(0, floorY + H * 0.02); g.quadraticCurveTo(W / 2, floorY - H * 0.07, W, floorY + H * 0.02); g.lineTo(W, H); g.lineTo(0, H); g.fill();
    // cailloux
    for (let i = 0; i < 14; i++) {
      const x = rnd() * W, y = floorY + rnd() * (H - floorY);
      g.fillStyle = `rgba(${30 + rnd() * 30},${24 + rnd() * 20},${22 + rnd() * 20},0.8)`;
      g.beginPath(); g.ellipse(x, y, 3 + rnd() * 10, 2 + rnd() * 4, 0, 0, Math.PI * 2); g.fill();
    }
    // vignette
    const v = g.createRadialGradient(W / 2, H * 0.55, Math.min(W, H) * 0.3, W / 2, H * 0.55, Math.max(W, H) * 0.75);
    v.addColorStop(0, 'rgba(11,10,13,0)'); v.addColorStop(1, 'rgba(11,10,13,0.9)');
    g.fillStyle = v; g.fillRect(0, 0, W, H);
    this.painted = c; this.paintedKey = key;
    return c;
  }
}

/** Profondeur de champ : décor légèrement flou et assombri pour que le dragon ressorte. */
function soften(im: HTMLImageElement): HTMLCanvasElement | HTMLImageElement {
  try {
    const c = document.createElement('canvas');
    c.width = im.naturalWidth; c.height = im.naturalHeight;
    const g = c.getContext('2d')!;
    g.filter = 'blur(2px) brightness(0.8) saturate(0.95)';
    g.drawImage(im, 0, 0);
    return c;
  } catch { return im; }
}

function mixHex(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = (p: number, s: number) => (p >> s) & 255;
  const m = (s: number) => Math.round(ch(pa, s) * (1 - t) + ch(pb, s) * t);
  return `rgb(${m(16)},${m(8)},${m(0)})`;
}

export type { Mat2D };

// Décor derrière le dragon (un par stade) : image peinte si elle existe (assets/backgrounds/bg_<stade>),
// sinon un décor de grotte dessiné. Par-dessus : lueurs qui vacillent et particules d'ambiance.
// Le décor bouge à peine avec la caméra (parallaxe) pour donner de la profondeur.
// RÈGLE : l'image du décor est affichée telle quelle (ni flou, ni assombrissement, ni zoom animé).
// Les ambiances (lueurs, poussières, teinte de nuit) sont des couches séparées, désactivables.
import { NightSky } from './NightSky.js';
import type { Mat2D } from '../core/math.js';
import { NEUTRAL_SCENE, analyseScene, type SceneLight } from './Lighting.js';

export interface BackdropDef {
  floor: number;
  ambient: 'motes' | 'embers' | 'crystals' | 'gold';
  warm: string;
  cool: string;
  lights: Array<{ x: number; y: number; r: number; color: string; flicker: number }>;
  /** Force du reflet des personnages sur le sol (0 = sol mat ; 0.3 par défaut : pierre humide). */
  reflect?: number;
  /** Ciel ouvert visible dans l'illustration [x0, y0, x1, y1] (fractions) : étoiles la nuit. */
  sky?: [number, number, number, number];
  /** Coins du décor qui réagissent au doigt (fractions de l'image). */
  touch?: Array<{ x: number; y: number; r: number; kind: 'torch' | 'crystal' | 'water' | 'lava' | 'gold' }>;
}

interface Mote { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number }

export class Backdrop {
  private def: BackdropDef | null = null;
  private img: HTMLImageElement | HTMLCanvasElement | null = null;
  private painted: HTMLCanvasElement | null = null;
  /** Décor mis une fois à la taille de l'écran (rééchantillonnage de qualité), puis recopié pixel pour pixel. */
  private scaled: HTMLCanvasElement | null = null;
  private scaledKey = '';
  private paintedKey = '';
  private motes: Mote[] = [];
  private stageId = '';
  /** Décor précédent, en fondu enchaîné vers le nouveau (changement de stade, évolution). */
  private prev: { img: CanvasImageSource; x: number; y: number; w: number; h: number; a: number } | null = null;
  private lastRect: { x: number; y: number; w: number; h: number } | null = null;
  /** Hauteur affichée du décor peint (pixels) : unité de placement des objets de la grotte. */
  get displayHeight(): number | null { return this.lastRect?.h ?? null; }
  /** Durée du fondu entre deux décors (s). */
  fadeTime = 1.2;
  /** Nuit : voile bleuté posé par-dessus le décor (couche séparée). */
  night = 0;
  /** Inclinaison du téléphone (-1..1) : le décor glisse un peu, le dragon reste au premier plan. */
  tilt = { x: 0, y: 0 };
  /** Glissement dû à l'inclinaison à la dernière image (pixels) : les objets posés de la grotte le suivent. */
  tiltShift = 0;
  /** Étoiles et étoiles filantes, là où le décor montre du ciel. */
  readonly sky = new NightSky();
  /** Heure forcée (0-24) pour les tests ; null = heure réelle. */
  hourOverride: number | null = null;
  private rays: HTMLCanvasElement | null = null;
  private raysKey = '';
  private flies: Array<{ x: number; y: number; vx: number; vy: number; p: number }> = [];
  /** Couches d'ambiance indépendantes du décor, désactivables une par une. */
  readonly layers = { lights: true, motes: true, tint: true };
  /** Lumière de la scène, mesurée sur l'image du décor (lecture seule). */
  scene: SceneLight = { ...NEUTRAL_SCENE };
  sceneOverrides: Partial<SceneLight> | undefined;

  setStage(stageId: string, def: BackdropDef | null, imagePath: string | null): void {
    if (stageId !== this.stageId && this.img && this.lastRect) {
      // l'ancien décor reste affiché tel quel (même cadrage) jusqu'à ce que le nouveau soit prêt, puis s'efface
      this.prev = { img: this.scaled ?? this.img, ...this.lastRect, a: 1 };
    }
    this.stageId = stageId;
    this.def = def;
    this.img = null;
    this.painted = null;
    this.scaled = null; this.scaledKey = '';
    this.scene = { ...NEUTRAL_SCENE, ...this.sceneOverrides };
    this.motes = [];
    if (imagePath) {
      const im = new Image();
      im.decoding = 'async';
      im.onload = () => { if (this.stageId === stageId) { this.img = im; this.scene = analyseScene(im, def?.floor ?? 0.75, this.sceneOverrides); this.sky.analyse(im, def?.sky); } };
      im.src = imagePath;
    }
  }

  /** feetY : position écran (pixels) du sol sous le dragon ; shiftX : décalage de caméra pour la parallaxe. */
  draw(ctx: CanvasRenderingContext2D, W: number, H: number, feetY: number, shiftX: number, time: number, dt: number, effects: boolean): void {
    const def = this.def;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (!def) return;
    const iw = this.img?.width || 1536, ih = this.img?.height || 1024;
    // « cover » exact : la scène est remplie sans bandes (recadrage minimal nécessaire), image non modifiée
    // léger débord (6 %) : de la marge pour que le décor glisse avec l'inclinaison sans laisser de bord vide
    const s = Math.max(W / iw, H / ih) * 1.06;
    const dw = iw * s, dh = ih * s;
    let top = feetY - def.floor * dh;
    top = Math.min(0, Math.max(H - dh, top));
    const clampX = (x: number) => Math.min(0, Math.max(W - dw, x));
    const still = clampX((W - dw) / 2 - shiftX * 0.15);
    // seul le glissement horizontal : le sol peint reste sous les pattes
    const left = clampX(still - this.tilt.x * (dw - W) * 0.45);
    this.tiltShift = left - still;
    const prev = this.prev;
    if (this.img) {
      ctx.drawImage(this.fit(this.img, dw, dh), Math.round(left), Math.round(top));
      this.lastRect = { x: Math.round(left), y: Math.round(top), w: Math.round(dw), h: Math.round(dh) };
    } else if (!prev) ctx.drawImage(this.paint(def, Math.round(W), Math.round(H), feetY), 0, 0);
    if (prev) {
      if (this.img) prev.a -= dt / Math.max(0.01, this.fadeTime);
      if (prev.a <= 0) this.prev = null;
      else {
        ctx.globalAlpha = this.img ? prev.a * prev.a * (3 - 2 * prev.a) : 1;
        ctx.drawImage(prev.img, prev.x, prev.y, prev.w, prev.h);
        ctx.globalAlpha = 1;
      }
    }

    if (!effects) { this.nightTint(ctx, W, H); return; }
    if (this.layers.tint) this.daylight(ctx, W, H, time);
    // Lueurs (torches, braseros, lave…)
    ctx.globalCompositeOperation = 'lighter';
    if (this.layers.lights) for (const [i, l] of def.lights.entries()) {
      const f = 1 - l.flicker * 0.5 + l.flicker * 0.5 * (Math.sin(time * 9 + i * 2) * 0.5 + Math.sin(time * 13.7 + i) * 0.3 + 0.2);
      const x = left + l.x * dw, y = top + l.y * dh, r = l.r * Math.max(dw, dh) * 0.5;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(${l.color},${0.16 * f})`);
      g.addColorStop(1, `rgba(${l.color},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    ctx.globalCompositeOperation = 'source-over';
    if (this.layers.motes) this.ambient(ctx, W, H, dt, def.ambient);
    this.nightTint(ctx, W, H);
    if (this.img && this.layers.tint) this.sky.draw(ctx, { x: left, y: top, w: dw, h: dh }, this.starNight(), time, dt, Math.min(2, window.devicePixelRatio || 1));
    if (this.layers.motes) this.fireflies(ctx, W, H, dt, time);
  }

  /** Présence des étoiles : elles apparaissent au crépuscule (19 h 30-21 h) et s'effacent à l'aube (5 h 30-6 h 30). */
  starNight(): number {
    const h = this.hour();
    if (h >= 21 || h < 5.5) return 1;
    if (h >= 19.5) return (h - 19.5) / 1.5;
    if (h < 6.5) return 6.5 - h;
    return 0;
  }

  /** Coin du décor touché (pixels du canvas), avec sa position à l'écran ; null si rien. */
  touchAt(x: number, y: number): { kind: NonNullable<BackdropDef['touch']>[number]['kind']; x: number; y: number; fx: number } | null {
    const r = this.lastRect, list = this.def?.touch;
    if (!r || !list || !this.img) return null;
    let best: { kind: NonNullable<BackdropDef['touch']>[number]['kind']; x: number; y: number; fx: number } | null = null, bestD = Infinity;
    for (const t of list) {
      const cx = r.x + t.x * r.w, cy = r.y + t.y * r.h, rad = t.r * r.w;
      const d = Math.hypot(x - cx, y - cy);
      if (d < rad && d < bestD) { bestD = d; best = { kind: t.kind, x: cx, y: cy, fx: t.x }; }
    }
    return best;
  }

  /** Force du reflet sur le sol du décor courant. */
  get reflect(): number { return this.def ? this.def.reflect ?? 0.3 : 0; }

  /** Heure de la journée (décimale), réelle ou forcée. */
  private hour(): number {
    if (this.hourOverride !== null) return this.hourOverride;
    const d = new Date();
    return d.getHours() + d.getMinutes() / 60;
  }

  /**
   * Vacillement des torches et braseros du décor sur les personnages (0 = calme) : même formule que les lueurs,
   * pondérée par la force des flammes ; plus visible le soir, quand le jour ne les couvre plus.
   */
  torchFlicker(time: number): number {
    const def = this.def;
    if (!def || !this.layers.lights || !def.lights.length) return 0;
    let f = 0, n = 0;
    for (const [i, l] of def.lights.entries()) {
      if (l.flicker <= 0) continue;
      f += l.flicker * (Math.sin(time * 9 + i * 2) * 0.5 + Math.sin(time * 13.7 + i) * 0.3);
      n++;
    }
    if (!n) return 0;
    const h = this.hour();
    const evening = h >= 18 || h < 7 ? 1 : 0.5;
    return (f / n) * evening;
  }

  /**
   * Teinte du moment de la journée pour les personnages (dragon, loup) : la même lumière que le décor.
   * k = force du mélange (0 en pleine journée), ambient = couleur vers laquelle tirer, exposure = luminosité.
   */
  dayLight(): { ambient: [number, number, number]; k: number; exposure: number } {
    if (!this.layers.tint) return { ambient: [1, 1, 1], k: 0, exposure: 1 };
    const h = this.hour();
    const bell = (a: number, peak: number, b: number) => h <= a || h >= b ? 0 : h < peak ? (h - a) / (peak - a) : (b - h) / (b - peak);
    const morning = bell(6, 7.5, 10.5), evening = bell(17.5, 20, 22.5);
    if (morning >= evening) return { ambient: [1, 0.8, 0.55], k: 0.35 * morning, exposure: 1 + 0.05 * morning };
    return { ambient: [0.62, 0.36, 0.52], k: 0.4 * evening, exposure: 1 - 0.07 * evening };
  }

  /**
   * Lumière du jour, en couches séparées par-dessus le décor (l'image n'est jamais modifiée) :
   * matin (6 h-10 h) rayons dorés qui entrent par le haut de la grotte ; soir (17 h 30-22 h) voile ambré puis rosé.
   */
  private daylight(ctx: CanvasRenderingContext2D, W: number, H: number, time: number): void {
    const h = this.hour();
    const bell = (a: number, peak: number, b: number) => h <= a || h >= b ? 0 : h < peak ? (h - a) / (peak - a) : (b - h) / (b - peak);
    const morning = bell(6, 7.5, 10.5), evening = bell(17.5, 20, 22.5);
    if (morning > 0) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgba(255,200,120,${0.07 * morning})`;
      ctx.fillRect(0, 0, W, H);
      // rayons obliques adoucis (pré-rendus une fois par taille), qui respirent et glissent à peine
      ctx.globalAlpha = morning * (0.8 + 0.2 * Math.sin(time * 0.5));
      ctx.drawImage(this.rayLayer(W, H), Math.sin(time * 0.12) * W * 0.015, 0);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
    if (evening > 0) {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, `rgba(90,40,90,${0.22 * evening})`);
      g.addColorStop(1, `rgba(255,120,60,${0.12 * evening})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
  }

  /** Rayons de soleil du matin, flous, mis en cache par taille d'écran. */
  private rayLayer(W: number, H: number): HTMLCanvasElement {
    const key = `${Math.round(W)}x${Math.round(H)}`;
    if (this.rays && this.raysKey === key) return this.rays;
    const c = this.rays ?? document.createElement('canvas');
    c.width = Math.round(W); c.height = Math.round(H);
    const g = c.getContext('2d')!;
    g.clearRect(0, 0, W, H);
    g.filter = `blur(${Math.round(Math.max(W, H) * 0.02)}px)`;
    for (let i = 0; i < 4; i++) {
      const x0 = W * (0.06 + i * 0.2), w = W * (0.05 + (i % 2) * 0.04), len = H;
      const grd = g.createLinearGradient(x0, 0, x0 + len * 0.42, len);
      grd.addColorStop(0, `rgba(255,226,160,${0.6 - i * 0.07})`);
      grd.addColorStop(0.7, 'rgba(255,214,140,0.12)');
      grd.addColorStop(1, 'rgba(255,214,140,0)');
      g.fillStyle = grd;
      g.beginPath();
      g.moveTo(x0, -10); g.lineTo(x0 + w, -10);
      g.lineTo(x0 + w * 2.4 + len * 0.42, len); g.lineTo(x0 + len * 0.42, len);
      g.closePath(); g.fill();
    }
    g.filter = 'none';
    this.rays = c; this.raysKey = key;
    return c;
  }

  /** Lucioles le soir et la nuit : points vert doré qui errent et clignotent lentement. */
  private fireflies(ctx: CanvasRenderingContext2D, W: number, H: number, dt: number, time: number): void {
    const h = this.hour();
    const on = h >= 20.5 || h < 6.5 ? 1 : 0;
    if (!on) { this.flies.length = 0; return; }
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    while (this.flies.length < 14) this.flies.push({ x: Math.random() * W, y: H * (0.25 + Math.random() * 0.6), vx: 0, vy: 0, p: Math.random() * 10 });
    ctx.globalCompositeOperation = 'lighter';
    for (const f of this.flies) {
      f.vx += (Math.random() - 0.5) * 30 * dpr * dt; f.vy += (Math.random() - 0.5) * 30 * dpr * dt;
      f.vx *= 0.98; f.vy *= 0.98;
      f.x = (f.x + f.vx * dt + W) % W; f.y = Math.min(H * 0.92, Math.max(H * 0.15, f.y + f.vy * dt));
      const blink = Math.max(0, Math.sin(time * 1.3 + f.p)) ** 2;
      if (blink < 0.02) continue;
      const r = 10 * dpr;
      const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, r);
      g.addColorStop(0, `rgba(230,255,150,${0.9 * blink})`); g.addColorStop(0.3, `rgba(190,240,90,${0.45 * blink})`); g.addColorStop(1, 'rgba(160,220,60,0)');
      ctx.fillStyle = g; ctx.fillRect(f.x - r, f.y - r, r * 2, r * 2);
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  /** Copie du décor à la taille d'affichage, faite une seule fois par taille (pas de rééchantillonnage à chaque image). */
  private fit(img: HTMLImageElement | HTMLCanvasElement, dw: number, dh: number): HTMLCanvasElement | HTMLImageElement {
    const w = Math.round(dw), h = Math.round(dh);
    const key = `${w}x${h}`;
    if (this.scaled && this.scaledKey === key) return this.scaled;
    try {
      const c = this.scaled ?? document.createElement('canvas');
      c.width = w; c.height = h;
      const g = c.getContext('2d')!;
      g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
      g.drawImage(img, 0, 0, w, h);
      this.scaled = c; this.scaledKey = key;
      return c;
    } catch { return img; }
  }

  private nightTint(ctx: CanvasRenderingContext2D, W: number, H: number): void {
    if (this.night <= 0 || !this.layers.tint) return;
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

function mixHex(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = (p: number, s: number) => (p >> s) & 255;
  const m = (s: number) => Math.round(ch(pa, s) * (1 - t) + ch(pb, s) * t);
  return `rgb(${m(16)},${m(8)},${m(0)})`;
}

export type { Mat2D };

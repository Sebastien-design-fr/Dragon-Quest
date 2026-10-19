// Atmosphère de la grotte, en couches séparées par-dessus le décor (l'illustration n'est jamais modifiée) :
// - brume : deux nappes qui dérivent lentement, l'une derrière le dragon, l'autre au ras du sol devant ses pattes ;
//   un coup d'aile la déchire et la chasse ;
// - rayons de lumière : faisceaux doux qui tombent des ouvertures du décor, avec des grains de poussière qui y scintillent.

export interface ShaftDef { x: number; y: number; dx: number; dy: number; w: number; len: number }

/** Texture de brume (blobs doux), raccordable à l'horizontale, faite une seule fois. */
function mistTexture(): HTMLCanvasElement {
  const W = 512, H = 128;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d')!;
  let seed = 11;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 46; i++) {
    const x = rnd() * W, y = H * (0.3 + rnd() * 0.45), r = 30 + rnd() * 70, a = 0.25 + rnd() * 0.35;
    for (const ox of [-W, 0, W]) { // raccord gauche-droite
      const gr = g.createRadialGradient(x + ox, y, 0, x + ox, y, r);
      gr.addColorStop(0, `rgba(255,255,255,${a})`);
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr;
      g.fillRect(x + ox - r, y - r, r * 2, r * 2);
    }
  }
  return c;
}

export class Mist {
  private tex: HTMLCanvasElement | null = null;
  private tinted: HTMLCanvasElement | null = null;
  private tintKey = '';
  private off = { back: 0, front: 0 };
  /** Souffle d'un coup d'aile : vitesse ajoutée (px/s) et trouée (0..1), qui retombent. */
  private push = 0;
  private torn = 0;
  /** Densité selon le décor (0 = pas de brume). */
  density = 1;

  gust(power: number, fromLeft: boolean): void {
    this.push += (fromLeft ? 1 : -1) * 420 * power;
    this.torn = Math.min(1, this.torn + 0.7 * power);
  }

  /** Brume teintée selon l'heure, recalculée seulement quand la teinte change. */
  private texture(rgb: [number, number, number]): HTMLCanvasElement {
    const key = rgb.map(v => Math.round(v / 8)).join(',');
    if (this.tinted && key === this.tintKey) return this.tinted;
    const base = this.tex ?? (this.tex = mistTexture());
    const c = this.tinted ?? (this.tinted = document.createElement('canvas'));
    c.width = base.width; c.height = base.height;
    const g = c.getContext('2d')!;
    g.clearRect(0, 0, c.width, c.height);
    g.drawImage(base, 0, 0);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = `rgb(${rgb.join(',')})`;
    g.fillRect(0, 0, c.width, c.height);
    g.globalCompositeOperation = 'source-over';
    this.tintKey = key;
    return c;
  }

  update(dt: number): void {
    this.off.back += (5 + this.push * 0.25) * dt;
    this.off.front += (11 + this.push) * dt;
    this.push *= Math.exp(-dt * 1.6);
    this.torn *= Math.exp(-dt * 0.5);
  }

  /** layer : nappe du fond (derrière le dragon) ou du devant (au ras du sol). */
  draw(ctx: CanvasRenderingContext2D, layer: 'back' | 'front', W: number, H: number, groundY: number, tint: [number, number, number], shift: number, dpr: number): void {
    if (this.density <= 0) return;
    const tex = this.texture(tint);
    const front = layer === 'front';
    const h = (front ? 0.2 : 0.34) * H, top = front ? groundY - h * 0.45 : groundY - h * 0.85;
    const s = h / tex.height, tw = tex.width * s;
    const alpha = this.density * (front ? 0.16 : 0.2) * (1 - (front ? 0.85 : 0.4) * this.torn);
    if (alpha <= 0.005) return;
    const x0 = -(((this.off[layer] * dpr + shift * (front ? 1.6 : 0.6)) % tw) + tw) % tw;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = alpha;
    for (let x = x0 - tw; x < W; x += tw) ctx.drawImage(tex, x, top, tw + 1, h);
    ctx.globalAlpha = 1;
  }
}

/** Faisceau doux (pré-rendu une fois) : fort près de la source, qui s'efface en s'élargissant. */
function beamSprite(): HTMLCanvasElement {
  const L = 256, Wd = 64;
  const c = document.createElement('canvas');
  c.width = Wd; c.height = L;
  const g = c.getContext('2d')!;
  g.filter = 'blur(6px)';
  const grad = g.createLinearGradient(0, 0, 0, L);
  grad.addColorStop(0, 'rgba(255,255,255,0.9)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.4)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.beginPath(); // trapèze : étroit en haut, plus large en bas
  g.moveTo(Wd * 0.38, 0); g.lineTo(Wd * 0.62, 0); g.lineTo(Wd * 0.88, L); g.lineTo(Wd * 0.12, L); g.closePath();
  g.fill();
  return c;
}

export class LightShafts {
  private sprite: HTMLCanvasElement | null = null;
  private motes: Array<{ s: number; u: number; v: number; p: number }> = [];

  /** rect : où l'illustration est affichée ; k : force (0..1) ; color : teinte du faisceau. */
  draw(ctx: CanvasRenderingContext2D, defs: ShaftDef[], rect: { x: number; y: number; w: number; h: number }, k: number, color: string, time: number, dpr: number): void {
    if (!defs.length || k <= 0.01) return;
    const spr = this.sprite ?? (this.sprite = beamSprite());
    if (this.motes.length !== defs.length * 9) {
      let seed = 5;
      const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      this.motes = [];
      defs.forEach((_, s) => { for (let i = 0; i < 9; i++) this.motes.push({ s, u: rnd(), v: rnd() - 0.5, p: rnd() * 10 }); });
    }
    ctx.globalCompositeOperation = 'lighter';
    defs.forEach((d, i) => {
      const x = rect.x + d.x * rect.w, y = rect.y + d.y * rect.h;
      const len = d.len * rect.h, wid = d.w * rect.w * 2.6;
      const ang = Math.atan2(d.dy, d.dx) - Math.PI / 2;
      const breathe = 0.75 + 0.25 * Math.sin(time * 0.4 + i * 1.7);
      ctx.setTransform(Math.cos(ang), Math.sin(ang), -Math.sin(ang), Math.cos(ang), x, y);
      // le faisceau est teinté en dessinant le sprite blanc à travers un remplissage coloré
      ctx.globalAlpha = 0.26 * k * breathe;
      ctx.drawImage(this.tinted(spr, color), -wid / 2, 0, wid, len);
      // grains de poussière qui scintillent dans la lumière, en descendant lentement
      for (const m of this.motes) {
        if (m.s !== i) continue;
        const u = (m.u + time * 0.012) % 1;
        const tw = Math.max(0, Math.sin(time * 1.6 + m.p)) ** 3;
        if (tw < 0.05) continue;
        ctx.globalAlpha = 0.7 * k * tw * (1 - u);
        ctx.fillStyle = color;
        ctx.beginPath(); ctx.arc(m.v * wid * (0.3 + 0.5 * u), u * len, 1.3 * dpr, 0, Math.PI * 2); ctx.fill();
      }
    });
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  private tintCache: { color: string; c: HTMLCanvasElement } | null = null;
  private tinted(spr: HTMLCanvasElement, color: string): HTMLCanvasElement {
    if (this.tintCache?.color === color) return this.tintCache.c;
    const c = document.createElement('canvas');
    c.width = spr.width; c.height = spr.height;
    const g = c.getContext('2d')!;
    g.drawImage(spr, 0, 0);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = color;
    g.fillRect(0, 0, c.width, c.height);
    this.tintCache = { color, c };
    return c;
  }
}

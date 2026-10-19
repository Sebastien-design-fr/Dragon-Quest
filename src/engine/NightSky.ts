// Ciel de nuit : étoiles qui scintillent et étoiles filantes, seulement là où le décor peint montre du ciel.
// Le ciel est délimité à la main par décor (sky), puis affiné sur l'illustration (zones lisses et pas trop
// sombres) : on ne pose jamais d'étoile sur la roche. Dans une grotte fermée, un feu follet traverse la nuit
// à la place de l'étoile filante. L'un comme l'autre peut être touché : c'est un vœu (voir hitShootingStar).

interface Star { x: number; y: number; r: number; p: number; s: number }
interface Shooting { x: number; y: number; vx: number; vy: number; t: number; life: number; wisp: boolean }
export interface SkyRect { x: number; y: number; w: number; h: number }

const GW = 96, GH = 64; // grille d'analyse (une case ≈ 16 px de l'illustration)

export class NightSky {
  /** Cases de ciel (fractions de l'illustration : centre x, y). */
  private cells: Array<[number, number]> = [];
  private stars: Star[] = [];
  private shoot: Shooting | null = null;
  private nextShoot = 6;
  /** Dernière étoile filante visible, en pixels écran (pour le toucher), et son instant. */
  private lastSeen: { x: number; y: number; x2: number; y2: number; at: number } | null = null;
  /** Pour les tests : force la prochaine étoile filante. */
  forceNext = false;

  /** Repère le ciel dans le rectangle donné (fractions de l'illustration) : cases lisses, ni noires ni blanches. */
  analyse(img: HTMLImageElement | HTMLCanvasElement, sky: [number, number, number, number] | undefined): void {
    this.cells = []; this.stars = []; this.shoot = null;
    if (!sky) return;
    const c = document.createElement('canvas');
    const sw = GW * 4, sh = GH * 4;
    c.width = sw; c.height = sh;
    const g = c.getContext('2d', { willReadFrequently: true });
    if (!g) return;
    g.drawImage(img, 0, 0, sw, sh);
    let data: Uint8ClampedArray;
    try { data = g.getImageData(0, 0, sw, sh).data; } catch { return; }
    const [x0, y0, x1, y1] = sky;
    for (let cy = Math.floor(y0 * GH); cy < Math.ceil(y1 * GH); cy++) for (let cx = Math.floor(x0 * GW); cx < Math.ceil(x1 * GW); cx++) {
      let sum = 0, sum2 = 0, n = 0;
      for (let y = cy * 4; y < cy * 4 + 4; y++) for (let x = cx * 4; x < cx * 4 + 4; x++) {
        const i = (y * sw + x) * 4;
        const L = (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
        sum += L; sum2 += L * L; n++;
      }
      const m = sum / n, sd = Math.sqrt(Math.max(0, sum2 / n - m * m));
      if (sd < 0.03 && m > 0.06 && m < 0.8) this.cells.push([(cx + 0.5) / GW, (cy + 0.5) / GH]);
    }
    // ciel trop petit (grotte fermée) : pas d'étoiles plutôt que des étoiles dans la roche
    if (this.cells.length < 8) { this.cells = []; return; }
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const want = Math.min(46, Math.round(this.cells.length / 6));
    for (let i = 0; i < want; i++) {
      const [x, y] = this.cells[Math.floor(rnd() * this.cells.length)];
      this.stars.push({ x: x + (rnd() - 0.5) / GW, y: y + (rnd() - 0.5) / GH, r: 0.6 + rnd() * 1.1, p: rnd() * 10, s: 0.6 + rnd() * 1.8 });
    }
  }

  get hasSky(): boolean { return this.cells.length > 0; }

  /** night : 0..1 ; rect : où l'illustration est affichée (pixels écran). */
  draw(ctx: CanvasRenderingContext2D, rect: SkyRect, night: number, time: number, dt: number, dpr: number): void {
    if (night <= 0) { this.shoot = null; return; }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'lighter';
    for (const s of this.stars) {
      const tw = 0.55 + 0.45 * Math.sin(time * s.s + s.p) * Math.sin(time * s.s * 0.37 + s.p * 2);
      const a = night * tw * 0.85;
      if (a < 0.03) continue;
      const x = rect.x + s.x * rect.w, y = rect.y + s.y * rect.h, r = s.r * dpr;
      ctx.fillStyle = `rgba(235,240,255,${a})`;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      if (s.r > 1.3) { // les plus grosses ont une petite croix de lumière
        ctx.fillStyle = `rgba(200,215,255,${a * 0.35})`;
        ctx.fillRect(x - r * 3, y - r * 0.18, r * 6, r * 0.36);
        ctx.fillRect(x - r * 0.18, y - r * 3, r * 0.36, r * 6);
      }
    }
    // étoile filante (ciel ouvert) toutes les 15 à 40 s, ou feu follet (grotte fermée) toutes les 25 à 50 s
    this.nextShoot -= dt;
    if (!this.shoot && (this.nextShoot <= 0 || this.forceNext)) {
      this.forceNext = false;
      if (this.cells.length) {
        this.nextShoot = 15 + Math.random() * 25;
        // départ dans une case de ciel visible à l'écran (le décor déborde sur les côtés d'un téléphone)
        const W = ctx.canvas.width;
        const seen = this.cells.filter(([x]) => { const px = rect.x + x * rect.w; return px > W * 0.15 && px < W * 0.85; });
        const pool = seen.length ? seen : this.cells;
        const [cx, cy] = pool[Math.floor(Math.random() * pool.length)];
        const center = rect.x + cx * rect.w;
        const dir = center > W / 2 ? -1 : 1; // file vers le milieu de l'écran
        const speed = rect.w * (0.5 + Math.random() * 0.25);
        this.shoot = { x: cx, y: cy, vx: dir * speed, vy: speed * (0.3 + Math.random() * 0.2), t: 0, life: 1.1 + Math.random() * 0.5, wisp: false };
      } else {
        this.nextShoot = 25 + Math.random() * 25;
        const dir = Math.random() < 0.5 ? -1 : 1;
        // traverse la partie visible de la grotte, à mi-hauteur
        const sx = dir > 0 ? 0.3 : 0.7;
        this.shoot = { x: sx, y: 0.3 + Math.random() * 0.2, vx: dir * rect.w * 0.07, vy: 0, t: 0, life: 6, wisp: true };
      }
    }
    const sh = this.shoot;
    if (sh?.wisp) this.drawWisp(ctx, sh, rect, night, dt, dpr);
    else if (sh) {
      sh.t += dt;
      const u = sh.t / sh.life;
      if (u >= 1) this.shoot = null;
      else {
        const hx = rect.x + sh.x * rect.w + sh.vx * sh.t, hy = rect.y + sh.y * rect.h + sh.vy * sh.t;
        const len = 0.22, tx = hx - sh.vx * len, ty = hy - sh.vy * len;
        const a = night * Math.sin(Math.PI * u);
        const gr = ctx.createLinearGradient(tx, ty, hx, hy);
        gr.addColorStop(0, 'rgba(255,240,200,0)');
        gr.addColorStop(1, `rgba(255,248,225,${a})`);
        ctx.strokeStyle = gr; ctx.lineWidth = 2 * dpr; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(hx, hy); ctx.stroke();
        const halo = ctx.createRadialGradient(hx, hy, 0, hx, hy, 7 * dpr);
        halo.addColorStop(0, `rgba(255,250,230,${a})`); halo.addColorStop(1, 'rgba(255,250,230,0)');
        ctx.fillStyle = halo; ctx.fillRect(hx - 7 * dpr, hy - 7 * dpr, 14 * dpr, 14 * dpr);
        this.lastSeen = { x: hx, y: hy, x2: tx, y2: ty, at: performance.now() };
      }
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  /** Feu follet : petite flamme bleu-vert qui flotte en ondulant, laisse quelques étincelles. */
  private drawWisp(ctx: CanvasRenderingContext2D, sh: Shooting, rect: SkyRect, night: number, dt: number, dpr: number): void {
    sh.t += dt;
    const u = sh.t / sh.life;
    if (u >= 1) { this.shoot = null; return; }
    const hx = rect.x + sh.x * rect.w + sh.vx * sh.t;
    const hy = rect.y + sh.y * rect.h + Math.sin(sh.t * 2.2) * rect.h * 0.03 + Math.sin(sh.t * 5.3) * rect.h * 0.008;
    const a = night * Math.min(1, u * 5, (1 - u) * 5) * (0.8 + 0.2 * Math.sin(sh.t * 11));
    const r = 16 * dpr;
    const halo = ctx.createRadialGradient(hx, hy, 0, hx, hy, r);
    halo.addColorStop(0, `rgba(235,255,240,${a})`);
    halo.addColorStop(0.25, `rgba(130,240,210,${a * 0.7})`);
    halo.addColorStop(1, 'rgba(60,200,200,0)');
    ctx.fillStyle = halo; ctx.fillRect(hx - r, hy - r, r * 2, r * 2);
    for (let i = 1; i <= 4; i++) { // traînée d'étincelles
      const px = hx - sh.vx * i * 0.12, py = rect.y + sh.y * rect.h + Math.sin((sh.t - i * 0.12) * 2.2) * rect.h * 0.03;
      ctx.fillStyle = `rgba(170,255,225,${a * (0.5 - i * 0.1)})`;
      ctx.beginPath(); ctx.arc(px, py, (2.2 - i * 0.35) * dpr, 0, Math.PI * 2); ctx.fill();
    }
    this.lastSeen = { x: hx, y: hy, x2: hx, y2: hy, at: performance.now() };
  }

  /**
   * Un doigt a-t-il touché l'étoile filante ? (pixels du canvas). Large tolérance pour les petits doigts,
   * et encore un court instant après sa disparition. Une étoile ne se touche qu'une fois.
   */
  hitShootingStar(x: number, y: number, tol: number): boolean {
    const s = this.lastSeen;
    if (!s || performance.now() - s.at > 600) return false;
    if (s.x === s.x2 && s.y === s.y2) tol *= 1.6; // feu follet : une cible ronde, plus généreuse
    const dx = s.x - s.x2, dy = s.y - s.y2, L2 = dx * dx + dy * dy || 1;
    const k = Math.max(0, Math.min(1, ((x - s.x2) * dx + (y - s.y2) * dy) / L2));
    const d = Math.hypot(x - (s.x2 + k * dx), y - (s.y2 + k * dy));
    if (d > tol) return false;
    this.lastSeen = null;
    this.shoot = null;
    return true;
  }
}

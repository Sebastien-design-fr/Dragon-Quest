// Traces au sol, posées en coordonnées du monde (sol : y = 0) et dessinées sous le dragon :
// empreintes après un atterrissage, ronds dans l'eau du sol mouillé (atterrissage, coup d'aile, gouttes),
// braises qui rougeoient puis noircissent là où les flammes sont retombées.

interface Mark { kind: 'print' | 'ripple' | 'ember'; x: number; t: number; life: number; size: number; seed: number }

export class GroundMarks {
  private marks: Mark[] = [];
  private dripIn = 4;

  private add(kind: Mark['kind'], x: number, life: number, size: number): void {
    this.marks.push({ kind, x, t: 0, life, size, seed: Math.random() * 10 });
    if (this.marks.length > 60) this.marks.splice(0, this.marks.length - 60);
  }

  /** Atterrissage : une empreinte et un rond dans l'eau sous chaque patte. */
  land(xs: number[], wet: boolean): void {
    for (const x of xs) { this.add('print', x, 30, 1); if (wet) this.add('ripple', x, 1.8, 1.2); }
  }
  /** Coup d'aile : l'eau frémit sous les ailes. */
  gust(xs: number[], wet: boolean): void { if (wet) for (const x of xs) this.add('ripple', x, 1.6, 1.6); }
  /** Une braise tombée du souffle. */
  ember(x: number): void { this.add('ember', x, 14, 0.7 + Math.random() * 0.6); }
  clear(): void { this.marks = []; }

  /** unit : pixels par unité de taille (selon le stade et la caméra) ; toScreen : monde → écran. */
  draw(ctx: CanvasRenderingContext2D, dt: number, unit: number, toScreen: (x: number) => { x: number; y: number }, wet: boolean, drips: { x0: number; x1: number } | null, dpr: number): void {
    // gouttes qui tombent du plafond sur le sol mouillé, de temps en temps
    if (wet && drips) {
      this.dripIn -= dt;
      if (this.dripIn <= 0) { this.dripIn = 4 + Math.random() * 7; this.add('ripple', drips.x0 + Math.random() * (drips.x1 - drips.x0), 1.5, 0.7); }
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    for (const m of this.marks) {
      m.t += dt;
      const u = m.t / m.life;
      if (u >= 1) continue;
      const p = toScreen(m.x);
      if (m.kind === 'print') {
        // empreinte : ovale sombre et griffes, qui s'efface lentement
        const a = 0.32 * (1 - u) * Math.min(1, m.t * 4);
        const w = 13 * unit, h = 3.6 * unit;
        ctx.fillStyle = `rgba(12,9,6,${a})`;
        ctx.beginPath(); ctx.ellipse(p.x, p.y + h * 0.3, w, h, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = `rgba(12,9,6,${a * 0.8})`;
        const sgn = Math.sign(toScreen(m.x + 1).x - p.x) || 1; // griffes vers l'avant du dragon
        for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.ellipse(p.x + sgn * (w * 1.05 - Math.abs(i) * w * 0.15), p.y + i * h * 0.75, w * 0.22, h * 0.32, 0, 0, Math.PI * 2); ctx.fill(); }
      } else if (m.kind === 'ripple') {
        // rond dans l'eau : deux anneaux qui s'élargissent, écrasés par la perspective
        for (const lag of [0, 0.22]) {
          const v = u - lag;
          if (v <= 0) continue;
          const r = (6 + 34 * Math.sqrt(v)) * unit * m.size;
          ctx.strokeStyle = `rgba(215,228,255,${0.32 * (1 - v)})`;
          ctx.lineWidth = Math.max(1, 1.2 * dpr);
          ctx.beginPath(); ctx.ellipse(p.x, p.y, r, r * 0.22, 0, 0, Math.PI * 2); ctx.stroke();
        }
      } else {
        // braise : rougeoie et vacille, puis il ne reste qu'une petite tache brûlée
        const scorch = 0.28 * (1 - u);
        ctx.fillStyle = `rgba(20,10,4,${scorch})`;
        ctx.beginPath(); ctx.ellipse(p.x, p.y, 9 * unit * m.size, 2.6 * unit * m.size, 0, 0, Math.PI * 2); ctx.fill();
        const glow = Math.max(0, 1 - m.t / 5) * (0.75 + 0.25 * Math.sin(m.t * 9 + m.seed));
        if (glow > 0.02) {
          const r = 8 * unit * m.size;
          ctx.globalCompositeOperation = 'lighter';
          const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
          g.addColorStop(0, `rgba(255,190,90,${0.85 * glow})`);
          g.addColorStop(0.35, `rgba(255,90,20,${0.45 * glow})`);
          g.addColorStop(1, 'rgba(200,40,0,0)');
          ctx.fillStyle = g;
          ctx.fillRect(p.x - r, p.y - r, r * 2, r * 2);
          ctx.globalCompositeOperation = 'source-over';
        }
      }
    }
    this.marks = this.marks.filter(m => m.t < m.life);
  }
}

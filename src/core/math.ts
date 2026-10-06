// Matrice affine 2D (même convention que CanvasRenderingContext2D.setTransform).
export class Mat2D {
  constructor(
    public a = 1, public b = 0, public c = 0,
    public d = 1, public e = 0, public f = 0
  ) {}

  static fromTRS(x: number, y: number, rotDeg: number, sx: number, sy: number, out = new Mat2D()): Mat2D {
    const r = (rotDeg * Math.PI) / 180;
    const cos = Math.cos(r), sin = Math.sin(r);
    out.a = cos * sx; out.b = sin * sx;
    out.c = -sin * sy; out.d = cos * sy;
    out.e = x; out.f = y;
    return out;
  }

  /** out = this × m */
  multiply(m: Mat2D, out = new Mat2D()): Mat2D {
    const a = this.a * m.a + this.c * m.b;
    const b = this.b * m.a + this.d * m.b;
    const c = this.a * m.c + this.c * m.d;
    const d = this.b * m.c + this.d * m.d;
    const e = this.a * m.e + this.c * m.f + this.e;
    const f = this.b * m.e + this.d * m.f + this.f;
    out.a = a; out.b = b; out.c = c; out.d = d; out.e = e; out.f = f;
    return out;
  }

  copy(m: Mat2D): this {
    this.a = m.a; this.b = m.b; this.c = m.c; this.d = m.d; this.e = m.e; this.f = m.f;
    return this;
  }

  /** out = this⁻¹ */
  invert(out = new Mat2D()): Mat2D {
    const det = this.a * this.d - this.b * this.c || 1e-9;
    const a = this.d / det, b = -this.b / det, c = -this.c / det, d = this.a / det;
    const e = -(a * this.e + c * this.f), f = -(b * this.e + d * this.f);
    out.a = a; out.b = b; out.c = c; out.d = d; out.e = e; out.f = f;
    return out;
  }

  point(x: number, y: number): { x: number; y: number } {
    return { x: this.a * x + this.c * y + this.e, y: this.b * x + this.d * y + this.f };
  }

  /** Angle de l'axe x local, en degrés. */
  angle(): number { return (Math.atan2(this.b, this.a) * 180) / Math.PI; }

  apply(ctx: CanvasRenderingContext2D): void {
    ctx.setTransform(this.a, this.b, this.c, this.d, this.e, this.f);
  }
}

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
export const rand = (lo: number, hi: number) => lo + Math.random() * (hi - lo);

const EASINGS: Record<string, (t: number) => number> = {
  linear: t => t,
  in: t => t * t,
  out: t => 1 - (1 - t) * (1 - t),
  inout: t => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  back: t => { const c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); },
  step: t => (t < 1 ? 0 : 1)
};
export function ease(name: string | undefined, t: number): number {
  return (EASINGS[name || 'inout'] || EASINGS.inout)(t);
}

// Halo lumineux (bloom) : ce qui brille dans l'image (flammes, yeux, cristaux, étoiles, torches, or)
// diffuse une lueur douce autour de lui. Calculé sur une copie au quart de la taille de l'écran :
// on ne garde que les zones claires (luminosité baissée puis contraste poussé), on les floute,
// puis on les ajoute par-dessus l'image. Peu coûteux, même sur un téléphone modeste.

export class Bloom {
  private a = document.createElement('canvas');
  private b = document.createElement('canvas');
  /** Force du halo (0 = aucun). */
  strength = 0.4;

  apply(ctx: CanvasRenderingContext2D, src: HTMLCanvasElement, W: number, H: number): void {
    if (this.strength <= 0 || W < 8 || H < 8) return;
    const w = Math.max(1, Math.round(W / 4)), h = Math.max(1, Math.round(H / 4));
    for (const c of [this.a, this.b]) if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    const ga = this.a.getContext('2d')!, gb = this.b.getContext('2d')!;
    // seuil doux : les tons moyens et sombres tombent au noir, les zones claires et saturées restent
    ga.globalCompositeOperation = 'copy';
    ga.filter = 'brightness(0.68) contrast(2.6) saturate(1.5)';
    ga.drawImage(src, 0, 0, W, H, 0, 0, w, h);
    ga.filter = 'none';
    gb.globalCompositeOperation = 'copy';
    gb.filter = `blur(${Math.max(2, Math.round(w / 70))}px)`;
    gb.drawImage(this.a, 0, 0);
    gb.filter = 'none';
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = this.strength;
    ctx.drawImage(this.b, 0, 0, w, h, 0, 0, W, H);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
}

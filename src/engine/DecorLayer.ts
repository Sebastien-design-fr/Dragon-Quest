// Décor de la grotte dans la scène du dragon : objets achetés et débris à ramasser.
// Coordonnées indépendantes de l'écran : origine au centre, sur le sol (sous les pattes du dragon),
// unité = hauteur affichée du décor peint. Ainsi les objets gardent leur place et leur taille par rapport
// à la scène, en grand (onglet Dragon) comme en petit (autres onglets), sur tous les téléphones.
// Le décor peint lui-même n'est jamais modifié : les objets sont posés par-dessus.

export interface DecorItem {
  key: string;
  img: string;
  /** Position (unités de scène) : dx horizontal depuis le centre, dy vertical depuis le sol (négatif = plus haut). */
  dx: number; dy: number;
  /** Largeur (unités de scène) avant la profondeur. */
  w: number;
  /** floor : posé (bas de l'image au point) ; wall : accroché (haut de l'image) ; ground : à plat au sol (tapis). */
  anchor: 'floor' | 'wall' | 'ground';
  flip?: boolean;
  /** Toujours derrière le dragon (tapis, nid, objets muraux). */
  behind?: boolean;
  light?: { x: number; y: number; r: number; color: string };
  /** Débris : il rétrécit et s'efface quand on le ramasse. */
  debris?: boolean;
  gone?: number;
}

export interface DecorRect { key: string; x: number; y: number; w: number; h: number; debris: boolean }

const images = new Map<string, HTMLImageElement>();
function image(path: string): HTMLImageElement {
  let im = images.get(path);
  if (!im) { im = new Image(); im.decoding = 'async'; im.src = path; images.set(path, im); }
  return im;
}

export class DecorLayer {
  items: DecorItem[] = [];
  /** Mode aménagement : contours et objet sélectionné. */
  editing = false;
  selected: string | null = null;
  /** Zones à l'écran (pixels du canvas) de la dernière image, pour toucher / déplacer. */
  rects: DecorRect[] = [];
  /** Repère de la dernière image : origine (pixels) et unité (pixels par unité de scène). */
  frame = { ox: 0, oy: 0, u: 1 };

  set(items: DecorItem[]): void {
    // un débris en train de disparaître le reste jusqu'au bout
    const fading = this.items.filter(i => i.debris && i.gone && i.gone < 1);
    this.items = [...items.filter(i => !fading.some(f => f.key === i.key)), ...fading];
    for (const i of this.items) image(i.img);
  }

  /** Objet au point (pixels du canvas) : le plus en avant d'abord. */
  hit(x: number, y: number, debrisOnly = false): DecorRect | null {
    for (let i = this.rects.length - 1; i >= 0; i--) {
      const r = this.rects[i];
      if (debrisOnly && !r.debris) continue;
      const pad = r.debris ? 10 : 0;
      if (x >= r.x - pad && x <= r.x + r.w + pad && y >= r.y - pad && y <= r.y + r.h + pad) return r;
    }
    return null;
  }

  private place(it: DecorItem) {
    const im = image(it.img);
    if (!im.complete || !im.naturalWidth) return null;
    const { ox, oy, u } = this.frame;
    // profondeur : plus bas à l'écran = plus près = un peu plus grand
    const depth = it.anchor === 'wall' ? 1 : Math.max(0.6, 1 + it.dy * 1.3);
    const w = it.w * u * depth;
    const squash = it.anchor === 'ground' ? 0.36 : 1;
    const h = w * im.naturalHeight / im.naturalWidth * squash;
    const cx = ox + it.dx * u;
    const py = oy + it.dy * u;
    const y = it.anchor === 'wall' ? py : it.anchor === 'ground' ? py - h / 2 : py - h;
    return { im, x: cx - w / 2, y, w, h };
  }

  /**
   * Dessine une couche : 'back' (derrière le dragon) ou 'front' (devant). ground : y écran du sol sous le dragon ;
   * u : hauteur affichée du décor peint (pixels).
   */
  draw(ctx: CanvasRenderingContext2D, which: 'back' | 'front', W: number, ground: number, u: number, time: number, dt: number, dpr: number): void {
    if (which === 'back') { this.frame = { ox: W / 2, oy: ground, u }; this.rects = []; }
    const inFront = (it: DecorItem) => !it.behind && it.anchor === 'floor' && it.dy > 0.045;
    const list = this.items.filter(it => (which === 'front') === inFront(it))
      .sort((a, b) => (a.anchor === 'ground' ? -1 : 0) - (b.anchor === 'ground' ? -1 : 0) || (a.anchor === 'wall' ? -1 : 0) - (b.anchor === 'wall' ? -1 : 0) || a.dy - b.dy);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    for (const it of list) {
      const p = this.place(it);
      if (!p) continue;
      let k = 1;
      if (it.debris && it.gone) { it.gone = Math.min(1, it.gone + dt * 3); k = 1 - it.gone; if (k <= 0) continue; }
      ctx.save();
      ctx.globalAlpha = k;
      const cx = p.x + p.w / 2, by = p.y + p.h;
      ctx.translate(cx, by - (it.gone ? it.gone * 30 * dpr : 0));
      ctx.scale((it.flip ? -1 : 1) * k, k);
      // petite ombre de contact sous les objets posés
      if (it.anchor === 'floor' && !it.debris) {
        ctx.fillStyle = 'rgba(0,0,0,0.32)';
        ctx.beginPath(); ctx.ellipse(0, -p.h * 0.02, p.w * 0.42, p.w * 0.07, 0, 0, Math.PI * 2); ctx.fill();
      }
      ctx.drawImage(p.im, -p.w / 2, -p.h, p.w, p.h);
      ctx.restore();
      if (it.light && !it.debris) {
        const f = 0.8 + 0.2 * Math.sin(time * 9 + it.dx * 20) * Math.sin(time * 5.3 + it.dy * 7);
        const lx = cx + (it.flip ? -1 : 1) * (it.light.x - 0.5) * p.w, ly = p.y + it.light.y * p.h, rr = it.light.r * u;
        const g = ctx.createRadialGradient(lx, ly, 0, lx, ly, rr);
        g.addColorStop(0, `rgba(${it.light.color},${0.26 * f})`); g.addColorStop(1, `rgba(${it.light.color},0)`);
        ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.fillRect(lx - rr, ly - rr, rr * 2, rr * 2);
        ctx.globalCompositeOperation = 'source-over';
      }
      if (!it.gone) this.rects.push({ key: it.key, x: p.x, y: p.y, w: p.w, h: p.h, debris: !!it.debris });
      if (this.editing && !it.debris) {
        const sel = this.selected === it.key;
        ctx.setLineDash(sel ? [] : [6 * dpr, 5 * dpr]);
        ctx.lineWidth = (sel ? 2.5 : 1.5) * dpr;
        ctx.strokeStyle = sel ? 'rgba(255,217,119,0.95)' : 'rgba(255,255,255,0.45)';
        ctx.strokeRect(p.x, p.y, p.w, p.h);
        ctx.setLineDash([]);
        if (sel) {
          ctx.fillStyle = 'rgba(255,217,119,0.95)';
          for (const [hx, hy] of [[p.x, p.y], [p.x + p.w, p.y], [p.x, p.y + p.h], [p.x + p.w, p.y + p.h]]) {
            ctx.beginPath(); ctx.arc(hx, hy, 4.5 * dpr, 0, Math.PI * 2); ctx.fill();
          }
        }
      }
    }
    ctx.globalAlpha = 1;
    this.items = this.items.filter(i => !(i.debris && i.gone && i.gone >= 1));
  }
}

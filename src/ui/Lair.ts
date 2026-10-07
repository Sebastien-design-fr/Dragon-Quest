// La grotte du dragon : elle l'aménage avec l'or des missions, et la range (des débris s'y accumulent).
import type { App } from './App.js';
import { h } from './dom.js';

export interface DecorDef {
  id: string; label: string; price: number; hint: string;
  /** Image (assets/decor/<img>.webp) et placement dans la grotte (fractions de la largeur / hauteur). */
  img: string; x: number; y: number; w: number;
  /** wall : accroché (haut de l'image) ; floor : posé (bas de l'image) ; center : centré (tapis). */
  anchor: 'wall' | 'floor' | 'center';
  layer: 'back' | 'under' | 'front';
  twin?: boolean;
  light?: { x: number; y: number; r: number; color: string };
}
export const DECOR: DecorDef[] = [
  { id: 'torches', label: 'Torches murales', price: 60, hint: 'Enfin de la lumière', img: 'torch', x: 0.07, y: 0.24, w: 0.11, anchor: 'wall', layer: 'back', twin: true, light: { x: 0.62, y: 0.12, r: 0.32, color: '255,160,70' } },
  { id: 'lanterns', label: 'Guirlande de lanternes', price: 70, hint: 'Une ambiance magique', img: 'lanterns', x: 0.55, y: 0.03, w: 0.6, anchor: 'wall', layer: 'back', light: { x: 0.5, y: 0.6, r: 0.4, color: '255,200,110' } },
  { id: 'banner', label: 'Bannière au dragon', price: 80, hint: 'Ses couleurs au mur', img: 'banner', x: 0.3, y: 0.08, w: 0.17, anchor: 'wall', layer: 'back' },
  { id: 'candelabra', label: 'Grand chandelier', price: 90, hint: 'Pour les soirées calmes', img: 'candelabra', x: 0.08, y: -0.02, w: 0.13, anchor: 'floor', layer: 'back', light: { x: 0.5, y: 0.1, r: 0.25, color: '255,210,140' } },
  { id: 'rug', label: 'Grand tapis', price: 90, hint: 'Doux sous les griffes', img: 'rug', x: 0.55, y: 0.05, w: 0.72, anchor: 'center', layer: 'under' },
  { id: 'nest', label: 'Nid de coussins', price: 110, hint: 'Il y dort roulé en boule', img: 'nest', x: 0.57, y: 0.04, w: 0.52, anchor: 'floor', layer: 'under' },
  { id: 'brazier', label: 'Brasero suspendu', price: 110, hint: 'Une chaleur douce', img: 'brazier', x: 0.83, y: 0.0, w: 0.13, anchor: 'wall', layer: 'back', light: { x: 0.5, y: 0.78, r: 0.35, color: '255,130,50' } },
  { id: 'crystals', label: 'Cristaux lumineux', price: 130, hint: 'Ils brillent dans le noir', img: 'crystals', x: 0.93, y: 0.05, w: 0.18, anchor: 'floor', layer: 'front', light: { x: 0.5, y: 0.45, r: 0.35, color: '140,150,255' } },
  { id: 'basin', label: 'Bassin enchanté', price: 150, hint: 'Une eau qui scintille', img: 'basin', x: 0.22, y: 0.0, w: 0.2, anchor: 'floor', layer: 'back', light: { x: 0.45, y: 0.3, r: 0.3, color: '120,180,255' } },
  { id: 'chest', label: 'Coffre au trésor', price: 160, hint: 'Tout dragon a besoin d’un trésor', img: 'chest', x: 0.17, y: 0.17, w: 0.27, anchor: 'floor', layer: 'front' },
  { id: 'statue', label: 'Statue de dragon', price: 180, hint: 'Un ancêtre veille', img: 'statue', x: 0.8, y: -0.03, w: 0.16, anchor: 'floor', layer: 'back' },
  { id: 'gold', label: 'Montagne d’or', price: 250, hint: 'Le rêve de tout dragon', img: 'gold', x: 0.8, y: 0.18, w: 0.27, anchor: 'floor', layer: 'front' }
];
const DEBRIS_IMG = ['bone', 'bones', 'rocks', 'scales', 'pot', 'straw', 'eggshell', 'rag'];

interface Debris { x: number; y: number; img: string; w: number; flip: boolean; gone: number }

const images = new Map<string, HTMLImageElement>();
function img(name: string): HTMLImageElement {
  let im = images.get(name);
  if (!im) { im = new Image(); im.src = `assets/decor/${name}.webp`; images.set(name, im); }
  return im;
}

export function openLair(app: App): void {
  const comp = app.family.companion;
  if (!comp) return;
  const canvas = h('canvas', { class: 'lair-canvas' });
  const info = h('div', { class: 'lair-info' });
  const panel = h('div', { class: 'lair-panel' });
  const close = () => { cancelAnimationFrame(raf); root.remove(); app.refresh(); };
  const root = h('div', { class: 'lair' }, canvas,
    h('div', { class: 'lair-top' }, h('strong', null, `La grotte de ${comp.name}`), h('button', { class: 'btn small-btn', onclick: close }, 'Fermer')),
    info, panel);
  document.body.append(root);

  const ctx = canvas.getContext('2d')!;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  let W = 0, H = 0, floorY = 0;
  const cave = new Image();
  cave.src = `assets/backgrounds/bg_${app.state.data.stage}.webp`;
  const dragon = new Image();
  const st = app.state.data.stage, vr = app.ownVariant;
  dragon.src = vr === 'dragon' ? `assets/dragon/${st}/dragon_${st}_full.webp` : `assets/${vr}/${st}/${vr}_${st}_full.webp`;
  DECOR.forEach(d => img(d.img)); DEBRIS_IMG.forEach(img);

  // Fond : image du stade en « cover » ; le sol est à 80 % de sa hauteur.
  let bg = { x: 0, y: 0, w: 0, h: 0 };
  const layout = () => {
    const iw = cave.naturalWidth || 1536, ih = cave.naturalHeight || 1024;
    const k = Math.max(W / iw, H / ih);
    // sol de l'image (80 %) remonté aux 2/3 de la scène : plus de place pour le tapis, les trésors et les débris
    const y = Math.min(0, 0.66 * H - 0.8 * ih * k);
    bg = { w: iw * k, h: ih * k, x: (W - iw * k) / 2, y };
    floorY = bg.y + bg.h * 0.8;
  };
  const resize = () => { W = root.clientWidth; H = root.clientHeight * 0.74; canvas.width = W * dpr; canvas.height = root.clientHeight * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); layout(); layoutDebris(); };
  cave.onload = () => { layout(); layoutDebris(); };

  // Débris au sol (positions stables d'une ouverture à l'autre).
  let debris: Debris[] = [];
  const layoutDebris = () => {
    debris = [];
    let seed = 7;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    for (let i = 0; i < comp.lair().debris; i++) {
      debris.push({ x: W * (0.08 + rnd() * 0.84), y: floorY + H * (0.05 + rnd() * 0.2), img: DEBRIS_IMG[Math.floor(rnd() * DEBRIS_IMG.length)], w: W * (0.08 + rnd() * 0.04), flip: rnd() < 0.5, gone: 0 });
    }
    debris.sort((a, b) => a.y - b.y);
  };
  resize();

  canvas.addEventListener('pointerdown', e => {
    const r = canvas.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    const d = debris.find(q => !q.gone && Math.abs(q.x - x) < q.w * 0.6 && Math.abs(q.y - y) < q.w * 0.5);
    if (!d) return;
    d.gone = 0.001;
    sparks.push({ x: d.x, y: d.y, t: 0 });
    comp.tidyLair();
    renderInfo();
    if (!debris.some(q => !q.gone)) app.toast(`La grotte de ${comp.name} est toute rangée !`);
  });

  const sparks: Array<{ x: number; y: number; t: number }> = [];
  let t = 0, last = 0, raf = 0;

  const renderInfo = () => {
    const l = comp.lair();
    info.textContent = l.debris ? `${l.debris} débris à ramasser : touche-les pour ranger la grotte.` : 'Grotte rangée. Décore-la avec l’or de tes missions !';
    panel.replaceChildren(
      h('div', { class: 'small muted' }, `Or : ${app.state.data.gold}`),
      h('div', { class: 'decor-list' }, ...DECOR.map(d => {
        const owned = l.owned.includes(d.id);
        return h('button', { class: `decor${owned ? ' owned' : ''}`, onclick: () => {
          if (owned) return;
          if (!comp.buyDecor(d.id, d.price)) { app.toast('Pas assez d’or'); return; }
          app.toast(`${d.label} installé !`);
          renderInfo();
        } }, h('img', { src: `assets/decor/${d.img}.webp`, alt: '', class: 'decor-img' }),
          h('span', { class: 'decor-txt' }, h('span', { class: 'item-name' }, d.label), h('span', { class: 'small muted' }, owned ? 'Installé' : `${d.price} or · ${d.hint}`)));
      })));
  };
  renderInfo();

  const drawDecor = (d: DecorDef, t: number, mirror = false) => {
    const im = img(d.img);
    if (!im.complete || !im.naturalWidth) return;
    const w = W * d.w, hh = w * im.naturalHeight / im.naturalWidth;
    const cx = (mirror ? 1 - d.x : d.x) * W;
    const fy = floorY + d.y * H;
    const yy = d.anchor === 'wall' ? Math.max(70, bg.y + d.y * (floorY - bg.y)) : d.anchor === 'center' ? fy - hh / 2 : fy - hh;
    ctx.save();
    if (mirror) { ctx.translate(cx, 0); ctx.scale(-1, 1); ctx.translate(-cx, 0); }
    ctx.drawImage(im, cx - w / 2, yy, w, hh);
    ctx.restore();
    if (d.light) {
      const f = 0.8 + 0.2 * Math.sin(t * 9 + d.x * 20) * Math.sin(t * 5.3 + d.y * 7);
      const lx = cx + (mirror ? -1 : 1) * (d.light.x - 0.5) * w, ly = yy + d.light.y * hh, rr = d.light.r * W;
      const g = ctx.createRadialGradient(lx, ly, 0, lx, ly, rr);
      g.addColorStop(0, `rgba(${d.light.color},${0.28 * f})`); g.addColorStop(1, `rgba(${d.light.color},0)`);
      ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.fillRect(lx - rr, ly - rr, rr * 2, rr * 2);
      ctx.globalCompositeOperation = 'source-over';
    }
  };

  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016; last = now; t += dt;
    const owned = new Set(comp.lair().owned);
    const lit = DECOR.some(d => d.light && owned.has(d.id));
    ctx.fillStyle = '#0b0a0d'; ctx.fillRect(0, 0, W, H / 0.74);
    if (cave.complete && cave.naturalWidth) {
      ctx.drawImage(cave, bg.x, bg.y, bg.w, bg.h);
      // sous l'image : le sol se prolonge dans l'ombre
      const yb = bg.y + bg.h;
      const g = ctx.createLinearGradient(0, yb - 60, 0, yb + 10);
      g.addColorStop(0, 'rgba(11,10,13,0)'); g.addColorStop(1, '#0b0a0d');
      ctx.fillStyle = g; ctx.fillRect(0, yb - 60, W, H);
    }
    // grotte sombre tant qu'aucune lumière n'est installée
    ctx.fillStyle = `rgba(6,5,9,${lit ? 0.12 : 0.42})`; ctx.fillRect(0, 0, W, H);
    for (const layer of ['back', 'under'] as const) {
      for (const d of DECOR) if (d.layer === layer && owned.has(d.id)) { drawDecor(d, t); if (d.twin) drawDecor(d, t + 1.3, true); }
    }
    if (dragon.complete && dragon.naturalWidth) {
      const dw = Math.min(W * 0.62, (floorY - bg.y) * 0.75 * dragon.naturalWidth / dragon.naturalHeight);
      const dh = dw * dragon.naturalHeight / dragon.naturalWidth;
      const breathe = 1 + Math.sin(t * 2) * 0.008;
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath(); ctx.ellipse(W * 0.57, floorY + 4, dw * 0.38, dw * 0.05, 0, 0, Math.PI * 2); ctx.fill();
      ctx.translate(W * 0.57, floorY + 6);
      ctx.scale(1, breathe);
      ctx.drawImage(dragon, -dw * 0.58, -dh, dw, dh);
      ctx.restore();
    }
    for (const d of DECOR) if (d.layer === 'front' && owned.has(d.id)) drawDecor(d, t);
    // débris (ramassés : ils rétrécissent et s'effacent)
    for (const d of debris) {
      const im = img(d.img);
      if (!im.complete || !im.naturalWidth) continue;
      if (d.gone) d.gone += dt * 3;
      if (d.gone >= 1) continue;
      const k = d.gone ? 1 - d.gone : 1;
      const w = d.w * k, hh = w * im.naturalHeight / im.naturalWidth;
      ctx.save();
      ctx.globalAlpha = k;
      ctx.translate(d.x, d.y - (d.gone ? d.gone * 30 : 0));
      if (d.flip) ctx.scale(-1, 1);
      ctx.drawImage(im, -w / 2, -hh * 0.75, w, hh);
      ctx.restore();
    }
    for (const sp of sparks) {
      sp.t += dt;
      ctx.globalAlpha = Math.max(0, 1 - sp.t * 1.5);
      ctx.fillStyle = '#ffe9a8';
      for (let k = 0; k < 8; k++) { const a = k * 0.8 + sp.t * 3; ctx.fillRect(sp.x + Math.cos(a) * sp.t * 60, sp.y + Math.sin(a) * sp.t * 60 - 10, 3, 3); }
      ctx.globalAlpha = 1;
    }
    for (let i = sparks.length - 1; i >= 0; i--) if (sparks[i].t > 0.8) sparks.splice(i, 1);
  };
  raf = requestAnimationFrame(frame);
}


// La grotte du dragon : elle l'aménage avec l'or des missions, et la range (des débris s'y accumulent).
import type { App } from './App.js';
import { h } from './dom.js';

export interface DecorDef { id: string; label: string; price: number; hint: string }
export const DECOR: DecorDef[] = [
  { id: 'torches', label: 'Torches murales', price: 60, hint: 'Enfin de la lumière dans la grotte' },
  { id: 'banner', label: 'Bannière au dragon', price: 80, hint: 'Ses couleurs, accrochées au mur' },
  { id: 'rug', label: 'Grand tapis', price: 90, hint: 'Doux sous les griffes' },
  { id: 'nest', label: 'Nid de coussins', price: 110, hint: 'Il y dort roulé en boule' },
  { id: 'crystals', label: 'Cristaux lumineux', price: 130, hint: 'Ils brillent dans le noir' },
  { id: 'chest', label: 'Coffre au trésor', price: 160, hint: 'Tout dragon a besoin d’un trésor' },
  { id: 'lanterns', label: 'Guirlande de lucioles', price: 70, hint: 'Une ambiance magique' }
];

interface Debris { x: number; y: number; kind: number; rot: number }

export function openLair(app: App): void {
  const comp = app.family.companion;
  if (!comp) return;
  const lair = comp.lair();
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
  let W = 0, H = 0;
  const resize = () => { W = root.clientWidth; H = root.clientHeight * 0.74; canvas.width = W * dpr; canvas.height = root.clientHeight * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); layoutDebris(); };

  const dragon = new Image();
  dragon.src = `assets/dragon/${app.state.data.stage}/dragon_${app.state.data.stage}_full.webp`;

  // Débris placés au sol (positions stables d'une ouverture à l'autre).
  let debris: Debris[] = [];
  const layoutDebris = () => {
    debris = [];
    let seed = 7;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    for (let i = 0; i < lair.debris; i++) debris.push({ x: W * (0.12 + rnd() * 0.76), y: H * (0.66 + rnd() * 0.2), kind: Math.floor(rnd() * 3), rot: rnd() * 6 });
  };
  resize();

  canvas.addEventListener('pointerdown', e => {
    const r = canvas.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    const i = debris.findIndex(d => Math.hypot(d.x - x, d.y - y) < 30);
    if (i < 0) return;
    debris.splice(i, 1);
    sparks.push({ x, y, t: 0 });
    comp.tidyLair();
    renderInfo();
    if (!debris.length) app.toast(`La grotte de ${comp.name} est toute rangée !`);
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
        } }, h('span', { class: 'item-name' }, d.label), h('span', { class: 'small muted' }, owned ? 'Installé' : `${d.price} or · ${d.hint}`));
      })));
  };
  renderInfo();

  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016; last = now; t += dt;
    const has = (id: string) => comp.lair().owned.includes(id);
    ctx.fillStyle = '#0b0a0d'; ctx.fillRect(0, 0, W, H / 0.74);
    drawCave(ctx, W, H, has('torches') || has('crystals') || has('lanterns') ? 1 : 0.55);
    if (has('banner')) drawBanner(ctx, W * 0.26, H * 0.2, H * 0.24, t);
    if (has('torches')) { drawTorch(ctx, W * 0.1, H * 0.36, t); drawTorch(ctx, W * 0.9, H * 0.36, t + 1.3); }
    if (has('lanterns')) drawLanterns(ctx, W, H, t);
    if (has('crystals')) drawCrystals(ctx, W * 0.86, H * 0.66, H * 0.12, t);
    if (has('rug')) drawRug(ctx, W * 0.52, H * 0.78, W * 0.36, H * 0.06);
    // Tas d'or : grossit avec l'or possédé
    drawGold(ctx, W * 0.17, H * 0.72, Math.min(1, app.state.data.gold / 1500), has('chest'));
    if (has('nest')) drawNest(ctx, W * 0.55, H * 0.72, W * 0.3, H * 0.06);
    if (dragon.complete && dragon.naturalWidth) {
      const dw = Math.min(W * 0.72, H * 0.55 * dragon.naturalWidth / dragon.naturalHeight);
      const dh = dw * dragon.naturalHeight / dragon.naturalWidth;
      const breathe = 1 + Math.sin(t * 2) * 0.008;
      ctx.save();
      ctx.translate(W * 0.55, H * 0.74);
      ctx.scale(1, breathe);
      ctx.drawImage(dragon, -dw * 0.55, -dh, dw, dh);
      ctx.restore();
    }
    for (const d of debris) drawDebris(ctx, d);
    for (const s of sparks) {
      s.t += dt;
      ctx.globalAlpha = Math.max(0, 1 - s.t * 1.5);
      ctx.fillStyle = '#ffe9a8';
      for (let k = 0; k < 6; k++) { const a = k * 1.05 + s.t * 3; ctx.fillRect(s.x + Math.cos(a) * s.t * 50, s.y + Math.sin(a) * s.t * 50, 3, 3); }
      ctx.globalAlpha = 1;
    }
    for (let i = sparks.length - 1; i >= 0; i--) if (sparks[i].t > 0.8) sparks.splice(i, 1);
  };
  raf = requestAnimationFrame(frame);
}

// ---------------- Dessin ----------------
function drawCave(ctx: CanvasRenderingContext2D, W: number, H: number, light: number): void {
  const g = ctx.createRadialGradient(W * 0.5, H * 0.55, 10, W * 0.5, H * 0.55, Math.max(W, H) * 0.75);
  g.addColorStop(0, `rgb(${Math.round(70 * light)},${Math.round(52 * light)},${Math.round(44 * light)})`);
  g.addColorStop(0.55, `rgb(${Math.round(34 * light)},${Math.round(26 * light)},${Math.round(30 * light)})`);
  g.addColorStop(1, '#09080b');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // voûte rocheuse
  ctx.fillStyle = '#0d0b0f';
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(W, 0); ctx.lineTo(W, H * 0.5);
  for (let i = 20; i >= 0; i--) { const x = (W * i) / 20; ctx.lineTo(x, H * (0.1 + 0.09 * Math.sin(i * 1.7) + 0.06 * Math.sin(i * 0.6)) + (i % 2) * 8); }
  ctx.lineTo(0, H * 0.5); ctx.closePath(); ctx.fill();
  // sol
  const f = ctx.createLinearGradient(0, H * 0.62, 0, H);
  f.addColorStop(0, `rgba(${Math.round(80 * light)},${Math.round(62 * light)},${Math.round(48 * light)},1)`);
  f.addColorStop(1, '#120e0e');
  ctx.fillStyle = f;
  ctx.beginPath(); ctx.moveTo(0, H * 0.66); ctx.quadraticCurveTo(W * 0.5, H * 0.58, W, H * 0.66); ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.fill();
  // stalactites
  ctx.fillStyle = '#141116';
  for (let i = 0; i < 9; i++) { const x = W * (0.05 + i * 0.11), y = H * (0.12 + 0.05 * Math.sin(i * 2.3)); ctx.beginPath(); ctx.moveTo(x - 9, y); ctx.lineTo(x + 9, y); ctx.lineTo(x + 1, y + 30 + (i % 3) * 18); ctx.fill(); }
}

function drawTorch(ctx: CanvasRenderingContext2D, x: number, y: number, t: number): void {
  const glow = ctx.createRadialGradient(x, y - 18, 2, x, y - 18, 120);
  glow.addColorStop(0, 'rgba(255,170,70,.45)'); glow.addColorStop(1, 'rgba(255,140,50,0)');
  ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(x, y - 18, 120, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#4a3220'; ctx.fillRect(x - 4, y - 8, 8, 36);
  ctx.fillStyle = '#7a6a5a'; ctx.fillRect(x - 8, y - 10, 16, 5);
  const fl = 1 + Math.sin(t * 13) * 0.12 + Math.sin(t * 7.3) * 0.08;
  ctx.fillStyle = '#ff9a2a'; ctx.beginPath(); ctx.ellipse(x, y - 22, 8, 16 * fl, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffe08a'; ctx.beginPath(); ctx.ellipse(x, y - 18, 4, 8 * fl, 0, 0, Math.PI * 2); ctx.fill();
}

function drawBanner(ctx: CanvasRenderingContext2D, x: number, y: number, h0: number, t: number): void {
  const w = h0 * 0.5, sway = Math.sin(t * 1.2) * 3;
  ctx.fillStyle = '#5a4630'; ctx.fillRect(x - w * 0.6, y - 4, w * 1.2, 5);
  ctx.fillStyle = '#7a1d24';
  ctx.beginPath(); ctx.moveTo(x - w / 2, y); ctx.lineTo(x + w / 2, y); ctx.lineTo(x + w / 2 + sway, y + h0); ctx.lineTo(x + sway, y + h0 * 0.85); ctx.lineTo(x - w / 2 + sway, y + h0); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#d9a84a'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = '#d9a84a'; ctx.font = `${Math.round(w * 0.6)}px serif`; ctx.textAlign = 'center'; ctx.fillText('◆', x + sway * 0.5, y + h0 * 0.5);
}

function drawLanterns(ctx: CanvasRenderingContext2D, W: number, H: number, t: number): void {
  ctx.strokeStyle = 'rgba(120,100,70,.6)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(W * 0.08, H * 0.24); ctx.quadraticCurveTo(W * 0.5, H * 0.36, W * 0.92, H * 0.24); ctx.stroke();
  for (let i = 1; i < 12; i++) {
    const u = i / 12, x = W * (0.08 + 0.84 * u), y = H * (0.24 + 0.12 * 4 * u * (1 - u) * 0.5) + 4;
    const a = 0.6 + 0.4 * Math.sin(t * 3 + i);
    ctx.fillStyle = `rgba(255,230,140,${a})`; ctx.beginPath(); ctx.arc(x, y, 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = `rgba(255,230,140,${a * 0.15})`; ctx.beginPath(); ctx.arc(x, y, 12, 0, Math.PI * 2); ctx.fill();
  }
}

function drawCrystals(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, t: number): void {
  const g = ctx.createRadialGradient(x, y - s * 0.5, 2, x, y - s * 0.5, s * 1.6);
  g.addColorStop(0, `rgba(120,200,255,${0.35 + 0.1 * Math.sin(t * 2)})`); g.addColorStop(1, 'rgba(120,200,255,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y - s * 0.5, s * 1.6, 0, Math.PI * 2); ctx.fill();
  const shards: Array<[number, number, number]> = [[-0.35, 0.7, -0.3], [0, 1, 0], [0.3, 0.8, 0.25], [0.55, 0.5, 0.45], [-0.6, 0.45, -0.5]];
  for (const [dx, hh, rot] of shards) {
    ctx.save(); ctx.translate(x + dx * s, y); ctx.rotate(rot * 0.5);
    const lg = ctx.createLinearGradient(0, -s * hh, 0, 0); lg.addColorStop(0, '#d8f2ff'); lg.addColorStop(1, '#3a7fc0');
    ctx.fillStyle = lg; ctx.beginPath(); ctx.moveTo(-s * 0.1, 0); ctx.lineTo(0, -s * hh); ctx.lineTo(s * 0.1, 0); ctx.fill();
    ctx.restore();
  }
}

function drawRug(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, hh: number): void {
  ctx.fillStyle = '#6e1f2a'; ctx.beginPath(); ctx.ellipse(x, y, w / 2, hh, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#d9a84a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(x, y, w / 2 - 6, hh - 4, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = 'rgba(217,168,74,.5)'; ctx.beginPath(); ctx.ellipse(x, y, w / 4, hh / 2, 0, 0, Math.PI * 2); ctx.stroke();
}

function drawNest(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, hh: number): void {
  const cols = ['#5a3d6e', '#7a5a2a', '#3d5a6e', '#6e3d3d'];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI;
    ctx.fillStyle = cols[i % 4];
    ctx.beginPath(); ctx.ellipse(x + Math.cos(a) * w * 0.42 * (i % 2 ? 1 : -1) * 0.9, y + Math.sin(a) * hh * 0.3, w * 0.16, hh * 0.9, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = '#8a6a3a'; ctx.beginPath(); ctx.ellipse(x, y + hh * 0.2, w / 2, hh * 0.8, 0, 0, Math.PI * 2); ctx.fill();
}

function drawGold(ctx: CanvasRenderingContext2D, x: number, y: number, amount: number, chest: boolean): void {
  if (chest) {
    ctx.fillStyle = '#5a3a1e'; ctx.fillRect(x - 34, y - 34, 68, 34);
    ctx.fillStyle = '#7a5228'; ctx.beginPath(); ctx.ellipse(x, y - 34, 34, 14, 0, Math.PI, 0); ctx.fill();
    ctx.strokeStyle = '#d9a84a'; ctx.lineWidth = 3; ctx.strokeRect(x - 34, y - 34, 68, 34);
    ctx.fillStyle = '#ffd76a'; ctx.beginPath(); ctx.ellipse(x, y - 36, 26, 8, 0, 0, Math.PI * 2); ctx.fill();
  }
  const n = Math.round(6 + amount * 40);
  for (let i = 0; i < n; i++) {
    const a = i * 2.4, r = Math.sqrt(i) * 5;
    const cx = x + Math.cos(a) * r * 1.6 + (chest ? 40 : 0), cy = y + 6 - Math.max(0, 22 * amount - r * 0.5) + Math.sin(a) * r * 0.35;
    ctx.fillStyle = i % 3 ? '#e8b64c' : '#fff1a8';
    ctx.beginPath(); ctx.ellipse(cx, cy, 5, 2.5, 0, 0, Math.PI * 2); ctx.fill();
  }
}

function drawDebris(ctx: CanvasRenderingContext2D, d: Debris): void {
  ctx.save(); ctx.translate(d.x, d.y); ctx.rotate(d.rot);
  if (d.kind === 0) { // os
    ctx.fillStyle = '#d8cfbf'; ctx.fillRect(-12, -2.5, 24, 5);
    for (const sx of [-12, 12]) for (const sy of [-3, 3]) { ctx.beginPath(); ctx.arc(sx, sy, 3.5, 0, Math.PI * 2); ctx.fill(); }
  } else if (d.kind === 1) { // cailloux
    ctx.fillStyle = '#9a8f82'; ctx.beginPath(); ctx.ellipse(-5, 0, 8, 6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#b3a796'; ctx.beginPath(); ctx.ellipse(6, 2, 6, 4, 0, 0, Math.PI * 2); ctx.fill();
  } else { // écailles mues
    ctx.fillStyle = '#7a7486';
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(i * 7 - 7, 0, 5, 0, Math.PI); ctx.fill(); }
  }
  ctx.restore();
}

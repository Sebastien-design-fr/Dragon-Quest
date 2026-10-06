// Placeholders procéduraux : dessinent chaque pièce du dragon et chaque équipement
// tant que l'illustration définitive n'est pas livrée. Ils occupent exactement la boîte
// et le pivot déclarés dans le rig : remplacer un placeholder par le vrai fichier ne
// change donc rien à la logique ni aux ancrages.
import type { PartDef } from '../core/types.js';

export interface PartStyle {
  palette: Record<string, string>;
  params: { horn: number; spikes: number; gold: number };
  time: number;
  effects: boolean;   // effets lumineux permanents autorisés (qualité)
}

// ---------- Utilitaires couleur ----------
export function shade(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * f), g = Math.round(((n >> 8) & 255) * f), b = Math.round((n & 255) * f);
  return `rgb(${Math.min(255, r)},${Math.min(255, g)},${Math.min(255, b)})`;
}

function goldPulse(st: PartStyle, phase = 0): number {
  return st.effects ? 0.55 + 0.45 * Math.sin(st.time * 2.2 + phase) : 0.7;
}

// ---------- Pièces du dragon ----------
export function drawPart(ctx: CanvasRenderingContext2D, part: PartDef, st: PartStyle): void {
  const f = part.shade ?? 1;
  const P = st.palette;
  const c = {
    base: shade(P.base, f), mid: shade(P.mid, f), edge: shade(P.edge, f), belly: shade(P.belly, f),
    bellyLine: shade(P.bellyLine, f), membrane: shade(P.membrane, f), membraneEdge: shade(P.membraneEdge, f),
    horn: shade(P.horn, f), hornTip: shade(P.hornTip, f), claw: shade(P.claw, f)
  };
  const w = part.w, h = part.h;
  const x0 = -part.pivot[0] * w, y0 = -part.pivot[1] * h;
  const gold = st.params.gold > 0;
  ctx.lineJoin = 'round';

  switch (part.shape) {
    case 'torso': {
      const cx = x0 + w / 2, cy = y0 + h / 2;
      if (st.params.spikes > 0) spikesRow(ctx, cx - w * 0.38, cy - h * 0.42, cx + w * 0.3, cy - h * 0.46, Math.round(6 * st.params.spikes) + 2, h * 0.22 * st.params.spikes, c.horn);
      ctx.fillStyle = c.base;
      ctx.beginPath(); ctx.ellipse(cx, cy, w / 2, h / 2, 0, 0, Math.PI * 2); ctx.fill();
      rim(ctx, c.edge, h * 0.025);
      ctx.fillStyle = c.mid;
      ctx.beginPath(); ctx.ellipse(cx, cy - h * 0.12, w * 0.44, h * 0.3, 0, 0, Math.PI * 2); ctx.fill();
      // plaques ventrales
      ctx.fillStyle = c.belly;
      ctx.beginPath(); ctx.ellipse(cx + w * 0.05, cy + h * 0.24, w * 0.4, h * 0.2, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = c.bellyLine; ctx.lineWidth = Math.max(1, h * 0.02);
      for (let i = -3; i <= 3; i++) {
        const x = cx + w * 0.05 + i * w * 0.1;
        ctx.beginPath(); ctx.moveTo(x, cy + h * 0.1); ctx.lineTo(x - w * 0.02, cy + h * 0.42); ctx.stroke();
      }
      scales(ctx, cx - w * 0.3, cy - h * 0.25, w * 0.6, h * 0.3, h * 0.09, c.edge);
      if (gold) veins(ctx, [[cx - w * 0.3, cy - h * 0.05], [cx - w * 0.1, cy - h * 0.2], [cx + w * 0.05, cy - h * 0.02], [cx + w * 0.25, cy - h * 0.18]], P.gold, h * 0.035, goldPulse(st));
      break;
    }
    case 'leg': {
      const t0 = h / 2, t1 = h * 0.32;
      ctx.fillStyle = c.base;
      ctx.beginPath();
      ctx.moveTo(x0, -t0); ctx.quadraticCurveTo(x0 + w * 0.45, -t0 * 1.15, x0 + w * 0.9, -t1);
      ctx.lineTo(x0 + w * 0.9, t1); ctx.quadraticCurveTo(x0 + w * 0.45, t0 * 1.1, x0, t0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = c.mid;
      ctx.beginPath(); ctx.ellipse(x0 + w * 0.3, 0, w * 0.24, t0 * 0.7, 0, 0, Math.PI * 2); ctx.fill();
      // pied : orienté vers l'avant du dragon (axe -y local)
      ctx.fillStyle = c.base;
      ctx.beginPath(); ctx.ellipse(x0 + w * 0.94, -h * 0.25, h * 0.32, h * 0.7, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = c.claw;
      for (let i = 0; i < 3; i++) {
        const yy = -h * 0.85 + i * h * 0.32;
        ctx.beginPath(); ctx.moveTo(x0 + w * 0.92, yy); ctx.lineTo(x0 + w * 1.06, yy - h * 0.22); ctx.lineTo(x0 + w * 1.0, yy + h * 0.12); ctx.closePath(); ctx.fill();
      }
      if (gold) veins(ctx, [[x0 + w * 0.1, 0], [x0 + w * 0.45, -t0 * 0.3], [x0 + w * 0.8, 0]], P.gold, h * 0.06, goldPulse(st, 1));
      break;
    }
    case 'wing': {
      const S = { x: 0, y: 0 }, E = { x: -0.3 * w, y: -0.55 * h }, W = { x: -0.5 * w, y: -0.9 * h };
      const tips = [{ x: -0.95 * w, y: -0.74 * h }, { x: -0.93 * w, y: -0.36 * h }, { x: -0.72 * w, y: -0.02 * h }, { x: -0.36 * w, y: 0.06 * h }];
      ctx.fillStyle = c.membrane;
      ctx.beginPath(); ctx.moveTo(S.x, S.y); ctx.lineTo(E.x, E.y); ctx.lineTo(W.x, W.y); ctx.lineTo(tips[0].x, tips[0].y);
      for (let i = 1; i < tips.length; i++) {
        const a = tips[i - 1], b = tips[i];
        const mx = (a.x + b.x) / 2 + (W.x - (a.x + b.x) / 2) * 0.22, my = (a.y + b.y) / 2 + (W.y - (a.y + b.y) / 2) * 0.22;
        ctx.quadraticCurveTo(mx, my, b.x, b.y);
      }
      ctx.quadraticCurveTo(-0.15 * w, -0.05 * h, S.x, S.y); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = c.membraneEdge; ctx.lineWidth = Math.max(1, w * 0.006);
      for (const tp of tips) { ctx.beginPath(); ctx.moveTo(W.x, W.y); ctx.lineTo(tp.x, tp.y); ctx.stroke(); }
      ctx.strokeStyle = c.base; ctx.lineWidth = Math.max(2, w * 0.035); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(S.x, S.y); ctx.lineTo(E.x, E.y); ctx.lineTo(W.x, W.y); ctx.stroke();
      ctx.lineWidth = Math.max(1.5, w * 0.014);
      for (const tp of tips) { ctx.beginPath(); ctx.moveTo(W.x, W.y); ctx.lineTo(tp.x, tp.y); ctx.stroke(); }
      ctx.fillStyle = c.claw;
      ctx.beginPath(); ctx.moveTo(W.x, W.y); ctx.lineTo(W.x - w * 0.02, W.y - h * 0.09); ctx.lineTo(W.x + w * 0.03, W.y - h * 0.02); ctx.closePath(); ctx.fill();
      if (gold) {
        ctx.strokeStyle = P.gold; ctx.globalAlpha = 0.5 * goldPulse(st, 2); ctx.lineWidth = Math.max(1, w * 0.006);
        for (const tp of tips) { ctx.beginPath(); ctx.moveTo(W.x, W.y); ctx.lineTo(tp.x, tp.y); ctx.stroke(); }
        ctx.globalAlpha = 1;
      }
      break;
    }
    case 'tail':
    case 'neck': {
      const t0 = h / 2, t1 = (part.h2 ?? h * 0.8) / 2;
      ctx.fillStyle = c.base;
      ctx.beginPath(); ctx.moveTo(x0 - w * 0.08, -t0); ctx.lineTo(x0 + w * 1.08, -t1); ctx.lineTo(x0 + w * 1.08, t1); ctx.lineTo(x0 - w * 0.08, t0); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(x0 - w * 0.08, -t0); ctx.lineTo(x0 + w * 1.08, -t1); rim(ctx, c.edge, h * 0.06);
      // dessous clair (plaques) côté +y
      ctx.fillStyle = c.belly;
      ctx.beginPath(); ctx.moveTo(x0, t0 * 0.35); ctx.lineTo(x0 + w, t1 * 0.35); ctx.lineTo(x0 + w, t1 * 0.95); ctx.lineTo(x0, t0 * 0.95); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = c.bellyLine; ctx.lineWidth = Math.max(1, h * 0.04);
      for (let i = 1; i < 4; i++) { const x = x0 + (w * i) / 4; ctx.beginPath(); ctx.moveTo(x, t0 * 0.4); ctx.lineTo(x, t0 * 0.9); ctx.stroke(); }
      if (st.params.spikes > 0) spikesRow(ctx, x0 + w * 0.1, -t0 * 0.95, x0 + w * 0.9, -t1 * 0.95, 2, h * 0.38 * st.params.spikes, c.horn);
      if (gold) veins(ctx, [[x0, -t0 * 0.2], [x0 + w * 0.5, -t0 * 0.45], [x0 + w, -t1 * 0.2]], P.gold, h * 0.06, goldPulse(st, 3));
      break;
    }
    case 'tailTip': {
      const t0 = h / 2;
      ctx.fillStyle = c.base;
      ctx.beginPath(); ctx.moveTo(x0 - w * 0.08, -t0); ctx.lineTo(x0 + w * 0.8, -t0 * 0.3); ctx.lineTo(x0 + w * 0.8, t0 * 0.3); ctx.lineTo(x0 - w * 0.08, t0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = c.horn; // pointe en fer de lance
      ctx.beginPath(); ctx.moveTo(x0 + w * 0.6, 0); ctx.lineTo(x0 + w * 0.85, -h * 1.1); ctx.lineTo(x0 + w * 1.25, 0); ctx.lineTo(x0 + w * 0.85, h * 0.9); ctx.closePath(); ctx.fill();
      if (gold) { ctx.strokeStyle = P.gold; ctx.lineWidth = Math.max(1, h * 0.08); ctx.globalAlpha = goldPulse(st, 4); ctx.stroke(); ctx.globalAlpha = 1; }
      break;
    }
    case 'head': {
      const L = w, H = h;
      ctx.fillStyle = c.base;
      ctx.beginPath();
      ctx.moveTo(x0, y0 + H * 0.35);
      ctx.lineTo(x0 + L * 0.25, y0);
      ctx.lineTo(x0 + L * 0.62, y0 + H * 0.16);
      ctx.lineTo(x0 + L, y0 + H * 0.42);
      ctx.lineTo(x0 + L * 0.98, y0 + H * 0.66);
      ctx.lineTo(x0 + L * 0.3, y0 + H * 0.78);
      ctx.lineTo(x0, y0 + H * 0.9);
      ctx.closePath(); ctx.fill();
      rim(ctx, c.edge, H * 0.035);
      ctx.fillStyle = c.mid; // arcade sourcilière
      ctx.beginPath(); ctx.moveTo(x0 + L * 0.34, y0 + H * 0.2); ctx.lineTo(x0 + L * 0.66, y0 + H * 0.24); ctx.lineTo(x0 + L * 0.5, y0 + H * 0.36); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.arc(x0 + L * 0.93, y0 + H * 0.4, Math.max(1, H * 0.04), 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = c.claw; // crocs supérieurs
      for (let i = 0; i < 4; i++) {
        const x = x0 + L * (0.5 + i * 0.12);
        ctx.beginPath(); ctx.moveTo(x, y0 + H * 0.7); ctx.lineTo(x + L * 0.02, y0 + H * 0.86); ctx.lineTo(x + L * 0.045, y0 + H * 0.69); ctx.closePath(); ctx.fill();
      }
      scales(ctx, x0 + L * 0.1, y0 + H * 0.4, L * 0.35, H * 0.3, H * 0.1, c.edge);
      if (gold) veins(ctx, [[x0 + L * 0.1, y0 + H * 0.6], [x0 + L * 0.35, y0 + H * 0.5], [x0 + L * 0.7, y0 + H * 0.55]], P.gold, H * 0.04, goldPulse(st, 5));
      break;
    }
    case 'jaw': {
      ctx.fillStyle = c.mid;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0 + w, y0 + h * 0.1); ctx.lineTo(x0 + w * 0.92, y0 + h * 0.75); ctx.lineTo(x0 + w * 0.1, y0 + h); ctx.closePath(); ctx.fill();
      ctx.fillStyle = c.claw;
      for (let i = 0; i < 4; i++) {
        const x = x0 + w * (0.35 + i * 0.16);
        ctx.beginPath(); ctx.moveTo(x, y0 + h * 0.15); ctx.lineTo(x + w * 0.03, y0 - h * 0.45); ctx.lineTo(x + w * 0.07, y0 + h * 0.15); ctx.closePath(); ctx.fill();
      }
      break;
    }
    case 'horn': {
      const g = ctx.createLinearGradient(x0, 0, x0 + w, 0);
      g.addColorStop(0, c.horn); g.addColorStop(1, gold ? P.gold : c.hornTip);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(x0, -h / 2); ctx.quadraticCurveTo(x0 + w * 0.6, -h * 0.7, x0 + w, -h * 1.2); ctx.quadraticCurveTo(x0 + w * 0.55, h * 0.1, x0, h / 2); ctx.closePath(); ctx.fill();
      break;
    }
    case 'eye': {
      const cx = x0 + w / 2, cy = y0 + h / 2;
      if (gold || st.params.gold === 0) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = P.eyeGlow; ctx.globalAlpha = (gold ? 0.5 : 0.25) * goldPulse(st, 6);
        ctx.beginPath(); ctx.ellipse(cx, cy, w * 0.9, h * 1.1, 0, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      }
      ctx.fillStyle = P.eye;
      ctx.beginPath(); ctx.moveTo(cx - w / 2, cy); ctx.quadraticCurveTo(cx, cy - h * 0.9, cx + w / 2, cy - h * 0.1); ctx.quadraticCurveTo(cx, cy + h * 0.8, cx - w / 2, cy); ctx.fill();
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.ellipse(cx + w * 0.04, cy - h * 0.05, Math.max(0.6, w * 0.07), h * 0.42, 0, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'eyelid': {
      ctx.fillStyle = c.base;
      ctx.beginPath(); ctx.ellipse(x0 + w / 2, y0 + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2); ctx.fill();
      break;
    }
    default: {
      ctx.fillStyle = c.mid; ctx.fillRect(x0, y0, w, h);
    }
  }
}

/** Liseré de lumière sur le chemin courant : détache les écailles noires du fond sombre. */
function rim(ctx: CanvasRenderingContext2D, color: string, width: number): void {
  ctx.strokeStyle = color; ctx.lineWidth = Math.max(0.8, width); ctx.globalAlpha = 0.9;
  ctx.stroke(); ctx.globalAlpha = 1;
}

function spikesRow(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, n: number, size: number, color: string): void {
  ctx.fillStyle = color;
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1);
    const x = x1 + (x2 - x1) * t, y = y1 + (y2 - y1) * t;
    const s = size * (0.7 + 0.3 * Math.sin(Math.PI * t));
    ctx.beginPath(); ctx.moveTo(x - s * 0.35, y + s * 0.2); ctx.lineTo(x - s * 0.25, y - s); ctx.lineTo(x + s * 0.4, y + s * 0.2); ctx.closePath(); ctx.fill();
  }
}

function scales(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, color: string): void {
  if (r < 2) return;
  ctx.strokeStyle = color; ctx.lineWidth = Math.max(0.6, r * 0.12); ctx.globalAlpha = 0.55;
  for (let row = 0; row * r * 0.8 < h; row++) {
    for (let col = 0; col * r < w; col++) {
      const cx = x + col * r + (row % 2) * r * 0.5, cy = y + row * r * 0.8;
      ctx.beginPath(); ctx.arc(cx, cy, r * 0.5, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
}

function veins(ctx: CanvasRenderingContext2D, pts: number[][], color: string, width: number, alpha: number): void {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = color; ctx.lineCap = 'round';
  for (const [lw, a] of [[width * 3, alpha * 0.25], [width, alpha]]) {
    ctx.lineWidth = Math.max(0.8, lw); ctx.globalAlpha = a;
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.stroke();
  }
  ctx.restore();
}

// ---------- Équipements ----------
export interface EquipStyle { color: string; glow: number; time: number; tint?: string }

/** Dessine un équipement placeholder centré sur l'ancrage (repère local de l'ancrage). */
export function drawEquipment(ctx: CanvasRenderingContext2D, shape: string, w: number, h: number, st: EquipStyle): void {
  const metal = st.tint ?? '#5d5a63';
  const accent = st.color;
  ctx.lineJoin = 'round';
  if (st.glow > 0) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = st.glow * (0.14 + 0.1 * Math.sin(st.time * 3));
    ctx.fillStyle = accent; ctx.beginPath(); ctx.ellipse(0, 0, w * 0.55, h * 0.55, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = metal; ctx.strokeStyle = accent; ctx.lineWidth = Math.max(1, Math.min(w, h) * 0.08);
  ctx.beginPath();
  switch (shape) {
    case 'helmet': // calotte posée sur le crâne (vers -y), cornes d'ornement
      ctx.moveTo(-w / 2, h * 0.3); ctx.quadraticCurveTo(-w * 0.45, -h * 0.6, w * 0.1, -h * 0.55); ctx.quadraticCurveTo(w * 0.5, -h * 0.4, w / 2, h * 0.3); ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = accent; ctx.beginPath(); ctx.moveTo(-w * 0.2, -h * 0.45); ctx.lineTo(-w * 0.45, -h * 0.95); ctx.lineTo(-w * 0.02, -h * 0.5); ctx.closePath(); ctx.fill();
      break;
    case 'crown':
      ctx.moveTo(-w / 2, h * 0.3); ctx.lineTo(-w / 2, -h * 0.2); ctx.lineTo(-w * 0.3, h * 0.0); ctx.lineTo(-w * 0.15, -h * 0.6); ctx.lineTo(0, -h * 0.05); ctx.lineTo(w * 0.15, -h * 0.6); ctx.lineTo(w * 0.3, 0); ctx.lineTo(w / 2, -h * 0.2); ctx.lineTo(w / 2, h * 0.3); ctx.closePath();
      ctx.fillStyle = accent; ctx.fill(); ctx.strokeStyle = '#fff3c4'; ctx.lineWidth *= 0.5; ctx.stroke();
      break;
    case 'necklace': // bande autour du cou (perpendiculaire à l'os) + pendentif
      ctx.ellipse(0, 0, w * 0.2, h / 2, 0, 0, Math.PI * 2); ctx.lineWidth = Math.max(1.5, w * 0.12); ctx.strokeStyle = metal; ctx.stroke();
      ctx.strokeStyle = accent; ctx.lineWidth *= 0.4; ctx.stroke();
      ctx.fillStyle = accent; ctx.beginPath(); ctx.moveTo(w * 0.15, h * 0.42); ctx.lineTo(w * 0.32, h * 0.62); ctx.lineTo(w * 0.15, h * 0.85); ctx.lineTo(-w * 0.02, h * 0.62); ctx.closePath(); ctx.fill();
      break;
    case 'plate': // plastron
      ctx.moveTo(-w / 2, -h * 0.45); ctx.lineTo(w * 0.45, -h * 0.5); ctx.quadraticCurveTo(w * 0.6, 0, w * 0.35, h * 0.5); ctx.lineTo(-w * 0.4, h * 0.45); ctx.quadraticCurveTo(-w * 0.6, 0, -w / 2, -h * 0.45); ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-w * 0.3, 0); ctx.lineTo(w * 0.35, 0); ctx.stroke();
      ctx.fillStyle = accent; ctx.beginPath(); ctx.arc(w * 0.05, -h * 0.15, Math.min(w, h) * 0.1, 0, Math.PI * 2); ctx.fill();
      break;
    case 'bracer': // protection de patte : bande sur l'os de la patte + griffes
      ctx.rect(-w * 0.35, -h / 2, w * 0.7, h); ctx.fill(); ctx.stroke();
      ctx.fillStyle = accent; ctx.beginPath(); ctx.moveTo(w * 0.3, -h * 0.5); ctx.lineTo(w * 0.62, -h * 0.75); ctx.lineTo(w * 0.35, -h * 0.15); ctx.closePath(); ctx.fill();
      break;
    case 'wingplate': // ornement d'aile le long du bord d'attaque
      ctx.moveTo(-w / 2, 0); ctx.quadraticCurveTo(0, -h, w / 2, 0); ctx.quadraticCurveTo(0, -h * 0.3, -w / 2, 0); ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = accent;
      for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(i * w * 0.25, -h * 0.45); ctx.lineTo(i * w * 0.25 - w * 0.06, -h * 0.95); ctx.lineTo(i * w * 0.25 + w * 0.08, -h * 0.5); ctx.closePath(); ctx.fill(); }
      break;
    case 'tailring':
      ctx.rect(-w * 0.18, -h / 2, w * 0.36, h); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.rect(w * 0.3, -h * 0.42, w * 0.2, h * 0.84); ctx.fill(); ctx.stroke();
      break;
    case 'tailspikes':
      ctx.rect(-w * 0.3, -h * 0.3, w * 0.6, h * 0.6); ctx.fill(); ctx.stroke();
      ctx.fillStyle = accent;
      for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(i * w * 0.2 - w * 0.07, -h * 0.3); ctx.lineTo(i * w * 0.2, -h * 0.95); ctx.lineTo(i * w * 0.2 + w * 0.07, -h * 0.3); ctx.closePath(); ctx.fill(); }
      break;
    case 'blade': // lame de queue dans l'axe de l'os
      ctx.moveTo(-w * 0.2, -h * 0.2); ctx.lineTo(w * 0.7, -h * 0.5); ctx.lineTo(w, 0); ctx.lineTo(w * 0.7, h * 0.5); ctx.lineTo(-w * 0.2, h * 0.2); ctx.closePath();
      ctx.fill(); ctx.stroke();
      break;
    default:
      ctx.rect(-w / 2, -h / 2, w, h); ctx.fill(); ctx.stroke();
  }
}

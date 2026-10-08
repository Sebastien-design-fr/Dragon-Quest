// Premier lancement (refonte UX, point 7) : l'œuf, l'éclosion, le nom, le premier repas.
// Deux minutes qui créent l'attachement. Ne se joue qu'une fois, et seulement pour un dragon sans nom.
// L'œuf est dessiné (couleurs de la variante) ; une illustration peinte le remplace si elle est fournie
// (assets/egg/egg_<variante>.webp, voir scripts/import-ui-art.py).
import { Assets } from '../engine/AssetManager.js';
import { Sound } from '../engine/Sound.js';
import type { App } from './App.js';
import { h } from './dom.js';
import { UI } from './Motion.js';

const KEY = 'quete-du-dragon:hatched';
const TAPS = 7;
const NAMES = ['Pyros', 'Nyx', 'Ember', 'Onyx', 'Saphir', 'Ignis', 'Orion', 'Kaïros', 'Drakar', 'Zéphyr'];
const NAMES_F = ['Luna', 'Astra', 'Nyx', 'Saphira', 'Lyra', 'Ember', 'Aïka', 'Séléné', 'Vesta', 'Iris'];

export function needsHatch(app: App): boolean {
  const comp = app.family.companion;
  if (!comp || comp.data.name) return false;
  // vrai premier lancement seulement : un dragon qui a déjà grandi ne sort pas d'un œuf
  if (app.state.data.level > 1 || app.state.data.stage !== 'baby') return false;
  try { return !localStorage.getItem(KEY); } catch { return false; }
}

interface Piece { x: number; y: number; vx: number; vy: number; r: number; vr: number; s: number; pts: number[] }

export function hatchCeremony(app: App, onDone?: () => void): void {
  const parent = app.isParent;
  const variant = app.ownVariant;
  const pal = variant === 'dragonne'
    ? { a: '#3a1f55', b: '#8a5cc2', c: '#e0c8ff', glow: '200,150,255' }
    : { a: '#141217', b: '#3c3642', c: '#e8b85a', glow: '255,190,90' };
  const painted = Assets.art(`egg/egg_${variant}`);
  const img = painted ? Object.assign(new Image(), { src: painted }) : null;

  const canvas = h('canvas', { class: 'hx-canvas', 'aria-label': 'Œuf de dragon : touche-le' }) as HTMLCanvasElement;
  const title = h('h2', { class: 'hx-title' }, parent ? 'Un œuf de dragonne t’attend' : 'Un œuf de dragon t’a choisi');
  const hint = h('p', { class: 'hx-hint' }, 'Touche-le pour le réchauffer…');
  const dots = h('div', { class: 'hx-dots' }, ...Array.from({ length: TAPS }, () => h('i')));
  const wrap = h('div', { class: 'hx', role: 'dialog', 'aria-label': 'Éclosion' }, title, canvas, hint, dots);
  document.body.append(wrap);
  requestAnimationFrame(() => wrap.classList.add('open'));

  const g = canvas.getContext('2d')!;
  let W = 0, H = 0, dpr = 1;
  const size = () => {
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(3, window.devicePixelRatio || 1);
    W = canvas.width = Math.round(r.width * dpr); H = canvas.height = Math.round(r.height * dpr);
  };
  size();
  window.addEventListener('resize', size);

  // fissures : arbre aléatoire qui s'étend à chaque toucher
  let seed = 7;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const cracks: Array<Array<[number, number]>> = [];
  for (let k = 0; k < TAPS; k++) {
    const line: Array<[number, number]> = [];
    let x = (rnd() - 0.5) * 0.7, y = -0.55 + rnd() * 0.5;
    line.push([x, y]);
    for (let i = 0; i < 6; i++) { x += (rnd() - 0.5) * 0.22; y += 0.06 + rnd() * 0.12; line.push([x, y]); }
    cracks.push(line);
  }

  let taps = 0, wob = 0, glow = 0.15, t = 0, phase: 'egg' | 'burst' | 'done' = 'egg', flash = 0, raf = 0;
  const pieces: Piece[] = [];

  const eggPath = (cx: number, cy: number, w: number) => {
    const hh = w * 1.3;
    g.beginPath();
    g.moveTo(cx, cy - hh / 2);
    g.bezierCurveTo(cx + w * 0.55, cy - hh / 2, cx + w * 0.55, cy + hh * 0.48, cx, cy + hh / 2);
    g.bezierCurveTo(cx - w * 0.55, cy + hh * 0.48, cx - w * 0.55, cy - hh / 2, cx, cy - hh / 2);
    g.closePath();
  };

  const draw = (now: number) => {
    raf = requestAnimationFrame(draw);
    const dt = Math.min(0.05, (now - (t || now)) / 1000); t = now;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, W, H);
    const cx = W / 2, cy = H * 0.52, w = Math.min(W * 0.46, H * 0.5);
    wob = Math.max(0, wob - dt * 2.2);
    glow += ((0.15 + taps / TAPS * 0.85) - glow) * Math.min(1, dt * 4);
    // halo
    const halo = g.createRadialGradient(cx, cy, w * 0.2, cx, cy, w * (1.1 + glow * 0.5));
    halo.addColorStop(0, `rgba(${pal.glow},${0.35 * glow + 0.08 * Math.sin(now / 400)})`);
    halo.addColorStop(1, `rgba(${pal.glow},0)`);
    g.fillStyle = halo; g.fillRect(0, 0, W, H);
    // nid / ombre
    g.fillStyle = 'rgba(0,0,0,.45)';
    g.beginPath(); g.ellipse(cx, cy + w * 0.68, w * 0.5, w * 0.1, 0, 0, Math.PI * 2); g.fill();

    if (phase === 'egg') {
      const rot = Math.sin(now / 45) * wob * 0.18 + Math.sin(now / 900) * 0.025;
      g.save();
      g.translate(cx, cy + w * 0.6); g.rotate(rot); g.translate(-cx, -(cy + w * 0.6));
      if (img && img.complete && img.naturalWidth) {
        const ih = w * 1.4, iw = ih * img.naturalWidth / img.naturalHeight;
        g.drawImage(img, cx - iw / 2, cy - ih / 2, iw, ih);
        eggPath(cx, cy, w); g.save(); g.clip();
      } else {
        eggPath(cx, cy, w);
        const body = g.createRadialGradient(cx - w * 0.18, cy - w * 0.3, w * 0.05, cx, cy, w * 0.8);
        body.addColorStop(0, pal.b); body.addColorStop(1, pal.a);
        g.fillStyle = body; g.fill();
        g.save(); g.clip();
        // écailles
        g.strokeStyle = pal.c; g.globalAlpha = 0.28; g.lineWidth = 1.4 * dpr;
        const sc = w * 0.11;
        for (let row = 0, y = cy - w * 0.7; y < cy + w * 0.75; y += sc * 0.62, row++) {
          for (let x = cx - w * 0.6 + (row % 2) * sc / 2; x < cx + w * 0.6; x += sc) {
            g.beginPath(); g.arc(x, y, sc / 2, 0.1 * Math.PI, 0.9 * Math.PI); g.stroke();
          }
        }
        g.globalAlpha = 1;
        // reflet
        const shine = g.createRadialGradient(cx - w * 0.2, cy - w * 0.38, 0, cx - w * 0.2, cy - w * 0.38, w * 0.35);
        shine.addColorStop(0, 'rgba(255,255,255,.35)'); shine.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = shine; g.fillRect(cx - w, cy - w, w * 2, w * 2);
      }
      // lumière intérieure qui perce par les fissures
      g.lineCap = 'round'; g.lineJoin = 'round';
      for (let k = 0; k < taps; k++) {
        const line = cracks[k];
        g.strokeStyle = `rgba(${pal.glow},${0.35 + 0.65 * glow})`; g.lineWidth = 5 * dpr;
        g.shadowColor = `rgba(${pal.glow},1)`; g.shadowBlur = 14 * dpr;
        g.beginPath(); line.forEach(([x, y], i) => i ? g.lineTo(cx + x * w, cy + y * w) : g.moveTo(cx + x * w, cy + y * w)); g.stroke();
        g.shadowBlur = 0; g.strokeStyle = '#fff6dc'; g.lineWidth = 1.6 * dpr; g.stroke();
      }
      g.restore();
      g.restore();
    } else {
      for (const p of pieces) {
        p.vy += 900 * dpr * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.r += p.vr * dt;
        g.save(); g.translate(p.x, p.y); g.rotate(p.r);
        g.fillStyle = pal.b; g.strokeStyle = pal.c; g.lineWidth = 1 * dpr;
        g.beginPath(); for (let i = 0; i < p.pts.length; i += 2) { const px = p.pts[i] * p.s, py = p.pts[i + 1] * p.s; i ? g.lineTo(px, py) : g.moveTo(px, py); }
        g.closePath(); g.fill(); g.stroke(); g.restore();
      }
    }
    if (flash > 0) { g.fillStyle = `rgba(255,248,230,${flash})`; g.fillRect(0, 0, W, H); flash = Math.max(0, flash - dt * 1.4); }
  };
  raf = requestAnimationFrame(draw);

  const tap = () => {
    if (phase !== 'egg') return;
    taps++;
    wob = 1;
    dots.children[taps - 1]?.classList.add('on');
    try { navigator.vibrate?.(taps >= TAPS ? [30, 40, 80] : 12 + taps * 3); } catch { /* */ }
    Sound.ui(taps >= TAPS ? 'success' : 'tick');
    hint.textContent = taps < 3 ? 'Il bouge !' : taps < 5 ? 'Encore… il fissure !' : taps < TAPS ? 'Presque !' : '';
    if (taps >= TAPS) void hatch();
  };
  canvas.addEventListener('pointerdown', tap);

  const hatch = async () => {
    phase = 'burst';
    flash = 1;
    const cx = W / 2, cy = H * 0.52;
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2 + Math.random() * 0.3, sp = (380 + Math.random() * 520) * dpr;
      const pts: number[] = []; const n = 3 + (i % 2);
      for (let k = 0; k < n; k++) { const aa = (k / n) * Math.PI * 2 + Math.random() * 0.6; pts.push(Math.cos(aa), Math.sin(aa)); }
      pieces.push({ x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 300 * dpr, r: 0, vr: (Math.random() - 0.5) * 14, s: (10 + Math.random() * 18) * dpr, pts });
    }
    void Sound.play('evolution', { user: true });
    title.textContent = parent ? 'Ta dragonne est née !' : 'Ton dragon est né !';
    await UI.wait(900);
    wrap.classList.add('reveal');          // l'œuf s'efface : le bébé apparaît sur la scène
    app.view.emit('evolutionBurst', 'body_center');
    void app.act('welcome');
    await UI.wait(1100);
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', size);
    wrap.remove();
    try { localStorage.setItem(KEY, String(Date.now())); } catch { /* */ }
    nameStep(app, onDone);
  };
}

/** Le nom : propositions en un toucher, ou le sien. */
function nameStep(app: App, onDone?: () => void): void {
  const comp = app.family.companion!;
  const parent = app.isParent;
  const input = h('input', { type: 'text', maxlength: '18', placeholder: 'Son nom…', 'aria-label': 'Nom' }) as HTMLInputElement;
  const picks = [...(app.ownVariant === 'dragonne' ? NAMES_F : NAMES)].sort(() => Math.random() - 0.5).slice(0, 5);
  const ok = () => {
    const n = input.value.trim();
    if (!n) { input.focus(); input.classList.add('hx-shake'); setTimeout(() => input.classList.remove('hx-shake'), 400); return; }
    comp.setName(n);
    UI.success();
    panel.classList.remove('open');
    setTimeout(() => panel.remove(), 300);
    void app.act('happy');
    const who = app.family.book?.childName ?? app.family.linkState.deviceName;
    app.say(`${comp.name}… j’adore ! Merci${who ? ', ' + who : ''} !`, null, 5000);
    app.refresh();
    setTimeout(() => firstMeal(app, onDone), 2600);
  };
  input.addEventListener('keydown', e => { if (e.key === 'Enter') ok(); });
  const panel = h('div', { class: 'hx-name' },
    h('h3', null, parent ? 'Comment s’appelle-t-elle ?' : 'Comment vas-tu l’appeler ?'),
    h('p', { class: 'small muted' }, parent ? 'Elle portera ce nom toute sa vie.' : 'Il portera ce nom toute sa vie, et il t’appellera par ton prénom.'),
    h('div', { class: 'hx-picks' }, ...picks.map(n => h('button', { class: 'chip', onclick: () => { input.value = n; UI.tick(); } }, n))),
    h('div', { class: 'row' }, input, h('button', { class: 'btn primary', onclick: ok }, 'C’est son nom !')));
  document.body.append(panel);
  requestAnimationFrame(() => panel.classList.add('open'));
}

/** Premier repas : le bouton « Nourrir » est mis en avant jusqu'à ce qu'on le touche. */
function firstMeal(app: App, onDone?: () => void): void {
  const btn = app.root.querySelector<HTMLElement>('.sh-btn[data-act=feed]');
  app.say('J’ai faim ! Tu me donnes mon premier repas ?', null, 7000);
  if (!btn) { onDone?.(); return; }
  btn.classList.add('hx-coach');
  const tip = h('div', { class: 'hx-tip' }, 'Touche ici pour le nourrir');
  btn.append(tip);
  const end = () => { btn.classList.remove('hx-coach'); tip.remove(); onDone?.(); };
  btn.addEventListener('click', end, { once: true });
  setTimeout(() => { if (tip.isConnected) end(); }, 30000);
}

// Mini-jeu « Pêche au lac » : le dragon et le loup pêchent au bord du lac d'argent.
// Le flotteur frémit quand un poisson grignote (trop tôt = il s'enfuit) ; quand il plonge d'un coup, touche vite !
// Petit poisson +1, gros poisson +3 (plonge moins longtemps), poisson doré +5 (rare et très vif). 60 secondes.
// Les poissons attrapés remplissent le garde-manger (3 par jour au plus).
import { Assets } from '../../engine/AssetManager.js';
import { h } from '../dom.js';
import type { GameOpts } from './index.js';

const DURATION = 60;
type FishKind = 'small' | 'big' | 'gold';
const FISH: Record<FishKind, { pts: number; window: number; len: number; body: [string, string]; label: string }> = {
  small: { pts: 1, window: 0.9, len: 0.07, body: ['#cfe3f2', '#5d7f99'], label: 'Petit poisson' },
  big: { pts: 3, window: 0.68, len: 0.11, body: ['#b7c98a', '#4d5e2c'], label: 'Gros poisson !' },
  gold: { pts: 5, window: 0.52, len: 0.09, body: ['#ffe9a0', '#d18a14'], label: 'Poisson doré !!' }
};

/** Nombre de poissons pris à la dernière partie (pour le garde-manger). */
export let lastCatch = 0;

export function playFishing(dragonName: string, opts: GameOpts): Promise<number> {
  return new Promise(resolve => {
    const cv = h('canvas', { class: 'game-canvas' });
    const scoreEl = h('div', { class: 'game-score' }, '0');
    const timeEl = h('div', { class: 'game-time' }, String(DURATION));
    const hint = h('div', { class: 'fish-hint' }, '');
    const intro = h('div', { class: 'game-intro' },
      h('h2', null, 'Pêche au lac'),
      h('p', null, `${dragonName} et le loup pêchent au bord du lac d’argent. Regarde bien le flotteur : quand il frémit, attends… Quand il plonge d’un coup, touche l’écran !`),
      h('p', { class: 'game-rules' }, 'Petit +1 · Gros +3 · Doré +5 · Trop tôt, le poisson s’enfuit · 60 s'),
      h('button', { class: 'btn primary', onclick: () => { intro.remove(); start(); } }, 'On lance la ligne !'));
    const root = h('div', { class: 'game game-fish' }, cv, h('div', { class: 'game-hud' }, scoreEl, timeEl), hint, intro);
    document.body.append(root);
    const g = cv.getContext('2d')!;

    const wolfImg = new Image(); wolfImg.src = Assets.art('companions/wolf') ?? '';
    const dragonImg = new Image(); if (opts.stand) dragonImg.src = opts.stand;

    let W = 0, H = 0, dpr = 1;
    const layout = () => {
      W = root.clientWidth; H = root.clientHeight; dpr = Math.min(2, window.devicePixelRatio || 1);
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    layout();

    // géométrie (recalculée à chaque image, en fractions de l'écran)
    const horizon = () => H * 0.4;
    const bob = () => ({ x: W * 0.76, y: H * 0.6 });
    const rodTip = () => ({ x: W * 0.6, y: H * 0.5 });

    // ---------- état ----------
    type Phase = 'wait' | 'approach' | 'nibble' | 'bite' | 'flee' | 'caught' | 'escaped';
    let phase: Phase = 'wait', phaseT = 0, waitFor = 2, nibbles = 0, nextNibble = 0, nibbleAt = -9;
    let kind: FishKind = 'small';
    let score = 0, caught = 0, t = 0, last = 0, raf = 0, running = false, over = false, wolfHappy = 0;
    const shadow = { x: 0, y: 0, tx: 0, ty: 0, a: 0 };
    const ripples: Array<{ x: number; y: number; r: number; life: number }> = [];
    const drops: Array<{ x: number; y: number; vx: number; vy: number; life: number }> = [];
    const pops: Array<{ x: number; y: number; text: string; life: number; gold: boolean }> = [];
    let flying: { kind: FishKind; t: number; x0: number; y0: number; x1: number; y1: number } | null = null;
    // poissons qui passent sous l'eau, juste pour l'ambiance
    const swimmers = Array.from({ length: 4 }, () => ({ x: Math.random(), y: 0.55 + Math.random() * 0.4, v: (0.02 + Math.random() * 0.03) * (Math.random() < 0.5 ? -1 : 1), s: 0.6 + Math.random() * 0.6, p: Math.random() * 6 }));

    const pickKind = (): FishKind => { const r = Math.random(); return r < 0.08 ? 'gold' : r < 0.36 ? 'big' : 'small'; };
    const setPhase = (p: Phase) => { phase = p; phaseT = 0; };
    const newFish = () => {
      kind = pickKind();
      const b = bob();
      shadow.x = Math.random() < 0.5 ? W * 0.95 : W * 0.35; shadow.y = b.y + H * (0.06 + Math.random() * 0.08);
      shadow.tx = b.x; shadow.ty = b.y + H * 0.035; shadow.a = 0;
      setPhase('wait'); waitFor = 1.2 + Math.random() * 3;
      nibbles = 1 + Math.floor(Math.random() * 3);
    };
    const splash = (x: number, y: number, n: number, k = 1) => {
      for (let i = 0; i < n; i++) drops.push({ x, y, vx: (Math.random() - 0.5) * 160 * k, vy: -(80 + Math.random() * 160) * k, life: 0.6 + Math.random() * 0.4 });
      ripples.push({ x, y, r: 4, life: 1 });
    };
    const say = (text: string, ms = 1100) => { hint.textContent = text; hint.classList.add('show'); clearTimeout(sayT); sayT = window.setTimeout(() => hint.classList.remove('show'), ms); };
    let sayT = 0;

    const tap = (e: Event) => {
      e.preventDefault();
      if (!running || over) return;
      const b = bob();
      if (phase === 'bite') {
        const f = FISH[kind];
        score += f.pts; caught++;
        splash(b.x, b.y, 16, 1.2);
        flying = { kind, t: 0, x0: b.x, y0: b.y, x1: W * 0.38, y1: H * 0.8 };
        pops.push({ x: b.x, y: b.y - 30, text: `+${f.pts}`, life: 1.1, gold: kind === 'gold' });
        say(f.label);
        try { navigator.vibrate?.(kind === 'small' ? 10 : 18); } catch { /* */ }
        setPhase('caught');
      } else if (phase === 'approach' || phase === 'nibble') {
        splash(b.x, b.y, 6, 0.6);
        say('Trop tôt ! Il s’est sauvé…');
        setPhase('flee');
      } else if (phase === 'wait') {
        ripples.push({ x: b.x, y: b.y, r: 4, life: 0.7 });
      }
    };
    root.addEventListener('pointerdown', tap);

    // ---------- dessin ----------
    const drawScene = (now: number) => {
      const hz = horizon();
      // ciel du soir
      const sky = g.createLinearGradient(0, 0, 0, hz);
      sky.addColorStop(0, '#2a2347'); sky.addColorStop(0.55, '#8a4f6e'); sky.addColorStop(1, '#f2a75a');
      g.fillStyle = sky; g.fillRect(0, 0, W, hz + 1);
      // soleil couchant
      const sx = W * 0.72, sy = hz - H * 0.035;
      const sun = g.createRadialGradient(sx, sy, 0, sx, sy, H * 0.16);
      sun.addColorStop(0, 'rgba(255,240,190,1)'); sun.addColorStop(0.12, 'rgba(255,214,140,.95)'); sun.addColorStop(1, 'rgba(255,170,90,0)');
      g.fillStyle = sun; g.fillRect(0, 0, W, hz);
      // montagnes
      const ridge = (base: number, amp: number, col: string, seed: number) => {
        g.fillStyle = col; g.beginPath(); g.moveTo(0, hz);
        for (let x = 0; x <= W; x += W / 24) g.lineTo(x, base - amp * (0.5 + 0.5 * Math.sin(x / W * 9 + seed) * Math.cos(x / W * 4.3 + seed * 2)));
        g.lineTo(W, hz); g.closePath(); g.fill();
      };
      ridge(hz - H * 0.02, H * 0.09, '#4a3352', 1.2);
      ridge(hz, H * 0.05, '#2d2238', 3.1);
      // lac
      const water = g.createLinearGradient(0, hz, 0, H);
      water.addColorStop(0, '#6c5a7a'); water.addColorStop(0.15, '#3a3a5c'); water.addColorStop(1, '#141a2c');
      g.fillStyle = water; g.fillRect(0, hz, W, H - hz);
      // reflet du soleil : traits qui scintillent
      for (let i = 0; i < 26; i++) {
        const y = hz + 4 + i * i * (H * 0.0009);
        const w = (W * 0.05 + i * 2.2) * (0.6 + 0.4 * Math.sin(now / 400 + i * 1.7));
        g.fillStyle = `rgba(255,200,130,${0.5 - i * 0.017})`;
        g.fillRect(sx - w / 2 + Math.sin(now / 900 + i) * 6, y, w, 1.6 + i * 0.05);
      }
      // reflets clairs à la surface
      g.strokeStyle = 'rgba(200,210,255,.08)'; g.lineWidth = 1;
      for (let i = 0; i < 18; i++) {
        const y = hz + (H - hz) * ((i * 0.137 + now / 60000) % 1);
        const x = ((i * 0.293) % 1) * W;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + 30 + (i % 4) * 14, y); g.stroke();
      }
    };

    const fishPath = (x: number, y: number, len: number, kd: FishKind, ang: number) => {
      const f = FISH[kd];
      g.save(); g.translate(x, y); g.rotate(ang);
      const gr = g.createLinearGradient(0, -len * 0.3, 0, len * 0.3);
      gr.addColorStop(0, f.body[0]); gr.addColorStop(1, f.body[1]);
      g.fillStyle = gr;
      g.beginPath(); g.ellipse(0, 0, len / 2, len * 0.2, 0, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.moveTo(-len * 0.42, 0); g.lineTo(-len * 0.68, -len * 0.2); g.lineTo(-len * 0.68, len * 0.2); g.closePath(); g.fill();
      g.fillStyle = '#111'; g.beginPath(); g.arc(len * 0.3, -len * 0.04, len * 0.035, 0, Math.PI * 2); g.fill();
      if (kd === 'gold') { g.shadowColor = '#ffd76a'; g.shadowBlur = 16; g.strokeStyle = 'rgba(255,240,180,.8)'; g.lineWidth = 1.5; g.beginPath(); g.ellipse(0, 0, len / 2, len * 0.2, 0, 0, Math.PI * 2); g.stroke(); g.shadowBlur = 0; }
      g.restore();
    };

    const drawBank = (now: number) => {
      // berge rocheuse en bas à gauche
      g.fillStyle = '#1b1612';
      g.beginPath(); g.moveTo(0, H * 0.74); g.quadraticCurveTo(W * 0.35, H * 0.76, W * 0.58, H * 0.88); g.lineTo(W * 0.64, H); g.lineTo(0, H); g.closePath(); g.fill();
      g.fillStyle = 'rgba(255,190,120,.12)';
      g.beginPath(); g.moveTo(0, H * 0.74); g.quadraticCurveTo(W * 0.35, H * 0.76, W * 0.58, H * 0.88); g.lineTo(W * 0.57, H * 0.895); g.quadraticCurveTo(W * 0.35, H * 0.78, 0, H * 0.76); g.fill();
      // le dragon, assis en retrait, et le loup au bord de l'eau
      if (dragonImg.complete && dragonImg.naturalWidth) {
        // le dragon, assis sur la berge (taille adaptée à l'écran, en portrait comme en paysage)
        const ar = dragonImg.naturalWidth / dragonImg.naturalHeight;
        const dw = Math.min(W * 0.5, H * 0.24 * ar), dh = dw / ar;
        g.drawImage(dragonImg, -dw * 0.12, H * 0.77 - dh, dw, dh);
      }
      if (wolfImg.complete && wolfImg.naturalWidth) {
        const hop = wolfHappy > 0 ? Math.abs(Math.sin(wolfHappy * 9)) * H * 0.02 : 0;
        const ar = wolfImg.naturalWidth / wolfImg.naturalHeight;
        const ww = Math.min(W * 0.3, H * 0.11 * ar), wh = ww / ar;
        g.save();
        g.translate(W * 0.36, H * 0.86 - hop);
        g.scale(1, 1 + 0.015 * Math.sin(now / 520));
        g.drawImage(wolfImg, -ww / 2, -wh, ww, wh);
        g.restore();
      }
      // canne à pêche
      const tip = rodTip();
      g.strokeStyle = '#5a3a1e'; g.lineWidth = 5; g.lineCap = 'round';
      g.beginPath(); g.moveTo(W * 0.5, H * 0.99); g.quadraticCurveTo(W * 0.53, H * 0.68, tip.x, tip.y); g.stroke();
      g.strokeStyle = '#8a5a2e'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(W * 0.5, H * 0.99); g.quadraticCurveTo(W * 0.53, H * 0.68, tip.x, tip.y); g.stroke();
    };

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
      last = now;
      if (running && !over) { t += dt; if (t >= DURATION) end(); }
      phaseT += dt;
      wolfHappy = Math.max(0, wolfHappy - dt);
      const b = bob();

      // ---------- logique du poisson ----------
      let dip = 0;
      if (running && !over) {
        if (phase === 'wait' && phaseT > waitFor) { setPhase('approach'); }
        else if (phase === 'approach') {
          shadow.a = Math.min(1, shadow.a + dt * 1.5);
          shadow.x += (shadow.tx - shadow.x) * Math.min(1, dt * 1.6);
          shadow.y += (shadow.ty - shadow.y) * Math.min(1, dt * 1.6);
          if (phaseT > 1.3) { setPhase('nibble'); nextNibble = 0.2; }
        } else if (phase === 'nibble') {
          if (phaseT > nextNibble) {
            if (nibbles-- > 0) { nibbleAt = t; nextNibble = phaseT + 0.55 + Math.random() * 0.5; ripples.push({ x: b.x, y: b.y, r: 3, life: 0.6 }); }
            else { setPhase('bite'); splash(b.x, b.y, 8, 0.8); try { navigator.vibrate?.(8); } catch { /* */ } }
          }
        } else if (phase === 'bite') {
          dip = 1;
          if (phaseT > FISH[kind].window) { say('Raté, il s’est échappé !'); setPhase('escaped'); }
        } else if (phase === 'flee' || phase === 'escaped') {
          shadow.x += (W * 1.1 - shadow.x) * Math.min(1, dt * 2); shadow.a = Math.max(0, shadow.a - dt * 1.2);
          if (phaseT > 1.2) newFish();
        } else if (phase === 'caught') {
          shadow.a = 0;
          if (phaseT > 1.1) newFish();
        }
      }
      const nib = t - nibbleAt < 0.25 ? Math.sin(((t - nibbleAt) / 0.25) * Math.PI) : 0;

      // ---------- dessin ----------
      drawScene(now);
      // poissons d'ambiance
      for (const s of swimmers) {
        s.x += s.v * dt; if (s.x < -0.1) s.x = 1.1; if (s.x > 1.1) s.x = -0.1;
        g.globalAlpha = 0.18; g.fillStyle = '#05070f';
        g.beginPath(); g.ellipse(s.x * W, s.y * H + Math.sin(now / 700 + s.p) * 3, 16 * s.s, 5 * s.s, 0, 0, Math.PI * 2); g.fill();
      }
      g.globalAlpha = 1;
      // ombre du poisson qui s'approche
      if (shadow.a > 0) {
        g.globalAlpha = 0.35 * shadow.a; g.fillStyle = kind === 'gold' ? '#6a4a10' : '#05070f';
        const L = FISH[kind].len * W;
        g.beginPath(); g.ellipse(shadow.x, shadow.y + Math.sin(now / 300) * 2, L * 0.5, L * 0.17, 0, 0, Math.PI * 2); g.fill();
        g.globalAlpha = 1;
      }
      // ronds dans l'eau
      for (const r of ripples) { r.r += dt * 50; r.life -= dt; g.strokeStyle = `rgba(220,230,255,${Math.max(0, r.life) * 0.5})`; g.lineWidth = 1.5; g.beginPath(); g.ellipse(r.x, r.y + 2, r.r, r.r * 0.32, 0, 0, Math.PI * 2); g.stroke(); }
      for (let i = ripples.length - 1; i >= 0; i--) if (ripples[i].life <= 0) ripples.splice(i, 1);
      // ligne et flotteur
      const tip = rodTip();
      const by = b.y + Math.sin(now / 600) * 2.5 + nib * 5 + dip * 13;
      g.strokeStyle = 'rgba(230,230,240,.55)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(tip.x, tip.y); g.quadraticCurveTo((tip.x + b.x) / 2, tip.y + (by - tip.y) * 0.75, b.x, by - 8); g.stroke();
      if (!(phase === 'caught' && phaseT < 0.4)) {
        g.save(); g.translate(b.x, by);
        g.fillStyle = '#f4f0e8'; g.beginPath(); g.ellipse(0, -2, 6, 7, 0, Math.PI, 0); g.fill();
        g.fillStyle = '#d8323a'; g.beginPath(); g.ellipse(0, -2, 6, 7, 0, 0, Math.PI); g.fill();
        g.strokeStyle = '#222'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(0, -9); g.lineTo(0, -16); g.stroke();
        g.restore();
        // l'eau couvre le bas du flotteur
        g.fillStyle = 'rgba(20,26,44,.55)'; g.fillRect(b.x - 9, b.y + 2 + dip * 6, 18, 6);
      }
      // éclaboussures
      for (const d of drops) { d.vy += 420 * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.life -= dt; g.fillStyle = `rgba(220,235,255,${Math.max(0, d.life)})`; g.fillRect(d.x, d.y, 2.2, 2.2); }
      for (let i = drops.length - 1; i >= 0; i--) if (drops[i].life <= 0) drops.splice(i, 1);
      drawBank(now);
      // poisson qui vole jusqu'au loup
      if (flying) {
        flying.t += dt / 0.8;
        const u = Math.min(1, flying.t);
        const x = flying.x0 + (flying.x1 - flying.x0) * u, y = flying.y0 + (flying.y1 - flying.y0) * u - Math.sin(u * Math.PI) * H * 0.22;
        fishPath(x, y, FISH[flying.kind].len * W, flying.kind, -0.6 + u * 1.6 + Math.sin(now / 50) * 0.2);
        if (u >= 1) { flying = null; wolfHappy = 1.2; }
      }
      // points
      for (const p of pops) {
        p.life -= dt; p.y -= 40 * dt;
        g.globalAlpha = Math.max(0, Math.min(1, p.life * 1.5));
        g.font = `bold ${p.gold ? 30 : 24}px Georgia, serif`; g.textAlign = 'center';
        g.fillStyle = p.gold ? '#ffd76a' : '#fff3c4'; g.shadowColor = 'rgba(0,0,0,.7)'; g.shadowBlur = 6;
        g.fillText(p.text, p.x, p.y); g.shadowBlur = 0;
      }
      g.globalAlpha = 1;
      for (let i = pops.length - 1; i >= 0; i--) if (pops[i].life <= 0) pops.splice(i, 1);

      scoreEl.textContent = String(score);
      if (root.dataset.phase !== phase) root.dataset.phase = phase;
      const left = Math.max(0, Math.ceil(DURATION - t));
      timeEl.textContent = String(left);
      timeEl.classList.toggle('game-time-low', running && left <= 10);
    };
    raf = requestAnimationFrame(frame);

    function start(): void { running = true; t = 0; newFish(); say('Patience… regarde le flotteur', 1800); }
    function end(): void {
      if (over) return;
      over = true; running = false;
      lastCatch = caught;
      const box = h('div', { class: 'game-intro game-end' },
        h('h2', null, `Score : ${score}`),
        h('p', { class: 'game-rules' }, `${caught} poisson${caught > 1 ? 's' : ''} attrapé${caught > 1 ? 's' : ''}`),
        h('p', null, caught >= 8 ? `Quelle pêche ! ${dragonName} et le loup vont se régaler.` : caught >= 3 ? `Belle pêche, ${dragonName} est ravi.` : `Ça mord peu aujourd’hui… ${dragonName} a aimé ce moment calme avec toi.`),
        h('button', { class: 'btn primary', onclick: finish }, 'Continuer'));
      setTimeout(() => root.append(box), 400);
    }
    function finish(): void {
      cancelAnimationFrame(raf);
      clearTimeout(sayT);
      window.removeEventListener('resize', layout);
      root.remove();
      resolve(score);
    }
    window.addEventListener('resize', layout);
  });
}

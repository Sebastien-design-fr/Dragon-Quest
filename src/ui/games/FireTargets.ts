// Mini-jeu « Tir de feu » : on touche l’écran pour que le dragon crache une boule de feu à cet endroit.
// Cibles en bois, mannequins de paille et lanternes : +1 ; cible dorée : +3 ; cristaux de glace : −2. 30 secondes.
import { h } from '../dom.js';
import type { GameOpts } from './index.js';

type Kind = 'shield' | 'dummy' | 'lantern' | 'gold' | 'ice';
interface Target { x: number; y: number; bx: number; by: number; r: number; kind: Kind; age: number; life: number; hit: boolean; out: number; mx: number; my: number; ph: number }
interface Ball { x: number; y: number; tx: number; ty: number; vx: number; vy: number; dist: number; done: boolean }
interface Part { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; color: string; glow: boolean; g: number }
interface Pop { x: number; y: number; t: number; text: string; color: string }

const DURATION = 30;
const DRAGON_W = 140;
const BALL_SPEED = 950;
const POINTS: Record<Kind, number> = { shield: 1, dummy: 1, lantern: 1, gold: 3, ice: -2 };

export function playFireTargets(dragonName: string, opts: GameOpts): Promise<number> {
  return new Promise(resolve => {
    const canvas = h('canvas', { class: 'game-canvas' });
    const scoreEl = h('div', { class: 'game-score' }, '0');
    const timeEl = h('div', { class: 'game-time' }, String(DURATION));
    const intro = h('div', { class: 'game-intro' },
      h('h2', null, 'Tir de feu'),
      h('p', null, `Touche une cible : ${dragonName} crache une boule de feu dessus ! Boucliers, mannequins et lanternes rapportent 1 point, les cibles dorées 3 points.`),
      h('p', { class: 'game-rules' }, 'Attention : ne touche pas les cristaux de glace bleus (−2).'),
      h('button', { class: 'btn primary', onclick: () => { intro.remove(); start(); } }, 'C’est parti !'));
    const root = h('div', { class: 'game game-arena' }, canvas, h('div', { class: 'game-hud' }, scoreEl, timeEl), intro);
    document.body.append(root);

    const img = new Image();
    let imgOk = false;
    img.onload = () => { imgOk = img.naturalWidth > 0; };
    img.src = opts.stand;

    const ctx = canvas.getContext('2d')!;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    let W = 0, H = 0, groundY = 0;
    let bg: HTMLCanvasElement | null = null;

    const resize = () => {
      W = root.clientWidth; H = root.clientHeight; groundY = H - 70;
      canvas.width = W * dpr; canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      bg = document.createElement('canvas');
      bg.width = W * dpr; bg.height = H * dpr;
      const g = bg.getContext('2d')!;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      const sky = g.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, '#0f0b18'); sky.addColorStop(0.5, '#2b1a2c'); sky.addColorStop(0.78, '#5a2a22'); sky.addColorStop(1, '#1a100e');
      g.fillStyle = sky; g.fillRect(0, 0, W, H);
      // étoiles
      for (let i = 0; i < 70; i++) {
        g.globalAlpha = 0.2 + Math.random() * 0.6; g.fillStyle = '#f5e8d0';
        const s = Math.random() < 0.15 ? 2 : 1;
        g.fillRect(Math.random() * W, Math.random() * H * 0.5, s, s);
      }
      g.globalAlpha = 1;
      // lune voilée
      const moon = g.createRadialGradient(W * 0.78, H * 0.16, 4, W * 0.78, H * 0.16, 70);
      moon.addColorStop(0, 'rgba(255,230,190,0.9)'); moon.addColorStop(0.35, 'rgba(255,200,140,0.35)'); moon.addColorStop(1, 'rgba(255,200,140,0)');
      g.fillStyle = moon; g.fillRect(W * 0.78 - 70, H * 0.16 - 70, 140, 140);
      // montagnes lointaines (2 plans)
      const ridge = (base: number, amp: number, color: string, seed: number) => {
        g.beginPath(); g.moveTo(0, H);
        for (let x = 0; x <= W + 20; x += 20) {
          const y = base - Math.abs(Math.sin(x * 0.012 + seed)) * amp - Math.sin(x * 0.041 + seed * 2) * amp * 0.25;
          g.lineTo(x, y);
        }
        g.lineTo(W, H); g.closePath(); g.fillStyle = color; g.fill();
      };
      ridge(H * 0.72, H * 0.16, '#26161f', 1.3);
      ridge(H * 0.8, H * 0.1, '#1a1015', 4.1);
      // sol rocheux
      const ground = g.createLinearGradient(0, groundY - 10, 0, H);
      ground.addColorStop(0, '#3a241c'); ground.addColorStop(1, '#120b0a');
      g.fillStyle = ground;
      g.beginPath(); g.moveTo(0, H);
      for (let x = 0; x <= W + 30; x += 30) g.lineTo(x, groundY + Math.sin(x * 0.05) * 6 + (x % 90 === 0 ? -4 : 0));
      g.lineTo(W, H); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(255,150,80,0.35)'; g.lineWidth = 1.5; g.stroke();
    };
    resize();

    const targets: Target[] = [];
    const balls: Ball[] = [];
    const parts: Part[] = [];
    const pops: Pop[] = [];
    let score = 0, t = 0, spawn = 0.3, last = 0, raf = 0, running = false, over = false;
    let recoil = 0, mouthFlash = 0;

    const dragonBox = () => {
      const hgt = imgOk ? DRAGON_W * img.naturalHeight / img.naturalWidth : 115;
      const x = 6, y = groundY + 18 - hgt;
      return { x, y, w: DRAGON_W, h: hgt };
    };
    const mouth = () => { const b = dragonBox(); return { x: b.x + b.w * 0.95 - recoil * 6, y: b.y + b.h * 0.37 }; };

    const add = () => {
      const k = Math.min(1, t / DURATION);
      const roll = Math.random();
      const kind: Kind = roll < 0.1 ? 'gold' : roll < 0.1 + 0.12 + k * 0.1 ? 'ice' : roll < 0.55 ? 'shield' : roll < 0.78 ? 'dummy' : 'lantern';
      const r = kind === 'gold' ? 24 : kind === 'ice' ? 26 : kind === 'dummy' ? 30 : 30;
      const minX = W / 3 + r, maxX = W - r - 6;
      const minY = 110 + r, maxY = (kind === 'dummy' ? groundY - r - 8 : groundY - r - 40);
      let x = 0, y = 0;
      for (let tries = 0; tries < 12; tries++) {
        x = minX + Math.random() * Math.max(1, maxX - minX);
        y = kind === 'dummy' ? groundY - 46 - Math.random() * 10 : minY + Math.random() * Math.max(1, maxY - minY);
        if (!targets.some(o => Math.hypot(o.bx - x, o.by - y) < o.r + r + 16)) break;
      }
      const moving = kind !== 'dummy' && Math.random() < 0.25 + k * 0.5;
      targets.push({
        x, y, bx: x, by: y, r, kind, age: 0, hit: false, out: 0, ph: Math.random() * 6,
        life: Math.max(1.6, 2.8 - k * 1.2) + (kind === 'gold' ? -0.4 : 0),
        mx: moving ? (20 + Math.random() * 40) * (1 + k) : 0,
        my: kind === 'lantern' ? 10 : moving ? Math.random() * 20 : 0
      });
    };

    const burst = (x: number, y: number, n: number, colors: string[], spd: number, glow: boolean, g = 260) => {
      for (let i = 0; i < n && parts.length < 450; i++) {
        const a = Math.random() * Math.PI * 2, s = spd * (0.25 + Math.random());
        parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - spd * 0.2, life: 0, max: 0.35 + Math.random() * 0.5, size: 2 + Math.random() * 4, color: colors[i % colors.length], glow, g });
      }
    };

    const shoot = (e: PointerEvent) => {
      e.preventDefault();
      if (!running) return;
      const rect = canvas.getBoundingClientRect();
      const tx = e.clientX - rect.left, ty = e.clientY - rect.top;
      const m = mouth();
      const dx = tx - m.x, dy = ty - m.y, d = Math.hypot(dx, dy) || 1;
      balls.push({ x: m.x, y: m.y, tx, ty, vx: dx / d * BALL_SPEED, vy: dy / d * BALL_SPEED, dist: d, done: false });
      recoil = 1; mouthFlash = 0.12;
      if (navigator.vibrate) navigator.vibrate(8);
    };
    canvas.addEventListener('pointerdown', shoot);

    const hitTarget = (o: Target) => {
      o.hit = true; o.out = 0.001;
      const pts = POINTS[o.kind];
      score = Math.max(0, score + pts);
      pops.push({ x: o.x, y: o.y - o.r, t: 0, text: pts > 0 ? `+${pts}` : `${pts}`, color: pts > 0 ? (o.kind === 'gold' ? '#fff1a8' : '#ffd76a') : '#c8f0ff' });
      if (o.kind === 'ice') {
        burst(o.x, o.y, 22, ['#bfeaff', '#6fc3ff', '#ffffff'], 260, true, 380);
        if (navigator.vibrate) navigator.vibrate(70);
      } else {
        burst(o.x, o.y, 26, ['#ffcf5a', '#ff8a2a', '#ff5a1a', '#fff0b0'], 300, true);
        const chips = o.kind === 'dummy' ? ['#e2c26a', '#b8933e'] : o.kind === 'lantern' ? ['#ffb050', '#c0392b'] : o.kind === 'gold' ? ['#ffe58a', '#ffffff'] : ['#8a5a32', '#5a3a20'];
        burst(o.x, o.y, 12, chips, 220, false, 600);
        if (navigator.vibrate) navigator.vibrate(o.kind === 'gold' ? [15, 30, 15] : 14);
      }
    };

    // ---------- dessin des cibles ----------
    const drawShield = (o: Target, gold: boolean) => {
      const r = o.r;
      const rings = gold ? ['#fff1a8', '#d79a16', '#fff1a8', '#c0820e'] : ['#9a6436', '#6d4322', '#b07a46', '#c23b2a'];
      if (gold) {
        const halo = ctx.createRadialGradient(0, 0, r * 0.5, 0, 0, r * 2);
        halo.addColorStop(0, 'rgba(255,215,106,0.5)'); halo.addColorStop(1, 'rgba(255,215,106,0)');
        ctx.fillStyle = halo; ctx.fillRect(-r * 2, -r * 2, r * 4, r * 4);
      }
      ctx.fillStyle = gold ? '#8a5a10' : '#3b2414';
      ctx.beginPath(); ctx.arc(0, 0, r + 3, 0, Math.PI * 2); ctx.fill();
      for (let i = 0; i < 4; i++) { ctx.fillStyle = rings[i]; ctx.beginPath(); ctx.arc(0, 0, r * (1 - i * 0.24), 0, Math.PI * 2); ctx.fill(); }
      if (!gold) {
        ctx.strokeStyle = 'rgba(40,22,10,0.45)'; ctx.lineWidth = 1.2;
        for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(i * r * 0.35, -r * 0.95); ctx.lineTo(i * r * 0.35, r * 0.95); ctx.stroke(); }
        ctx.fillStyle = '#c8c2b4'; ctx.beginPath(); ctx.arc(0, 0, r * 0.16, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.fillStyle = '#ffffff'; ctx.globalAlpha *= 0.7;
        ctx.beginPath(); ctx.arc(-r * 0.35, -r * 0.35, r * 0.18, 0, Math.PI * 2); ctx.fill();
      }
      ctx.strokeStyle = gold ? '#fff6c8' : '#7a7468'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(0, 0, r + 2, 0, Math.PI * 2); ctx.stroke();
    };
    const drawDummy = (o: Target) => {
      const r = o.r;
      ctx.fillStyle = '#5a3a20'; ctx.fillRect(-3, 0, 6, groundY - o.y + 6);
      ctx.fillRect(-r * 0.9, r * 0.35, r * 1.8, 5);
      ctx.fillStyle = '#d8b65e';
      ctx.beginPath(); ctx.ellipse(0, r * 0.75, r * 0.55, r * 0.7, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#9a7a30'; ctx.lineWidth = 1.2;
      for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(i * 5, r * 0.15); ctx.lineTo(i * 6, r * 1.4); ctx.stroke(); }
      ctx.fillStyle = '#e6c878';
      ctx.beginPath(); ctx.arc(0, -r * 0.25, r * 0.5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#7a5a22'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-r * 0.5, -r * 0.05); ctx.lineTo(r * 0.5, -r * 0.05); ctx.stroke();
      ctx.fillStyle = '#c0392b'; ctx.beginPath(); ctx.arc(0, -r * 0.3, r * 0.14, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#e6c878';
      for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(i * 4, -r * 0.7); ctx.lineTo(i * 7, -r * 1.05); ctx.lineTo(i * 4 + 3, -r * 0.7); ctx.fill(); }
    };
    const drawLantern = (o: Target, now: number) => {
      const r = o.r;
      const fl = 0.85 + 0.15 * Math.sin(now / 90 + o.ph);
      const halo = ctx.createRadialGradient(0, 0, r * 0.3, 0, 0, r * 2.2);
      halo.addColorStop(0, `rgba(255,170,70,${0.45 * fl})`); halo.addColorStop(1, 'rgba(255,170,70,0)');
      ctx.fillStyle = halo; ctx.fillRect(-r * 2.2, -r * 2.2, r * 4.4, r * 4.4);
      const body = ctx.createLinearGradient(-r, 0, r, 0);
      body.addColorStop(0, '#8a1f14'); body.addColorStop(0.5, `rgb(255,${Math.round(150 * fl)},60)`); body.addColorStop(1, '#8a1f14');
      ctx.fillStyle = body;
      ctx.beginPath(); ctx.ellipse(0, 0, r * 0.75, r * 0.95, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(90,20,10,0.6)'; ctx.lineWidth = 1.3;
      for (const k of [-0.4, 0, 0.4]) { ctx.beginPath(); ctx.ellipse(0, 0, r * 0.75 * Math.abs(k || 0.02), r * 0.95, 0, 0, Math.PI * 2); ctx.stroke(); }
      ctx.fillStyle = '#2a1a12';
      ctx.fillRect(-r * 0.4, -r * 1.05, r * 0.8, 6); ctx.fillRect(-r * 0.4, r * 0.92, r * 0.8, 6);
      ctx.strokeStyle = '#2a1a12'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(0, -r * 1.05); ctx.lineTo(0, -r * 1.5); ctx.stroke();
      ctx.fillStyle = '#d9a84a'; ctx.fillRect(-1, r * 1.0, 2, r * 0.45);
    };
    const drawIce = (o: Target, now: number) => {
      const r = o.r;
      const halo = ctx.createRadialGradient(0, 0, r * 0.3, 0, 0, r * 1.9);
      halo.addColorStop(0, 'rgba(120,200,255,0.4)'); halo.addColorStop(1, 'rgba(120,200,255,0)');
      ctx.fillStyle = halo; ctx.fillRect(-r * 2, -r * 2, r * 4, r * 4);
      ctx.rotate(Math.sin(now / 600 + o.ph) * 0.15);
      ctx.scale(1.35, 1.35);
      const shards: Array<[number, number, number]> = [[0, 1, 0.34], [-0.55, 0.7, 0.24], [0.55, 0.72, 0.24], [-0.25, 0.5, 0.18], [0.3, 0.55, 0.2]];
      for (const [ang, len, wd] of shards) {
        ctx.save(); ctx.rotate(ang);
        const g = ctx.createLinearGradient(-r * wd, 0, r * wd, 0);
        g.addColorStop(0, '#2f7fd0'); g.addColorStop(0.45, '#bff0ff'); g.addColorStop(1, '#3d8fe0');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.moveTo(-r * wd, r * 0.5); ctx.lineTo(-r * wd, -r * len * 0.6); ctx.lineTo(0, -r * len * 1.05); ctx.lineTo(r * wd, -r * len * 0.6); ctx.lineTo(r * wd, r * 0.5); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(230,250,255,0.8)'; ctx.lineWidth = 1; ctx.stroke();
        ctx.restore();
      }
      ctx.fillStyle = '#d8f4ff'; ctx.globalAlpha *= 0.8;
      ctx.beginPath(); ctx.arc(0, r * 0.45, r * 0.3, Math.PI, 0); ctx.fill();
    };

    const drawTarget = (o: Target, now: number) => {
      const appear = Math.min(1, o.age / 0.18);
      const leave = o.hit ? Math.max(0, 1 - o.out * 4) : Math.min(1, Math.max(0, (o.life - o.age) / 0.25));
      const s = (o.hit ? 1 + o.out * 2 : 1) * (appear < 1 ? 0.4 + 0.6 * appear : 1);
      const a = Math.min(appear, leave);
      if (a <= 0) return;
      ctx.save();
      ctx.translate(o.x, o.y); ctx.scale(s, s); ctx.globalAlpha = a;
      // ombre portée au sol
      if (o.kind === 'dummy') {
        ctx.save(); ctx.globalAlpha = a * 0.35; ctx.fillStyle = '#000';
        ctx.beginPath(); ctx.ellipse(0, groundY - o.y + 6, o.r * 0.8, 5, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      }
      if (o.kind === 'shield' || o.kind === 'gold') drawShield(o, o.kind === 'gold');
      else if (o.kind === 'dummy') drawDummy(o);
      else if (o.kind === 'lantern') drawLantern(o, now);
      else drawIce(o, now);
      ctx.restore();
    };

    const drawDragon = () => {
      const b = dragonBox();
      ctx.save();
      // halo chaud derrière le dragon
      const halo = ctx.createRadialGradient(b.x + b.w * 0.55, b.y + b.h * 0.5, 10, b.x + b.w * 0.55, b.y + b.h * 0.5, b.w * 0.9);
      halo.addColorStop(0, 'rgba(255,150,70,0.25)'); halo.addColorStop(1, 'rgba(255,150,70,0)');
      ctx.fillStyle = halo; ctx.fillRect(b.x - 40, b.y - 60, b.w + 120, b.h + 120);
      ctx.translate(-recoil * 6, 0);
      if (imgOk) ctx.drawImage(img, b.x, b.y, b.w, b.h);
      else {
        ctx.fillStyle = '#2a2026'; ctx.strokeStyle = '#d9a84a'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.ellipse(b.x + 60, b.y + 70, 45, 26, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(b.x + 90, b.y + 55); ctx.lineTo(b.x + 120, b.y + 25); ctx.lineTo(b.x + 138, b.y + 40); ctx.lineTo(b.x + 105, b.y + 70); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(b.x + 50, b.y + 50); ctx.lineTo(b.x + 20, b.y); ctx.lineTo(b.x + 80, b.y + 45); ctx.closePath(); ctx.fill(); ctx.stroke();
      }
      ctx.restore();
      if (mouthFlash > 0) {
        const m = mouth();
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const f = ctx.createRadialGradient(m.x, m.y, 2, m.x, m.y, 30);
        f.addColorStop(0, `rgba(255,220,120,${mouthFlash * 7})`); f.addColorStop(1, 'rgba(255,120,40,0)');
        ctx.fillStyle = f; ctx.fillRect(m.x - 30, m.y - 30, 60, 60);
        ctx.restore();
      }
    };

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
      last = now;
      if (running) {
        t += dt; spawn -= dt;
        const k = Math.min(1, t / DURATION);
        const maxT = 3 + Math.floor(k * 3.5);
        if (spawn <= 0 && targets.filter(o => !o.hit).length < maxT) { add(); spawn = Math.max(0.42, 0.95 - k * 0.55) * (0.7 + Math.random() * 0.6); }
        if (t >= DURATION) end();
      }
      if (recoil > 0) recoil = Math.max(0, recoil - dt * 6);
      if (mouthFlash > 0) mouthFlash -= dt;

      for (const o of targets) {
        o.age += dt;
        if (o.hit) { o.out += dt; continue; }
        o.x = o.bx + Math.sin(o.age * 1.6 + o.ph) * o.mx;
        o.y = o.by + Math.sin(o.age * 2.3 + o.ph) * o.my;
        if (!running && !over) o.age = Math.min(o.age, o.life - 0.3);
      }
      for (let i = targets.length - 1; i >= 0; i--) {
        const o = targets[i];
        if ((o.hit && o.out > 0.3) || (!o.hit && o.age > o.life)) targets.splice(i, 1);
      }

      for (const b of balls) {
        const step = BALL_SPEED * dt;
        const nx = b.x + b.vx * dt, ny = b.y + b.vy * dt;
        // collision le long du segment parcouru
        if (running) {
          for (const o of targets) {
            if (o.hit || o.age < 0.08) continue;
            const ex = nx - b.x, ey = ny - b.y, len2 = ex * ex + ey * ey || 1;
            const u = Math.max(0, Math.min(1, ((o.x - b.x) * ex + (o.y - b.y) * ey) / len2));
            const cx = b.x + ex * u, cy = b.y + ey * u;
            if (Math.hypot(o.x - cx, o.y - cy) < o.r + 10) { hitTarget(o); b.done = true; break; }
          }
        }
        b.x = nx; b.y = ny; b.dist -= step;
        for (let i = 0; i < 3 && parts.length < 450; i++) {
          parts.push({ x: b.x - b.vx * dt * i / 3 + (Math.random() - 0.5) * 6, y: b.y - b.vy * dt * i / 3 + (Math.random() - 0.5) * 6, vx: (Math.random() - 0.5) * 40, vy: -20 - Math.random() * 40, life: 0, max: 0.25 + Math.random() * 0.25, size: 4 + Math.random() * 6, color: Math.random() < 0.5 ? '#ff8a2a' : '#ffcf5a', glow: true, g: -40 });
        }
        if (!b.done && b.dist <= 0) { b.done = true; burst(b.tx, b.ty, 10, ['#ff8a2a', '#ffcf5a', '#7a5a50'], 140, true); }
      }
      for (let i = balls.length - 1; i >= 0; i--) if (balls[i].done) balls.splice(i, 1);

      // --- dessin ---
      if (bg) ctx.drawImage(bg, 0, 0, W, H);
      for (const o of targets) if (o.kind === 'dummy') drawTarget(o, now);
      for (const o of targets) if (o.kind !== 'dummy') drawTarget(o, now);
      drawDragon();
      ctx.globalCompositeOperation = 'lighter';
      for (const p of parts) {
        p.life += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.g * dt;
        const k = Math.max(0, 1 - p.life / p.max);
        ctx.globalAlpha = k;
        ctx.fillStyle = p.color;
        const s = p.glow ? p.size * (0.4 + k * 0.6) : p.size * 0.7;
        if (p.glow) { ctx.beginPath(); ctx.arc(p.x, p.y, s / 2, 0, Math.PI * 2); ctx.fill(); }
        else ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
      }
      ctx.globalAlpha = 1;
      for (const b of balls) {
        const g = ctx.createRadialGradient(b.x, b.y, 1, b.x, b.y, 18);
        g.addColorStop(0, '#fffbe0'); g.addColorStop(0.35, '#ffcf5a'); g.addColorStop(0.7, 'rgba(255,110,30,0.6)'); g.addColorStop(1, 'rgba(255,80,20,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(b.x, b.y, 18, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
      for (let i = parts.length - 1; i >= 0; i--) if (parts[i].life > parts[i].max) parts.splice(i, 1);
      ctx.font = 'bold 24px system-ui, sans-serif'; ctx.textAlign = 'center';
      for (const p of pops) { p.t += dt; ctx.globalAlpha = Math.max(0, 1 - p.t); ctx.fillStyle = p.color; ctx.fillText(p.text, p.x, p.y - p.t * 40); }
      ctx.globalAlpha = 1;
      for (let i = pops.length - 1; i >= 0; i--) if (pops[i].t > 1) pops.splice(i, 1);

      scoreEl.textContent = String(score);
      timeEl.textContent = String(Math.max(0, Math.ceil(DURATION - t)));
    };
    raf = requestAnimationFrame(frame);

    function start(): void { running = true; t = 0; }
    function end(): void {
      if (over) return;
      running = false; over = true;
      const box = h('div', { class: 'game-intro game-end' },
        h('h2', null, `Score : ${score}`),
        h('p', null, score >= 30 ? `${dragonName} est un maître du feu !` : score >= 15 ? `Joli tir, ${dragonName} chauffe de plus en plus.` : `${dragonName} a adoré cracher du feu avec toi.`),
        h('button', { class: 'btn primary', onclick: finish }, 'Continuer'));
      root.append(box);
    }
    function finish(): void {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      root.remove();
      resolve(score);
    }
    window.addEventListener('resize', resize);
  });
}

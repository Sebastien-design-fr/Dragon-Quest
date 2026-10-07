// Mini-jeu « Course dans les nuages » : le dragon vole dans une grotte, on touche l’écran pour battre des ailes.
// Chaque paire de rochers franchie rapporte 1 point, chaque gemme attrapée 2 points. 3 cœurs, 40 secondes.
import { h } from '../dom.js';
import type { GameOpts } from './index.js';

interface Rock { x: number; w: number; gapY: number; gap: number; top: number[]; bot: number[]; passed: boolean; gem: { y: number; taken: number; phase: number } | null }
interface Spark { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number }
interface Pop { x: number; y: number; t: number; text: string; color: string }

const DURATION = 40;
const GRAVITY = 1350;
const FLAP = -430;
const DRAGON_W = 110;

function loadImg(src: string): { img: HTMLImageElement; ok: () => boolean } {
  const img = new Image();
  let ok = false;
  img.onload = () => { ok = img.naturalWidth > 0; };
  img.src = src;
  return { img, ok: () => ok };
}

export function playFlightRace(dragonName: string, opts: GameOpts): Promise<number> {
  return new Promise(resolve => {
    const canvas = h('canvas', { class: 'game-canvas' });
    const scoreEl = h('div', { class: 'game-score' }, '0');
    const timeEl = h('div', { class: 'game-time' }, String(DURATION));
    const heartEls = [0, 1, 2].map(() => h('span', { class: 'game-heart' }, '♥'));
    const heartsEl = h('div', { class: 'game-hearts' }, heartEls);
    const intro = h('div', { class: 'game-intro' },
      h('h2', null, 'Course dans les nuages'),
      h('p', null, `Touche l’écran pour que ${dragonName} batte des ailes et prenne de la hauteur. Passe entre les rochers de la grotte sans les toucher !`),
      h('p', { class: 'game-rules' }, 'Rocher franchi : +1 · Gemme : +2 · 3 cœurs · 40 s'),
      h('button', { class: 'btn primary', onclick: () => { intro.remove(); start(); } }, 'C’est parti !'));
    const root = h('div', { class: 'game game-cave' }, canvas, h('div', { class: 'game-hud' }, scoreEl, heartsEl, timeEl), intro);
    document.body.append(root);

    const up = loadImg(opts.flyUp);
    const down = loadImg(opts.flyDown);

    const ctx = canvas.getContext('2d')!;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    let W = 0, H = 0;
    // Fond pré-rendu (dégradé + lueur) et deux couches de silhouettes rocheuses en boucle.
    let bg: HTMLCanvasElement | null = null;
    let layers: Array<{ tile: HTMLCanvasElement; speed: number; tw: number }> = [];

    const buildLayer = (tw: number, color: string, tipColor: string, rim: string, amp: number, base: number, spikes: number): HTMLCanvasElement => {
      const c = document.createElement('canvas');
      c.width = Math.ceil(tw * dpr); c.height = Math.ceil(H * dpr);
      const g = c.getContext('2d')!;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      const step = 6, n = Math.ceil(tw / step);
      for (const side of [0, 1]) {
        // profil : paroi ondulée + stalactites effilées (bouclage sur la largeur de la tuile)
        const prof: number[] = [];
        const ph1 = Math.random() * 6, ph2 = Math.random() * 6;
        for (let i = 0; i <= n; i++) {
          const u = (i / n) * Math.PI * 2;
          prof.push(base + Math.sin(u * 3 + ph1) * amp * 0.12 + Math.sin(u * 7 + ph2) * amp * 0.06);
        }
        for (let k = 0; k < spikes; k++) {
          const cx = Math.random() * tw, w = 18 + Math.random() * 46, L = amp * (0.35 + Math.random() * 0.9);
          for (let i = 0; i <= n; i++) {
            let d = Math.abs(i * step - cx); d = Math.min(d, tw - d);
            if (d < w / 2) prof[i] += L * Math.pow(1 - d / (w / 2), 1.8);
          }
        }
        prof[n] = prof[0];
        g.beginPath();
        g.moveTo(0, side ? H : 0);
        for (let i = 0; i <= n; i++) g.lineTo(i * step, side ? H - prof[i] : prof[i]);
        g.lineTo(tw, side ? H : 0);
        g.closePath();
        const grd = side ? g.createLinearGradient(0, H, 0, H - base - amp) : g.createLinearGradient(0, 0, 0, base + amp);
        grd.addColorStop(0, color); grd.addColorStop(0.55, color); grd.addColorStop(1, tipColor);
        g.fillStyle = grd; g.fill();
        g.strokeStyle = rim; g.lineWidth = 1; g.stroke();
      }
      return c;
    };

    const resize = () => {
      W = root.clientWidth; H = root.clientHeight;
      canvas.width = W * dpr; canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      bg = document.createElement('canvas');
      bg.width = W * dpr; bg.height = H * dpr;
      const g = bg.getContext('2d')!;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      const grd = g.createLinearGradient(0, 0, 0, H);
      grd.addColorStop(0, '#120d16'); grd.addColorStop(0.45, '#2a1a22'); grd.addColorStop(0.6, '#3a2219'); grd.addColorStop(1, '#0d0a0c');
      g.fillStyle = grd; g.fillRect(0, 0, W, H);
      const glow = g.createRadialGradient(W * 0.75, H * 0.55, 10, W * 0.75, H * 0.55, Math.max(W, H) * 0.6);
      glow.addColorStop(0, 'rgba(255,140,60,0.28)'); glow.addColorStop(1, 'rgba(255,140,60,0)');
      g.fillStyle = glow; g.fillRect(0, 0, W, H);
      const tw = Math.max(W, 400) * 1.5;
      layers = [
        { tile: buildLayer(tw, '#1e141a', '#3a2426', 'rgba(255,150,90,0.10)', H * 0.16, H * 0.05, 16), speed: 0.18, tw },
        { tile: buildLayer(tw, '#110b0e', '#2a1a18', 'rgba(255,140,70,0.22)', H * 0.1, H * 0.015, 11), speed: 0.4, tw }
      ];
    };
    resize();

    const rocks: Rock[] = [];
    const sparks: Spark[] = [];
    const pops: Pop[] = [];
    const embers = Array.from({ length: 26 }, () => ({ x: Math.random() * W, y: Math.random() * H, s: 0.5 + Math.random() * 1.8, v: 10 + Math.random() * 30, p: Math.random() * 6 }));
    let score = 0, t = 0, spawn = 0.6, last = 0, raf = 0, running = false, over = false;
    let hearts = 3, inv = 0, flapT = 0, scroll = 0, shake = 0;
    const dragon = { x: 0, y: 0, vy: 0 };
    dragon.x = Math.max(70, W * 0.24); dragon.y = H * 0.45;

    const speed = () => 165 + Math.min(1, t / DURATION) * 140;

    const makeEdge = (len: number): number[] => {
      // Profil irrégulier : demi-largeur relative (0..1) le long de la roche.
      const pts: number[] = [];
      const n = Math.max(4, Math.round(len / 34));
      for (let i = 0; i <= n; i++) pts.push(0.82 + Math.random() * 0.3);
      return pts;
    };

    const addRock = () => {
      const k = Math.min(1, t / DURATION);
      const gap = Math.max(178, 270 - k * 95) + (H > 700 ? 0 : -10);
      const margin = 70;
      const prev = rocks.length ? rocks[rocks.length - 1].gapY : H / 2;
      const maxJump = 140 + k * 140;
      let gapY = margin + gap / 2 + Math.random() * (H - 2 * margin - gap);
      gapY = Math.max(prev - maxJump, Math.min(prev + maxJump, gapY));
      gapY = Math.max(margin + gap / 2, Math.min(H - margin - gap / 2, gapY));
      const w = 62 + Math.random() * 22;
      const topLen = gapY - gap / 2, botLen = H - (gapY + gap / 2);
      rocks.push({
        x: W + w, w, gapY, gap, top: makeEdge(topLen), bot: makeEdge(botLen), passed: false,
        gem: Math.random() < 0.6 ? { y: gapY + (Math.random() - 0.5) * gap * 0.3, taken: 0, phase: Math.random() * 6 } : null
      });
    };

    // Demi-largeur de la roche à une distance d (0 = base, len = pointe).
    const halfAt = (r: Rock, edge: number[], len: number, d: number): number => {
      const f = Math.max(0, Math.min(1, d / Math.max(1, len)));
      const i = Math.min(edge.length - 1, Math.floor(f * (edge.length - 1)));
      const taper = 1 - f * 0.86;
      return (r.w / 2) * taper * edge[i];
    };

    const burst = (x: number, y: number, color: string, n: number, spd: number) => {
      for (let i = 0; i < n && sparks.length < 300; i++) {
        const a = Math.random() * Math.PI * 2, s = spd * (0.3 + Math.random());
        sparks.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0, max: 0.4 + Math.random() * 0.4, color, size: 1.5 + Math.random() * 2.5 });
      }
    };

    const flap = (e: PointerEvent) => {
      e.preventDefault();
      if (!running) return;
      dragon.vy = FLAP;
      flapT = 0.15;
      burst(dragon.x - 30, dragon.y + 10, 'rgba(255,220,180,0.7)', 4, 60);
      if (navigator.vibrate) navigator.vibrate(6);
    };
    canvas.addEventListener('pointerdown', flap);

    const hurt = () => {
      if (inv > 0 || !running) return;
      hearts--; inv = 2; shake = 0.3;
      heartEls.forEach((el, i) => el.classList.toggle('lost', i >= hearts));
      burst(dragon.x, dragon.y, '#ffb070', 18, 220);
      pops.push({ x: dragon.x, y: dragon.y - 40, t: 0, text: '-1 ♥', color: '#ff6b5a' });
      if (navigator.vibrate) navigator.vibrate([70, 40, 70]);
      if (hearts <= 0) end();
    };

    const drawRockPiece = (r: Rock, edge: number[], len: number, fromTop: boolean) => {
      if (len <= 4) return;
      const n = edge.length - 1;
      const dir = fromTop ? 1 : -1;
      const base = fromTop ? -10 : H + 10;
      const left: Array<[number, number]> = [], right: Array<[number, number]> = [];
      for (let i = 0; i <= n; i++) {
        const d = (i / n) * (len + 10);
        const hw = halfAt(r, edge, len + 10, d);
        const y = base + dir * d;
        left.push([r.x - hw - (i % 2 ? 3 : 0), y]);
        right.push([r.x + hw + (i % 3 === 1 ? 4 : 0), y]);
      }
      ctx.beginPath();
      ctx.moveTo(left[0][0], left[0][1]);
      for (let i = 1; i <= n; i++) ctx.lineTo(left[i][0], left[i][1]);
      const tipY = base + dir * (len + 10);
      ctx.quadraticCurveTo(r.x, tipY + dir * 8, right[n][0], right[n][1]);
      for (let i = n - 1; i >= 0; i--) ctx.lineTo(right[i][0], right[i][1]);
      ctx.closePath();
      const grd = ctx.createLinearGradient(r.x - r.w / 2, 0, r.x + r.w / 2, 0);
      grd.addColorStop(0, '#2b2026'); grd.addColorStop(0.35, '#241b21'); grd.addColorStop(0.75, '#3a2620'); grd.addColorStop(0.92, '#8a4a24'); grd.addColorStop(1, '#d98a3c');
      ctx.fillStyle = grd; ctx.fill();
      // liseré chaud côté lumière (droite) + strates
      ctx.save();
      ctx.clip();
      ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 2;
      for (let i = 1; i < n; i += 1) {
        const y = base + dir * (i / n) * len;
        const hw = halfAt(r, edge, len + 10, (i / n) * len);
        ctx.beginPath(); ctx.moveTo(r.x - hw, y); ctx.lineTo(r.x + hw * 0.6, y + dir * 6); ctx.stroke();
      }
      ctx.restore();
      ctx.strokeStyle = 'rgba(255,170,90,0.55)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(right[0][0], right[0][1]);
      for (let i = 1; i <= n; i++) ctx.lineTo(right[i][0], right[i][1]);
      ctx.stroke();
    };

    const drawGem = (x: number, y: number, s: number, alpha: number) => {
      ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x, y);
      const halo = ctx.createRadialGradient(0, 0, 2, 0, 0, s * 2.2);
      halo.addColorStop(0, 'rgba(120,220,255,0.55)'); halo.addColorStop(1, 'rgba(120,220,255,0)');
      ctx.fillStyle = halo; ctx.fillRect(-s * 2.2, -s * 2.2, s * 4.4, s * 4.4);
      const g = ctx.createLinearGradient(-s, -s, s, s);
      g.addColorStop(0, '#c8f3ff'); g.addColorStop(1, '#1b7fc4');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(s * 0.8, -s * 0.2); ctx.lineTo(0, s); ctx.lineTo(-s * 0.8, -s * 0.2); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(s * 0.35, -s * 0.2); ctx.lineTo(0, -s * 0.05); ctx.lineTo(-s * 0.35, -s * 0.2); ctx.fill();
      ctx.restore();
    };

    const drawDragon = () => {
      const tilt = Math.max(-0.45, Math.min(0.55, dragon.vy / 900));
      ctx.save();
      ctx.translate(dragon.x, dragon.y);
      ctx.rotate(tilt);
      if (inv > 0 && Math.floor(inv * 12) % 2 === 0) ctx.globalAlpha = 0.3;
      // halo chaud pour détacher le dragon sombre du fond
      const halo = ctx.createRadialGradient(0, 0, 10, 0, 0, 80);
      halo.addColorStop(0, 'rgba(255,170,90,0.28)'); halo.addColorStop(1, 'rgba(255,170,90,0)');
      ctx.fillStyle = halo; ctx.fillRect(-80, -80, 160, 160);
      const src = flapT > 0 ? down : up;
      const alt = flapT > 0 ? up : down;
      const pick = src.ok() ? src.img : alt.ok() ? alt.img : null;
      if (pick) {
        const hgt = DRAGON_W * pick.naturalHeight / pick.naturalWidth;
        ctx.drawImage(pick, -DRAGON_W / 2, -hgt / 2, DRAGON_W, hgt);
      } else {
        // silhouette de secours
        ctx.fillStyle = '#2a2026'; ctx.strokeStyle = '#d9a84a'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.ellipse(0, 4, 30, 13, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(26, -2); ctx.lineTo(50, -10); ctx.lineTo(54, -2); ctx.lineTo(30, 8); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-28, 4); ctx.quadraticCurveTo(-48, 10, -56, -2); ctx.lineTo(-30, 10); ctx.fill(); ctx.stroke();
        const wy = flapT > 0 ? 30 : -34;
        ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(-24, wy); ctx.lineTo(4, wy * 0.7); ctx.lineTo(14, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
      }
      ctx.restore();
    };

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
      last = now;
      const v = running ? speed() : 60;
      scroll += v * dt;
      if (running) {
        t += dt; spawn -= dt;
        if (spawn <= 0) { addRock(); spawn = Math.max(1.15, 1.85 - t * 0.02); }
        if (t >= DURATION) end();
      }
      if (inv > 0) inv -= dt;
      if (flapT > 0) flapT -= dt;
      if (shake > 0) shake -= dt;

      // physique du dragon
      if (running) {
        dragon.vy = Math.min(700, dragon.vy + GRAVITY * dt);
        dragon.y += dragon.vy * dt;
        if (dragon.y < 24) { dragon.y = 24; dragon.vy = Math.max(0, dragon.vy); }
        if (dragon.y > H - 24) { dragon.y = H - 24; dragon.vy = FLAP * 0.75; flapT = 0.15; burst(dragon.x, H - 20, 'rgba(255,200,150,0.8)', 8, 120); if (navigator.vibrate) navigator.vibrate(20); }
      } else if (!over) {
        dragon.y = H * 0.45 + Math.sin(now / 300) * 10;
        if (Math.floor(now / 260) % 2 === 0) flapT = 0.02;
      }

      for (const r of rocks) {
        r.x -= v * dt;
        if (!running) continue;
        const topLen = r.gapY - r.gap / 2, botLen = H - (r.gapY + r.gap / 2);
        // collisions : corps + tête du dragon
        const probes: Array<[number, number, number]> = [[dragon.x - 6, dragon.y + 2, 17], [dragon.x + 34, dragon.y - 6, 10], [dragon.x - 36, dragon.y + 4, 8]];
        for (const [px, py, pr] of probes) {
          if (Math.abs(px - r.x) > r.w / 2 + pr) continue;
          if (py - pr < topLen + 10) {
            const hw = halfAt(r, r.top, topLen + 10, Math.max(0, Math.min(topLen + 10, py - pr + 10)));
            if (Math.abs(px - r.x) < hw + pr * 0.7) { hurt(); break; }
          }
          const fromBot = H + 10 - (py + pr);
          if (py + pr > H - botLen - 10) {
            const hw = halfAt(r, r.bot, botLen + 10, Math.max(0, Math.min(botLen + 10, fromBot)));
            if (Math.abs(px - r.x) < hw + pr * 0.7) { hurt(); break; }
          }
        }
        if (!r.passed && r.x + r.w / 2 < dragon.x - 30) {
          r.passed = true; score += 1;
          pops.push({ x: dragon.x, y: dragon.y - 50, t: 0, text: '+1', color: '#ffd76a' });
          if (navigator.vibrate) navigator.vibrate(10);
        }
        if (r.gem && !r.gem.taken) {
          const gy = r.gem.y + Math.sin(now / 250 + r.gem.phase) * 8;
          if (Math.hypot(r.x - (dragon.x + 10), gy - dragon.y) < 40) {
            r.gem.taken = 0.001; score += 2;
            burst(r.x, gy, '#9fe6ff', 16, 160);
            pops.push({ x: r.x, y: gy - 20, t: 0, text: '+2', color: '#9fe6ff' });
            if (navigator.vibrate) navigator.vibrate(15);
          }
        }
        if (r.gem && r.gem.taken) r.gem.taken += dt * 3;
      }
      for (let i = rocks.length - 1; i >= 0; i--) if (rocks[i].x + rocks[i].w < -20) rocks.splice(i, 1);

      // --- dessin ---
      ctx.save();
      if (shake > 0) ctx.translate((Math.random() - 0.5) * 10 * shake * 3, (Math.random() - 0.5) * 10 * shake * 3);
      if (bg) ctx.drawImage(bg, 0, 0, W, H);
      for (const L of layers) {
        const off = (scroll * L.speed) % L.tw;
        for (let x = -off; x < W; x += L.tw) ctx.drawImage(L.tile, x, 0, L.tw, H);
      }
      // braises qui flottent
      for (const e of embers) {
        e.x -= (v * 0.3 + e.v) * dt; e.y -= e.v * 0.4 * dt;
        if (e.x < -5) { e.x = W + 5; e.y = Math.random() * H; }
        if (e.y < -5) e.y = H + 5;
        ctx.globalAlpha = 0.4 + 0.4 * Math.sin(now / 400 + e.p);
        ctx.fillStyle = '#ffb066';
        ctx.fillRect(e.x, e.y, e.s, e.s);
      }
      ctx.globalAlpha = 1;
      for (const r of rocks) {
        const topLen = r.gapY - r.gap / 2, botLen = H - (r.gapY + r.gap / 2);
        drawRockPiece(r, r.top, topLen, true);
        drawRockPiece(r, r.bot, botLen, false);
        if (r.gem && r.gem.taken < 1) {
          const gy = r.gem.y + Math.sin(now / 250 + r.gem.phase) * 8;
          drawGem(r.x, gy - r.gem.taken * 30, 13 * (1 + r.gem.taken), 1 - r.gem.taken);
        }
      }
      drawDragon();
      ctx.globalCompositeOperation = 'lighter';
      for (const s of sparks) {
        s.life += dt; s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 200 * dt;
        ctx.globalAlpha = Math.max(0, 1 - s.life / s.max);
        ctx.fillStyle = s.color;
        ctx.fillRect(s.x - s.size / 2, s.y - s.size / 2, s.size, s.size);
      }
      ctx.globalCompositeOperation = 'source-over';
      for (let i = sparks.length - 1; i >= 0; i--) if (sparks[i].life > sparks[i].max) sparks.splice(i, 1);
      ctx.font = 'bold 22px system-ui, sans-serif'; ctx.textAlign = 'center';
      for (const p of pops) { p.t += dt; ctx.globalAlpha = Math.max(0, 1 - p.t); ctx.fillStyle = p.color; ctx.fillText(p.text, p.x, p.y - p.t * 40); }
      ctx.globalAlpha = 1;
      for (let i = pops.length - 1; i >= 0; i--) if (pops[i].t > 1) pops.splice(i, 1);
      ctx.restore();

      scoreEl.textContent = String(score);
      timeEl.textContent = String(Math.max(0, Math.ceil(DURATION - t)));
    };
    raf = requestAnimationFrame(frame);

    function start(): void { running = true; t = 0; dragon.vy = FLAP; flapT = 0.15; }
    function end(): void {
      if (over) return;
      running = false; over = true;
      const box = h('div', { class: 'game-intro game-end' },
        h('h2', null, `Score : ${score}`),
        h('p', null, hearts <= 0
          ? `Aïe ! ${dragonName} s’est cogné trop souvent, mais il a bien volé.`
          : score >= 25 ? `${dragonName} vole comme le vent !` : score >= 12 ? `Beau vol, ${dragonName} progresse.` : `${dragonName} a adoré voler avec toi.`),
        h('button', { class: 'btn primary', onclick: finish }, 'Continuer'));
      setTimeout(() => root.append(box), hearts <= 0 ? 600 : 0);
    }
    function finish(): void {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      root.remove();
      resolve(score);
    }
    const onResize = () => { resize(); dragon.x = Math.max(70, W * 0.24); };
    window.addEventListener('resize', onResize);
  });
}

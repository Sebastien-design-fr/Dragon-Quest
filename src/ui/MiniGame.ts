// Mini-jeu « Chasse aux gemmes » : des gemmes tombent, on les touche pour les attraper (30 secondes).
// Les gemmes dorées valent 3 points ; les pierres de lave font perdre 2 points.
import { h } from './dom.js';

interface Gem { x: number; y: number; vy: number; r: number; kind: 'blue' | 'red' | 'gold' | 'lava'; rot: number; vr: number; hit: number }

const DURATION = 30;
const COLORS: Record<Gem['kind'], [string, string]> = {
  blue: ['#7fb2ff', '#2856c9'], red: ['#ff8a8a', '#b31d32'], gold: ['#fff1a8', '#d79a16'], lava: ['#5a3a2e', '#1e1311']
};

export function playGemGame(dragonName: string): Promise<number> {
  return new Promise(resolve => {
    const canvas = h('canvas', { class: 'game-canvas' });
    const scoreEl = h('div', { class: 'game-score' }, '0');
    const timeEl = h('div', { class: 'game-time' }, String(DURATION));
    const intro = h('div', { class: 'game-intro' },
      h('h2', null, 'Chasse aux gemmes'),
      h('p', null, `Attrape les gemmes avec ${dragonName} ! Les dorées valent 3 points. Évite les pierres de lave.`),
      h('button', { class: 'btn primary', onclick: () => { intro.remove(); start(); } }, 'C’est parti !'));
    const root = h('div', { class: 'game' }, canvas, h('div', { class: 'game-hud' }, scoreEl, timeEl), intro);
    document.body.append(root);

    const ctx = canvas.getContext('2d')!;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    let W = 0, H = 0;
    const resize = () => { W = root.clientWidth; H = root.clientHeight; canvas.width = W * dpr; canvas.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
    resize();

    const gems: Gem[] = [];
    const pops: Array<{ x: number; y: number; t: number; text: string; color: string }> = [];
    let score = 0, t = 0, spawn = 0, last = 0, raf = 0, running = false;

    const add = () => {
      const roll = Math.random();
      const kind: Gem['kind'] = roll < 0.1 ? 'gold' : roll < 0.24 ? 'lava' : roll < 0.62 ? 'blue' : 'red';
      const r = kind === 'gold' ? 20 : 26;
      gems.push({ x: r + Math.random() * (W - 2 * r), y: -r, vy: 110 + t * 7 + Math.random() * 60, r, kind, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 3, hit: 0 });
    };

    const tap = (e: PointerEvent) => {
      if (!running) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left, y = e.clientY - rect.top;
      for (let i = gems.length - 1; i >= 0; i--) {
        const g = gems[i];
        if (g.hit || Math.hypot(g.x - x, g.y - y) > g.r + 14) continue;
        g.hit = 1;
        const pts = g.kind === 'gold' ? 3 : g.kind === 'lava' ? -2 : 1;
        score = Math.max(0, score + pts);
        pops.push({ x: g.x, y: g.y, t: 0, text: pts > 0 ? `+${pts}` : `${pts}`, color: pts > 0 ? '#ffd76a' : '#ff6b5a' });
        if (navigator.vibrate) navigator.vibrate(pts > 0 ? 12 : 60);
        break;
      }
    };
    canvas.addEventListener('pointerdown', tap);

    const drawGem = (g: Gem) => {
      ctx.save();
      ctx.translate(g.x, g.y); ctx.rotate(g.rot);
      const s = g.r * (g.hit ? 1 + g.hit : 1);
      ctx.globalAlpha = g.hit ? Math.max(0, 1 - g.hit * 2) : 1;
      const [c1, c2] = COLORS[g.kind];
      const grd = ctx.createLinearGradient(-s, -s, s, s);
      grd.addColorStop(0, c1); grd.addColorStop(1, c2);
      ctx.fillStyle = grd;
      ctx.beginPath();
      if (g.kind === 'lava') { for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2; const rr = s * (0.8 + 0.2 * Math.sin(i * 3)); ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } }
      else { ctx.moveTo(0, -s); ctx.lineTo(s * 0.8, -s * 0.2); ctx.lineTo(0, s); ctx.lineTo(-s * 0.8, -s * 0.2); }
      ctx.closePath(); ctx.fill();
      if (g.kind === 'lava') { ctx.strokeStyle = '#ff6a1a'; ctx.lineWidth = 2; ctx.stroke(); }
      else { ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(s * 0.35, -s * 0.2); ctx.lineTo(0, -s * 0.05); ctx.lineTo(-s * 0.35, -s * 0.2); ctx.fill(); }
      ctx.restore();
    };

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
      last = now;
      if (running) {
        t += dt; spawn -= dt;
        if (spawn <= 0) { add(); spawn = Math.max(0.28, 0.75 - t * 0.015); }
        if (t >= DURATION) end();
      }
      ctx.clearRect(0, 0, W, H);
      for (const g of gems) { g.y += g.vy * dt; g.rot += g.vr * dt; if (g.hit) g.hit += dt * 3; }
      for (let i = gems.length - 1; i >= 0; i--) if (gems[i].y - gems[i].r > H || gems[i].hit > 0.5) gems.splice(i, 1);
      gems.forEach(drawGem);
      ctx.font = 'bold 22px system-ui, sans-serif'; ctx.textAlign = 'center';
      for (const p of pops) { p.t += dt; ctx.globalAlpha = Math.max(0, 1 - p.t); ctx.fillStyle = p.color; ctx.fillText(p.text, p.x, p.y - p.t * 40); }
      ctx.globalAlpha = 1;
      for (let i = pops.length - 1; i >= 0; i--) if (pops[i].t > 1) pops.splice(i, 1);
      scoreEl.textContent = String(score);
      timeEl.textContent = String(Math.max(0, Math.ceil(DURATION - t)));
    };
    raf = requestAnimationFrame(frame);

    function start(): void { running = true; t = 0; }
    function end(): void {
      running = false;
      const box = h('div', { class: 'game-intro' },
        h('h2', null, `${score} point${score > 1 ? 's' : ''} !`),
        h('p', null, score >= 25 ? `${dragonName} est impressionné !` : score >= 12 ? `${dragonName} s’est bien amusé.` : `${dragonName} a adoré jouer avec toi.`),
        h('button', { class: 'btn primary', onclick: () => { cancelAnimationFrame(raf); root.remove(); resolve(score); } }, 'Retour au dragon'));
      root.append(box);
    }
    window.addEventListener('resize', resize, { once: true });
  });
}

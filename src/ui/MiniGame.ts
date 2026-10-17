// Mini-jeu « Chasse aux gemmes » : des gemmes tombent, on les touche pour les attraper (30 secondes).
// Les gemmes dorées valent 3 points ; les pierres de lave font perdre 2 points.
import { hasPower } from '../game/StagePowers.js';
import { h } from './dom.js';
import type { GameOpts } from './games/index.js';
import { Ambience, GRADES, Juice, loadImage, paintBackdrop, powerNote } from './games/Scenery.js';

interface Gem { x: number; y: number; vy: number; r: number; kind: 'blue' | 'red' | 'gold' | 'lava'; rot: number; vr: number; hit: number }

const DURATION = 30;
const COLORS: Record<Gem['kind'], [string, string]> = {
  blue: ['#7fb2ff', '#2856c9'], red: ['#ff8a8a', '#b31d32'], gold: ['#fff1a8', '#d79a16'], lava: ['#5a3a2e', '#1e1311']
};

function goldPtsFor(opts?: GameOpts): number { return opts?.stage && hasPower(opts.stage, 'aura') ? 6 : 3; }

export function playGemGame(dragonName: string, opts?: GameOpts): Promise<number> {
  return new Promise(resolve => {
    const canvas = h('canvas', { class: 'game-canvas' });
    const scoreEl = h('div', { class: 'game-score' }, '0');
    const timeEl = h('div', { class: 'game-time' }, String(DURATION));
    const intro = h('div', { class: 'game-intro' },
      h('h2', null, 'Chasse aux gemmes'),
      h('p', null, `Attrape les gemmes avec ${dragonName} ! Les dorées valent ${goldPtsFor(opts)} points. Évite les pierres de lave.`),
      powerNote(opts?.stage, 'gems'),
      h('button', { class: 'btn primary', onclick: () => { intro.remove(); start(); } }, 'C’est parti !'));
    const root = h('div', { class: 'game game-painted' }, canvas, h('div', { class: 'game-hud' }, scoreEl, timeEl), intro);
    document.body.append(root);

    const ctx = canvas.getContext('2d')!;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    let W = 0, H = 0;
    // Pouvoirs du stade : griffes plus larges (jeune dragon), or doublé (légendaire).
    const reach = opts?.stage && hasPower(opts.stage, 'agile') ? 30 : 14;
    const goldPts = goldPtsFor(opts);
    const backdrop = loadImage(opts?.backdrop);
    const ambience = new Ambience('dust', 40);
    const juice = new Juice();
    let bg: HTMLCanvasElement | null = null, bgPainted = false;
    const paintBg = () => {
      bg = document.createElement('canvas');
      bg.width = W * dpr; bg.height = H * dpr;
      const g = bg.getContext('2d')!;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      paintBackdrop(g, W, H, backdrop.ok() ? backdrop.img : null, GRADES.hoard, 0.6);
      bgPainted = backdrop.ok();
    };
    const resize = () => { W = root.clientWidth; H = root.clientHeight; canvas.width = W * dpr; canvas.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); paintBg(); };
    resize();

    const gems: Gem[] = [];
    const sparks: Array<{ x: number; y: number; vx: number; vy: number; life: number; color: string }> = [];
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
        if (g.hit || Math.hypot(g.x - x, g.y - y) > g.r + reach) continue;
        g.hit = 1;
        const pts = g.kind === 'gold' ? goldPts : g.kind === 'lava' ? -2 : 1;
        score = Math.max(0, score + pts);
        juice.pop(g.x, g.y, pts > 0 ? `+${pts}` : `${pts}`, pts > 0 ? (g.kind === 'gold' ? '#fff1a8' : '#ffd76a') : '#ff6b5a', g.kind === 'gold');
        const [c1, c2] = COLORS[g.kind];
        for (let k = 0; k < (g.kind === 'gold' ? 22 : 12); k++) {
          const a = Math.random() * Math.PI * 2, sp = 80 + Math.random() * 220;
          sparks.push({ x: g.x, y: g.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60, life: 0.5 + Math.random() * 0.4, color: k % 2 ? c1 : c2 });
        }
        if (g.kind === 'lava') { juice.kick(10, 0.3); juice.flash('255,80,40', 0.25); }
        else if (g.kind === 'gold') juice.flash('255,220,140', 0.22);
        if (navigator.vibrate) navigator.vibrate(pts > 0 ? 12 : 60);
        break;
      }
    };
    canvas.addEventListener('pointerdown', tap);

    /** Gemme taillée : couronne et pavillon en facettes éclairées du haut à gauche, reflet qui scintille. */
    const drawFacets = (s: number, light: string, dark: string) => {
      const T = -s, M = -s * 0.22, B = s, Wd = s * 0.82, tw = s * 0.36;
      const face = (pts: Array<[number, number]>, fill: string, alpha = 1) => {
        ctx.globalAlpha *= alpha; ctx.fillStyle = fill;
        ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath(); ctx.fill();
        ctx.globalAlpha /= alpha;
      };
      face([[-Wd, M], [-tw, T * 0.55], [0, M]], light);
      face([[-tw, T * 0.55], [tw, T * 0.55], [0, M]], '#ffffff', 0.55);
      face([[tw, T * 0.55], [Wd, M], [0, M]], light, 0.8);
      face([[-tw, T * 0.55], [0, T], [tw, T * 0.55]], light);
      face([[-Wd, M], [0, M], [0, B]], dark, 0.85);
      face([[0, M], [Wd, M], [0, B]], dark);
      face([[-Wd * 0.45, M], [0, M], [0, B]], light, 0.35);
      ctx.strokeStyle = 'rgba(10,6,12,0.45)'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(0, T); ctx.lineTo(Wd, M); ctx.lineTo(0, B); ctx.lineTo(-Wd, M); ctx.closePath(); ctx.stroke();
      const twk = 0.5 + 0.5 * Math.sin(performance.now() / 180 + s);
      ctx.fillStyle = `rgba(255,255,255,${0.6 * twk})`;
      ctx.beginPath(); ctx.moveTo(-s * 0.3, -s * 0.62); ctx.lineTo(-s * 0.26, -s * 0.48); ctx.lineTo(-s * 0.12, -s * 0.44); ctx.lineTo(-s * 0.26, -s * 0.4); ctx.lineTo(-s * 0.3, -s * 0.26); ctx.lineTo(-s * 0.34, -s * 0.4); ctx.lineTo(-s * 0.48, -s * 0.44); ctx.lineTo(-s * 0.34, -s * 0.48); ctx.closePath(); ctx.fill();
    };

    const drawGem = (g: Gem) => {
      ctx.save();
      ctx.translate(g.x, g.y); ctx.rotate(g.rot);
      const s = g.r * (g.hit ? 1 + g.hit : 1);
      ctx.globalAlpha = g.hit ? Math.max(0, 1 - g.hit * 2) : 1;
      const [c1, c2] = COLORS[g.kind];
      if (!g.hit) {
        const halo = ctx.createRadialGradient(0, 0, s * 0.2, 0, 0, s * 1.9);
        halo.addColorStop(0, g.kind === 'lava' ? 'rgba(255,90,30,0.35)' : 'rgba(255,240,200,0.28)'); halo.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = halo; ctx.fillRect(-s * 2, -s * 2, s * 4, s * 4);
      }
      if (g.kind === 'lava') {
        const grd = ctx.createLinearGradient(-s, -s, s, s);
        grd.addColorStop(0, c1); grd.addColorStop(1, c2);
        ctx.fillStyle = grd;
        ctx.beginPath();
        for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2; const rr = s * (0.8 + 0.2 * Math.sin(i * 3)); ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#ff6a1a'; ctx.lineWidth = 2; ctx.stroke();
        // fissures incandescentes
        ctx.strokeStyle = `rgba(255,140,40,${0.5 + 0.4 * Math.sin(g.rot * 3)})`; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.moveTo(-s * 0.5, -s * 0.1); ctx.lineTo(0, s * 0.1); ctx.lineTo(s * 0.3, -s * 0.4); ctx.moveTo(0, s * 0.1); ctx.lineTo(-s * 0.1, s * 0.6); ctx.stroke();
      } else drawFacets(s, c1, c2);
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
      if (!bgPainted && backdrop.ok()) paintBg();
      juice.begin(ctx, dt);
      if (bg) ctx.drawImage(bg, 0, 0, W, H); else ctx.clearRect(0, 0, W, H);
      ambience.draw(ctx, W, H, dt, now);
      for (const g of gems) { g.y += g.vy * dt; g.rot += g.vr * dt; if (g.hit) g.hit += dt * 3; }
      for (let i = gems.length - 1; i >= 0; i--) if (gems[i].y - gems[i].r > H || gems[i].hit > 0.5) gems.splice(i, 1);
      gems.forEach(drawGem);
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (const p of sparks) {
        p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 420 * dt;
        ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 2)); ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, 2.2, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
      for (let i = sparks.length - 1; i >= 0; i--) if (sparks[i].life <= 0) sparks.splice(i, 1);
      juice.end(ctx, W, H, dt);
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

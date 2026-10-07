// Mini-jeu « Mémoire des runes » : 16 pierres retournées cachent 8 paires de runes.
// On retourne deux pierres ; si les runes sont identiques, la paire reste visible. 60 secondes.
// Score = paires × 3 + bonus de temps (secondes restantes / 3).
import { h } from '../dom.js';
import type { GameOpts } from './index.js';

const DURATION = 60;
const PREVIEW = 1.6;

type Pt = [number, number];
// Runes du Futhark ancien, en traits (coordonnées 0..1 dans la case).
const RUNES: Pt[][][] = [
  [[[0.38, 0], [0.38, 1]], [[0.38, 0.32], [0.72, 0.06]], [[0.38, 0.58], [0.72, 0.32]]],            // Fehu
  [[[0.3, 1], [0.3, 0], [0.7, 0.32], [0.7, 1]]],                                                       // Uruz
  [[[0.36, 0], [0.36, 1]], [[0.36, 0.24], [0.7, 0.5], [0.36, 0.76]]],                                  // Thurisaz
  [[[0.38, 0], [0.38, 1]], [[0.38, 0], [0.72, 0.26]], [[0.38, 0.3], [0.72, 0.56]]],                    // Ansuz
  [[[0.34, 0], [0.34, 1]], [[0.34, 0], [0.68, 0.22], [0.34, 0.46], [0.72, 1]]],                        // Raidho
  [[[0.68, 0], [0.32, 0.5], [0.68, 1]]],                                                               // Kenaz
  [[[0.24, 0], [0.76, 1]], [[0.76, 0], [0.24, 1]]],                                                    // Gebo
  [[[0.3, 0], [0.3, 1]], [[0.7, 0], [0.7, 1]], [[0.3, 0.38], [0.7, 0.62]]],                            // Hagalaz
  [[[0.5, 0], [0.5, 1]], [[0.5, 0.42], [0.18, 0.06]], [[0.5, 0.42], [0.82, 0.06]]],                    // Algiz
  [[[0.5, 0], [0.5, 1]], [[0.18, 0.32], [0.5, 0], [0.82, 0.32]]],                                      // Tiwaz
  [[[0.66, 0], [0.34, 0.42], [0.66, 0.58], [0.34, 1]]],                                                // Sowilo
  [[[0.5, 0], [0.8, 0.32], [0.22, 1]], [[0.5, 0], [0.2, 0.32], [0.78, 1]]],                            // Othala
  [[[0.2, 0], [0.2, 1]], [[0.8, 0], [0.8, 1]], [[0.2, 0], [0.8, 1]], [[0.8, 0], [0.2, 1]]],            // Dagaz
  [[[0.5, 0], [0.5, 1]], [[0.24, 0.34], [0.76, 0.66]]]                                                 // Eihwaz (simplifiée)
];

function drawRune(c: HTMLCanvasElement, rune: Pt[][], size: number): void {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  c.width = Math.round(size * dpr); c.height = Math.round(size * dpr);
  const g = c.getContext('2d')!;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const pad = size * 0.22, s = size - pad * 2;
  g.lineCap = 'round'; g.lineJoin = 'round';
  const path = () => {
    g.beginPath();
    for (const line of rune) line.forEach(([x, y], i) => (i ? g.lineTo(pad + x * s, pad + y * s) : g.moveTo(pad + x * s, pad + y * s)));
  };
  // halo doré
  g.shadowColor = 'rgba(255,200,90,0.95)'; g.shadowBlur = size * 0.16;
  g.strokeStyle = '#d9a84a'; g.lineWidth = size * 0.085; path(); g.stroke();
  g.shadowBlur = size * 0.06;
  g.strokeStyle = '#fff3c4'; g.lineWidth = size * 0.035; path(); g.stroke();
}

export function playRuneMemory(dragonName: string, _opts: GameOpts): Promise<number> {
  return new Promise(resolve => {
    const scoreEl = h('div', { class: 'game-score' }, '0');
    const timeEl = h('div', { class: 'game-time' }, String(DURATION));
    const statusEl = h('div', { class: 'rune-status' }, '');
    const board = h('div', { class: 'rune-board' });
    const motes = h('canvas', { class: 'game-canvas' });
    const intro = h('div', { class: 'game-intro' },
      h('h2', null, 'Mémoire des runes'),
      h('p', null, `Seize pierres cachent des runes anciennes. Retourne-les deux par deux pour retrouver les paires et aider ${dragonName} à percer leur secret.`),
      h('p', { class: 'game-rules' }, 'Paire trouvée : +3 · Bonus pour le temps restant · 60 s'),
      h('button', { class: 'btn primary', onclick: () => { intro.remove(); start(); } }, 'C’est parti !'));
    const root = h('div', { class: 'game game-runes' }, motes, h('div', { class: 'game-hud' }, scoreEl, timeEl), h('div', { class: 'rune-wrap' }, board, statusEl), intro);
    document.body.append(root);

    // Choix de 8 runes au hasard, en paires mélangées.
    const pool = RUNES.map((_, i) => i).sort(() => Math.random() - 0.5).slice(0, 8);
    const deck = [...pool, ...pool];
    for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }

    interface Tile { el: HTMLElement; rune: number; open: boolean; found: boolean; face: HTMLCanvasElement }
    const tiles: Tile[] = deck.map(rune => {
      const face = h('canvas', { class: 'rune-glyph' });
      const el = h('div', { class: 'rune-tile' },
        h('div', { class: 'rune-inner' },
          h('div', { class: 'rune-face rune-back' }, h('span', { class: 'rune-knot' })),
          h('div', { class: 'rune-face rune-front' }, face)));
      return { el, rune, open: false, found: false, face };
    });
    tiles.forEach(tl => board.append(tl.el));

    const layout = () => {
      const W = root.clientWidth, H = root.clientHeight;
      const size = Math.floor(Math.min(W - 28, H - 190, 460));
      board.style.width = board.style.height = `${size}px`;
      const tileSize = (size - 3 * 10) / 4;
      tiles.forEach(tl => drawRune(tl.face, RUNES[tl.rune], tileSize));
      // particules d’ambiance
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      motes.width = W * dpr; motes.height = H * dpr;
      mctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      mW = W; mH = H;
    };
    const mctx = motes.getContext('2d')!;
    let mW = 0, mH = 0;
    layout();
    const dust = Array.from({ length: 34 }, () => ({ x: Math.random() * mW, y: Math.random() * mH, v: 6 + Math.random() * 16, s: 0.8 + Math.random() * 1.8, p: Math.random() * 6 }));

    let pairs = 0, t = 0, last = 0, raf = 0, running = false, over = false, lock = true;
    let opened: Tile[] = [];
    let closeTimer = 0;

    const setOpen = (tl: Tile, open: boolean) => { tl.open = open; tl.el.classList.toggle('flipped', open); };
    const closePending = () => {
      clearTimeout(closeTimer);
      if (opened.length === 2) opened.forEach(o => { if (!o.found) setOpen(o, false); });
      opened = [];
    };

    const pop = (tl: Tile, text: string) => {
      const p = h('div', { class: 'rune-pop' }, text);
      tl.el.append(p);
      setTimeout(() => p.remove(), 900);
    };

    const onTap = (tl: Tile) => {
      if (!running || lock || tl.found || tl.open) return;
      if (opened.length === 2) closePending();
      setOpen(tl, true);
      opened.push(tl);
      if (navigator.vibrate) navigator.vibrate(5);
      if (opened.length < 2) return;
      const [a, b] = opened;
      if (a.rune === b.rune) {
        a.found = b.found = true;
        opened = [];
        pairs++;
        setTimeout(() => { a.el.classList.add('found'); b.el.classList.add('found'); pop(b, '+3'); }, 260);
        if (navigator.vibrate) navigator.vibrate([12, 40, 12]);
        statusEl.textContent = `Paires : ${pairs} / 8`;
        if (pairs === 8) setTimeout(end, 700);
      } else {
        a.el.classList.add('miss'); b.el.classList.add('miss');
        setTimeout(() => { a.el.classList.remove('miss'); b.el.classList.remove('miss'); }, 500);
        closeTimer = window.setTimeout(closePending, 850);
      }
    };
    tiles.forEach(tl => tl.el.addEventListener('pointerdown', e => { e.preventDefault(); onTap(tl); }));

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
      last = now;
      if (running && !lock && !over) {
        t += dt;
        if (t >= DURATION) end();
      }
      const left = Math.max(0, Math.ceil(DURATION - t));
      scoreEl.textContent = String(pairs * 3);
      timeEl.textContent = String(left);
      timeEl.classList.toggle('game-time-low', running && left <= 10);
      mctx.clearRect(0, 0, mW, mH);
      mctx.fillStyle = '#f2c46a';
      for (const d of dust) {
        d.y -= d.v * dt; d.x += Math.sin(now / 1500 + d.p) * 6 * dt;
        if (d.y < -4) { d.y = mH + 4; d.x = Math.random() * mW; }
        mctx.globalAlpha = 0.25 + 0.35 * Math.sin(now / 700 + d.p) ** 2;
        mctx.fillRect(d.x, d.y, d.s, d.s);
      }
      mctx.globalAlpha = 1;
    };
    raf = requestAnimationFrame(frame);

    function start(): void {
      running = true; t = 0;
      statusEl.textContent = 'Mémorise les runes…';
      tiles.forEach(tl => setOpen(tl, true));
      setTimeout(() => {
        if (over) return;
        tiles.forEach(tl => setOpen(tl, false));
        lock = false;
        statusEl.textContent = 'Paires : 0 / 8';
      }, PREVIEW * 1000);
    }
    function end(): void {
      if (over) return;
      over = true; running = false; lock = true;
      clearTimeout(closeTimer);
      const left = Math.max(0, DURATION - t);
      const bonus = Math.round(left / 3);
      const score = pairs * 3 + bonus;
      scoreEl.textContent = String(score);
      tiles.forEach(tl => { if (!tl.found) { setOpen(tl, true); tl.el.classList.add('unsolved'); } });
      const box = h('div', { class: 'game-intro game-end' },
        h('h2', null, `Score : ${score}`),
        h('p', { class: 'game-rules' }, `${pairs} paire${pairs > 1 ? 's' : ''} × 3${bonus ? ` + ${bonus} de bonus de temps` : ''}`),
        h('p', null, pairs === 8 ? `Toutes les runes sont déchiffrées ! ${dragonName} devient plus sage.` : pairs >= 4 ? `Bien joué, ${dragonName} apprend vite.` : `${dragonName} a aimé réfléchir avec toi.`),
        h('button', { class: 'btn primary', onclick: () => finish(score) }, 'Continuer'));
      setTimeout(() => root.append(box), 500);
    }
    function finish(score: number): void {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', layout);
      root.remove();
      resolve(score);
    }
    window.addEventListener('resize', layout);
  });
}

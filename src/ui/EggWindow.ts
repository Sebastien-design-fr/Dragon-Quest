// Fenêtre de l'œuf de famille : le nid peint, l'œuf qui vit (il respire, se balance, frémit quand on le touche),
// la chaleur apportée par chacun, puis l'éclosion et le petit dragon partagé.
// Tout le mouvement est fait par déformation des illustrations (bandes de l'image décalées et étirées),
// sans image intermédiaire : l'œuf reste l'œuf peint, le petit reste le petit peint.
import { Sound } from '../engine/Sound.js';
import { EGG_DESIGNS, EGG_GOAL, type FamilyEgg } from '../family/FamilyEgg.js';
import type { App } from './App.js';
import { h } from './dom.js';
import { UI } from './Motion.js';

const imgCache = new Map<string, HTMLImageElement>();
function img(src: string): HTMLImageElement {
  let i = imgCache.get(src);
  if (!i) { i = new Image(); i.decoding = 'async'; i.src = src; imgCache.set(src, i); }
  return i;
}
const eggSrc = (n: number) => `assets/family/egg_${n}.webp`;
const BABY = 'assets/family/baby.webp';
const NEST = 'assets/family/nest_panel.webp';

/** Hasard reproductible (fissures identiques d'une ouverture à l'autre). */
function seeded(seed: number): () => number {
  let s = seed % 2147483647 || 1;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

/** Couche de l'œuf : l'image, sa lueur intérieure et ses fissures selon l'état (pas de nouvelle illustration). */
class EggLayer {
  readonly canvas = document.createElement('canvas');
  private cracks: HTMLCanvasElement | null = null;
  private cracksKey = '';

  draw(egg: HTMLImageElement, stage: number, time: number, extraGlow: number): HTMLCanvasElement {
    const W = egg.naturalWidth, H = egg.naturalHeight, c = this.canvas;
    if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
    const g = c.getContext('2d')!;
    g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 0, W, H);
    g.drawImage(egg, 0, 0);
    g.globalCompositeOperation = 'source-atop';
    // lueur intérieure : un cœur qui bat, plus fort à chaque état
    const beat = Math.pow(Math.max(0, Math.sin(time * 2.4)), 6) * 0.6 + 0.4;
    const glow = Math.min(1, Math.max(0, (stage - 1) * 0.22) * beat + extraGlow);
    if (glow > 0.01) {
      const gr = g.createRadialGradient(W * 0.5, H * 0.55, 0, W * 0.5, H * 0.55, H * 0.55);
      gr.addColorStop(0, `rgba(255,214,140,${0.55 * glow})`);
      gr.addColorStop(0.45, `rgba(214,150,255,${0.25 * glow})`);
      gr.addColorStop(1, 'rgba(120,60,160,0)');
      g.globalCompositeOperation = 'lighter';
      g.fillStyle = gr;
      g.fillRect(0, 0, W, H);
      g.globalCompositeOperation = 'source-atop';
    }
    // fissures lumineuses (états 3 à 5)
    if (stage >= 3) {
      const key = `${W}x${H}:${stage}`;
      if (key !== this.cracksKey) { this.cracks = makeCracks(W, H, stage); this.cracksKey = key; }
      const pulse = 0.75 + 0.25 * Math.sin(time * 3.1);
      g.globalAlpha = pulse;
      g.drawImage(this.cracks!, 0, 0);
      g.globalAlpha = 1;
    }
    g.globalCompositeOperation = 'source-over';
    return c;
  }
}

/** Fissures en zigzag partant du haut de l'œuf, plus nombreuses et plus longues à chaque état. */
function makeCracks(W: number, H: number, stage: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d')!;
  const rnd = seeded(7 + stage * 13);
  const count = stage === 3 ? 2 : stage === 4 ? 3 : 5;
  const reach = stage === 3 ? 0.28 : stage === 4 ? 0.42 : 0.55;
  const paths: Array<Array<[number, number]>> = [];
  for (let k = 0; k < count; k++) {
    let x = W * (0.32 + (k / Math.max(1, count - 1)) * 0.36), y = H * (0.05 + rnd() * 0.08);
    const pts: Array<[number, number]> = [[x, y]];
    const steps = 4 + Math.floor(rnd() * 3);
    for (let i = 0; i < steps; i++) {
      x += (rnd() - 0.5) * W * 0.2;
      y += (H * reach / steps) * (0.6 + rnd() * 0.8);
      pts.push([x, y]);
      if (rnd() < 0.18) paths.push([[x, y], [x + (rnd() - 0.5) * W * 0.18, y + H * 0.06 * rnd()]]); // petite branche
    }
    paths.push(pts);
  }
  const stroke = (w: number, col: string, blur: number) => {
    g.strokeStyle = col; g.lineWidth = w; g.lineJoin = 'round'; g.lineCap = 'round';
    g.shadowColor = col; g.shadowBlur = blur;
    for (const p of paths) { g.beginPath(); p.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke(); }
  };
  stroke(W * 0.03, 'rgba(30,14,6,0.9)', 0);            // creux sombre
  stroke(W * 0.014, 'rgba(255,200,110,0.95)', W * 0.05); // lumière dorée
  stroke(W * 0.004, 'rgba(255,245,225,1)', W * 0.02);     // cœur blanc
  g.shadowBlur = 0;
  if (stage >= 5) {
    // un éclat de coquille manque au sommet : on y voit la lumière
    const gr = g.createRadialGradient(W * 0.5, H * 0.1, 0, W * 0.5, H * 0.1, W * 0.2);
    gr.addColorStop(0, 'rgba(255,250,230,1)'); gr.addColorStop(0.5, 'rgba(255,200,120,0.7)'); gr.addColorStop(1, 'rgba(255,200,120,0)');
    g.fillStyle = gr; g.fillRect(0, 0, W, H * 0.3);
  }
  return c;
}

/**
 * Dessine une image déformée par bandes horizontales : balancement autour du bas, écrasement / étirement à volume
 * constant, et vague qui monte (le haut bouge plus que la base, posée dans le nid).
 */
function drawWobbly(g: CanvasRenderingContext2D, src: CanvasImageSource & { width: number; height: number }, cx: number, baseY: number, w: number, p: { sway: number; squash: number; wave: number; t: number }): void {
  const sw = src.width, sh = src.height, hh = w * sh / sw;
  g.save();
  g.translate(cx, baseY);
  g.rotate(p.sway);
  g.scale(1 + p.squash, 1 - p.squash);
  const bands = 28, bh = sh / bands, dh = hh / bands;
  for (let i = 0; i < bands; i++) {
    const v = i / bands;                     // 0 = sommet, 1 = base
    const lift = 1 - v;                      // la base reste posée
    const dx = Math.sin(p.t * 7 + v * 5) * p.wave * w * 0.05 * lift;
    g.drawImage(src, 0, i * bh, sw, bh + 0.8, -w / 2 + dx, -hh + i * dh, w, dh + 0.8);
  }
  g.restore();
}

/**
 * Petit dragon déformé par colonnes (comme le loup) : il respire, sa queue ondule, sa tête dodeline,
 * et il sautille de joie (écrasement, bond, étirement) quand on le touche.
 */
function drawBaby(g: CanvasRenderingContext2D, src: HTMLImageElement, cx: number, baseY: number, w: number, t: number, hop: number): void {
  const sw = src.naturalWidth, sh = src.naturalHeight, H = w * sh / sw;
  const cols = 60, cw = sw / cols, dw = w / cols;
  const breath = Math.sin(t * 2.2);
  // bond : 0..1 → anticipation (écrasé), envol (étiré), retombée
  const jump = hop > 0 ? Math.sin(Math.min(1, hop) * Math.PI) : 0;
  const squash = hop > 0 ? (hop < 0.15 ? hop / 0.15 * 0.08 : -0.06 * jump) : 0;
  g.save();
  g.translate(cx, baseY - jump * H * 0.22);
  g.scale(1 + squash, 1 - squash);
  for (let i = 0; i < cols; i++) {
    const x = (i + 0.5) / cols;                          // 0 = bout de la queue, 1 = museau
    const tail = Math.pow(Math.max(0, 1 - x / 0.3), 2);
    const head = Math.min(1, Math.max(0, (x - 0.62) / 0.2));
    const chest = Math.exp(-Math.pow((x - 0.5) / 0.22, 2));
    const sy = 1 + 0.025 * breath * chest;
    let dy = Math.sin(t * 3.2 + x * 4) * H * 0.035 * tail;
    dy += Math.sin(t * 1.6 + 0.8) * H * 0.012 * head;
    const dh = H * sy;
    g.drawImage(src, i * cw, 0, cw + 0.6, sh, -w / 2 + i * dw, -dh + dy, dw + 0.6, dh);
  }
  g.restore();
}

interface Scene { stop(): void }

/** Ouvre la fenêtre de l'œuf (ou du petit s'il est né). */
export function openEggWindow(app: App): void {
  const egg = app.family.egg;
  if (!egg || document.querySelector('.egg-ov')) return;
  UI.tap();
  const child = !app.isParent;
  const mineLabel = child ? 'Toi' : 'Toi';
  const othersLabel = child ? 'Tes parents' : (app.family.hub?.childIds().map(id => app.family.hub!.child(id)?.name).filter(Boolean).join(', ') || 'Ton enfant');

  const canvas = h('canvas', { class: 'egg-canvas', 'aria-hidden': 'true' }) as HTMLCanvasElement;
  const title = h('h2', { class: 'egg-title' });
  const line = h('p', { class: 'egg-line' });
  const bar = h('div', { class: 'egg-bar', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(EGG_GOAL) }, h('span', { class: 'egg-fill' }));
  const shares = h('p', { class: 'egg-shares small' });
  const designs = h('div', { class: 'egg-designs', role: 'radiogroup', 'aria-label': 'Choisir l’œuf' });
  const nameBox = h('div', { class: 'egg-name' });
  const close = () => { scene?.stop(); ov.remove(); egg.markSeen(); app.refresh(); };
  const panel = h('div', { class: 'egg-panel', style: { backgroundImage: `url(${NEST})` } },
    h('button', { class: 'egg-close', 'aria-label': 'Fermer', onclick: close }, '×'),
    title, canvas, h('div', { class: 'egg-foot' }, line, bar, shares, designs, nameBox));
  const ov = h('div', { class: 'egg-ov', role: 'dialog', 'aria-modal': 'true', onclick: (e: Event) => { if (e.target === ov) close(); } }, panel);
  document.body.append(ov);

  const fill = bar.querySelector<HTMLElement>('.egg-fill')!;
  const render = () => {
    const born = egg.hatched && egg.data.hatchSeen;
    title.textContent = born ? egg.babyName === 'le petit' ? 'Le petit dragon' : egg.babyName : 'L’œuf de la famille';
    const left = Math.max(0, EGG_GOAL - egg.total);
    line.textContent = born
      ? (child ? `Il est à vous deux. Touche-le pour jouer avec lui !` : `Il est à vous deux. Touche-le pour lui faire un câlin.`)
      : left === 0 ? 'Il bouge… il va éclore !'
      : egg.stage >= 4 ? `Encore ${left} quête${left > 1 ? 's' : ''} : on entend gratter dedans !`
      : `Chaque quête de la famille le réchauffe. Encore ${left} pour qu’il éclose.`;
    fill.style.width = `${Math.round(egg.progress * 100)}%`;
    bar.setAttribute('aria-valuenow', String(Math.min(EGG_GOAL, egg.total)));
    bar.hidden = born;
    shares.textContent = born ? '' : `${mineLabel} : ${egg.data.mine} · ${othersLabel} : ${egg.data.others}`;
    // l'enfant choisit le dessin de l'œuf tant qu'il n'a pas éclos
    designs.replaceChildren();
    if (child && !egg.hatched) for (let n = 1; n <= EGG_DESIGNS; n++) {
      designs.append(h('button', {
        class: `egg-design${egg.data.design === n ? ' on' : ''}`, role: 'radio', 'aria-checked': String(egg.data.design === n), 'aria-label': `Œuf ${n}`,
        onclick: () => { egg.chooseDesign(n); UI.tick(); render(); }
      }, h('img', { src: eggSrc(n), alt: '' })));
    }
    // nom du petit : donné par l'enfant après l'éclosion
    nameBox.replaceChildren();
    if (born && !egg.data.name) {
      if (child) {
        const input = h('input', { type: 'text', maxlength: '20', placeholder: 'Son nom…', 'aria-label': 'Nom du petit dragon' }) as HTMLInputElement;
        nameBox.append(input, h('button', { class: 'btn primary', onclick: () => { egg.setName(input.value); UI.success(); render(); } }, 'Le nommer'));
      } else nameBox.append(h('p', { class: 'small muted' }, 'Ton enfant va lui choisir un nom.'));
    }
  };
  render();
  const scene = runScene(app, egg, canvas, render);
  egg.events.on('change', () => { if (document.body.contains(ov)) render(); });
}

/** Animation de la fenêtre : œuf vivant, chaleurs qui arrivent, éclosion, puis le petit. */
function runScene(app: App, egg: FamilyEgg, canvas: HTMLCanvasElement, rerender: () => void): Scene {
  const g = canvas.getContext('2d')!;
  const layer = new EggLayer();
  const calm = !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  let raf = 0, last = performance.now(), t = 0;
  let poke = 0;                       // frémissement après un toucher
  let hop = 0;                        // bond du petit
  let warmth = Math.max(0, egg.total - egg.data.seenTotal); // nouvelles chaleurs depuis la dernière visite
  let warmT = 0;
  const sparks: Array<{ x: number; y: number; vx: number; vy: number; life: number; c: string }> = [];
  // éclosion : se joue une seule fois, sur chaque téléphone
  let hatchT = egg.hatched && !egg.data.hatchSeen ? 0 : -1;
  const hearts: Array<{ x: number; y: number; t: number }> = [];

  const size = () => {
    const r = canvas.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = Math.round(r.width * dpr), H = Math.round(r.height * dpr);
    if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
    return { W, H, dpr };
  };

  canvas.addEventListener('pointerdown', e => {
    const { dpr } = size();
    const r = canvas.getBoundingClientRect();
    const x = (e.clientX - r.left) * dpr, y = (e.clientY - r.top) * dpr;
    if (egg.hatched && hatchT < 0) {
      hop = 0.001; hearts.push({ x, y, t: 0 });
      Sound.ui('success'); navigator.vibrate?.(12);
    } else if (hatchT < 0) {
      poke = 1; Sound.scenery('crystal', 0.3 + egg.progress * 0.6); navigator.vibrate?.(8);
      for (let i = 0; i < 8; i++) sparks.push({ x, y, vx: (Math.random() - 0.5) * 120 * dpr, vy: -(40 + Math.random() * 120) * dpr, life: 1, c: Math.random() < 0.5 ? '255,214,140' : '214,160,255' });
    }
  });

  const frame = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
    const { W, H, dpr } = size();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, W, H);
    const nestY = H * 0.93;                // la base de l'œuf repose dans le nid
    const eggImg = img(eggSrc(egg.data.design)), babyImg = img(BABY);

    // nouvelles chaleurs : des braises montent du bas et entrent dans l'œuf, une par quête
    if (warmth > 0 && hatchT < 0) {
      warmT += dt;
      if (warmT > 0.35) {
        warmT = 0; warmth--;
        sparks.push({ x: W * (0.2 + Math.random() * 0.6), y: H, vx: 0, vy: -H * 0.9, life: 1.2, c: '255,200,120' });
        Sound.ui('tick');
      }
    }

    if (hatchT >= 0) {
      hatchT += dt;
      const T = hatchT;
      // 0-2,2 s : l'œuf tremble de plus en plus ; 2,2 s : éclat ; 2,2-3,6 s : le petit apparaît
      if (T < 2.2 && eggImg.complete) {
        const k = T / 2.2;
        const shake = calm ? 0 : Math.sin(T * (18 + k * 30)) * (0.04 + 0.12 * k);
        drawWobbly(g, layer.draw(eggImg, 5, t, 0.3 + 0.7 * k), W / 2, nestY, W * 0.42, { sway: shake, squash: 0.03 * Math.sin(T * 20) * k, wave: 0.5 + k, t });
        if (Math.random() < k * 0.5) sparks.push({ x: W / 2 + (Math.random() - 0.5) * W * 0.3, y: nestY - H * 0.35, vx: (Math.random() - 0.5) * 200 * dpr, vy: -(80 + Math.random() * 160) * dpr, life: 1, c: '255,230,170' });
      } else if (T >= 2.2) {
        if (T - dt < 2.2) {
          Sound.ui('success'); Sound.scenery('wish'); navigator.vibrate?.([30, 60, 40]);
          for (let i = 0; i < 40; i++) {
            const a = Math.random() * Math.PI * 2, s = (120 + Math.random() * 380) * dpr;
            sparks.push({ x: W / 2, y: nestY - H * 0.3, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 120 * dpr, life: 1.4, c: Math.random() < 0.5 ? '255,214,140' : '214,160,255' });
          }
        }
        const k = Math.min(1, (T - 2.2) / 1.0);
        const pop = 1 - Math.pow(1 - k, 3) + Math.sin(k * Math.PI) * 0.08; // léger rebond
        if (babyImg.complete) drawBaby(g, babyImg, W / 2, nestY, W * 0.78 * pop, t, 0);
        const flash = Math.max(0, 1 - (T - 2.2) / 0.6);
        if (flash > 0) { g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = `rgba(255,245,225,${flash * 0.85})`; g.fillRect(0, 0, W, H); }
        if (T > 3.8) { hatchT = -1; egg.markHatchSeen(); rerender(); }
      }
    } else if (egg.hatched) {
      if (hop > 0) { hop += dt * 1.6; if (hop >= 1) hop = 0; }
      if (babyImg.complete) drawBaby(g, babyImg, W / 2, nestY, W * 0.78, t, hop);
    } else if (eggImg.complete) {
      // œuf vivant : respiration, balancement doux, et plus d'agitation près de l'éclosion
      const agit = (egg.stage - 1) / 4;
      poke = Math.max(0, poke - dt * 1.4);
      const breath = calm ? 0 : Math.sin(t * 1.8) * 0.012;
      const sway = calm ? 0 : Math.sin(t * 1.1) * 0.02 * (1 + agit) + Math.sin(t * 22) * 0.06 * poke
        + (agit > 0.5 && Math.sin(t * 0.7) > 0.93 ? Math.sin(t * 30) * 0.04 * agit : 0); // petits sursauts quand il est près d'éclore
      drawWobbly(g, layer.draw(eggImg, egg.stage, t, poke * 0.3), W / 2, nestY, W * 0.42, { sway, squash: breath + poke * 0.03 * Math.sin(t * 25), wave: poke * 1.2 + agit * 0.15, t });
    }

    // étincelles et cœurs
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'lighter';
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      s.life -= dt; s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 140 * dpr * dt;
      if (s.life <= 0) { sparks.splice(i, 1); continue; }
      const r = 4 * dpr * (0.5 + s.life);
      const gr = g.createRadialGradient(s.x, s.y, 0, s.x, s.y, r);
      gr.addColorStop(0, `rgba(${s.c},${Math.min(1, s.life)})`); gr.addColorStop(1, `rgba(${s.c},0)`);
      g.fillStyle = gr; g.fillRect(s.x - r, s.y - r, r * 2, r * 2);
    }
    g.globalCompositeOperation = 'source-over';
    for (let i = hearts.length - 1; i >= 0; i--) {
      const ht = hearts[i]; ht.t += dt;
      if (ht.t > 1.2) { hearts.splice(i, 1); continue; }
      g.globalAlpha = 1 - ht.t / 1.2;
      g.fillStyle = '#ff7a9a';
      g.font = `${Math.round(26 * dpr)}px sans-serif`;
      g.fillText('♥', ht.x - 9 * dpr, ht.y - ht.t * 60 * dpr);
      g.globalAlpha = 1;
    }
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  return { stop: () => cancelAnimationFrame(raf) };
}

/** Petite image de l'œuf (ou du petit) pour la pastille d'accueil. */
export function eggThumb(egg: FamilyEgg): HTMLElement {
  return h('img', { class: 'egg-thumb', src: egg.hatched ? BABY : eggSrc(egg.data.design), alt: '' });
}

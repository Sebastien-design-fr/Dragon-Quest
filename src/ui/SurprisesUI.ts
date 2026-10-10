// Surprises à l'écran : créatures de passage à attraper, trouvailles du dragon, coffre du jour,
// silhouette de la prochaine évolution. Tout est dessiné en SVG inline, animé en CSS / requestAnimationFrame.
import type { App } from './App.js';
import { Assets } from '../engine/AssetManager.js';
import { Sound } from '../engine/Sound.js';
import type { FoodId } from '../family/Companion.js';
import { VISITORS, applyLoot, lootText, surprisesFor, type Loot, type VisitorKind } from '../family/Surprises.js';
import { clear, h } from './dom.js';

const pick = <T>(list: T[]): T => list[Math.floor(Math.random() * list.length)];
let uid = 0;

/** Élément HTML contenant un SVG (les ids des dégradés sont rendus uniques). */
function art(markup: (id: string) => string, cls: string): HTMLElement {
  const el = h('span', { class: cls, 'aria-hidden': 'true' });
  el.innerHTML = markup('sp' + (++uid));
  return el;
}

// ---------------------------------------------------------------- Dessins

const coinSvg = (id: string) => `<svg viewBox="0 0 24 24"><defs><radialGradient id="${id}" cx="35%" cy="30%" r="75%"><stop offset="0" stop-color="#fff6c8"/><stop offset=".45" stop-color="#f2c14e"/><stop offset="1" stop-color="#9a6418"/></radialGradient></defs><circle cx="12" cy="12" r="10.5" fill="url(#${id})" stroke="#6e440e" stroke-width="1"/><circle cx="12" cy="12" r="7.2" fill="none" stroke="#c48a28" stroke-width="1.2"/><path d="M12 7.6l1.3 2.8 3 .3-2.3 2 .7 3L12 14.2l-2.7 1.5.7-3-2.3-2 3-.3z" fill="#fff1b0" opacity=".9"/></svg>`;

const gemSvg = () => Assets.art('ui/gemme') ? `<img src="${Assets.art('ui/gemme')}" alt="" style="width:100%;height:100%;object-fit:contain">` : `<svg viewBox="0 0 24 24"><path d="M6 3h12l4 6-10 13L2 9z" fill="#5fd0ff"/><path d="M2 9h20L12 22z" fill="#2a8fd6"/><path d="M9 9l3 13 3-13z" fill="#47b6f2"/><path d="M6 3l3 6h6l3-6z" fill="#b5f0ff"/><path d="M6 3L2 9h7zM18 3l4 6h-7z" fill="#82dcff"/><path d="M6 3h12l4 6-10 13L2 9z" fill="none" stroke="#0e4f86" stroke-width=".9" stroke-linejoin="round"/><path d="M7.5 5l1.5 3" stroke="#fff" stroke-width="1" stroke-linecap="round" opacity=".8"/></svg>`;

const flameSvg = (id: string) => `<svg viewBox="0 0 24 24"><defs><linearGradient id="${id}" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#ff4a12"/><stop offset=".6" stop-color="#ff8a1f"/><stop offset="1" stop-color="#ffc35a"/></linearGradient></defs><path d="M12 2c1 4 6.5 6 6.5 12.2A6.5 6.5 0 0 1 5.5 14c0-3 1.5-4.6 3-6.1 0 2 1 3.2 2.2 3.2C9.8 8 10.8 5 12 2z" fill="url(#${id})"/><path d="M12 11.5c.7 2 3.2 3.1 3.2 5.6a3.2 3.2 0 0 1-6.4 0c0-1.6 1.1-2.7 3.2-5.6z" fill="#ffe7a0"/></svg>`;

const FOOD_SVG: Record<FoodId, (id: string) => string> = {
  meat: () => `<svg viewBox="0 0 24 24"><path d="M5.5 18.5l3-3" stroke="#f4ead8" stroke-width="3" stroke-linecap="round"/><circle cx="4.2" cy="17.6" r="1.8" fill="#f4ead8"/><circle cx="6.4" cy="19.8" r="1.8" fill="#f4ead8"/><path d="M15 3.5a5.5 5.5 0 0 1 5.5 5.5c0 4.5-5 7.5-9.5 7.5L8 14c0-4.5 3-10.5 7-10.5z" fill="#a4512a"/><path d="M15.5 5.5a3 3 0 0 1 3 3" stroke="#e08a52" stroke-width="1.6" stroke-linecap="round" fill="none"/></svg>`,
  fish: () => `<svg viewBox="0 0 24 24"><path d="M3 12c3-5 9-6.5 13-3l4-3v12l-4-3c-4 3.5-10 2-13-3z" fill="#7fb6d9"/><path d="M3 12c3 4.8 9 6 13 3" fill="#cfe6f5"/><circle cx="7" cy="11" r="1.1" fill="#16222e"/><path d="M10 9.5c1 1.6 1 3.4 0 5" stroke="#4a7fa6" stroke-width="1" fill="none"/></svg>`,
  fireFruit: (id) => `<svg viewBox="0 0 24 24"><defs><radialGradient id="${id}" cx="38%" cy="35%" r="70%"><stop offset="0" stop-color="#ffd27a"/><stop offset=".55" stop-color="#ff6a1f"/><stop offset="1" stop-color="#b4200c"/></radialGradient></defs><circle cx="12" cy="14" r="7.5" fill="url(#${id})"/><path d="M12 6.5c-.5-2 .5-3.5 2-4.5-.2 1.6.4 2.6 1.6 3.4-1 .1-2.5.4-3.6 1.1z" fill="#ffb347"/><path d="M12 6.5c-1.2-1.4-3-1.6-4.5-1 1.2.6 2 1.4 2.3 2.4" fill="#4f8f3a"/></svg>`,
  ration: () => `<svg viewBox="0 0 24 24"><rect x="4" y="8" width="16" height="11" rx="2" fill="#9c6b3c"/><path d="M4 11h16" stroke="#6e4524" stroke-width="1.4"/></svg>`,
  treat: () => `<svg viewBox="0 0 24 24"><path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z" fill="#ff7aa2"/></svg>`
};

const chestSvg = (id: string) => `<svg viewBox="0 0 120 104">
<defs>
 <radialGradient id="${id}g"><stop offset="0" stop-color="#ffd76a" stop-opacity=".95"/><stop offset=".45" stop-color="#ffb84a" stop-opacity=".35"/><stop offset="1" stop-color="#ffb84a" stop-opacity="0"/></radialGradient>
 <linearGradient id="${id}w" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8f532c"/><stop offset="1" stop-color="#4a2815"/></linearGradient>
 <linearGradient id="${id}l" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a8653a"/><stop offset="1" stop-color="#5d331c"/></linearGradient>
 <linearGradient id="${id}b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff0b0"/><stop offset=".4" stop-color="#e6b04a"/><stop offset="1" stop-color="#8a5a17"/></linearGradient>
 <linearGradient id="${id}i" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#ffb84a"/><stop offset="1" stop-color="#fff6d0"/></linearGradient>
</defs>
<ellipse class="sp-chest-glow" cx="60" cy="58" rx="60" ry="48" fill="url(#${id}g)"/>
<ellipse cx="60" cy="98" rx="46" ry="5" fill="#000" opacity=".4"/>
<path class="sp-chest-inner" d="M18 47h84v10H18z" fill="url(#${id}i)"/>
<rect x="16" y="50" width="88" height="46" rx="5" fill="url(#${id}w)"/>
<path d="M18 66h84M18 81h84" stroke="#2e170a" stroke-width="1.3" opacity=".55"/>
<rect x="26" y="50" width="9" height="46" fill="url(#${id}b)"/><rect x="85" y="50" width="9" height="46" fill="url(#${id}b)"/>
<circle cx="30.5" cy="88" r="1.5" fill="#6e440e"/><circle cx="89.5" cy="88" r="1.5" fill="#6e440e"/><circle cx="30.5" cy="58" r="1.5" fill="#6e440e"/><circle cx="89.5" cy="58" r="1.5" fill="#6e440e"/>
<g class="sp-lid">
 <path d="M16 51V38c0-14 20-22 44-22s44 8 44 22v13z" fill="url(#${id}l)"/>
 <path d="M24 33c4-6 17-11 36-11" stroke="#d58b55" stroke-width="2.5" stroke-linecap="round" fill="none" opacity=".55"/>
 <path d="M26 51V27.6c2.8-1.5 5.8-2.7 9-3.6V51z" fill="url(#${id}b)"/><path d="M85 24c3.2.9 6.2 2.1 9 3.6V51h-9z" fill="url(#${id}b)"/>
 <rect x="14" y="46" width="92" height="7" rx="2.5" fill="url(#${id}b)"/>
 <path d="M51 46h18v15a3 3 0 0 1-3 3H54a3 3 0 0 1-3-3z" fill="url(#${id}b)" stroke="#6e440e" stroke-width="1"/>
 <circle cx="60" cy="54" r="2.6" fill="#3a2208"/><path d="M59 55h2v5h-2z" fill="#3a2208"/>
</g>
</svg>`;

const giftSvg = (id: string) => `<svg viewBox="0 0 60 60">
<defs>
 <linearGradient id="${id}b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3fc7b2"/><stop offset="1" stop-color="#156257"/></linearGradient>
 <linearGradient id="${id}l" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6fe0cc"/><stop offset="1" stop-color="#28947f"/></linearGradient>
 <linearGradient id="${id}r" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff2b8"/><stop offset=".5" stop-color="#f2c14e"/><stop offset="1" stop-color="#b07a20"/></linearGradient>
</defs>
<ellipse cx="30" cy="56" rx="19" ry="3" fill="#000" opacity=".35"/>
<g class="sp-pk-body"><rect x="10" y="27" width="40" height="28" rx="3" fill="url(#${id}b)"/><rect x="27" y="27" width="6" height="28" fill="url(#${id}r)"/><path d="M13 31l4 4M40 46l4 4M17 47l3 3" stroke="#bff5ea" stroke-width="1.4" stroke-linecap="round" opacity=".5"/></g>
<g class="sp-pk-lid"><rect x="7" y="19" width="46" height="10" rx="2.5" fill="url(#${id}l)"/><rect x="27" y="19" width="6" height="10" fill="url(#${id}r)"/>
 <path d="M30 19c-6-10-16-9-14-2.5 1 3.2 7.5 3.4 14 2.5zM30 19c6-10 16-9 14-2.5-1 3.2-7.5 3.4-14 2.5z" fill="url(#${id}r)" stroke="#a06a18" stroke-width=".9"/>
 <circle cx="30" cy="18.4" r="2.8" fill="#ffe08a" stroke="#a06a18" stroke-width=".8"/></g>
</svg>`;

const sparkSvg = () => `<svg viewBox="0 0 20 20"><path d="M10 0c.8 5.2 4.8 9.2 10 10-5.2.8-9.2 4.8-10 10-.8-5.2-4.8-9.2-10-10 5.2-.8 9.2-4.8 10-10z" fill="currentColor"/></svg>`;

const moonSvg = () => `<svg viewBox="0 0 24 24"><path d="M19.5 14.5A8 8 0 1 1 9.5 4.5a6.2 6.2 0 0 0 10 10z" fill="#c9c2e8"/><circle cx="18" cy="5" r="1" fill="#f2d48a"/><circle cx="21" cy="9" r=".7" fill="#f2d48a"/></svg>`;

const VISITOR_SVG: Record<VisitorKind, (id: string) => string> = {
  firefly: (id) => `<svg viewBox="0 0 40 40"><defs><radialGradient id="${id}"><stop offset="0" stop-color="#fbffc2"/><stop offset=".35" stop-color="#d9ff6a" stop-opacity=".8"/><stop offset="1" stop-color="#b6ff3a" stop-opacity="0"/></radialGradient></defs>
    <circle class="sp-ff-glow" cx="20" cy="23" r="17" fill="url(#${id})"/>
    <g class="sp-wing sp-wing-a"><ellipse cx="15" cy="15" rx="6" ry="3.4" transform="rotate(-30 15 15)" fill="#e8f4ff" opacity=".7"/></g>
    <g class="sp-wing sp-wing-b"><ellipse cx="25" cy="15" rx="6" ry="3.4" transform="rotate(30 25 15)" fill="#e8f4ff" opacity=".7"/></g>
    <ellipse cx="20" cy="17" rx="3" ry="3.6" fill="#3a2f2a"/><ellipse cx="20" cy="24" rx="3.6" ry="5" fill="#f6ff9e"/><circle cx="20" cy="12.6" r="2.4" fill="#2b2320"/>
    <path d="M19 11c-1.5-2.5-3-3-4-3M21 11c1.5-2.5 3-3 4-3" stroke="#2b2320" stroke-width=".8" fill="none"/></svg>`,
  bird: (id) => `<svg viewBox="0 0 48 40"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6a82a8"/><stop offset="1" stop-color="#3a4a68"/></linearGradient></defs>
    <path d="M9 22l-7-3 2 6 6 1z" fill="#3a4a68"/>
    <ellipse cx="22" cy="23" rx="13" ry="10" fill="url(#${id})"/><ellipse cx="25" cy="27" rx="8" ry="5.5" fill="#c9d6e6"/>
    <circle cx="33" cy="17" r="7" fill="url(#${id})"/><circle cx="35.4" cy="15.8" r="1.7" fill="#fff"/><circle cx="35.8" cy="15.9" r="1" fill="#141a26"/>
    <path d="M39.5 17.5l6 1.5-6 2z" fill="#ffa53a"/><path d="M33 23.5c1.2.8 2.6.9 4 .2" stroke="#ff8fa8" stroke-width="1.2" stroke-linecap="round" fill="none" opacity=".7"/>
    <g class="sp-bird-wing"><path d="M22 20c-4-9-12-12-16-10 2 6 7 11 16 12z" fill="#55698e" stroke="#2c3954" stroke-width=".8"/><path d="M9 12c3 1 6 4 9 8" stroke="#8ea4c8" stroke-width="1" fill="none"/></g>
    <path d="M20 32l-1 4M25 33l0 4" stroke="#ffa53a" stroke-width="1.4" stroke-linecap="round"/></svg>`,
  butterfly: (id) => `<svg viewBox="0 0 48 40"><defs><radialGradient id="${id}" cx="50%" cy="60%" r="70%"><stop offset="0" stop-color="#fff2a0"/><stop offset=".4" stop-color="#ffb02e"/><stop offset=".8" stop-color="#ff4a12"/><stop offset="1" stop-color="#9a1606"/></radialGradient></defs>
    <g class="sp-bf-wings">
     <path d="M24 20C18 6 6 2 3 7c-3 6 4 12 21 13z" fill="url(#${id})"/>
     <path d="M24 20C30 6 42 2 45 7c3 6-4 12-21 13z" fill="url(#${id})"/>
     <path d="M24 21c-10 1-16 6-14 11 2 4 9 2 14-11z" fill="url(#${id})"/>
     <path d="M24 21c10 1 16 6 14 11-2 4-9 2-14-11z" fill="url(#${id})"/>
     <circle cx="11" cy="9" r="1.6" fill="#fff6c8"/><circle cx="37" cy="9" r="1.6" fill="#fff6c8"/>
    </g>
    <ellipse cx="24" cy="21" rx="1.6" ry="8" fill="#3a1408"/><path d="M23.4 13.5c-1-3-3-5-4.5-5.5M24.6 13.5c1-3 3-5 4.5-5.5" stroke="#3a1408" stroke-width=".8" fill="none"/></svg>`,
  mouse: (id) => `<svg viewBox="0 0 56 32"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9c8a78"/><stop offset="1" stop-color="#6a5a4c"/></linearGradient></defs>
    <path class="sp-ms-tail" d="M12 22c-6 0-10-3-11-8" stroke="#c49a8a" stroke-width="1.6" stroke-linecap="round" fill="none"/>
    <ellipse cx="24" cy="20" rx="13" ry="8.5" fill="url(#${id})"/>
    <path d="M34 15c5 0 11 3 13 6-2 2-7 3-12 2z" fill="url(#${id})"/>
    <circle cx="35" cy="11" r="5" fill="#8a7866"/><circle cx="35" cy="11" r="3" fill="#f0a6b4"/>
    <circle cx="42" cy="17" r="1.3" fill="#141012"/><circle cx="42.4" cy="16.6" r=".4" fill="#fff"/><circle cx="47.5" cy="20.6" r="1.3" fill="#e0707f"/>
    <path d="M46 21l6-2M46 22l6 1" stroke="#d8cfc4" stroke-width=".5"/>
    <g class="sp-ms-legs"><path class="sp-leg-a" d="M17 27l-1.5 3.5M31 27l1.5 3.5" stroke="#5a4a3e" stroke-width="2.2" stroke-linecap="round"/><path class="sp-leg-b" d="M20 27l1.5 3.5M28 27l-1.5 3.5" stroke="#4a3c32" stroke-width="2.2" stroke-linecap="round"/></g></svg>`
};

/** Bouts de butin dessinés (or, gemme, nourriture). */
function lootIcons(l: Loot, parent: boolean): HTMLElement[] {
  const out: HTMLElement[] = [];
  const gold = l.gold + (parent ? 25 * l.gems : 0);
  if (gold) out.push(h('span', { class: 'sp-chip' }, art(coinSvg, 'sp-ico'), `+${gold}`));
  if (l.gems && !parent) out.push(h('span', { class: 'sp-chip sp-chip-gem' }, art(gemSvg, 'sp-ico'), `+${l.gems}`));
  if (l.food) out.push(h('span', { class: 'sp-chip sp-chip-food' }, art(FOOD_SVG[l.food], 'sp-ico'), '+1'));
  return out;
}

// ---------------------------------------------------------------- Couche de la scène

function stageLayer(app: App): HTMLElement | null {
  const stage = app.root.querySelector<HTMLElement>('.stage-view') ?? document.querySelector<HTMLElement>('.stage-view');
  if (!stage) return null;
  let layer = stage.querySelector<HTMLElement>(':scope > .sp-layer');
  if (!layer) { layer = h('div', { class: 'sp-layer' }); stage.append(layer); }
  return layer;
}

/** Texte de butin qui monte et s'efface. */
function floatLoot(layer: HTMLElement, x: number, y: number, l: Loot, parent: boolean): void {
  const f = h('div', { class: 'sp-float' }, ...lootIcons(l, parent));
  f.style.left = `${Math.max(40, Math.min(layer.clientWidth - 40, x))}px`; f.style.top = `${Math.max(30, y)}px`;
  // Au-dessus des bulles du dragon (dans la scène, pas dans la couche des créatures).
  (layer.parentElement ?? layer).append(f);
  f.addEventListener('animationend', () => f.remove());
}

function toClient(app: App, x: number, y: number): { x: number; y: number } {
  const r = app.view.canvas.getBoundingClientRect();
  return { x: r.left + x, y: r.top + y };
}

// ---------------------------------------------------------------- Créatures et trouvailles

const CATCH_LINES: Record<VisitorKind, string[]> = {
  firefly: ['Attrapée ! Elle chatouille… et elle brille encore plus fort !', 'Une luciole ! On dirait une petite étoile tombée dans la grotte.'],
  bird: ['Bien joué ! Il chante pour te remercier, écoute !', 'Tu l’as eu ! Il est tout doux… ne dis pas que je l’ai trouvé appétissant.'],
  butterfly: ['Waouh, un papillon de feu ! Il ne brûle même pas, il réchauffe.', 'Tu as des réflexes de dragon ! Ses ailes sont des petites braises.'],
  mouse: ['Ha ! Elle était rapide, mais toi encore plus !', 'Une souris des roches ! Elle m’a laissé une miette en partant.']
};
const SEEN_LINES: Record<VisitorKind, string> = {
  firefly: 'Regarde ! Une luciole ! Attrape-la !',
  bird: 'Oh, un petit oiseau ! Vite, touche-le !',
  butterfly: 'Un papillon de feu ! Attrape-le avant qu’il s’envole !',
  mouse: 'Une souris des roches ! Attrape-la !'
};
const FEMININE: Record<VisitorKind, boolean> = { firefly: true, bird: false, butterfly: false, mouse: true };

export interface SurprisesDebug {
  /** Délai avant la (première) créature ; sans limite de 3 par jour quand il est fourni. */
  visitorDelayMs?: number;
  /** Délai avant la tentative de trouvaille à l'ouverture (9 s par défaut). */
  giftDelayMs?: number;
  /** Ignore le hasard et l'amitié pour la trouvaille. */
  forceGift?: boolean;
  /** Espèce imposée. */
  visitorKind?: VisitorKind;
}

export function installSurprises(app: App, debug: SurprisesDebug = {}): { stop(): void; tryGiftNow(): void; visitorNow(kind?: VisitorKind): void } {
  const s = surprisesFor(app);
  const parent = app.isParent;
  let stopped = false;
  let timer = 0;
  let visitor: { el: HTMLElement; raf: number; done: boolean } | null = null;
  let gift: HTMLElement | null = null;
  const started = Date.now();
  let openRolled = false;

  const canShow = () => !stopped && app.showingOwn && !app.sleeping && !app.visits.active && !document.hidden;

  // ----- Créature de passage -----
  const schedule = (ms: number) => { clearTimeout(timer); if (!stopped) timer = window.setTimeout(due, ms); };
  const due = () => {
    if (stopped) return;
    if (debug.visitorDelayMs === undefined && !s.visitorAllowed()) { schedule(30 * 60000); return; }
    if (!canShow() || visitor || gift) { schedule(20000); return; }
    spawn();
    schedule(debug.visitorDelayMs ?? s.nextVisitorDelay());
  };

  function spawn(force?: VisitorKind): void {
    const layer = stageLayer(app);
    if (!layer || visitor) return;
    const kind = force ?? debug.visitorKind ?? s.spawnVisitor();
    const W = layer.clientWidth, H = layer.clientHeight;
    const el = h('button', { class: `sp-visitor sp-v-${kind}`, 'aria-label': `Attraper ${VISITORS[kind].article}` });
    el.append(art(VISITOR_SVG[kind], 'sp-v-art'));
    layer.append(el);
    const fromLeft = Math.random() < 0.5;
    const dur = kind === 'mouse' ? 6200 : 7200;
    const x0 = fromLeft ? -50 : W + 50, x1 = fromLeft ? W + 50 : -50;
    const phase = Math.random() * Math.PI * 2;
    const t0 = performance.now();
    let lastTrail = 0, lastLook = 0, lastX = x0;
    const v = { el, raf: 0, done: false };
    visitor = v;
    if (Math.random() < 0.8) setTimeout(() => { if (!v.done) app.say(SEEN_LINES[kind], null, 2600); }, 700);

    const pos = (e: number): { x: number; y: number } => {
      switch (kind) {
        case 'firefly': {
          const x = x0 + (x1 - x0) * (0.5 - 0.5 * Math.cos(Math.PI * e)) + Math.sin(e * Math.PI * 4 + phase) * W * 0.12;
          const y = H * 0.48 + Math.sin(e * Math.PI * 5.4 + phase) * H * 0.13 + Math.cos(e * Math.PI * 11) * H * 0.03;
          return { x, y };
        }
        case 'bird': {
          const x = x0 + (x1 - x0) * e;
          const y = H * 0.34 + Math.sin(e * Math.PI) * H * 0.24 + Math.sin(e * Math.PI * 6 + phase) * H * 0.04;
          return { x, y };
        }
        case 'butterfly': {
          const x = x0 + (x1 - x0) * e + Math.sin(e * Math.PI * 3 + phase) * W * 0.08;
          const y = H * 0.52 + Math.sin(e * Math.PI * 2.6 + phase) * H * 0.13 + Math.sin(e * Math.PI * 23) * H * 0.015;
          return { x, y };
        }
        case 'mouse': {
          // Course par à-coups : la progression accélère et ralentit (toujours vers l'avant).
          const p = e + 0.045 * Math.sin(e * Math.PI * 2 * 3.5);
          return { x: x0 + (x1 - x0) * p, y: H * 0.88 - Math.abs(Math.sin(e * 70)) * 2 };
        }
      }
    };

    const leave = (caught: boolean) => {
      if (v.done) return;
      v.done = true;
      cancelAnimationFrame(v.raf);
      app.view.lookAt(null);
      if (caught) {
        el.classList.add('sp-caught');
        setTimeout(() => { el.remove(); if (visitor === v) visitor = null; }, 650);
      } else {
        el.remove();
        if (visitor === v) visitor = null;
        if (app.showingOwn && !app.sleeping) {
          const gone = FEMININE[kind] ? 'elle est partie' : 'il est parti';
          app.say(pick([`Oh… ${gone}. Ce n’est pas grave, il y en aura d’autres !`, `Oh… ${gone}. La prochaine fois, on sera plus rapides !`, `Oh… ${gone}. Je crois qu’${FEMININE[kind] ? 'elle' : 'il'} reviendra.`]), null, 3800);
        }
      }
    };

    el.addEventListener('pointerdown', e => {
      e.preventDefault(); e.stopPropagation();
      if (v.done) return;
      const r = layer.getBoundingClientRect();
      const lx = e.clientX - r.left, ly = e.clientY - r.top;
      leave(true);
      const loot = s.catchVisitor(kind);
      applyLoot(app, loot);
      app.view.burstAt(e.clientX, e.clientY, 'shine');
      app.view.burstAt(e.clientX, e.clientY, 'levelUpBurst');
      void Sound.play('chuff', { user: true });
      floatLoot(layer, lx, ly - 10, loot, parent);
      const label = VISITORS[kind].label;
      app.toast(loot.memory ? `Nouveau souvenir dans l’album : ${label} !` : `${label[0].toUpperCase()}${label.slice(1)} attrapé${FEMININE[kind] ? 'e' : ''} : ${lootText(loot, parent)}`);
      void app.act('happy');
      app.view.emit('hearts', 'head_anchor');
      app.say(pick(CATCH_LINES[kind]), null, 4500);
    });

    const frame = (now: number) => {
      if (v.done) return;
      if (!app.showingOwn || stopped) { leave(false); return; }
      const t = Math.min(1, (now - t0) / dur);
      const p = pos(t);
      const dir = p.x >= lastX ? 1 : -1; lastX = p.x;
      const tilt = kind === 'bird' ? Math.cos(t * Math.PI) * -12 * dir : kind === 'butterfly' ? Math.sin(t * 20) * 8 : 0;
      el.style.transform = `translate3d(${p.x}px, ${p.y}px, 0) translate(-50%, -50%) scaleX(${dir}) rotate(${tilt}deg)`;
      if ((kind === 'firefly' || kind === 'butterfly') && now - lastTrail > 45) {
        lastTrail = now;
        const d = h('span', { class: `sp-trail sp-trail-${kind}` });
        d.style.left = `${p.x + (Math.random() - 0.5) * 6}px`; d.style.top = `${p.y + (kind === 'butterfly' ? 4 : 6)}px`;
        layer.append(d);
        d.addEventListener('animationend', () => d.remove());
      }
      if (now - lastLook > 90) { lastLook = now; const c = toClient(app, p.x, p.y); app.view.lookAt(c.x, c.y); }
      if (t >= 1) { leave(false); return; }
      v.raf = requestAnimationFrame(frame);
    };
    v.raf = requestAnimationFrame(frame);
  }

  // ----- Trouvaille du dragon -----
  function showGift(loot: Loot): void {
    const layer = stageLayer(app);
    if (!layer || gift) return;
    const W = layer.clientWidth, H = layer.clientHeight;
    const paw = app.view.screenPos('front_leg_anchor');
    const body = app.view.screenPos('body_center');
    // Juste devant les pattes avant, du côté opposé au corps.
    const side = paw && body ? Math.sign(paw.x - body.x) || 1 : 1;
    const x = Math.max(48, Math.min(W - 48, (paw?.x ?? W * 0.5) + side * 44));
    const y = Math.max(60, Math.min(H - 30, (paw?.y ?? H * 0.8) + 16));
    const el = h('button', { class: 'sp-gift sp-drop', 'aria-label': 'Ouvrir le cadeau' },
      h('span', { class: 'sp-gift-halo' }),
      art(giftSvg, 'sp-gift-art'),
      ...[0, 1, 2].map(i => art(sparkSvg, `sp-twinkle sp-tw${i}`)),
      h('span', { class: 'sp-gift-hint' }, 'Touche-le !'));
    el.style.left = `${x}px`; el.style.top = `${y}px`;
    layer.append(el);
    gift = el;
    setTimeout(() => { el.classList.remove('sp-drop'); el.classList.add('sp-idle'); }, 900);
    setTimeout(() => app.view.burstAt(toClient(app, x, y).x, toClient(app, x, y).y, 'dust'), 520);
    void app.act('happy');
    app.view.lookAt(toClient(app, x, y).x, toClient(app, x, y).y);
    const name = app.family.companion?.name ?? (parent ? 'Ta dragonne' : 'Ton dragon');
    app.say(loot.story ?? 'Regarde ce que je t’ai trouvé !', null, 6500);

    let opened = false;
    el.addEventListener('pointerdown', e => {
      e.preventDefault(); e.stopPropagation();
      if (opened) return;
      opened = true;
      const l = s.openGift() ?? loot;
      el.classList.remove('sp-idle');
      el.classList.add('sp-opening');
      void Sound.play('chest', { user: true });
      const c = toClient(app, x, y - 20);
      setTimeout(() => {
        applyLoot(app, l);
        app.view.burstAt(c.x, c.y, 'shine');
        app.view.burstAt(c.x, c.y, 'evolutionBurst');
        floatLoot(layer, x, y - 40, l, parent);
        app.toast(`Cadeau de ${name} : ${lootText(l, parent)} !`);
        app.view.emit('hearts', 'head_anchor');
        app.say(pick(['Ça te plaît ? Je savais que ça te ferait plaisir !', 'C’est pour te dire merci d’être là.', 'Je chercherai encore demain, promis !']), null, 4000);
      }, 380);
      setTimeout(() => { el.remove(); if (gift === el) gift = null; app.view.lookAt(null); }, 1500);
    });
  }

  function tryGiftNow(): void {
    if (!canShow() || gift) return;
    const l = s.rollGift(debug.forceGift);
    if (l) setTimeout(() => { if (canShow()) showGift(l); }, 400);
  }

  // Surveillance : trouvaille à l'ouverture, cadeau caché quand on regarde un autre dragon.
  const watch = window.setInterval(() => {
    if (stopped) return;
    if (gift) gift.style.display = app.showingOwn ? '' : 'none';
    if (!openRolled && canShow() && Date.now() - started >= (debug.giftDelayMs ?? 9000)) { openRolled = true; tryGiftNow(); }
  }, 1000);

  schedule(debug.visitorDelayMs ?? s.nextVisitorDelay());

  return {
    stop(): void {
      stopped = true;
      clearTimeout(timer); clearInterval(watch);
      if (visitor) { visitor.done = true; cancelAnimationFrame(visitor.raf); visitor.el.remove(); visitor = null; }
      gift?.remove(); gift = null;
      app.view.lookAt(null);
    },
    tryGiftNow,
    visitorNow(kind?: VisitorKind): void { if (canShow()) spawn(kind); }
  };
}

// ---------------------------------------------------------------- Coffre du jour

function flames(streak: number, count = true): HTMLElement {
  const lit = streak === 0 ? 0 : ((streak - 1) % 7) + 1;
  return h('div', { class: 'sp-flames', 'aria-label': `Série de ${streak} jour${streak > 1 ? 's' : ''}` },
    ...Array.from({ length: 7 }, (_, i) => art(flameSvg, 'sp-flame' + (i < lit ? ' on' : ''))),
    count ? h('span', { class: 'sp-streak' }, streak ? `${streak} j` : '—') : null);
}

function sparkles(n: number, cls = 'sp-twinkle'): HTMLElement[] {
  return Array.from({ length: n }, (_, i) => art(sparkSvg, `${cls} sp-tw${i}`));
}

export function dailyChestCard(app: App): HTMLElement {
  const s = surprisesFor(app);
  const card = h('section', { class: 'card sp-chest-card' });
  const parent = app.isParent;

  const render = () => {
    const st = s.dailyChest();
    clear(card);
    card.classList.toggle('sp-ready', st.available);
    const open = () => openChestOverlay(app, render);
    const sub = parent
      ? (st.streak > 1 ? `Tu viens voir ta dragonne depuis ${st.streak} jours` : 'Reviens chaque jour : le trésor grandit')
      : (st.streak ? `Série de ${st.streak} jour${st.streak > 1 ? 's' : ''} parfait${st.streak > 1 ? 's' : ''}` : 'Fais toutes tes quêtes : le trésor grandit');
    card.append(
      h('button', { class: 'sp-chest-mini' + (st.available ? '' : ' sp-done'), 'aria-label': 'Coffre du jour', onclick: st.available ? open : null, disabled: !st.available },
        art(chestSvg, 'sp-chest-art'), ...(st.available ? sparkles(3) : [])),
      h('div', { class: 'sp-chest-info' },
        h('div', { class: 'sp-title' }, 'Coffre du jour'),
        flames(st.streak, false),
        h('div', { class: 'sp-sub' }, sub),
        h('div', { class: 'sp-preview' }, st.preview)),
      st.available
        ? h('button', { class: 'btn primary sp-open-btn', onclick: open }, 'Ouvrir')
        : h('div', { class: 'sp-later' }, art(moonSvg, 'sp-moon'), h('span', null, 'Reviens', h('br'), 'demain')));
  };
  render();
  app.family.book?.events.on('change', () => { if (card.isConnected) render(); });
  return card;
}

export function openChestOverlay(app: App, done: () => void): void {
  const s = surprisesFor(app);
  const parent = app.isParent;
  const streak = s.dailyChest().streak;
  const loot = s.openDailyChest();
  const chest = art(chestSvg, 'sp-big-chest');
  const fly = h('div', { class: 'sp-fly' });
  const totals = h('div', { class: 'sp-totals' });
  const closeBtn = h('button', { class: 'btn primary sp-close' }, 'Génial !');
  const ov = h('div', { class: 'sp-overlay', role: 'dialog', 'aria-label': 'Coffre du jour' },
    h('div', { class: 'sp-ov-card' },
      h('div', { class: 'sp-ov-title' }, 'Coffre du jour'),
      flames(streak),
      h('div', { class: 'sp-ov-stage' }, h('div', { class: 'sp-rays' }), chest, fly, ...sparkles(4)),
      totals,
      closeBtn));
  document.body.append(ov);
  requestAnimationFrame(() => ov.classList.add('sp-in'));

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    ov.classList.remove('sp-in');
    ov.classList.add('sp-out');
    setTimeout(() => ov.remove(), 350);
    done();
    if (app.showingOwn && !app.sleeping) { void app.act('happy'); app.view.emit('happySparkle', 'head_anchor'); }
  };
  closeBtn.addEventListener('click', close);

  setTimeout(() => chest.classList.add('sp-shake'), 450);
  setTimeout(() => {
    chest.classList.remove('sp-shake');
    ov.classList.add('sp-opened');
    void Sound.play('chest', { user: true });
    applyLoot(app, loot);
    // Pièces, gemme et nourriture qui jaillissent du coffre.
    const gold = loot.gold + (parent ? 25 * loot.gems : 0);
    const items: Array<{ svg: (id: string) => string; cls: string }> = [];
    for (let i = 0; i < Math.min(14, 4 + Math.round(gold / 5)); i++) items.push({ svg: coinSvg, cls: 'sp-fly-coin' });
    if (loot.gems && !parent) items.push({ svg: gemSvg, cls: 'sp-fly-gem' });
    if (loot.food) items.push({ svg: FOOD_SVG[loot.food], cls: 'sp-fly-food' });
    items.forEach((it, i) => {
      const el = art(it.svg, 'sp-fly-item ' + it.cls);
      fly.append(el);
      const big = it.cls !== 'sp-fly-coin';
      const ang = (-90 + (Math.random() - 0.5) * (big ? 50 : 150)) * Math.PI / 180;
      const dist = big ? 70 : 60 + Math.random() * 60;
      const dx = Math.cos(ang) * dist, dy = Math.sin(ang) * dist;
      const land = big ? dy - 10 : dy + 70 + Math.random() * 30;
      el.animate([
        { transform: 'translate(-50%, -50%) translate(0, 10px) scale(.3) rotate(0deg)', opacity: 0 },
        { transform: `translate(-50%, -50%) translate(${dx * 0.6}px, ${dy * 1.25}px) scale(1) rotate(${(Math.random() - 0.5) * 200}deg)`, opacity: 1, offset: 0.4 },
        { transform: `translate(-50%, -50%) translate(${dx * 1.2}px, ${land}px) scale(${big ? 1.25 : 0.85}) rotate(${(Math.random() - 0.5) * 400}deg)`, opacity: big ? 1 : 0 }
      ], { duration: big ? 900 : 1100 + Math.random() * 300, delay: i * 55 + (big ? 250 : 0), easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'forwards' });
    });
  }, 1350);

  setTimeout(() => {
    const gold = loot.gold + (parent ? 25 * loot.gems : 0);
    const goldVal = h('strong', null, '+0');
    const rows: HTMLElement[] = [h('div', { class: 'sp-total' }, art(coinSvg, 'sp-ico'), goldVal, h('span', null, 'pièces d’or'))];
    if (loot.gems && !parent) rows.push(h('div', { class: 'sp-total sp-total-gem' }, art(gemSvg, 'sp-ico'), h('strong', null, `+${loot.gems}`), h('span', null, loot.gems > 1 ? 'gemmes' : 'gemme')));
    if (loot.food) rows.push(h('div', { class: 'sp-total' }, art(FOOD_SVG[loot.food], 'sp-ico'), h('strong', null, '+1'), h('span', null, lootText({ ...loot, gold: 0, gems: 0 }).replace(/^(un|une|de la) /, ''))));
    const next = s.dailyChest().preview;
    put(totals, rows, h('div', { class: 'sp-tomorrow' }, next));
    totals.classList.add('sp-show');
    closeBtn.classList.add('sp-show');
    // Compteur d'or qui défile.
    const t0 = performance.now();
    const tick = (now: number) => {
      const k = Math.min(1, (now - t0) / 700);
      goldVal.textContent = `+${Math.round(gold * (1 - Math.pow(1 - k, 3)))}`;
      if (k < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    ov.addEventListener('pointerdown', e => { if (e.target === ov) close(); });
  }, 2300);
}

function put(el: HTMLElement, ...children: Array<HTMLElement | HTMLElement[]>): void {
  for (const c of children) Array.isArray(c) ? el.append(...c) : el.append(c);
}

// ---------------------------------------------------------------- Prochaine évolution

export function nextStageCard(app: App): HTMLElement {
  const st = app.state;
  const next = st.nextStage();
  const variant = app.isParent ? 'dragonne' : 'dragon';
  const card = h('section', { class: 'card sp-next-card' + (next ? '' : ' sp-ultimate') });
  const stageId = (next ?? st.stage).id;
  const src = Assets.dragonPart(stageId, 'full', variant) ?? `assets/${variant}/${stageId}/${variant}_${stageId}_full.webp`;
  const img = h('img', { class: 'sp-silhouette', src, alt: '', draggable: 'false' });
  const pic = h('div', { class: 'sp-next-pic' }, h('span', { class: 'sp-next-glow' }), img, ...sparkles(3));

  if (!next) {
    card.append(pic, h('div', { class: 'sp-next-info' },
      h('div', { class: 'sp-kicker' }, 'Évolution'),
      h('div', { class: 'sp-next-name' }, 'Stade ultime atteint'),
      h('div', { class: 'sp-sub' }, `${app.stageLabel(st.stage.label)} : la légende, c’est toi.`)));
    return card;
  }

  const lvl = st.data.level;
  let need = -st.data.xp;
  for (let l = lvl; l < next.minLevel; l++) need += st.xpToNext(l);
  need = Math.max(0, need);
  const levels = Math.max(0, next.minLevel - lvl);
  // Progression depuis le début du stade actuel.
  let span = 0;
  for (let l = st.stage.minLevel; l < next.minLevel; l++) span += st.xpToNext(l);
  const progress = span ? Math.max(0.02, Math.min(1, 1 - need / span)) : 0;

  const howMuch = app.family.book ? `${Math.round(progress * 100)} % du chemin` : `environ ${Math.max(1, Math.ceil(need / 100))} jour${Math.ceil(need / 100) > 1 ? 's' : ''} de soins`;
  const lvText = levels > 1 ? `Encore ${levels} niveaux` : levels === 1 ? 'Encore 1 niveau' : 'Presque !';
  card.append(pic, h('div', { class: 'sp-next-info' },
    h('div', { class: 'sp-kicker' }, 'Prochaine évolution'),
    h('div', { class: 'sp-next-name' }, '???'),
    h('div', { class: 'sp-next-count' }, `${lvText} · ${howMuch}`),
    h('div', { class: 'bar sp-next-bar' }, h('div', { class: 'fill', style: { width: `${Math.round(progress * 100)}%` } })),
    h('div', { class: 'sp-sub' }, progress > 0.8 ? 'Il se passe quelque chose… on sent une chaleur nouvelle.' : app.isParent ? 'Qui sera-t-elle ? Continue de prendre soin d’elle.' : 'Qui sera-t-il ? Continue, tu le découvriras.')));
  return card;
}

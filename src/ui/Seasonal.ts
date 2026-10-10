// Événements saisonniers, programmés à l'avance et lancés automatiquement selon la date du téléphone.
// Halloween : du lundi au dimanche de la semaine qui contient le 31 octobre (chaque année).
//  - citrouilles qui luisent et toiles d'araignée dans la grotte, chauves-souris dans la scène ;
//  - couleurs orange et violet ;
//  - chasse aux bonbons : chaque quête validée rapporte un bonbon ; 7 bonbons = le chaudron (or et gemmes) ;
//  - le dragon parle d'Halloween.
// Les citrouilles et toiles sont dessinées ; des illustrations peintes les remplacent si elles sont fournies
// (assets/events/halloween/pumpkin.webp, pumpkin_small.webp, cobweb.webp).
import { Assets } from '../engine/AssetManager.js';
import type { DecorItem } from '../engine/DecorLayer.js';
import type { App } from './App.js';
import { ICONS, h, icon } from './dom.js';
import { UI } from './Motion.js';
import { EVENTS, birthdayPicker, cardFor, datedEvent, decorFor, eggItems, isBirthday, lineFor, setFx, type EventKey } from './Events.js';

export type EventId = 'halloween' | EventKey;
const FORCE_KEY = 'quete-du-dragon:event-force';
const CANDY_GOAL = 7;

/** Semaine (lundi → dimanche) qui contient le 31 octobre de l'année de `d`. */
export function halloweenWeek(d = new Date()): { from: Date; to: Date } {
  const oct31 = new Date(d.getFullYear(), 9, 31);
  const dow = (oct31.getDay() + 6) % 7;          // lundi = 0
  const from = new Date(oct31); from.setDate(31 - dow); from.setHours(0, 0, 0, 0);
  const to = new Date(from); to.setDate(from.getDate() + 6); to.setHours(23, 59, 59, 999);
  return { from, to };
}

/** Événement en cours (ou forcé depuis le panneau développeur). */
export function currentEvent(now = new Date()): EventId | null {
  try { const f = localStorage.getItem(FORCE_KEY); if (f === 'off') return null; if (f && (f === 'halloween' || f in EVENTS)) return f as EventId; } catch { /* */ }
  const w = halloweenWeek(now);
  if (now >= w.from && now <= w.to) return 'halloween';
  return datedEvent(now);
}
/** Événement affiché sur ce téléphone : l'anniversaire de son propriétaire passe avant tout. */
export function activeEvent(app: App): EventId | null {
  try { if (localStorage.getItem(FORCE_KEY) === 'anniversaire') return 'anniversaire'; } catch { /* */ }
  return isBirthday(app) ? 'anniversaire' : currentEvent();
}
export function forceEvent(v: EventId | 'off' | null): void {
  try { if (v) localStorage.setItem(FORCE_KEY, v); else localStorage.removeItem(FORCE_KEY); } catch { /* */ }
}

// ---------- bonbons ----------
interface CandyState { candies: number; claimed: boolean }
const candyKey = () => `quete-du-dragon:halloween:${new Date().getFullYear()}`;
function candies(): CandyState { try { return JSON.parse(localStorage.getItem(candyKey()) ?? '') as CandyState; } catch { return { candies: 0, claimed: false }; } }
function saveCandies(c: CandyState): void { try { localStorage.setItem(candyKey(), JSON.stringify(c)); } catch { /* */ } }

// ---------- illustrations dessinées (en attendant les peintes) ----------
const drawn = new Map<string, string>();
function paint(key: string, w: number, hgt: number, draw: (g: CanvasRenderingContext2D) => void): string {
  let url = drawn.get(key);
  if (url) return url;
  const c = document.createElement('canvas'); c.width = w; c.height = hgt;
  draw(c.getContext('2d')!);
  url = c.toDataURL('image/png');
  drawn.set(key, url);
  return url;
}

function pumpkin(small: boolean): string {
  const painted = Assets.art(`events/halloween/${small ? 'pumpkin_small' : 'pumpkin'}`);
  if (painted) return painted;
  return paint(small ? 'pk-s' : 'pk', 320, 280, g => {
    const cx = 160, cy = 168, R = 118;
    // lobes
    const lobes = [-0.8, -0.42, 0, 0.42, 0.8];
    for (const k of [lobes[0], lobes[4], lobes[1], lobes[3], lobes[2]]) {
      const x = cx + k * R * 0.78, rx = R * (0.52 - Math.abs(k) * 0.12), ry = R * 0.8;
      const gr = g.createRadialGradient(x - rx * 0.3, cy - ry * 0.35, 4, x, cy, rx * 1.3);
      gr.addColorStop(0, '#ffb04a'); gr.addColorStop(0.6, '#e86e14'); gr.addColorStop(1, '#8a3405');
      g.fillStyle = gr; g.beginPath(); g.ellipse(x, cy, rx, ry, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(90,30,0,.55)'; g.lineWidth = 3; g.stroke();
    }
    // tige
    g.fillStyle = '#4f5a1e'; g.strokeStyle = '#2b3210'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(cx - 12, cy - R * 0.74); g.quadraticCurveTo(cx - 6, cy - R - 14, cx + 18, cy - R - 26); g.lineTo(cx + 24, cy - R - 16);
    g.quadraticCurveTo(cx + 8, cy - R - 2, cx + 12, cy - R * 0.74); g.closePath(); g.fill(); g.stroke();
    // visage creusé, éclairé de l'intérieur
    g.save();
    g.shadowColor = '#ffcf5a'; g.shadowBlur = 22;
    const glow = g.createRadialGradient(cx, cy, 6, cx, cy, R * 0.6);
    glow.addColorStop(0, '#fff2b0'); glow.addColorStop(1, '#ff9a20');
    g.fillStyle = glow;
    const eye = (x: number) => { g.beginPath(); g.moveTo(x - 22, cy - 6); g.lineTo(x, cy - 44); g.lineTo(x + 22, cy - 6); g.closePath(); g.fill(); };
    eye(cx - 44); eye(cx + 44);
    g.beginPath(); g.moveTo(cx - 70, cy + 22);
    const teeth = [[-52, 44], [-38, 30], [-22, 50], [-6, 34], [10, 52], [26, 34], [42, 50], [56, 30]];
    for (const [x, y] of teeth) g.lineTo(cx + x, cy + y);
    g.lineTo(cx + 70, cy + 22); g.quadraticCurveTo(cx, cy + 92, cx - 70, cy + 22); g.closePath(); g.fill();
    g.restore();
  });
}

function cobweb(): string {
  const painted = Assets.art('events/halloween/cobweb');
  if (painted) return painted;
  return paint('web', 300, 300, g => {
    g.strokeStyle = 'rgba(235,235,245,.55)'; g.lineWidth = 1.6;
    const rays = 7;
    const pts: Array<[number, number]> = [];
    for (let i = 0; i <= rays; i++) { const a = (i / rays) * Math.PI / 2; pts.push([Math.cos(a), Math.sin(a)]); }
    for (const [x, y] of pts) { g.beginPath(); g.moveTo(0, 0); g.lineTo(x * 300, y * 300); g.stroke(); }
    for (let r = 40; r < 300; r += 42) {
      g.beginPath();
      pts.forEach(([x, y], i) => { const px = x * r, py = y * r; if (!i) g.moveTo(px, py); else { const [qx, qy] = pts[i - 1]; g.quadraticCurveTo((qx + x) * r * 0.42, (qy + y) * r * 0.42, px, py); } });
      g.stroke();
    }
    g.fillStyle = '#16121c'; g.beginPath(); g.arc(118, 128, 9, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(235,235,245,.5)'; g.beginPath(); g.moveTo(118, 119); g.lineTo(96, 96); g.stroke();
  });
}

/** Objets de l'événement posés dans la scène (en plus de la grotte). */
export function eventDecor(app: App): DecorItem[] {
  if (!app.showingOwn) return [];
  const ev = activeEvent(app);
  if (ev && ev !== 'halloween') return [...decorFor(app, ev), ...(ev === 'paques' ? eggItems() : [])];
  if (ev !== 'halloween') return [];
  const glow = { x: 0.5, y: 0.55, r: 0.16, color: '255,150,40' };
  return [
    { key: 'event:pk1', img: pumpkin(false), dx: -0.2, dy: 0.035, w: 0.15, anchor: 'floor', light: glow },
    { key: 'event:pk2', img: pumpkin(true), dx: 0.31, dy: 0.055, w: 0.1, anchor: 'floor', light: { ...glow, r: 0.12 } },
    { key: 'event:pk3', img: pumpkin(true), dx: -0.37, dy: -0.01, w: 0.09, anchor: 'floor', flip: true, light: { ...glow, r: 0.1 } },
    { key: 'event:web1', img: cobweb(), dx: -0.33, dy: -0.95, w: 0.32, anchor: 'wall', behind: true },
    { key: 'event:web2', img: cobweb(), dx: 0.33, dy: -0.95, w: 0.32, anchor: 'wall', behind: true, flip: true }
  ];
}

const LINES = [
  'Des bonbons ou un sort ? Moi je choisis… les deux !',
  'Tu as vu ? Il y a des chauves-souris dans ma grotte !',
  'Les citrouilles brillent… j’adore Halloween !',
  'Chaque quête te rapporte un bonbon cette semaine. On remplit le chaudron ?',
  'Bouh ! … Je t’ai fait peur ? Un peu ?'
];

/** Thème, chauves-souris, bonbons à chaque quête validée, petite phrase de bienvenue. */
export function installSeasonal(app: App): void {
  const apply = () => {
    const ev = activeEvent(app);
    if (ev) document.documentElement.dataset.event = ev; else delete document.documentElement.dataset.event;
    app.view.decor.bats = ev === 'halloween' && app.showingOwn;
    setFx(app, ev && ev !== 'halloween' && app.showingOwn && app.currentId === 'dragon' ? EVENTS[ev].fx : null);
  };
  apply();
  setInterval(apply, 60000);
  app.family.book?.events.on('reward', r => {
    if (!r.mission || currentEvent() !== 'halloween') return;
    const c = candies();
    if (c.claimed) return;
    c.candies = Math.min(CANDY_GOAL, c.candies + 1);
    saveCandies(c);
    setTimeout(() => app.toast(c.candies >= CANDY_GOAL ? 'Le chaudron est plein ! Viens l’ouvrir.' : `+1 bonbon d’Halloween (${c.candies}/${CANDY_GOAL})`), 1400);
  });
  const ev0 = activeEvent(app);
  if (ev0 === 'halloween') setTimeout(() => app.say(LINES[Math.floor(Math.random() * LINES.length)], null, 6000), 7000);
  else if (ev0) setTimeout(() => app.say(lineFor(ev0), null, 7000), 7000);
  syncSeasonal = apply;
}
export let syncSeasonal: () => void = () => undefined;

/** Carte « Semaine d'Halloween » en tête du carrousel « À découvrir ». */
export function eventCard(app: App): HTMLElement | null {
  const ev = activeEvent(app);
  if (ev && ev !== 'halloween') return cardFor(app, ev);
  if (ev !== 'halloween') return null;
  const w = halloweenWeek();
  const days = Math.max(0, Math.ceil((w.to.getTime() - Date.now()) / 86400000));
  const preview = Date.now() < w.from.getTime() || Date.now() > w.to.getTime();   // forcé depuis le panneau développeur
  const book = app.family.book;
  const c = candies();
  const jars = h('div', { class: 'ev-candies' }, ...Array.from({ length: CANDY_GOAL }, (_, i) => h('i', { class: i < c.candies ? 'on' : '' })));
  const claim = () => {
    const s = candies();
    if (s.claimed || s.candies < CANDY_GOAL) return;
    s.claimed = true; saveCandies(s);
    app.state.addGold(150);
    book?.addGems(2, 'Chaudron d’Halloween');
    UI.success();
    app.view.emit('evolutionBurst', 'body_center');
    void app.act('roar');
    app.say('Joyeux Halloween ! 150 pièces d’or et 2 gemmes pour toi !', null, 6000);
    app.refresh();
  };
  return h('section', { class: 'card ev-card' },
    h('div', { class: 'ev-head' }, h('span', { class: 'ev-k' }, 'Événement'), h('span', { class: 'small' }, preview ? 'aperçu' : days > 1 ? `encore ${days} jours` : 'dernier jour !')),
    h('h3', null, 'La semaine d’Halloween'),
    book ? h('p', { class: 'small' }, c.claimed ? 'Chaudron ouvert : bravo ! Les citrouilles restent jusqu’à dimanche.' : `Chaque quête validée = un bonbon. ${CANDY_GOAL} bonbons remplissent le chaudron.`)
      : h('p', { class: 'small' }, 'Citrouilles, toiles et chauves-souris : la grotte se met à l’heure d’Halloween.'),
    book && !c.claimed ? jars : null,
    book && !c.claimed && c.candies >= CANDY_GOAL ? h('button', { class: 'btn primary', onclick: claim }, icon(ICONS.gift, 18), ' Ouvrir le chaudron') : null);
}

/** Première fois : demander la date d'anniversaire (le dragon veut la fêter). */
export function birthdayAskCard(app: App): HTMLElement | null {
  const st = app.state.data.settings;
  if (st.birthday || st.birthdayAsked || !app.family.companion) return null;
  const card = h('section', { class: 'card bd-card' },
    h('h3', null, 'Quand est ton anniversaire ?'),
    h('p', { class: 'small muted' }, `${app.family.companion.name} veut le fêter avec toi : décor, gâteau et cadeau le jour venu.`),
    birthdayPicker(app, () => app.refresh()),
    h('button', { class: 'btn ghost small-btn', onclick: () => { app.state.setComfort({ birthdayAsked: true }); app.refresh(); } }, 'Plus tard'));
  return card;
}

// Événements de l'année (en plus d'Halloween) : Noël, Nouvel An, Saint-Valentin, Pâques, début de l'été,
// et l'anniversaire du propriétaire du téléphone (date réglée dans le profil). Chacun a ses couleurs, son décor dans
// la grotte, une ambiance animée (neige, confettis, cœurs, lucioles) et un cadeau à ouvrir une fois par an.
// Les décors sont dessinés ; des illustrations peintes les remplacent si elles sont fournies :
// assets/events/<événement>/<objet>.webp (voir les noms dans DECOR ci-dessous).
import { Assets } from '../engine/AssetManager.js';
import type { DecorItem } from '../engine/DecorLayer.js';
import type { App } from './App.js';
import { ICONS, h, icon } from './dom.js';
import { UI } from './Motion.js';
import { floatReward } from './Reactions.js';
import { todayKey } from '../family/model.js';

export type DatedEvent = 'noel' | 'nouvelan' | 'valentin' | 'paques' | 'ete';
export type EventKey = DatedEvent | 'anniversaire';

const pad = (n: number) => String(n).padStart(2, '0');
const md = (d: Date) => `${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Dimanche de Pâques (calcul grégorien). */
function easter(y: number): Date {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const hh = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - hh - k) % 7, m = Math.floor((a + 11 * hh + 22 * l) / 451);
  const month = Math.floor((hh + l - 7 * m + 114) / 31), day = ((hh + l - 7 * m + 114) % 31) + 1;
  return new Date(y, month - 1, day);
}

/** Événement daté en cours (null s'il n'y en a pas). */
export function datedEvent(now = new Date()): DatedEvent | null {
  const k = md(now);
  if (k >= '12-15' && k <= '12-26') return 'noel';
  if (k >= '12-30' || k <= '01-02') return 'nouvelan';
  if (k >= '02-12' && k <= '02-15') return 'valentin';
  if (k >= '06-20' && k <= '06-26') return 'ete';
  const e = easter(now.getFullYear());
  const from = new Date(e); from.setDate(e.getDate() - 3);
  const to = new Date(e); to.setDate(e.getDate() + 1); to.setHours(23, 59, 59);
  if (now >= from && now <= to) return 'paques';
  return null;
}

/** Anniversaire aujourd'hui (réglage « MM-JJ » du téléphone). */
export function isBirthday(app: App, now = new Date()): boolean {
  const b = app.state.data.settings.birthday;
  return !!b && b === md(now);
}

interface EvDef { title: string; kicker: string; intro: string; lines: string[]; fx: 'snow' | 'confetti' | 'hearts' | 'fireflies' | 'eggs'; gift: { gold: number; gems: number; fruit?: boolean }; giftText: string }
export const EVENTS: Record<EventKey, EvDef> = {
  noel: { title: 'Noël dans la grotte', kicker: 'Noël', intro: 'Un sapin, des guirlandes et de la neige : la grotte se prépare pour Noël.',
    lines: ['Il neige dans ma grotte ! Tu as vu ?', 'J’ai décoré le sapin tout seul… enfin presque.', 'Il y a un paquet sous le sapin. Je crois qu’il est pour toi !'],
    fx: 'snow', gift: { gold: 150, gems: 3, fruit: true }, giftText: 'Le cadeau sous le sapin' },
  nouvelan: { title: 'Bonne année !', kicker: 'Nouvel An', intro: 'Confettis et feux de joie : on fête la nouvelle année ensemble.',
    lines: ['Bonne année ! Cette année, on va grandir ensemble.', 'J’ai fait un vœu : rester avec toi pour toujours.', 'Des confettis partout… j’adore !'],
    fx: 'confetti', gift: { gold: 100, gems: 2 }, giftText: 'Le cadeau de la nouvelle année' },
  valentin: { title: 'La Saint-Valentin', kicker: 'Saint-Valentin', intro: 'Des cœurs partout dans la grotte. Envoie un câlin à l’autre dragon !',
    lines: ['Je t’aime fort, tu sais.', 'Des cœurs partout… c’est la fête de l’amour !', 'Et si on envoyait un câlin à l’autre dragon ?'],
    fx: 'hearts', gift: { gold: 60, gems: 1 }, giftText: 'Une boîte en forme de cœur' },
  paques: { title: 'La chasse aux œufs', kicker: 'Pâques', intro: 'Des œufs sont cachés dans la grotte chaque jour : touche-les pour les ramasser !',
    lines: ['Il y a des œufs cachés dans la grotte… tu les trouves ?', 'Le loup en a déjà vu un derrière un rocher !', 'Un œuf, deux œufs… encore !'],
    fx: 'eggs', gift: { gold: 50, gems: 1 }, giftText: 'Le panier de Pâques' },
  ete: { title: 'Le début de l’été', kicker: 'Été', intro: 'Les journées sont longues et les lucioles dansent le soir dans la grotte.',
    lines: ['Il fait chaud ! Une baignade au lac, ça te dit ?', 'Regarde les lucioles…', 'Les grandes vacances arrivent bientôt !'],
    fx: 'fireflies', gift: { gold: 80, gems: 1 }, giftText: 'Le coffre de l’été' },
  anniversaire: { title: 'Joyeux anniversaire !', kicker: 'Anniversaire', intro: 'Aujourd’hui, c’est ton jour. Ton dragon a tout préparé.',
    lines: ['Joyeux anniversaire ! C’est le plus beau jour de l’année.', 'J’ai fait un gâteau. Bon… le loup a goûté un peu.', 'Souffle tes bougies… moi je peux t’aider, je suis un dragon !'],
    fx: 'confetti', gift: { gold: 200, gems: 3, fruit: true }, giftText: 'Ton cadeau d’anniversaire' }
};

// ---------------- Dessins (remplacés par des illustrations peintes si elles existent) ----------------
const drawn = new Map<string, string>();
function paint(key: string, w: number, hh: number, draw: (g: CanvasRenderingContext2D) => void): string {
  let url = drawn.get(key);
  if (url) return url;
  const c = document.createElement('canvas'); c.width = w; c.height = hh;
  draw(c.getContext('2d')!);
  url = c.toDataURL('image/png');
  drawn.set(key, url);
  return url;
}
const art = (ev: string, name: string, fallback: () => string) => Assets.art(`events/${ev}/${name}`) ?? fallback();

function ball(g: CanvasRenderingContext2D, x: number, y: number, r: number, c: string): void {
  const gr = g.createRadialGradient(x - r * 0.35, y - r * 0.35, 1, x, y, r);
  gr.addColorStop(0, '#fff'); gr.addColorStop(0.35, c); gr.addColorStop(1, 'rgba(0,0,0,.6)');
  g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
}

const tree = () => paint('tree', 260, 360, g => {
  g.fillStyle = '#4a2e17'; g.fillRect(116, 300, 28, 50);
  for (let i = 0; i < 4; i++) {
    const y = 60 + i * 62, w = 70 + i * 34;
    const gr = g.createLinearGradient(0, y, 0, y + 90); gr.addColorStop(0, '#2f7a45'); gr.addColorStop(1, '#14452a');
    g.fillStyle = gr; g.beginPath(); g.moveTo(130, y - 30); g.quadraticCurveTo(130 - w * 0.4, y + 40, 130 - w, y + 92); g.lineTo(130 + w, y + 92); g.quadraticCurveTo(130 + w * 0.4, y + 40, 130, y - 30); g.fill();
  }
  g.strokeStyle = '#f2c14e'; g.lineWidth = 3;
  for (const [y, w] of [[120, 60], [185, 95], [250, 125]] as const) { g.beginPath(); g.moveTo(130 - w, y); g.quadraticCurveTo(130, y + 26, 130 + w, y - 6); g.stroke(); }
  const cols = ['#e2463c', '#3c7de2', '#f2c14e', '#c94ce2'];
  [[100, 140], [160, 150], [80, 205], [130, 215], [185, 200], [60, 275], [110, 285], [170, 280], [215, 270]].forEach(([x, y], i) => ball(g, x, y, 10, cols[i % 4]));
  g.fillStyle = '#ffd76a'; g.shadowColor = '#ffd76a'; g.shadowBlur = 16;
  g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 11 : 26; g.lineTo(130 + Math.cos(a) * r, 34 + Math.sin(a) * r); } g.fill();
});
const presents = () => paint('presents', 220, 130, g => {
  const box = (x: number, y: number, w: number, hh: number, c: string, rib: string) => {
    g.fillStyle = c; g.fillRect(x, y, w, hh); g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(x + w * 0.6, y, w * 0.4, hh);
    g.fillStyle = rib; g.fillRect(x + w / 2 - 5, y, 10, hh); g.fillRect(x, y + hh * 0.3, w, 9);
    g.strokeStyle = rib; g.lineWidth = 6; g.beginPath(); g.ellipse(x + w / 2 - 12, y - 8, 12, 7, -0.4, 0, Math.PI * 2); g.ellipse(x + w / 2 + 12, y - 8, 12, 7, 0.4, 0, Math.PI * 2); g.stroke();
  };
  box(10, 50, 90, 76, '#b8262f', '#f2c14e'); box(110, 66, 70, 60, '#2a5fb0', '#f4f0e6'); box(70, 92, 56, 36, '#2f7a45', '#e2463c');
});
const lights = (colors: string[]) => paint('lights-' + colors.join(), 600, 120, g => {
  g.strokeStyle = '#2a2018'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, 20); g.quadraticCurveTo(150, 90, 300, 30); g.quadraticCurveTo(450, 90, 600, 20); g.stroke();
  for (let i = 1; i < 16; i++) {
    const t = i / 16, x = t * 600, half = t < 0.5 ? t * 2 : (t - 0.5) * 2;
    const y = (t < 0.5 ? 20 : 30) + Math.sin(half * Math.PI) * 48 + 10;
    g.shadowColor = colors[i % colors.length]; g.shadowBlur = 14; g.fillStyle = colors[i % colors.length];
    g.beginPath(); g.ellipse(x, y, 7, 10, 0, 0, Math.PI * 2); g.fill();
  }
});
const bunting = (text: string, colors: string[]) => paint('bunting-' + text, 640, 170, g => {
  g.strokeStyle = '#d9c7a0'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, 14); g.quadraticCurveTo(320, 70, 640, 14); g.stroke();
  for (let i = 0; i < 12; i++) {
    const x = 20 + i * 52, y = 14 + Math.sin(((x) / 640) * Math.PI) * 40;
    g.fillStyle = colors[i % colors.length]; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 44, y + 2); g.lineTo(x + 22, y + 46); g.fill();
  }
  g.font = 'bold 46px Georgia, serif'; g.textAlign = 'center'; g.fillStyle = '#ffe3a0'; g.shadowColor = 'rgba(0,0,0,.7)'; g.shadowBlur = 8;
  g.fillText(text, 320, 150);
});
const roses = () => paint('roses', 200, 200, g => {
  g.strokeStyle = '#2f6a35'; g.lineWidth = 6;
  [[100, 190, 70, 70], [100, 190, 100, 50], [100, 190, 135, 75]].forEach(([x1, y1, x2, y2]) => { g.beginPath(); g.moveTo(x1, y1); g.quadraticCurveTo(x1, (y1 + y2) / 2, x2, y2); g.stroke(); });
  for (const [x, y] of [[70, 66], [100, 46], [135, 72]]) {
    const gr = g.createRadialGradient(x - 6, y - 6, 2, x, y, 26); gr.addColorStop(0, '#ff7a8a'); gr.addColorStop(1, '#8a0f24');
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, 24, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(60,0,10,.5)'; g.lineWidth = 2; g.beginPath(); g.arc(x, y, 12, 0.5, 5); g.stroke();
  }
});
const heartsGarland = () => paint('hearts-garland', 600, 110, g => {
  g.strokeStyle = '#e8b4c0'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, 12); g.quadraticCurveTo(300, 70, 600, 12); g.stroke();
  for (let i = 1; i < 12; i++) {
    const x = i * 50, y = 12 + Math.sin((x / 600) * Math.PI) * 28 + 22, s = 14;
    g.fillStyle = i % 2 ? '#e2465c' : '#ff9ab0';
    g.beginPath(); g.moveTo(x, y + s * 0.9); g.bezierCurveTo(x - s * 1.6, y - s * 0.2, x - s * 0.6, y - s * 1.3, x, y - s * 0.4); g.bezierCurveTo(x + s * 0.6, y - s * 1.3, x + s * 1.6, y - s * 0.2, x, y + s * 0.9); g.fill();
  }
});
function eggImg(i: number): string {
  const cols = [['#ffd56a', '#e2463c'], ['#8fd6f2', '#2a5fb0'], ['#c9a2f2', '#6a2fb0'], ['#9ee28f', '#2f7a45'], ['#ffb38a', '#c94c1e']][i % 5];
  return paint('egg' + i, 90, 120, g => {
    const gr = g.createLinearGradient(0, 0, 90, 120); gr.addColorStop(0, cols[0]); gr.addColorStop(1, cols[1]);
    g.fillStyle = gr; g.beginPath(); g.moveTo(45, 6); g.bezierCurveTo(85, 10, 92, 110, 45, 114); g.bezierCurveTo(-2, 110, 5, 10, 45, 6); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 5; g.beginPath(); g.moveTo(10, 58); for (let x = 10; x <= 80; x += 10) g.lineTo(x, x % 20 ? 50 : 66); g.stroke();
    g.fillStyle = 'rgba(255,255,255,.4)'; g.beginPath(); g.ellipse(30, 32, 9, 14, -0.4, 0, Math.PI * 2); g.fill();
  });
}
const cake = () => paint('cake', 220, 230, g => {
  g.fillStyle = '#e8dcc8'; g.beginPath(); g.ellipse(110, 210, 100, 16, 0, 0, Math.PI * 2); g.fill();
  const tier = (y: number, w: number, hh: number, c: string) => { g.fillStyle = c; g.fillRect(110 - w / 2, y, w, hh); g.fillStyle = '#fff4f0'; g.beginPath(); g.ellipse(110, y, w / 2, 10, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#ff9ab0'; for (let x = 110 - w / 2 + 8; x < 110 + w / 2; x += 18) { g.beginPath(); g.arc(x, y + 6, 6, 0, Math.PI); g.fill(); } };
  tier(140, 170, 64, '#8a4a2a'); tier(90, 120, 52, '#a85f38');
  for (const x of [80, 100, 120, 140]) {
    g.fillStyle = ['#3c7de2', '#e2463c', '#f2c14e', '#2f9a55'][(x / 20) % 4]; g.fillRect(x - 3, 52, 6, 38);
    g.fillStyle = '#ffd76a'; g.shadowColor = '#ffb24a'; g.shadowBlur = 14; g.beginPath(); g.ellipse(x, 44, 5, 9, 0, 0, Math.PI * 2); g.fill(); g.shadowBlur = 0;
  }
});
const balloons = () => paint('balloons', 200, 300, g => {
  const b = (x: number, y: number, c: string) => { g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 2; g.beginPath(); g.moveTo(x, y + 44); g.quadraticCurveTo(x + 12, y + 140, 100, 290); g.stroke();
    const gr = g.createRadialGradient(x - 12, y - 14, 4, x, y, 46); gr.addColorStop(0, '#fff'); gr.addColorStop(0.3, c); gr.addColorStop(1, 'rgba(0,0,0,.5)');
    g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, 36, 44, 0, 0, Math.PI * 2); g.fill(); };
  b(56, 70, '#e2463c'); b(144, 60, '#3c7de2'); b(100, 110, '#f2c14e');
});

/** Texte seul (les banderoles peintes n'ont pas d'inscription). */
const caption = (text: string) => paint('caption-' + text, 640, 80, g => {
  g.font = 'bold 50px Georgia, serif'; g.textAlign = 'center'; g.fillStyle = '#ffe3a0'; g.shadowColor = 'rgba(0,0,0,.85)'; g.shadowBlur = 10;
  g.fillText(text, 320, 58);
});
const pa = (ev: string, name: string) => Assets.art(`events/${ev}/${name}`);

/** Objets de l'événement posés dans la scène (illustrations peintes si présentes, sinon dessin). */
export function decorFor(app: App, ev: EventKey): DecorItem[] {
  void app;
  const warm = { x: 0.5, y: 0.4, r: 0.2, color: '255,200,120' };
  const year = new Date().getMonth() === 11 ? new Date().getFullYear() + 1 : new Date().getFullYear();
  /** Banderole : peinte (sans texte) + inscription à part, ou dessinée avec son texte. */
  const banner = (evk: string, text: string, colors: string[]): DecorItem[] => {
    const p = pa(evk, 'banniere');
    if (!p) return [{ key: 'event:banner', img: bunting(text, colors), dx: 0.13, dy: -0.8, w: 0.62, anchor: 'wall', behind: true }];
    return [
      { key: 'event:banner', img: p, dx: evk === 'nouvelan' ? 0.27 : 0.15, dy: -0.75, w: evk === 'nouvelan' ? 0.34 : 0.42, anchor: 'wall', behind: true },
      { key: 'event:caption', img: caption(text), dx: 0.13, dy: -0.57, w: 0.56, anchor: 'wall', behind: true }];
  };
  switch (ev) {
    case 'noel': return [
      { key: 'event:tree', img: art('noel', 'sapin', tree), dx: 0.43, dy: -0.07, w: 0.17, anchor: 'floor', behind: true, light: { x: 0.5, y: 0.3, r: 0.22, color: '255,215,120' } },
      { key: 'event:presents', img: art('noel', 'cadeaux', presents), dx: -0.2, dy: -0.1, w: pa('noel', 'cadeaux') ? 0.09 : 0.1, anchor: 'floor', behind: true },
      pa('noel', 'guirlande')
        ? { key: 'event:lights', img: pa('noel', 'guirlande')!, dx: 0.15, dy: -0.74, w: 0.42, anchor: 'wall', behind: true, light: { x: 0.5, y: 0.5, r: 0.3, color: '255,220,150' } }
        : { key: 'event:lights', img: lights(['#e2463c', '#f2c14e', '#3cc2e2', '#7be27a']), dx: 0.13, dy: -0.8, w: 0.62, anchor: 'wall', behind: true }];
    case 'nouvelan': return [
      ...banner('nouvelan', `Bonne année ${year} !`, ['#f2c14e', '#e8e8f0', '#c9a2f2']),
      pa('nouvelan', 'guirlande')
        ? { key: 'event:lights', img: pa('nouvelan', 'guirlande')!, dx: -0.03, dy: -0.75, w: 0.28, anchor: 'wall', behind: true, light: { x: 0.5, y: 0.6, r: 0.2, color: '255,230,160' } }
        : { key: 'event:lights', img: lights(['#f2c14e', '#ffffff']), dx: 0, dy: -0.62, w: 0.75, anchor: 'wall', behind: true },
      ...(pa('nouvelan', 'coupe') ? [{ key: 'event:glass', img: pa('nouvelan', 'coupe')!, dx: 0.37, dy: -0.14, w: 0.08, anchor: 'floor' as const, behind: true, light: { x: 0.5, y: 0.3, r: 0.12, color: '255,230,150' } }] : [])];
    case 'valentin': return [
      pa('valentin', 'guirlande')
        ? { key: 'event:hearts', img: pa('valentin', 'guirlande')!, dx: 0.15, dy: -0.75, w: 0.42, anchor: 'wall', behind: true }
        : { key: 'event:hearts', img: heartsGarland(), dx: 0, dy: -0.8, w: 0.8, anchor: 'wall', behind: true },
      { key: 'event:roses', img: art('valentin', 'roses', roses), dx: pa('valentin', 'roses') ? 0.37 : 0.44, dy: pa('valentin', 'roses') ? -0.14 : -0.05, w: 0.1, anchor: 'floor', behind: true, light: { x: 0.5, y: 0.3, r: 0.14, color: '255,120,150' } },
      ...(pa('valentin', 'coeur') ? [{ key: 'event:heart', img: pa('valentin', 'coeur')!, dx: -0.3, dy: -0.42, w: 0.08, anchor: 'wall' as const, behind: true, light: { x: 0.5, y: 0.5, r: 0.14, color: '255,110,170' } }] : [])];
    case 'paques': return pa('paques', 'panier')
      ? [{ key: 'event:basket', img: pa('paques', 'panier')!, dx: 0.37, dy: -0.14, w: 0.13, anchor: 'floor', behind: true }]
      : [];   // les œufs à chercher sont ajoutés par eggItems()
    case 'ete': return [
      { key: 'event:lanterns', img: pa('ete', 'lanternes') ?? 'assets/decor/lanterns.webp', dx: pa('ete', 'lanternes') ? 0.15 : 0, dy: pa('ete', 'lanternes') ? -0.76 : -0.85, w: pa('ete', 'lanternes') ? 0.36 : 0.6, anchor: 'wall', behind: true, light: { x: 0.5, y: 0.6, r: 0.3, color: '255,200,110' } },
      ...(pa('ete', 'lucioles') ? [{ key: 'event:jar', img: pa('ete', 'lucioles')!, dx: 0.37, dy: -0.14, w: 0.075, anchor: 'floor' as const, behind: true, light: { x: 0.5, y: 0.5, r: 0.16, color: '255,220,110' } }] : []),
      ...(pa('ete', 'coquillage') ? [{ key: 'event:shell', img: pa('ete', 'coquillage')!, dx: 0.27, dy: -0.01, w: 0.065, anchor: 'floor' as const, front: true }] : [])];
    case 'anniversaire': return [
      ...banner('anniversaire', 'Joyeux anniversaire !', ['#e2463c', '#3c7de2', '#f2c14e', '#2f9a55', '#c94ce2']),
      { key: 'event:cake', img: art('anniversaire', 'gateau', cake), dx: 0.37, dy: -0.14, w: 0.11, anchor: 'floor', behind: true, light: warm },
      { key: 'event:balloons', img: art('anniversaire', 'ballons', balloons), dx: -0.3, dy: -0.35, w: 0.14, anchor: 'wall', behind: true }];
  }
}

// ---------------- Données : cadeaux ouverts, œufs trouvés ----------------
const KEY = 'quete-du-dragon:events';
interface EvData { claimed: Record<string, number>; eggs: { day: string; found: number[] } }
function load(): EvData { try { return { claimed: {}, eggs: { day: '', found: [] }, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }; } catch { return { claimed: {}, eggs: { day: '', found: [] } }; } }
function save(d: EvData): void { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch { /* */ } }
const claimKey = (ev: EventKey) => `${ev}-${ev === 'nouvelan' && new Date().getMonth() === 11 ? new Date().getFullYear() + 1 : new Date().getFullYear()}`;

// ---------------- Pâques : 5 œufs cachés par jour ----------------
const EGG_SPOTS: Array<[number, number]> = [[-0.44, -0.02], [0.44, -0.1], [-0.22, -0.16], [0.18, -0.2], [-0.05, 0.01]];
export function eggItems(): DecorItem[] {
  const d = load();
  const found = d.eggs.day === todayKey() ? d.eggs.found : [];
  return EGG_SPOTS.map(([dx, dy], i) => ({ i, dx, dy })).filter(e => !found.includes(e.i))
    .map(e => ({ key: `egg:${e.i}`, img: Assets.art(`events/paques/oeuf${e.i + 1}`) ?? eggImg(e.i), dx: e.dx, dy: e.dy, w: 0.045, anchor: 'floor' as const, debris: true, front: true }));
}
/** Un œuf ramassé : un peu d'or ; les 5 du jour donnent une gemme (côté enfant) ou de l'XP (côté parent). */
export function pickEgg(app: App, key: string): void {
  const d = load();
  if (d.eggs.day !== todayKey()) d.eggs = { day: todayKey(), found: [] };
  const i = Number(key.split(':')[1]);
  if (d.eggs.found.includes(i)) return;
  d.eggs.found.push(i);
  save(d);
  app.state.addGold(5);
  floatReward(app, 0, 5);
  UI.tick();
  if (d.eggs.found.length >= EGG_SPOTS.length) {
    if (app.family.book) app.family.book.addGems(1, 'Chasse aux œufs'); else app.state.addXp(15);
    app.toast('Tous les œufs du jour sont trouvés !');
    void app.act('happy');
  } else app.toast(`Œuf trouvé ! (${d.eggs.found.length} / ${EGG_SPOTS.length})`);
}

// ---------------- Carte de l'événement ----------------
export function cardFor(app: App, ev: EventKey): HTMLElement {
  const def = EVENTS[ev];
  const d = load();
  const claimed = !!d.claimed[claimKey(ev)];
  const book = app.family.book;
  const gift = () => {
    const s = load();
    if (s.claimed[claimKey(ev)]) return;
    s.claimed[claimKey(ev)] = Date.now(); save(s);
    app.state.addGold(def.gift.gold);
    if (def.gift.gems && book) book.addGems(def.gift.gems, def.giftText);
    if (def.gift.fruit && app.family.companion) { app.family.companion.data.food.fireFruit = (app.family.companion.data.food.fireFruit ?? 0) + 1; app.family.companion.save(); }
    if (ev === 'anniversaire') app.family.companion?.remember('birthday-' + new Date().getFullYear(), `Anniversaire ${new Date().getFullYear()}`, `${app.family.companion.name} a fêté ton anniversaire avec toi.`);
    UI.success();
    app.view.emit('evolutionBurst', 'body_center');
    void app.act('roar');
    floatReward(app, 0, def.gift.gold, 300);
    const bits = [`${def.gift.gold} or`, def.gift.gems && book ? `${def.gift.gems} gemme${def.gift.gems > 1 ? 's' : ''}` : '', def.gift.fruit ? 'un fruit de feu' : ''].filter(Boolean);
    app.say(`${def.giftText} : ${bits.join(', ')} !`, null, 6000);
    app.refresh();
  };
  const eggsLeft = ev === 'paques' ? eggItems().length : 0;
  return h('section', { class: `card ev-card ev-${ev}` },
    h('div', { class: 'ev-head' }, h('span', { class: 'ev-k' }, def.kicker), ev === 'paques' ? h('span', { class: 'small' }, `${EGG_SPOTS.length - eggsLeft} / ${EGG_SPOTS.length} œufs aujourd’hui`) : null),
    h('h3', null, def.title),
    h('p', { class: 'small' }, def.intro),
    claimed ? h('p', { class: 'small muted' }, `${def.giftText} : déjà ouvert. Bonne fête !`)
      : h('button', { class: 'btn primary', onclick: gift }, icon(ICONS.gift, 16), ` ${def.giftText}`));
}

/** Petite phrase de l'événement. */
export function lineFor(ev: EventKey): string { const l = EVENTS[ev].lines; return l[Math.floor(Math.random() * l.length)]; }

// ---------------- Ambiance animée (neige, confettis, cœurs, lucioles) ----------------
let fxLayer: HTMLElement | null = null;
let fxKind = '';
export function setFx(app: App, kind: EvDef['fx'] | null): void {
  const host = app.root.querySelector<HTMLElement>('.stage-view');
  if (!host) return;
  const k = kind === 'eggs' ? '' : kind ?? '';
  if (k === fxKind && (!k || fxLayer?.isConnected)) return;
  fxLayer?.remove(); fxLayer = null; fxKind = k;
  if (!k) return;
  const n = k === 'snow' ? 34 : k === 'confetti' ? 30 : k === 'hearts' ? 14 : 18;
  const cols = ['#e2463c', '#f2c14e', '#3c7de2', '#2f9a55', '#c94ce2', '#ffffff'];
  fxLayer = h('div', { class: `ev-fx ev-fx-${k}`, 'aria-hidden': 'true' },
    ...Array.from({ length: n }, (_, i) => {
      const s = h('i');
      s.style.left = `${Math.random() * 100}%`;
      s.style.animationDelay = `${-Math.random() * 12}s`;
      s.style.animationDuration = `${(k === 'fireflies' ? 5 : k === 'hearts' ? 9 : 8) + Math.random() * 6}s`;
      if (k === 'confetti') s.style.background = cols[i % cols.length];
      if (k === 'fireflies') s.style.top = `${30 + Math.random() * 55}%`;
      const sz = k === 'snow' ? 2 + Math.random() * 4 : k === 'hearts' ? 8 + Math.random() * 8 : 0;
      if (sz) { s.style.width = `${sz}px`; s.style.height = `${sz}px`; }
      return s;
    }));
  host.append(fxLayer);
}

/** Réglage de la date d'anniversaire : jour + mois. */
export function birthdayPicker(app: App, onDone?: () => void): HTMLElement {
  const cur = app.state.data.settings.birthday ?? '';
  const [m0, d0] = cur ? cur.split('-').map(Number) : [0, 0];
  const day = h('select', { 'aria-label': 'Jour' }, h('option', { value: '' }, 'Jour'), ...Array.from({ length: 31 }, (_, i) => h('option', { value: String(i + 1), selected: i + 1 === d0 }, String(i + 1)))) as HTMLSelectElement;
  const months = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  const month = h('select', { 'aria-label': 'Mois' }, h('option', { value: '' }, 'Mois'), ...months.map((mm, i) => h('option', { value: String(i + 1), selected: i + 1 === m0 }, mm))) as HTMLSelectElement;
  const set = () => {
    if (!day.value || !month.value) return;
    app.state.setComfort({ birthday: `${pad(+month.value)}-${pad(+day.value)}`, birthdayAsked: true });
    app.toast('Anniversaire enregistré : ton dragon s’en souviendra !');
    app.family.duo?.queueProfile(500);
    onDone?.();
  };
  day.onchange = set; month.onchange = set;
  return h('div', { class: 'bd-picker' }, day, month);
}

/** C'est l'anniversaire de l'autre membre de la famille : une carte pour le lui souhaiter (câlin). */
export function friendBirthdayCard(app: App): HTMLElement | null {
  const duo = app.family.duo, f = duo?.friend();
  if (!duo || !f?.birthday || f.birthday !== md(new Date())) return null;
  return h('section', { class: 'card ev-card ev-anniversaire' },
    h('div', { class: 'ev-head' }, h('span', { class: 'ev-k' }, 'Anniversaire')),
    h('h3', null, `C’est l’anniversaire de ${f.owner} !`),
    h('p', { class: 'small' }, `${f.name} fait la fête aujourd’hui. Envoie un câlin ou un cadeau caché pour le lui souhaiter.`),
    h('button', { class: 'btn primary', disabled: !duo.hugsLeft(), onclick: async () => {
      const r = await duo.sendHug();
      if (r === 'ok') { app.view.emit('hearts', 'head_anchor'); app.say(`Joyeux anniversaire, ${f.owner} ! Je lui envoie un gros câlin.`, null, 5000); app.refresh(); }
    } }, icon(ICONS.heart, 16), ' Souhaiter (câlin)'));
}

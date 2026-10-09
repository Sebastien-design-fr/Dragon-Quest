// Voyages du dragon (octobre 2026) : il part explorer de 1 à 8 heures et revient avec des trouvailles
// (or, nourriture, parfois un fruit de feu) et une petite histoire. Les pas faits pendant son absence
// raccourcissent le voyage. Sans lien avec les quêtes : ni XP, ni gemmes.
import { EventBus } from '../core/events.js';
import type { GameState } from '../game/GameState.js';
import { readStore, writeStore } from '../platform/storage.js';
import type { Activity } from './Activity.js';
import type { Companion, FoodId } from './Companion.js';
import { todayKey } from './model.js';

export interface Destination {
  id: string; name: string; hours: number; colors: [string, string]; teaser: string;
  /** Histoires du retour : {n} = nom du dragon. */
  stories: string[];
  /** Trouvailles possibles (nourriture) et chance de fruit de feu. */
  foods: FoodId[]; fruit: number;
}

export const DESTINATIONS: Destination[] = [
  { id: 'foret', name: 'La forêt des brumes', hours: 1, colors: ['#7fb38a', '#1d2b22'], teaser: 'Une petite balade sous les grands arbres.',
    foods: ['meat'], fruit: 0,
    stories: [
      '{n} a suivi un renard argenté jusqu’à une clairière pleine de champignons lumineux.',
      'Dans la brume, {n} a joué à cache-cache avec un hibou. Le hibou a gagné… trois fois.',
      '{n} a trouvé un vieux pont de pierre couvert de mousse et l’a traversé sur la pointe des griffes.'
    ] },
  { id: 'lac', name: 'Le lac d’argent', hours: 2, colors: ['#8ab6d6', '#16232e'], teaser: 'Pêche, ricochets et reflets de lune.',
    foods: ['fish', 'meat'], fruit: 0.1,
    stories: [
      '{n} a pêché au bord du lac. Le premier poisson lui a glissé des pattes, le deuxième non !',
      'Un cygne noir a appris à {n} à glisser sur l’eau. {Il} a surtout beaucoup éclaboussé.',
      '{n} s’est reposé{e} sur un rocher au milieu du lac en regardant les nuages passer.'
    ] },
  { id: 'cimes', name: 'Les cimes de braise', hours: 4, colors: ['#e0874a', '#2e1a12'], teaser: 'Les volcans endormis, là où naissent les dragons.',
    foods: ['meat', 'fish'], fruit: 0.35,
    stories: [
      '{n} a volé au-dessus des volcans endormis. L’air chaud {le} portait tout{e} seul{e}, comme une plume.',
      'Au sommet, {n} a rencontré un vieux dragon de pierre qui lui a raconté des histoires d’autrefois.',
      '{n} a soufflé sur une coulée de lave refroidie : elle s’est remise à briller un instant !'
    ] },
  { id: 'ile', name: 'L’île aux cristaux', hours: 8, colors: ['#a99cf0', '#1a1630'], teaser: 'Un long voyage au-delà de la mer. Idéal pour la nuit.',
    foods: ['fish', 'meat'], fruit: 0.8,
    stories: [
      '{n} a traversé la mer jusqu’à l’île aux cristaux. La nuit, toute l’île chante doucement.',
      'Sur l’île, {n} a trouvé une grotte entière de cristaux. {Il} a rapporté ce qu’{il} pouvait porter !',
      '{n} a dormi sous les aurores de l’île et rêvé de toi. {Il} est rentré{e} dès le réveil.'
    ] }
];

export interface Trip { dest: string; start: number; end: number; stepsDay: string; steps0: number }
export interface Loot { dest: string; gold: number; food: Partial<Record<FoodId, number>>; story: string; first: boolean; back: number }

interface Data { day: string; count: number; trip: Trip | null; back: Loot | null; visited: string[] }

const KEY = 'quete-du-dragon:voyage';
const H = 3600 * 1000;

export class Voyage {
  readonly events = new EventBus<{ change: void; back: Loot }>();
  data: Data;

  constructor(private state: GameState, private companion: Companion, private activity: Activity | null, readonly role: 'child' | 'parent') {
    this.data = { day: todayKey(), count: 0, trip: null, back: null, visited: [], ...readStore<Partial<Data>>(KEY, {}) };
  }

  private save(): void { writeStore(KEY, this.data); this.events.emit('change', undefined); }
  private roll(): void { if (this.data.day !== todayKey()) { this.data.day = todayKey(); this.data.count = 0; } }

  private get cfg() { return this.activity?.cfg.voyage ?? { perDay: 3, stepsPerShortcut: 1000, shortcutMinutes: 10, maxShortcut: 0.5, gold: { child: [3, 8] as [number, number], parent: [8, 18] as [number, number] } }; }

  left(): number { this.roll(); return Math.max(0, this.cfg.perDay - this.data.count); }
  dest(id: string): Destination { return DESTINATIONS.find(d => d.id === id) ?? DESTINATIONS[0]; }

  /** Minutes gagnées grâce aux pas faits depuis le départ. */
  shortcut(now = Date.now()): number {
    const t = this.data.trip;
    if (!t || !this.activity) return 0;
    const a = this.activity.data;
    const walked = a.day === t.stepsDay ? Math.max(0, a.steps - t.steps0) : a.steps;   // après minuit : les pas du nouveau jour
    const ms = Math.floor(walked / this.cfg.stepsPerShortcut) * this.cfg.shortcutMinutes * 60000;
    void now;
    return Math.min(ms, (t.end - t.start) * this.cfg.maxShortcut);
  }
  /** Temps restant (ms) ; 0 = il est arrivé. */
  remaining(now = Date.now()): number {
    const t = this.data.trip;
    return t ? Math.max(0, t.end - this.shortcut(now) - now) : 0;
  }
  /** En voyage (parti et pas encore rentré). */
  away(now = Date.now()): boolean { return !!this.data.trip && this.remaining(now) > 0; }

  start(id: string): 'ok' | 'limit' | 'busy' {
    this.roll();
    if (this.data.trip || this.data.back) return 'busy';
    if (this.left() <= 0) return 'limit';
    const d = this.dest(id), now = Date.now();
    this.data.trip = { dest: d.id, start: now, end: now + d.hours * H, stepsDay: this.activity?.data.day ?? todayKey(), steps0: this.activity?.data.steps ?? 0 };
    this.data.count++;
    this.save();
    return 'ok';
  }

  /** Le rappeler avant l'heure : il rentre tout de suite, sans trouvailles. */
  recall(): void { if (!this.data.trip) return; this.data.trip = null; this.save(); }

  /** Vérifie s'il est rentré : prépare son sac (ouvert ensuite avec open()). */
  check(now = Date.now()): Loot | null {
    const t = this.data.trip;
    if (!t || this.remaining(now) > 0) return null;
    const d = this.dest(t.dest);
    const [lo, hi] = this.cfg.gold[this.role];
    const gold = Math.round((lo + Math.random() * (hi - lo)) * Math.pow(d.hours, 0.6));
    const food: Partial<Record<FoodId, number>> = {};
    for (const f of d.foods) if (Math.random() < 0.75) food[f] = (food[f] ?? 0) + 1;
    if (Math.random() < d.fruit) food.fireFruit = 1;
    if (!Object.keys(food).length) food[d.foods[0]] = 1;
    const story = this.fill(d.stories[Math.floor(Math.random() * d.stories.length)]);
    const first = !this.data.visited.includes(d.id);
    this.data.back = { dest: d.id, gold, food, story, first, back: Math.min(now, t.end) };
    this.data.trip = null;
    this.save();
    this.events.emit('back', this.data.back);
    return this.data.back;
  }

  /** Ouvre son sac : l'or et la nourriture sont ajoutés, un souvenir la première fois. */
  open(): Loot | null {
    const l = this.data.back;
    if (!l) return null;
    this.data.back = null;
    if (l.gold) this.state.addGold(l.gold);
    const c = this.companion;
    for (const [f, n] of Object.entries(l.food)) c.data.food[f as FoodId] = (c.data.food[f as FoodId] ?? 0) + (n ?? 0);
    c.data.mood = Math.min(100, c.data.mood + 15);
    if (l.first) {
      this.data.visited.push(l.dest);
      c.remember('voyage-' + l.dest, `Voyage : ${this.dest(l.dest).name}`, l.story);
    }
    c.save();
    this.save();
    return l;
  }

  /** Accords (dragon / dragonne) et nom dans les histoires. */
  fill(t: string): string {
    const f = this.companion.mode === 'parent';
    return t.replace(/\{n\}/g, this.companion.name).replace(/\{Il\}/g, f ? 'Elle' : 'Il').replace(/\{il\}/g, f ? 'elle' : 'il')
      .replace(/\{le\}/g, f ? 'la' : 'le').replace(/\{e\}/g, f ? 'e' : '');
  }

  /** Notification du retour (programmée avec les autres notifications du dragon). */
  returnNotif(): { key: string; at: Date; body: string } | null {
    const t = this.data.trip;
    if (!t) return null;
    const at = new Date(Date.now() + this.remaining());
    return { key: 'voyage-' + t.start, at, body: this.fill(`Je suis rentré{e} ${fromPlace(this.dest(t.dest).name)} ! J’ai des trouvailles pour toi.`) };
  }
}

/** « de la forêt », « du lac », « des cimes », « de l’île ». */
export function fromPlace(name: string): string {
  if (name.startsWith('La ')) return 'de la ' + name.slice(3);
  if (name.startsWith('Le ')) return 'du ' + name.slice(3);
  if (name.startsWith('Les ')) return 'des ' + name.slice(4);
  if (name.startsWith('L’')) return 'de l’' + name.slice(2);
  return 'de ' + name;
}

/** « 1 h 20 », « 35 min ». */
export function duration(ms: number): string {
  const m = Math.max(1, Math.round(ms / 60000));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60), r = m % 60;
  return r ? `${h} h ${String(r).padStart(2, '0')}` : `${h} h`;
}

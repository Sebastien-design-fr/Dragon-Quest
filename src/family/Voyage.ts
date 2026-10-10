// Voyages (octobre 2026) : le petit loup, compagnon du dragon, part explorer de 1 à 8 heures et revient avec des
// trouvailles (or, nourriture, parfois un fruit de feu) et une petite histoire. Le dragon reste à la maison : on peut
// continuer à s'en occuper. Les pas faits pendant l'absence raccourcissent le voyage. Sans lien avec les quêtes.
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
      '{L} a suivi un renard argenté jusqu’à une clairière pleine de champignons lumineux. Il en a parlé à {n} pendant une heure.',
      'Dans la brume, {l} a joué à cache-cache avec un hibou. Le hibou a gagné… trois fois.',
      '{L} a trouvé un vieux pont de pierre couvert de mousse et l’a traversé sur la pointe des pattes.'
    ] },
  { id: 'lac', name: 'Le lac d’argent', hours: 2, colors: ['#8ab6d6', '#16232e'], teaser: 'Pêche, ricochets et reflets de lune.',
    foods: ['fish', 'meat'], fruit: 0.1,
    stories: [
      '{L} a pêché au bord du lac. Le premier poisson lui a glissé des pattes, le deuxième non : il est pour {n} !',
      'Un cygne noir a voulu apprendre {al} à nager. Il est rentré trempé, mais très fier.',
      '{L} s’est reposé sur un rocher au milieu du lac en regardant les nuages passer.'
    ] },
  { id: 'cimes', name: 'Les cimes de braise', hours: 4, colors: ['#e0874a', '#2e1a12'], teaser: 'Les volcans endormis, là où naissent les dragons.',
    foods: ['meat', 'fish'], fruit: 0.35,
    stories: [
      '{L} a grimpé jusqu’aux volcans endormis. Il a trouvé des pierres encore tièdes et en a rapporté une pour {n}.',
      'Au sommet, un vieux dragon de pierre a raconté {al} des histoires d’autrefois. Il les répète à {n} depuis son retour.',
      '{L} a hurlé face aux volcans… et l’écho lui a répondu trois fois. Il n’a pas eu peur. Presque pas.'
    ] },
  { id: 'ile', name: 'L’île aux cristaux', hours: 8, colors: ['#a99cf0', '#1a1630'], teaser: 'Un long voyage au-delà de la mer. Idéal pour la nuit.',
    foods: ['fish', 'meat'], fruit: 0.8,
    stories: [
      '{L} a traversé la mer sur un radeau de branches jusqu’à l’île aux cristaux. La nuit, toute l’île chante doucement.',
      'Sur l’île, {l} a trouvé une grotte entière de cristaux. Il a rempli sa sacoche à ras bord !',
      '{L} a dormi sous les aurores de l’île et rêvé de {n}. Il est rentré dès le réveil, en courant.'
    ] }
];

export interface Trip { dest: string; start: number; end: number; stepsDay: string; steps0: number }
export interface Loot { dest: string; gold: number; food: Partial<Record<FoodId, number>>; story: string; first: boolean; back: number }

interface Data {
  day: string; count: number; trip: Trip | null; back: Loot | null; visited: string[]; wolfName?: string;
  /** Expérience du loup (quêtes, caresses, friandises) et compteurs du jour. */
  wolfXp?: number; wolfDay?: string; wolfPets?: number; wolfTreats?: number;
}

/** Niveaux du loup : à chaque niveau, quêtes 5 % plus courtes, or +10 %, fruit de feu un peu plus fréquent. */
export const WOLF_LEVELS = [0, 30, 80, 160, 300, 500];

const KEY = 'quete-du-dragon:voyage';
const H = 3600 * 1000;

export class Voyage {
  readonly events = new EventBus<{ change: void; back: Loot; wolfLevel: number }>();
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
    this.data.trip = { dest: d.id, start: now, end: now + d.hours * H * (1 - 0.05 * (this.wolfLevel().level - 1)), stepsDay: this.activity?.data.day ?? todayKey(), steps0: this.activity?.data.steps ?? 0 };
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
    const lv = this.wolfLevel().level;
    const gold = Math.round((lo + Math.random() * (hi - lo)) * Math.pow(d.hours, 0.6) * (1 + 0.1 * (lv - 1)));
    const food: Partial<Record<FoodId, number>> = {};
    for (const f of d.foods) if (Math.random() < 0.75) food[f] = (food[f] ?? 0) + 1;
    if (Math.random() < Math.min(0.95, d.fruit + 0.05 * (lv - 1))) food.fireFruit = 1;
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
    this.addWolfXp(Math.round(this.dest(l.dest).hours * 10));
    if (l.first) {
      this.data.visited.push(l.dest);
      c.remember('voyage-' + l.dest, `${this.wolfName(true)} : ${this.dest(l.dest).name}`, l.story);
    }
    c.save();
    this.save();
    return l;
  }

  // ---------------- Le loup lui-même ----------------
  wolfLevel(): { level: number; xp: number; next: number | null; progress: number } {
    const xp = this.data.wolfXp ?? 0;
    let i = 0;
    while (i + 1 < WOLF_LEVELS.length && xp >= WOLF_LEVELS[i + 1]) i++;
    const next = WOLF_LEVELS[i + 1] ?? null;
    return { level: i + 1, xp, next, progress: next === null ? 1 : (xp - WOLF_LEVELS[i]) / (next - WOLF_LEVELS[i]) };
  }
  private addWolfXp(n: number): void {
    const before = this.wolfLevel().level;
    this.data.wolfXp = (this.data.wolfXp ?? 0) + n;
    const after = this.wolfLevel().level;
    if (after > before) {
      this.companion.remember('wolf-level-' + after, `${this.wolfName(true)} : niveau ${after}`, `Plus rapide et meilleur chercheur de trésors.`);
      this.companion.save();
      this.events.emit('wolfLevel', after);
    }
  }
  private wolfToday(): void { if (this.data.wolfDay !== todayKey()) { this.data.wolfDay = todayKey(); this.data.wolfPets = 0; this.data.wolfTreats = 0; } }

  /** Caresse : il est content ; les 5 premières de la journée le font progresser. */
  petWolf(): void {
    this.wolfToday();
    if ((this.data.wolfPets ?? 0) < 5) { this.data.wolfPets = (this.data.wolfPets ?? 0) + 1; this.addWolfXp(1); }
    this.save();
  }
  /** Friandise (une ration du garde-manger), 2 par jour. */
  treatWolf(): 'ok' | 'none' | 'full' {
    this.wolfToday();
    if ((this.data.wolfTreats ?? 0) >= 2) return 'full';
    if ((this.companion.data.food.ration ?? 0) <= 0) return 'none';
    this.companion.data.food.ration--;
    this.companion.save();
    this.data.wolfTreats = (this.data.wolfTreats ?? 0) + 1;
    this.addWolfXp(3);
    this.save();
    return 'ok';
  }

  /** Nom du loup (« le petit loup » tant qu'on ne lui en a pas donné). */
  wolfName(cap = false): string { const n = this.data.wolfName; return n ? n : cap ? 'Le petit loup' : 'le petit loup'; }
  hasWolfName(): boolean { return !!this.data.wolfName; }
  setWolfName(name: string): void {
    const n = name.trim().slice(0, 18);
    if (!n) return;
    const first = !this.data.wolfName;
    this.data.wolfName = n;
    if (first) { this.companion.remember('wolf-name', `Le loup s’appelle ${n}`, `Le compagnon de ${this.companion.name} a reçu son nom.`); this.companion.save(); }
    this.save();
  }

  /** Accords (dragon / dragonne), nom du dragon ({n}) et du loup ({L} / {l}) dans les textes. */
  fill(t: string): string {
    const f = this.companion.mode === 'parent';
    return t.replace(/\{al\}/g, this.data.wolfName ? 'à ' + this.data.wolfName : 'au petit loup').replace(/\{L\}/g, this.wolfName(true)).replace(/\{l\}/g, this.wolfName()).replace(/\{n\}/g, this.companion.name).replace(/\{Il\}/g, f ? 'Elle' : 'Il').replace(/\{il\}/g, f ? 'elle' : 'il')
      .replace(/\{le\}/g, f ? 'la' : 'le').replace(/\{e\}/g, f ? 'e' : '');
  }

  /** Notification du retour (programmée avec les autres notifications du dragon). */
  returnNotif(): { key: string; at: Date; body: string } | null {
    const t = this.data.trip;
    if (!t) return null;
    const at = new Date(Date.now() + this.remaining());
    return { key: 'voyage-' + t.start, at, body: this.fill(`{L} est rentré ${fromPlace(this.dest(t.dest).name)} ! Sa sacoche est pleine de trouvailles.`) };
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

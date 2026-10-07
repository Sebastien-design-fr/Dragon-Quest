// Surprises qui rendent l'ouverture de l'appli excitante : coffre du jour, trouvailles du dragon,
// petites créatures de passage et rêves racontés le matin. Jamais de punition : on gagne ou on ne gagne rien.
import type { App } from '../ui/App.js';
import { readStore, writeStore } from '../platform/storage.js';
import type { ChildBook } from './ChildBook.js';
import { FOODS, type Companion, type FoodId } from './Companion.js';
import { todayKey } from './model.js';

const KEY = 'quete-du-dragon:surprises';
const DAY = 86400000;

export type VisitorKind = 'firefly' | 'bird' | 'butterfly' | 'mouse';
export const VISITORS: Record<VisitorKind, { label: string; article: string; met: string }> = {
  firefly: { label: 'luciole', article: 'une luciole', met: 'Une luciole est venue danser dans la grotte. Sa lumière clignotait comme une étoile.' },
  bird: { label: 'petit oiseau des cavernes', article: 'un petit oiseau des cavernes', met: 'Un petit oiseau des cavernes a traversé la grotte en chantant.' },
  butterfly: { label: 'papillon de feu', article: 'un papillon de feu', met: 'Un papillon de feu a voleté autour de vous, ses ailes brillaient comme des braises.' },
  mouse: { label: 'souris des roches', article: 'une souris des roches', met: 'Une souris des roches a filé entre les cailloux… mais pas assez vite !' }
};
const VISITOR_KINDS = Object.keys(VISITORS) as VisitorKind[];

export interface Loot {
  source: 'chest' | 'gift' | 'visitor';
  gold: number;
  gems: number;
  food: FoodId | null;
  /** Phrase racontée par le dragon (trouvaille). */
  story?: string;
  /** Souvenir pour l'album (une seule fois). */
  memory?: { id: string; title: string; text: string };
  visitor?: VisitorKind;
}

export interface DreamContext {
  name: string;
  variant: 'dragon' | 'dragonne';
  missionsYesterday: number;
  friendName: string | null;
  favouriteFood: string;
  stageLabel: string;
}

interface Data {
  chestDay: string | null;
  /** Jours d'ouverture de l'appli (série du parent). */
  openDays: string[];
  giftDay: string | null;
  pendingGift: Loot | null;
  visitorDay: string;
  visitorsToday: number;
  met: VisitorKind[];
  dream: { text: string; at: number } | null;
}

const pick = <T>(list: T[]): T => list[Math.floor(Math.random() * list.length)];

/** Hasard reproductible pour une journée (l'aperçu du coffre ne change pas quand on revient). */
function seeded(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
}

export function foodLabel(id: FoodId): string { return FOODS.find(f => f.id === id)?.label ?? id; }

/** Résumé lisible d'un butin : « 25 pièces d’or, une gemme et un poisson des montagnes ». */
const FOOD_ARTICLE: Record<FoodId, string> = { ration: 'une ration', meat: 'de la viande grillée', fish: 'un poisson des montagnes', fireFruit: 'un fruit de feu', treat: 'une friandise' };
/** parent : les gemmes sont converties en or (25 pièces chacune). */
export function lootText(l: Loot, parent = false): string {
  const parts: string[] = [];
  const gold = l.gold + (parent ? 25 * l.gems : 0), gems = parent ? 0 : l.gems;
  if (gold) parts.push(`${gold} pièce${gold > 1 ? 's' : ''} d’or`);
  if (gems) parts.push(gems > 1 ? `${gems} gemmes` : 'une gemme');
  if (l.food) parts.push(FOOD_ARTICLE[l.food]);
  if (!parts.length) return 'un joli caillou';
  return parts.length === 1 ? parts[0] : parts.slice(0, -1).join(', ') + ' et ' + parts[parts.length - 1];
}

export class Surprises {
  data: Data;
  readonly mode: 'child' | 'parent';

  constructor(private book: ChildBook | null, private companion: Companion | null, mode?: 'child' | 'parent') {
    this.mode = mode ?? (book ? 'child' : 'parent');
    const defaults: Data = { chestDay: null, openDays: [], giftDay: null, pendingGift: null, visitorDay: todayKey(), visitorsToday: 0, met: [], dream: null };
    this.data = { ...defaults, ...readStore<Partial<Data>>(KEY, {}) };
    this.touch();
  }

  save(): void { writeStore(KEY, this.data); }

  /** Note l'ouverture de l'appli aujourd'hui (série du parent) et remet les compteurs du jour à zéro. */
  touch(): void {
    const k = todayKey();
    if (!this.data.openDays.includes(k)) { this.data.openDays = [...this.data.openDays, k].slice(-60); }
    if (this.data.visitorDay !== k) { this.data.visitorDay = k; this.data.visitorsToday = 0; }
    this.save();
  }

  // ---------- Coffre du jour ----------
  streak(): number {
    if (this.book) return this.book.streak();
    const set = new Set(this.data.openDays);
    let n = 0;
    const d = new Date();
    while (set.has(todayKey(d))) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }

  /** Contenu du coffre pour une série donnée (reproductible pour un jour). */
  chestLoot(streak: number, day = todayKey()): Loot {
    const rnd = seeded('chest:' + day + ':' + this.mode);
    const gold = Math.min(60, 10 + 5 * streak);
    const gems = this.mode === 'child' && streak > 0 && streak % 3 === 0 ? 1 : 0;
    let food: FoodId | null = null;
    if (rnd() < (streak >= 5 ? 0.45 : 0.3)) {
      const r = rnd();
      food = r < 0.15 + Math.min(0.2, streak * 0.02) ? 'fireFruit' : r < 0.6 ? 'meat' : 'fish';
    }
    return { source: 'chest', gold, gems, food };
  }

  dailyChest(): { available: boolean; streak: number; preview: string } {
    this.touch();
    const available = this.data.chestDay !== todayKey();
    const streak = this.streak();
    if (available) {
      const l = this.chestLoot(streak);
      const extra = l.gems ? ' et une gemme' : '';
      return { available, streak, preview: `${l.gold} pièces d’or${extra}, et peut-être une surprise !` };
    }
    // Demain : la série continue (enfant : si toutes les missions sont faites).
    const tomorrow = new Date(Date.now() + DAY);
    // Enfant : la série compte aujourd'hui seulement une fois toutes les missions faites.
    const doneToday = !!this.book?.data.streakDays.includes(todayKey());
    const l = this.chestLoot(this.book ? (doneToday ? Math.max(1, streak) : streak + 1) : streak + 1, todayKey(tomorrow));
    const extra = l.gems ? ' et une gemme' : '';
    const cond = this.book ? (doneToday ? '' : ' si tu finis tes quêtes') : '';
    return { available, streak, preview: `Demain : ${l.gold} pièces d’or${extra}${cond}` };
  }

  openDailyChest(): Loot {
    const loot = this.data.chestDay === todayKey() ? { source: 'chest' as const, gold: 0, gems: 0, food: null } : this.chestLoot(this.streak());
    this.data.chestDay = todayKey();
    this.save();
    return loot;
  }

  // ---------- Trouvailles du dragon ----------
  /**
   * Tente une trouvaille (au plus une par jour) : ~35 % des essais quand l'amitié est au moins « Confiant ».
   * force : ignore le hasard et l'amitié (tests) — pas la limite d'une par jour.
   */
  rollGift(force = false): Loot | null {
    if (this.data.pendingGift) return this.data.pendingGift;
    if (this.data.giftDay === todayKey()) return null;
    if (!force) {
      if ((this.companion?.bondLevel().level ?? 1) < 2) return null;
      if (Math.random() > 0.35) return null;
    }
    const r = Math.random();
    let loot: Loot;
    if (r < 0.5) {
      const gold = 5 + Math.floor(Math.random() * 16);
      loot = { source: 'gift', gold, gems: 0, food: null, story: pick([
        'Je l’ai trouvé au fond de la grotte, il brillait !',
        'Regarde ce que j’ai déniché sous un rocher… c’est pour toi !',
        'Une pie l’avait caché dans son nid. Je l’ai récupéré pour toi.',
        'Je l’ai gardé au chaud sous mon aile toute la nuit. Tiens !'
      ]) };
    } else if (r < 0.72) {
      loot = { source: 'gift', gold: 0, gems: 1, food: null, story: pick([
        'J’ai creusé, creusé… et j’ai trouvé ce caillou qui scintille !',
        'Elle était cachée dans une fissure de la paroi. Elle est jolie, hein ?',
        'Je l’ai vue briller au fond de la source. Je te l’offre !'
      ]) };
    } else {
      const food: FoodId = Math.random() < 0.25 ? 'fireFruit' : Math.random() < 0.5 ? 'fish' : 'meat';
      loot = { source: 'gift', gold: 0, gems: 0, food, story: food === 'fish'
        ? 'Je suis allé pêcher dans le torrent. On partage ?'
        : food === 'fireFruit' ? 'J’ai trouvé un fruit de feu tout en haut de la falaise !'
        : 'Je t’ai gardé un bon morceau. C’est pour toi… enfin, pour nous !' };
    }
    this.data.giftDay = todayKey();
    this.data.pendingGift = loot;
    this.save();
    return loot;
  }

  /** Cadeau en attente (trouvé mais pas encore ouvert). */
  pendingGift(): Loot | null { return this.data.pendingGift; }

  openGift(): Loot | null {
    const l = this.data.pendingGift;
    this.data.pendingGift = null;
    this.save();
    return l;
  }

  // ---------- Créatures de passage ----------
  static MAX_VISITORS = 3;
  /** Délai avant la prochaine créature (3 à 8 minutes). */
  nextVisitorDelay(): number { return (3 + Math.random() * 5) * 60000; }
  visitorAllowed(): boolean { this.touch(); return this.data.visitorsToday < Surprises.MAX_VISITORS; }

  /** Une créature apparaît : on choisit l'espèce (d'abord celles jamais vues). */
  spawnVisitor(): VisitorKind {
    this.touch();
    this.data.visitorsToday++;
    this.save();
    const unseen = VISITOR_KINDS.filter(k => !this.data.met.includes(k));
    return unseen.length && Math.random() < 0.6 ? pick(unseen) : pick(VISITOR_KINDS);
  }

  catchVisitor(kind: VisitorKind): Loot {
    const first = !this.data.met.includes(kind);
    if (first) { this.data.met.push(kind); this.save(); }
    const v = VISITORS[kind];
    const r = Math.random();
    const loot: Loot = { source: 'visitor', visitor: kind, gold: 0, gems: 0, food: null };
    if (first) loot.gold = 15;
    else if (r < 0.75) loot.gold = 3 + Math.floor(Math.random() * 8);
    else loot.food = kind === 'bird' || kind === 'mouse' ? 'fish' : 'meat';
    if (first) loot.memory = { id: 'visitor-' + kind, title: `Première rencontre : ${v.label}`, text: v.met };
    return loot;
  }

  /** Espèces déjà rencontrées. */
  met(): VisitorKind[] { return [...this.data.met]; }

  // ---------- Rêves ----------
  setDream(text: string): void { this.data.dream = { text, at: Date.now() }; this.save(); }

  /** Le rêve de la nuit, raconté une seule fois, à partir de 6 h le lendemain matin. */
  takeDream(): string | null {
    const d = this.data.dream;
    if (!d) return null;
    const wake = new Date(d.at);
    if (wake.getHours() >= 6) wake.setDate(wake.getDate() + 1);
    wake.setHours(6, 0, 0, 0);
    if (Date.now() < wake.getTime()) return null;
    this.data.dream = null;
    this.save();
    // Un rêve de plus de 2 jours est oublié (les dragons aussi oublient leurs rêves).
    return Date.now() - d.at > 2 * DAY ? null : d.text;
  }
  hasDream(): boolean { return !!this.data.dream; }
}

/** Petit rêve raconté au réveil, à partir de faits récents. */
export function dreamFor(c: DreamContext): string {
  const me = c.variant === 'dragonne' ? 'e' : '';
  const lines: string[] = [
    `J’ai rêvé que je volais au-dessus des nuages, plus haut que les montagnes. J’étais un${me} ${c.stageLabel.toLowerCase()} immense !`,
    `Cette nuit, j’ai rêvé d’une rivière entière de ${c.favouriteFood.toLowerCase()}. J’en ai encore l’eau à la gueule…`,
    `J’ai rêvé qu’on explorait une grotte pleine de cristaux, toi et moi. Tu tenais la lanterne et je soufflais des étincelles.`,
    `J’ai fait un drôle de rêve : toutes les lucioles du monde dansaient autour de ma queue.`
  ];
  if (c.missionsYesterday >= 3) lines.push(
    `J’ai rêvé de toi cette nuit : tu avais fait ${c.missionsYesterday} quêtes et tout le village chantait ton nom !`,
    `Dans mon rêve, tes ${c.missionsYesterday} quêtes d’hier s’étaient transformées en étoiles. J’en ai compté une par une.`
  );
  else if (c.missionsYesterday > 0) lines.push(
    `J’ai rêvé qu’on partait à l’aventure après ${c.missionsYesterday > 1 ? `tes ${c.missionsYesterday} quêtes` : 'ta quête'} d’hier. Il y avait un trésor au bout !`
  );
  if (c.friendName) lines.push(
    `J’ai rêvé de ${c.friendName} ! On faisait la course jusqu’à la lune… et j’ai gagné. Enfin, presque.`,
    `Cette nuit, ${c.friendName} et moi, on partageait un ${c.favouriteFood.toLowerCase()} au sommet d’un volcan.`
  );
  return pick(lines);
}

/** Rassemble les faits récents pour le rêve. */
export function dreamContextFrom(app: App): DreamContext {
  const book = app.family.book;
  const y = todayKey(new Date(Date.now() - DAY));
  const missionsYesterday = book ? Object.values(book.data.records).filter(r => r.date === y && r.status === 'done').length : 0;
  return {
    name: app.family.companion?.name ?? (app.isParent ? 'Ta dragonne' : 'Ton dragon'),
    variant: app.isParent ? 'dragonne' : 'dragon',
    missionsYesterday,
    friendName: app.family.duo?.friend()?.name ?? null,
    favouriteFood: foodLabel(app.family.companion?.data.fav ?? 'fish'),
    stageLabel: app.stageLabel(app.state.stage.label)
  };
}

/** Ajoute le butin : or, gemmes (parent : 25 or par gemme), nourriture, souvenir d'album. */
export function applyLoot(app: App, loot: Loot): void {
  const book = app.family.book;
  const comp = app.family.companion;
  const reason = loot.source === 'chest' ? 'Coffre du jour' : loot.source === 'gift' ? 'Trouvaille du dragon' : 'Créature attrapée';
  let gold = loot.gold;
  if (loot.gems) { if (book) book.addGems(loot.gems, reason); else gold += 25 * loot.gems; }
  if (gold) app.state.addGold(gold);
  if (comp && (loot.food || loot.memory)) {
    if (loot.food) comp.data.food[loot.food] = (comp.data.food[loot.food] ?? 0) + 1;
    if (loot.memory) comp.remember(loot.memory.id, loot.memory.title, loot.memory.text);
    comp.save();
  }
}

/** Une seule instance par appli (partagée entre les cartes et les créatures). */
const instances = new WeakMap<App, Surprises>();
export function surprisesFor(app: App): Surprises {
  let s = instances.get(app);
  if (!s) { s = new Surprises(app.family.book, app.family.companion, app.isParent ? 'parent' : 'child'); instances.set(app, s); }
  return s;
}

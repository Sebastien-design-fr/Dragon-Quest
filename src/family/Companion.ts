// Le dragon compagnon : il a faim, se salit, s'ennuie, et s'attache à celle ou celui qui s'occupe de lui.
// Octobre 2026 : les soins sont indépendants des quêtes (les quêtes donnent l'XP et l'or, rien d'autre).
// Le garde-manger se remplit chaque jour, gratuitement. Absent (école, travail, vacances), le dragon ne souffre pas :
// rien ne baisse la nuit, presque rien pendant les heures de cours, et les jauges s'arrêtent à « il s'ennuie ».
import { EventBus } from '../core/events.js';
import type { GameState } from '../game/GameState.js';
import { readStore, writeStore } from '../platform/storage.js';
import { todayKey } from './model.js';

export type FoodId = 'ration' | 'meat' | 'fish' | 'fireFruit' | 'treat';

export interface FoodDef { id: FoodId; label: string; hint: string; hunger: number; mood: number; bond: number; price: number | null }

export const FOODS: FoodDef[] = [
  { id: 'ration', label: 'Ration de dragon', hint: 'Le garde-manger se remplit chaque matin', hunger: 30, mood: 0, bond: 0, price: null },
  { id: 'meat', label: 'Viande grillée', hint: 'Bien nourrissante', hunger: 50, mood: 6, bond: 0, price: 25 },
  { id: 'fish', label: 'Poisson des montagnes', hint: 'Un délice des torrents', hunger: 45, mood: 14, bond: 1, price: 40 },
  { id: 'fireFruit', label: 'Fruit de feu', hint: 'Une rareté : on en trouve en voyage', hunger: 35, mood: 22, bond: 3, price: 120 },
  { id: 'treat', label: 'Friandise des parents', hint: 'Envoyée par tes parents', hunger: 15, mood: 25, bond: 3, price: null }
];

export interface TrickDef { id: string; label: string; anim: string; level: number }
export const TRICKS: TrickDef[] = [
  { id: 'fire', label: 'Souffle de feu', anim: 'fire', level: 1 },
  { id: 'attack', label: 'Coup de griffe', anim: 'attack', level: 1 },
  { id: 'bow', label: 'La révérence', anim: 'bow', level: 2 },
  { id: 'hover', label: 'Le vol', anim: 'hover', level: 3 },
  { id: 'dance', label: 'La danse', anim: 'dance', level: 4 },
  { id: 'ring', label: 'Anneau de feu', anim: 'ring', level: 5 },
  { id: 'roar', label: 'Le rugissement', anim: 'roar', level: 6 }
];

/** Niveaux d'amitié : points de lien nécessaires. */
export const BOND_LEVELS = [
  { level: 1, at: 0, label: 'Curieux' },
  { level: 2, at: 15, label: 'Confiant' },
  { level: 3, at: 45, label: 'Complice' },
  { level: 4, at: 100, label: 'Fidèle' },
  { level: 5, at: 180, label: 'Inséparable' },
  { level: 6, at: 300, label: 'Lié pour la vie' }
];

export interface AlbumEntry { id: string; at: number; title: string; text: string }

interface Data {
  name: string | null;
  hunger: number;   // 100 = rassasié
  clean: number;    // 100 = écailles brillantes
  mood: number;     // 100 = ravi
  bond: number;     // points d'amitié (ne baissent jamais)
  updatedAt: number;
  food: Record<FoodId, number>;
  /** Compteurs du jour (anti-abus : les caresses ne rapportent pas à l'infini). */
  day: string;
  pets: number;
  petBond: number;
  played: boolean;
  tucked: boolean;
  album: AlbumEntry[];
  lastOpen: number;
  /** Notifications « venant du dragon » déjà programmées par jour (au plus 2). */
  seenStage: string | null;
  /** Malade : missions oubliées plusieurs jours d'affilée. Guérit après une journée parfaite. */
  sick: boolean;
  /** Grotte : décorations achetées, débris à ramasser. */
  decor: string[];
  debris: number;
  lairDay: string;
  tidied: number;
  /** Mode parent (tamagotchi) : XP gagné par les soins aujourd'hui. */
  careXp: number;
  /** Son plat préféré (à découvrir en le nourrissant). */
  fav: FoodId;
  favKnown: boolean;
  /** Rituels : rideau ouvert ce matin, couverture ce soir. */
  morningDay: string;
  blanketDay: string;
  /** Tours : nombre de répétitions (maîtrise) et répétitions comptées aujourd'hui. */
  practice: Record<string, number>;
  practiceToday: Record<string, number>;
  /** Routine du jour : soins faits aujourd'hui (nourri, lavé) et routine complète récompensée. */
  fedDay?: string;
  washedDay?: string;
  routineDay?: string;
  /** Réveillé à la main (heure) : on le laisse debout un moment, même si l'appli est rouverte. */
  wokeAt?: number;
}

/** Répétitions pour 1, 2 et 3 étoiles de maîtrise (au plus 2 comptées par tour et par jour). */
export const MASTERY = [3, 8, 15];
export const PRACTICE_PER_DAY = 2;

const KEY = 'quete-du-dragon:companion';
const H = 3600 * 1000;

// Baisse par heure (le jour). La nuit (22 h – 7 h), il dort : rien ne baisse.
// En semaine de 8 h à 16 h 30 (école, travail), la baisse est divisée par 4.
const DECAY = { hunger: 4, clean: 1.4, mood: 2.2 };
/** Plancher des jauges : au pire, il s'ennuie (jamais affamé, jamais malade). */
export const FLOOR = 30;
/** Garde-manger : rations disponibles chaque matin (gratuites). */
export const PANTRY = { ration: 5, fish: 2 };

/** Coefficient de baisse à cette heure : 0 la nuit, 0,25 pendant les heures de cours / de travail. */
export function decayRate(d: Date): number {
  if (isNight(d)) return 0;
  const h = d.getHours() + d.getMinutes() / 60, wd = d.getDay();
  return wd >= 1 && wd <= 5 && h >= 8 && h < 16.5 ? 0.25 : 1;
}

export function isNight(d = new Date()): boolean { const h = d.getHours(); return h >= 22 || h < 7; }

export class Companion {
  readonly events = new EventBus<{ change: void; toast: string; react: { anim?: string; fx?: string; anchor?: string; say?: string } }>();
  data: Data;

  /**
   * mode 'child' : les rations viennent des missions.
   * mode 'parent' : tamagotchi pur — les soins font grandir le dragon (XP plafonné par jour), rations chaque matin.
   */
  constructor(private state: GameState, readonly mode: 'child' | 'parent' = 'child', storageKey = KEY) {
    this.key = storageKey;
    const now = Date.now();
    const defaults: Data = {
      name: null, hunger: 80, clean: 85, mood: 75, bond: 0, updatedAt: now,
      food: { ration: 3, meat: 0, fish: 1, fireFruit: 0, treat: 0 },
      day: todayKey(), pets: 0, petBond: 0, played: false, tucked: false, album: [], lastOpen: now, seenStage: null, sick: false, decor: [], debris: 2, lairDay: todayKey(), tidied: 0, careXp: 0,
      fav: (['meat', 'fish', 'fireFruit'] as FoodId[])[Math.floor(Math.random() * 3)], favKnown: false, morningDay: '', blanketDay: '', practice: {}, practiceToday: {}
    };
    const saved = readStore<Partial<Data>>(storageKey, {});
    this.data = { ...defaults, ...saved, food: { ...defaults.food, ...(saved.food ?? {}) } };
    this.tick();
    if (!this.data.seenStage) this.data.seenStage = state.data.stage;
  }

  private key: string;
  /** Garde-manger du jour : gratuit, sans lien avec les quêtes. */
  private fillPantry(): void {
    const f = this.data.food;
    f.ration = Math.max(f.ration ?? 0, PANTRY.ration);
    f.fish = Math.max(f.fish ?? 0, PANTRY.fish);
  }
  save(): void { writeStore(this.key, this.data); this.events.emit('change', undefined); }

  // ---------- Temps qui passe ----------
  /** Applique la baisse des jauges depuis la dernière mise à jour (heure par heure, jour / nuit). */
  tick(now = Date.now()): void {
    const d = this.data;
    let t = d.updatedAt;
    if (now - t > 30 * 24 * H) t = now - 30 * 24 * H;
    while (t < now) {
      const step = Math.min(H, now - t);
      const k = step / H;
      const r = decayRate(new Date(t)) * k;
      d.hunger -= DECAY.hunger * r;
      d.clean -= DECAY.clean * r;
      d.mood -= DECAY.mood * r * (d.hunger < 45 || d.clean < 45 ? 1.4 : 1);
      t += step;
    }
    d.hunger = floor(d.hunger); d.clean = floor(d.clean); d.mood = floor(d.mood);
    d.updatedAt = now;
    // Chaque nouveau jour, un peu de désordre s'accumule dans la grotte.
    if (d.lairDay !== todayKey()) {
      const days = Math.max(1, Math.round((Date.parse(todayKey()) - Date.parse(d.lairDay || todayKey())) / 86400000));
      d.debris = Math.min(8, (d.debris ?? 0) + Math.min(3, days));
      d.lairDay = todayKey();
    }
    if (d.day !== todayKey()) {
      d.day = todayKey(); d.pets = 0; d.petBond = 0; d.played = false; d.tucked = false; d.careXp = 0; d.practiceToday = {};
      this.fillPantry();
    }
    const any = d as Data & { pantryV2?: boolean };
    if (!any.pantryV2) { any.pantryV2 = true; d.sick = false; this.fillPantry(); }
  }

  /** À l'ouverture de l'appli : s'il ne l'a pas vue depuis longtemps, il lui fait la fête. */
  greet(): string | null {
    this.tick();
    const away = Date.now() - this.data.lastOpen;
    this.data.lastOpen = Date.now();
    this.save();
    if (away > 36 * H) return 'away';
    return null;
  }

  // ---------- Lecture ----------
  get name(): string { return this.data.name || (this.mode === 'parent' ? 'Ta dragonne' : 'Ton dragon'); }
  wellbeing(): number { const d = this.data; return Math.round((d.hunger + d.clean + d.mood) / 3); }
  /** Il s'ennuie (jamais pire : les jauges ne descendent pas sous le plancher). */
  sad(): boolean { return this.data.mood < 40 || this.wellbeing() < 42; }

  bondLevel(): { level: number; label: string; next: number | null; progress: number } {
    const b = this.data.bond;
    let i = 0;
    while (i + 1 < BOND_LEVELS.length && b >= BOND_LEVELS[i + 1].at) i++;
    const cur = BOND_LEVELS[i], nxt = BOND_LEVELS[i + 1];
    return { level: cur.level, label: cur.label, next: nxt ? nxt.at : null, progress: nxt ? (b - cur.at) / (nxt.at - cur.at) : 1 };
  }

  mood(): { key: string; label: string } {
    const d = this.data;
    if (isNight() && !d.tucked && d.hunger > 25) return { key: 'sleepy', label: 'Il a sommeil' };
    if (d.hunger < 40) return { key: 'hungry', label: 'Un petit creux' };
    if (d.clean < 40) return { key: 'dirty', label: 'Un peu poussiéreux' };
    if (d.mood < 40) return { key: 'sad', label: 'Il s’ennuie de toi' };
    const w = this.wellbeing();
    if (w >= 80) return { key: 'great', label: 'Rayonnant' };
    if (w >= 55) return { key: 'good', label: 'Content' };
    return { key: 'meh', label: 'Un peu morose' };
  }

  // ---------- Cadeaux ----------
  onTreat(from: string): void {
    this.data.food.treat++;
    this.events.emit('toast', `${from} t’a envoyé une friandise pour ${this.name} !`);
    this.save();
  }

  // ---------- Soins ----------
  setName(name: string): void {
    const n = name.trim().slice(0, 18);
    if (!n) return;
    const first = !this.data.name;
    this.data.name = n;
    if (first) this.remember('name', `Il s’appelle ${n}`, `Le jour où tu as donné un nom à ton dragon.`);
    this.save();
  }

  feed(id: FoodId): string {
    this.tick();
    const f = FOODS.find(x => x.id === id)!;
    const d = this.data;
    if ((d.food[id] ?? 0) <= 0) return 'none';
    if (d.hunger >= 95) { this.events.emit('react', { say: 'full' }); return 'full'; }
    d.food[id]--;
    d.fedDay = todayKey();
    const wasHungry = d.hunger < 60;
    const fav = id === d.fav;
    d.hunger = clamp(d.hunger + f.hunger);
    d.mood = clamp(d.mood + f.mood + (fav ? 10 : 0));
    this.addBond(f.bond + (wasHungry ? 1 : 0) + (fav ? 1 : 0));
    if (wasHungry) this.careXp(12);
    if (fav && !d.favKnown) {
      d.favKnown = true;
      this.remember('fav', `Son plat préféré : ${f.label.toLowerCase()}`, `Tu as découvert ce que ${this.name} adore manger.`);
      this.events.emit('toast', `Découverte : le plat préféré de ${this.name} est ${f.label.toLowerCase()} !`);
    }
    this.events.emit('react', { anim: 'eat', fx: fav ? 'hearts' : undefined, say: fav ? 'fav' : id === 'fireFruit' || id === 'treat' ? 'yum' : 'thanks-food' });
    this.save();
    return 'ok';
  }

  /** Pêche au lac : les poissons attrapés vont au garde-manger (3 par jour au plus). Retourne le nombre rangé. */
  catchFish(n: number): number {
    const d = this.data as typeof this.data & { fishDay?: string; fishToday?: number };
    if (d.fishDay !== todayKey()) { d.fishDay = todayKey(); d.fishToday = 0; }
    const add = Math.max(0, Math.min(n, 3 - (d.fishToday ?? 0)));
    if (!add) return 0;
    d.fishToday = (d.fishToday ?? 0) + add;
    d.food.fish = (d.food.fish ?? 0) + add;
    this.save();
    return add;
  }

  buy(id: FoodId): boolean {
    const f = FOODS.find(x => x.id === id);
    if (!f?.price || this.state.data.gold < f.price) return false;
    this.state.addGold(-f.price);
    this.data.food[id]++;
    this.save();
    return true;
  }

  /** Frotter les écailles : amount = distance frottée (0..1 par geste). Retourne vrai quand il est tout propre. */
  scrub(amount: number): boolean {
    const d = this.data;
    if (d.clean >= 100) { if (d.washedDay !== todayKey()) { d.washedDay = todayKey(); this.save(); } return true; }
    const before = d.clean;
    d.clean = clamp(d.clean + amount * 9);
    if (before < 100 && d.clean >= 100) {
      d.washedDay = todayKey();
      if (before < 60) { this.addBond(2); this.careXp(20); }
      d.mood = clamp(d.mood + 8);
      this.events.emit('react', { anim: 'shake', say: 'clean' });
      this.save();
      return true;
    }
    return false;
  }

  /** Caresse (frottement du doigt). Les premières de la journée comptent pour l'amitié. */
  pet(): void {
    const d = this.data;
    d.pets++;
    d.mood = clamp(d.mood + (d.pets <= 20 ? 1.5 : 0.3));
    if (d.pets % 6 === 0 && d.petBond < 3) { d.petBond++; this.addBond(1); this.careXp(6); }
  }

  tuck(): boolean {
    this.tick();
    if (!isNight() && new Date().getHours() < 20) return false;
    if (!this.data.tucked) { this.data.tucked = true; this.data.mood = clamp(this.data.mood + 10); this.addBond(2); this.careXp(15); this.save(); }
    return true;
  }

  canPlay(): 'ok' | 'played' { this.tick(); return this.data.played ? 'played' : 'ok'; }

  /** Fin de partie récompensée. factor : 1 pour le premier jeu du jour, 0.5 pour les suivants.
   *  Côté enfant, l'or des jeux reste petit (15 au plus) : l'or vient surtout des quêtes. */
  finishGame(score: number, factor = 1): number {
    const cap = this.mode === 'parent' ? 40 : 15;
    const gold = Math.round(Math.min(cap, Math.round(score * (this.mode === 'parent' ? 1.5 : 0.6))) * factor);
    this.data.played = true;
    this.careXp(25);
    this.data.mood = clamp(this.data.mood + 20);
    this.addBond(3);
    if (gold) this.state.addGold(gold);
    this.save();
    return gold;
  }

  /** Partie rejouée pour le plaisir : un peu de bonne humeur, sans récompense. */
  cheer(): void { this.tick(); this.data.mood = clamp(this.data.mood + 4); this.save(); }

  // ---------- Grotte ----------
  lair(): { owned: string[]; debris: number } { this.tick(); return { owned: this.data.decor, debris: this.data.debris }; }
  buyDecor(id: string, price: number): boolean {
    if (this.data.decor.includes(id) || this.state.data.gold < price) return false;
    this.state.addGold(-price);
    this.data.decor.push(id);
    this.careXp(10);
    this.data.mood = clamp(this.data.mood + 10);
    this.addBond(1);
    if (this.data.decor.length === 1) this.remember('lair1', 'Première décoration', 'La grotte commence à ressembler à un vrai chez-soi.');
    this.save();
    return true;
  }
  tidyLair(): void {
    if (this.data.debris <= 0) return;
    this.data.debris--;
    this.data.tidied++;
    this.data.mood = clamp(this.data.mood + 2);
    if (this.data.tidied % 5 === 0) this.addBond(1);
    this.careXp(3);
    this.save();
  }

  /** Ancienne sanction (dragon malade) : il ne peut plus que guérir. */
  setSick(on: boolean): void {
    if (on || !this.data.sick) return;
    this.data.sick = false;
    this.data.mood = clamp(this.data.mood + 20);
    this.save();
  }

  /** Étoiles de maîtrise d'un tour (0 à 3). */
  stars(id: string): number { const n = this.data.practice?.[id] ?? 0; return MASTERY.filter(m => n >= m).length; }
  /** Prochain palier de maîtrise (répétitions) ou null s'il est maîtrisé. */
  nextMastery(id: string): number | null { const n = this.data.practice?.[id] ?? 0; return MASTERY.find(m => n < m) ?? null; }

  /** Il fait un tour : à force de répéter, il le maîtrise (étoiles). Retourne les étoiles gagnées (0 si rien de neuf). */
  practise(id: string, label: string): { stars: number; gained: boolean; counted: boolean } {
    const d = this.data;
    d.practice = d.practice ?? {}; d.practiceToday = d.practiceToday ?? {};
    if ((d.practiceToday[id] ?? 0) >= PRACTICE_PER_DAY) { d.mood = clamp(d.mood + 2); this.save(); return { stars: this.stars(id), gained: false, counted: false }; }
    const before = this.stars(id);
    d.practiceToday[id] = (d.practiceToday[id] ?? 0) + 1;
    d.practice[id] = (d.practice[id] ?? 0) + 1;
    d.mood = clamp(d.mood + 4);
    const after = this.stars(id);
    if (after > before) {
      this.addBond(after === 3 ? 3 : 1);
      this.careXp(after * 5);
      if (after === 3) this.remember('trick-' + id, `Tour maîtrisé : ${label}`, `${this.name} fait « ${label.toLowerCase()} » à la perfection.`);
      this.events.emit('toast', after === 3 ? `${label} : tour maîtrisé !` : `${label} : ${'★'.repeat(after)} (il progresse)`);
    }
    this.save();
    return { stars: after, gained: after > before, counted: true };
  }

  /** Routine complète : petite récompense (une fois par jour). Parent : XP et or ; enfant : or et amitié (pas d'XP). */
  claimRoutine(): { xp: number; gold: number } | null {
    if (this.data.routineDay === todayKey()) return null;
    this.data.routineDay = todayKey();
    const r = this.mode === 'parent' ? { xp: 20, gold: 10 } : { xp: 0, gold: 8 };
    if (r.xp) this.state.addXp(r.xp);
    if (r.gold) this.state.addGold(r.gold);
    this.addBond(2);
    this.data.mood = clamp(this.data.mood + 10);
    this.save();
    return r;
  }

  tricks(): Array<TrickDef & { unlocked: boolean }> {
    const lv = this.bondLevel().level;
    return TRICKS.map(t => ({ ...t, unlocked: lv >= t.level }));
  }

  // ---------- Amitié et souvenirs ----------
  /** Mode parent : XP des soins (plafonné à 100 par jour). */
  static CARE_XP_CAP = 100;
  private careXp(n: number): void {
    if (this.mode !== 'parent' || n <= 0) return;
    const left = Companion.CARE_XP_CAP - this.data.careXp;
    const gain = Math.max(0, Math.min(n, left));
    if (!gain) return;
    this.data.careXp += gain;
    this.state.addXp(gain);
  }
  careXpLeft(): number { return Math.max(0, Companion.CARE_XP_CAP - this.data.careXp); }

  private addBond(n: number): void {
    if (n <= 0) return;
    const before = this.bondLevel().level;
    this.data.bond += n;
    const after = this.bondLevel();
    if (after.level > before) {
      const trick = TRICKS.find(t => t.level === after.level);
      this.remember(`bond${after.level}`, `Amitié : ${after.label}`, trick ? `${this.name} a appris un nouveau tour : ${trick.label}.` : 'Votre lien est plus fort que jamais.');
      this.events.emit('toast', trick ? `Amitié « ${after.label} » : ${this.name} a appris ${trick.label.toLowerCase()} !` : `Amitié « ${after.label} » !`);
      this.events.emit('react', { anim: 'happy', fx: 'hearts', say: 'bond' });
    }
  }

  /** Souvenir pour l'album (une seule fois par id). */
  remember(id: string, title: string, text: string): void {
    if (this.data.album.some(a => a.id === id)) return;
    this.data.album.unshift({ id, at: Date.now(), title, text });
    this.data.album = this.data.album.slice(0, 60);
  }

  /** Appelé quand le stade change (évolution) ou quand un grand moment arrive. */
  noteStage(stageId: string, label: string): void {
    if (this.data.seenStage === stageId) return;
    this.data.seenStage = stageId;
    this.remember('stage-' + stageId, `Évolution : ${label}`, `${this.name} est devenu ${label.toLowerCase()}.`);
    this.save();
  }

  /**
   * Notifications « du dragon » à programmer : quand il aura faim, et s'il ne l'a pas vue depuis 2 jours.
   * Jamais la nuit ni pendant l'école : décalées au créneau calme suivant. Au plus 2 par jour.
   */
  /** Notifications venant d'autres modules (retour de voyage…), prioritaires. */
  extraNotifs: Array<() => { key: string; at: Date; body: string } | null> = [];

  careNotifs(): Array<{ key: string; at: Date; body: string }> {
    this.tick();
    const d = this.data, now = Date.now();
    const out: Array<{ key: string; at: Date; body: string }> = [];
    for (const f of this.extraNotifs) { const n = f(); if (n && n.at.getTime() > now) out.push({ ...n, at: calmSlot(n.at) }); }
    // quand aura-t-il un petit creux (faim sous 40) ? on simule les heures à venir (nuit et école comprises)
    let hunger = d.hunger, t = now;
    while (hunger >= 40 && t < now + 72 * H) { hunger -= DECAY.hunger * decayRate(new Date(t)); t += H; }
    if (hunger < 40) {
      const at = calmSlot(new Date(Math.max(t, now + H)));
      out.push({ key: 'hungry-' + todayKey(at), at, body: 'J’ai un petit creux… tu viens me donner à manger ? Le garde-manger est plein !' });
    }
    const miss = calmSlot(new Date(d.lastOpen + 48 * H));
    out.push({ key: 'miss-' + todayKey(miss), at: miss, body: 'Tu me manques… je t’attends dans ma grotte.' });
    // au plus 2 par jour
    const perDay = new Map<string, number>();
    return out.filter(n => { const k = todayKey(n.at); const c = (perDay.get(k) ?? 0) + 1; perDay.set(k, c); return c <= 2; });
  }

  /** Résumé envoyé aux parents. */
  summary() {
    this.tick();
    const d = this.data;
    return { name: this.name, hunger: Math.round(d.hunger), clean: Math.round(d.clean), mood: Math.round(d.mood), bond: this.bondLevel().label, moodLabel: this.mood().label };
  }
}

/** Prochain créneau calme : pas la nuit (21 h – 8 h), pas pendant l'école en semaine (8 h – 16 h 30). */
function calmSlot(d: Date): Date {
  const r = new Date(d);
  const fix = () => {
    const h = r.getHours() + r.getMinutes() / 60, wd = r.getDay(), week = wd >= 1 && wd <= 5;
    if (h >= 21) { r.setDate(r.getDate() + 1); r.setHours(week ? 17 : 10, 0, 0, 0); return true; }
    if (h < 8) { r.setHours(r.getDay() >= 1 && r.getDay() <= 5 ? 17 : 10, 0, 0, 0); return true; }
    if (week && h >= 8 && h < 16.5) { r.setHours(17, 0, 0, 0); return true; }
    return false;
  };
  for (let i = 0; i < 3 && fix(); i++) { /* recalcule après décalage */ }
  return r;
}

function clamp(v: number): number { return v < 0 ? 0 : v > 100 ? 100 : v; }
function floor(v: number): number { return v < FLOOR ? FLOOR : v > 100 ? 100 : v; }

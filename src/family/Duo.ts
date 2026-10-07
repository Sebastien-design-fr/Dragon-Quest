// Les deux dragons de la famille se rencontrent : visites, cadeaux, amitié entre dragons, tours à deux.
// Les messages passent par le lien maison (Wi-Fi) ; une visite envoyée hors de la maison arrive au retour.
import { EventBus } from '../core/events.js';
import type { GameState } from '../game/GameState.js';
import type { LinkMessage, Transport } from '../link/Transport.js';
import { readStore, writeStore } from '../platform/storage.js';
import type { Companion, FoodId } from './Companion.js';
import { FOODS } from './Companion.js';
import { todayKey } from './model.js';
import { weekKey } from './Expedition.js';
import type { ChildBook } from './ChildBook.js';

/** Ce qu'on sait du dragon de l'autre (pour l'afficher pendant une visite). */
export interface DragonProfile {
  id: string; owner: string; name: string; variant: 'dragon' | 'dragonne'; stage: string; level: number; equipped: string[]; owned: string[];
  /** Quête de famille : contribution de cet appareil cette semaine (et son objectif). */
  quest?: { week: string; mine: number; goal?: number };
}

/** Quête de famille de la semaine : l'enfant fait des missions, le parent des soins, ensemble ils réussissent. */
export const QUEST_TITLES = [
  'Le festin des deux dragons', 'La grande migration', 'Le trésor des cimes', 'La fête des lanternes',
  'Le chant des étoiles filantes', 'La forge des anciens', 'Le jardin de cristal', 'La course des nuages'
];
/** Objectifs par défaut (missions pour l'enfant, soins pour le parent). */
export const QUEST_GOALS = { child: 20, parent: 15 };
export const QUEST_REWARD = { gold: 100 };

export interface QuestState {
  title: string; week: string; mine: number; mineGoal: number; theirs: number; theirsGoal: number;
  done: boolean; claimed: boolean; friendName: string | null;
}

interface QuestData {
  week: string;
  mine: number;
  claimed: boolean;
  /** Dernier total de missions vu dans le carnet (côté enfant) : on ne compte que les nouvelles. */
  lastTotal?: number;
  /** Côté parent : soins « une fois par jour » déjà comptés (jeu, coucher). */
  playedDay?: string;
  tuckedDay?: string;
}

export interface VisitGift { food?: FoodId; item?: string }
export interface Visit { id: string; from: DragonProfile; message?: string; gift?: VisitGift; fp: number; at: number }

export interface DuoTrick { id: string; label: string; anim: string; at: number }
export const DUO_TRICKS: DuoTrick[] = [
  { id: 'greet', label: 'Se saluer', anim: 'bow', at: 0 },
  { id: 'duo_dance', label: 'Danse à deux', anim: 'dance', at: 10 },
  { id: 'duo_roar', label: 'Double rugissement', anim: 'roar', at: 30 },
  { id: 'duo_fly', label: 'Vol côte à côte', anim: 'hover', at: 60 },
  { id: 'duo_ring', label: 'Anneaux de feu croisés', anim: 'ring', at: 100 }
];

export const DUO_LEVELS = [
  { at: 0, label: 'Inconnus' }, { at: 10, label: 'Copains' }, { at: 30, label: 'Complices' },
  { at: 60, label: 'Inséparables' }, { at: 100, label: 'Âmes jumelles' }
];

interface Data {
  /** Dragons amis connus (par identifiant d'appareil). */
  friends: Record<string, DragonProfile>;
  friendship: number;
  sentDay: string;
  sentToday: number;
  pending: Visit[];
  quest: QuestData;
}

const KEY = 'quete-du-dragon:duo';
const MAX_VISITS_PER_DAY = 3;

export class Duo {
  readonly events = new EventBus<{ change: void; visit: Visit; toast: string }>();
  data: Data;
  private profileTimer = 0;

  constructor(private link: Transport, private state: GameState, private companion: Companion, private selfId: string,
    private ownerName: string, private role: 'child' | 'parent') {
    this.data = { friends: {}, friendship: 0, sentDay: todayKey(), sentToday: 0, pending: [], quest: { week: weekKey(), mine: 0, claimed: false }, ...readStore<Partial<Data>>(KEY, {}) };
    state.events.on('change', () => this.queueProfile());
    companion.events.on('change', () => { this.watchCareFlags(); this.queueProfile(); });
    // Parent : chaque soin compte pour la quête de famille (repas, bain terminé ; jeu et coucher via 'change').
    companion.events.on('react', r => { if (this.role === 'parent' && (r.anim === 'eat' || r.anim === 'shake')) this.addQuest(1); });
  }

  /** Objectifs de la quête (modifiables pour les essais : duo.questGoals.child = 2). */
  questGoals = { ...QUEST_GOALS };
  private book: ChildBook | null = null;

  /** Enfant : branche le carnet de missions pour compter les missions faites dans la semaine. */
  attachBook(book: ChildBook): void {
    if (this.book === book) return;
    this.book = book;
    this.rollQuest();
    const q = this.data.quest;
    if (q.lastTotal === undefined) {
      // Premier branchement : on reprend les missions déjà faites cette semaine.
      if (book.data.week?.key === q.week) q.mine = Math.max(q.mine, book.data.week.missions);
      q.lastTotal = book.data.stats.total;
      this.save();
    }
    book.events.on('change', () => {
      const total = book.data.stats.total;
      const last = this.data.quest.lastTotal ?? total;
      this.data.quest.lastTotal = total;
      if (total > last) this.addQuest(total - last);
      else if (total !== last) writeStore(KEY, this.data);
    });
  }

  private rollQuest(): void {
    const w = weekKey();
    if (this.data.quest?.week !== w) this.data.quest = { week: w, mine: 0, claimed: false, lastTotal: this.data.quest?.lastTotal };
  }

  private addQuest(n: number): void {
    if (this.role === 'child' && !this.book) return;
    this.rollQuest();
    const before = this.questState();
    this.data.quest.mine += n;
    const after = this.questState();
    if (!before.done && after.done) this.events.emit('toast', `Quête de famille « ${after.title} » réussie ! Ta récompense t’attend.`);
    this.save();
    this.queueProfile(800);
  }

  /** Parent : jouer et border comptent une fois par jour (ces soins n'émettent pas de 'react'). */
  private watchCareFlags(): void {
    if (this.role !== 'parent') return;
    const c = this.companion.data, day = todayKey(), q = this.data.quest;
    if (!q) return;
    let n = 0;
    if (c.played && c.day === day && q.playedDay !== day) { q.playedDay = day; n++; }
    if (c.tucked && c.day === day && q.tuckedDay !== day) { q.tuckedDay = day; n++; }
    if (n) this.addQuest(n);
  }

  questTitle(week = weekKey()): string {
    const [y, m, d] = week.split('-').map(Number);
    const n = Math.round(Date.UTC(y, m - 1, d) / (7 * 86400000));
    return QUEST_TITLES[((n % QUEST_TITLES.length) + QUEST_TITLES.length) % QUEST_TITLES.length];
  }

  questState(): QuestState {
    this.rollQuest();
    const q = this.data.quest, f = this.friend();
    const fq = f?.quest && f.quest.week === q.week ? f.quest : null;
    const otherRole = this.role === 'child' ? 'parent' : 'child';
    const mineGoal = Math.max(1, this.questGoals[this.role]);
    const theirsGoal = Math.max(1, Number(fq?.goal) || this.questGoals[otherRole]);
    const mine = q.mine, theirs = Math.max(0, Number(fq?.mine) || 0);
    return { title: this.questTitle(q.week), week: q.week, mine, mineGoal, theirs, theirsGoal, done: !!f && mine >= mineGoal && theirs >= theirsGoal, claimed: q.claimed, friendName: f?.name ?? null };
  }

  /** Récompense de la quête de famille (une fois par semaine, quand les deux parts sont faites). */
  claimQuest(): boolean {
    const s = this.questState();
    if (!s.done || s.claimed) return false;
    this.data.quest.claimed = true;
    this.state.addGold(QUEST_REWARD.gold);
    const c = this.companion;
    c.data.food.fireFruit = (c.data.food.fireFruit ?? 0) + 1;
    c.remember('duo-quest-' + s.week, `Nous deux : ${s.title}`,
      `${c.name} et ${s.friendName ?? 'son ami'} ont réussi ensemble la quête de famille (${s.mine} + ${s.theirs}).`);
    c.save();
    this.gain(5);
    this.save();
    this.events.emit('toast', `${s.title} : +${QUEST_REWARD.gold} or et un fruit de feu !`);
    return true;
  }

  private save(): void { writeStore(KEY, this.data); this.events.emit('change', undefined); }

  /** Destinataires : l'enfant écrit aux parents, le parent aux enfants. */
  private get target(): string { return this.role === 'child' ? 'parents' : 'children'; }

  profile(): DragonProfile {
    const d = this.state.data;
    return {
      id: this.selfId, owner: this.ownerName, name: this.companion.name, variant: this.role === 'child' ? 'dragon' : 'dragonne',
      stage: d.stage, level: d.level, equipped: Object.values(d.equipped), owned: d.owned,
      quest: { week: this.questState().week, mine: this.data.quest.mine, goal: this.questGoals[this.role] }
    };
  }

  queueProfile(delay = 2500): void {
    clearTimeout(this.profileTimer);
    this.profileTimer = window.setTimeout(() => void this.link.send(this.target, 'duo.profile', this.profile(), null), delay);
  }

  friend(): DragonProfile | null { return Object.values(this.data.friends)[0] ?? null; }

  level(): { label: string; next: number | null; progress: number } {
    const f = this.data.friendship;
    let i = 0;
    while (i + 1 < DUO_LEVELS.length && f >= DUO_LEVELS[i + 1].at) i++;
    const cur = DUO_LEVELS[i], nxt = DUO_LEVELS[i + 1];
    return { label: cur.label, next: nxt?.at ?? null, progress: nxt ? (f - cur.at) / (nxt.at - cur.at) : 1 };
  }

  tricks(): Array<DuoTrick & { unlocked: boolean }> { return DUO_TRICKS.map(t => ({ ...t, unlocked: this.data.friendship >= t.at })); }

  visitsLeft(): number {
    if (this.data.sentDay !== todayKey()) { this.data.sentDay = todayKey(); this.data.sentToday = 0; }
    return Math.max(0, MAX_VISITS_PER_DAY - this.data.sentToday);
  }

  /** Prix d'un cadeau (payé avec son or). */
  giftPrice(g: VisitGift, itemPrice?: number): number {
    if (g.food) return FOODS.find(f => f.id === g.food)?.price ?? 0;
    return itemPrice ?? 0;
  }

  /** Envoie son dragon chez l'autre, avec un message et un cadeau éventuels. */
  async sendVisit(message: string, gift: VisitGift | undefined, price: number): Promise<'ok' | 'limit' | 'gold' | 'nofriend'> {
    if (!this.friend()) return 'nofriend';
    if (this.visitsLeft() <= 0) return 'limit';
    if (price > this.state.data.gold) return 'gold';
    if (price) this.state.addGold(-price);
    this.data.sentToday++;
    this.gain(gift ? 5 : 3);
    const visit: Visit = { id: Math.random().toString(36).slice(2, 10), from: this.profile(), message: message.trim().slice(0, 120) || undefined, gift, fp: this.data.friendship, at: Date.now() };
    const f = this.friend()!;
    await this.link.send(this.target, 'duo.visit', visit, {
      title: `${visit.from.name} vient rendre visite à ${f.name} !`,
      body: visit.message ? `« ${visit.message} »` : gift ? 'Et il apporte un cadeau…' : 'Ouvre l’appli pour les voir ensemble.',
      tag: 'visit-' + visit.id, channel: 'missions'
    });
    this.companion.remember('duo-sent-' + todayKey(), `Nous deux : visite chez ${f.name}`, `${this.companion.name} est allé voir ${f.name}${gift ? ' avec un cadeau' : ''}.`);
    this.save();
    return 'ok';
  }

  /** Amitié : gagnée des deux côtés ; chaque message porte la valeur de l'expéditeur (on garde la plus haute). */
  private gain(n: number): void {
    const before = this.level().label;
    this.data.friendship += n;
    const after = this.level().label;
    if (after !== before) {
      const f = this.friend();
      const trick = DUO_TRICKS.find(t => t.at === DUO_LEVELS.find(l => l.label === after)?.at);
      this.companion.remember('duo-level-' + after, `Nous deux : ${after}`, `${this.companion.name} et ${f?.name ?? 'son ami'} sont maintenant « ${after} ».${trick ? ` Nouveau tour à deux : ${trick.label}.` : ''}`);
      this.events.emit('toast', `${this.companion.name} et ${f?.name ?? 'son ami'} : ${after} !${trick ? ` Nouveau tour à deux : ${trick.label}` : ''}`);
    }
  }

  /** Messages reçus (renvoyés par ChildBook / ParentHub). */
  handle(msg: LinkMessage): boolean {
    if (msg.outgoing) return false;
    const p = msg.payload ?? {};
    if (msg.type === 'duo.profile') {
      if (!p.id || !p.name) return false;
      const wasDone = this.questState().done;
      this.data.friends[msg.from] = p as DragonProfile;
      const q = this.questState();
      if (!wasDone && q.done && !q.claimed) this.events.emit('toast', `Quête de famille « ${q.title} » réussie ! Ta récompense t’attend.`);
      this.save();
      return true;
    }
    if (msg.type === 'duo.visit') {
      const v = p as Visit;
      if (!v.from) return false;
      this.data.friends[msg.from] = v.from;
      this.data.friendship = Math.max(this.data.friendship, Number(v.fp) || 0);
      this.gain(3);
      if (v.gift?.food) { this.companion.data.food[v.gift.food] = (this.companion.data.food[v.gift.food] ?? 0) + 1; this.companion.save(); }
      if (v.gift?.item) this.state.grant(v.gift.item);
      this.companion.remember('duo-visit-' + v.id, `Nous deux : visite de ${v.from.name}`, v.message ? `« ${v.message} »` : `${v.from.name} est venu voir ${this.companion.name}.`);
      this.data.pending.push(v);
      this.data.pending = this.data.pending.slice(-5);
      this.save();
      this.events.emit('visit', v);
      return true;
    }
    if (msg.type === 'duo.request') { this.queueProfile(0); return true; }
    return false;
  }

  /** Visite affichée : on la retire de la file. */
  consume(id: string): void { this.data.pending = this.data.pending.filter(v => v.id !== id); this.save(); }

  /** Pendant une visite, un tour à deux renforce l'amitié (une fois par tour et par visite). */
  played(): void { this.gain(1); this.save(); }

  /** Demande le profil de l'autre (au démarrage). */
  hello(): void { this.queueProfile(500); void this.link.send(this.target, 'duo.request', {}, null); }
}

// Les deux dragons de la famille se rencontrent : visites, cadeaux, amitié entre dragons, tours à deux.
// Les messages passent par le lien maison (Wi-Fi) ; une visite envoyée hors de la maison arrive au retour.
import { EventBus } from '../core/events.js';
import type { GameState } from '../game/GameState.js';
import type { LinkMessage, Transport } from '../link/Transport.js';
import { readStore, writeStore } from '../platform/storage.js';
import type { Companion, FoodId } from './Companion.js';
import { FOODS } from './Companion.js';
import { todayKey } from './model.js';

/** Ce qu'on sait du dragon de l'autre (pour l'afficher pendant une visite). */
export interface DragonProfile { id: string; owner: string; name: string; variant: 'dragon' | 'dragonne'; stage: string; level: number; equipped: string[]; owned: string[] }

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
}

const KEY = 'quete-du-dragon:duo';
const MAX_VISITS_PER_DAY = 3;

export class Duo {
  readonly events = new EventBus<{ change: void; visit: Visit; toast: string }>();
  data: Data;
  private profileTimer = 0;

  constructor(private link: Transport, private state: GameState, private companion: Companion, private selfId: string,
    private ownerName: string, private role: 'child' | 'parent') {
    this.data = { friends: {}, friendship: 0, sentDay: todayKey(), sentToday: 0, pending: [], ...readStore<Partial<Data>>(KEY, {}) };
    state.events.on('change', () => this.queueProfile());
    companion.events.on('change', () => this.queueProfile());
  }

  private save(): void { writeStore(KEY, this.data); this.events.emit('change', undefined); }

  /** Destinataires : l'enfant écrit aux parents, le parent aux enfants. */
  private get target(): string { return this.role === 'child' ? 'parents' : 'children'; }

  profile(): DragonProfile {
    const d = this.state.data;
    return {
      id: this.selfId, owner: this.ownerName, name: this.companion.name, variant: this.role === 'child' ? 'dragon' : 'dragonne',
      stage: d.stage, level: d.level, equipped: Object.values(d.equipped), owned: d.owned
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
      this.data.friends[msg.from] = p as DragonProfile;
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

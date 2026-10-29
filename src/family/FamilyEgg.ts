// L'œuf de famille : un œuf commun à l'enfant et au parent. Chaque quête faite par l'enfant et chaque défi
// fait par le parent le réchauffe. Arrivé au but, il éclot en un petit dragon partagé par les deux téléphones.
//
// Pas de serveur : chaque téléphone compte ses propres quêtes (« mine ») et reçoit celles des autres (« others ») :
// l'enfant envoie les siennes dans son état (snapshot.egg) ; le parent renvoie à chaque enfant ses défis + les
// quêtes des autres enfants (message « egg.sync »). Les deux téléphones arrivent ainsi au même total et éclosent
// d'eux-mêmes. Le dessin de l'œuf et le nom du petit sont choisis par l'enfant et suivis par le parent.
import { EventBus } from '../core/events.js';
import { readStore, writeStore } from '../platform/storage.js';

/** Quêtes et défis nécessaires pour faire éclore l'œuf (environ une semaine en famille). */
export const EGG_GOAL = 35;
/** Nombre de dessins d'œuf disponibles (assets/family/egg_<n>.webp). */
export const EGG_DESIGNS = 5;
const KEY = 'quete-du-dragon:family-egg';

interface EggData {
  /** Quêtes (enfant) ou défis (parent) faits sur ce téléphone. */
  mine: number;
  /** Celles de l'autre côté de la famille, reçues par le lien maison. */
  others: number;
  /** Dessin choisi (1..EGG_DESIGNS). */
  design: number;
  /** Nom du petit dragon (donné par l'enfant). */
  name: string;
  hatchedAt: number | null;
  /** Éclosion déjà montrée sur ce téléphone (la mise en scène ne se joue qu'une fois). */
  hatchSeen: boolean;
  /** Dernier total affiché dans la fenêtre (pour animer les nouvelles chaleurs). */
  seenTotal: number;
}

export class FamilyEgg {
  readonly events = new EventBus<{ change: void; hatch: void }>();
  data: EggData;

  constructor(readonly role: 'child' | 'parent') {
    this.data = { mine: 0, others: 0, design: 1, name: '', hatchedAt: null, hatchSeen: false, seenTotal: 0, ...readStore<Partial<EggData>>(KEY, {}) };
  }

  get total(): number { return this.data.mine + this.data.others; }
  get hatched(): boolean { return this.data.hatchedAt !== null; }
  /** Avancement 0..1. */
  get progress(): number { return Math.min(1, this.total / EGG_GOAL); }
  /** État de l'œuf, de 1 (calme) à 5 (sur le point d'éclore). */
  get stage(): number { return Math.min(5, 1 + Math.floor(this.progress * 5)); }
  get babyName(): string { return this.data.name || 'le petit'; }

  /** Une quête (enfant) ou un défi (parent) fait sur ce téléphone. */
  addMine(n = 1): void { this.data.mine += n; this.commit(); }
  /** Total de l'autre côté, reçu par le lien maison (ne fait que monter). */
  setOthers(n: number): void {
    // les quêtes faites ne se défont pas : un message arrivé en retard ne fait jamais reculer l'œuf
    if (!Number.isFinite(n) || n <= this.data.others) return;
    this.data.others = Math.floor(n);
    this.commit();
  }
  /** Dessin et nom suivis depuis le téléphone de l'enfant (côté parent). */
  follow(design?: number, name?: string): void {
    let changed = false;
    if (design && design >= 1 && design <= EGG_DESIGNS && design !== this.data.design) { this.data.design = design; changed = true; }
    if (name && name !== this.data.name) { this.data.name = name.slice(0, 20); changed = true; }
    if (changed) this.commit();
  }
  chooseDesign(n: number): void { if (n >= 1 && n <= EGG_DESIGNS && !this.hatched) { this.data.design = n; this.commit(); } }
  setName(name: string): void { const v = name.trim().slice(0, 20); if (v) { this.data.name = v; this.commit(); } }
  markSeen(): void { this.data.seenTotal = this.total; writeStore(KEY, this.data); }
  markHatchSeen(): void { this.data.hatchSeen = true; writeStore(KEY, this.data); }

  /** À mettre dans l'état envoyé aux parents. */
  snapshot(): { mine: number; design: number; name: string } { return { mine: this.data.mine, design: this.data.design, name: this.data.name }; }

  private commit(): void {
    if (!this.hatched && this.total >= EGG_GOAL) {
      this.data.hatchedAt = Date.now();
      writeStore(KEY, this.data);
      this.events.emit('hatch', undefined);
    } else writeStore(KEY, this.data);
    this.events.emit('change', undefined);
  }
}

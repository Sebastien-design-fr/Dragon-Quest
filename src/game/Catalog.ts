// Accès aux définitions de jeu (toutes issues de www/data/). L'interface ne connaît aucun
// équipement en dur : elle interroge ce catalogue, qui découvre tout dans les JSON.
import { loadJSON } from '../core/data.js';
import type { BadgeDef } from '../family/badges.js';
import type {
  CategoryDef, CollectionDef, EquipmentDef, ParticlePreset, QualityLevel, QualityPreset, RarityDef, StageDef
} from '../core/types.js';

export class Catalog {
  stages: StageDef[] = [];
  /** Courbe d'XP : linéaire (base + step × (N−1)) si step est donné, sinon géométrique (base × growth^(N−1)). */
  xp: { base: number; step?: number; growth?: number } = { base: 190, step: 26 };
  categories = new Map<string, CategoryDef>();
  rarities = new Map<string, RarityDef>();
  collections = new Map<string, CollectionDef>();
  items = new Map<string, EquipmentDef>();
  presets = new Map<string, ParticlePreset>();
  quality = {} as Record<QualityLevel, QualityPreset>;
  badges: BadgeDef[] = [];

  async load(): Promise<void> {
    const [st, cat, rar, col, eq, fx, q, bd] = await Promise.all([
      loadJSON<{ stages: StageDef[]; xp: { base: number; step?: number; growth?: number } }>('data/stages.json'),
      loadJSON<{ categories: CategoryDef[] }>('data/categories.json'),
      loadJSON<{ rarities: RarityDef[] }>('data/rarities.json'),
      loadJSON<{ collections: CollectionDef[] }>('data/collections.json'),
      loadJSON<{ items: EquipmentDef[] }>('data/equipment.json'),
      loadJSON<{ presets: ParticlePreset[] }>('data/effects.json'),
      loadJSON<Record<QualityLevel, QualityPreset>>('data/quality.json'),
      loadJSON<{ badges: BadgeDef[] }>('data/badges.json').catch(() => ({ badges: [] as BadgeDef[] }))
    ]);
    this.stages = [...st.stages].sort((a, b) => a.minLevel - b.minLevel);
    this.xp = st.xp;
    cat.categories.sort((a, b) => a.order - b.order).forEach(c => this.categories.set(c.id, c));
    rar.rarities.sort((a, b) => a.order - b.order).forEach(r => this.rarities.set(r.id, r));
    col.collections.forEach(c => this.collections.set(c.id, c));
    fx.presets.forEach(p => this.presets.set(p.id, p));
    this.quality = q;
    this.badges = bd.badges;
    for (const item of eq.items) this.validate(item) && this.items.set(item.id, item);
  }

  /** Vérification légère : un équipement mal renseigné est ignoré (avec un message) au lieu de casser le jeu. */
  private validate(it: EquipmentDef): boolean {
    const problems: string[] = [];
    if (this.items.has(it.id)) problems.push('identifiant en double');
    if (!this.categories.has(it.category)) problems.push(`catégorie inconnue « ${it.category} »`);
    if (!this.rarities.has(it.rarity)) problems.push(`rareté inconnue « ${it.rarity} »`);
    if (it.collection && !this.collections.has(it.collection)) problems.push(`collection inconnue « ${it.collection} »`);
    if (it.effect && !this.presets.has(it.effect)) problems.push(`effet inconnu « ${it.effect} »`);
    if (problems.length) console.warn(`Équipement ignoré (${it.id}) : ${problems.join(', ')}`);
    return problems.length === 0;
  }

  item(id: string): EquipmentDef | undefined { return this.items.get(id); }
  stage(id: string): StageDef | undefined { return this.stages.find(s => s.id === id); }

  isCollectionActive(id: string, date = new Date()): boolean {
    const c = this.collections.get(id);
    if (!c) return false;
    const md = `${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    return c.from <= c.to ? md >= c.from && md <= c.to : md >= c.from || md <= c.to;
  }

  activeCollections(date = new Date()): CollectionDef[] {
    return [...this.collections.values()].filter(c => this.isCollectionActive(c.id, date));
  }

  /** Objets visibles en boutique : permanents + collections en cours (ou toutes, en mode test). */
  shopItems(category: string | null, opts: { date?: Date; allCollections?: boolean } = {}): EquipmentDef[] {
    return this.sorted([...this.items.values()].filter(it =>
      (!category || it.category === category) &&
      (!it.collection || opts.allCollections || this.isCollectionActive(it.collection, opts.date))
    ));
  }

  sorted(list: EquipmentDef[]): EquipmentDef[] {
    const co = (id: string) => this.categories.get(id)?.order ?? 99;
    const ro = (id: string) => this.rarities.get(id)?.order ?? 99;
    return list.sort((a, b) => co(a.category) - co(b.category) || ro(a.rarity) - ro(b.rarity) || a.price - b.price);
  }
}

const pad = (n: number) => String(n).padStart(2, '0');

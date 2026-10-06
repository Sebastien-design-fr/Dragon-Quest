// État du joueur : niveau, XP, stade, monnaie, inventaire, équipement porté, réglages.
// Toute modification passe par ici, déclenche un événement et une sauvegarde différée.
import { EventBus } from '../core/events.js';
import type { CategoryId, EquipmentDef, QualityLevel, SaveData, StageDef } from '../core/types.js';
import type { Catalog } from './Catalog.js';
import type { SaveBackend } from './save/SaveBackend.js';

export const SAVE_VERSION = 1;

type Events = {
  change: SaveData;
  levelUp: { level: number };
  evolve: { from: StageDef; to: StageDef };
};

export type ActionResult = { ok: true } | { ok: false; reason: string };

export class GameState {
  readonly events = new EventBus<Events>();
  data: SaveData;
  private timer = 0;

  constructor(private catalog: Catalog, private backend: SaveBackend) {
    this.data = this.fresh();
  }

  private fresh(): SaveData {
    return {
      version: SAVE_VERSION, updatedAt: Date.now(),
      stage: this.catalog.stages[0]?.id ?? 'baby', level: 1, xp: 0, gold: 100,
      owned: [], equipped: {}, settings: { quality: 'HIGH', effects: true }
    };
  }

  async load(): Promise<void> {
    const saved = await this.backend.load();
    if (saved) this.data = this.migrate(saved);
    // nettoyage : objets disparus du catalogue
    this.data.owned = this.data.owned.filter(id => this.catalog.items.has(id));
    for (const [cat, id] of Object.entries(this.data.equipped)) if (!this.catalog.items.has(id)) delete this.data.equipped[cat];
    this.data.stage = this.stageForLevel(this.data.level).id;
  }

  /** Migrations de format de sauvegarde (à compléter quand SAVE_VERSION augmente). */
  private migrate(d: SaveData): SaveData {
    const base = this.fresh();
    return { ...base, ...d, settings: { ...base.settings, ...(d.settings ?? {}) }, version: SAVE_VERSION };
  }

  private commit(): void {
    this.data.updatedAt = Date.now();
    this.events.emit('change', this.data);
    clearTimeout(this.timer);
    this.timer = window.setTimeout(() => void this.backend.save(this.data), 300);
  }

  async reset(): Promise<void> {
    await this.backend.clear();
    this.data = this.fresh();
    this.commit();
  }

  // ---------- Progression ----------
  xpToNext(level = this.data.level): number {
    return Math.round(this.catalog.xp.base * Math.pow(this.catalog.xp.growth, level - 1));
  }
  stageForLevel(level: number): StageDef {
    let s = this.catalog.stages[0];
    for (const st of this.catalog.stages) if (level >= st.minLevel) s = st;
    return s;
  }
  get stage(): StageDef { return this.catalog.stage(this.data.stage) ?? this.catalog.stages[0]; }
  nextStage(): StageDef | null {
    const i = this.catalog.stages.findIndex(s => s.id === this.data.stage);
    return this.catalog.stages[i + 1] ?? null;
  }

  addXp(amount: number): void {
    const before = this.stage;
    this.data.xp += amount;
    let gained = false;
    while (this.data.xp >= this.xpToNext()) {
      this.data.xp -= this.xpToNext();
      this.data.level++;
      this.data.gold += 50; // petite récompense par niveau
      gained = true;
    }
    const after = this.stageForLevel(this.data.level);
    this.data.stage = after.id;
    // Les événements partent avant « change » : l'interface sait qu'une évolution animée est en cours.
    if (after.id !== before.id) this.events.emit('evolve', { from: before, to: after });
    else if (gained) this.events.emit('levelUp', { level: this.data.level });
    this.commit();
  }

  addGold(n: number): void { this.data.gold += n; this.commit(); }

  // ---------- Boutique & inventaire ----------
  owns(id: string): boolean { return this.data.owned.includes(id); }
  isEquipped(id: string): boolean { return Object.values(this.data.equipped).includes(id); }
  isCompatible(def: EquipmentDef, stageId = this.data.stage): boolean { return def.compatibleDragonStages.includes(stageId); }

  buy(id: string): ActionResult {
    const def = this.catalog.item(id);
    if (!def) return { ok: false, reason: 'Objet inconnu.' };
    if (this.owns(id)) return { ok: false, reason: 'Déjà possédé.' };
    if (this.data.gold < def.price) return { ok: false, reason: 'Pas assez d’or.' };
    this.data.gold -= def.price;
    this.data.owned.push(id);
    this.commit();
    return { ok: true };
  }

  equip(id: string): ActionResult {
    const def = this.catalog.item(id);
    if (!def || !this.owns(id)) return { ok: false, reason: 'Objet non possédé.' };
    this.data.equipped[def.category] = id; // un objet par catégorie : remplace l'éventuel précédent
    this.commit();
    return { ok: true };
  }

  unequip(category: CategoryId): void { delete this.data.equipped[category]; this.commit(); }

  /** Équipements portés (définitions), éventuellement avec un essai de boutique par-dessus. */
  equippedDefs(preview?: EquipmentDef | null): EquipmentDef[] {
    const map: Record<string, string> = { ...this.data.equipped };
    if (preview) map[preview.category] = preview.id;
    return Object.values(map).map(id => this.catalog.item(id)).filter((d): d is EquipmentDef => !!d);
  }

  // ---------- Réglages ----------
  setQuality(q: QualityLevel): void { this.data.settings.quality = q; this.commit(); }
  setEffects(on: boolean): void { this.data.settings.effects = on; this.commit(); }
}

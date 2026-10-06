// Coquille de l'application : HUD, vue du dragon (persistante en haut d'écran), onglets.
import type { EquipmentDef, StageDef } from '../core/types.js';
import type { DragonView } from '../engine/DragonView.js';
import type { Catalog } from '../game/Catalog.js';
import type { GameState } from '../game/GameState.js';
import { ICONS, clear, h, icon } from './dom.js';
import { DragonScreen } from './screens/DragonScreen.js';
import { InventoryScreen } from './screens/InventoryScreen.js';
import { SettingsScreen } from './screens/SettingsScreen.js';
import { ShopScreen } from './screens/ShopScreen.js';

export interface Screen { id: string; label: string; icon: string; mount(el: HTMLElement): void; unmount?(): void; refresh?(): void }

export class App {
  /** Essai en boutique : affiché sur le dragon sans être acheté ni équipé. */
  preview: EquipmentDef | null = null;
  /** Mode test : stade affiché différent du stade réel (ne modifie pas la sauvegarde). */
  stageOverride: StageDef | null = null;
  allCollections = false;
  sleeping = false;

  private screens: Screen[];
  private current: Screen | null = null;
  private screenEl: HTMLElement;
  private hud: HTMLElement;
  private toastEl: HTMLElement;
  private tabs: HTMLElement;

  constructor(readonly root: HTMLElement, readonly catalog: Catalog, readonly state: GameState, readonly view: DragonView) {
    this.screens = [new DragonScreen(this), new ShopScreen(this), new InventoryScreen(this), new SettingsScreen(this)];
    this.hud = root.querySelector('#hud')!;
    this.screenEl = root.querySelector('#screen')!;
    this.toastEl = root.querySelector('#toast')!;
    this.tabs = root.querySelector('#tabs')!;

    for (const s of this.screens) {
      this.tabs.append(h('button', { class: 'tab', 'data-id': s.id, onclick: () => this.show(s.id) }, icon(s.icon, 22), h('span', null, s.label)));
    }

    state.events.on('change', d => {
      if (!this.stageOverride && !this.evolving && this.view.stage?.id !== d.stage) void this.view.setStage(state.stage, true);
      this.syncEquipment();
      this.view.setQuality(catalog.quality[d.settings.quality], d.settings.effects);
      this.renderHud();
      this.current?.refresh?.();
    });
    state.events.on('levelUp', ({ level }) => { this.toast(`Niveau ${level} !`); void this.act('level_up'); });
    state.events.on('evolve', ({ to }) => this.evolve(to));

    this.renderHud();
    this.show('dragon');
  }

  show(id: string): void {
    const next = this.screens.find(s => s.id === id);
    if (!next) return;
    this.current?.unmount?.();
    if (this.preview) { this.preview = null; this.syncEquipment(); }
    clear(this.screenEl);
    this.current = next;
    next.mount(this.screenEl);
    this.screenEl.scrollTop = 0;
    this.tabs.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', (t as HTMLElement).dataset.id === id));
  }

  // ----- Dragon -----
  syncEquipment(): void { this.view.setEquipment(this.state.equippedDefs(this.preview)); }

  setPreview(def: EquipmentDef | null): void { this.preview = def; this.syncEquipment(); }

  async act(anim: string): Promise<void> {
    if (this.sleeping && anim !== 'sleep') this.toggleSleep(false);
    await this.view.play(anim);
  }

  toggleSleep(force?: boolean): void {
    this.sleeping = force ?? !this.sleeping;
    void this.view.play(this.sleeping ? 'sleep' : 'idle');
    this.current?.refresh?.();
  }

  private evolving = false;

  private evolve(to: StageDef): void {
    if (this.stageOverride) return; // en mode test, la vue reste sur le stade forcé
    this.evolving = true;
    this.toggleSleep(false);
    this.view.onSwapStage = () => this.view.setStage(to);
    void this.view.play('evolution').then(async () => {
      this.view.onSwapStage = null;
      this.evolving = false;
      if (this.view.stage?.id !== to.id) await this.view.setStage(to); // sécurité si l'animation a été interrompue
      this.toast(`Évolution : ${to.label} !`);
    });
  }

  async setStageOverride(stage: StageDef | null): Promise<void> {
    this.stageOverride = stage;
    await this.view.setStage(stage ?? this.state.stage);
    this.renderHud();
  }

  // ----- HUD -----
  renderHud(): void {
    const d = this.state.data;
    const stage = this.stageOverride ?? this.state.stage;
    const need = this.state.xpToNext();
    clear(this.hud);
    this.hud.append(
      h('div', { class: 'hud-id' },
        h('div', { class: 'hud-stage' }, stage.label, this.stageOverride ? h('em', null, ' (aperçu)') : null),
        h('div', { class: 'hud-level' }, `Niveau ${d.level}`)),
      h('div', { class: 'hud-xp' },
        h('div', { class: 'bar' }, h('div', { class: 'fill', style: { width: `${Math.min(100, (d.xp / need) * 100)}%` } })),
        h('div', { class: 'hud-xp-label' }, `${d.xp} / ${need} XP`)),
      h('div', { class: 'gold' }, icon(ICONS.coin, 18), h('span', null, d.gold.toLocaleString('fr-FR')))
    );
  }

  toast(msg: string): void {
    const t = h('div', { class: 'toast-msg' }, msg);
    while (this.toastEl.children.length >= 2) this.toastEl.firstElementChild?.remove();
    this.toastEl.append(t);
    setTimeout(() => t.classList.add('out'), 1800);
    setTimeout(() => t.remove(), 2300);
  }
}

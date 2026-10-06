// Coquille de l'application : HUD, vue du dragon (en haut), écrans et onglets selon le profil.
import type { EquipmentDef, StageDef } from '../core/types.js';
import type { DragonView } from '../engine/DragonView.js';
import type { ChildBook } from '../family/ChildBook.js';
import type { ParentHub } from '../family/ParentHub.js';
import type { Reminders } from '../family/Reminders.js';
import type { Catalog } from '../game/Catalog.js';
import type { GameState } from '../game/GameState.js';
import { SimTransport, type LinkState, type Transport } from '../link/Transport.js';
import { ICONS, clear, h, icon, put } from './dom.js';
import { DragonScreen } from './screens/DragonScreen.js';
import { FamilyScreen } from './screens/FamilyScreen.js';
import { InventoryScreen } from './screens/InventoryScreen.js';
import { MissionsScreen } from './screens/MissionsScreen.js';
import { ParentMissionsScreen } from './screens/ParentMissionsScreen.js';
import { SettingsScreen } from './screens/SettingsScreen.js';
import { ShopScreen } from './screens/ShopScreen.js';
import { ValidationsScreen } from './screens/ValidationsScreen.js';

export interface Screen { id: string; label: string; icon: string; mount(el: HTMLElement): void; unmount?(): void; refresh?(): void; badge?(): number }

export interface FamilyContext {
  link: Transport;
  linkState: LinkState;
  reminders: Reminders;
  book: ChildBook | null;
  hub: ParentHub | null;
}

export const APP_VERSION = '0.2.0';

export class App {
  /** Essai en boutique : affiché sur le dragon sans être acheté ni équipé. */
  preview: EquipmentDef | null = null;
  /** Mode test : stade affiché différent du stade réel (ne modifie pas la sauvegarde). */
  stageOverride: StageDef | null = null;
  allCollections = false;
  sleeping = false;
  /** Outils de test (progression, aperçu des stades…), cachés par défaut. */
  devMode = false;
  /** Parent : enfant affiché. */
  selectedChild: string | null = null;

  private screens: Screen[];
  private current: Screen | null = null;
  private screenEl: HTMLElement;
  private hud: HTMLElement;
  private toastEl: HTMLElement;
  private tabs: HTMLElement;
  private tray: HTMLElement;
  private evolving = false;

  constructor(readonly root: HTMLElement, readonly catalog: Catalog, readonly state: GameState, readonly view: DragonView, readonly family: FamilyContext) {
    this.hud = root.querySelector('#hud')!;
    this.screenEl = root.querySelector('#screen')!;
    this.toastEl = root.querySelector('#toast')!;
    this.tabs = root.querySelector('#tabs')!;
    this.tray = root.querySelector('#sim-tray')!;

    this.screens = this.isParent
      ? [new ValidationsScreen(this), new ParentMissionsScreen(this), new FamilyScreen(this)]
      : [new DragonScreen(this), new MissionsScreen(this), new ShopScreen(this), new InventoryScreen(this), new SettingsScreen(this)];
    this.buildTabs();

    state.events.on('change', d => {
      this.view.setQuality(catalog.quality[d.settings.quality], d.settings.effects);
      if (this.isParent) { this.refresh(); return; }
      if (!this.stageOverride && !this.evolving && this.view.stage?.id !== d.stage) void this.view.setStage(state.stage, true);
      this.syncEquipment();
      this.refresh();
    });
    state.events.on('levelUp', ({ level }) => { if (!this.isParent) { this.toast(`Niveau ${level} !`); void this.act('level_up'); } });
    state.events.on('evolve', ({ to }) => { if (!this.isParent) this.evolve(to); });

    const book = family.book, hub = family.hub;
    book?.events.on('change', () => this.refresh());
    book?.events.on('toast', t => this.toast(t));
    hub?.events.on('change', () => { this.showChildDragon(); this.refresh(); });
    hub?.events.on('toast', t => this.toast(t));

    if (family.link instanceof SimTransport) {
      const sim = family.link;
      sim.onNotifs = () => this.renderTray();
      this.renderTray();
    }

    if (this.isParent) {
      this.selectedChild = hub?.childIds()[0] ?? null;
      this.showChildDragon();
    }
    this.renderHud();
    this.show(this.screens[0].id);
  }

  get isParent(): boolean { return this.family.linkState.role === 'parent'; }

  private buildTabs(): void {
    clear(this.tabs);
    this.tabs.style.gridTemplateColumns = `repeat(${this.screens.length}, minmax(0, 1fr))`;
    for (const s of this.screens) {
      const badge = s.badge?.() ?? 0;
      this.tabs.append(h('button', { class: 'tab', 'data-id': s.id, onclick: () => this.show(s.id) },
        h('span', { class: 'tab-icon' }, icon(s.icon, 22), badge ? h('span', { class: 'tab-badge' }, String(badge)) : null),
        h('span', null, s.label)));
    }
    this.tabs.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', (t as HTMLElement).dataset.id === this.current?.id));
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
    this.buildTabs();
  }

  refresh(): void {
    this.renderHud();
    this.current?.refresh?.();
    this.buildTabs();
  }

  /** Recharge l'état du lien (membres, batterie…) puis rafraîchit. */
  async refreshLink(): Promise<void> {
    this.family.linkState = await this.family.link.getState();
    this.family.hub?.syncMembers(this.family.linkState.members);
    this.refresh();
  }

  // ----- Dragon -----
  syncEquipment(): void {
    if (this.isParent) return;
    this.view.setEquipment(this.state.equippedDefs(this.preview));
  }

  setPreview(def: EquipmentDef | null): void { this.preview = def; this.syncEquipment(); }

  /** Parent : affiche le dragon de l'enfant sélectionné (d'après son dernier état reçu). */
  showChildDragon(): void {
    if (!this.isParent) return;
    const snap = this.selectedChild ? this.family.hub?.child(this.selectedChild)?.snapshot : null;
    const stage = (snap && this.catalog.stage(snap.stage)) || this.catalog.stages[0];
    if (this.view.stage?.id !== stage.id) void this.view.setStage(stage, true).then(() => this.applyChildEquipment());
    else this.applyChildEquipment();
  }
  private applyChildEquipment(): void {
    const snap = this.selectedChild ? this.family.hub?.child(this.selectedChild)?.snapshot : null;
    const defs = (snap?.equipped ?? []).map(id => this.catalog.item(id)).filter((d): d is EquipmentDef => !!d);
    this.view.setEquipment(defs);
  }

  async act(anim: string): Promise<void> {
    if (this.sleeping && anim !== 'sleep') this.toggleSleep(false);
    await this.view.play(anim);
  }

  toggleSleep(force?: boolean): void {
    this.sleeping = force ?? !this.sleeping;
    void this.view.play(this.sleeping ? 'sleep' : 'idle');
    this.current?.refresh?.();
  }

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
    this.syncEquipment();
    this.renderHud();
  }

  // ----- HUD -----
  renderHud(): void {
    clear(this.hud);
    if (this.isParent) {
      const c = this.selectedChild ? this.family.hub?.child(this.selectedChild) : null;
      const snap = c?.snapshot;
      put(this.hud,
        h('div', { class: 'hud-id' },
          h('div', { class: 'hud-stage' }, c ? c.name : 'Espace parent'),
          h('div', { class: 'hud-level' }, snap ? `${snap.stageLabel} · niveau ${snap.level}` : c ? 'En attente de son téléphone' : 'Aucun enfant relié')),
        snap ? h('div', { class: 'hud-xp' },
          h('div', { class: 'bar' }, h('div', { class: 'fill', style: { width: `${Math.min(100, (snap.xp / Math.max(1, snap.xpToNext)) * 100)}%` } })),
          h('div', { class: 'hud-xp-label' }, `${snap.xp} / ${snap.xpToNext} XP`)) : h('div', { class: 'hud-xp' }),
        snap ? h('div', { class: 'gold' }, icon(ICONS.coin, 18), h('span', null, snap.gold.toLocaleString('fr-FR'))) : null);
      return;
    }
    const d = this.state.data;
    const stage = this.stageOverride ?? this.state.stage;
    const need = this.state.xpToNext();
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
    setTimeout(() => t.classList.add('out'), 2200);
    setTimeout(() => t.remove(), 2700);
  }

  // ----- Notifications simulées (navigateur uniquement) -----
  private renderTray(): void {
    const sim = this.family.link as SimTransport;
    clear(this.tray);
    for (const n of sim.notifications().slice(-3)) {
      put(this.tray, h('div', { class: 'sim-notif' },
        h('div', { class: 'sim-notif-title' }, n.spec.title),
        h('div', { class: 'sim-notif-body' }, n.spec.body),
        h('div', { class: 'row' },
          ...(n.spec.actions ?? []).map((a, i) => h('button', { class: 'btn ghost small-btn', onclick: () => void sim.act(n.spec.tag, i) }, a.label)),
          h('button', { class: 'btn ghost small-btn', onclick: () => void sim.dismiss(n.spec.tag) }, 'Fermer'))));
    }
  }
}

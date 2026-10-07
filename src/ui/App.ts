// Coquille de l'application : HUD, vue du dragon (en haut), écrans et onglets selon le profil.
import type { EquipmentDef, StageDef } from '../core/types.js';
import type { DragonView } from '../engine/DragonView.js';
import type { ChildBook } from '../family/ChildBook.js';
import { isNight, type Companion } from '../family/Companion.js';
import { Sound } from '../engine/Sound.js';
import { sayFor, thoughts, type Thought, type ThoughtAction } from '../family/Thoughts.js';
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
  companion: Companion | null;
}

export const APP_VERSION = '0.5.0';

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
  /** Geste sur le dragon : caresser (par défaut) ou laver. */
  careMode: 'pet' | 'wash' = 'pet';
  private bubble: HTMLElement;
  private bubbleTimer = 0;
  private bubbleAction: ThoughtAction = null;
  private shownAt = new Map<string, number>();
  private remindTimer = 0;
  private stroke: { x: number; y: number; dist: number; moved: number; pets: number } | null = null;

  constructor(readonly root: HTMLElement, readonly catalog: Catalog, readonly state: GameState, readonly view: DragonView, readonly family: FamilyContext) {
    this.hud = root.querySelector('#hud')!;
    this.screenEl = root.querySelector('#screen')!;
    this.toastEl = root.querySelector('#toast')!;
    this.tabs = root.querySelector('#tabs')!;
    this.tray = document.querySelector('#sim-tray')!;

    this.screens = this.isParent
      ? [new ValidationsScreen(this), new ParentMissionsScreen(this), new FamilyScreen(this)]
      : [new DragonScreen(this), new MissionsScreen(this), new ShopScreen(this), new InventoryScreen(this), new SettingsScreen(this)];
    this.buildTabs();

    // Sons : réglages, animations, or et gemmes gagnés.
    const applySound = () => { Sound.muted = state.data.settings.sound === false; Sound.volume = state.data.settings.volume ?? 0.7; };
    applySound();
    view.onClip = clip => Sound.forClip(clip, view.stage?.id ?? 'adult');
    Sound.warm(['purr', 'chirp', 'coins', 'gem']);
    let lastGold = state.data.gold;
    state.events.on('change', d => {
      applySound();
      if (!this.isParent && d.gold > lastGold) void Sound.play('coins', { user: true });
      lastGold = d.gold;
    });
    let lastGems = family.book?.data.gems ?? 0;
    family.book?.events.on('change', () => {
      const g = family.book!.data.gems;
      if (g > lastGems) void Sound.play('gem', { user: true });
      lastGems = g;
    });
    const nightTint = () => { view.backdrop.night = isNight() ? 1 : 0; };
    nightTint();
    window.setInterval(nightTint, 60000);

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
    const tiredNow = () => (book?.data.energy ?? 100) < 25 || !!family.companion?.data.sick;
    book?.events.on('change', () => { this.view.tired = tiredNow(); this.refresh(); });
    if (book) this.view.tired = tiredNow();
    book?.events.on('toast', t => this.toast(t));
    book?.events.on('story', t => setTimeout(() => this.say(t, null, 10000), 900));
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
    // Gestes sur le dragon : la tête suit le doigt ; frotter = caresser ou laver.
    this.bubble = h('button', { class: 'bubble', onclick: () => this.bubbleTap() });
    root.querySelector('.stage-view')?.append(this.bubble);
    const cv = view.canvas;
    cv.addEventListener('pointerdown', e => this.pointer(e, 'down'));
    cv.addEventListener('pointermove', e => this.pointer(e, 'move'));
    cv.addEventListener('pointerup', e => this.pointer(e, 'up'));
    cv.addEventListener('pointercancel', e => this.pointer(e, 'up'));
    cv.addEventListener('pointerleave', () => { view.lookAt(null); this.endStroke(); });

    const comp = family.companion;
    if (comp && !this.isParent) {
      comp.events.on('change', () => { this.applyCare(); this.refresh(); this.queueReminders(); });
      comp.events.on('toast', t => this.toast(t));
      comp.events.on('react', r => {
        if (r.anim) void this.act(r.anim);
        if (r.fx) view.emit(r.fx, r.fx === 'shine' ? 'body_center' : 'head_anchor');
        if (r.say) this.say(sayFor(r.say), null, 4000);
      });
      if (isNight() && comp.data.tucked) this.sleeping = true; // déjà couché ce soir
      this.applyCare();
      void view.play(this.sleeping ? 'sleep' : this.baseLoop());
      const away = comp.greet();
      setTimeout(() => {
        if (away && !this.sleeping) { void this.act('welcome'); this.say(sayFor('welcome'), null, 5000); }
        else this.think(true);
      }, 1500);
      window.setInterval(() => { comp.tick(); this.applyCare(); this.think(false); }, 40000);
      // Malade : il éternue de petits nuages de fumée.
      window.setInterval(() => { if (comp.data.sick && !this.sleeping) view.emit('sneeze', 'mouth_anchor'); }, 9000);
      document.addEventListener('visibilitychange', () => { if (!document.hidden) setTimeout(() => this.think(true), 1200); });
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
    const was = this.sleeping;
    this.sleeping = force ?? !this.sleeping;
    const comp = this.family.companion;
    if (this.sleeping && !was && comp?.tuck()) this.say(sayFor('tuck'), null, 4000);
    void this.view.play(this.sleeping ? 'sleep' : this.baseLoop());
    if (was && !this.sleeping && force === undefined) {
      void this.view.play('wake');
      if (isNight()) this.say(sayFor('wake'), null, 4000);
    }
    this.current?.refresh?.();
  }

  /** Boucle de repos selon son état : triste s'il est négligé. */
  baseLoop(): string { return this.family.companion?.sad() ? 'sad' : 'idle'; }

  /** Reporte l'état du compagnon sur le dragon affiché (saleté, tristesse). */
  private applyCare(): void {
    const c = this.family.companion;
    if (!c || this.isParent) return;
    this.view.tired = (this.family.book?.data.energy ?? 100) < 25 || c.data.sick;
    this.view.dirt = Math.max(0, Math.min(1, (70 - c.data.clean) / 70));
    if (!this.sleeping) { const loop = this.baseLoop(); if (this.view.animator.baseId?.split('@')[0] !== loop) void this.view.play(loop); }
  }

  private queueReminders(): void {
    clearTimeout(this.remindTimer);
    this.remindTimer = window.setTimeout(() => void this.family.book?.refreshReminders(), 4000);
  }

  // ----- Bulles de pensée -----
  say(text: string, action: ThoughtAction = null, ms = 7000): void {
    this.bubble.textContent = text;
    this.bubbleAction = action;
    this.bubble.classList.toggle('actionable', !!action);
    this.placeBubble();
    this.bubble.classList.add('show');
    clearTimeout(this.bubbleTimer);
    this.bubbleTimer = window.setTimeout(() => this.bubble.classList.remove('show'), ms);
  }

  private placeBubble(): void {
    const p = this.view.screenPos('head_anchor');
    const host = this.bubble.parentElement;
    if (!p || !host) return;
    const w = host.clientWidth;
    const bw = Math.min(240, w - 24);
    this.bubble.style.maxWidth = `${bw}px`;
    // à gauche de la tête, au-dessus ; reste dans la scène
    const right = Math.max(12, Math.min(w - p.x + 10, w - bw - 12));
    this.bubble.style.right = `${right}px`;
    this.bubble.style.top = `${Math.max(8, p.y - 90)}px`;
  }

  /** Choisit une pensée : les rappels importants d'abord, sans répéter la même trop souvent. */
  think(force: boolean): void {
    const comp = this.family.companion;
    if (!comp || this.isParent || this.evolving) return;
    if (!force && this.bubble.classList.contains('show')) return;
    if (this.sleeping && !isNight()) return;
    const now = Date.now();
    const list = thoughts(this.family.book, comp, this.family.book?.childName ?? '');
    const fresh = (t: Thought) => now - (this.shownAt.get(t.id) ?? 0) > (t.priority >= 85 ? 3 : t.priority >= 60 ? 8 : 20) * 60000;
    let t = list.find(x => x.priority >= 60 && fresh(x));
    if (!t) {
      if (!force && Math.random() < 0.5) return;
      const pool = list.filter(fresh).slice(0, 5);
      t = pool[Math.floor(Math.random() * pool.length)];
    }
    if (!t) return;
    if (this.sleeping && t.id !== 'night') return;
    this.shownAt.set(t.id, now);
    this.say(t.text, t.action);
  }

  private bubbleTap(): void {
    const a = this.bubbleAction;
    this.bubble.classList.remove('show');
    if (a === 'missions') this.show('missions');
    else if (a === 'feed' || a === 'play' || a === 'wash' || a === 'sleep' || a === 'pet') { this.show('dragon'); (this.current as { focus?: (a: string) => void })?.focus?.(a); }
  }

  // ----- Gestes -----
  private pointer(e: PointerEvent, kind: 'down' | 'move' | 'up'): void {
    const view = this.view;
    if (kind !== 'up') view.lookAt(e.clientX, e.clientY);
    const comp = this.family.companion;
    if (!comp || this.isParent) return;
    if (kind === 'down') {
      if (view.hitTest(e.clientX, e.clientY)) this.stroke = { x: e.clientX, y: e.clientY, dist: 0, moved: 0, pets: 0 };
      return;
    }
    const st = this.stroke;
    if (!st) return;
    if (kind === 'up') {
      if (st.moved < 12 && !this.sleeping) {
        // Simple toucher : il réagit et dit quelque chose.
        view.burstAt(e.clientX, e.clientY, this.careMode === 'wash' ? 'bubbles' : 'hearts');
        if (this.careMode === 'pet') { comp.pet(); if (!this.view.animator.actionId) void this.act('pet'); }
        this.think(true);
      }
      this.endStroke();
      return;
    }
    const d = Math.hypot(e.clientX - st.x, e.clientY - st.y);
    st.x = e.clientX; st.y = e.clientY;
    st.moved += d;
    if (!view.hitTest(e.clientX, e.clientY)) return;
    st.dist += d;
    if (this.careMode === 'wash') {
      if (st.dist < 18) return;
      st.dist = 0;
      view.burstAt(e.clientX, e.clientY, 'bubbles');
      const done = comp.scrub(0.14);
      view.dirt = Math.max(0, Math.min(1, (70 - comp.data.clean) / 70));
      if (done) { this.careMode = 'pet'; this.current?.refresh?.(); }
    } else {
      if (st.dist < 45) return;
      st.dist = 0;
      st.pets++;
      comp.pet();
      view.burstAt(e.clientX, e.clientY, 'hearts');
      if (this.sleeping) return;
      if (st.pets % 4 === 1 && !view.animator.actionId) void this.act('pet');
      if (st.pets === 6) this.say(sayFor('pet'), null, 2500);
    }
  }

  private endStroke(): void {
    if (this.stroke) { this.stroke = null; this.family.companion?.save(); }
  }

  private evolve(to: StageDef): void {
    if (this.stageOverride) return; // en mode test, la vue reste sur le stade forcé
    this.family.companion?.noteStage(to.id, to.label);
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
        h('div', { class: 'hud-level' }, `Niveau ${d.level}${this.family.book?.titleText() ? ' · ' + this.family.book.titleText() : ''}`)),
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

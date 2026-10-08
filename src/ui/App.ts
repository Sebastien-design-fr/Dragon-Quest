// Coquille de l'application : HUD, vue du dragon (en haut), écrans et onglets selon le profil.
import type { EquipmentDef, StageDef } from '../core/types.js';
import type { DragonView } from '../engine/DragonView.js';
import type { ChildBook } from '../family/ChildBook.js';
import { isNight, type Companion } from '../family/Companion.js';
import { Sound } from '../engine/Sound.js';
import type { Duo } from '../family/Duo.js';
import type { Training } from '../family/Training.js';
import { VisitScene } from './VisitScene.js';
import { StageHud } from './StageHud.js';
import { UI, installTouchFeedback } from './Motion.js';
import { equipReaction, evolutionReaction, itemReaction, levelUpReaction, missionReaction } from './Reactions.js';
import { toggleDevPanel } from './DevPanel.js';
import { installSurprises } from './SurprisesUI.js';
import { installShake } from './Sensors.js';
import { hideDrape, morningCurtain, nightKey, openBlanket } from './Rituals.js';
import { appliesOn, todayKey } from '../family/model.js';
import { sayFor, thoughts, type Thought, type ThoughtAction } from '../family/Thoughts.js';
import type { ParentHub } from '../family/ParentHub.js';
import type { Reminders } from '../family/Reminders.js';
import type { Catalog } from '../game/Catalog.js';
import type { GameState } from '../game/GameState.js';
import { SimTransport, type LinkState, type Transport, type WidgetData } from '../link/Transport.js';
import { Assets } from '../engine/AssetManager.js';
import { ICONS, clear, h, icon, put } from './dom.js';
import { DragonScreen } from './screens/DragonScreen.js';
import { FamilyScreen } from './screens/FamilyScreen.js';
import { MissionsScreen } from './screens/MissionsScreen.js';
import { ParentMissionsScreen } from './screens/ParentMissionsScreen.js';
import { ProfileScreen } from './screens/ProfileScreen.js';
import { ChestScreen, type ChestSegment } from './screens/ChestScreen.js';
import { ValidationsScreen } from './screens/ValidationsScreen.js';

export interface Screen { id: string; label: string; icon: string; hidden?: boolean; mount(el: HTMLElement): void; unmount?(): void; refresh?(): void; badge?(): number }

/** Écrans du parent qui montrent SON dragon (la dragonne) au lieu de celui de l'enfant. */
const OWN_SCREENS = new Set(['dragon', 'shop', 'inventory']);

export interface FamilyContext {
  link: Transport;
  linkState: LinkState;
  reminders: Reminders;
  book: ChildBook | null;
  hub: ParentHub | null;
  companion: Companion | null;
  duo: Duo | null;
  /** Entraînement par les mini-jeux (caractéristiques et tours spéciaux). */
  training: Training | null;
}

export const APP_VERSION = '0.17.1';

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
  private chest: ChestScreen;
  private current: Screen | null = null;
  private screenEl: HTMLElement;
  private hud: HTMLElement;
  private toastEl: HTMLElement;
  private tabs: HTMLElement;
  private tray: HTMLElement;
  private evolving = false;
  private evoFrom: StageDef | null = null;
  private lastTab = '';
  private shownGold: number | null = null;
  private shownXp: number | null = null;

  /** Widget d'écran d'accueil : résumé envoyé au natif (regroupé, au plus une fois toutes les 2 s). */
  private widgetTimer = 0;
  syncWidget(): void {
    clearTimeout(this.widgetTimer);
    this.widgetTimer = window.setTimeout(() => {
      const comp = this.family.companion, book = this.family.book, hub = this.family.hub;
      const stage = this.state.stage, name = comp?.name || (this.isParent ? 'Ta dragonne' : 'Ton dragon');
      const days: WidgetData['days'] = [];
      if (book) for (let i = 0; i < 7; i++) {
        const d = new Date(); d.setDate(d.getDate() + i);
        const key = todayKey(d);
        const list = book.data.missions.filter(m => !m.optional && appliesOn(m, d) && !(m.once && i > 0))
          .sort((a, b) => (a.time ?? '99').localeCompare(b.time ?? '99'));
        const st = (id: string) => (i === 0 ? book.status(id, key) : 'todo');
        const next = list.find(m => st(m.id) === 'todo' || st(m.id) === 'refused');
        days.push({ date: key, total: list.length, done: list.filter(m => st(m.id) === 'done').length,
          next: next ? `${next.title}${next.time ? ' · ' + next.time.replace(':', ' h ') : ''}` : '' });
      }
      const c = comp?.data;
      const status = !c ? '' : c.sick ? `${name} est malade` : c.hunger < 30 ? `${name} a faim` : c.clean < 25 ? `${name} est tout sale` : '';
      const pending = hub ? hub.pendingList().length : 0;
      void this.family.link.updateWidget({
        name, sub: `${this.stageLabel(stage.label)} · niveau ${this.state.data.level}`,
        image: Assets.dragonPart(stage.id, 'full', this.ownVariant) ?? '', streak: book?.streak() ?? 0,
        status, statusDate: todayKey(), days,
        line: this.isParent ? (pending ? `${pending} demande${pending > 1 ? 's' : ''} à valider` : 'Tout est à jour') : undefined
      });
    }, 2000);
  }

  /** Ambiance sonore du décor affiché (dragon de ce téléphone uniquement). */
  syncAmbience(): void { Sound.ambience(this.showingOwn && !document.hidden ? this.view.stage?.id ?? null : null); }
  /** Geste sur le dragon : caresser (par défaut) ou laver. */
  careMode: 'pet' | 'wash' = 'pet';
  private bubble: HTMLElement;
  private bubbleTimer = 0;
  private bubbleAction: ThoughtAction = null;
  private shownAt = new Map<string, number>();
  private remindTimer = 0;
  private stroke: { x: number; y: number; sx: number; sy: number; t: number; dist: number; moved: number; pets: number; zone: 'head' | 'belly' | 'tail' | 'body'; purring: boolean } | null = null;
  /** Visites de l'autre dragon de la famille. */
  readonly visits = new VisitScene(this);
  /** Jauges, barre d'actions, plateau de nourriture et menu rond posés sur la scène. */
  stageHud!: StageHud;
  private surprises: { stop(): void; tryGiftNow(): void } | null = null;

  constructor(readonly root: HTMLElement, readonly catalog: Catalog, readonly state: GameState, readonly view: DragonView, readonly family: FamilyContext) {
    this.hud = root.querySelector('#hud')!;
    installTouchFeedback(root);
    // rappel touché depuis la notification ou la montre : « C'est fait ! » valide la quête
    family.reminders.onAction((missionId, action) => {
      const book = family.book;
      if (!book || action !== 'done') { if (book) setTimeout(() => this.show('dragon'), 300); return; }
      const st = book.status(missionId);
      if (st === 'done' || st === 'pending') return;
      setTimeout(() => {
        this.show('dragon');
        void book.complete(missionId).then(() => this.say('C’est noté ! Merci, tu assures.', null, 4000));
      }, 600);
    });
    document.addEventListener('visibilitychange', () => { if (document.hidden) Sound.stopAmbience(); else this.syncAmbience(); });
    // le contexte audio ne démarre qu'après un premier geste : l'ambiance commence à ce moment-là
    root.addEventListener('pointerdown', () => this.syncAmbience(), { once: true, capture: true });
    this.screenEl = root.querySelector('#screen')!;
    this.toastEl = root.querySelector('#toast')!;
    this.tabs = root.querySelector('#tabs')!;
    this.tray = document.querySelector('#sim-tray')!;

    this.chest = new ChestScreen(this);
    this.screens = this.isParent
      ? [new ValidationsScreen(this), new ParentMissionsScreen(this), new DragonScreen(this), this.chest, new FamilyScreen(this)]
      : [new DragonScreen(this), new MissionsScreen(this), this.chest, new ProfileScreen(this)];
    this.buildTabs();

    // Sons : réglages, animations, or et gemmes gagnés.
    const applySound = () => {
      const st = state.data.settings;
      Sound.muted = st.sound === false; Sound.volume = st.volume ?? 0.7;
      Sound.ambienceOn = st.ambience !== false; Sound.uiSounds = st.uiSounds !== false;
      this.syncAmbience();
    };
    applySound();
    view.onClip = clip => Sound.forClip(clip, view.stage?.id ?? 'adult', view.variant);
    Sound.warm(['purr', 'chirp', 'coins', 'gem']);
    let lastGold = state.data.gold;
    state.events.on('change', d => {
      applySound();
      if (this.showingOwn && d.gold > lastGold) void Sound.play('coins', { user: true });
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
    window.setInterval(() => { nightTint(); this.bedtime(); }, 60000);
    setTimeout(() => this.bedtime(), 5000);

    state.events.on('change', d => {
      this.view.setQuality(catalog.quality[d.settings.quality], d.settings.effects);
      if (!this.showingOwn) { this.refresh(); return; }
      if (!this.stageOverride && !this.evolving && this.view.stage?.id !== d.stage) void this.view.setStage(state.stage, true);
      this.syncEquipment();
      this.refresh();
    });
    state.events.on('levelUp', ({ level }) => { if (this.showingOwn) levelUpReaction(this, level); });
    state.events.on('item', ({ def, how }) => itemReaction(this, def, how));
    state.events.on('equip', ({ def }) => equipReaction(this, def));
    state.events.on('evolve', ({ to }) => { if (this.showingOwn) this.evolve(to); });

    const book = family.book, hub = family.hub;
    const tiredNow = () => (book?.data.energy ?? 100) < 25 || !!family.companion?.data.sick;
    book?.events.on('change', () => { this.view.tired = tiredNow(); this.refresh(); });
    if (book) this.view.tired = tiredNow();
    book?.events.on('toast', t => this.toast(t));
    book?.events.on('reward', r => { if (r.mission) missionReaction(this, r.xp, r.gold); });
    book?.events.on('story', t => setTimeout(() => this.say(t, null, 10000), 900));
    hub?.events.on('change', () => { if (!this.showingOwn) this.showChildDragon(); this.refresh(); });
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
    this.stageHud = new StageHud(this);
    const cv = view.canvas;
    cv.addEventListener('pointerdown', e => this.pointer(e, 'down'));
    cv.addEventListener('pointermove', e => this.pointer(e, 'move'));
    cv.addEventListener('pointerup', e => this.pointer(e, 'up'));
    cv.addEventListener('pointercancel', e => this.pointer(e, 'up'));
    cv.addEventListener('pointerleave', () => { view.lookAt(null); this.endStroke(); });

    const comp = family.companion;
    if (comp) {
      comp.events.on('change', () => { this.applyCare(); this.refresh(); this.queueReminders(); });
      comp.events.on('toast', t => this.toast(t));
      comp.events.on('react', r => {
        if (!this.showingOwn) return;
        if (r.anim) void this.act(r.anim);
        if (r.fx) view.emit(r.fx, r.fx === 'shine' ? 'body_center' : 'head_anchor');
        if (r.say) this.say(sayFor(r.say), null, 4000);
      });
      if (isNight() && comp.data.tucked) this.sleeping = true; // déjà couché ce soir
      // couché hier soir et personne n'a encore ouvert ses rideaux ce matin : il dort encore
      const hr = new Date().getHours();
      if (comp.data.blanketDay === nightKey() && (hr >= 20 || hr < 12) && comp.data.morningDay !== todayKey()) this.sleeping = true;
      this.applyCare();
      if (this.showingOwn) void view.play(this.sleeping ? 'sleep' : this.baseLoop());
      const away = comp.greet();
      if (!this.isParent) setTimeout(() => {
        if (away && !this.sleeping) { void this.act('welcome'); this.say(sayFor('welcome'), null, 5000); }
        else this.think(true);
      }, 1500);
      window.setInterval(() => { comp.tick(); this.applyCare(); this.think(false); }, 40000);
      // Malade : il éternue de petits nuages de fumée.
      window.setInterval(() => { if (this.showingOwn && comp.data.sick && !this.sleeping) view.emit('sneeze', 'mouth_anchor'); }, 9000);
      document.addEventListener('visibilitychange', () => { if (!document.hidden) setTimeout(() => this.think(true), 1200); });
    }

    if (comp) {
      this.surprises = installSurprises(this);
      installShake(this);
      family.training?.events.on('levelUp', ({ stat, level, tricks }) => {
        const label = { agilite: 'Agilité', vitesse: 'Vitesse', feu: 'Feu', sagesse: 'Sagesse' }[stat];
        this.toast(`${label} niveau ${level} !`);
        if (tricks.length) setTimeout(() => this.say(`J’ai appris un nouveau tour : ${tricks.map(t => t.label.toLowerCase()).join(', ')} !`, null, 6000), 2500);
      });
      // Matin : rideaux tirés ; soir : couverture déjà posée.
      setTimeout(() => this.morningCheck(), 1200);
    }

    const duo = family.duo;
    duo?.events.on('visit', () => this.playPendingVisit());
    duo?.events.on('toast', t => this.toast(t));
    duo?.events.on('change', () => this.current?.refresh?.());
    setTimeout(() => this.playPendingVisit(), 3500);

    this.renderHud();
    this.show(this.screens[0].id);
    // ?dev=1 : panneau graphique ouvert d'office (tests)
    if (new URLSearchParams(location.search).get('dev') === '1') { this.devMode = true; setTimeout(() => toggleDevPanel(this), 800); }
  }

  /** Joue la prochaine visite en attente, si notre dragon est affiché et éveillé. */
  playPendingVisit(): void {
    const v = this.family.duo?.data.pending[0];
    if (!v || !this.showingOwn || this.sleeping || this.visits.active || this.evolving) return;
    void this.visits.start(v);
  }

  get isParent(): boolean { return this.family.linkState.role === 'parent'; }
  /** Le dragon affiché est-il celui de l'utilisateur de ce téléphone ? (parent : seulement sur ses écrans à lui). */
  get showingOwn(): boolean { return !this.isParent || (!!this.current && OWN_SCREENS.has(this.current.id)); }
  /** Panneau développeur : variante affichée à la place de celle du téléphone. */
  devVariant: string | null = null;
  /** Variante d'illustration du dragon de ce téléphone. */
  get ownVariant(): string { return this.devVariant ?? (this.isParent ? 'dragonne' : 'dragon'); }

  /** Panneau développeur : affiche n'importe quelle variante à n'importe quel stade, sans toucher à la sauvegarde. */
  async devShow(variant: string, stage: StageDef): Promise<void> {
    this.devVariant = variant;
    this.stageOverride = stage;
    await this.view.setStage(stage, true, variant);
    this.syncEquipment();
    this.renderHud();
  }
  /** Nom du stade adapté (« Dragonne adulte »…). */
  stageLabel(label: string): string {
    if (this.ownVariant !== 'dragonne') return label;
    return label.replace(/Bébé dragon/i, 'Bébé dragonne').replace(/Jeune dragon/i, 'Jeune dragonne').replace(/\bDragon\b/, 'Dragonne');
  }

  private buildTabs(): void {
    clear(this.tabs);
    this.tabs.style.gridTemplateColumns = `repeat(${this.screens.length}, minmax(0, 1fr))`;
    const visible = this.screens.filter(sc => !sc.hidden);
    this.tabs.style.gridTemplateColumns = `repeat(${visible.length}, minmax(0, 1fr))`;
    for (const s of visible) {
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
    const wasOwn = this.showingOwn;
    this.current = next;
    if (this.isParent && wasOwn !== this.showingOwn) void this.switchDragon();
    next.mount(this.screenEl);
    this.screenEl.scrollTop = 0;
    // transition d'onglet : les blocs arrivent en cascade, du côté de l'onglet choisi
    const order = this.screens.map(s => s.id);
    const dir = this.lastTab && order.indexOf(id) < order.indexOf(this.lastTab) ? -1 : 1;
    if (this.lastTab && this.lastTab !== id) UI.stagger(this.screenEl, dir);
    this.lastTab = id;
    this.root.classList.toggle('stage-tall', next.id === 'dragon');
    this.root.classList.toggle('stage-compact', next.id !== 'dragon');
    this.stageHud.show(next.id === 'dragon' && this.showingOwn && !!this.family.companion);
    if (!this.showingOwn) { hideDrape(); this.root.querySelectorAll('.rt-curtain,.rt-blanket').forEach(e => e.remove()); }
    else setTimeout(() => this.morningCheck(), 600);
    this.buildTabs();
    window.dispatchEvent(new Event('resize'));
  }

  /** Ouvre le coffre sur un onglet précis (boutique, objets, récompenses). */
  openChest(seg: ChestSegment): void { this.chest.openSegment(seg); this.show('shop'); }

  refresh(): void {
    this.syncWidget();
    this.renderHud();
    this.stageHud?.render();
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
  /** Parent : bascule entre le dragon de l'enfant et sa propre dragonne. */
  private async switchDragon(): Promise<void> {
    this.bubble.classList.remove('show');
    if (this.showingOwn) {
      await this.view.setStage(this.state.stage, true, this.ownVariant);
      this.syncEquipment();
      this.applyCare();
      void this.view.play(this.sleeping ? 'sleep' : this.baseLoop());
      setTimeout(() => this.think(true), 900);
      setTimeout(() => this.playPendingVisit(), 1800);
    } else {
      this.visits.end();
      this.showChildDragon();
    }
    this.renderHud();
  }

  syncEquipment(): void {
    if (!this.showingOwn) return;
    this.view.setEquipment(this.state.equippedDefs(this.preview));
  }

  setPreview(def: EquipmentDef | null): void { this.preview = def; this.syncEquipment(); }

  /** Parent : affiche le dragon de l'enfant sélectionné (d'après son dernier état reçu). */
  showChildDragon(): void {
    if (!this.isParent || this.showingOwn) return;
    const snap = this.selectedChild ? this.family.hub?.child(this.selectedChild)?.snapshot : null;
    const stage = (snap && this.catalog.stage(snap.stage)) || this.catalog.stages[0];
    if (this.view.stage?.id !== stage.id || this.view.variant !== 'dragon') void this.view.setStage(stage, true, 'dragon').then(() => this.applyChildEquipment());
    else this.applyChildEquipment();
  }
  private applyChildEquipment(): void {
    const snap = this.selectedChild ? this.family.hub?.child(this.selectedChild)?.snapshot : null;
    // Son état vu par le parent : saleté, maladie, fatigue.
    this.view.dirt = snap?.companion ? Math.max(0, Math.min(1, (70 - snap.companion.clean) / 70)) : 0;
    this.view.tired = !!snap?.sick || (snap?.energy ?? 100) < 25;
    void this.view.play(snap?.sick || (snap?.companion && snap.companion.mood < 25) ? 'sad' : 'idle');
    const defs = (snap?.equipped ?? []).map(id => this.catalog.item(id)).filter((d): d is EquipmentDef => !!d);
    this.view.setEquipment(defs);
  }

  async act(anim: string): Promise<void> {
    if (this.sleeping && anim !== 'sleep') this.toggleSleep(false);
    if (anim === 'hover') { await this.view.fly(); return; }
    await this.view.play(anim);
  }

  /** Bouton dodo : réveiller, ou le soir la couverture, ou une sieste. */
  sleepButton(): void {
    if (this.sleeping) { this.wakeUp(false); return; }
    const evening = isNight() || new Date().getHours() >= 20;
    if (evening && this.family.companion) openBlanket(this);
    else this.toggleSleep(true);
  }

  /** Réveil (bouton, rideaux du matin, téléphone secoué). */
  wakeUp(stretch: boolean): void {
    hideDrape();
    this.wokenAt = Date.now();
    this.view.backdrop.night = isNight() ? 1 : 0;
    this.toggleSleep(false);
    void this.view.play('wake').then(() => { if (stretch) void this.view.play('stretch'); });
  }

  /** Après un soin : il a peut-être trouvé quelque chose pour toi. */
  surprisesGift(): void { this.surprises?.tryGiftNow(); }

  /** Le matin, s'il dort encore : rideaux à ouvrir. Le soir, la couverture reste sur lui. */
  private morningCheck(): void {
    const comp = this.family.companion;
    if (!comp || !this.showingOwn || this.current?.id !== 'dragon') return;
    const hr = new Date().getHours();
    if (this.sleeping && hr >= 6 && hr < 12 && comp.data.morningDay !== todayKey()) { morningCurtain(this); return; }
  }

  toggleSleep(force?: boolean): void {
    const was = this.sleeping;
    this.sleeping = force ?? !this.sleeping;
    const comp = this.family.companion;
    if (this.sleeping && !was && comp?.tuck()) this.say(sayFor('tuck'), null, 4000);
    void this.view.play(this.sleeping ? 'sleep' : this.baseLoop());
    if (was && !this.sleeping) setTimeout(() => this.playPendingVisit(), 2000);
    if (was && !this.sleeping) this.autoSlept = false;
    if (was && !this.sleeping && force === undefined) {
      this.wokenAt = Date.now();
      void this.view.play('wake');
      if (isNight()) this.say(sayFor('wake'), null, 4000);
    }
    if (!this.sleeping) { hideDrape(); this.view.backdrop.night = isNight() ? 1 : 0; this.careMode = 'pet'; }
    this.stageHud?.render();
    this.current?.refresh?.();
  }

  /** Couché tout seul vers 21 h 30 (bâillement puis dodo), réveillé le matin. */
  private autoSlept = false;
  /** Réveillé à la main la nuit : on le laisse debout 30 min avant de le recoucher. */
  private wokenAt = 0;
  private bedtime(): void {
    if (!this.showingOwn || this.visits.active || this.evolving) return;
    const h = new Date().getHours() + new Date().getMinutes() / 60;
    const night = h >= 21.5 || h < 7;
    const wokeThisMorning = h < 12 && this.family.companion?.data.morningDay === todayKey();
    if (night && !this.sleeping && !wokeThisMorning && Date.now() - this.wokenAt > 30 * 60000) {
      void this.view.play('yawn');
      setTimeout(() => {
        if (this.sleeping) return;
        this.autoSlept = true; this.sleeping = true;
        const c = this.family.companion;
        if (c) { c.data.blanketDay = nightKey(); c.save(); }
        void this.view.play('sleep'); this.stageHud?.render(); this.current?.refresh?.();
      }, 2600);
    } else if (h >= 6 && h < 12 && this.sleeping && (this.autoSlept || this.family.companion?.data.blanketDay === nightKey())) {
      // le matin, on attend qu'on ouvre ses rideaux (jusqu'à 11 h), puis il se lève tout seul
      if (h < 11) { this.morningCheck(); return; }
      this.autoSlept = false;
      this.wakeUp(true);
    }
  }

  /** Boucle de repos selon son état : triste s'il est négligé. */
  baseLoop(): string { return this.family.companion?.sad() ? 'sad' : 'idle'; }

  /** Reporte l'état du compagnon sur le dragon affiché (saleté, tristesse). */
  private applyCare(): void {
    const c = this.family.companion;
    if (!c || !this.showingOwn) return;
    this.view.tired = (this.family.book?.data.energy ?? 100) < 25 || c.data.sick;
    this.view.dirt = Math.max(0, Math.min(1, (70 - c.data.clean) / 70));
    if (!this.sleeping) { const loop = this.baseLoop(); if (this.view.animator.baseId?.split('@')[0] !== loop) void this.view.play(loop); }
  }

  private queueReminders(): void {
    clearTimeout(this.remindTimer);
    this.remindTimer = window.setTimeout(() => {
      const c = this.family.companion;
      if (this.family.book) void this.family.book.refreshReminders();
      else if (c) void this.family.reminders.reschedule([], () => 'done', { name: c.name, line: () => '' }, c.careNotifs());
    }, 4000);
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
    if (!comp || !this.showingOwn || this.evolving) return;
    if (!force && this.bubble.classList.contains('show')) return;
    if (this.sleeping && !isNight()) return;
    const now = Date.now();
    const list = thoughts(this.family.book, comp, this.family.book?.childName ?? this.family.linkState.deviceName ?? '');
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
  // Toucher la tête : il se frotte et ronronne ; le ventre : chatouilles ; la queue : il court après ;
  // glisser vers le haut : il s'envole ; appui long : menu rond des actions ; mode lavage : frotter les écailles.
  private pressTimer = 0;
  private zoneAt(x: number, y: number): 'head' | 'belly' | 'tail' | 'body' {
    const v = this.view;
    const r = v.canvas.getBoundingClientRect();
    const px = x - r.left, py = y - r.top;
    const head = v.screenPos('head_anchor'), tail = v.screenPos('tail_anchor'), tip = v.screenPos('tail_tip_anchor');
    const chest = v.screenPos('chest_anchor'), body = v.screenPos('body_center');
    if (!head || !tail || !body) return 'body';
    const size = Math.hypot(head.x - tail.x, head.y - tail.y) || 200;
    const d = (p: { x: number; y: number } | null) => (p ? Math.hypot(px - p.x, py - p.y) / size : 9);
    const cand: Array<['head' | 'belly' | 'tail', number]> = [
      ['head', d(head) / 0.22],
      ['tail', Math.min(d(tail), d(tip)) / 0.2],
      ['belly', py > body.y - size * 0.02 ? Math.min(d(chest), d(body)) / 0.24 : 9]
    ];
    cand.sort((a, b) => a[1] - b[1]);
    return cand[0][1] < 1 ? cand[0][0] : 'body';
  }

  private pointer(e: PointerEvent, kind: 'down' | 'move' | 'up'): void {
    const view = this.view;
    if (kind !== 'up') view.lookAt(e.clientX, e.clientY);
    const comp = this.family.companion;
    if (!comp || !this.showingOwn || this.visits.active) return;
    if (kind === 'down') {
      if (!view.hitTest(e.clientX, e.clientY)) return;
      this.stroke = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now(), dist: 0, moved: 0, pets: 0, zone: this.careMode === 'wash' ? 'body' : this.zoneAt(e.clientX, e.clientY), purring: false };
      clearTimeout(this.pressTimer);
      if (this.current?.id === 'dragon' && this.careMode !== 'wash') this.pressTimer = window.setTimeout(() => {
        const st = this.stroke;
        if (!st || st.moved > 12) return;
        this.stroke = null;
        this.bubble.classList.remove('show');
        this.stageHud.openRadial(st.x, st.y);
      }, 560);
      return;
    }
    const st = this.stroke;
    if (!st) return;
    if (kind === 'up') {
      clearTimeout(this.pressTimer);
      if (st.moved < 12) this.tap(e, st.zone);
      this.endStroke();
      return;
    }
    const d = Math.hypot(e.clientX - st.x, e.clientY - st.y);
    st.x = e.clientX; st.y = e.clientY;
    st.moved += d;
    if (st.moved > 12) clearTimeout(this.pressTimer);
    // glisser vers le haut, vite : il s'envole
    if (this.careMode !== 'wash' && !this.sleeping && st.sy - e.clientY > 90 && Math.abs(e.clientX - st.sx) < 80 && performance.now() - st.t < 700) {
      this.endStroke();
      void this.act('hover');
      return;
    }
    if (!view.hitTest(e.clientX, e.clientY)) return;
    st.dist += d;
    if (this.careMode === 'wash') {
      if (st.dist < 18) return;
      st.dist = 0;
      view.burstAt(e.clientX, e.clientY, 'bubbles');
      const done = comp.scrub(0.14);
      view.dirt = Math.max(0, Math.min(1, (70 - comp.data.clean) / 70));
      if (done) { this.careMode = 'pet'; this.stageHud.render(); this.current?.refresh?.(); this.surprisesGift(); }
      return;
    }
    if (st.dist < 45) return;
    st.dist = 0;
    st.pets++;
    comp.pet();
    view.burstAt(e.clientX, e.clientY, 'hearts');
    if (this.sleeping) return;
    const idle = !view.animator.actionId;
    if (st.zone === 'head') {
      // il ronronne et le téléphone vibre doucement
      navigator.vibrate?.(12);
      if (!st.purring && idle) { st.purring = true; void this.act('purr'); }
      if (st.pets === 5) this.say(sayFor('purr'), null, 2500);
      if (st.pets % 6 === 0) st.purring = false;
    } else if (st.zone === 'belly') {
      if (st.pets % 3 === 1 && idle) { void this.act('giggle'); navigator.vibrate?.([15, 40, 15]); }
      if (st.pets === 2) this.say(sayFor('tickle'), null, 2500);
    } else if (st.zone === 'tail') {
      if (st.pets === 2 && idle) { void this.act('tail_chase'); this.say(sayFor('tail'), null, 2800); }
    } else {
      if (st.pets % 4 === 1 && idle) void this.act('pet');
      if (st.pets === 6) this.say(sayFor('pet'), null, 2500);
    }
  }

  /** Simple toucher selon l'endroit. */
  private tap(e: PointerEvent, zone: 'head' | 'belly' | 'tail' | 'body'): void {
    const comp = this.family.companion!;
    const view = this.view;
    if (this.sleeping) { view.burstAt(e.clientX, e.clientY, 'hearts'); this.say('Zzz…', null, 1500); return; }
    if (this.careMode === 'wash') { view.burstAt(e.clientX, e.clientY, 'bubbles'); return; }
    view.burstAt(e.clientX, e.clientY, 'hearts');
    comp.pet();
    if (view.animator.actionId) return;
    if (zone === 'head') { void this.act('purr'); navigator.vibrate?.(20); }
    else if (zone === 'belly') { void this.act('giggle'); this.say(sayFor('tickle'), null, 2500); navigator.vibrate?.([15, 40, 15]); }
    else if (zone === 'tail') { void this.act('tail_chase'); this.say(sayFor('tail'), null, 2800); }
    else { void this.act('pet'); this.think(true); }
    comp.save();
  }

  private endStroke(): void {
    clearTimeout(this.pressTimer);
    if (this.stroke) { this.stroke = null; this.family.companion?.save(); }
  }

  private evolve(to: StageDef): void {
    if (this.stageOverride) return; // en mode test, la vue reste sur le stade forcé
    this.family.companion?.noteStage(to.id, to.label);
    void this.playEvolution(to);
  }

  /** Transformation mise en scène (LOT 6) ; l'interface reprend la main à la fin. */
  private async playEvolution(to: StageDef): Promise<void> {
    this.evolving = true;
    this.evoFrom = this.view.stage;
    this.toggleSleep(false);
    this.bubble.classList.remove('show');
    this.root.classList.add('evolving');
    this.view.onEvolveReveal = () => { this.evoFrom = null; this.renderHud(); evolutionReaction(this, to, this.state.data.level); };
    try {
      await this.view.evolve(to, this.ownVariant);
    } finally {
      this.view.onEvolveReveal = null;
      this.evolving = false;
      this.evoFrom = null;
      this.root.classList.remove('evolving');
      if (this.view.stage?.id !== to.id) await this.view.setStage(to, true, this.ownVariant); // sécurité
      this.syncEquipment();
      this.renderHud();
    }
  }

  /** Panneau développeur : évolution complète du stade affiché vers le suivant (sans toucher à la sauvegarde). */
  async devEvolve(): Promise<void> {
    if (this.evolving) return;
    const stages = this.catalog.stages;
    let i = stages.findIndex(s => s.id === this.view.stage?.id);
    if (i < 0 || i >= stages.length - 1) {
      i = Math.max(0, stages.length - 2);
      await this.view.setStage(stages[i], true, this.ownVariant);
      this.syncEquipment();
    }
    const to = stages[i + 1];
    this.stageOverride = to;
    await this.playEvolution(to);
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
    if (this.isParent && !this.showingOwn) {
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
    // pendant l'évolution, le bandeau garde l'ancien stade jusqu'à la révélation
    const stage = (this.evolving && this.evoFrom) || this.stageOverride || this.state.stage;
    const need = this.state.xpToNext();
    this.hud.append(
      h('div', { class: 'hud-id' },
        h('div', { class: 'hud-stage' }, this.stageLabel(stage.label), this.stageOverride ? h('em', null, ' (aperçu)') : null),
        h('div', { class: 'hud-level' }, `Niveau ${d.level}${this.family.book?.titleText() ? ' · ' + this.family.book.titleText() : ''}`)),
      h('div', { class: 'hud-xp' },
        h('div', { class: 'bar' }, h('div', { class: 'fill', style: { width: `${Math.min(100, (d.xp / need) * 100)}%` } })),
        h('div', { class: 'hud-xp-label' }, `${d.xp} / ${need} XP`)),
      h('div', { class: 'gold' }, icon(ICONS.coin, 18), h('span', null, d.gold.toLocaleString('fr-FR')))
    );
    this.root.dataset.stage = stage.id;
    // l'or défile jusqu'à sa nouvelle valeur, la barre d'XP glisse au lieu de sauter
    const goldEl = this.hud.querySelector<HTMLElement>('.gold span');
    if (goldEl && this.shownGold !== null && this.shownGold !== d.gold) { UI.countUp(goldEl, this.shownGold, d.gold); UI.bump(goldEl.parentElement!); }
    this.shownGold = d.gold;
    const pct = Math.min(100, (d.xp / need) * 100);
    const fillEl = this.hud.querySelector<HTMLElement>('.hud-xp .fill');
    if (fillEl && this.shownXp !== null && this.shownXp !== pct && pct > this.shownXp) {
      fillEl.style.width = `${this.shownXp}%`;
      requestAnimationFrame(() => requestAnimationFrame(() => { fillEl.style.transition = 'width .9s cubic-bezier(.2,.8,.3,1)'; fillEl.style.width = `${pct}%`; }));
    }
    this.shownXp = pct;
    this.syncAmbience();
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

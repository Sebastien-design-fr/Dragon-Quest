// « Coffre » : boutique, armoire (objets possédés) et vraies récompenses réunies sur un seul écran.
import type { EquipmentDef } from '../../core/types.js';
import type { App, Screen } from '../App.js';
import { ICONS, clear, h, icon } from '../dom.js';
import { categoryChips, rarityBadge, stageNames, thumb } from './common.js';

export type ChestSegment = 'shop' | 'owned' | 'rewards';

export class ChestScreen implements Screen {
  id = 'shop'; label = 'Coffre'; icon = ICONS.inventory;
  private el: HTMLElement | null = null;
  private seg: ChestSegment = 'shop';
  /** Boutique : catégorie affichée et objet en essai. */
  private category: string | null = 'head';
  private selected: string | null = null;
  /** Armoire : emplacement filtré (null = tous). */
  private slot: string | null = null;
  constructor(private app: App) {}

  mount(el: HTMLElement): void { this.el = el; this.refresh(); }
  unmount(): void { this.el = null; this.selected = null; this.app.setPreview(null); }

  /** Ouvre l'écran sur un onglet précis (avant ou après l'affichage). */
  openSegment(seg: ChestSegment): void {
    if (seg === 'rewards' && !this.app.family.book) seg = 'shop';
    if (seg !== 'shop') { this.selected = null; this.app.setPreview(null); }
    this.seg = seg;
    this.refresh();
    if (this.el) this.el.scrollTop = 0;
  }

  refresh(): void {
    const el = this.el; if (!el) return;
    const { app } = this;
    const book = app.family.book;
    if (this.seg === 'rewards' && !book) this.seg = 'shop';
    clear(el);

    const segBtn = (seg: ChestSegment, label: string, path: string, count?: number) =>
      h('button', { class: this.seg === seg ? 'active' : '', role: 'tab', 'aria-selected': this.seg === seg ? 'true' : 'false',
        onclick: () => { if (this.seg !== seg) this.openSegment(seg); } },
        icon(path, 16), h('span', null, label), count ? h('span', { class: 'cp-seg-count' }, String(count)) : null);
    el.append(h('div', { class: `segmented cp-seg ${book ? '' : 'two'}`, role: 'tablist' },
      segBtn('shop', 'Boutique', ICONS.shop),
      segBtn('owned', 'Mes objets', ICONS.inventory, app.state.data.owned.length),
      book ? segBtn('rewards', 'Récompenses', ICONS.gift) : null));

    if (this.seg === 'rewards') this.rewards(el);
    else if (this.seg === 'owned') this.wardrobe(el);
    else this.shop(el);
  }

  // ---------------- Boutique ----------------
  private shop(el: HTMLElement): void {
    const { app } = this;
    const s = app.state;
    el.append(
      h('section', { class: 'cp-shop-hero' },
        h('span', { class: 'cp-shop-kicker' }, 'TRÉSOR DU DRAGON'),
        h('div', { class: 'row' },
          h('div', { class: 'grow' },
            h('h2', null, 'Boutique'),
            h('p', { class: 'small muted' }, app.isParent
              ? 'Personnalise ta dragonne et son univers.'
              : 'Transforme les récompenses de tes missions en objets pour ton dragon.')),
          h('div', { class: 'cp-shop-gold' },
            icon(ICONS.coin, 17),
            h('strong', null, s.data.gold.toLocaleString('fr-FR')),
            h('span', { class: 'small muted' }, 'or'))))
    );
    const active = app.catalog.activeCollections();
    if (active.length) {
      el.append(h('div', { class: 'event-banner', style: { borderColor: active[0].accent, color: active[0].accent } },
        icon(ICONS.star, 18), `Collection ${active.map(c => c.label).join(', ')} disponible !`));
    }
    if (!this.selected) el.append(h('p', { class: 'small muted cp-hint' }, icon(ICONS.spark, 14), app.isParent ? ' Touche un objet pour l’essayer sur ta dragonne.' : ' Touche un objet pour l’essayer sur ton dragon.'));
    el.append(categoryChips(app, this.category, id => { this.category = id; this.refresh(); }, 'Tout'));

    const items = app.catalog.shopItems(this.category, { allCollections: app.allCollections });
    const grid = h('div', { class: 'cp-grid' });
    for (const def of items) {
      const owned = s.owns(def.id), equipped = s.isEquipped(def.id);
      const collection = def.collection ? app.catalog.collections.get(def.collection) : null;
      const afford = s.data.gold >= def.price;
      grid.append(h('button', {
        class: `cp-item${this.selected === def.id ? ' selected' : ''}${equipped ? ' worn' : ''}`,
        style: { '--rarity': app.catalog.rarities.get(def.rarity)?.color },
        'aria-label': `Essayer ${def.name}`,
        onclick: () => this.select(def)
      },
        equipped ? h('span', { class: 'cp-worn' }, icon(ICONS.check, 12), 'Porté') : owned ? h('span', { class: 'cp-owned' }, 'À toi') : null,
        thumb(app, def, 76),
        h('div', { class: 'item-name' }, def.name),
        collection ? h('div', { class: 'item-tag', style: { color: collection.accent } }, collection.label) : null,
        owned ? h('div', { class: 'cp-price muted' }, equipped ? 'Équipé' : 'Possédé')
          : h('div', { class: `cp-price${afford ? '' : ' short'}` }, icon(ICONS.coin, 14), ` ${def.price}`)));
    }
    if (!items.length) grid.append(h('p', { class: 'muted' }, 'Aucun objet dans cette catégorie pour le moment.'));
    el.append(grid);

    const def = this.selected ? app.catalog.item(this.selected) : null;
    if (def) el.append(this.detail(def));
  }

  private select(def: EquipmentDef): void {
    if (this.selected === def.id) { this.selected = null; this.app.setPreview(null); this.refresh(); return; }
    this.selected = def.id;
    // Essai en temps réel sur le dragon, AVANT achat.
    this.app.setPreview(this.app.state.isEquipped(def.id) ? null : def);
    this.refresh();
  }

  private detail(def: EquipmentDef): HTMLElement {
    const { app } = this;
    const s = app.state;
    const owned = s.owns(def.id), equipped = s.isEquipped(def.id);
    const compatible = s.isCompatible(def);
    const viewStage = app.stageOverride ?? s.stage;
    const shownOnDragon = def.compatibleDragonStages.includes(viewStage.id);

    let main: HTMLElement;
    if (!owned) {
      const afford = s.data.gold >= def.price;
      main = h('button', { class: 'btn primary cp-main', disabled: !afford, onclick: () => {
        const r = s.buy(def.id);
        app.toast(r.ok ? `${def.name} acheté !` : r.reason);
      } }, afford ? [icon(ICONS.coin, 18), ` Acheter · ${def.price}`] : `Il manque ${def.price - s.data.gold} or`);
    } else if (equipped) {
      main = h('button', { class: 'btn cp-main', onclick: () => { s.unequip(def.category); app.setPreview(def); } }, 'Retirer');
    } else {
      main = h('button', { class: 'btn primary cp-main', disabled: !compatible, onclick: () => {
        const r = s.equip(def.id);
        if (r.ok) { app.setPreview(null); app.toast(`${def.name} équipé.`); } else app.toast(r.reason);
      } }, 'Équiper');
    }

    return h('section', { class: 'detail cp-detail', style: { '--rarity': app.catalog.rarities.get(def.rarity)?.color } },
      h('div', { class: 'detail-head' }, thumb(app, def, 52),
        h('div', { class: 'grow' },
          h('div', { class: 'cp-trying small' }, equipped ? 'Déjà porté' : owned ? 'Dans ton armoire' : 'En essai'),
          h('h3', null, def.name),
          h('div', { class: 'row' }, rarityBadge(app, def), owned ? null : h('span', { class: 'price' }, icon(ICONS.coin, 14), ` ${def.price}`))),
        h('button', { class: 'cp-close', 'aria-label': 'Arrêter l’essai', onclick: () => { this.selected = null; app.setPreview(null); this.refresh(); } }, '×')),
      def.description ? h('p', { class: 'small muted cp-desc' }, def.description) : null,
      !shownOnDragon ? h('p', { class: 'warn' }, `Non visible sur ce stade. Compatible : ${stageNames(app, def)}.`) : null,
      !compatible && owned ? h('p', { class: 'warn' }, app.isParent ? 'Ta dragonne doit encore grandir pour le porter.' : 'Ton dragon doit encore grandir pour le porter.') : null,
      main);
  }

  // ---------------- Armoire (Mes objets) ----------------
  private wardrobe(el: HTMLElement): void {
    const { app } = this;
    const s = app.state;
    const cats = [...app.catalog.categories.values()];

    const slots = h('div', { class: 'cp-slots' });
    for (const c of cats) {
      const wornId = s.data.equipped[c.id];
      const worn = wornId ? app.catalog.item(wornId) : null;
      const ownedHere = s.data.owned.filter(id => app.catalog.item(id)?.category === c.id).length;
      slots.append(h('button', {
        class: `cp-slot${this.slot === c.id ? ' active' : ''}${worn ? ' filled' : ''}`,
        'aria-label': `${c.label} : ${worn ? worn.name : 'vide'}`,
        onclick: () => {
          this.slot = this.slot === c.id ? null : c.id;
          this.refresh();
          // Filtre choisi : on amène la liste de ses objets juste sous les onglets.
          const head = this.slot ? this.el?.querySelector<HTMLElement>('.cp-owned-head') : null;
          const seg = this.el?.querySelector<HTMLElement>('.cp-seg');
          if (head && this.el) this.el.scrollTo({ top: this.el.scrollTop + head.getBoundingClientRect().top - this.el.getBoundingClientRect().top - (seg?.offsetHeight ?? 0) - 6, behavior: 'smooth' });
        }
      },
        worn ? thumb(app, worn, 48) : h('div', { class: 'cp-slot-empty' }, icon(c.icon, 22)),
        h('span', { class: 'cp-slot-label' }, c.label),
        ownedHere ? h('span', { class: 'cp-slot-count' }, String(ownedHere)) : null));
    }
    const wornCount = Object.keys(s.data.equipped).length;
    el.append(h('section', { class: 'card cp-armoire' },
      h('div', { class: 'section-head' }, h('h3', null, app.isParent ? 'Sur ta dragonne' : 'Sur ton dragon'), h('span', { class: 'small muted' }, `${wornCount} / ${cats.length} portés`)),
      slots));

    el.append(h('div', { class: 'section-head cp-owned-head' },
      h('h3', null, this.slot ? `Mes objets · ${app.catalog.categories.get(this.slot)?.label ?? this.slot}` : 'Tous mes objets'),
      this.slot ? h('button', { class: 'btn ghost cp-small', onclick: () => { this.slot = null; this.refresh(); } }, 'Tout voir')
        : h('span', { class: 'small muted' }, 'Touche un emplacement pour trier')));

    const owned = app.catalog.sorted(s.data.owned.map(id => app.catalog.item(id)!).filter(Boolean))
      .filter(d => !this.slot || d.category === this.slot);

    if (!owned.length) {
      el.append(h('div', { class: 'empty cp-empty' },
        icon(ICONS.inventory, 40),
        h('p', null, this.slot ? 'Aucun objet pour cet emplacement.' : 'Ton armoire est encore vide.'),
        h('button', { class: 'btn primary', onclick: () => { if (this.slot) this.category = this.slot; this.openSegment('shop'); } }, 'Voir la boutique')));
      return;
    }

    const grid = h('div', { class: 'cp-grid' });
    for (const def of owned) {
      const equipped = s.isEquipped(def.id);
      const compatible = s.isCompatible(def);
      const cat = app.catalog.categories.get(def.category);
      let action: HTMLElement;
      if (equipped) action = h('button', { class: 'btn cp-act', onclick: () => s.unequip(def.category) }, 'Retirer');
      else if (!compatible) action = h('button', { class: 'btn cp-act', disabled: true, title: `Compatible : ${stageNames(app, def)}` }, 'Trop petit');
      else action = h('button', { class: 'btn primary cp-act', onclick: () => {
        const r = s.equip(def.id);
        if (!r.ok) app.toast(r.reason); else app.toast(`${def.name} équipé.`);
      } }, 'Équiper');
      grid.append(h('div', { class: `cp-item cp-owned-item${equipped ? ' worn' : ''}`, style: { '--rarity': app.catalog.rarities.get(def.rarity)?.color } },
        equipped ? h('span', { class: 'cp-worn' }, icon(ICONS.check, 12), 'Porté') : null,
        thumb(app, def, 76),
        h('div', { class: 'item-name' }, def.name),
        h('div', { class: 'cp-meta' }, rarityBadge(app, def), this.slot ? null : h('span', { class: 'small muted' }, cat?.label ?? def.category)),
        action));
    }
    el.append(grid);
  }

  // ---------------- Vraies récompenses (enfant) ----------------
  private rewards(el: HTMLElement): void {
    const book = this.app.family.book!;
    el.append(h('section', { class: 'card gems-card' },
      h('div', { class: 'row' }, h('span', { class: 'gem' }, '◆'), h('strong', { class: 'grow' }, `${book.data.gems} gemme${book.data.gems > 1 ? 's' : ''}`)),
      h('p', { class: 'small muted' }, '1 gemme par mission, 2 par quête bonus ou journée parfaite, 5 dans le coffre de l’expédition. Échange-les contre de vraies récompenses choisies par tes parents.')));
    const pending = book.pendingRequests().filter(r => r.kind === 'reward');
    for (const r of pending) el.append(h('div', { class: 'list-row' }, h('span', { class: 'grow' }, r.title), h('span', { class: 'pill pending' }, 'Demandée')));
    if (!book.data.rewards.length) el.append(h('p', { class: 'muted' }, 'Tes parents n’ont pas encore ajouté de récompenses.'));
    for (const r of [...book.data.rewards].sort((a, b) => a.cost - b.cost)) {
      const can = book.data.gems >= r.cost;
      el.append(h('div', { class: `list-row reward-row${can ? ' can' : ''}` },
        h('div', { class: 'grow' }, h('div', { class: 'item-name' }, r.title),
          h('div', { class: 'bar gem-bar' }, h('div', { class: 'fill', style: { width: `${Math.min(100, (book.data.gems / r.cost) * 100)}%` } }))),
        h('button', { class: `btn ${can ? 'primary' : ''} small-btn`, disabled: can ? undefined : true, onclick: async () => {
          if (!confirm(`Demander « ${r.title} » pour ${r.cost} gemmes ?`)) return;
          if (await book.requestReward(r)) this.refresh();
        } }, `◆ ${r.cost}`)));
    }
  }
}

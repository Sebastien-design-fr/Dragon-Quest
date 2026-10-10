import { gemIcon } from './MissionsScreen.js';
import type { EquipmentDef } from '../../core/types.js';
import type { App, Screen } from '../App.js';
import { ICONS, clear, h, icon } from '../dom.js';
import { categoryChips, rarityBadge, stageNames, thumb } from './common.js';

export class ShopScreen implements Screen {
  id = 'shop'; label = 'Boutique'; icon = ICONS.shop;
  private el: HTMLElement | null = null;
  private category: string | null = 'head';
  private selected: string | null = null;
  /** Boutique du dragon (or) ou vitrine des vraies récompenses (gemmes). */
  private tab: 'dragon' | 'rewards' = 'dragon';
  constructor(private app: App) {}

  mount(el: HTMLElement): void { this.el = el; this.refresh(); }
  unmount(): void { this.el = null; this.selected = null; this.app.setPreview(null); }

  private rewards(el: HTMLElement): void {
    const { app } = this;
    const book = app.family.book!;
    el.append(h('section', { class: 'card gems-card' },
      h('div', { class: 'row' }, h('span', { class: 'gem' }, gemIcon(16)), h('strong', { class: 'grow' }, `${book.data.gems} gemme${book.data.gems > 1 ? 's' : ''}`)),
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

  private select(def: EquipmentDef): void {
    this.selected = def.id;
    // Prévisualisation en temps réel sur le dragon, AVANT achat.
    this.app.setPreview(this.app.state.isEquipped(def.id) ? null : def);
    this.refresh();
  }

  refresh(): void {
    const el = this.el; if (!el) return;
    const { app } = this;
    clear(el);

    const book = app.family.book;
    if (book) {
      el.append(h('div', { class: 'segmented two shop-tabs' },
        h('button', { class: this.tab === 'dragon' ? 'active' : '', onclick: () => { this.tab = 'dragon'; this.refresh(); } }, 'Pour mon dragon'),
        h('button', { class: this.tab === 'rewards' ? 'active' : '', onclick: () => { this.tab = 'rewards'; this.app.setPreview(null); this.refresh(); } }, 'Vraies récompenses')));
      if (this.tab === 'rewards') { this.rewards(el); return; }
    }

    const active = app.catalog.activeCollections();
    if (active.length) {
      el.append(h('div', { class: 'event-banner', style: { borderColor: active[0].accent, color: active[0].accent } },
        icon(ICONS.star, 18), `Collection ${active.map(c => c.label).join(', ')} disponible !`));
    }
    el.append(categoryChips(app, this.category, id => { this.category = id; this.refresh(); }, 'Tout'));

    const items = app.catalog.shopItems(this.category, { allCollections: app.allCollections });
    const grid = h('div', { class: 'grid' });
    for (const def of items) {
      const owned = app.state.owns(def.id), equipped = app.state.isEquipped(def.id);
      const collection = def.collection ? app.catalog.collections.get(def.collection) : null;
      grid.append(h('button', {
        class: `item${this.selected === def.id ? ' selected' : ''}`,
        style: { '--rarity': app.catalog.rarities.get(def.rarity)?.color },
        onclick: () => this.select(def)
      },
        thumb(app, def, 58),
        h('div', { class: 'item-name' }, def.name),
        collection ? h('div', { class: 'item-tag', style: { color: collection.accent } }, collection.label) : null,
        h('div', { class: 'item-price' },
          equipped ? 'Équipé' : owned ? 'Possédé' : [icon(ICONS.coin, 14), ` ${def.price}`])));
    }
    if (!items.length) grid.append(h('p', { class: 'muted' }, 'Aucun objet dans cette catégorie pour le moment.'));
    el.append(grid);

    const def = this.selected ? app.catalog.item(this.selected) : null;
    if (def) el.append(this.detail(def));
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
      main = h('button', { class: 'btn primary', disabled: !afford, onclick: () => {
        const r = s.buy(def.id);
        app.toast(r.ok ? `${def.name} acheté !` : r.reason);
      } }, afford ? `ACHETER · ${def.price} or` : `Il manque ${def.price - s.data.gold} or`);
    } else if (equipped) {
      main = h('button', { class: 'btn', onclick: () => { s.unequip(def.category); app.setPreview(def); } }, 'RETIRER');
    } else {
      main = h('button', { class: 'btn primary', disabled: !compatible, onclick: () => {
        const r = s.equip(def.id);
        if (r.ok) { app.setPreview(null); app.toast(`${def.name} équipé.`); } else app.toast(r.reason);
      } }, 'ÉQUIPER');
    }

    return h('section', { class: 'detail', style: { '--rarity': app.catalog.rarities.get(def.rarity)?.color } },
      h('div', { class: 'detail-head' }, thumb(app, def, 64),
        h('div', null, h('h3', null, def.name), h('div', { class: 'row' }, rarityBadge(app, def), h('span', { class: 'price' }, icon(ICONS.coin, 14), ` ${def.price}`)))),
      h('p', null, def.description),
      !shownOnDragon ? h('p', { class: 'warn' }, `Non visible sur ce stade. Compatible : ${stageNames(app, def)}.`) : null,
      !compatible && owned ? h('p', { class: 'warn' }, 'Votre dragon doit encore grandir pour le porter.') : null,
      h('div', { class: 'row end' }, main));
  }
}

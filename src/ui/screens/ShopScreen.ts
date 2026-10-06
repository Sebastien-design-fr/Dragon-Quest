import type { EquipmentDef } from '../../core/types.js';
import type { App, Screen } from '../App.js';
import { ICONS, clear, h, icon } from '../dom.js';
import { categoryChips, rarityBadge, stageNames, thumb } from './common.js';

export class ShopScreen implements Screen {
  id = 'shop'; label = 'Boutique'; icon = ICONS.shop;
  private el: HTMLElement | null = null;
  private category: string | null = 'head';
  private selected: string | null = null;
  constructor(private app: App) {}

  mount(el: HTMLElement): void { this.el = el; this.refresh(); }
  unmount(): void { this.el = null; this.selected = null; this.app.setPreview(null); }

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

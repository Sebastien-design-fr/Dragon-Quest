import type { App, Screen } from '../App.js';
import { ICONS, clear, h } from '../dom.js';
import { categoryChips, rarityBadge, thumb } from './common.js';

export class InventoryScreen implements Screen {
  id = 'inventory'; label = 'Inventaire'; icon = ICONS.inventory;
  private el: HTMLElement | null = null;
  private filter: string | null = null;
  constructor(private app: App) {}

  mount(el: HTMLElement): void { this.el = el; this.refresh(); }
  unmount(): void { this.el = null; }

  refresh(): void {
    const el = this.el; if (!el) return;
    const { app } = this;
    const s = app.state;
    clear(el);
    el.append(categoryChips(app, this.filter, id => { this.filter = id; this.refresh(); }));

    const owned = app.catalog.sorted(s.data.owned.map(id => app.catalog.item(id)!).filter(Boolean))
      .filter(d => !this.filter || d.category === this.filter);

    if (!owned.length) {
      el.append(h('div', { class: 'empty' },
        h('p', null, 'Aucun objet ici pour l’instant.'),
        h('button', { class: 'btn primary', onclick: () => app.show('shop') }, 'Aller à la boutique')));
      return;
    }

    const list = h('div', { class: 'list' });
    for (const def of owned) {
      const equipped = s.isEquipped(def.id);
      const compatible = s.isCompatible(def);
      const cat = app.catalog.categories.get(def.category);
      list.append(h('div', { class: `list-row${equipped ? ' equipped' : ''}` },
        thumb(app, def, 48),
        h('div', { class: 'grow' },
          h('div', { class: 'item-name' }, def.name),
          h('div', { class: 'row small' }, rarityBadge(app, def), h('span', { class: 'muted' }, cat?.label ?? def.category))),
        equipped
          ? h('button', { class: 'btn', onclick: () => s.unequip(def.category) }, 'RETIRER')
          : h('button', { class: 'btn primary', disabled: !compatible, title: compatible ? '' : 'Stade insuffisant',
              onclick: () => { const r = s.equip(def.id); if (!r.ok) app.toast(r.reason); } }, 'ÉQUIPER')));
    }
    el.append(list);
  }
}

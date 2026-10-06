import type { EquipmentDef } from '../../core/types.js';
import { Assets } from '../../engine/AssetManager.js';
import type { App } from '../App.js';
import { ICONS, h, icon } from '../dom.js';

/** Vignette d'un équipement : image définitive si elle existe, sinon pictogramme de catégorie teinté par la rareté. */
export function thumb(app: App, def: EquipmentDef, size = 56): HTMLElement {
  const rarity = app.catalog.rarities.get(def.rarity);
  const cat = app.catalog.categories.get(def.category);
  const color = rarity?.color ?? '#999';
  const path = Assets.equipmentIcon(def);
  const box = h('div', { class: `thumb rarity-${def.rarity}`, style: { width: `${size}px`, height: `${size}px`, borderColor: color, '--rarity': color } });
  if (path) box.append(h('img', { src: path, alt: '', loading: 'lazy', decoding: 'async' }));
  else box.append(icon(cat?.icon ?? ICONS.star, Math.round(size * 0.55), color));
  return box;
}

export function rarityBadge(app: App, def: EquipmentDef): HTMLElement {
  const r = app.catalog.rarities.get(def.rarity);
  return h('span', { class: 'badge', style: { color: r?.color, borderColor: r?.color } }, r?.label ?? def.rarity);
}

export function stageNames(app: App, def: EquipmentDef): string {
  return def.compatibleDragonStages.map(id => app.catalog.stage(id)?.label ?? id).join(', ');
}

/** Barre de filtres générée à partir des catégories (aucune catégorie en dur). */
export function categoryChips(app: App, selected: string | null, onPick: (id: string | null) => void, allLabel = 'Tous'): HTMLElement {
  const bar = h('div', { class: 'chips', role: 'tablist' });
  const add = (id: string | null, label: string, path?: string) =>
    bar.append(h('button', { class: `chip${selected === id ? ' active' : ''}`, role: 'tab', 'aria-selected': selected === id ? 'true' : 'false', onclick: () => onPick(id) },
      path ? icon(path, 16) : null, h('span', null, label)));
  add(null, allLabel);
  for (const c of app.catalog.categories.values()) add(c.id, c.label, c.icon);
  return bar;
}

// Personnalisation et collection (refonte UX, point 6).
// - Reflets d'écailles : une couleur par palier de niveau, appliquée au dragon en direct (aperçu immédiat).
// - Carte « Ma collection » : badges, objets et reflets obtenus, pour donner envie de compléter.
import type { TintDef } from '../engine/Lighting.js';
import type { App } from './App.js';
import { ICONS, h, icon } from './dom.js';
import { UI } from './Motion.js';
import { openSheet } from './screens/common.js';

export function tints(app: App): TintDef[] { return app.catalog.visual?.tints?.list ?? []; }

/** Applique au dragon affiché les reflets choisis (dragon de ce téléphone uniquement). */
export function applyTint(app: App, id = app.state.data.tint): void {
  const t = tints(app).find(x => x.id === id);
  app.view.tint = t && t.amount > 0 ? { color: t.color.map(v => v / 255) as [number, number, number], amount: t.amount } : null;
}

export function appearanceSheet(app: App): void {
  const level = app.state.data.level;
  const current = app.state.data.tint ?? 'natural';
  let picked = current;
  openSheet('Reflets d’écailles', close => {
    const grid = h('div', { class: 'tint-grid' });
    const render = () => {
      grid.replaceChildren(...tints(app).map(t => {
        const locked = level < t.level;
        const sw = t.amount > 0 ? `rgb(${t.color.join(',')})` : 'conic-gradient(#2a2430, #6a5a44, #2a2430)';
        return h('button', {
          class: `tint${picked === t.id ? ' on' : ''}${locked ? ' locked' : ''}`, 'aria-pressed': picked === t.id ? 'true' : 'false',
          onclick: () => {
            if (locked) { app.toast(`Débloqué au niveau ${t.level}`); return; }
            picked = t.id; UI.tick(); applyTint(app, t.id); render();
          }
        },
          h('span', { class: 'tint-sw', style: { background: sw } }, locked ? icon(ICONS.lock, 18) : picked === t.id ? icon(ICONS.check, 18) : null),
          h('span', { class: 'tint-name' }, t.label),
          h('span', { class: 'tint-lv' }, locked ? `niveau ${t.level}` : picked === t.id ? 'choisi' : ''));
      }));
    };
    render();
    const done = () => {
      if (picked !== current) { app.state.setTint(picked); void app.act('happy'); app.say('Tu trouves que ça me va ?', null, 3500); }
      close();
    };
    return [
      h('p', { class: 'small muted' }, 'Touche une couleur : ton dragon change tout de suite. De nouveaux reflets se débloquent en montant de niveau.'),
      grid,
      h('div', { class: 'row end' },
        h('button', { class: 'btn ghost', onclick: () => { applyTint(app, current); close(); } }, 'Annuler'),
        h('button', { class: 'btn primary', onclick: done }, 'Garder'))
    ];
  });
}

/** Carte du carrousel « À découvrir » : où en est la collection. */
export function collectionCard(app: App): HTMLElement {
  const book = app.family.book;
  const level = app.state.data.level;
  const tl = tints(app);
  const rows: Array<[string, string, number, number]> = [];
  if (book) rows.push([ICONS.star, 'Badges', book.badgeDefs.filter(b => book.data.badges[b.id]).length, book.badgeDefs.length]);
  const items = [...app.catalog.items.values()].filter(d => app.catalog.categories.get(d.category)?.kind !== 'effect');
  rows.push([ICONS.inventory, 'Objets', app.state.data.owned.length, items.length]);
  if (tl.length) rows.push([ICONS.drop, 'Reflets', tl.filter(t => level >= t.level).length, tl.length]);
  return h('section', { class: 'card coll-card' },
    h('h3', null, 'Ma collection'),
    ...rows.map(([ic, label, n, total]) => h('div', { class: 'coll-row' },
      h('span', { class: 'coll-ic' }, icon(ic, 18)),
      h('span', { class: 'grow' }, h('span', { class: 'coll-label' }, label),
        h('span', { class: 'bar' }, h('span', { class: 'fill', style: { width: `${total ? Math.round(n / total * 100) : 0}%` } }))),
      h('strong', null, `${n}`, h('small', null, ` / ${total}`)))),
    h('div', { class: 'row' },
      h('button', { class: 'btn small-btn', onclick: () => appearanceSheet(app) }, 'Reflets'),
      book ? h('button', { class: 'btn small-btn', onclick: () => app.show('settings') }, 'Badges') : null,
      h('button', { class: 'btn small-btn', onclick: () => app.openChest('owned') }, 'Objets')));
}

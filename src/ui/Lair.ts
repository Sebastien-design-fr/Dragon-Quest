// La grotte du dragon (refonte UX) : les objets achetés avec l'or des missions sont posés DANS la scène du dragon,
// et l'onglet « Sa grotte » sert à les placer, déplacer, agrandir, retourner ou ranger, directement sur la scène.
// Des débris s'accumulent au fil des jours : on les ramasse en les touchant (dans la scène, à tout moment).
import type { DecorItem } from '../engine/DecorLayer.js';
import type { App } from './App.js';
import { ICONS, h, icon } from './dom.js';
import { UI } from './Motion.js';

export interface DecorDef {
  id: string; label: string; price: number; hint: string;
  /** Image (assets/decor/<img>.webp) et place par défaut (unités de scène, voir DecorLayer). */
  img: string; dx: number; dy: number; w: number;
  anchor: DecorItem['anchor'];
  behind?: boolean;
  /** Posé en double, en miroir (torches). */
  twin?: boolean;
  light?: { x: number; y: number; r: number; color: string };
}
export const DECOR: DecorDef[] = [
  { id: 'torches', label: 'Torches murales', price: 60, hint: 'Enfin de la lumière', img: 'torch', dx: -0.34, dy: -0.36, w: 0.07, anchor: 'wall', behind: true, twin: true, light: { x: 0.62, y: 0.12, r: 0.22, color: '255,160,70' } },
  { id: 'lanterns', label: 'Guirlande de lanternes', price: 70, hint: 'Une ambiance magique', img: 'lanterns', dx: 0, dy: -0.62, w: 0.42, anchor: 'wall', behind: true, light: { x: 0.5, y: 0.6, r: 0.3, color: '255,200,110' } },
  { id: 'banner', label: 'Bannière au dragon', price: 80, hint: 'Ses couleurs au mur', img: 'banner', dx: -0.2, dy: -0.5, w: 0.1, anchor: 'wall', behind: true },
  { id: 'candelabra', label: 'Grand chandelier', price: 90, hint: 'Pour les soirées calmes', img: 'candelabra', dx: -0.3, dy: -0.01, w: 0.08, anchor: 'floor', light: { x: 0.5, y: 0.1, r: 0.18, color: '255,210,140' } },
  { id: 'rug', label: 'Grand tapis', price: 90, hint: 'Doux sous les griffes', img: 'rug', dx: 0.02, dy: 0.02, w: 0.62, anchor: 'ground', behind: true },
  { id: 'nest', label: 'Nid de coussins', price: 110, hint: 'Il y dort roulé en boule', img: 'nest', dx: 0.03, dy: 0.02, w: 0.36, anchor: 'floor', behind: true },
  { id: 'brazier', label: 'Brasero suspendu', price: 110, hint: 'Une chaleur douce', img: 'brazier', dx: 0.26, dy: -0.5, w: 0.08, anchor: 'wall', behind: true, light: { x: 0.5, y: 0.78, r: 0.25, color: '255,130,50' } },
  { id: 'crystals', label: 'Cristaux lumineux', price: 130, hint: 'Ils brillent dans le noir', img: 'crystals', dx: 0.34, dy: 0.06, w: 0.12, anchor: 'floor', light: { x: 0.5, y: 0.45, r: 0.24, color: '140,150,255' } },
  { id: 'basin', label: 'Bassin enchanté', price: 150, hint: 'Une eau qui scintille', img: 'basin', dx: -0.24, dy: 0, w: 0.13, anchor: 'floor', light: { x: 0.45, y: 0.3, r: 0.2, color: '120,180,255' } },
  { id: 'chest', label: 'Coffre au trésor', price: 160, hint: 'Tout dragon a besoin d’un trésor', img: 'chest', dx: -0.28, dy: 0.09, w: 0.15, anchor: 'floor' },
  { id: 'statue', label: 'Statue de dragon', price: 180, hint: 'Un ancêtre veille', img: 'statue', dx: 0.28, dy: -0.02, w: 0.1, anchor: 'floor' },
  { id: 'gold', label: 'Montagne d’or', price: 250, hint: 'Le rêve de tout dragon', img: 'gold', dx: 0.24, dy: 0.1, w: 0.16, anchor: 'floor' }
];
const DEBRIS_IMG = ['bone', 'bones', 'rocks', 'scales', 'pot', 'straw', 'eggshell', 'rag'];

/** Placement choisi par l'utilisateur (absent = place par défaut). */
export interface DecorPos { dx: number; dy: number; s: number; flip: boolean; hidden?: boolean }

interface LairData { decorPos?: Record<string, DecorPos>; debrisSlots?: number[] }

/** Clés posables : un objet, ou chaque torche du duo (« torches », « torches#2 »). */
function pieces(d: DecorDef): Array<{ key: string; dx: number; flip: boolean }> {
  return d.twin ? [{ key: d.id, dx: d.dx, flip: false }, { key: `${d.id}#2`, dx: -d.dx, flip: true }] : [{ key: d.id, dx: d.dx, flip: false }];
}
const defOf = (key: string) => DECOR.find(d => d.id === key.split('#')[0]);

function data(app: App): LairData { return app.family.companion!.data as unknown as LairData; }

export function placement(app: App, key: string): DecorPos {
  const d = defOf(key)!;
  const p = pieces(d).find(x => x.key === key)!;
  return data(app).decorPos?.[key] ?? { dx: p.dx, dy: d.dy, s: 1, flip: p.flip };
}
function setPlacement(app: App, key: string, pos: DecorPos): void {
  const ld = data(app);
  ld.decorPos = { ...(ld.decorPos ?? {}), [key]: pos };
  app.family.companion!.save();
}

/** Débris présents : des emplacements stables, pour qu'aucun ne saute quand on en ramasse un. */
function debrisSlots(app: App): number[] {
  const comp = app.family.companion!;
  const n = comp.lair().debris;
  const ld = data(app);
  let slots = (ld.debrisSlots ?? []).filter(s => s >= 0 && s < 16);
  if (slots.length > n) slots = slots.slice(0, n);
  for (let s = 0; slots.length < n && s < 16; s++) if (!slots.includes(s)) slots.push(s);
  if (JSON.stringify(slots) !== JSON.stringify(ld.debrisSlots ?? [])) { ld.debrisSlots = slots; comp.save(); }
  return slots;
}
function debrisItem(slot: number): DecorItem {
  let seed = 97 + slot * 7919;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  rnd();
  const side = slot % 2 ? 1 : -1;
  return { key: `debris:${slot}`, img: `assets/decor/${DEBRIS_IMG[Math.floor(rnd() * DEBRIS_IMG.length)]}.webp`,
    dx: side * (0.08 + rnd() * 0.28), dy: 0.06 + rnd() * 0.08, w: 0.07 + rnd() * 0.03, anchor: 'floor', flip: rnd() < 0.5, debris: true };
}

let dragging = false;

/** Objets et débris de la grotte posés dans la scène (dragon de ce téléphone uniquement). */
export function syncDecor(app: App): void {
  if (dragging) return;
  const comp = app.family.companion;
  if (!comp || !app.showingOwn) { app.view.decor.set([]); return; }
  const owned = new Set(comp.lair().owned);
  const items: DecorItem[] = [];
  for (const d of DECOR) {
    if (!owned.has(d.id)) continue;
    for (const p of pieces(d)) {
      const pos = placement(app, p.key);
      if (pos.hidden) continue;
      items.push({ key: p.key, img: `assets/decor/${d.img}.webp`, dx: pos.dx, dy: pos.dy, w: d.w * pos.s, anchor: d.anchor, flip: pos.flip, behind: d.behind, light: d.light });
    }
  }
  for (const s of debrisSlots(app)) items.push(debrisItem(s));
  app.view.decor.set(items);
}

/** Ramasser un débris : la pièce s'efface, le dragon est content. */
function tidy(app: App, key: string): void {
  const comp = app.family.companion!;
  const slot = Number(key.split(':')[1]);
  const it = app.view.decor.items.find(i => i.key === key);
  if (it) it.gone = 0.001;
  const ld = data(app);
  ld.debrisSlots = (ld.debrisSlots ?? []).filter(s => s !== slot);
  comp.tidyLair();
  UI.tick();
  if (!comp.lair().debris) { app.toast(`La grotte de ${comp.name} est toute rangée !`); void app.act('happy'); }
  editorRefresh?.();
}

/**
 * Toucher un débris dans la scène, à tout moment, le ramasse (avant que le dragon ne réagisse au toucher).
 * En mode aménagement, la scène sert à déplacer les objets.
 */
export function installLairTaps(app: App): void {
  const stage = app.root.querySelector<HTMLElement>('.stage-view');
  if (!stage) return;
  stage.addEventListener('pointerdown', e => {
    if (editor || !app.showingOwn || !app.family.companion) return;
    const p = app.view.toCanvas(e.clientX, e.clientY);
    const hit = app.view.decor.hit(p.x, p.y, true);
    if (!hit) return;
    e.stopPropagation(); e.preventDefault();
    tidy(app, hit.key);
  }, { capture: true });
}

// ---------------- Mode aménagement ----------------
let editor: HTMLElement | null = null;
let editorRefresh: (() => void) | null = null;

export function openLair(app: App): void {
  const comp = app.family.companion;
  if (!comp || editor) return;
  if (app.currentId !== 'dragon') app.show('dragon');
  const view = app.view;
  const stage = app.root.querySelector<HTMLElement>('.stage-view')!;
  app.root.classList.add('lair-edit');
  app.stageHud.show(false);
  view.decor.editing = true;
  view.decor.selected = null;

  const tools = h('div', { class: 'lx-tools' });
  const list = h('div', { class: 'lx-list' });
  const info = h('p', { class: 'lx-info' });
  const goldEl = h('span', { class: 'lx-gold' });
  const done = () => close();
  const panel = h('section', { class: 'lx', role: 'dialog', 'aria-label': 'Aménager la grotte' },
    h('div', { class: 'lx-head' },
      h('h3', null, `La grotte de ${comp.name}`), goldEl,
      h('button', { class: 'btn primary small-btn', onclick: done }, 'Terminé')),
    info, tools, list);
  document.body.append(panel);
  editor = panel;
  requestAnimationFrame(() => panel.classList.add('open'));

  const select = (key: string | null) => { view.decor.selected = key; render(); };

  const render = () => {
    const l = comp.lair();
    goldEl.replaceChildren(icon(ICONS.coin, 15), String(app.state.data.gold));
    info.textContent = l.debris
      ? `Fais glisser un objet pour le déplacer. ${l.debris} débris traîne${l.debris > 1 ? 'nt' : ''} : touche-les pour les ramasser.`
      : 'Fais glisser un objet pour le déplacer, touche-le pour l’agrandir, le retourner ou le ranger.';
    // outils de l'objet sélectionné
    const key = view.decor.selected;
    const def = key ? defOf(key) : null;
    if (key && def) {
      const pos = placement(app, key);
      // toujours repartir de la position enregistrée (elle a pu changer par un glisser depuis l'affichage des outils)
      const set = (p: Partial<DecorPos>) => { setPlacement(app, key, { ...placement(app, key), ...p }); UI.tick(); syncDecor(app); render(); };
      tools.replaceChildren(
        h('strong', { class: 'grow' }, def.label + (key.endsWith('#2') ? ' (2)' : '')),
        h('button', { class: 'lx-tool', 'aria-label': 'Plus petit', onclick: () => set({ s: Math.max(0.6, +(pos.s - 0.1).toFixed(2)) }) }, '−'),
        h('button', { class: 'lx-tool', 'aria-label': 'Plus grand', onclick: () => set({ s: Math.min(1.6, +(pos.s + 0.1).toFixed(2)) }) }, '+'),
        h('button', { class: 'lx-tool', 'aria-label': 'Retourner', onclick: () => set({ flip: !pos.flip }) }, '⇋'),
        h('button', { class: 'lx-tool wide', onclick: () => { set({ hidden: true }); select(null); } }, 'Ranger'));
      tools.hidden = false;
    } else { tools.replaceChildren(); tools.hidden = true; }
    // catalogue : posés, rangés, à acheter
    const owned = new Set(l.owned);
    list.replaceChildren(...DECOR.map(d => {
      const has = owned.has(d.id);
      const placed = has && pieces(d).some(p => !placement(app, p.key).hidden);
      return h('button', {
        class: `lx-item${has ? ' owned' : ''}${placed ? ' placed' : ''}`,
        onclick: () => {
          if (!has) {
            if (!comp.buyDecor(d.id, d.price)) { app.toast('Pas assez d’or : fais tes quêtes !'); return; }
            UI.success(); app.toast(`${d.label} : à toi de le placer !`);
            syncDecor(app); select(d.id); return;
          }
          if (!placed) { for (const p of pieces(d)) setPlacement(app, p.key, { ...placement(app, p.key), hidden: false }); syncDecor(app); select(d.id); return; }
          select(d.id);
        }
      },
        h('img', { src: `assets/decor/${d.img}.webp`, alt: '', draggable: 'false' }),
        h('span', { class: 'lx-name' }, d.label),
        h('span', { class: 'lx-state' }, !has ? h('span', null, icon(ICONS.coin, 12), ` ${d.price}`) : placed ? 'Dans la grotte' : 'Rangé · le poser'));
    }));
  };
  editorRefresh = render;
  render();

  // ----- déplacer les objets sur la scène -----
  let drag: { key: string; x0: number; y0: number; dx: number; dy: number; id: number; moved: boolean } | null = null;
  const down = (e: PointerEvent) => {
    e.stopPropagation(); e.preventDefault();
    const p = view.toCanvas(e.clientX, e.clientY);
    const hit = view.decor.hit(p.x, p.y);
    if (!hit) { select(null); return; }
    if (hit.debris) { tidy(app, hit.key); return; }
    const pos = placement(app, hit.key);
    drag = { key: hit.key, x0: p.x, y0: p.y, dx: pos.dx, dy: pos.dy, id: e.pointerId, moved: false };
    dragging = true;
    stage.setPointerCapture?.(e.pointerId);
    if (view.decor.selected !== hit.key) select(hit.key);
  };
  const move = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.id) return;
    e.stopPropagation(); e.preventDefault();
    const p = view.toCanvas(e.clientX, e.clientY);
    const u = view.decor.frame.u || 1;
    const def = defOf(drag.key)!;
    const nx = Math.max(-0.6, Math.min(0.6, drag.dx + (p.x - drag.x0) / u));
    const lo = def.anchor === 'wall' ? -0.85 : -0.12, hi = def.anchor === 'wall' ? -0.1 : 0.2;
    const ny = Math.max(lo, Math.min(hi, drag.dy + (p.y - drag.y0) / u));
    if (Math.abs(p.x - drag.x0) + Math.abs(p.y - drag.y0) > 4) drag.moved = true;
    const it = view.decor.items.find(i => i.key === drag!.key);
    if (it) { it.dx = nx; it.dy = ny; }
  };
  const up = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.id) return;
    e.stopPropagation();
    const it = view.decor.items.find(i => i.key === drag!.key);
    if (it && drag.moved) { setPlacement(app, drag.key, { ...placement(app, drag.key), dx: it.dx, dy: it.dy }); UI.tick(); }
    drag = null; dragging = false;
    syncDecor(app);
    render();
  };
  stage.addEventListener('pointerdown', down, { capture: true });
  stage.addEventListener('pointermove', move, { capture: true });
  stage.addEventListener('pointerup', up, { capture: true });
  stage.addEventListener('pointercancel', up, { capture: true });

  function close(): void {
    stage.removeEventListener('pointerdown', down, { capture: true });
    stage.removeEventListener('pointermove', move, { capture: true });
    stage.removeEventListener('pointerup', up, { capture: true });
    stage.removeEventListener('pointercancel', up, { capture: true });
    view.decor.editing = false; view.decor.selected = null;
    app.root.classList.remove('lair-edit');
    panel.classList.remove('open');
    setTimeout(() => panel.remove(), 300);
    editor = null; editorRefresh = null; dragging = false;
    app.stageHud.show(app.currentId === 'dragon' && app.showingOwn);
    syncDecor(app);
    app.refresh();
  }
}

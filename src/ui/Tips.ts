// Bulles d'aide qui ne s'affichent qu'une fois (au lieu de phrases d'explication permanentes).
// Une seule bulle par ouverture de l'appli, sur l'écran du dragon, quand rien d'autre ne se passe.
import type { App } from './App.js';
import { h } from './dom.js';
import { unlocked } from './Unlocks.js';

const KEY = 'quete-du-dragon:tips';

interface Tip { id: string; text: string; at: (app: App) => { x: number; y: number } | null; when?: (app: App) => boolean }

function seen(): string[] { try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') as string[]; } catch { return []; } }
function markSeen(id: string): void { try { localStorage.setItem(KEY, JSON.stringify([...new Set([...seen(), id])])); } catch { /* */ } }

/** Position (dans la scène) d'un élément de l'interface. */
function elAt(app: App, sel: string): { x: number; y: number } | null {
  const host = app.root.querySelector('.stage-view');
  const el = document.querySelector<HTMLElement>(sel);
  if (!el || !host || el.hidden) return null;
  const r = el.getBoundingClientRect(), hr = host.getBoundingClientRect();
  return { x: r.left - hr.left + r.width / 2, y: r.top - hr.top };
}
/** Position (dans la scène) d'un objet de la grotte. */
function decorAt(app: App, key: string): { x: number; y: number } | null {
  const r = app.view.decor.rects.find(x => x.key === key);
  if (!r) return null;
  const c = app.view.canvas, host = app.root.querySelector('.stage-view');
  if (!host) return null;
  const cr = c.getBoundingClientRect(), hr = host.getBoundingClientRect();
  const s = cr.width / (c.width || 1);
  return { x: cr.left - hr.left + (r.x + r.w / 2) * s, y: cr.top - hr.top + r.y * s };
}

const TIPS: Tip[] = [
  { id: 'longpress', text: 'Appui long sur ton dragon : toutes les actions au même endroit.', at: app => { const p = app.view.screenPos('body_center'); return p ? { x: p.x, y: p.y - 20 } : null; } },
  { id: 'bowl', text: 'Touche la gamelle pour le nourrir. Les objets achetés pour sa grotte servent aussi : bassin pour le laver, nid pour dormir, coffre pour la boutique.', at: app => decorAt(app, 'tool:bowl') },
  { id: 'wolf', text: 'Touche le loup : caresses, friandises, et ses quêtes pour le dragon.', at: app => elAt(app, 'canvas.wolf'), when: app => unlocked(app, 'wolf') },
  { id: 'today', text: 'Ta journée en un coup d’œil : touche une pastille pour y aller directement.', at: app => { const p = elAt(app, '.td-strip'); return p ? { x: Math.min(p.x, 120), y: p.y } : null; } },
  { id: 'fly', text: 'Glisse vers le haut sur ton dragon : il s’envole !', at: app => { const p = app.view.screenPos('head_anchor'); return p ? { x: p.x, y: p.y } : null; } }
];

let shownThisSession = false;

/** Essaie d'afficher la prochaine bulle d'aide (une seule par ouverture). */
export function nextTip(app: App): void {
  if (shownThisSession || !app.showingOwn || app.currentId !== 'dragon' || app.sleeping || document.querySelector('.sheet, .tip-bubble, .bubble.show')) { if (!shownThisSession) setTimeout(() => nextTip(app), 8000); return; }
  const done = seen();
  const tip = TIPS.find(t => !done.includes(t.id) && (t.when?.(app) ?? true) && t.at(app));
  if (!tip) return;
  const pos = tip.at(app)!;
  const host = app.root.querySelector<HTMLElement>('.stage-view');
  if (!host) return;
  shownThisSession = true;
  const close = () => { markSeen(tip.id); el.classList.add('out'); setTimeout(() => el.remove(), 250); };
  const below = pos.y < 140;
  const el = h('div', { class: `tip-bubble${below ? ' below' : ''}`, role: 'status' },
    h('span', null, tip.text), h('button', { class: 'tip-ok', onclick: (e: Event) => { e.stopPropagation(); close(); } }, 'Compris'));
  host.append(el);
  const w = Math.min(260, host.clientWidth - 24);
  el.style.width = `${w}px`;
  el.style.left = `${Math.max(12, Math.min(host.clientWidth - w - 12, pos.x - w / 2))}px`;
  el.style.setProperty('--ax', `${Math.max(16, Math.min(w - 16, pos.x - parseFloat(el.style.left)))}px`);
  if (below) el.style.top = `${pos.y + 18}px`; else el.style.bottom = `${host.clientHeight - pos.y + 12}px`;
  setTimeout(() => { if (el.isConnected) close(); }, 14000);
}

export function installTips(app: App): void {
  setTimeout(() => nextTip(app), 6000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { shownThisSession = false; setTimeout(() => nextTip(app), 6000); } });
}

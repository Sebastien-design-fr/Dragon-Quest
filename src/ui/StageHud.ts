// Interface posée sur la scène du dragon (écran Dragon) : jauges en anneaux, barre d'actions,
// plateau de nourriture à lancer, menu rond (appui long). Le dragon reste au centre.
import { FOODS, isNight, type FoodId } from '../family/Companion.js';
import { Sound } from '../engine/Sound.js';
import type { App } from './App.js';
import { ICONS, clear, h, icon } from './dom.js';
import { gamesSheet, statusSheet, tricksSheet } from './CareSheets.js';
import { sayFor } from '../family/Thoughts.js';
import { voyageSheet } from './VoyageUI.js';

const SVGNS = 'http://www.w3.org/2000/svg';

/** Dessins des aliments (SVG en ligne, pas d'emoji). */
export const FOOD_ART: Record<FoodId, string> = {
  ration: `<svg viewBox="0 0 48 48"><ellipse cx="24" cy="34" rx="17" ry="7" fill="#5a3b22"/><path d="M7 30c0 8 8 12 17 12s17-4 17-12z" fill="#7a5130"/><path d="M7 30h34" stroke="#2b1a0e" stroke-width="1.5"/><circle cx="17" cy="27" r="5" fill="#b8573a"/><circle cx="26" cy="25" r="6" fill="#c9683f"/><circle cx="33" cy="28" r="4.5" fill="#a94a31"/><path d="M14 25c2-2 4-2 6 0M23 22c2-2 5-2 7 0" stroke="#f0b48a" stroke-width="1.2" fill="none" opacity=".7"/></svg>`,
  meat: `<svg viewBox="0 0 48 48"><path d="M30 8c8 0 12 6 11 13-1 8-9 13-16 12l-9 9c-2 2-6 1-6-2l-1-1c-3 0-4-4-2-6l9-9c-1-8 5-16 14-16z" fill="#a8452c"/><path d="M30 10c6 0 9 5 8 10-1 6-7 10-12 9" stroke="#e08a5c" stroke-width="2" fill="none"/><path d="M15 33l-7 7" stroke="#f3e6cf" stroke-width="5" stroke-linecap="round"/><circle cx="7.5" cy="40.5" r="3" fill="#f3e6cf"/><circle cx="10" cy="43" r="2.6" fill="#f3e6cf"/></svg>`,
  fish: `<svg viewBox="0 0 48 48"><path d="M6 24c6-9 16-12 25-9 4 1 7 4 9 9-2 5-5 8-9 9-9 3-19 0-25-9z" fill="#5d8fb3"/><path d="M40 24l6-7v14z" fill="#4a7697"/><path d="M12 24c5-5 12-7 19-5" stroke="#a9d3ee" stroke-width="1.6" fill="none"/><circle cx="14" cy="22" r="2" fill="#10202c"/><path d="M20 28c3 1 6 1 9 0" stroke="#3d6683" stroke-width="1.4" fill="none"/></svg>`,
  fireFruit: `<svg viewBox="0 0 48 48"><defs><radialGradient id="ff" cx="40%" cy="40%"><stop offset="0" stop-color="#ffe08a"/><stop offset=".45" stop-color="#ff8a2a"/><stop offset="1" stop-color="#b8261a"/></radialGradient></defs><circle cx="24" cy="27" r="15" fill="url(#ff)"/><path d="M24 12c-1-4 1-7 5-8-1 4-2 6-5 8z" fill="#5f8f3a"/><path d="M18 20c2-2 5-3 8-2" stroke="#fff3c4" stroke-width="2" fill="none" opacity=".8"/><circle cx="24" cy="27" r="19" fill="none" stroke="#ffb347" stroke-opacity=".35" stroke-width="3"/></svg>`,
  treat: `<svg viewBox="0 0 48 48"><path d="M4 18l9 6-9 6zM44 18l-9 6 9 6z" fill="#d9a84a"/><rect x="12" y="14" width="24" height="20" rx="10" fill="#c2477a"/><path d="M16 18c4 4 12 4 16 0M16 30c4-4 12-4 16 0" stroke="#f6b8d2" stroke-width="2" fill="none"/></svg>`
};

type ActionId = 'feed' | 'wash' | 'play' | 'tricks' | 'fly' | 'sleep' | 'voyage';

export class StageHud {
  private root: HTMLElement;
  private status: HTMLElement;
  private bar: HTMLElement;
  private tray: HTMLElement | null = null;
  private radial: HTMLElement | null = null;
  private visible = false;

  constructor(private app: App) {
    this.root = h('div', { class: 'sh' });
    this.status = h('button', { class: 'sh-status', 'aria-label': 'État du dragon', onclick: () => statusSheet(app) });
    this.bar = h('div', { class: 'sh-bar', role: 'toolbar', 'aria-label': 'Actions' });
    this.root.append(this.status, this.bar);
    app.root.querySelector('.stage-view')?.append(this.root);
    this.root.hidden = true;
  }

  show(on: boolean): void {
    this.visible = on;
    this.root.hidden = !on;
    if (!on) { this.closeTray(); this.closeRadial(); }
    else this.render();
  }

  render(): void {
    if (!this.visible) return;
    const { app } = this;
    const comp = app.family.companion;
    if (!comp) { this.root.hidden = true; return; }
    const d = comp.data;
    // Jauges en anneaux
    const ring = (v: number, ic: string, label: string) => {
      const lv = v < 50 ? 'mid' : 'ok'; // jamais rouge : il ne souffre pas, au pire il s'ennuie
      return h('span', { class: `sh-ring ${lv}`, style: { '--v': String(Math.round(v)) }, title: `${label} : ${Math.round(v)} %` }, icon(ic, 15));
    };
    clear(this.status);
    this.status.append(
      h('span', { class: 'sh-name' }, h('strong', null, comp.name), h('em', null, comp.mood().label)),
      h('span', { class: 'sh-rings' },
        ring(d.hunger, ICONS.meat, 'Faim'), ring(d.clean, ICONS.drop, 'Propreté'), ring(d.mood, ICONS.heart, 'Humeur')));
    this.renderBar();
  }

  private renderBar(): void {
    const { app } = this;
    const comp = app.family.companion!;
    const rations = Object.values(comp.data.food).reduce((a, b) => a + b, 0);
    const evening = isNight() || new Date().getHours() >= 20;
    const btn = (id: ActionId, label: string, ic: string, extra = '', badge?: string) =>
      h('button', { class: `sh-btn ${extra}`, 'data-act': id, onclick: () => this.action(id) },
        h('span', { class: 'sh-ico' }, icon(ic, 22), badge ? h('span', { class: 'sh-badge' }, badge) : null), h('span', { class: 'sh-lbl' }, label));
    const asleep = app.sleeping;
    clear(this.bar);
    this.bar.append(
      btn('feed', 'Nourrir', ICONS.meat, asleep ? 'dim' : '', rations ? String(rations) : undefined),
      btn('wash', app.careMode === 'wash' ? 'Lavage' : 'Laver', ICONS.drop, app.careMode === 'wash' ? 'on' : asleep ? 'dim' : ''),
      btn('play', 'Jouer', ICONS.game, asleep ? 'dim' : ''),
      btn('tricks', 'Tours', ICONS.spark, asleep ? 'dim' : ''),
      btn('voyage', 'Voyage', ICONS.compass, asleep ? 'dim' : ''),
      btn('sleep', asleep ? 'Réveiller' : evening ? 'Coucher' : 'Sieste', ICONS.moon, asleep ? 'on' : ''));
  }

  /** Actions communes (barre, menu rond, bulles). */
  action(id: ActionId | 'pet'): void {
    const { app } = this;
    const comp = app.family.companion;
    if (!comp) return;
    this.closeRadial();
    if (id === 'voyage') { voyageSheet(app); return; }
    if (app.sleeping && id !== 'sleep') { app.say(id === 'feed' ? 'Zzz… il dort. Réveille-le d’abord.' : 'Chut… il dort.', null, 2500); return; }
    switch (id) {
      case 'feed': this.openTray(); break;
      case 'wash':
        app.careMode = app.careMode === 'wash' ? 'pet' : 'wash';
        if (app.careMode === 'wash') app.toast(comp.data.clean >= 100 ? 'Il est déjà tout propre !' : 'Frotte ses écailles avec ton doigt');
        this.renderBar();
        break;
      case 'play': gamesSheet(app); break;
      case 'tricks': tricksSheet(app); break;
      case 'fly': void app.act('hover'); break;
      case 'sleep': app.sleepButton(); break;
      case 'pet': comp.pet(); void app.act('purr'); app.say(sayFor('purr'), null, 2500); break;
    }
  }

  // ---------- Menu rond (appui long sur le dragon) ----------
  openRadial(clientX: number, clientY: number): void {
    this.closeRadial();
    const host = this.root.parentElement!;
    const r = host.getBoundingClientRect();
    const x = clientX - r.left, y = clientY - r.top;
    const items: Array<[ActionId | 'pet', string, string]> = [
      ['feed', 'Nourrir', ICONS.meat], ['wash', 'Laver', ICONS.drop], ['pet', 'Câlin', ICONS.hand],
      ['play', 'Jouer', ICONS.game], ['fly', 'Voler', ICONS.wing], ['tricks', 'Tours', ICONS.spark], ['voyage', 'Voyage', ICONS.compass], ['sleep', 'Dodo', ICONS.moon]
    ];
    const R = 86;
    // éventail au-dessus du doigt (vers le bas si le doigt est en haut de la scène)
    const up = y > 150;
    const cx = Math.max(R + 30, Math.min(r.width - R - 30, x));
    const cy = Math.max(60, Math.min(r.height - 40, y));
    const menu = h('div', { class: 'sh-radial', style: { left: `${cx}px`, top: `${cy}px` } });
    items.forEach(([id, label, ic], i) => {
      const ang = up ? Math.PI + (Math.PI * i) / (items.length - 1) : (Math.PI * i) / (items.length - 1);
      const bx = Math.cos(ang) * R, by = Math.sin(ang) * R;
      menu.append(h('button', { class: 'sh-rbtn', style: { '--x': `${bx.toFixed(1)}px`, '--y': `${by.toFixed(1)}px`, '--d': `${i * 25}ms` }, onclick: (e: Event) => { e.stopPropagation(); this.action(id); } },
        icon(ic, 20), h('span', null, label)));
    });
    const veil = h('div', { class: 'sh-veil', onpointerdown: (e: Event) => { e.stopPropagation(); this.closeRadial(); } });
    this.radial = h('div', { class: 'sh-radial-wrap' }, veil, menu);
    host.append(this.radial);
    navigator.vibrate?.(15);
    requestAnimationFrame(() => menu.classList.add('open'));
  }
  closeRadial(): void { this.radial?.remove(); this.radial = null; }

  // ---------- Plateau de nourriture : on lance, il attrape ----------
  openTray(): void {
    const { app } = this;
    const comp = app.family.companion!;
    this.closeTray();
    const host = this.root.parentElement!;
    const list = h('div', { class: 'sh-foods' });
    const tray = h('div', { class: 'sh-tray' },
      h('div', { class: 'sh-tray-head' },
        h('strong', { class: 'small' }, `Faim ${Math.round(comp.data.hunger)} %`),
        h('span', { class: 'small muted grow' }, 'Lance-lui à manger !'),
        h('button', { class: 'sh-close', 'aria-label': 'Fermer', onclick: () => this.closeTray() }, '×')),
      list);
    const fill = () => {
      clear(list);
      for (const f of FOODS) {
        const n = comp.data.food[f.id] ?? 0;
        if (!n && !f.price) continue;
        const tok = h('div', { class: `sh-food${n ? '' : ' empty'}`, 'data-food': f.id });
        tok.innerHTML = FOOD_ART[f.id];
        const fav = comp.data.favKnown && comp.data.fav === f.id;
        list.append(h('div', { class: 'sh-food-cell' }, tok,
          h('span', { class: 'sh-food-n' }, `× ${n}`),
          fav ? h('span', { class: 'sh-fav', title: 'Son plat préféré' }, icon(ICONS.star, 12)) : null,
          f.price ? h('button', { class: 'sh-buy', onclick: () => {
            if (comp.buy(f.id)) { app.toast(`${f.label} achetée (−${f.price} or)`); fill(); } else app.toast(`Il faut ${f.price} or`);
          } }, `+ ${f.price}`) : null));
        this.bindToken(tok, f.id, () => fill());
      }
      if (!list.children.length) list.append(h('p', { class: 'small muted' }, 'Plus rien pour aujourd’hui : le garde-manger se remplit demain matin.'));
    };
    fill();
    this.tray = tray;
    host.append(tray);
    this.bar.classList.add('hide');
    requestAnimationFrame(() => tray.classList.add('open'));
  }
  closeTray(): void {
    this.tray?.remove(); this.tray = null;
    this.bar.classList.remove('hide');
  }

  private bindToken(tok: HTMLElement, id: FoodId, refill: () => void): void {
    const { app } = this;
    let drag: { el: HTMLElement; x: number; y: number; sx: number; sy: number; t: number; moved: number } | null = null;
    tok.addEventListener('pointerdown', e => {
      const comp = app.family.companion!;
      if ((comp.data.food[id] ?? 0) <= 0) { app.toast('Il n’en reste plus : achète-en avec le bouton +'); return; }
      e.preventDefault();
      tok.setPointerCapture(e.pointerId);
      const ghost = h('div', { class: 'sh-flying' });
      ghost.innerHTML = FOOD_ART[id];
      document.body.append(ghost);
      drag = { el: ghost, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now(), moved: 0 };
      place(ghost, e.clientX, e.clientY);
      app.view.lookAt(e.clientX, e.clientY);
    });
    tok.addEventListener('pointermove', e => {
      if (!drag) return;
      drag.moved += Math.hypot(e.clientX - drag.x, e.clientY - drag.y);
      drag.x = e.clientX; drag.y = e.clientY;
      place(drag.el, e.clientX, e.clientY);
      app.view.lookAt(e.clientX, e.clientY);
    });
    const end = (e: PointerEvent) => {
      if (!drag) return;
      const g = drag; drag = null;
      // simple toucher ou glissé vers le haut : on lance vers sa gueule
      const thrown = g.moved < 10 || g.sy - e.clientY > 30;
      if (!thrown) { g.el.remove(); return; }
      this.throwFood(g.el, e.clientX, e.clientY, id, refill);
    };
    tok.addEventListener('pointerup', end);
    tok.addEventListener('pointercancel', e => { if (drag) { drag.el.remove(); drag = null; } void e; });
    function place(el: HTMLElement, x: number, y: number) { el.style.transform = `translate(${x - 28}px, ${y - 28}px)`; }
  }

  /** Trajectoire en cloche jusqu'à la gueule ; il tend le cou et happe. */
  private throwFood(el: HTMLElement, x0: number, y0: number, id: FoodId, refill: () => void): void {
    const { app } = this;
    const comp = app.family.companion!;
    const cv = app.view.canvas.getBoundingClientRect();
    const m = app.view.screenPos('mouth_anchor') ?? { x: cv.width * 0.6, y: cv.height * 0.4 };
    const x1 = cv.left + m.x, y1 = cv.top + m.y;
    const full = comp.data.hunger >= 95;
    const dur = 620;
    const peak = Math.min(y0, y1) - 120;
    const t0 = performance.now();
    let caught = false;
    void Sound.play('wings', { user: true, gain: 0.25, rate: 1.8 });
    const step = (now: number) => {
      const u = Math.min(1, (now - t0) / dur);
      // parabole passant par le sommet
      const x = x0 + (x1 - x0) * u;
      const a = 1 - u;
      const y = a * a * y0 + 2 * a * u * peak + u * u * y1;
      el.style.transform = `translate(${x - 28}px, ${y - 28}px) rotate(${u * 540}deg) scale(${1 - u * 0.35})`;
      app.view.lookAt(x, y);
      if (!caught && u > 0.45 && !full) { caught = true; void app.view.play('catch'); }
      if (u < 1) { requestAnimationFrame(step); return; }
      if (full) {
        // il n'a plus faim : l'aliment rebondit et tombe
        el.animate([{ transform: el.style.transform, opacity: 1 }, { transform: `translate(${x1 - 60}px, ${cv.bottom - 70}px) rotate(900deg) scale(.6)`, opacity: 0 }], { duration: 700, easing: 'cubic-bezier(.3,.6,.6,1)' }).onfinish = () => el.remove();
        app.say(sayFor('full'), null, 2500);
        app.view.lookAt(null);
        return;
      }
      el.remove();
      app.view.lookAt(null);
      app.view.emit('crumbs', 'mouth_anchor');
      const r = comp.feed(id);
      if (r === 'ok') { navigator.vibrate?.(20); app.surprisesGift(); }
      refill();
    };
    requestAnimationFrame(step);
  }

  isTrayOpen(): boolean { return !!this.tray; }
}

/** Anneau SVG (pour d'autres écrans). */
export function ringSvg(v: number, size = 44, stroke = 5, color = '#d9a84a'): SVGSVGElement {
  const svg = document.createElementNS(SVGNS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${size} ${size}`); svg.setAttribute('width', String(size)); svg.setAttribute('height', String(size));
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const bg = document.createElementNS(SVGNS, 'circle');
  bg.setAttribute('cx', String(size / 2)); bg.setAttribute('cy', String(size / 2)); bg.setAttribute('r', String(r));
  bg.setAttribute('fill', 'none'); bg.setAttribute('stroke', '#2a2430'); bg.setAttribute('stroke-width', String(stroke));
  const fg = bg.cloneNode() as SVGCircleElement;
  fg.setAttribute('stroke', color); fg.setAttribute('stroke-linecap', 'round');
  fg.setAttribute('stroke-dasharray', `${(c * Math.max(0, Math.min(1, v))).toFixed(1)} ${c.toFixed(1)}`);
  fg.setAttribute('transform', `rotate(-90 ${size / 2} ${size / 2})`);
  svg.append(bg, fg);
  return svg;
}

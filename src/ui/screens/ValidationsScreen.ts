import { Assets } from '../../engine/AssetManager.js';
import { rewardText, type MissionStatus } from '../../family/model.js';
import type { ParentHub } from '../../family/ParentHub.js';
import type { App, Screen } from '../App.js';
import { ICONS, clear, h, icon } from '../dom.js';
import { openSheet } from './common.js';

/** Sélecteur d'enfant (affiché seulement s'il y en a plusieurs). */
export function childPicker(app: App, rerender: () => void): HTMLElement | null {
  const hub = app.family.hub!;
  const ids = hub.childIds();
  if (!app.selectedChild && ids.length) app.selectedChild = ids[0];
  if (ids.length < 2) return null;
  return h('div', { class: 'chips' }, ...ids.map(id => h('button', {
    class: `chip${app.selectedChild === id ? ' active' : ''}`,
    onclick: () => { app.selectedChild = id; app.showChildDragon(); app.renderHud(); rerender(); }
  }, hub.child(id)?.name || 'Enfant')));
}

const STATUS_LABEL: Record<MissionStatus, string> = { todo: 'À faire', pending: 'À valider', done: 'Faite', refused: 'À refaire' };

type Pending = ReturnType<ParentHub['pendingList']>[number];
type ChildEntry = NonNullable<ReturnType<ParentHub['child']>>;

/** Part de la largeur de la carte à dépasser pour valider un glissement. */
const SWIPE_THRESHOLD = 0.35;
/** Cartes visibles dans la pile (la première + celles qui dépassent derrière). */
const DECK_DEPTH = 3;
const CROSS = 'M6 6l12 12 M18 6L6 18';
const REDO = 'M4 12a8 8 0 1 0 2.5-5.8 M4 4v4h4';

const hhmm = (t: number) => new Date(t).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
function when(t: number): string {
  const d = new Date(t);
  if (d.toDateString() === new Date().toDateString()) return hhmm(t);
  return `${d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} · ${hhmm(t)}`;
}

/** Anneau de progression (conic-gradient) avec un contenu au centre. */
function ring(segments: Array<[number, string]>, size: number, label: Node | string, cls = ''): HTMLElement {
  let at = 0; const stops: string[] = [];
  for (const [pct, color] of segments) {
    const v = Math.max(0, Math.min(100 - at, pct));
    if (v > 0) stops.push(`${color} ${at}% ${at + v}%`);
    at += v;
  }
  stops.push(`var(--ph-track) ${at}% 100%`);
  return h('div', { class: `ph-ring ${cls}`, style: { width: `${size}px`, height: `${size}px`, background: `conic-gradient(${stops.join(', ')})` } },
    h('span', { class: 'ph-ring-label' }, label));
}

const levelColor = (v: number) => v < 25 ? 'var(--danger)' : v < 50 ? '#e3b04b' : '#4fbf8a';

export class ValidationsScreen implements Screen {
  id = 'validations'; label = 'Accueil'; icon = ICONS.shield;
  private el: HTMLElement | null = null;
  private giftAmount = 25;
  private giftMessage = '';
  private treatMessage = '';
  /** Un glissement ou une décision est en cours : le prochain rendu est différé. */
  private busy = false;
  private dirty = false;
  constructor(private app: App) {}

  badge(): number { return this.app.family.hub?.pendingList().length ?? 0; }

  mount(el: HTMLElement): void {
    this.el = el; this.refresh();
    void this.app.refreshLink();
    void this.app.family.hub?.requestStatus();
  }
  unmount(): void { this.el = null; this.busy = false; this.dirty = false; }

  refresh(): void {
    const el = this.el; const hub = this.app.family.hub;
    if (!el || !hub) return;
    if (this.busy) { this.dirty = true; return; }
    this.dirty = false;
    const app = this.app;
    clear(el);
    const rerender = () => this.refresh();
    const root = h('div', { class: 'ph' });
    el.append(root);

    if (!hub.childIds().length) {
      root.append(this.dragonneHero());
      root.append(h('section', { class: 'card' },
        h('h2', null, 'Bienvenue'),
        h('p', null, 'Reliez maintenant le téléphone de votre enfant : onglet Famille, « Ajouter un téléphone », Enfant.'),
        h('div', { class: 'row end' }, h('button', { class: 'btn primary', onclick: () => app.show('family') }, 'Aller à Famille'))));
      return;
    }

    const pending = hub.pendingList();
    const n = pending.length;

    // ---- Salutation ----
    const hour = new Date().getHours();
    root.append(h('header', { class: 'ph-hello' },
      h('h2', null, hour >= 18 || hour < 5 ? 'Bonsoir !' : 'Bonjour !'),
      h('p', { class: 'muted' }, n
        ? `Voici ce qui vous attend : ${n} demande${n > 1 ? 's' : ''} à regarder.`
        : 'Voici ce qui vous attend. Tout est calme pour l’instant.')));
    root.append(this.dragonneHero());
    const picker = childPicker(app, rerender);
    if (picker) root.append(picker);

    // ---- À faire maintenant ----
    root.append(h('div', { class: 'section-head' }, h('h3', null, 'À faire maintenant'), n ? h('span', { class: 'count' }, String(n)) : null));
    root.append(n ? this.deck(hub, pending) : h('section', { class: 'card ph-empty' },
      h('div', { class: 'ph-empty-art' }, icon(ICONS.check, 34)),
      h('strong', null, 'Tout est à jour'),
      h('p', { class: 'small muted' }, 'Rien à valider. Les demandes de vos enfants apparaîtront ici.')));

    const id = app.selectedChild;
    const c = id ? hub.child(id) : null;
    if (!c || !id) { root.append(this.activityLink(hub)); return; }

    // ---- La journée de l'enfant ----
    root.append(this.daySummary(c));

    // ---- Actions ----
    const pet = c.snapshot?.companion?.name;
    const tile = (cls: string, path: string, title: string, hint: string, open: () => void, dot = false) =>
      h('button', { class: `ph-tile ${cls}`, onclick: open },
        h('span', { class: 'ph-tile-icon' }, icon(path, 22), dot ? h('span', { class: 'ph-dot' }) : null),
        h('span', { class: 'ph-tile-title' }, title),
        h('span', { class: 'ph-tile-hint' }, hint));
    root.append(h('div', { class: 'section-head' }, h('h3', null, 'Actions')));
    root.append(h('div', { class: 'ph-tiles' },
      tile('gift', ICONS.gift, 'Coup de cœur', 'Un bonus surprise', () => this.giftSheet(id, c.name)),
      tile('treat', ICONS.heart, 'Friandise', pet ? `Un régal pour ${pet}` : 'Pour son dragon', () => this.treatSheet(id, c.name))));

    root.append(this.activityLink(hub));
  }

  /** Raccourci vers sa propre dragonne : son état en un coup d'œil, un grand bouton pour aller la voir. */
  private dragonneHero(): HTMLElement {
    const app = this.app;
    const comp = app.family.companion;
    if (!comp) return h('span');
    comp.tick();
    const d = comp.data;
    const stage = app.state.stage;
    const src = Assets.dragonPart(stage.id, 'full', 'dragonne');
    const need = d.hunger < 30 ? 'Elle a faim' : d.clean < 30 ? 'Elle aimerait un bain' : d.mood < 30 ? 'Elle s’ennuie de toi' : comp.careXpLeft() > 0 ? `Encore ${comp.careXpLeft()} XP de soins aujourd’hui` : 'Elle a eu tous ses soins';
    const bar = (v: number, cls: string) => h('span', { class: `ph-hero-bar ${cls}` }, h('span', { style: { width: `${Math.round(v)}%` } }));
    return h('button', { class: 'ph-hero', onclick: () => app.show('dragon') },
      src ? h('img', { class: 'ph-hero-img', src, alt: '' }) : null,
      h('span', { class: 'ph-hero-txt' },
        h('span', { class: 'ph-hero-kicker' }, 'Ma dragonne'),
        h('strong', null, comp.data.name ?? 'Sans nom'),
        h('span', { class: 'small' }, `${app.stageLabel(stage.label)} · ${comp.mood().label}`),
        h('span', { class: 'ph-hero-bars' }, bar(d.hunger, 'food'), bar(d.clean, 'clean'), bar(d.mood, 'mood')),
        h('span', { class: `ph-hero-need${d.hunger < 30 || d.clean < 30 || d.mood < 30 ? ' urgent' : ''}` }, need)),
      h('span', { class: 'ph-hero-go' }, 'Aller la voir ›'));
  }

  // =====================================================================
  // Pile de cartes à glisser
  // =====================================================================
  private deck(hub: ParentHub, pending: Pending[]): HTMLElement {
    const shown = pending.slice(0, DECK_DEPTH);
    const stack = h('div', { class: 'ph-deck' });
    const cards = shown.map((r, i) => this.requestCard(r, i));
    // La première carte est ajoutée en dernier : elle passe au-dessus.
    for (let i = cards.length - 1; i >= 0; i--) stack.append(cards[i]);

    const top = shown[0]; const topCard = cards[0];
    const decide = (approved: boolean, bonus?: number) =>
      this.fly(topCard, cards.slice(1), approved, () => hub.decide(top.requestId, approved, bonus));
    this.bindSwipe(topCard, top, decide);

    const isInit = top.kind === 'initiative';
    const isReward = top.kind === 'reward';
    const noLabel = isReward || isInit ? 'Refuser' : 'À refaire';
    const buttons = isInit
      ? h('div', { class: 'ph-decide init' },
          h('button', { class: 'btn ph-no', onclick: () => decide(false) }, icon(CROSS, 18), noLabel),
          ...[10, 25, 50].map(b => h('button', { class: 'btn ph-yes', onclick: () => decide(true, b), 'aria-label': `Accorder +${b} XP et or` }, `+${b}`)))
      : h('div', { class: 'ph-decide' },
          h('button', { class: 'btn ph-no', onclick: () => decide(false) }, icon(isReward ? CROSS : REDO, 18), noLabel),
          h('button', { class: 'btn ph-yes', onclick: () => decide(true) }, icon(ICONS.check, 18), isReward ? 'Accorder' : 'Valider'));

    const more = pending.length - 1;
    return h('div', { class: 'ph-queue' }, stack, buttons,
      h('p', { class: 'ph-swipe-hint' },
        h('span', { class: 'no' }, '‹ ', noLabel.toLowerCase()),
        h('span', null, more ? `glissez · encore ${more}` : 'glissez la carte'),
        h('span', { class: 'yes' }, isInit ? '+25' : isReward ? 'accorder' : 'valider', ' ›')));
  }

  private requestCard(r: Pending, depth: number): HTMLElement {
    const isInit = r.kind === 'initiative';
    const isReward = r.kind === 'reward';
    const kind = isReward ? 'Récompense' : isInit ? 'Initiative' : 'Mission';
    const sub = isReward ? `${r.gems ?? 0} gemmes gagnées avec ses missions. Si vous refusez, elles lui sont rendues.`
      : isInit ? 'Choisissez le bonus à accorder (XP et or).'
      : rewardText(r.xp, r.gold) || 'Mission à valider';
    const card = h('article', { class: `ph-card kind-${r.kind}${r.photo ? ' has-photo' : ''}`, 'aria-hidden': depth ? 'true' : null },
      r.photo
        ? h('img', { class: 'ph-photo', src: r.photo, alt: `Photo : ${r.title}`, draggable: 'false' })
        : h('div', { class: 'ph-art' }, icon(isReward ? ICONS.gift : isInit ? ICONS.spark : ICONS.missions, 38)),
      h('div', { class: 'ph-card-body' },
        h('div', { class: 'ph-meta' },
          h('span', { class: `badge ph-kind${isReward ? ' gem-badge' : ''}` }, kind),
          h('span', { class: 'small muted' }, `${r.childName ?? ''} · ${when(r.receivedAt)}`)),
        h('div', { class: 'ph-title' }, r.title),
        r.note ? h('p', { class: 'small' }, `« ${r.note} »`) : null,
        h('p', { class: 'small muted' }, sub)),
      h('span', { class: 'ph-stamp yes' }, isReward ? 'Accorder' : isInit ? '+25' : 'Valider'),
      h('span', { class: 'ph-stamp no' }, isReward || isInit ? 'Refuser' : 'À refaire'));
    card.style.setProperty('--d', String(depth));
    return card;
  }

  /** Glissement au doigt (événements pointeur, sans bibliothèque). */
  private bindSwipe(card: HTMLElement, r: Pending, decide: (approved: boolean, bonus?: number) => void): void {
    let pid = -1; let x0 = 0; let y0 = 0; let dx = 0; let dy = 0; let w = 1; let moved = false;
    const paint = () => {
      const p = Math.max(-1, Math.min(1, dx / (w * SWIPE_THRESHOLD)));
      card.style.transform = `translate(${dx}px, ${dy * 0.25}px) rotate(${dx / 20}deg)`;
      card.classList.toggle('yes', p > 0.04);
      card.classList.toggle('no', p < -0.04);
      card.classList.toggle('armed', Math.abs(p) >= 1);
      card.style.setProperty('--a', Math.abs(p).toFixed(3));
    };
    const reset = () => {
      card.classList.remove('dragging', 'yes', 'no', 'armed');
      card.style.transform = ''; card.style.removeProperty('--a');
      pid = -1; moved = false;
      this.release();
    };
    card.addEventListener('pointerdown', e => {
      if (pid !== -1 || card.classList.contains('gone') || (e.pointerType === 'mouse' && e.button !== 0)) return;
      pid = e.pointerId; x0 = e.clientX; y0 = e.clientY; dx = dy = 0; w = card.offsetWidth || 1; moved = false;
      this.busy = true;
      card.setPointerCapture(e.pointerId);
      card.classList.add('dragging');
    });
    card.addEventListener('pointermove', e => {
      if (e.pointerId !== pid) return;
      dx = e.clientX - x0; dy = e.clientY - y0;
      if (!moved && Math.abs(dx) < 6) return;
      moved = true;
      e.preventDefault();
      paint();
    });
    const end = (e: PointerEvent, cancelled: boolean) => {
      if (e.pointerId !== pid) return;
      pid = -1;
      if (card.hasPointerCapture(e.pointerId)) card.releasePointerCapture(e.pointerId);
      if (!cancelled && Math.abs(dx) >= w * SWIPE_THRESHOLD) {
        card.classList.remove('dragging');
        decide(dx > 0, dx > 0 && r.kind === 'initiative' ? 25 : undefined);
      } else reset();
    };
    card.addEventListener('pointerup', e => end(e, false));
    card.addEventListener('pointercancel', e => end(e, true));
    card.addEventListener('lostpointercapture', e => end(e, true));
  }

  /** La carte s'envole, les suivantes avancent, puis la décision part. */
  private fly(card: HTMLElement, behind: HTMLElement[], approved: boolean, send: () => Promise<void>): void {
    if (card.classList.contains('gone')) return;
    this.busy = true;
    const dir = approved ? 1 : -1;
    const w = card.offsetWidth || 360;
    const m = /translate\(([-\d.]+)px, ([-\d.]+)px\)/.exec(card.style.transform);
    const y = m ? Number(m[2]) : 0;
    card.classList.remove('dragging', 'yes', 'no');
    card.classList.add('gone', approved ? 'yes' : 'no', 'armed');
    card.style.setProperty('--a', '1');
    card.style.transform = `translate(${dir * w * 1.4}px, ${y - 30}px) rotate(${dir * 24}deg)`;
    behind.forEach((b, i) => b.style.setProperty('--d', String(i)));
    card.closest('.ph-queue')?.querySelectorAll<HTMLButtonElement>('.ph-decide button').forEach(b => { b.disabled = true; });
    setTimeout(() => {
      send().catch(() => this.app.toast('Envoi impossible, réessayez.')).finally(() => this.release(true));
    }, 300);
  }

  private release(force = false): void {
    this.busy = false;
    if (force || this.dirty) this.refresh();
  }

  // =====================================================================
  // Journée de l'enfant
  // =====================================================================
  private daySummary(c: ChildEntry): HTMLElement {
    const snap = c.snapshot;
    const head = h('div', { class: 'ph-day-head' }, h('h3', null, `La journée de ${c.name}`), h('span', { class: 'chev', 'aria-hidden': 'true' }, '›'));
    if (!snap) {
      return h('button', { class: 'card ph-day', onclick: () => this.daySheet(c) }, head,
        h('p', { class: 'small muted' }, 'Pas encore de nouvelles de son téléphone. Elles arrivent dès qu’il est sur le Wi-Fi, appli ouverte.'));
    }
    const today = snap.missions.filter(m => snap.today[m.id]);
    const count = (s: MissionStatus) => today.filter(m => snap.today[m.id] === s).length;
    const done = count('done'); const wait = count('pending'); const total = today.length;
    const left = total - done - wait;
    const pct = (k: number) => total ? (k / total) * 100 : 0;
    const big = ring([[pct(done), '#4fbf8a'], [pct(wait), 'var(--gold)']], 76,
      h('span', null, h('strong', null, String(done)), h('small', null, `/${total}`)), 'big');

    const mini = (label: string, v: number, path: string) => h('div', { class: 'ph-mini', title: `${label} : ${v} %` },
      ring([[v, levelColor(v)]], 40, icon(path, 15)), h('span', null, label));
    const gauges = h('div', { class: 'ph-minis' });
    if (snap.energy !== undefined) gauges.append(mini('Énergie', snap.energy, ICONS.flame));
    if (snap.companion) {
      const cp = snap.companion;
      gauges.append(mini('Faim', cp.hunger, ICONS.meat), mini('Propreté', cp.clean, ICONS.drop), mini('Humeur', cp.mood, ICONS.heart));
    }

    const legend = h('div', { class: 'ph-legend' },
      h('span', { class: 'done' }, `${done} faite${done > 1 ? 's' : ''}`),
      wait ? h('span', { class: 'pending' }, `${wait} à valider`) : null,
      left > 0 ? h('span', { class: 'todo' }, `${left} à faire`) : null);
    return h('button', { class: 'card ph-day', onclick: () => this.daySheet(c), 'aria-label': `La journée de ${c.name} : voir le détail` }, head,
      h('div', { class: 'ph-day-main' },
        big,
        h('div', { class: 'ph-day-text' },
          h('strong', null, total ? (done === total ? 'Journée parfaite !' : 'Missions du jour') : 'Aucune mission aujourd’hui'),
          total ? legend : null,
          h('span', { class: 'ph-streak' }, icon(ICONS.flame, 15), `${snap.streak} jour${snap.streak > 1 ? 's' : ''} de série`),
          h('span', { class: 'ph-updated' }, icon(ICONS.clock, 13), `reçu à ${hhmm(c.updatedAt)}`))),
      gauges.childElementCount ? gauges : null);
  }

  private daySheet(c: ChildEntry): void {
    const snap = c.snapshot;
    openSheet(`La journée de ${c.name}`, () => {
      if (!snap) return [h('p', { class: 'small muted' }, 'Pas encore de nouvelles de son téléphone. Elles arrivent dès qu’il est sur le Wi-Fi, appli ouverte.')];
      const out: Node[] = [];
      const today = snap.missions.filter(m => snap.today[m.id]);
      out.push(h('h4', null, 'Missions'));
      if (!today.length) out.push(h('p', { class: 'small muted' }, 'Aucune mission aujourd’hui.'));
      const list = h('div', { class: 'ph-mission-list' });
      for (const m of today) {
        const st = snap.today[m.id];
        list.append(h('div', { class: `ph-mission ${st}` },
          h('span', { class: `check ${st}` }, st === 'done' ? icon(ICONS.check, 16) : st === 'pending' ? icon(ICONS.clock, 15) : null),
          h('span', { class: 'grow' }, m.title, m.optional ? h('span', { class: 'quest-tag bonus' }, 'Bonus') : null),
          h('span', { class: `pill ${st}` }, STATUS_LABEL[st]),
          // pas encore faite : un parent peut la rappeler (notification sur son téléphone et sa montre)
          (st === 'todo' || st === 'refused') && this.app.selectedChild ? h('button', { class: 'btn small-btn ph-remind', onclick: (e: Event) => {
            const b = e.currentTarget as HTMLButtonElement;
            b.disabled = true; b.textContent = 'Envoyé';
            void this.app.family.hub!.remind(this.app.selectedChild!, m.id, m.title);
          } }, icon(ICONS.clock, 14), ' Rappeler') : null));
      }
      out.push(list);
      out.push(h('h4', null, 'Son dragon'));
      if (snap.companion) {
        const cp = snap.companion;
        const gauge = (label: string, v: number) => h('div', { class: 'care-mini' }, h('span', { class: 'small' }, `${label} ${v} %`),
          h('div', { class: `bar care-bar ${v < 25 ? 'low' : v < 50 ? 'mid' : ''}` }, h('div', { class: 'fill', style: { width: `${v}%` } })));
        out.push(h('div', { class: 'care-parent' },
          h('div', { class: 'small' }, h('strong', null, cp.name), ` · ${cp.moodLabel} · amitié : ${cp.bond}`),
          h('div', { class: 'care-row' }, gauge('Faim', cp.hunger), gauge('Propreté', cp.clean), gauge('Humeur', cp.mood))));
      }
      out.push(h('p', { class: 'small muted' }, [
        `Niveau ${snap.level}`,
        `série : ${snap.streak} jour${snap.streak > 1 ? 's' : ''}`,
        snap.badgeTotal ? `succès : ${snap.badgeCount}/${snap.badgeTotal}` : null,
        snap.title ? `titre : ${snap.title}` : null,
        `état reçu à ${hhmm(c.updatedAt)}`
      ].filter(Boolean).join(' · ')));
      return out;
    });
  }

  // =====================================================================
  // Panneaux d'action
  // =====================================================================
  private segmented<T>(values: T[], current: T, label: (v: T) => string, pick: (v: T) => void, cls = ''): HTMLElement {
    const seg = h('div', { class: `segmented ${cls}`, role: 'radiogroup' });
    for (const v of values) {
      seg.append(h('button', { class: v === current ? 'active' : '', role: 'radio', 'aria-checked': v === current ? 'true' : 'false', onclick: (e: Event) => {
        seg.querySelectorAll('button').forEach(b => { b.classList.remove('active'); b.setAttribute('aria-checked', 'false'); });
        const t = e.currentTarget as HTMLElement; t.classList.add('active'); t.setAttribute('aria-checked', 'true');
        pick(v);
      } }, label(v)));
    }
    return seg;
  }

  private giftSheet(id: string, name: string): void {
    const hub = this.app.family.hub!;
    openSheet('Coup de cœur', close => {
      const msg = h('input', { type: 'text', maxlength: '60', placeholder: 'Bravo pour ta note de maths !', value: this.giftMessage,
        oninput: (e: Event) => { this.giftMessage = (e.target as HTMLInputElement).value; } });
      return [
        h('p', { class: 'small muted' }, `Un bonus pour une attitude, une bonne note, un service rendu… ${name} le reçoit en notification.`),
        this.segmented([10, 25, 50, 100], this.giftAmount, n => `+${n}`, n => { this.giftAmount = n; }, 'four'),
        h('label', { class: 'field-col' }, h('span', { class: 'small' }, 'Message (facultatif)'), msg),
        h('button', { class: 'btn primary ph-wide', onclick: async () => {
          await hub.gift(id, this.giftAmount, this.giftAmount, this.giftMessage.trim());
          this.giftMessage = '';
          this.app.toast('Coup de cœur envoyé');
          close();
        } }, icon(ICONS.gift, 18), 'Envoyer le coup de cœur')
      ];
    });
  }

  private treatSheet(id: string, name: string): void {
    const hub = this.app.family.hub!;
    openSheet('Friandise pour son dragon', close => {
      const msg = h('input', { type: 'text', maxlength: '60', placeholder: 'Pour fêter ta belle semaine', value: this.treatMessage,
        oninput: (e: Event) => { this.treatMessage = (e.target as HTMLInputElement).value; } });
      return [
        h('p', { class: 'small muted' }, `${name} la reçoit et la donne elle-même à son dragon : il adore ça (humeur et amitié en hausse).`),
        h('label', { class: 'field-col' }, h('span', { class: 'small' }, 'Petit mot (facultatif)'), msg),
        h('button', { class: 'btn primary ph-wide', onclick: async () => {
          await hub.treat(id, this.treatMessage.trim());
          this.treatMessage = '';
          close();
        } }, icon(ICONS.heart, 18), 'Envoyer une friandise')
      ];
    });
  }

  // =====================================================================
  // Activité
  // =====================================================================
  private activityLink(hub: ParentHub): HTMLElement {
    const last = hub.data.log[0];
    return h('button', { class: 'card ph-activity', onclick: () => this.activitySheet(hub) },
      h('span', { class: 'ph-tile-icon' }, icon(ICONS.clock, 20)),
      h('span', { class: 'grow ph-activity-text' },
        h('strong', null, 'Voir l’activité'),
        h('span', { class: 'small muted' }, last ? last.text : 'Rien pour le moment')),
      h('span', { class: 'chev', 'aria-hidden': 'true' }, '›'));
  }

  private activitySheet(hub: ParentHub): void {
    openSheet('Activité', () => {
      const log = hub.data.log;
      if (!log.length) return [h('p', { class: 'small muted' }, 'Rien pour le moment.')];
      const out: Node[] = []; let day = '';
      for (const e of log.slice(0, 40)) {
        const d = new Date(e.at).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
        if (d !== day) { day = d; out.push(h('h4', { class: 'ph-log-day' }, d)); }
        out.push(h('div', { class: 'log-row' }, h('span', { class: 'muted small' }, hhmm(e.at)), h('span', null, e.text)));
      }
      return out;
    });
  }
}

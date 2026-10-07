// Onglet « Quêtes » de l'enfant : le tableau des quêtes du jour, illustré.
// Ordre : à faire (par heure) → à refaire → en attente des parents → faites (repliées).
import { DAY_LABELS, type Mission, type MissionStatus } from '../../family/model.js';
import type { App, Screen } from '../App.js';
import { ICONS, clear, h, icon } from '../dom.js';
import { openSheet } from './common.js';

type Entry = { mission: Mission; status: MissionStatus };

const STAMP_MS = 950;

export class MissionsScreen implements Screen {
  id = 'missions'; label = 'Quêtes'; icon = ICONS.missions;
  private el: HTMLElement | null = null;
  private initiative = '';
  /** Missions en cours d'animation « Bravo ! » (évite les doubles appuis). */
  private stamping = new Set<string>();
  private showDone = false;
  constructor(private app: App) {}

  /** Prend une photo (appareil photo du téléphone), la réduit et l'envoie avec la mission. */
  private async withPhoto(id: string, card: HTMLElement): Promise<void> {
    const input = h('input', { type: 'file', accept: 'image/*', capture: 'environment', style: { display: 'none' } }) as HTMLInputElement;
    document.body.append(input);
    const file = await new Promise<File | null>(res => { input.onchange = () => res(input.files?.[0] ?? null); input.click(); setTimeout(() => res(null), 120000); });
    input.remove();
    if (!file) return;
    const photo = await shrink(file);
    if (!await this.celebrate(id, card, 'Envoyé !')) return;
    await this.app.family.book!.complete(id, photo ?? undefined);
  }

  /** Coche la mission après une petite animation de tampon « Bravo ! ». */
  private async finish(id: string, card: HTMLElement): Promise<void> {
    const m = this.app.family.book?.data.missions.find(x => x.id === id);
    if (!await this.celebrate(id, card, m?.validation === 'parent' ? 'Envoyé !' : 'Bravo !')) return;
    await this.app.family.book!.complete(id);
  }

  /** Tampon + étincelles sur la carte ; résout `false` si une animation était déjà en cours. */
  private celebrate(id: string, card: HTMLElement, text: string): Promise<boolean> {
    if (this.stamping.has(id)) return Promise.resolve(false);
    this.stamping.add(id);
    try { navigator.vibrate?.(30); } catch { /* pas de vibreur */ }
    const sparks = h('div', { class: 'q-sparks', 'aria-hidden': 'true' },
      ...Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2 + (i % 2 ? .25 : 0);
        const r = 64 + (i % 3) * 26;
        return h('i', { style: `--dx:${Math.round(Math.cos(a) * r)}px;--dy:${Math.round(Math.sin(a) * r * .5)}px;--d:${(i % 4) * 45}ms;--s:${.7 + (i % 3) * .25}` });
      }));
    card.append(h('div', { class: 'q-stamp', role: 'status' }, h('span', null, text)), sparks);
    card.classList.add('q-stamped');
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    return new Promise(res => setTimeout(() => { this.stamping.delete(id); res(true); }, reduce ? 350 : STAMP_MS));
  }

  badge(): number {
    return this.app.family.book?.today().filter(t => t.status === 'todo' || t.status === 'refused').length ?? 0;
  }

  mount(el: HTMLElement): void { this.el = el; this.refresh(); }
  unmount(): void { this.el?.classList.remove('q-screen'); this.el = null; }

  refresh(): void {
    const el = this.el; const book = this.app.family.book;
    if (!el || !book) return;
    if (this.stamping.size) return; // l'animation se termine, l'état suivra
    const scroll = el.scrollTop;
    clear(el);
    el.classList.add('q-screen');
    const today = book.today();
    const dbl = book.doubleId();

    // ---------- En-tête « Aujourd'hui » ----------
    el.append(this.header(today));

    // ---------- Quêtes du jour ----------
    if (!today.length) {
      el.append(h('section', { class: 'q-empty' },
        art(EMPTY_ART, 'q-empty-art'),
        h('h3', null, 'Pas de quête aujourd’hui !'),
        h('p', null, 'Ton dragon fait la sieste, profites-en toi aussi. Envie de briller ? Les quêtes bonus sont juste en dessous.')));
    } else {
      const rank = (s: MissionStatus) => s === 'todo' ? 0 : s === 'refused' ? 1 : s === 'pending' ? 2 : 3;
      const sorted = [...today].sort((a, b) => rank(a.status) - rank(b.status) || (a.mission.time ?? '99').localeCompare(b.mission.time ?? '99'));
      const open = sorted.filter(t => t.status !== 'done');
      const done = sorted.filter(t => t.status === 'done');
      if (open.length) el.append(h('div', { class: 'q-list' }, ...open.map(t => this.card(t, dbl === t.mission.id))));
      else el.append(h('div', { class: 'q-alldone' }, icon(ICONS.star, 22), h('span', null, 'Toutes tes quêtes sont faites. Journée parfaite !')));
      if (done.length) el.append(this.doneGroup(done, dbl));
    }

    // ---------- Quêtes bonus + initiative ----------
    el.append(this.bonusSection(dbl));

    // ---------- Semaine et nouvelles ----------
    const week = book.data.missions.filter(m => !m.once && !m.optional);
    if (week.length) {
      const now = new Date().getDay();
      el.append(h('section', { class: 'card q-week' },
        h('h3', null, 'Ma semaine'),
        ...week.map(m => h('div', { class: 'week-row' },
          art(illustration(m.title), 'q-ill-xs'),
          h('span', { class: 'grow' }, m.title),
          h('span', { class: 'days' }, ...DAY_LABELS.map((d, i) => h('span', { class: (m.days.includes(i) ? 'on' : '') + (i === now ? ' today' : ''), title: d }, d[0])))))));
    }
    if (book.data.history.length) {
      el.append(h('details', { class: 'card q-news' },
        h('summary', null, h('h3', { class: 'grow' }, 'Dernières nouvelles'), h('span', { class: 'q-count' }, `${Math.min(8, book.data.history.length)}`)),
        ...book.data.history.slice(0, 8).map(e => h('div', { class: 'log-row' },
          h('span', { class: 'muted small' }, new Date(e.at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })),
          h('span', null, e.text)))));
    }
    el.scrollTop = scroll;
  }

  // ---------- Morceaux ----------
  private header(today: Entry[]): HTMLElement {
    const book = this.app.family.book!;
    const total = today.length;
    const done = today.filter(t => t.status === 'done').length;
    const waiting = today.filter(t => t.status === 'pending').length;
    const pct = total ? Math.round(done / total * 100) : 0;
    const wpct = total ? Math.round((done + waiting) / total * 100) : 0;
    const date = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    const streak = book.streak();
    const shields = book.data.shields;
    const count = book.pendingCount();

    return h('section', { class: `q-today${total && done === total ? ' q-perfect' : ''}` },
      total
        ? h('div', { class: 'q-ring', style: `--p:${pct};--w:${wpct}`, role: 'img', 'aria-label': `${done} quête${done > 1 ? 's' : ''} faite${done > 1 ? 's' : ''} sur ${total}` },
          h('div', { class: 'q-ring-in' }, h('strong', null, `${done}`, h('small', null, ` / ${total}`)), h('span', null, total > 1 ? 'quêtes' : 'quête')))
        : h('div', { class: 'q-ring q-ring-rest' }, h('div', { class: 'q-ring-in' }, icon(ICONS.moon, 28), h('span', null, 'repos'))),
      h('div', { class: 'q-today-txt' },
        h('span', { class: 'q-date' }, date),
        h('h2', null, 'Aujourd’hui'),
        h('div', { class: `q-streak${streak ? '' : ' off'}` }, icon(ICONS.flame, 18),
          h('span', null, streak ? `Série : ${streak} jour${streak > 1 ? 's' : ''}` : 'Lance ta série !'),
          shields ? h('span', { class: 'q-shield', title: `${shields} bouclier${shields > 1 ? 's' : ''} de série` }, icon(ICONS.shield, 14), `${shields}`) : null),
        !shields && streak ? h('span', { class: 'q-hint' }, 'Un bouclier tous les 7 jours') : null,
        waiting ? h('span', { class: 'q-hint amber' }, `${waiting} en attente des parents`) : null),
      count ? h('div', { class: 'q-cost' }, icon(ICONS.star, 14),
        h('span', null, `${count} quête${count > 1 ? 's' : ''} encore à faire : chaque réussite fait progresser ton dragon.`)) : null);
  }

  private card(t: Entry, x2: boolean, bonus = false): HTMLElement {
    const { mission: m, status } = t;
    const mult = x2 ? 2 : 1;
    const parent = m.validation === 'parent';
    const actionable = status === 'todo' || status === 'refused';
    const card = h('article', { class: `q-card q-${status}${x2 ? ' q-x2' : ''}${bonus ? ' q-opt' : ''}`, 'data-id': m.id });
    const chips = h('div', { class: 'q-chips' },
      m.xp ? h('span', { class: 'q-chip xp' }, icon(ICONS.star, 13), `+${m.xp * mult} XP`) : null,
      m.gold ? h('span', { class: 'q-chip or' }, icon(ICONS.coin, 13), `+${m.gold * mult} or`) : null,
      h('span', { class: 'q-chip gem', title: m.optional ? '2 gemmes' : '1 gemme' }, gemIcon(), `+${m.optional ? 2 : 1}`),
      x2 ? h('span', { class: 'q-chip x2', title: 'Récompense doublée aujourd’hui' }, '×2') : null);

    card.append(
      art(illustration(m.title), 'q-ill'),
      h('div', { class: 'q-head' },
        h('h4', { class: 'q-title' }, m.title),
        h('div', { class: 'q-sub' },
          m.time ? h('span', { class: 'q-time' }, icon(ICONS.clock, 13), `avant ${m.time.replace(':', ' h ')}`) : null,
          m.once ? h('span', { class: 'q-tag' }, 'Quête spéciale') : null,
          parent && actionable ? h('span', { class: 'q-who' }, icon(ICONS.shield, 13), 'un parent valide') : null)),
      h('div', { class: 'q-rew' }, chips, m.note ? h('p', { class: 'q-note' }, m.note) : null));

    if (status === 'refused') card.append(h('div', { class: 'q-banner red' }, icon(ICONS.edit, 15), h('span', null, h('b', null, 'À refaire'), ' · tes parents te demandent de la reprendre')));
    if (status === 'pending') card.append(h('div', { class: 'q-banner amber' }, icon(ICONS.clock, 15), h('span', null, h('b', null, 'En attente des parents'), ' · ils vont bientôt valider')));

    if (actionable) {
      const act = h('div', { class: 'q-act' });
      act.append(h('button', { class: 'btn primary q-go', onclick: () => void this.finish(m.id, card) }, icon(ICONS.check, 20), status === 'refused' ? 'Refait !' : 'Fait !'));
      if (parent) act.append(h('button', { class: 'btn q-photo', title: 'Envoyer une photo comme preuve', onclick: () => void this.withPhoto(m.id, card) }, cameraIcon(), h('span', null, 'Avec photo')));
      card.append(act);
    }
    return card;
  }

  private doneGroup(done: Entry[], dbl: string | null): HTMLElement {
    return h('details', { class: 'q-done', open: this.showDone,
      ontoggle: (e: Event) => { this.showDone = (e.target as HTMLDetailsElement).open; } },
      h('summary', null, h('span', { class: 'q-done-ic' }, icon(ICONS.check, 16)), h('span', { class: 'grow' }, 'Faites'), h('span', { class: 'q-count' }, `${done.length}`)),
      ...done.map(t => mini(t.mission, dbl === t.mission.id)));
  }

  private bonusSection(dbl: string | null): HTMLElement {
    const book = this.app.family.book!;
    const bonus = book.bonusToday();
    const open = bonus.filter(b => b.status !== 'done');
    const done = bonus.filter(b => b.status === 'done');
    const ideas = book.pendingRequests().filter(r => r.kind === 'initiative');
    return h('section', { class: 'q-bonus' },
      h('div', { class: 'q-bonus-head' }, icon(ICONS.gift, 22), h('h3', null, 'Quêtes bonus')),
      h('p', { class: 'small muted' }, bonus.length ? 'Facultatives : tu choisis celles que tu veux. Elles rapportent plus, et 2 gemmes chacune.' : 'Tu as fait quelque chose sans qu’on te le demande ? Dis-le à tes parents !'),
      open.length ? h('div', { class: 'q-list' }, ...open.map(b => this.card(b, dbl === b.mission.id, true))) : null,
      done.length ? h('div', { class: 'q-bonus-done' }, ...done.map(b => mini(b.mission, false))) : null,
      h('button', { class: 'q-initiative', onclick: () => this.openInitiative() },
        h('span', { class: 'q-ini-ic' }, icon(ICONS.hand, 24)),
        h('span', { class: 'grow' }, h('b', null, 'J’ai fait autre chose'), h('small', null, 'Une initiative ? Tes parents peuvent t’accorder un bonus.')),
        icon(ICONS.plus, 20)),
      ideas.length ? h('div', { class: 'q-ideas' }, ...ideas.map(r => h('div', { class: 'q-idea' }, icon(ICONS.clock, 14), h('span', { class: 'grow' }, r.title), h('span', { class: 'q-hint amber' }, 'En attente')))) : null);
  }

  private openInitiative(): void {
    const book = this.app.family.book;
    if (!book) return;
    openSheet('J’ai fait autre chose', close => {
      const input = h('input', { type: 'text', maxlength: '80', placeholder: 'Ex. : j’ai vidé le lave-vaisselle', value: this.initiative,
        oninput: (e: Event) => { this.initiative = (e.target as HTMLInputElement).value; } }) as HTMLInputElement;
      setTimeout(() => input.focus(), 250);
      const send = async () => {
        if (this.initiative.trim().length < 3) { this.app.toast('Décris ce que tu as fait.'); return; }
        await book.declareInitiative(this.initiative);
        this.initiative = '';
        close();
        this.refresh();
      };
      input.addEventListener('keydown', e => { if (e.key === 'Enter') void send(); });
      return [
        h('p', { class: 'small muted' }, 'Tu as fait quelque chose sans qu’on te le demande ? Dis-le à tes parents, ils peuvent t’accorder un bonus.'),
        h('label', { class: 'field-col' }, h('span', { class: 'small' }, 'Ce que tu as fait'), input),
        h('div', { class: 'row end' }, h('button', { class: 'btn primary', onclick: () => void send() }, 'Envoyer'))
      ];
    });
  }
}

function mini(m: Mission, x2: boolean): HTMLElement {
  return h('div', { class: 'q-mini' },
    art(illustration(m.title), 'q-ill-xs'),
    h('span', { class: 'grow' }, m.title, x2 ? h('span', { class: 'q-chip x2 tiny' }, '×2') : null),
    h('span', { class: 'q-ok' }, icon(ICONS.check, 14), 'Validée'));
}

// ---------- Illustrations (SVG en ligne, dessinées à la main) ----------
const O = 'stroke="#22180d" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"';
const SVG_OPEN = '<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">';

const ILL: Record<string, string> = {
  cat: `<path d="M12 22 10 8l9 6q5-2 10 0l9-6-2 14q2 13-12 14-14-1-12-14z" fill="#f0a64a" ${O}/>
    <path d="M13 11l4 3M35 11l-4 3" stroke="#c97a2a" stroke-width="2" stroke-linecap="round"/>
    <path d="M18 18q2-2 3 0M27 18q2-2 3 0" fill="none" stroke="#c97a2a" stroke-width="2" stroke-linecap="round"/>
    <ellipse cx="19" cy="24" rx="2.2" ry="3" fill="#22180d"/><ellipse cx="29" cy="24" rx="2.2" ry="3" fill="#22180d"/>
    <circle cx="19.7" cy="23" r=".8" fill="#fff"/><circle cx="29.7" cy="23" r=".8" fill="#fff"/>
    <path d="M22.5 28h3l-1.5 2z" fill="#e2687a" ${O} stroke-width="1.2"/>
    <path d="M24 30q-1 3-4 2M24 30q1 3 4 2" fill="none" stroke="#22180d" stroke-width="1.5" stroke-linecap="round"/>
    <path d="M6 27l8 1M6 31l8-1M42 27l-8 1M42 31l-8-1" stroke="#fff3df" stroke-width="1.3" stroke-linecap="round"/>`,
  books: `<rect x="8" y="31" width="30" height="8" rx="1.5" fill="#5b8fd6" ${O}/>
    <rect x="11" y="23" width="27" height="8" rx="1.5" fill="#e0675a" ${O}/>
    <rect x="9" y="15" width="25" height="8" rx="1.5" fill="#7cc48a" ${O}/>
    <path d="M12 35h20M15 27h17M13 19h15" stroke="#fff3df" stroke-width="1.6" stroke-linecap="round" opacity=".8"/>
    <path d="M30 13 39 4l4 4-9 9-5 1z" fill="#f2d48a" ${O}/><path d="M39 4l4 4" stroke="#e2687a" stroke-width="3"/>
    <path d="M29 18l1-4 3 3z" fill="#22180d"/>`,
  room: `<path d="M7 22h34l-3 18H10z" fill="#c98b4a" ${O}/>
    <path d="M7 22l4-6h26l4 6" fill="#a96f35" ${O}/>
    <circle cx="17" cy="15" r="6" fill="#e0675a" ${O}/><path d="M11.5 13q5.5 3 11 0" fill="none" stroke="#fff3df" stroke-width="1.5"/>
    <rect x="26" y="7" width="9" height="9" rx="1.5" fill="#5b8fd6" ${O} transform="rotate(12 30 12)"/>
    <path d="M17 31h14" stroke="#22180d" stroke-width="2" stroke-linecap="round"/>
    <path d="M41 6l1.2 2.6 2.8.4-2 2 .5 2.8-2.5-1.3-2.5 1.3.5-2.8-2-2 2.8-.4z" fill="#f2d48a"/>`,
  bag: `<path d="M18 11q0-5 6-5t6 5" fill="none" ${O} stroke-width="3"/>
    <rect x="10" y="10" width="28" height="31" rx="8" fill="#e0675a" ${O}/>
    <rect x="15" y="26" width="18" height="11" rx="3" fill="#c24f45" ${O}/>
    <path d="M15 30h18" stroke="#22180d" stroke-width="1.6"/>
    <path d="M10 19h28" stroke="#22180d" stroke-width="1.6"/>
    <circle cx="24" cy="19" r="2" fill="#f2d48a" ${O} stroke-width="1.2"/>
    <path d="M15 14q2-2 4 0" stroke="#fff3df" stroke-width="1.6" fill="none" stroke-linecap="round" opacity=".7"/>`,
  kitchen: `<circle cx="24" cy="25" r="14" fill="#fff3df" ${O}/><circle cx="24" cy="25" r="9" fill="#e9dcc4" stroke="#c9b48e" stroke-width="1.5"/>
    <path d="M20 21q3-3 6 0" stroke="#fff" stroke-width="1.6" fill="none" stroke-linecap="round"/>
    <path d="M5 8v9q0 3 2 3v19M9 8v9q0 3-2 3M7 8v8" fill="none" stroke="#d9d3c6" stroke-width="2.2" stroke-linecap="round"/>
    <path d="M42 8q-4 4-3 13h3v18" fill="#d9d3c6" stroke="#d9d3c6" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>`,
  bed: `<path d="M5 18v22M43 26v14" ${O} stroke-width="3"/>
    <rect x="5" y="28" width="38" height="8" rx="2" fill="#a96f35" ${O}/>
    <rect x="8" y="20" width="12" height="8" rx="4" fill="#fff3df" ${O}/>
    <path d="M18 28q0-6 6-6h17q2 0 2 3v3z" fill="#7a8fe0" ${O}/>
    <path d="M26 25h12" stroke="#fff3df" stroke-width="1.5" stroke-linecap="round" opacity=".7"/>
    <text x="30" y="16" font-family="Georgia,serif" font-weight="700" font-size="9" fill="#f2d48a">z</text>
    <text x="36" y="11" font-family="Georgia,serif" font-weight="700" font-size="7" fill="#f2d48a">z</text>`,
  shower: `<path d="M8 40V12q0-6 6-6h6q5 0 5 5v2" fill="none" stroke="#d9d3c6" stroke-width="3" stroke-linecap="round"/>
    <path d="M16 16q9-6 18 0z" fill="#d9d3c6" ${O}/>
    <path d="M20 22l-2 5M25 22v6M30 22l2 5M22 30l-1 4M28 30l1 4" stroke="#7fd4ff" stroke-width="2.4" stroke-linecap="round"/>
    <path d="M30 36q0-3 3-3h3q2-3 4-1t-1 4h1q1 4-4 4h-3q-3 0-3-4z" fill="#f2d048" ${O} stroke-width="1.5"/>
    <circle cx="38" cy="33.5" r=".8" fill="#22180d"/>`,
  read: `<path d="M24 14q-8-5-18-3v26q10-2 18 3 8-5 18-3V11q-10-2-18 3z" fill="#fff3df" ${O}/>
    <path d="M24 14v26" stroke="#22180d" stroke-width="2"/>
    <path d="M10 18q5-1 10 1M10 23q5-1 10 1M10 28q5-1 10 1M28 19q5-2 10-1M28 24q5-2 10-1M28 29q5-2 10-1" stroke="#b3a68c" stroke-width="1.6" fill="none" stroke-linecap="round"/>
    <path d="M33 8v10l2.5-2 2.5 2V8" fill="#e0675a" ${O} stroke-width="1.5"/>`,
  trash: `<path d="M11 15h26l-3 25H14z" fill="#5bb08a" ${O}/>
    <rect x="8" y="10" width="32" height="6" rx="2" fill="#4a9474" ${O}/>
    <path d="M20 10q0-4 4-4t4 4" fill="none" ${O}/>
    <path d="M20 23l4-4 4 4M24 19v8M18 33h12" stroke="#fff3df" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
  sport: `<circle cx="26" cy="24" r="14" fill="#fff3df" ${O}/>
    <path d="M26 17l6 4-2 7h-8l-2-7z" fill="#22180d"/>
    <path d="M26 17v-7M32 21l7-2M30 28l4 6M22 28l-4 6M20 21l-7-2" stroke="#22180d" stroke-width="1.6"/>
    <path d="M3 18h6M2 24h5M3 30h6" stroke="#f2d48a" stroke-width="2.2" stroke-linecap="round"/>`,
  car: `<path d="M5 31v-5q0-3 3-4l5-7q1-2 4-2h14q3 0 4 2l5 7q3 1 3 4v5z" fill="#5b8fd6" ${O}/>
    <path d="M16 16h7v6H12zM26 16h7l3 6H26z" fill="#bfe9ff" ${O} stroke-width="1.5"/>
    <circle cx="14" cy="33" r="5" fill="#2d2730" ${O}/><circle cx="34" cy="33" r="5" fill="#2d2730" ${O}/>
    <circle cx="14" cy="33" r="1.8" fill="#d9d3c6"/><circle cx="34" cy="33" r="1.8" fill="#d9d3c6"/>
    <path d="M10 5q-2 3 0 5 2-2 0-5zM40 4q-2 3 0 5 2-2 0-5zM25 3q-2 3 0 5 2-2 0-5z" fill="#7fd4ff"/>`,
  plant: `<path d="M14 30h20l-3 12H17z" fill="#c98b4a" ${O}/>
    <path d="M24 30V18" stroke="#3f8a55" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M24 22q-10 0-11-9 10 0 11 9zM24 19q9-1 11-10-10 0-11 10z" fill="#7cc48a" ${O}/>
    <path d="M40 22l1 3M37 26l1 3M43 27l1 3" stroke="#7fd4ff" stroke-width="2" stroke-linecap="round"/>`,
  star: `<path d="M24 5l5.6 11.6 12.8 1.8-9.3 8.9 2.3 12.6L24 33.9 12.6 39.9l2.3-12.6-9.3-8.9 12.8-1.8z" fill="#f2c85a" ${O}/>
    <path d="M24 12l3 6.4 5 .8" stroke="#fff3df" stroke-width="1.8" fill="none" stroke-linecap="round" opacity=".8"/>
    <path d="M40 5v5M37.5 7.5h5M8 36v4M6 38h4" stroke="#f2d48a" stroke-width="1.8" stroke-linecap="round"/>`
};

/** Choisit l'illustration d'une mission d'après les mots de son titre (comme missionLine). */
function illustration(title: string): string {
  const t = title.toLowerCase();
  const k =
    /liti[eè]re|chat|chien|animal|animaux|hamster|lapin|poisson|promener/.test(t) ? 'cat'
    : /devoir|le[cç]on|r[ée]vis|exercice|cahier/.test(t) ? 'books'
    : /\blire\b|lecture|livre|\blis\b/.test(t) ? 'read'
    : /\blit\b|draps|couette/.test(t) ? 'bed'
    : /douche|bain|dents|laver les mains|toilette/.test(t) ? 'shower'
    : /poubelle|d[ée]chet|ordure|\btri\b|recycl/.test(t) ? 'trash'
    : /\bsac\b|cartable/.test(t) ? 'bag'
    : /vaisselle|table|cuisine|repas|couvert|manger|cuisin/.test(t) ? 'kitchen'
    : /sport|courir|v[ée]lo|danse|entra[iî]n|foot|natation|piscine|gym/.test(t) ? 'sport'
    : /voiture/.test(t) ? 'car'
    : /plante|arros|jardin|fleur/.test(t) ? 'plant'
    : /chambre|ranger|rangement|salon|aspirateur|m[ée]nage/.test(t) ? 'room'
    : 'star';
  return `${SVG_OPEN}${ILL[k]}</svg>`;
}

const EMPTY_ART = `<svg viewBox="0 0 160 110" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <path d="M112 14a22 22 0 1 0 22 30 18 18 0 0 1-22-30z" fill="#f2d48a"/>
  <path d="M30 20l1.5 3.5 3.5 1.5-3.5 1.5L30 30l-1.5-3.5L25 25l3.5-1.5zM142 70l1 2.5 2.5 1-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1zM60 10l1 2.5 2.5 1-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1z" fill="#f2d48a" opacity=".8"/>
  <path d="M28 96q-2-16 16-18 6-14 24-12 12-10 26 0 18-2 20 14 12 2 10 16z" fill="#2c2733" stroke="#4a4152" stroke-width="2" stroke-linejoin="round"/>
  <path d="M54 86q8-10 22-8 12-10 24 0 10 2 10 10H54z" fill="#d9a84a" stroke="#22180d" stroke-width="2" stroke-linejoin="round"/>
  <path d="M100 80q12-8 20 0" fill="none" stroke="#22180d" stroke-width="2" stroke-linecap="round"/>
  <path d="M60 82l-6-9 10 4M72 76l-2-9 8 6" fill="#b8862e" stroke="#22180d" stroke-width="1.6" stroke-linejoin="round"/>
  <path d="M84 80q3 2 6 0M95 80q3 2 6 0" fill="none" stroke="#22180d" stroke-width="2" stroke-linecap="round"/>
  <text x="106" y="66" font-family="Georgia,serif" font-weight="700" font-size="13" fill="#f2d48a">z</text>
  <text x="116" y="56" font-family="Georgia,serif" font-weight="700" font-size="10" fill="#f2d48a" opacity=".8">z</text>
  <text x="124" y="48" font-family="Georgia,serif" font-weight="700" font-size="8" fill="#f2d48a" opacity=".6">z</text>
</svg>`;

function art(svg: string, cls: string): HTMLElement {
  const box = h('div', { class: cls, 'aria-hidden': 'true' });
  box.innerHTML = svg; // contenu statique dessiné ci-dessus
  return box;
}

function gemIcon(): SVGSVGElement {
  return icon('M7 4h10l4 5-9 11L3 9z M3 9h18 M9 4l3 16 3-16', 13);
}
function cameraIcon(): SVGSVGElement {
  return icon('M4 8h3l2-3h6l2 3h3v11H4z M12 10a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z', 18);
}

/** Réduit une photo (≈ 640 px, JPEG) pour l'envoyer par le Wi-Fi de la maison. */
async function shrink(file: File): Promise<string | null> {
  try {
    const url = URL.createObjectURL(file);
    const img = new Image();
    await new Promise((ok, ko) => { img.onload = ok; img.onerror = ko; img.src = url; });
    const k = Math.min(1, 640 / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    URL.revokeObjectURL(url);
    return c.toDataURL('image/jpeg', 0.62);
  } catch { return null; }
}

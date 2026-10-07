import { DAY_LABELS, newId, type ChildSnapshot, type Mission, type MissionStatus, type Reward, type Validation } from '../../family/model.js';
import type { App, Screen } from '../App.js';
import { ICONS, clear, h, icon } from '../dom.js';
import { childPicker } from './ValidationsScreen.js';

type Draft = Mission;
type View = 'list' | 'week';

const blank = (once = false): Draft => ({
  id: newId('m_'), title: '', xp: 12, gold: 6, validation: 'parent', days: once ? [] : [1, 2, 3, 4, 5], time: once ? null : '18:00', once
});

/** Ordre d'affichage des jours : du lundi au dimanche (0 = dimanche dans le modèle). */
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
const DAY_INITIALS = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
const ALL = [0, 1, 2, 3, 4, 5, 6];
const SCHOOL = [1, 2, 4, 5];
const WEEKDAYS = [1, 2, 3, 4, 5];

/** Modèles de missions courantes, préremplis avec des réglages raisonnables. */
const TEMPLATES: Array<Omit<Mission, 'id'>> = [
  { title: 'Nourrir le chat', days: ALL, time: '19:30', xp: 10, gold: 5, validation: 'trust' },
  { title: 'Changer la litière', days: [0, 3], time: '18:00', xp: 15, gold: 8, validation: 'parent' },
  { title: 'Faire ses devoirs', days: SCHOOL, time: '18:30', xp: 20, gold: 10, validation: 'parent' },
  { title: 'Ranger sa chambre', days: [3, 6], time: '17:00', xp: 25, gold: 12, validation: 'parent' },
  { title: 'Préparer son sac', days: [0, 1, 2, 3, 4], time: '20:30', xp: 5, gold: 3, validation: 'trust' },
  { title: 'Mettre la table', days: ALL, time: '19:15', xp: 10, gold: 5, validation: 'trust' },
  { title: 'Vider le lave-vaisselle', days: [1, 3, 5, 6], time: '18:00', xp: 10, gold: 6, validation: 'trust' },
  { title: 'Faire son lit', days: WEEKDAYS, time: '07:45', xp: 5, gold: 3, validation: 'trust' },
  { title: 'Douche', days: ALL, time: '20:00', xp: 5, gold: 3, validation: 'trust' },
  { title: 'Lire 20 minutes', days: ALL, time: '20:45', xp: 15, gold: 8, validation: 'trust' },
  { title: 'Sortir les poubelles', days: [1, 4], time: '19:00', xp: 10, gold: 6, validation: 'parent' },
  { title: 'Aider en cuisine', days: [0, 6], time: '11:30', xp: 20, gold: 10, validation: 'parent' }
];

const STATUS_LABEL: Partial<Record<MissionStatus, string>> = { done: 'Faite', pending: 'À valider', refused: 'À refaire' };

const pct = (n: number, total: number) => (total ? Math.round((n / total) * 100) : 0);
const parseKey = (k: string) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1); };
const byTime = (a: Mission, b: Mission) => (a.time ?? '99').localeCompare(b.time ?? '99') || a.title.localeCompare(b.title, 'fr');

export class ParentMissionsScreen implements Screen {
  id = 'parent-missions'; label = 'Missions'; icon = ICONS.missions;
  private el: HTMLElement | null = null;
  private draft: Draft | null = null;
  private editing = false;
  private fromTemplate = false;
  private view: View = 'list';
  private rewardDraft: Reward | null = null;
  constructor(private app: App) {}

  mount(el: HTMLElement): void { this.el = el; this.refresh(); }
  unmount(): void { this.el = null; this.draft = null; }

  /** Ouvre le formulaire (création, modèle ou modification) en haut de l'écran. */
  private open(d: Draft, editing = false, fromTemplate = false): void {
    this.draft = d; this.editing = editing; this.fromTemplate = fromTemplate;
    this.refresh();
    if (this.el) this.el.scrollTop = 0;
  }

  private edit(m: Mission): void { this.open(JSON.parse(JSON.stringify(m)) as Mission, true); }

  refresh(): void {
    const el = this.el; const hub = this.app.family.hub;
    if (!el || !hub) return;
    clear(el);
    const rerender = () => this.refresh();
    const picker = childPicker(this.app, rerender);
    if (picker) el.append(picker);

    const id = this.app.selectedChild;
    const c = id ? hub.child(id) : null;
    if (!c) { el.append(h('p', { class: 'muted' }, 'Reliez d’abord le téléphone de votre enfant (onglet Famille).')); return; }
    if (!c.snapshot) {
      el.append(h('section', { class: 'card' },
        h('p', null, `La liste des missions arrivera du téléphone de ${c.name} dès qu’il sera sur le Wi-Fi avec l’appli ouverte.`),
        h('div', { class: 'row end' }, h('button', { class: 'btn', onclick: () => void hub.requestStatus() }, 'Demander une mise à jour'))));
      return;
    }

    if (this.draft) { el.append(this.form(id!, this.draft)); return; }
    const snap = c.snapshot;

    el.append(h('div', { class: 'section-head' }, h('h2', null, `Missions de ${c.name}`)));
    const week = this.weekCard(snap);
    if (week) el.append(week);

    el.append(
      h('div', { class: 'row pm-add' },
        h('button', { class: 'btn primary', onclick: () => this.open(blank()) }, icon(ICONS.plus, 16), ' Mission'),
        h('button', { class: 'btn', onclick: () => this.open({ ...blank(true), xp: 35, gold: 18 }) }, icon(ICONS.spark, 16), ' Quête spéciale'),
        h('button', { class: 'btn', onclick: () => this.open({ ...blank(), xp: 24, gold: 12, time: null, days: [...ALL], optional: true }) }, icon(ICONS.star, 16), ' Quête bonus')),
      this.templates(snap.missions));

    el.append(h('div', { class: 'segmented two', role: 'tablist' },
      ...([['list', 'Liste'], ['week', 'Semaine']] as Array<[View, string]>).map(([v, lbl]) => h('button', {
        class: this.view === v ? 'active' : '', role: 'tab', 'aria-selected': this.view === v ? 'true' : 'false',
        onclick: () => { this.view = v; rerender(); }
      }, lbl))));

    if (!snap.missions.length) el.append(h('div', { class: 'empty' }, icon(ICONS.missions, 34), h('p', null, 'Aucune mission pour l’instant : choisissez un modèle ci-dessus.')));
    else el.append(this.view === 'list' ? this.list(id!, snap) : this.calendar(snap));

    el.append(
      h('p', { class: 'small muted' }, 'Les quêtes bonus sont facultatives : elles rapportent davantage et 2 gemmes. Les missions oubliées ne retirent jamais de progression.'),
      h('p', { class: 'small muted' }, 'Les modifications partent vers le téléphone de l’enfant par le Wi-Fi de la maison (ou dès son retour).'));
    el.append(this.rewardsCard(id!, snap.rewards ?? []));
  }

  // ---------- Bilan de la semaine ----------
  private weekCard(snap: ChildSnapshot): HTMLElement | null {
    const days = snap.week;
    if (!days?.length) return null;
    const done = days.reduce((a, d) => a + Math.min(d.done, d.total), 0);
    const total = days.reduce((a, d) => a + d.total, 0);
    const today = snap.date || days[days.length - 1].date;
    const bars = h('div', { class: 'pm-bars', role: 'img', 'aria-label': days.map(d => `${parseKey(d.date).toLocaleDateString('fr-FR', { weekday: 'long' })} : ${d.done} sur ${d.total}`).join(', ') });
    for (const d of days) {
      const p = pct(Math.min(d.done, d.total), d.total);
      const cls = !d.total ? 'off' : p >= 100 ? 'full' : p >= 50 ? 'mid' : p > 0 ? 'low' : 'none';
      bars.append(h('div', { class: `pm-bar ${cls}${d.date === today ? ' today' : ''}` },
        h('span', { class: 'pm-bar-val' }, d.total ? `${Math.min(d.done, d.total)}/${d.total}` : '–'),
        h('div', { class: 'pm-bar-track' }, h('div', { class: 'pm-bar-fill', style: { height: `${d.total ? Math.max(p, 4) : 0}%` } })),
        h('span', { class: 'pm-bar-day' }, DAY_INITIALS[parseKey(d.date).getDay()])));
    }
    const rate = pct(done, total);
    return h('section', { class: 'card pm-week' },
      h('div', { class: 'section-head' }, h('h3', null, 'Cette semaine'), total ? h('span', { class: `pm-rate${rate >= 80 ? ' good' : ''}` }, `${rate} %`) : null),
      bars,
      h('p', { class: 'small muted' }, total
        ? `${done} mission${done > 1 ? 's' : ''} faite${done > 1 ? 's' : ''} sur ${total} (${rate} %) ces 7 derniers jours.`
        : 'Aucune mission prévue ces 7 derniers jours.'));
  }

  // ---------- Modèles ----------
  private templates(existing: Mission[]): HTMLElement {
    const have = new Set(existing.map(m => m.title.trim().toLowerCase()));
    return h('div', { class: 'pm-templates' },
      h('span', { class: 'small muted' }, 'Modèles — touchez pour préremplir'),
      h('div', { class: 'chips' }, ...[...TEMPLATES].sort((a, b) => Number(have.has(a.title.toLowerCase())) - Number(have.has(b.title.toLowerCase()))).map(t => {
        const used = have.has(t.title.toLowerCase());
        return h('button', {
          class: `chip pm-tpl${used ? ' used' : ''}`, type: 'button', title: used ? 'Déjà dans la liste' : undefined,
          onclick: () => this.open({ ...JSON.parse(JSON.stringify(t)) as Omit<Mission, 'id'>, id: newId('m_') }, false, true)
        }, icon(used ? ICONS.check : ICONS.plus, 14), h('span', null, t.title));
      })));
  }

  // ---------- Vue liste ----------
  private list(childId: string, snap: ChildSnapshot): HTMLElement {
    const hub = this.app.family.hub!;
    const list = h('div', { class: 'list' });
    const missions = [...snap.missions].sort((a, b) => Number(!!b.once) - Number(!!a.once) || Number(!!a.optional) - Number(!!b.optional) || byTime(a, b));
    for (const m of missions) {
      const st = snap.today?.[m.id];
      const kind = m.once ? 'once' : m.optional ? 'bonus' : 'regular';
      list.append(h('div', { class: `list-row pm-row ${kind}` },
        h('button', { class: 'pm-time', type: 'button', 'aria-label': `Modifier ${m.title}`, onclick: () => this.edit(m) },
          m.time ? h('strong', null, m.time) : icon(m.once ? ICONS.spark : m.optional ? ICONS.star : ICONS.clock, 18),
          h('span', null, m.time ? 'rappel' : m.once ? 'spéciale' : m.optional ? 'bonus' : 'libre')),
        h('div', { class: 'grow pm-body' },
          h('div', { class: 'item-name' }, m.title,
            m.optional && m.time ? h('span', { class: 'quest-tag bonus' }, 'Bonus') : null,
            st && STATUS_LABEL[st] ? h('span', { class: `pill ${st} pm-status` }, STATUS_LABEL[st]) : null),
          m.once ? h('div', { class: 'small pm-once-line' }, 'Quête spéciale · une seule fois') : this.dayDots(m.days),
          h('div', { class: 'pm-meta' },
            m.xp ? h('span', { class: 'pm-chip xp' }, `+${m.xp} XP`) : null,
            m.gold ? h('span', { class: 'pm-chip gold' }, icon(ICONS.coin, 12), `+${m.gold}`) : null,
            h('span', { class: `pm-chip val ${m.validation}` }, icon(m.validation === 'parent' ? ICONS.shield : ICONS.hand, 12), m.validation === 'parent' ? 'Parent' : 'Confiance'))),
        h('div', { class: 'pm-actions' },
          h('button', { class: 'icon-btn', 'aria-label': `Modifier ${m.title}`, onclick: () => this.edit(m) }, icon(ICONS.edit, 18)),
          h('button', { class: 'icon-btn', 'aria-label': `Supprimer ${m.title}`, onclick: async () => {
            if (!confirm(`Supprimer « ${m.title} » ?`)) return;
            await hub.removeMission(childId, m.id);
          } }, icon(ICONS.trash, 18)))));
    }
    return list;
  }

  private dayDots(days: number[]): HTMLElement {
    const label = days.length === 7 ? 'Tous les jours' : WEEK_ORDER.filter(d => days.includes(d)).map(d => DAY_LABELS[d]).join(', ');
    return h('div', { class: 'pm-dots', 'aria-label': label, title: label },
      ...WEEK_ORDER.map(d => h('span', { class: days.includes(d) ? 'on' : '' }, DAY_INITIALS[d])),
      days.length === 7 ? h('em', null, 'tous les jours') : null);
  }

  // ---------- Vue semaine ----------
  private calendar(snap: ChildSnapshot): HTMLElement {
    const todayDow = (snap.date ? parseKey(snap.date) : new Date()).getDay();
    const once = snap.missions.filter(m => m.once).sort(byTime);
    const wrap = h('div', { class: 'pm-cal-wrap' });
    if (once.length) {
      wrap.append(h('div', { class: 'pm-once' }, h('span', { class: 'small muted' }, 'Quêtes spéciales'),
        ...once.map(m => h('button', { class: 'pm-block once', type: 'button', onclick: () => this.edit(m) }, icon(ICONS.spark, 12), h('span', null, m.title)))));
    }
    const grid = h('div', { class: 'pm-cal' });
    for (const d of WEEK_ORDER) {
      const items = snap.missions.filter(m => !m.once && m.days.includes(d)).sort(byTime);
      const col = h('div', { class: `pm-col${d === todayDow ? ' today' : ''}` },
        h('div', { class: 'pm-col-head' }, h('strong', null, DAY_LABELS[d]), h('span', null, String(items.filter(m => !m.optional).length))));
      for (const m of items) {
        col.append(h('button', { class: `pm-block${m.optional ? ' bonus' : ''}${m.validation === 'parent' ? ' parent' : ''}`, type: 'button', 'aria-label': `${DAY_LABELS[d]} ${m.time ?? ''} ${m.title} — modifier`, onclick: () => this.edit(m) },
          h('span', { class: 'pm-block-time' }, m.time ?? (m.optional ? '★' : '—')),
          h('span', { class: 'pm-block-title' }, m.title)));
      }
      if (!items.length) col.append(h('span', { class: 'pm-col-empty' }, 'Repos'));
      grid.append(col);
    }
    wrap.append(grid, h('div', { class: 'pm-legend small muted' },
      h('span', null, h('i', { class: 'pm-sw parent' }), 'validation parent'),
      h('span', null, h('i', { class: 'pm-sw trust' }), 'confiance'),
      h('span', null, h('i', { class: 'pm-sw bonus' }), 'bonus')));
    return wrap;
  }

  /** Vitrine des vraies récompenses (échangées contre des gemmes : 1 par mission, 2 par quête bonus ou journée parfaite). */
  private rewardsCard(childId: string, rewards: Reward[]): HTMLElement {
    const hub = this.app.family.hub!;
    const rerender = () => this.refresh();
    const card = h('section', { class: 'card' },
      h('div', { class: 'section-head' }, h('h3', null, 'Vraies récompenses'), h('button', { class: 'btn small-btn', onclick: () => { this.rewardDraft = { id: newId('rw_'), title: '', cost: 20 }; rerender(); } }, icon(ICONS.plus, 14), ' Ajouter')),
      h('p', { class: 'small muted' }, 'Elle gagne 1 gemme par mission, 2 par quête bonus ou journée parfaite, 5 par expédition terminée. Comptez environ 30 à 40 gemmes par semaine bien remplie.'));
    for (const r of rewards) {
      card.append(h('div', { class: 'list-row' },
        h('div', { class: 'grow' }, h('div', { class: 'item-name' }, r.title), h('div', { class: 'small muted' }, `${r.cost} gemmes`)),
        h('button', { class: 'icon-btn', 'aria-label': `Modifier ${r.title}`, onclick: () => { this.rewardDraft = { ...r }; rerender(); } }, icon(ICONS.edit, 18)),
        h('button', { class: 'icon-btn', 'aria-label': `Supprimer ${r.title}`, onclick: async () => {
          if (!confirm(`Supprimer « ${r.title} » ?`)) return;
          await hub.setRewards(childId, rewards.filter(x => x.id !== r.id));
        } }, icon(ICONS.trash, 18))));
    }
    const d = this.rewardDraft;
    if (d) {
      card.append(h('div', { class: 'reward-form' },
        h('label', { class: 'field-col' }, h('span', { class: 'small' }, 'Récompense'), h('input', { type: 'text', maxlength: '60', value: d.title, placeholder: 'Une soirée pyjama avec une copine', oninput: (e: Event) => { d.title = (e.target as HTMLInputElement).value; } })),
        h('label', { class: 'field-col' }, h('span', { class: 'small' }, 'Prix en gemmes'), h('input', { type: 'number', min: '1', max: '500', value: String(d.cost), inputmode: 'numeric', oninput: (e: Event) => { d.cost = Math.max(1, Number((e.target as HTMLInputElement).value) || 1); } })),
        h('div', { class: 'row end' },
          h('button', { class: 'btn', onclick: () => { this.rewardDraft = null; rerender(); } }, 'Annuler'),
          h('button', { class: 'btn primary', onclick: async () => {
            if (d.title.trim().length < 2) { this.app.toast('Donnez un intitulé.'); return; }
            d.title = d.title.trim();
            const next = rewards.some(x => x.id === d.id) ? rewards.map(x => (x.id === d.id ? d : x)) : [...rewards, d];
            await hub.setRewards(childId, next);
            this.rewardDraft = null;
            this.app.toast('Vitrine mise à jour');
            rerender();
          } }, 'Enregistrer'))));
    }
    return card;
  }

  private form(childId: string, d: Draft): HTMLElement {
    const rerender = () => this.refresh();
    const input = (label: string, attrs: Record<string, unknown>, set: (v: string) => void) =>
      h('label', { class: 'field-col' }, h('span', { class: 'small' }, label), h('input', { ...attrs, oninput: (e: Event) => set((e.target as HTMLInputElement).value) }));

    const days = h('div', { class: 'day-picker' }, ...WEEK_ORDER.map(i => h('button', {
      class: d.days.includes(i) ? 'on' : '', type: 'button', 'aria-pressed': d.days.includes(i) ? 'true' : 'false',
      onclick: () => { d.days = d.days.includes(i) ? d.days.filter(x => x !== i) : [...d.days, i].sort(); rerender(); }
    }, DAY_LABELS[i])));
    const setDays = (v: number[]) => () => { d.days = [...v]; rerender(); };
    const quickDays = h('div', { class: 'row pm-quickdays' },
      h('button', { class: 'chip', type: 'button', onclick: setDays(ALL) }, 'Tous les jours'),
      h('button', { class: 'chip', type: 'button', onclick: setDays(WEEKDAYS) }, 'Semaine'),
      h('button', { class: 'chip', type: 'button', onclick: setDays([0, 6]) }, 'Week-end'));

    const valSel = h('div', { class: 'segmented two' }, ...(['parent', 'trust'] as Validation[]).map(v => h('button', {
      class: d.validation === v ? 'active' : '', type: 'button', onclick: () => { d.validation = v; rerender(); }
    }, v === 'parent' ? 'Validation parent' : 'Confiance')));

    return h('section', { class: 'card' },
      h('h3', null, this.editing ? 'Modifier la mission' : d.once ? 'Nouvelle quête spéciale' : d.optional ? 'Nouvelle quête bonus' : 'Nouvelle mission'),
      this.fromTemplate ? h('p', { class: 'small muted' }, 'Prérempli depuis un modèle : ajustez si besoin, puis enregistrez.') : null,
      input('Intitulé', { type: 'text', value: d.title, maxlength: '60', placeholder: d.once ? 'Aider à préparer le repas de dimanche' : 'Ranger sa chambre' }, v => { d.title = v; }),
      h('div', { class: 'grid-2' },
        input('XP', { type: 'number', min: '0', max: '500', value: String(d.xp), inputmode: 'numeric' }, v => { d.xp = Math.max(0, Number(v) || 0); }),
        input('Or', { type: 'number', min: '0', max: '500', value: String(d.gold), inputmode: 'numeric' }, v => { d.gold = Math.max(0, Number(v) || 0); })),
      h('span', { class: 'small' }, 'Qui valide ?'), valSel,
      h('p', { class: 'small muted' }, d.validation === 'parent' ? 'L’enfant coche, un parent valide : l’XP n’est crédité qu’après.' : 'L’XP est crédité dès que l’enfant coche.'),
      d.once ? null : h('span', { class: 'small' }, 'Jours'), d.once ? null : days, d.once ? null : quickDays,
      input('Heure du rappel (vide = pas de rappel)', { type: 'time', value: d.time ?? '' }, v => { d.time = v || null; }),
      h('div', { class: 'row end' },
        h('button', { class: 'btn', onclick: () => { this.draft = null; this.fromTemplate = false; rerender(); } }, 'Annuler'),
        h('button', { class: 'btn primary', onclick: async () => {
          if (d.title.trim().length < 2) { this.app.toast('Donnez un intitulé.'); return; }
          if (!d.once && !d.days.length) { this.app.toast('Choisissez au moins un jour.'); return; }
          d.title = d.title.trim();
          await this.app.family.hub!.upsertMission(childId, d);
          this.app.toast(d.once ? 'Quête envoyée' : 'Mission enregistrée');
          this.draft = null; this.fromTemplate = false;
          rerender();
        } }, d.once && !this.editing ? 'Envoyer la quête' : 'Enregistrer')));
  }
}

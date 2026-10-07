// « Profil » : carte d'identité du dragon, entraînement, succès, album souvenirs, puis tous les réglages.
import { TIER_LABEL, badgeProgress } from '../../family/badges.js';
import type { Companion } from '../../family/Companion.js';
import { STATS, type GameStat } from '../../family/Training.js';
import type { App, Screen } from '../App.js';
import { ICONS, clear, h, icon } from '../dom.js';
import { openSheet } from './common.js';
import { deviceSetupCard, membersCard } from './family.js';
import { devToolsCard, qualityCard, soundCard, versionLine } from './SettingsScreen.js';

const STAT_ICONS: Record<GameStat, string> = { agilite: ICONS.wing, vitesse: ICONS.spark, feu: ICONS.flame, sagesse: ICONS.album };

export class ProfileScreen implements Screen {
  id = 'settings'; label = 'Profil'; icon = ICONS.settings;
  private el: HTMLElement | null = null;
  private showAllBadges = false;
  private offTraining: (() => void) | null = null;
  constructor(private app: App) {}

  mount(el: HTMLElement): void {
    this.el = el;
    this.offTraining = this.app.family.training?.events.on('change', () => this.refresh()) ?? null;
    this.refresh();
    void this.app.refreshLink();
  }
  unmount(): void { this.el = null; this.offTraining?.(); this.offTraining = null; }

  refresh(): void {
    const el = this.el; if (!el) return;
    const { app } = this;
    const comp = app.family.companion;
    const book = app.family.book;
    const top = el.scrollTop;
    clear(el);
    el.append(this.header());
    if (app.family.training) el.append(this.trainingCard());
    if (book) el.append(this.badgesCard());
    if (comp) el.append(this.albumCard(comp));
    el.append(this.settings());
    el.scrollTop = top;
  }

  // ---------- 1. En-tête ----------
  private header(): HTMLElement {
    const { app } = this;
    const comp = app.family.companion, book = app.family.book;
    const stage = app.stageOverride ?? app.state.stage;
    const bond = comp?.bondLevel();
    const title = book?.titleText();
    const streak = book?.streak() ?? 0;
    const total = book?.data.stats?.total;
    const name = comp?.name ?? (app.isParent ? 'Ta dragonne' : 'Ton dragon');

    const stat = (value: string | number, label: string, path: string) =>
      h('div', { class: 'cp-stat' }, icon(path, 18), h('strong', null, String(value)), h('span', null, label));

    return h('section', { class: 'card cp-hero' },
      h('div', { class: 'cp-hero-top' },
        h('div', { class: 'cp-avatar' }, icon(ICONS.dragon, 34)),
        h('div', { class: 'grow' },
          h('h2', { class: 'cp-name' }, name),
          h('div', { class: 'small muted' }, `${app.stageLabel(stage.label)} · niveau ${app.state.data.level}${stage.sizeMeters ? ` · ~${String(stage.sizeMeters).replace('.', ',')} m` : ''}`),
          title ? h('span', { class: 'badge title-badge cp-title' }, icon(ICONS.star, 12), ' ', title) : null)),
      bond ? h('div', { class: 'cp-bond' },
        h('div', { class: 'row' }, icon(ICONS.heart, 16), h('span', { class: 'grow' }, `Amitié : ${bond.label}`), h('span', { class: 'small muted' }, `niveau ${bond.level}`)),
        h('div', { class: 'bar bond-bar' }, h('div', { class: 'fill', style: { width: `${Math.round(bond.progress * 100)}%` } }))) : null,
      book ? h('div', { class: 'cp-stats' },
        stat(streak, streak > 1 ? 'jours de série' : 'jour de série', ICONS.flame),
        typeof total === 'number' ? stat(total, total > 1 ? 'missions faites' : 'mission faite', ICONS.check) : null,
        stat(book.data.stats?.perfectDays ?? 0, 'journées parfaites', ICONS.star)) : null);
  }

  // ---------- 2. Entraînement ----------
  private trainingCard(): HTMLElement {
    const tr = this.app.family.training!;
    const rows = STATS.map(st => {
      const lv = tr.level(st.id);
      return h('div', { class: `cp-train cp-${st.id}` },
        h('div', { class: 'cp-train-icon' }, icon(STAT_ICONS[st.id], 20)),
        h('div', { class: 'grow' },
          h('div', { class: 'row cp-train-head' }, h('strong', { class: 'grow' }, st.label), h('span', { class: 'cp-lv' }, `Niv. ${lv.level}`)),
          h('div', { class: 'bar cp-train-bar' }, h('div', { class: 'fill', style: { width: `${Math.round(lv.progress * 100)}%` } })),
          h('div', { class: 'small muted' }, `${st.hint} · ${lv.points} / ${lv.next} pts`)));
    });
    const label = (s: GameStat) => STATS.find(x => x.id === s)?.label ?? s;
    const tricks = tr.tricks();
    const unlocked = tricks.filter(t => t.unlocked).length;
    return h('section', { class: 'card cp-training' },
      h('div', { class: 'section-head' }, h('h3', null, 'Entraînement'), h('span', { class: 'small muted' }, `${tr.playedToday()} jeu${tr.playedToday() > 1 ? 'x' : ''} aujourd’hui`)),
      h('p', { class: 'small muted' }, `Chaque mini-jeu entraîne une qualité ${this.app.isParent ? 'de ta dragonne' : 'de ton dragon'} (une fois par jour).`),
      ...rows,
      h('div', { class: 'section-head cp-sub' }, h('h4', null, 'Tours spéciaux'), h('span', { class: 'small muted' }, `${unlocked} / ${tricks.length}`)),
      h('div', { class: 'cp-tricks' }, ...tricks.map(t =>
        h('div', { class: `cp-trick${t.unlocked ? ' on' : ''}` },
          icon(t.unlocked ? ICONS.spark : ICONS.lock, 16),
          h('span', { class: 'grow' }, t.label),
          h('span', { class: 'small' }, t.unlocked ? 'Débloqué' : `${label(t.stat)} niveau ${t.level}`)))));
  }

  // ---------- 3. Succès ----------
  private badgesCard(): HTMLElement {
    const { app } = this;
    const book = app.family.book!;
    const defs = book.badgeDefs;
    const unlocked = defs.filter(b => book.data.badges[b.id]);
    const locked = defs.filter(b => !book.data.badges[b.id]).map(b => ({ b, p: badgeProgress(b, book.data.stats, app.state.data.level, app.state.data.stage) }))
      .sort((x, y) => y.p[0] / y.p[1] - x.p[0] / x.p[1]);
    const shownLocked = this.showAllBadges ? locked : locked.slice(0, 3);

    const tile = (id: string, title: string, desc: string, tier: string, isOn: boolean, progress?: [number, number]) =>
      h('button', {
        class: `badge-tile tier-${tier}${isOn ? ' on' : ''}${book.data.title === id ? ' selected' : ''}`,
        'aria-label': `${title} : ${desc}`,
        onclick: () => {
          if (!isOn) { app.toast(desc); return; }
          book.setTitle(book.data.title === id ? null : id);
          app.toast(book.data.title === id ? `Titre affiché : ${title}` : 'Titre retiré');
          this.refresh();
        }
      },
        h('span', { class: 'medal' }, isOn ? icon(ICONS.star, 22) : icon(ICONS.lock, 18)),
        h('span', { class: 'badge-title' }, title),
        progress ? h('span', { class: 'badge-prog' }, h('span', { style: { width: `${Math.min(100, (progress[0] / progress[1]) * 100)}%` } })) : h('span', { class: 'badge-tier' }, TIER_LABEL[tier as keyof typeof TIER_LABEL]));

    return h('section', { class: 'card' },
      h('div', { class: 'section-head' }, h('h3', null, 'Succès'), h('span', { class: 'small muted' }, `${unlocked.length} / ${defs.length}`)),
      unlocked.length ? h('p', { class: 'small muted' }, 'Touche un succès débloqué pour l’afficher comme titre.') : null,
      h('div', { class: 'badge-grid' },
        ...unlocked.map(b => tile(b.id, b.title, b.description, b.tier, true)),
        ...shownLocked.map(({ b, p }) => tile(b.id, b.title, `${b.description} (${Math.min(p[0], p[1])}/${p[1]})`, b.tier, false, p))),
      locked.length > 3 ? h('button', { class: 'btn ghost', onclick: () => { this.showAllBadges = !this.showAllBadges; this.refresh(); } },
        this.showAllBadges ? 'Voir moins' : `Voir les ${locked.length} succès à débloquer`) : null);
  }

  // ---------- 4. Album souvenirs ----------
  private albumCard(comp: Companion): HTMLElement {
    const album = comp.data.album;
    return h('section', { class: 'card cp-album' },
      h('div', { class: 'section-head' }, h('h3', null, 'Album souvenirs'),
        album.length > 3 ? h('button', { class: 'btn ghost cp-small', onclick: () => this.albumSheet(comp) }, `Voir tout (${album.length})`) : null),
      ...(album.length ? album.slice(0, 3).map(a => this.albumRow(a)) : [h('p', { class: 'small muted' }, this.emptyAlbum())]));
  }

  private albumRow(a: { at: number; title: string; text: string }): HTMLElement {
    return h('div', { class: 'album-row' },
      h('div', { class: 'album-date' }, new Date(a.at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })),
      h('div', null, h('div', { class: 'item-name' }, a.title), h('div', { class: 'small muted' }, a.text)));
  }

  private emptyAlbum(): string {
    return 'Vos plus beaux moments s’afficheront ici : son nom, ses évolutions, vos séries de missions, vos niveaux d’amitié…';
  }

  private albumSheet(comp: Companion): void {
    openSheet('Album souvenirs', () => comp.data.album.length
      ? comp.data.album.map(a => this.albumRow(a))
      : [h('p', { class: 'muted' }, this.emptyAlbum())]);
  }

  // ---------- 5. Réglages ----------
  private settings(): HTMLElement {
    const { app } = this;
    const rerender = () => this.refresh();
    return h('div', { class: 'cp-settings' },
      h('h3', { class: 'cp-section-title' }, icon(ICONS.settings, 18), ' Réglages'),
      deviceSetupCard(app, rerender),
      membersCard(app),
      soundCard(app),
      qualityCard(app),
      app.devMode ? devToolsCard(app) : null,
      versionLine(app, rerender));
  }
}

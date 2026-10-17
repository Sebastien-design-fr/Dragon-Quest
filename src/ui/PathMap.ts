// « Mon chemin » : la route des niveaux, pour que l'enfant voie toujours sa prochaine récompense.
// Évolutions (silhouette mystère tant qu'elles ne sont pas atteintes), pouvoirs de jeu, reflets d'écailles,
// nouveautés ; « encore N quêtes » calculé avec l'XP moyen de ses vraies missions.
// S'ouvre en touchant le niveau / la barre d'XP du bandeau.
import { Assets } from '../engine/AssetManager.js';
import { POWERS } from '../game/StagePowers.js';
import type { App } from './App.js';
import { ICONS, h, icon } from './dom.js';
import { openSheet } from './screens/common.js';
import { UNLOCK_LEVEL } from './Unlocks.js';

type Kind = 'evolve' | 'power' | 'tint' | 'feature';
interface Milestone { level: number; kind: Kind; title: string; sub: string; color?: string; stage?: string }

const FEATURE_TEXT: Record<string, [string, string]> = {
  gifts: ['Câlins et cadeaux', 'Envoyer des câlins et cacher des cadeaux chez l’autre dragon']
};

/** Toutes les étapes, triées par niveau. */
function milestones(app: App): Milestone[] {
  const out: Milestone[] = [];
  for (const st of app.catalog.stages) {
    if (st.minLevel <= 1) continue;
    out.push({ level: st.minLevel, kind: 'evolve', title: app.stageLabel(st.label), sub: st.tagline ?? 'Évolution', stage: st.id });
    const p = POWERS.find(x => x.stage === st.id);
    if (p) out.push({ level: st.minLevel, kind: 'power', title: `Pouvoir : ${p.name}`, sub: p.effect });
  }
  for (const t of app.catalog.visual?.tints?.list ?? []) {
    if (t.level <= 1) continue;
    out.push({ level: t.level, kind: 'tint', title: `Reflet ${t.label}`, sub: 'Une nouvelle couleur d’écailles', color: `rgb(${t.color.join(',')})` });
  }
  for (const [f, lv] of Object.entries(UNLOCK_LEVEL)) {
    const txt = FEATURE_TEXT[f];
    if (txt && lv > 1) out.push({ level: lv, kind: 'feature', title: txt[0], sub: txt[1] });
  }
  return out.sort((a, b) => a.level - b.level);
}

/** XP moyen d'une quête de l'enfant (ses vraies missions), 15 par défaut. */
function questXp(app: App): number {
  const ms = (app.family.book?.data.missions ?? []).filter(m => !m.optional && m.xp > 0);
  return ms.length ? Math.max(5, Math.round(ms.reduce((a, m) => a + m.xp, 0) / ms.length)) : 15;
}

/** XP qu'il reste pour atteindre un niveau. */
function xpUntil(app: App, level: number): number {
  const d = app.state.data;
  if (level <= d.level) return 0;
  let need = app.state.xpToNext(d.level) - d.xp;
  for (let l = d.level + 1; l < level; l++) need += app.state.xpToNext(l);
  return Math.max(0, need);
}

const quests = (xp: number, per: number) => Math.max(1, Math.ceil(xp / per));
const plural = (n: number, w: string) => `${n} ${w}${n > 1 ? 's' : ''}`;

/**
 * Combien de temps encore : en quêtes quand c'est proche (on peut les compter), en jours, semaines ou mois
 * quand c'est loin (« 260 quêtes » décourage, « environ 3 mois » donne un horizon).
 */
function howLong(app: App, xp: number, per: number): string {
  const q = quests(xp, per);
  if (q <= 25) return `encore ${plural(q, 'quête')}`;
  const perDay = Math.max(1, app.family.book?.today().length ?? 3);
  const days = Math.ceil(q / perDay);
  if (days < 14) return `environ ${plural(days, 'jour')}`;
  const weeks = Math.round(days / 7);
  return weeks <= 8 ? `environ ${weeks} semaines` : `environ ${Math.round(weeks / 4.3)} mois`;
}

function badge(m: Milestone, reached: boolean, variant: string): HTMLElement {
  if (m.kind === 'evolve' && m.stage) {
    const src = Assets.dragonPart(m.stage, 'full', variant);
    return h('span', { class: `pm-ico evolve${reached ? '' : ' mystery'}` }, src ? h('img', { src, alt: '' }) : icon(ICONS.dragon, 22));
  }
  if (m.kind === 'tint') return h('span', { class: 'pm-ico tint', style: { '--c': m.color ?? '#999' } });
  return h('span', { class: `pm-ico ${m.kind}` }, icon(m.kind === 'power' ? ICONS.spark : ICONS.gift, 18));
}

export function openPathMap(app: App): void {
  if (app.isParent) return;
  const d = app.state.data;
  const per = questXp(app);
  const all = milestones(app);
  const variant = app.ownVariant;
  const top = Math.max(30, ...all.map(m => m.level), d.level + 3);
  const next = all.find(m => m.level > d.level);
  const nextEvolve = all.find(m => m.kind === 'evolve' && m.level > d.level);
  const toNext = app.state.xpToNext() - d.xp;

  openSheet('Mon chemin', () => {
    const head = h('section', { class: 'pm-head' },
      h('div', { class: 'pm-now' },
        h('strong', null, `Niveau ${d.level}`),
        h('span', { class: 'small muted' }, `Encore ${toNext} XP avant le niveau ${d.level + 1} (${howLong(app, toNext, per)}) · +50 or à chaque niveau`)),
      next ? h('div', { class: 'pm-next' },
        badge(next, false, variant),
        h('span', { class: 'pm-next-txt' },
          h('span', { class: 'pm-kicker' }, 'Prochaine récompense'),
          h('strong', null, next.kind === 'evolve' ? 'Une évolution mystère !' : next.title),
          h('span', { class: 'small muted' }, `Niveau ${next.level} · ${howLong(app, xpUntil(app, next.level), per)}`))) : null,
      nextEvolve && nextEvolve !== next ? h('p', { class: 'small muted pm-evo' }, `Prochaine évolution au niveau ${nextEvolve.level} : ${howLong(app, xpUntil(app, nextEvolve.level), per)}.`) : null);

    const road = h('ol', { class: 'pm-road', 'aria-label': 'Les niveaux' });
    for (let lv = 1; lv <= top; lv++) {
      const ms = all.filter(m => m.level === lv);
      const reached = lv <= d.level, current = lv === d.level;
      const big = ms.some(m => m.kind === 'evolve');
      if (!ms.length && !current && lv !== 1 && lv % 5 !== 0) {
        road.append(h('li', { class: `pm-step small${reached ? ' done' : ''}`, 'aria-label': `Niveau ${lv}` }, h('span', { class: 'pm-dot' })));
        continue;
      }
      road.append(h('li', { class: `pm-step${reached ? ' done' : ''}${current ? ' current' : ''}${big ? ' big' : ''}`, 'data-level': String(lv) },
        h('span', { class: 'pm-node' }, current ? h('span', { class: 'pm-you' }, 'Toi') : reached ? icon(ICONS.check, 16) : String(lv)),
        h('span', { class: 'pm-label' },
          h('span', { class: 'pm-lv' }, `Niveau ${lv}`),
          ...ms.map(m => h('span', { class: 'pm-ms' }, badge(m, reached, variant),
            h('span', null, h('strong', null, m.kind === 'evolve' && !reached ? 'Évolution mystère' : m.title), h('span', { class: 'small muted' }, m.kind === 'evolve' && !reached ? 'Qui va-t-il devenir ?' : m.sub)))))));
    }
    // la route s'ouvre sur sa position actuelle
    setTimeout(() => {
      const panel = road.closest<HTMLElement>('.sheet-panel'), cur = road.querySelector<HTMLElement>('.current');
      if (!panel || !cur) return;
      const y = panel.scrollTop + cur.getBoundingClientRect().top - panel.getBoundingClientRect().top;
      panel.scrollTop = Math.max(0, y - panel.clientHeight * 0.35);
    }, 320);
    return [head, road];
  });
}

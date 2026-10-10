// Pas du jour (carte de l'écran Dragon) et potion d'expérience (boutique).
import type { App } from './App.js';
import { ICONS, h, icon } from './dom.js';
import { UI } from './Motion.js';
import { floatReward } from './Reactions.js';

const fmt = (n: number) => n.toLocaleString('fr-FR');

/** Branche les pas : lecture à l'ouverture, au retour dans l'appli et toutes les 5 minutes ; paliers fêtés. */
export function installActivity(app: App): void {
  const act = app.family.activity;
  if (!act) return;
  act.events.on('tier', t => {
    const who = app.family.companion?.name ?? (app.isParent ? 'Ta dragonne' : 'Ton dragon');
    setTimeout(() => {
      app.toast(`${fmt(t.at)} pas ! +${t.xp} XP, +${t.gold} or`);
      floatReward(app, t.xp, t.gold, 200);
      if (app.showingOwn && !app.sleeping) { void app.act('happy'); app.say(`${fmt(t.at)} pas aujourd’hui ! ${who} a vu du pays avec toi.`, null, 5000); }
    }, 800);
  });
  act.events.on('change', () => app.refresh());
  const read = () => { if (!document.hidden) void act.refresh(); };
  setTimeout(read, 2500);
  document.addEventListener('visibilitychange', read);
  window.setInterval(read, 5 * 60 * 1000);
}

/** Carte « Pas du jour » : paliers, prochain objectif, autorisation du capteur. */
export function stepsCard(app: App): HTMLElement | null {
  const act = app.family.activity;
  if (!act) return null;
  const d = act.data;
  const max = act.dailyMax();
  const head = h('div', { class: 'row' },
    h('span', { class: 'st-ico' }, icon(ICONS.foot, 20)),
    h('div', { class: 'grow' }, h('div', { class: 'small muted' }, 'Pas du jour'), h('div', { class: 'item-name' }, d.permission && d.available ? `${fmt(d.steps)} pas` : 'Tes pas comptent')),
    h('span', { class: 'small muted' }, `jusqu’à +${max.xp} XP`));
  if (!d.available) return h('section', { class: 'card steps-card' }, head,
    h('p', { class: 'small muted' }, 'Ce téléphone n’a pas de compteur de pas.'));
  if (!d.permission) return h('section', { class: 'card steps-card' }, head,
    h('p', { class: 'small muted' }, 'Le téléphone compte tes pas lui-même, rien ne sort de l’appareil. Autorise « Activité physique » pour gagner de l’XP et de l’or en marchant.'),
    h('button', { class: 'btn primary', onclick: async () => { await act.askPermission(); setTimeout(() => void act.refresh(), 1500); } }, 'Compter mes pas'));
  const tiers = act.tiers();
  const top = tiers[tiers.length - 1]?.at ?? 10000;
  const next = act.next();
  return h('section', { class: 'card steps-card' }, head,
    h('div', { class: 'st-track' },
      h('div', { class: 'st-fill', style: { width: `${Math.min(100, (d.steps / top) * 100)}%` } }),
      ...tiers.map(t => h('span', { class: `st-mark${t.reached ? ' on' : ''}`, style: { left: `${(t.at / top) * 100}%` }, title: `${fmt(t.at)} pas : +${t.xp} XP, +${t.gold} or` },
        t.reached ? icon(ICONS.check, 11) : null))),
    h('div', { class: 'st-legend' }, ...tiers.map(t => h('span', { class: t.reached ? 'on' : '', style: { left: `${(t.at / top) * 100}%` } }, `${t.at / 1000} k`))),
    h('p', { class: 'small muted' }, next
      ? `Prochain palier : ${fmt(next.at)} pas (+${next.xp} XP, +${next.gold} or). Encore ${fmt(next.at - d.steps)}.`
      : 'Tous les paliers du jour sont atteints. Bravo !'));
}

/** Potion d'expérience (boutique) : quelques achats par jour, prix croissant pour un parent. */
export function potionCard(app: App): HTMLElement | null {
  const act = app.family.activity;
  if (!act) return null;
  const p = act.potion();
  const afford = p.price !== null && app.state.data.gold >= p.price;
  return h('section', { class: 'card potion-card' },
    h('div', { class: 'row' },
      h('span', { class: 'pt-ico' }, icon(ICONS.potion, 26)),
      h('div', { class: 'grow' },
        h('div', { class: 'item-name' }, 'Potion d’expérience'),
        h('div', { class: 'small muted' }, p.perDay > 1
          ? `+${p.xp} XP. ${p.left} sur ${p.perDay} aujourd’hui, le prix monte à chaque achat.`
          : `+${p.xp} XP. Une par jour : les quêtes restent le meilleur moyen de grandir.`)),
      p.price === null
        ? h('span', { class: 'small muted' }, 'Demain')
        : h('button', { class: 'btn primary small-btn', disabled: !afford, onclick: () => {
          const r = act.buyPotion();
          if (r === 'gold') { app.toast('Pas assez d’or'); return; }
          if (r === 'limit') { app.toast('Plus de potion aujourd’hui : reviens demain'); return; }
          UI.success();
          app.toast(`Potion bue : +${p.xp} XP`);
          floatReward(app, p.xp, 0);
          if (app.showingOwn) { void app.act('happy'); app.view.emit('happySparkle', 'head_anchor'); }
          app.refresh();
        } }, icon(ICONS.coin, 14), ` ${p.price}`)));
}

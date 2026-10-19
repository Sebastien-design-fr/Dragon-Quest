// Duel de feu en direct, pendant une visite : les deux téléphones jouent au même moment au Tir de feu,
// avec les mêmes cibles (graine commune) ; chacun voit le score de l'autre. À la fin, chacun gagne XP et or
// selon son score, avec un bonus pour le vainqueur. Les messages passent par le lien maison (Duo).
import { Assets } from '../engine/AssetManager.js';
import type { DuelMsg } from '../family/Duo.js';
import type { App } from './App.js';
import { h } from './dom.js';
import { playFireTargets } from './games/FireTargets.js';

interface Duel { id: string; seed: number; rival: string; rivalScore: number; rivalFinal: number | null; myFinal: number | null; state: 'waiting' | 'playing' | 'done' }

let duel: Duel | null = null;
let overlay: HTMLElement | null = null;
let waitTimer = 0;

/** Gains d'un duel : selon son score, avec un bonus de victoire (ou d'égalité). */
export function duelRewards(mine: number, theirs: number): { xp: number; gold: number; result: 'win' | 'lose' | 'tie' } {
  const result = mine > theirs ? 'win' : mine < theirs ? 'lose' : 'tie';
  const xp = Math.min(80, mine * 2) + (result === 'win' ? 10 : result === 'tie' ? 5 : 0);
  const gold = Math.min(60, mine) + (result === 'win' ? 20 : result === 'tie' ? 10 : 0);
  return { xp, gold, result };
}

function closeOverlay(): void { overlay?.remove(); overlay = null; clearTimeout(waitTimer); }

function show(el: HTMLElement): void {
  closeOverlay();
  overlay = h('div', { class: 'duel-ov', role: 'dialog', 'aria-modal': 'true' }, el);
  document.body.append(overlay);
}

/** Défier le dragon en visite (bouton du panneau de visite). */
export function inviteDuel(app: App, rivalName: string): void {
  const duo = app.family.duo;
  if (!duo || duel) return;
  const id = 'd' + Math.random().toString(36).slice(2, 10);
  duel = { id, seed: Math.floor(Math.random() * 2 ** 31), rival: rivalName, rivalScore: 0, rivalFinal: null, myFinal: null, state: 'waiting' };
  void duo.duelInvite(id, duel.seed);
  show(h('div', { class: 'duel-card' },
    h('h2', null, 'Duel de feu'),
    h('p', null, `Défi envoyé à ${rivalName}. Il faut que son téléphone ait l’appli ouverte pour accepter.`),
    h('div', { class: 'duel-dots', 'aria-hidden': 'true' }, h('i'), h('i'), h('i')),
    h('button', { class: 'btn ghost', onclick: () => cancel(app) }, 'Annuler')));
  waitTimer = window.setTimeout(() => { if (duel?.id === id && duel.state === 'waiting') { cancel(app); app.toast(`${rivalName} n’a pas répondu. Réessaie quand son appli est ouverte.`); } }, 60000);
}

function cancel(app: App): void {
  if (duel) void app.family.duo?.duelSend('cancel', duel.id);
  duel = null;
  closeOverlay();
}

/** Les deux téléphones partent ensemble : compte à rebours de 3 s dans le jeu. */
async function start(app: App): Promise<void> {
  const d = duel, duo = app.family.duo, comp = app.family.companion;
  if (!d || !duo || !comp) return;
  closeOverlay();
  d.state = 'playing';
  const variant = app.isParent ? 'dragonne' : 'dragon';
  const stage = app.view.stage?.id ?? 'baby';
  const stand = Assets.dragonPart(stage, 'full', variant) ?? '';
  let lastSent = 0, sentScore = -1;
  const score = await playFireTargets(comp.name, {
    stand, flyUp: stand, flyDown: stand, backdrop: Assets.background(stage) ?? undefined, stage,
    duel: {
      seed: d.seed, rival: d.rival, rivalScore: () => d.rivalScore,
      onScore: s => {
        const now = performance.now();
        if (s !== sentScore && now - lastSent > 700) { lastSent = now; sentScore = s; void duo.duelSend('score', d.id, s); }
      }
    }
  });
  d.myFinal = score;
  void duo.duelSend('end', d.id, score);
  if (d.rivalFinal !== null) result(app);
  else {
    show(h('div', { class: 'duel-card' }, h('h2', null, `Ton score : ${score}`), h('p', null, `On attend le score de ${d.rival}…`), h('div', { class: 'duel-dots', 'aria-hidden': 'true' }, h('i'), h('i'), h('i'))));
    // s'il ne répond plus, on garde son dernier score connu
    waitTimer = window.setTimeout(() => { if (duel === d && d.state === 'playing') { d.rivalFinal = d.rivalScore; result(app); } }, 15000);
  }
}

function result(app: App): void {
  const d = duel;
  if (!d || d.myFinal === null || d.rivalFinal === null || d.state === 'done') return;
  d.state = 'done';
  const comp = app.family.companion;
  const r = duelRewards(d.myFinal, d.rivalFinal);
  app.state.addXp(r.xp);
  app.state.addGold(r.gold);
  app.family.duo?.duelPlayed();
  if (comp) { comp.data.mood = Math.min(100, comp.data.mood + 15); comp.data.played = true; comp.save(); }
  void app.act(r.result === 'lose' ? 'happy' : 'roar');
  const title = r.result === 'win' ? 'Victoire !' : r.result === 'tie' ? 'Égalité !' : `${d.rival} gagne !`;
  const line = r.result === 'win' ? `${comp?.name ?? 'Ton dragon'} a tout brûlé !` : r.result === 'tie' ? 'Pile le même score, incroyable.' : 'Belle partie quand même : la revanche est permise.';
  const rival = d.rival;
  // victoire : grand moment sur la scène (ombre, ralenti, éclat) avant la carte des scores
  const win = r.result === 'win';
  const showResult = () => show(h('div', { class: `duel-card duel-${r.result}` },
    h('h2', null, title),
    h('div', { class: 'duel-scores' },
      h('div', { class: `duel-side${r.result === 'win' ? ' best' : ''}` }, h('span', null, comp?.name ?? 'Toi'), h('strong', null, String(d.myFinal))),
      h('span', { class: 'duel-vs', 'aria-hidden': 'true' }, 'contre'),
      h('div', { class: `duel-side${r.result === 'lose' ? ' best' : ''}` }, h('span', null, rival), h('strong', null, String(d.rivalFinal)))),
    h('p', null, line),
    h('p', { class: 'duel-gain' }, `+${r.xp} XP · +${r.gold} or`),
    h('div', { class: 'duel-act' },
      h('button', { class: 'btn primary', onclick: () => { closeOverlay(); duel = null; inviteDuel(app, rival); } }, 'Revanche'),
      h('button', { class: 'btn ghost', onclick: () => { closeOverlay(); duel = null; } }, 'Fermer'))));
  if (!win) { showResult(); return; }
  closeOverlay();
  app.view.spotlight([255, 180, 90]);
  window.setTimeout(() => { if (duel === d) showResult(); }, 1500);
}

/** Écoute les messages de duel (invitation, réponse, scores). */
export function installDuel(app: App): void {
  const duo = app.family.duo;
  if (!duo) return;
  duo.events.on('duel', (m: DuelMsg) => {
    if (m.kind === 'invite') {
      if (duel && duel.state !== 'done') { void duo.duelSend('decline', m.duelId); return; }
      const fromDragon = m.fromDragon;
      show(h('div', { class: 'duel-card' },
        h('h2', null, 'Duel de feu !'),
        h('p', null, `${fromDragon}${m.owner ? ` (${m.owner})` : ''} te défie : qui détruira le plus d’objets en crachant du feu ?`),
        h('p', { class: 'small muted' }, 'Mêmes cibles pour vous deux, 30 secondes. Chacun gagne de l’XP et de l’or selon son score.'),
        h('div', { class: 'duel-act' },
          h('button', { class: 'btn primary', onclick: () => {
            duel = { id: m.duelId, seed: m.seed, rival: fromDragon, rivalScore: 0, rivalFinal: null, myFinal: null, state: 'waiting' };
            void duo.duelSend('accept', m.duelId);
            void start(app);
          } }, 'Accepter'),
          h('button', { class: 'btn ghost', onclick: () => { void duo.duelSend('decline', m.duelId); closeOverlay(); } }, 'Pas maintenant'))));
      return;
    }
    if (!duel || m.duelId !== duel.id) return;
    if (m.kind === 'accept' && duel.state === 'waiting') void start(app);
    else if (m.kind === 'decline' || m.kind === 'cancel') {
      if (duel.state === 'waiting') { app.toast(m.kind === 'decline' ? `${duel.rival} ne peut pas jouer maintenant.` : 'Duel annulé.'); duel = null; closeOverlay(); }
    } else if (m.kind === 'score') duel.rivalScore = m.score;
    else if (m.kind === 'end') { duel.rivalFinal = m.score; duel.rivalScore = m.score; if (duel.myFinal !== null) result(app); }
  });
}

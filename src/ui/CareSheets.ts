// Panneaux de soins ouverts depuis la scène : état détaillé, tours, mini-jeux.
import { Assets } from '../engine/AssetManager.js';
import { STATS, type GameStat } from '../family/Training.js';
import type { App } from './App.js';
import { ICONS, h, icon } from './dom.js';
import { GAMES } from './games/index.js';
import { openSheet } from './screens/common.js';
import { startBlow } from './Sensors.js';

/** Détail des jauges, de l'amitié et du bonus. */
export function statusSheet(app: App): void {
  const comp = app.family.companion;
  if (!comp) return;
  const d = comp.data;
  const bond = comp.bondLevel();
  const gauge = (label: string, v: number, ic: string, hint: string) => h('div', { class: 'cs-gauge' },
    h('div', { class: 'row' }, icon(ic, 18), h('strong', { class: 'grow' }, label), h('span', { class: 'small muted' }, `${Math.round(v)} %`)),
    h('div', { class: `bar care-bar ${v < 50 ? 'mid' : ''}` }, h('div', { class: 'fill', style: { width: `${Math.round(v)}%` } })),
    h('p', { class: 'small muted' }, hint));
  openSheet(`${comp.name} · ${comp.mood().label}`, () => ([
    gauge('Faim', d.hunger, ICONS.meat, 'Nourris-le avec le bouton Nourrir : lance-lui à manger, il attrape au vol.'),
    gauge('Propreté', d.clean, ICONS.drop, 'Bouton Laver, puis frotte ses écailles avec ton doigt.'),
    gauge('Humeur', d.mood, ICONS.heart, 'Câlins, jeux, tours… gratte-lui la tête, chatouille son ventre, touche sa queue !'),
    h('div', { class: 'cs-gauge' },
      h('div', { class: 'row' }, icon(ICONS.heart, 18), h('strong', { class: 'grow' }, `Amitié : ${bond.label}`), h('span', { class: 'small muted' }, `niveau ${bond.level}`)),
      h('div', { class: 'bar bond-bar' }, h('div', { class: 'fill', style: { width: `${Math.round(bond.progress * 100)}%` } })),
      h('p', { class: 'small muted' }, 'Plus vous êtes amis, plus il apprend de tours.')),
    app.isParent ? h('p', { class: 'small muted' }, `Chaque soin la fait grandir : encore ${comp.careXpLeft()} XP possibles aujourd’hui.`)
      : h('p', { class: 'small muted' }, 'Le garde-manger se remplit chaque matin. Quand tu n’es pas là, il t’attend tranquillement : il peut s’ennuyer un peu, jamais être malade.')
  ] as Array<HTMLElement | null>).filter((n): n is HTMLElement => !!n));
}

/** Tours d'amitié, tours d'entraînement et souffle magique (micro). */
export function tricksSheet(app: App): void {
  const comp = app.family.companion;
  if (!comp) return;
  const training = app.family.training;
  openSheet('Les tours de ' + comp.name, close => {
    const guard = (_level: number): boolean => true;
    // À force de répéter un tour, il le maîtrise : 1 à 3 étoiles (2 répétitions comptées par tour et par jour).
    const starsOf = (id: string) => {
      const n = comp.stars(id), next = comp.nextMastery(id);
      return h('span', { class: 'tk-stars', title: next ? `Encore ${next - (comp.data.practice?.[id] ?? 0)} répétitions pour l’étoile suivante` : 'Maîtrisé' },
        ...[0, 1, 2].map(i => h('i', { class: i < n ? 'on' : '' }, '★')));
    };
    const row = (unlocked: boolean, label: string, need: string, run: () => void, id?: string) =>
      h('button', { class: `trick ${unlocked ? '' : 'locked'}`, onclick: () => { if (!unlocked) { app.toast(need); return; } run(); if (id) comp.practise(id, label); } },
        icon(unlocked ? ICONS.spark : ICONS.lock, 18), h('span', { class: 'grow' }, label),
        unlocked && id ? starsOf(id) : null,
        h('span', { class: 'small muted' }, unlocked ? 'Faire' : need));
    const nodes: Node[] = [
      h('button', { class: 'cs-blow', onclick: () => { close(); startBlow(app); } },
        icon(ICONS.flame, 22), h('span', { class: 'grow' }, h('strong', null, 'Souffle magique'), h('span', { class: 'small muted' }, 'Souffle dans le micro du téléphone : il crache du feu avec toi !'))),
      h('h4', null, 'Tours d’amitié'),
      h('p', { class: 'small muted' }, 'Répète ses tours pour qu’il les maîtrise : chaque étoile renforce votre amitié.'),
      ...comp.tricks().map(t => row(t.unlocked, t.label, `Amitié ${t.level}`, () => { if (guard(t.level)) { close(); void app.act(t.anim); if (comp.stars(t.id) >= 3) app.view.emit('happySparkle', 'head_anchor'); } }, t.id))
    ];
    if (training) {
      nodes.push(h('h4', null, 'Tours d’entraînement'), h('p', { class: 'small muted' }, 'Ils se débloquent en jouant aux mini-jeux (bouton Jouer).'));
      for (const t of training.tricks()) {
        const label = STATS.find(s => s.id === t.stat)?.label ?? t.stat;
        nodes.push(row(t.unlocked, t.label, `${label} ${t.level}`, () => { if (guard(2)) { close(); void app.act(t.anim); app.view.emit(t.stat === 'feu' ? 'fireRing' : 'happySparkle', 'head_anchor'); } }, 'tr_' + t.id));
      }
    }
    return nodes;
  });
}

/** Les mini-jeux : chacun entraîne une caractéristique. Le premier jeu du jour rapporte le plus. */
export function gamesSheet(app: App): void {
  const comp = app.family.companion;
  const training = app.family.training;
  if (!comp) return;
  const variant = app.isParent ? 'dragonne' : 'dragon';
  const stage = app.view.stage?.id ?? 'baby';
  const img = (k: string) => Assets.dragonPart(stage, k, variant) ?? Assets.dragonPart(stage, 'full', variant) ?? '';
  const opts = { stand: img('full'), flyUp: img('flyUp'), flyDown: img('flyDown') };
  openSheet('Jouer avec ' + comp.name, close => [
    h('p', { class: 'small muted' }, 'Chaque jeu entraîne une de ses qualités. La première partie de chaque jeu rapporte de l’or et des points d’entraînement chaque jour.'),
    ...GAMES.map(g => {
      const lv = training?.level(g.stat as GameStat);
      const already = training?.rewarded(g.id) ?? false;
      const best = training?.data.best[g.id] ?? 0;
      return h('button', { class: `cs-game${already ? ' done' : ''}`, onclick: async () => {
        close();
        const score = await g.play(comp.name, opts);
        const first = !already;
        const firstOfDay = (training?.playedToday() ?? 0) === 0;
        const res = training?.record(g.id, g.stat as GameStat, score);
        const gold = first ? comp.finishGame(score, firstOfDay ? 1 : 0.5) : 0;
        if (!first) comp.cheer();
        void app.act('happy');
        const bits = [`${score} point${score > 1 ? 's' : ''}`];
        if (gold) bits.push(`${gold} or`);
        if (res?.gain) bits.push(`+${res.gain} ${g.statLabel.toLowerCase()}`);
        app.say(`${res?.best ? 'Record battu ! ' : 'Trop bien ! '}${bits.join(' · ')}`, null, 5000);
      } },
        h('span', { class: `cs-game-ico stat-${g.stat}` }, icon(g.id === 'race' ? ICONS.wing : g.id === 'fire' ? ICONS.flame : g.id === 'memory' ? ICONS.album : ICONS.star, 24)),
        h('span', { class: 'grow' },
          h('strong', null, g.label),
          h('span', { class: 'small muted' }, g.desc),
          h('span', { class: 'cs-game-meta' },
            h('span', { class: 'chip-mini' }, `${g.statLabel} ${lv?.level ?? 1}`),
            best ? h('span', { class: 'chip-mini' }, `Record ${best}`) : null,
            already ? h('span', { class: 'chip-mini muted' }, 'Déjà joué aujourd’hui') : h('span', { class: 'chip-mini gold' }, 'Récompense du jour'))),
        h('span', { class: 'chev' }, '›'));
    })
  ]);
}

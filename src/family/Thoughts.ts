// Ce que le dragon « pense » : rappels des missions, besoins, encouragements.
// Les rappels passent mieux quand ils viennent de lui : il parle à la première personne, avec affection.
import type { ChildBook } from './ChildBook.js';
import { isNight, type Companion } from './Companion.js';
import { todayKey, type Mission } from './model.js';

export type ThoughtAction = 'missions' | 'feed' | 'wash' | 'pet' | 'sleep' | 'play' | null;
export interface Thought { id: string; text: string; action: ThoughtAction; priority: number }

const pick = <T>(list: T[]): T => list[Math.floor(Math.random() * list.length)];

/** Phrase du dragon pour une mission (selon son intitulé). */
export function missionLine(m: Mission, kind: 'now' | 'late' | 'soon', minutes = 0): string {
  const t = m.title.toLowerCase();
  const late = kind === 'late';
  if (/liti[eè]re|chat/.test(t)) return late ? 'Le chat m’a fait les gros yeux… sa litière n’est toujours pas faite !' : 'Le chat compte sur toi pour sa litière… et moi aussi !';
  if (/devoir|le[cç]on|r[ée]vis/.test(t)) return late ? 'Et tes devoirs ? Je garde la porte, personne ne te dérangera.' : 'C’est l’heure des devoirs. Je reste à côté de toi, promis.';
  if (/chambre|ranger|rangement/.test(t)) return late ? 'Ta chambre ressemble encore à ma grotte… on range ?' : 'Ta chambre a besoin d’un coup de griffe. On range ensemble ?';
  if (/sport|courir|v[ée]lo|danse|entra[iî]n/.test(t)) return 'Un peu de sport ? Les dragons aussi s’entraînent pour voler !';
  if (/sac|cartable/.test(t)) return 'Ton sac est prêt pour demain ? Je déteste quand on oublie des choses.';
  if (/vaisselle|table|cuisine/.test(t)) return late ? `Tu n’as pas oublié : ${m.title} ? Je te regarde…` : `${m.title} : un vrai dragon donne un coup de main !`;
  if (kind === 'soon') return `Dans ${minutes} min : ${m.title}. On le fait ensemble ?`;
  return late ? `Tu n’as pas oublié : ${m.title} ? C’était prévu à ${m.time}.` : `C’est le moment : ${m.title}. Je compte sur toi !`;
}

/** Liste des pensées possibles maintenant, de la plus importante à la moins importante. */
export function thoughts(book: ChildBook | null, c: Companion, childName: string): Thought[] {
  const out: Thought[] = [];
  const now = new Date();
  const mins = now.getHours() * 60 + now.getMinutes();
  const who = childName && childName !== 'Votre enfant' ? childName : '';
  const d = c.data;

  // 1. Missions en retard, puis à venir
  if (book) {
    const today = book.today();
    for (const { mission: m, status } of today) {
      if (status !== 'todo' && status !== 'refused' || !m.time) continue;
      const [hh, mm] = m.time.split(':').map(Number);
      const at = hh * 60 + mm;
      if (status === 'refused') out.push({ id: 'refused-' + m.id, text: `Tes parents veulent que tu reprennes « ${m.title} ». On y retourne ?`, action: 'missions', priority: 95 });
      else if (mins >= at) out.push({ id: 'late-' + m.id, text: missionLine(m, 'late'), action: 'missions', priority: 90 + Math.min(5, (mins - at) / 60) });
      else if (at - mins <= 60) out.push({ id: 'soon-' + m.id, text: missionLine(m, 'soon', at - mins), action: 'missions', priority: 70 });
    }
    const untimed = today.filter(t => (t.status === 'todo') && !t.mission.time);
    if (untimed.length && now.getHours() >= 17) out.push({ id: 'untimed', text: `Il reste « ${untimed[0].mission.title} » aujourd’hui. Tu t’en occupes ?`, action: 'missions', priority: 60 });
    const pending = today.filter(t => t.status === 'pending');
    if (pending.length) out.push({ id: 'pending', text: `J’attends que tes parents valident « ${pending[0].mission.title} »… je croise les griffes !`, action: null, priority: 30 });
    if (today.length && today.every(t => t.status === 'done')) {
      out.push({ id: 'alldone', text: pick([`Tout est fait ! Je suis fier de toi${who ? ', ' + who : ''}.`, 'Journée parfaite ! Je me sens plus fort grâce à toi.', 'Toutes les missions sont faites. On se fait un câlin ?']), action: null, priority: 40 });
    }
  }

  // 2. Santé et sanctions
  if (d.sick) out.push({ id: 'sick', text: 'Je suis malade… si tu fais toutes tes missions aujourd’hui, je guérirai.', action: 'missions', priority: 93 });
  const lp = book?.data.lastPenalty;
  if (lp && lp.date === todayKey()) {
    out.push({ id: 'penalty', text: `Tu as oublié ${lp.missed.slice(0, 2).join(' et ')}${lp.missed.length > 2 ? '…' : ''} J’ai perdu ${lp.xp} XP et ${lp.gold} or. On se rattrape aujourd’hui ?`, action: 'missions', priority: 94 });
  }
  if (book) {
    const cost = book.pendingCost();
    if (cost.count && now.getHours() >= 19) out.push({ id: 'evening', text: `Il reste ${cost.count} mission${cost.count > 1 ? 's' : ''}. Si on les oublie, demain je perds ${cost.xp} XP et ${cost.gold} or…`, action: 'missions', priority: 88 });
  }

  // 3. Besoins
  if (isNight() && !d.tucked) out.push({ id: 'night', text: 'Il est tard… tu me mets au lit ? Et toi aussi, va dormir !', action: 'sleep', priority: 80 });
  if (d.hunger < 25) out.push({ id: 'hungry', text: d.food.ration + d.food.meat + d.food.fish + d.food.fireFruit + d.food.treat > 0 ? 'J’ai tellement faim… tu as des rations pour moi ?' : 'J’ai faim… une mission validée, ça me ferait une ration !', action: 'feed', priority: 85 });
  else if (d.hunger < 50) out.push({ id: 'peckish', text: 'Mon ventre gargouille un peu…', action: 'feed', priority: 50 });
  if (d.clean < 25) out.push({ id: 'dirty', text: 'Mes écailles sont toutes ternes… tu me frottes ?', action: 'wash', priority: 75 });
  else if (d.clean < 50) out.push({ id: 'dusty', text: 'J’ai un peu de poussière sur le dos.', action: 'wash', priority: 45 });
  if (d.mood < 25) out.push({ id: 'lonely', text: 'Tu m’as manqué… tu restes un peu avec moi ?', action: 'pet', priority: 72 });

  // 3. Envies et petits mots
  if (!d.played && book && book.today().some(t => t.status === 'done')) out.push({ id: 'play', text: 'On joue à attraper les gemmes ? J’ai trop envie !', action: 'play', priority: 35 });
  const h = now.getHours();
  if (h >= 6 && h < 10) out.push({ id: 'morning', text: `Bonjour${who ? ' ' + who : ''} ! Bien dormi ? Moi j’ai rêvé de montagnes.`, action: null, priority: 20 });
  if (book && now.getDay() === 3 && h >= 12 && h < 18) out.push({ id: 'wednesday', text: 'Mercredi après-midi… on en profite pour avancer les missions ?', action: 'missions', priority: 22 });
  out.push(...[
    'Tu sais que les dragons n’oublient jamais un ami ?',
    'Un jour, je volerai assez haut pour toucher les nuages.',
    'J’aime bien quand tu passes me voir.',
    `${c.name === 'Ton dragon' ? 'Tu ne m’as pas encore donné de nom…' : `${c.name}… j’adore ce nom.`}`,
    'Gratte-moi derrière les cornes, s’il te plaît !',
    'Si tu fais tes missions, je deviendrai le plus grand dragon du royaume.'
  ].map((text, i) => ({ id: 'idle' + i, text, action: (i === 4 ? 'pet' : null) as ThoughtAction, priority: 10 }))
    .filter(t => book || !/missions/.test(t.text)));
  return out.sort((a, b) => b.priority - a.priority);
}

/** Réponses ponctuelles du dragon à une action. */
export const REACTIONS: Record<string, string[]> = {
  'thanks-food': ['Miam ! Merci !', 'Délicieux !', 'Ça fait du bien…'],
  yum: ['Wouah, quel régal !', 'Trop bon !!'],
  fav: ['C’est mon plat préféré !!', 'Mon préféré ! Tu me connais trop bien !'],
  tickle: ['Hihi ! Ça chatouille !', 'Arrête… hihihi !', 'Pas le ventre ! Hihi !'],
  tail: ['Ma queue ! Reviens ici !', 'Je vais l’attraper… presque !', 'Elle me suit partout, celle-là !'],
  purr: ['Rrrrrrr…', 'Encore… juste derrière les cornes…', 'Mmmh, c’est trop bien…'],
  dizzy: ['Oh là là… tout tourne…', 'Hé ! Doucement !'],
  shakeAwake: ['Hein ? Quoi ? Un tremblement de terre ?!', 'Grmbl… qui me secoue ?'],
  morning: ['Bonjour ! Quelle lumière…', 'Mmmh… déjà le matin ?'],
  blanket: ['Qu’elle est douce… bonne nuit.', 'Merci pour la couverture… à demain.'],
  blow: ['Woooosh ! Tu as vu ces flammes ?!', 'On a soufflé ensemble !'],
  full: ['Je n’ai plus faim, merci !', 'Mon ventre est plein comme une outre.'],
  clean: ['Je brille comme un trésor !', 'Tout propre ! Merci !'],
  bond: ['Tu es mon meilleur ami.', 'Je crois que je t’aime bien… beaucoup.'],
  pet: ['Rrrrr…', 'Encore !', 'Juste là, oui…'],
  wake: ['Mmh… encore cinq minutes…', 'Quoi ? Il fait encore nuit…'],
  tuck: ['Bonne nuit… à demain.', 'Tu me raconteras une histoire demain ?'],
  welcome: ['Te revoilà ! Tu m’as tellement manqué !', 'Enfin ! Je t’attendais !'],
  locked: ['Je ne sais pas encore faire ça… soyons encore plus amis !'],
  cured: ['Je suis guéri ! Merci, tu es génial.', 'Je revis ! Merci pour cette journée parfaite.']
};
export const sayFor = (key: string): string => pick(REACTIONS[key] ?? [key]);

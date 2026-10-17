// Mémoire du dragon : il retient ce que l'enfant lui annonce (« demain j'ai un contrôle de maths »,
// « samedi c'est l'anniversaire de Léa ») et, le jour venu, il encourage le matin puis demande comment ça s'est passé.
// Tout reste sur le téléphone (avec le reste de la conversation), rien n'est envoyé.
import type { IntentDef } from './DialogueData.js';

export interface MemEvent {
  id: string;
  /** Ce qui va se passer, déjà tourné vers l'enfant (« ton contrôle de maths », « l’anniversaire de Léa »). */
  what: string;
  /** j'ai / je fais (comment ça s'est passé) ; je vais / c'est (c'était bien). */
  kind: 'have' | 'go';
  /** Jour de l'événement « AAAA-MM-JJ ». */
  day: string;
  /** Le soir même (« ce soir ») : on ne redemande qu'après. */
  evening: boolean;
  /** Événement qui fait un peu peur (contrôle, dentiste…) : il encourage plutôt qu'il ne s'enthousiasme. */
  brave: boolean;
  cheered: boolean;
  asked: boolean;
}

const DAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MONTHS = ['janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin', 'juillet', 'aout', 'septembre', 'octobre', 'novembre', 'decembre'];
const BRAVE = /(contr[oô]le|examen|[ée]valuation|interro|dict[ée]e|brevet|dentiste|m[ée]decin|docteur|piq[uû]re|vaccin|op[ée]ration|h[oô]pital|prise de sang|rentr[ée]e|comp[ée]tition|match|tournoi|spectacle|audition|expos[ée]|oral|r[ée]cit|po[ée]sie|permis|entretien|course|concours)/;
/** « J'ai faim », « j'ai peur » : des sensations, pas des événements. */
const FEELINGS = /^(faim|soif|peur|mal|froid|chaud|sommeil|envie|besoin|h[aâ]te|marre|honte|raison|tort|fini|pas)\b/i;
/** Annonces trop banales pour en reparler. */
const TRIVIAL = /^(dormir|me coucher|manger|me laver|prendre (ma|une) douche|faire (mes|les) devoirs|à l[’'] ?[ée]cole|a l[’'] ?ecole|au coll[eè]ge|en cours|en classe|travailler)$/;

const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const addDays = (d: Date, n: number) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() + n); return x; };
const strip = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const pick = <T>(l: T[]): T => l[Math.floor(Math.random() * l.length)];

/** Moi → toi dans ce que l'enfant raconte (« mon copain » → « ton copain »). */
function toYou(s: string): string {
  // limites de mot qui tiennent compte des accents (« cinéma » ne contient pas le mot « ma »)
  const w = (x: string) => new RegExp(`(?<![\\p{L}])${x}(?![\\p{L}])`, 'giu');
  return s.replace(w('mon'), 'ton').replace(w('ma'), 'ta').replace(w('mes'), 'tes').replace(w('notre'), 'votre').replace(w('nos'), 'vos')
    .replace(/(?<![\p{L}])m[’']/giu, 't’').replace(w('moi'), 'toi');
}

/** « un contrôle » → « ton contrôle » ; « une évaluation » → « ton évaluation » ; « une sortie » → « ta sortie ». */
function possessive(article: string, rest: string): string {
  const vowel = /^[aeiouyhàâéèêëîïôûœ]/i.test(rest);
  switch (article) {
    case 'un': return 'ton ' + rest;
    case 'une': return (vowel ? 'ton ' : 'ta ') + rest;
    case 'des': case 'les': case 'mes': return 'tes ' + rest;
    case 'mon': return 'ton ' + rest;
    case 'ma': return (vowel ? 'ton ' : 'ta ') + rest;
    case 'notre': return 'votre ' + rest;
    case 'nos': return 'vos ' + rest;
    case 'le': return 'le ' + rest;
    case 'la': return 'la ' + rest;
    default: return 'l’' + rest; // l'
  }
}

/** Quand ? Renvoie le jour, le mot dit et la phrase sans ce mot ; null s'il n'y a pas de date. */
function when(p: string, now: Date): { day: Date; said: string; rest: string; evening: boolean } | null {
  const s = strip(p);
  const cut = (re: RegExp) => { const m = s.match(re); return m ? { said: p.slice(m.index!, m.index! + m[0].length).trim(), rest: (p.slice(0, m.index!) + ' ' + p.slice(m.index! + m[0].length)).replace(/\s+/g, ' ').trim() } : null; };
  let c;
  if ((c = cut(/\b(ce soir|cette nuit)\b/))) return { day: now, ...c, evening: true };
  if ((c = cut(/\b(aujourd ?hui|ce matin|cet apres[- ]?midi|cet aprem|tout a l heure|tout a l'heure)\b/))) return { day: now, ...c, evening: false };
  if ((c = cut(/\bapres[- ]demain\b/))) return { day: addDays(now, 2), ...c, evening: false };
  if ((c = cut(/\bdemain( matin| soir| apres[- ]?midi)?\b/))) return { day: addDays(now, 1), ...c, evening: /soir/.test(c.said) };
  if ((c = cut(/\bce week[- ]?end\b/))) { const d = now.getDay(); return { day: addDays(now, d === 6 || d === 0 ? 0 : 6 - d), ...c, evening: false }; }
  if ((c = cut(/\bla semaine prochaine\b/))) return { day: addDays(now, 7), ...c, evening: false };
  const wd = s.match(/\b(ce |cette )?(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)( prochain| matin| soir| apres[- ]?midi)?\b/);
  if (wd && (c = cut(new RegExp(wd[0].replace(/[- ]/g, '[- ]?'))))) {
    const target = DAYS.indexOf(wd[2]);
    let n = (target - now.getDay() + 7) % 7;
    if (n === 0) n = 7; // « samedi » dit un samedi : le prochain
    return { day: addDays(now, n), ...c, evening: / soir/.test(wd[0]) };
  }
  const dm = s.match(/\ble (\d{1,2})(?:er)?(?: (janvier|fevrier|mars|avril|mai|juin|juillet|aout|septembre|octobre|novembre|decembre))?\b/);
  if (dm && (c = cut(new RegExp(dm[0])))) {
    const dayN = Number(dm[1]);
    if (dayN < 1 || dayN > 31) return null;
    let month = dm[2] ? MONTHS.indexOf(dm[2]) : now.getMonth();
    let year = now.getFullYear();
    let d = new Date(year, month, dayN);
    if (d < new Date(now.getFullYear(), now.getMonth(), now.getDate())) { if (dm[2]) year++; else month++; d = new Date(year, month, dayN); }
    if ((d.getTime() - now.getTime()) / 86400000 > 60) return null; // trop loin pour s'en souvenir utilement
    return { day: d, ...c, evening: false };
  }
  return null;
}

/** Ce qui se passera (« j'ai un contrôle de maths » → « ton contrôle de maths »). */
function what(rest: string): { what: string; kind: MemEvent['kind'] } | null {
  // la casse est gardée (« Léa ») ; les tournures sont reconnues sans tenir compte des majuscules
  const r = rest.replace(/[’']/g, '’').replace(/[!?.…,;]+/g, ' ').replace(/\s+/g, ' ').trim()
    .replace(/^(et |mais |alors |bon |tu sais |dis |eh |hey )+/i, '');
  let m: RegExpMatchArray | null;
  // article suivi d'un espace (sauf l’) : « une évaluation » ne se lit pas « un » + « e évaluation »
  if ((m = r.match(/^(?:j’ai|j ai|on a|nous avons|je passe|on passe|je fais|on fait) (?:(un|une|le|la|les|des|mon|ma|mes|notre|nos) |(l’))(.+)$/i))) return { what: possessive((m[1] ?? 'l').toLowerCase(), toYou(m[3])), kind: 'have' };
  // « j'ai piscine », « on a judo » : une activité sans article (mais pas « j'ai faim », « j'ai peur »…)
  if ((m = r.match(/^(?:j’ai|j ai|on a) ([\p{L}][\p{L} -]{1,24})$/iu)) && !FEELINGS.test(m[1])) return { what: m[1], kind: 'have' };
  if ((m = r.match(/^il y a (?:(un|une|le|la|les|des) |(l’))(.+)$/i))) {
    const a = (m[1] ?? 'l’').toLowerCase(), x = m[3];
    const vowel = /^[aeiouyhàâéèêëîïôûœ]/i.test(x);
    const art = a === 'un' ? (vowel ? 'l’' : 'le ') : a === 'une' ? (vowel ? 'l’' : 'la ') : a === 'des' ? 'les ' : a === 'l’' ? 'l’' : a + ' ';
    return { what: art + toYou(x), kind: 'have' };
  }
  if ((m = r.match(/^(?:je vais|je pars|on va|on part|nous allons|je dois aller|on doit aller|je serai|on sera) (.+)$/i))) {
    const x = toYou(m[1]);
    if (TRIVIAL.test(m[1].toLowerCase())) return null;
    return { what: x, kind: 'go' };
  }
  if ((m = r.match(/^(?:c’est|c est|ce sera|ça sera|ca sera) (.+)$/i))) return { what: toYou(m[1]), kind: 'go' };
  return null;
}

/** Repère une annonce datée dans ce que l'enfant dit ; « said » = le mot de date entendu (demain, samedi…). */
export function captureEvent(phrase: string, now: Date): { event: MemEvent; said: string } | null {
  if (!phrase || /\?\s*$/.test(phrase)) return null; // une question n'est pas une annonce
  const w = when(phrase, now);
  if (!w) return null;
  const x = what(w.rest);
  if (!x || x.what.length < 3 || x.what.length > 48 || TRIVIAL.test(x.what.toLowerCase())) return null;
  const event: MemEvent = {
    id: Math.random().toString(36).slice(2, 9), what: x.what, kind: x.kind, day: key(w.day), evening: w.evening,
    // annoncé le jour même : pas besoin de l'encourager une seconde fois le matin
    brave: BRAVE.test(x.what), cheered: key(w.day) === key(now), asked: false
  };
  return { event, said: w.said.toLowerCase() };
}

/** Sa réponse quand l'enfant lui annonce quelque chose (« when » = le mot qu'il a dit : demain, samedi…). */
export function noteReply(e: MemEvent, saidWhen: string): string {
  const W = cap(e.what);
  if (e.brave) return pick([
    `${W} ${saidWhen} ? C’est noté dans ma tête de dragon. Tu vas assurer, j’en suis sûr ! Tu me raconteras ?`,
    `Oh, ${e.what} ${saidWhen}… Je croise les griffes pour toi. Et tu me diras comment ça s’est passé, promis ?`,
    `Je m’en souviendrai ! ${W} ${saidWhen} : respire bien, fais de ton mieux, et c’est déjà gagné.`]);
  return pick([
    `${W} ${saidWhen} ? Trop bien ! Je m’en souviendrai, et tu me raconteras tout.`,
    `Oh, ${e.what} ${saidWhen} ! Ça a l’air génial. C’est noté dans ma tête de dragon.`,
    `Youpi, ${e.what} ${saidWhen} ! J’ai hâte que tu me racontes.`]);
}

/** Ce qu'il dit le jour venu : encouragement le matin, question ensuite. null s'il n'a rien à rappeler. */
export function dueLine(events: MemEvent[], now: Date): { text: string; event: MemEvent; ask: boolean } | null {
  const today = key(now), h = now.getHours();
  const ago = (e: MemEvent) => Math.round((new Date(today).getTime() - new Date(e.day).getTime()) / 86400000);
  for (const e of events) {
    if (e.asked) continue;
    const d = ago(e);
    const time = d >= 1 || (d === 0 && h >= (e.evening ? 21 : 16));
    if (time && d <= 3) {
      const yesterday = d === 1 ? 'hier' : d > 1 ? 'l’autre jour' : 'aujourd’hui';
      const text = e.kind === 'go'
        ? pick([`Alors, ${e.what}, ${yesterday}, c’était bien ? Raconte-moi !`, d === 0 ? `J’y ai pensé toute la journée : ${e.what}, alors, c’était comment ?` : `Je n’ai pas oublié : ${e.what}, ${yesterday}. C’était comment ?`])
        : pick([`Alors, ${e.what}, ça s’est passé comment ?`, `Je n’ai pas oublié : ${e.what}, ${yesterday}… Alors, raconte !`]);
      return { text, event: e, ask: true };
    }
    if (d === 0 && !e.cheered && h < 13) {
      const text = e.brave
        ? pick([`C’est aujourd’hui, ${e.what} ! Tu vas assurer. Je croise les griffes.`, `Grand jour : ${e.what} ! Respire, fais de ton mieux. Je suis fier de toi d’avance.`])
        : pick([`C’est aujourd’hui, ${e.what} ! Amuse-toi bien !`, `Youpi, c’est le jour : ${e.what} ! Tu me raconteras ?`]);
      return { text, event: e, ask: false };
    }
  }
  return null;
}

/** Garde les annonces utiles : pas plus de 12, rien de plus vieux que 4 jours. */
export function prune(events: MemEvent[], now: Date): MemEvent[] {
  const today = new Date(key(now)).getTime();
  return events.filter(e => (today - new Date(e.day).getTime()) / 86400000 <= 4).slice(0, 12);
}

/** Réponses quand il vient de demander comment ça s'est passé (contexte « souvenir »). */
export const MEMORY_INTENTS: IntentDef[] = [
  { id: 'souvenir_bien', ctx: 'souvenir', k: ['bien', 'tres bien', 'trop bien', 'super', 'super bien', 'genial', 'cool', 'top', 'parfait', 'excellent', 'pas mal', 'reussi', 'j ai reussi', 'on a gagne', 'j ai gagne', 'c etait bien', 'c etait super', 'c etait trop bien', 'ca s est bien passe', 'ca s est tres bien passe', 'j ai eu une bonne note', 'j ai eu 20', 'oui'],
    r: ['Youpi ! Ça me fait trop plaisir pour toi !', 'Trop bien ! Mes écailles brillent de joie. Raconte-moi le meilleur moment ! {ask:raconte_libre}', 'Génial ! Je suis super content pour toi. C’était quoi, le plus chouette ? {ask:raconte_libre}'], anim: 'cheer', fx: 'confetti' },
  { id: 'souvenir_mal', ctx: 'souvenir', k: ['mal', 'pas bien', 'pas tres bien', 'pas trop', 'nul', 'c etait nul', 'rate', 'j ai rate', 'bof', 'pas terrible', 'ca s est mal passe', 'on a perdu', 'j ai perdu', 'horrible', 'une mauvaise note', 'non'],
    r: ['Oh… viens contre moi. Ce n’est qu’un moment, il ne dit pas qui tu es. Tu veux m’expliquer ? {ask:raconte}', 'Ça arrive, même aux dragons. Le plus important, c’est que tu as essayé. Tu veux en parler ? {ask:raconte}', 'Je suis là. La prochaine fois sera meilleure, et je serai encore là pour toi. Tu me racontes ? {ask:raconte}'], anim: 'pet' },
  { id: 'souvenir_autre', ctx: 'souvenir', k: ['*'],
    r: ['Merci de m’avoir raconté ! J’adore savoir ce qui se passe dans ta vie.', 'Ah oui ? Je suis content que tu me le dises. Tu es vraiment quelqu’un de bien, tu sais.', 'Je retiens tout ça dans ma tête de dragon. Merci de me raconter !'], anim: 'happy' }
];

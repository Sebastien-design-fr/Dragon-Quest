// Compréhension souple : tournures de phrases fréquentes (« tu aimes X ? », « je suis X », « on va X »…)
// avec reprise des mots de la personne dans la réponse, et correspondance approchée par mots.
import type { TalkCtx } from './Dialogue.js';

/** Minuscules, apostrophes et ponctuation en espaces, accents gardés (pour pouvoir répéter les mots). */
export const soft = (s: string) => ' ' + s.toLowerCase().replace(/[’'`´]/g, ' ').replace(/[^a-zà-öø-ÿœæç0-9 -]+/g, ' ').replace(/-/g, ' ').replace(/\s+/g, ' ').trim() + ' ';
const strip = (s: string) => s.replace(/œ/g, 'oe').replace(/æ/g, 'ae').normalize('NFD').replace(/[̀-ͯ]/g, '');
const pick = <T>(l: T[]): T => l[Math.floor(Math.random() * l.length)];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Je ↔ tu dans les mots repris (« ma prof » → « ta prof »). */
const SWAP: Record<string, string> = {
  je: 'tu', j: 'tu', me: 'te', m: 't', moi: 'toi', mon: 'ton', ma: 'ta', mes: 'tes', mien: 'tien', mienne: 'tienne',
  tu: 'je', t: 'je', te: 'me', toi: 'moi', ton: 'mon', ta: 'ma', tes: 'mes', tien: 'mien', tienne: 'mienne', suis: 'es', es: 'suis', ai: 'as', as: 'ai', vais: 'vas', vas: 'vais'
};
export const swap = (x: string) => x.trim().split(' ').map(w => SWAP[w] ?? w).join(' ').replace(/\bde le\b/g, 'du').replace(/\bà le\b/g, 'au').replace(/\bde les\b/g, 'des').replace(/\bà les\b/g, 'aux');

/** Petits mots qui ne veulent rien dire seuls. */
const STOP = new Set(('a au aux avec ce ces cet cette c ça ca d dans de des du elle en est et eu il ils j je l la le les leur lui m ma mais me mes moi mon n ne ni nous on ou où par pas pour qu que quel quelle quels qui s sa se ses si son sur t ta te tes toi ton tu un une vos votre vous y '
  + 'suis es sont ai as avons avez ont fait fais faire être etre avoir va vas vais veux veut peux peut sais sait quoi comment pourquoi quand combien bien très tres trop plus moins tout tous toute toutes aussi encore déjà deja alors donc oui non ok là la ici ah oh eh bon ben bah hein dis')
  .split(' ').map(strip));
/** Mots porteurs de sens, sans accents, réduits à leur racine (6 lettres au plus). */
export const contentWords = (s: string) => strip(soft(s)).trim().split(' ').filter(w => w.length > 2 && !STOP.has(w)).map(w => w.length > 6 ? w.slice(0, 6) : w.replace(/(es|s|e|x)$/, ''));

// ---------------- Goûts du dragon ----------------
const LOVES = /(poisson|feu|flamme|chocolat|gâteau|gateau|crêpe|crepe|fraise|pizza|câlin|calin|histoire|soleil|nuit|étoile|etoile|loup|toi|jeu|jouer|voler|vol|dormir|sieste|or|gemme|cristal|musique|danse|danser|fête|fete|noël|noel|cadeau|bonbon|glace|été|ete|pomme|viande|grill|pain|frite|burger|fromage|lait|miel|livre|film|dessin|neige|montagne|volcan|mer|chat|chien|anniversaire|vacances|week end|moto|vitesse)/;
const HATES = /(eau froide|aspirateur|araignée|araignee|guêpe|guepe|épinard|epinard|lundi|réveil|reveil|orage|bain froid|légume|legume|brocoli|chou|devoirs|contrôle|controle|pluie|ménage|menage|chevalier)/;

/** Sa chose préférée par catégorie. */
const FAVS: Array<[RegExp, string]> = [
  [/film|dessin animé|dessin anime/, 'Un film avec des dragons, évidemment ! Plus il y a de feu, mieux c’est.'],
  [/série|serie/, 'Une série où un dragon est le héros. Il n’y en a pas assez, à mon avis.'],
  [/jeu/, 'La pêche au lac avec le loup ! Et la course dans les nuages, quand je gagne.'],
  [/musique|chanson|chanteur|chanteuse|groupe/, 'Tout ce qui fait boum boum : je danse en rythme avec ma queue.'],
  [/animal|bête|bete/, 'Le loup, bien sûr. Et le poisson… mais pour d’autres raisons.'],
  [/saison/, 'L’hiver : mon feu sert de chauffage à toute la famille, je me sens utile.'],
  [/jour/, 'Le samedi : pas d’école, plein de câlins.'],
  [/chiffre|nombre/, 'Le 7 : sept écailles sur mon front, sept battements d’ailes pour décoller.'],
  [/dessert|gâteau|gateau|sucrerie|bonbon/, 'Le gâteau au chocolat. Bien cuit. Très bien cuit. Carbonisé, même.'],
  [/plat|repas|nourriture|manger/, 'Le poisson grillé. Grillé par moi, évidemment.'],
  [/couleur/, 'Le rouge braise. Et le doré.'],
  [/sport/, 'Le vol acrobatique ! Mais la course, c’est bien aussi.'],
  [/livre|histoire|bd/, 'La légende de la Pierre de Braise. Tu veux que je te la raconte ?'],
  [/fleur/, 'La fleur de feu : elle pousse au bord des volcans. Les marguerites, c’est joli aussi.'],
  [/endroit|lieu|pays|ville/, 'Ma grotte, avec toi dedans. Et l’île aux cristaux, que le loup m’a racontée.'],
  [/matière|matiere|cours/, 'L’histoire ! Il y a plein de dragons dans les vieilles légendes.'],
  [/boisson/, 'Le chocolat chaud. Brûlant.'],
  [/personne|humain/, 'Toi. C’est pas une question piège, j’espère ?'],
  [/moment/, 'Quand tu m’ouvres le matin et que tu me dis bonjour.'],
  [/fruit/, 'La fraise ! Et le fruit de feu, très rare.'],
  [/légume|legume/, 'Hmm… aucun. Les dragons ne sont pas trop légumes. Bon, la carotte grillée, à la limite.']
];

const POS_ADJ = /(content|contente|heureux|heureuse|bien|en forme|ravie|ravi|fière|fier|de bonne humeur|joyeuse|joyeux|super|excitée|excité|impatiente|amoureuse|amoureux|détendue|détendu|reposée|reposé|motivée|motivé|zen|calme|prête|prêt|en vacances)/;
const NEG_ADJ = /(triste|mal|fatiguée|fatigué|énervée|énervé|en colère|déçue|déçu|stressée|stressé|nulle|nul|perdue|perdu|seule|seul|malade|crevée|crevé|vexée|vexé|jalouse|jaloux|inquiète|inquiet|de mauvaise humeur|ennuyée|dégoûtée|dégoûté|furieuse|furieux|découragée|découragé|blessée|blessé|en retard|pressée|pressé|débordée|débordé|occupée|occupé)/;
const POS_YOU = /(beau|belle|mignon|mignonne|chou|gentil|gentille|drôle|drole|fort|forte|intelligent|intelligente|génial|géniale|genial|cool|magnifique|adorable|marrant|marrante|rigolo|rigolote|le meilleur|la meilleure|grand|grande|rapide|courageux|courageuse|sage|doux|douce|parfait|parfaite|unique|incroyable|trop bien|trop fort|trop forte|super)/;
const NEG_YOU = /(bête|bete|méchant|méchante|mechant|nul|nulle|moche|lent|lente|grognon|ronchon|pénible|penible|bizarre|idiot|idiote|lourd|lourde|gros|grosse|paresseux|paresseuse|feignant|fainéant)/;

/** Tournures assez nettes pour passer devant un mot-clé isolé (« tu aimes nager ? » n'est pas une question sur le sport). */
export function priorityPattern(phrase: string): boolean {
  const p = soft(phrase).replace(/^ (dis|dis moi|eh|hé|hey|alors|bon|ben|et|mais|oh|ah|euh|bah) /, ' ');
  return /^ est ce que tu /.test(p) || /^ (est ce que )?(tu aimes|t aimes|tu adores|tu kiffes|tu sais|tu connais|tu préfères|tu aimerais|tu as déjà|t as déjà|tu crois) /.test(p) || /(préféré|préférée|prefere|preferee|favori)/.test(p)
    || /^ (je suis|je me sens|je vais|on va|je pars|on part|j aime|j adore|je déteste|je deteste|j aime pas|je n aime pas|j ai horreur) /.test(p);
}

/** Élisions et contractions après reprise des mots (« de les » → « des », « l école » → « l’école »). */
export const fr = (t: string) => t.replace(/\bde le\b/g, 'du').replace(/\bde les\b/g, 'des').replace(/\bà le\b/g, 'au').replace(/\bà les\b/g, 'aux')
  .replace(/\b([ldjmtsnc]|qu) (?=[aeiouyhéèêëàâîïôûœ])/gi, '$1’').replace(/\bpas de (le|la|les|l’|un|une|des|du) /g, 'pas de ').replace(/\bpas de ([aeiouyhéèêàâîôû])/g, 'pas d’$1');

export interface PatternReply { text: string; anim?: string; fx?: string; ask?: string; like?: string; dislike?: string; then?: 'games' | 'feed' | 'wash' | 'end' | 'sleep' | 'voyage' }

/** Essaie de comprendre la tournure de la phrase. Renvoie null si aucune ne colle. */
export function patternReply(phrase: string, c: TalkCtx): PatternReply | null {
  const r = rawPattern(phrase, c);
  return r ? { ...r, text: recase(fr(r.text), phrase) } : null;
}

/** Remet les majuscules des noms propres dits par la personne (« taylor swift » → « Taylor Swift »). */
function recase(t: string, original: string): string {
  const caps = original.match(/\b[A-ZÀ-Ý][a-zà-ÿ]+/g) ?? [];
  for (const w of caps) {
    if (original.indexOf(w) === 0) continue; // premier mot de la phrase : majuscule de début, pas un nom
    t = t.replace(new RegExp('\\b' + w.toLowerCase() + '\\b', 'g'), w);
  }
  return t;
}

function rawPattern(phrase: string, c: TalkCtx): PatternReply | null {
  let p = soft(phrase);
  const nm = soft(c.dragon).trim();
  if (nm) p = p.split(' ' + nm + ' ').join(' ');
  for (const v of ['mon petit dragon', 'ma petite dragonne', 'mon dragon', 'ma dragonne', 'mon chéri', 'ma chérie', 'mon bébé', 'mon cœur', 'ma puce', 'mon amour', 'mon trésor', 'mon pote', 'mon doudou']) { const q = p.split(' ' + v + ' ').join(' '); if (q.trim()) p = q; }
  p = ' ' + p.replace(/^ (dis|dis moi|eh|hé|hey|alors|bon|ben|et|mais|oh|ah|euh|bah) /, ' ').trim() + ' ';
  const parent = c.role === 'parent';
  let m: RegExpMatchArray | null;

  // « quel est ton X préféré », « c'est quoi ta X préférée »
  if ((m = p.match(/ (?:quel|quelle|quels|quelles|c est quoi|qu est ce qui est) (?:est |sont )?(?:ton|ta|tes) (.+?) (?:préféré|préférée|préférés|préférées|prefere|preferee|favori|favorite)/)) || (m = p.match(/ (?:ton|ta) (.+?) (?:préféré|préférée|prefere|preferee) /))) {
    const what = m[1];
    const f = FAVS.find(([re]) => re.test(what));
    if (f) return { text: f[1], ask: 'raconte_libre' };
    return { text: `Mon ${what} préféré ? Hmm… je réfléchis encore. Et toi, c’est quoi le tien ?`, ask: 'raconte_libre' };
  }
  // « tu crois que je suis jolie ? », « tu me trouves belle ? »
  if ((m = p.match(/ (?:tu crois que je suis|tu trouves que je suis|tu penses que je suis|tu me trouves|je suis) (?:trop |très |vraiment |un peu |assez )?(jolie|belle|beau|joli|moche|laide|laid|grosse|gros|nulle|nul|bête|idiote|idiot|intelligente|intelligent|drôle|gentille|gentil|bizarre|méchante|méchant|mignonne|mignon) /))) {
    const adj = m[1];
    if (/(moche|laide|laid|grosse|gros|nulle|nul|bête|idiote|idiot|bizarre|méchante|méchant)/.test(adj)) return { text: pick([`${cap(adj)} ? Pas du tout ! Pour moi, tu es unique, et j’ai l’œil, je suis un dragon.`, `Je ne suis pas d’accord du tout. Tu es géniale comme tu es. Parfois on se voit plus sévèrement que les autres nous voient.`, `Non ! Et si quelqu’un t’a dit ça, il a tort. Tu es formidable.`]), anim: 'pet', ask: 'raconte' };
    return { text: pick([`Évidemment ! Tu es ${adj}, et pas qu’un peu.`, `${cap(adj)} ? Bien sûr ! Et en plus, tu as un dragon. La classe totale.`, `Oui ! Mais surtout, tu es gentille avec moi, et ça, c’est le plus beau.`]), anim: 'happy' };
  }
  // « tu penses quoi de X », « qu'est-ce que tu penses de X »
  if ((m = p.match(/ (?:qu est ce que tu penses|tu penses quoi|t en penses quoi|tu en penses quoi|que penses tu|ton avis sur|tu trouves comment) (?:de |d |du |des )?(.+) $/))) {
    const x = swap(m[1]);
    if (HATES.test(x)) return { text: `${cap(x)} ? Hmm… pas trop mon truc. Mais si toi tu aimes, je respecte !`, ask: 'raconte_libre' };
    if (LOVES.test(x)) return { text: `${cap(x)} ? J’adore ! Vraiment, c’est génial.`, ask: 'raconte_libre' };
    return { text: pick([`${cap(x)} ? Je trouve ça plutôt bien ! Et toi, tu en penses quoi ?`, `Hmm, ${x}… je n’ai pas d’avis tranché. Le tien m’intéresse plus !`]), ask: 'raconte_libre' };
  }
  // « tu aimes X ? »
  if ((m = p.match(/ (?:est ce que )?(?:tu aimes|t aimes|tu adores|tu kiffes|tu aimes bien|tu préfères|tu aimerais) (.+) $/))) {
    const x = swap(m[1]);
    if (/ ou /.test(' ' + x + ' ')) {
      const [a, b] = x.split(/ ou /);
      const choice = LOVES.test(b) && !LOVES.test(a) ? b : LOVES.test(a) && !LOVES.test(b) ? a : pick([a, b]);
      return { text: pick([`Hmm… ${choice} ! Enfin… les deux. Non, ${choice}. Et toi ?`, `${cap(choice)}, sans hésiter ! Et toi, tu préfères quoi ?`, `C’est dur… ${a}, ${b}… Je dirais ${choice} !`]), ask: 'raconte_libre' };
    }
    if (/^(moi|bien moi)$/.test(x.trim())) return { text: 'Bien sûr que je t’aime ! Plus que tous les poissons du monde.', anim: 'purr', fx: 'hearts' };
    if (/^(danser|nager|courir|lire|dessiner|chanter|voler|jouer|dormir|manger|cuisiner|voyager)/.test(x)) {
      const verb = x.split(' ')[0];
      return { text: pick([`${cap(verb)} ? Oh oui ! Enfin, à ma façon de dragon.`, `J’adore ${x} ! Surtout avec toi.`, `${cap(x)} ? Je ne suis pas très doué, mais j’aime bien essayer.`]) };
    }
    if (HATES.test(x)) return { text: pick([`${cap(x)} ? Beurk, pas trop… Mais ne le dis à personne.`, `Hmm, ${x}… Ce n’est pas mon truc. Et toi, tu aimes ?`]), ask: 'raconte_libre' };
    if (LOVES.test(x)) return { text: pick([`${cap(x)} ? J’adore ! Comment tu as deviné ?`, `Oh oui, ${x}, c’est génial ! Et toi ?`, `${cap(x)}… rien que d’y penser, mes écailles brillent !`]), ask: 'raconte_libre' };
    return { text: pick([`${cap(x)} ? Je ne sais pas trop, je n’ai jamais essayé. Tu aimes, toi ?`, `Hmm, ${x}… Je crois que oui ! Raconte-moi ce que tu aimes là-dedans.`, `${cap(x)} ? Si toi tu aimes, alors moi aussi, sûrement.`]), ask: 'raconte_libre' };
  }
  // « tu veux faire quoi », « qu'est-ce que tu veux faire »
  if (/ (tu veux faire|tu voudrais faire|t as envie de faire|tu as envie de faire|tu aimerais faire|on fait quoi|qu est ce qu on fait|tu veux qu on fasse|envie de quoi|tu as envie de quoi|t as envie de quoi|tu veux quoi|qu est ce que tu veux) /.test(p)) return null; // traité par le sujet « envie »
  // « tu veux X ? »
  if ((m = p.match(/ (?:est ce que )?(?:tu veux|tu voudrais|t veux|ça te dit|ca te dit) (?:de |d )?(.+) $/))) {
    const x = swap(m[1]);
    if (/(manger|poisson|viande|friandise|ration|goûter|gouter|repas|bonbon|gâteau|gateau|chocolat|crêpe|crepe)/.test(x)) return { text: c.hunger < 85 ? pick([`Oh oui ! ${cap(x)}, miam !`, `${cap(x)} ? Je ne dis jamais non !`]) : `Merci, mais je suis plein comme un œuf. Plus tard ?`, then: c.hunger < 85 ? 'feed' : undefined };
    if (/(jouer|jeu|partie|pêche|peche|course|cache)/.test(x)) return { text: pick(['Oh oui ! On joue !', 'Avec plaisir ! Choisis un jeu.']), then: 'games', anim: 'happy' };
    if (/(dormir|sieste|dodo|te coucher)/.test(x)) return { text: new Date().getHours() >= 20 ? 'Oui… je commence à avoir les paupières lourdes.' : 'Pas maintenant, je suis en pleine forme ! Plus tard, peut-être.' };
    if (/(bain|douche|laver)/.test(x)) return { text: c.clean < 60 ? 'Oui, je veux bien un bain ! Frotte bien derrière les ailes.' : 'Je suis déjà tout propre… mais un petit bain, pourquoi pas !', then: 'wash' };
    if (/(câlin|calin|bisou)/.test(x)) return { text: 'Oh oui ! Un câlin de dragon, tout chaud.', anim: 'purr', fx: 'hearts' };
    if (/(sortir|promener|balade|dehors|promenade)/.test(x)) return { text: pick(['Une balade ? Je ne peux pas sortir du téléphone… mais emmène-moi dans ta poche ! Tes pas me font gagner de l’or.', 'Oh oui ! Marche, et je compte tes pas pour gagner de l’or.']) };
    if (/(histoire|conte|légende|legende)/.test(x)) return null;
    return { text: pick([`${cap(x)} ? Oh oui, avec plaisir !`, `${cap(x)}… pourquoi pas ! Tu me montres ?`, `Si c’est avec toi, ${x}, je veux bien.`]) };
  }
  // « tu sais / tu connais X »
  if ((m = p.match(/ (?:est ce que )?(?:tu sais|tu savais|t sais|tu connais|t connais|tu as entendu parler de|tu as déjà entendu parler de) (.+) $/))) {
    const x = swap(m[1]);
    if (/^(nager|lire|compter|écrire|ecrire|parler|danser|chanter|cuisiner|faire du vélo|faire du velo|siffler|dessiner)/.test(x)) {
      const v = x.split(' ')[0];
      return { text: pick([`${cap(v)} ? Je m’entraîne ! Les dragons apprennent vite.`, `Un peu ! ${cap(x)}, c’est pas facile avec des griffes, mais j’y arrive.`, `${cap(x)} ? Pas encore très bien. Tu m’apprends ?`]) };
    }
    if (/^(que|qu|ce que|pourquoi|quoi|comment|où|ou) /.test(x)) return { text: pick(['Non, quoi ? Dis-moi vite !', 'Hmm… non ! Raconte !']), ask: 'raconte_libre' };
    return { text: pick([`${cap(x)} ? J’en ai entendu parler… mais raconte-moi, toi !`, `Je ne connais pas bien ${x}. Tu m’expliques ?`, `Un peu ! Mais je suis sûr que tu en sais plus que moi.`]), ask: 'raconte_libre' };
  }
  // « est-ce que tu X », « tu as déjà X »
  if ((m = p.match(/ (?:est ce que tu|est ce que t|tu as déjà|t as déjà|tu es déjà|tu crois (?:aux|au|à la|à l|que)) (.+) $/))) {
    if (/ crois /.test(p)) return { text: pick([`Bien sûr que j’y crois ! Je suis un dragon, je crois à tout ce qui est magique.`, `Hmm… Les dragons croient à plein de choses. Et toi, tu y crois ?`]), ask: 'raconte_libre' };
    if (/ déjà /.test(p)) return { text: pick([`Pas encore ! Mais j’aimerais bien, un jour. Et toi ?`, `Une fois, en rêve. Ça compte ?`, `Non… mais le loup, si ! Il voyage beaucoup plus que moi.`]), ask: 'raconte_libre' };
    return { text: pick([`Hmm… oui ! Enfin, je crois.`, `Ça dépend des jours. Aujourd’hui, oui !`, `Oui, mais seulement le dimanche. Hihi.`, `Bonne question… Je dirais oui. Pourquoi tu demandes ?`]), ask: 'raconte_libre' };
  }
  // « je suis X », « je me sens X »
  if ((m = p.match(/ (?:je suis|j suis|chui|je me sens|je me trouve|je me suis senti|je me suis sentie) (.+) $/))) {
    const x = m[1].trim();
    if (/^(rentrée|rentré|de retour|là|revenue|revenu|arrivée|arrivé)/.test(x)) return { text: pick(['Te voilà ! Tu m’as manqué. Ça s’est bien passé ?', 'Bon retour à la grotte ! Raconte-moi tout.']), anim: 'happy', ask: 'journee' };
    if (/^(dans le bus|dans la voiture|dans le train|dans le métro|en route|en chemin|sur la route)/.test(x)) return { text: pick(['Bon trajet ! Je fais le voyage dans ta poche.', 'Je regarde par la fenêtre avec toi. Enfin, en imagination.']) };
    if (/^(en pyjama|dans mon lit|au lit|sous la couette)/.test(x)) return { text: 'Bien installée ! Tu veux une petite histoire avant de dormir ?', ask: 'histoire_propose' };
    if (/^(à l école|a l ecole|au collège|au college|en cours|en classe)/.test(x)) return { text: 'Concentre-toi bien ! Je t’attends ici, sage comme une image.' };
    if (/^(au travail|au boulot|au bureau)/.test(x)) return { text: 'Bon courage ! Je garde la grotte en t’attendant.' };
    if (/^(en vacances)/.test(x)) return { text: 'Les vacances ! Profite bien, et passe me voir de temps en temps.', anim: 'happy' };
    if (/^(occupée|occupé|pressée|pressé|en retard|débordée|débordé)/.test(x)) return { text: pick(['D’accord, file ! On se parle plus tard.', 'Pas de souci, je ne te retiens pas. Courage !']), then: 'end' };
    if (NEG_ADJ.test(x)) return { text: pick([`Tu es ${x} ? Oh… viens près de moi. Tu veux me raconter ?`, `${cap(x)}… je comprends. Qu’est-ce qui s’est passé ?`, `Je suis là. Tu n’es pas toute seule. Raconte-moi, si tu veux.`]), ask: 'raconte', anim: 'pet' };
    if (POS_ADJ.test(x)) return { text: pick([`Tu es ${x} ? Ça me rend tout joyeux aussi !`, `Trop bien ! Qu’est-ce qui te rend ${x} ?`, `Génial ! Quand tu es ${x}, mes écailles brillent.`]), ask: 'raconte_libre', anim: 'happy' };
    return { text: pick([`Tu es ${x} ? Raconte-moi !`, `Ah bon, ${x} ? Et ça va ?`]), ask: 'raconte_libre' };
  }
  // « tu es X »
  if ((m = p.match(/ (?:tu es|t es|t êtes|tu étais) (?:trop |très |vraiment |tellement |super |un peu )?(.+) $/))) {
    const x = swap(m[1]);
    if (NEG_YOU.test(x)) return { text: pick([`${cap(x)}, moi ? Même pas vrai ! Bon, peut-être un tout petit peu.`, 'Aïe… ça pique les écailles. On fait la paix ?', 'Hmm. Je préfère quand tu me dis des choses gentilles.']), anim: 'dizzy' };
    if (POS_YOU.test(x)) return { text: pick([`${cap(x)} ? Oh, merci ! Toi aussi, tu sais.`, 'Tu vas me faire rougir les écailles !', `Merci ! C’est parce que tu prends bien soin de moi.`]), anim: 'happy' };
    if (/^(où|ou|là)/.test(x)) return null;
    return { text: pick([`${cap(x)}, moi ? Peut-être bien… Pourquoi tu dis ça ?`, `Ha ! ${cap(x)}… Je n’y avais jamais pensé.`]) };
  }
  // « j'aime X », « j'adore X »
  if ((m = p.match(/ (?:j aime|j adore|moi j aime|j aime bien|j aime trop|je kiffe|je préfère|j aime beaucoup) (.+) $/))) {
    const x = swap(m[1]);
    return { text: pick([`Toi aussi tu aimes ${x} ? C’est noté, je m’en souviendrai !`, `${cap(x)} ! Bon choix. Moi j’aime surtout le poisson grillé.`, `J’adore quand tu me dis ce que tu aimes. ${cap(x)}, c’est noté.`]), like: x, anim: 'happy' };
  }
  // « je déteste X », « j'aime pas X »
  if ((m = p.match(/ (?:je déteste|je deteste|j aime pas|j aime vraiment pas|je n aime pas|je supporte pas|j ai horreur de|j ai horreur des) (.+) $/))) {
    const x = swap(m[1]);
    return { text: pick([`Pas fan de ${x} ? Je comprends. Moi, c’est l’eau froide.`, `${cap(x)}, beurk ? C’est noté, je n’en parlerai plus.`, `D’accord, pas de ${x} pour toi. Promis.`]), dislike: x };
  }
  // « on va X », « je vais X », « on part X », « je pars X »
  if ((m = p.match(/ (?:on va|on part|on s en va|je vais|je pars|j vais|je file|je dois aller|il faut que j aille|on doit aller) (.+) $/))) {
    const x = swap(m[1]);
    const me = / (je|j) /.test(p);
    if (/(dormir|me coucher|au lit|faire dodo)/.test(m[1])) return { text: 'Bonne nuit ! Fais de beaux rêves, je garde la grotte.', anim: 'yawn', then: 'end' };
    if (/(manger|dîner|diner|déjeuner|dejeuner|goûter|gouter|à table|a table)/.test(m[1])) return { text: pick(['Bon appétit ! Garde-moi une miette.', 'Miam ! Bon appétit. Moi je vais grignoter un poisson.']) };
    if (/(travail|boulot|bureau)/.test(m[1])) return { text: 'Bon courage au travail ! Je t’attends ici.', then: 'end' };
    if (/^(à l école|a l ecole|au collège|au college|en cours|à l école)/.test(m[1].trim())) return { text: 'Bonne journée au collège ! Je t’attends pour que tu me racontes.', then: 'end' };
    if (/(douche|bain)/.test(m[1])) return { text: 'Bonne douche ! Pas trop chaude… enfin, moi je dis ça.' };
    if (/(devoirs|réviser|reviser|travailler)/.test(m[1])) return { text: 'Bon courage pour tes devoirs ! Je reste sage pour ne pas te déconcentrer.' };
    return { text: pick([`${cap(x)} ? Super ! Tu me raconteras ?`, `${me ? 'Amuse-toi bien' : 'Trop bien'} ! ${cap(x)}, ça a l’air génial.`, `Oh, ${x} ! Je t’attends ici, raconte-moi après !`]), anim: 'happy' };
  }
  // « j'ai X » (choses arrivées)
  if ((m = p.match(/ (?:j ai|on a) (perdu|cassé|casse|gagné|gagne|trouvé|trouve|reçu|recu|acheté|achete|vu|fait|fini|raté|rate|oublié|oublie|mangé|mange|appris|eu) (.+) $/))) {
    const v = strip(m[1]), x = swap(m[2]);
    if (v.startsWith('perdu')) return { text: pick([`Oh non ! Tu as perdu ${x} ? Respire, et refais le chemin dans ta tête. On retrouve souvent tout.`, `Aïe… ${cap(x)} ? Regarde sous le canapé, c’est là que le loup cache tout.`]) };
    if (v.startsWith('cass')) return { text: 'Aïe… Ce n’est pas grave, l’important c’est que tu ne sois pas blessée. Dis-le, ça ira mieux.' };
    if (v.startsWith('gagn')) return { text: `Bravo ! Tu as gagné ${x} ! Je suis super fier de toi !`, anim: 'cheer', fx: 'confetti' };
    if (v.startsWith('trouv') || v.startsWith('recu') || v.startsWith('achet')) return { text: pick([`Oh ! ${cap(x)} ? Décris-le-moi !`, `Trop bien ! ${cap(x)}, ça a l’air chouette.`]), ask: 'raconte_libre' };
    if (v.startsWith('vu')) return { text: `Tu as vu ${x} ? Raconte-moi !`, ask: 'raconte_libre' };
    if (v.startsWith('rat') || v.startsWith('oubli')) return { text: 'Ce n’est pas grave. Tout le monde oublie ou rate des choses, même les dragons. On fera mieux la prochaine fois.' };
    if (v.startsWith('mang')) return { text: `Miam, ${x} ! Tu m’en as gardé ?` };
    if (v.startsWith('appris')) return { text: `Tu as appris ${x} ? Trop fort ! Tu m’apprends aussi ?`, ask: 'raconte_libre' };
    if (v.startsWith('fait') || v.startsWith('fini')) return { text: `Bravo ! ${cap(x)}, c’est fait. Je suis fier de toi.`, anim: 'happy' };
    return { text: `Ah oui ? Raconte-moi !`, ask: 'raconte_libre' };
  }
  // questions ouvertes
  if (/^ (pourquoi|comment ça se fait) /.test(p)) return { text: pick(['Hmm… parce que la vie est pleine de mystères. Toi, tu en penses quoi ?', 'Bonne question ! Je vais y réfléchir pendant ma sieste.', 'Parce que ! Réponse officielle des dragons. Bon, et toi, tu as une idée ?']), ask: 'raconte_libre' };
  if (/^ (comment) /.test(p)) return { text: pick(['Comment ? Avec beaucoup de courage et un peu de feu. C’est ma réponse à tout.', 'Hmm, je ne sais pas trop… Tu m’expliques ?']), ask: 'raconte_libre' };
  if (/^ (où|ou est|ou sont) /.test(p)) return { text: pick(['Hmm… sous le canapé ? C’est là que le loup cache tout.', 'Je ne sais pas, je ne sors pas beaucoup de ma grotte. Regarde bien autour de toi !']) };
  if (/^ (quand) /.test(p)) return { text: pick(['Bientôt ! Enfin… je crois.', 'Quand les dragons voleront… ah, mais on vole déjà. Alors bientôt !']) };
  if (/^ (qui) /.test(p)) return { text: pick(['Qui ? Hmm… je ne connais que toi, ta famille, le loup et le chat. Tu me présentes ?', 'Je ne sais pas ! Raconte-moi qui c’est.']), ask: 'raconte_libre' };
  if (/^ (combien) /.test(p)) return { text: pick(['Beaucoup ! Au moins mille. Ou trois. Je ne suis pas fort en calcul.', 'Hmm… je compte avec mes griffes… pas assez de griffes !']) };
  if (/^ (c est quoi|qu est ce que c est|ça veut dire quoi|ca veut dire quoi) /.test(p)) return { text: pick(['Hmm… je ne connais pas ce mot-là. Tu m’expliques ?', 'Aucune idée ! Les dragons ne savent pas tout. Dis-moi !']), ask: 'raconte_libre' };
  // ordres de chien (pas des tours de dragon)
  if (/ (donne la patte|assis|couché|couche|fais le beau|roule|fais le mort|au pied|rapporte|va chercher|saute) /.test(p)) {
    return { text: pick(['Je ne suis pas un chien ! Mais d’accord, juste pour toi…', 'Hé, je suis un dragon, pas un toutou ! Bon… voilà.', 'Ça, c’est un ordre pour le loup ! Mais je veux bien essayer.']), anim: pick(['bow', 'happy', 'tail_chase']) };
  }
  void parent;
  return null;
}

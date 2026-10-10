// Conversation avec le dragon : on lui parle librement, il reconnaît le sujet par mots-clés
// et répond à partir de la banque de répliques (DialogueData). Tout se passe sur le téléphone :
// rien de ce qui est dit n'est enregistré ni envoyé.
import { FALLBACK, INTENTS as BASE, JOKES, OPENERS, RIDDLES, STORY, type IntentDef } from './DialogueData.js';
import { MORE_INTENTS } from './DialogueMore.js';
import { contentWords, patternReply, priorityPattern, soft } from './DialoguePatterns.js';

const INTENTS: IntentDef[] = [...BASE, ...MORE_INTENTS];

/** État du monde utile au dragon pour répondre. */
export interface TalkCtx {
  role: 'kid' | 'parent';
  dragon: string;
  person: string;
  wolf: string;
  /** Destination si le loup est en quête, sinon null. */
  wolfAway: string | null;
  wolfBack: boolean;
  wolfMinutes: number;
  mood: 'great' | 'good' | 'meh' | 'sad';
  hunger: number;
  clean: number;
  fav: string | null;
  level: number;
  stage: string;
  bond: string;
  weather: { kind: string; temp: number } | null;
  event: string | null;
  /** Quêtes du jour encore à faire (titres), null pour un parent. */
  tasksLeft: string[] | null;
  tasksDone: number;
  /** Jours avant l'anniversaire de la personne (0 = aujourd'hui), null si inconnu. */
  birthdayIn: number | null;
  gold: number;
  /** Tours qu'il connaît déjà. */
  tricks: string[];
  now: Date;
}

export interface TalkReply { text: string; anim?: string; fx?: string; then?: IntentDef['then']; intent: string; gold?: number }

interface Mem { ctx: string | null; ctxAt: number; recent: string[]; story: number; riddle: number; riddleOpen: number | null; last: string | null; riddleDay: string; riddleWins: number; riddleTries: number; likes: string[]; dislikes: string[]; unknown: Array<{ t: string; at: number }> }
const KEY = 'quete-du-dragon:talk';

/** Sans accents, minuscules, ponctuation en espaces. */
export const norm = (s: string) => ' ' + s.toLowerCase().replace(/œ/g, 'oe').replace(/æ/g, 'ae').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/['’]/g, ' ').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim() + ' ';

/** La dragonne parle d'elle au féminin (les répliques sont écrites au masculin). */
const FEM: Array<[RegExp, string]> = [
  [/\bContent de\b/g, 'Contente de'], [/\bje suis content\b/g, 'je suis contente'], [/\bJe suis content\b/g, 'Je suis contente'], [/\bJ’en suis content\b/g, 'J’en suis contente'], [/\bFier\b/g, 'Fière'], [/\bfier\b/g, 'fière'], [/\bprêt\b/g, 'prête'], [/\bJe suis né\b/g, 'Je suis née'],
  [/\btout propre\b/g, 'toute propre'], [/\bTout propre\b/g, 'Toute propre'], [/\brayonnant\b/g, 'rayonnante'], [/\bplein comme\b/g, 'pleine comme'], [/\bpoussiéreux\b/g, 'poussiéreuse'],
  [/\bvégétarien\b/g, 'végétarienne'], [/\btout seul\b/g, 'toute seule'], [/\bJe suis sûr\b/g, 'Je suis sûre'], [/\bdésolé\b/g, 'désolée'], [/\bJe suis un dragon\b/g, 'Je suis une dragonne'],
  [/\bun dragon de câlins\b/g, 'une dragonne de câlins'], [/\bun dragon d’appli\b/g, 'une dragonne d’appli'], [/\bun vrai dragon\b/g, 'une vraie dragonne'], [/\bton dragon\b/g, 'ta dragonne'],
  [/\bmon meilleur copain\b/g, 'mon meilleur copain'], [/\bJe suis prêt\b/g, 'Je suis prête'], [/\bheureux\b/g, 'heureuse'], [/\bJe suis tout\b/g, 'Je suis toute'], [/\bje suis sûr\b/g, 'je suis sûre'], [/\bsuis pas sûr\b/g, 'suis pas sûre'], [/\bje suis tout\b/g, 'je suis toute'], [/\btout écailles\b/g, 'toute écailles'], [/\bdoué\b/g, 'douée'], [/\btout joyeux\b/g, 'toute joyeuse'], [/\bplein comme\b/g, 'pleine comme'], [/\bsage comme\b/g, 'sage comme'], [/\bprêt\b/g, 'prête'], [/\bpas très fort\b/g, 'pas très forte'], [/\ble fière\b/g, 'la fière']
];
const feminine = (t: string) => FEM.reduce((acc, [re, to]) => acc.replace(re, to), t);

/** « … mon dragon », « ma puce, … » : le petit nom ne compte pas quand il y a autre chose dans la phrase. */
const VOCATIVES = ['mon petit dragon', 'ma petite dragonne', 'mon dragon', 'ma dragonne', 'mon cheri', 'ma cherie', 'mon bebe', 'mon coeur', 'ma puce', 'mon amour', 'mon tresor', 'mon grand', 'ma belle', 'mon beau', 'mon pote', 'mon doudou', 'mon chou', 'mon lapin', 'mon gros', 'mon poussin', 'ma biche', 'mon bichon', 'mon petit', 'ma petite'];
export function dropVocative(p: string): string {
  let q = p;
  for (const v of VOCATIVES) q = q.split(' ' + v + ' ').join(' ');
  q = ' ' + q.replace(/\s+/g, ' ').trim() + ' ';
  return q.trim() ? q : p;
}
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
let fuzzyIndex: Array<{ it: IntentDef; words: Set<string> }> | null = null;
void soft;

const pickFrom = <T>(list: T[]): T => list[Math.floor(Math.random() * list.length)];

export class Dialogue {
  private mem: Mem;
  constructor(private storageKey = KEY) {
    let m: Partial<Mem> = {};
    try { m = JSON.parse(localStorage.getItem(storageKey) ?? '{}') as Partial<Mem>; } catch { /* */ }
    this.mem = { ctx: null, ctxAt: 0, recent: [], story: 0, riddle: Math.floor(Math.random() * RIDDLES.length), riddleOpen: null, last: null, riddleDay: '', riddleWins: 0, riddleTries: 0, likes: [], dislikes: [], unknown: [], ...m };
  }
  private save(): void { try { localStorage.setItem(this.storageKey, JSON.stringify(this.mem)); } catch { /* */ } }

  opener(c: TalkCtx): string { return this.fill(pickFrom(OPENERS), c); }

  /** Le dragon attend-il une réponse précise ? */
  get waiting(): string | null { return this.mem.ctx && Date.now() - this.mem.ctxAt < 3 * 60000 ? this.mem.ctx : null; }

  /** Trouve le sujet de la phrase (meilleur score de mots-clés ; un sujet attendu passe avant). */
  match(heard: string[], c: TalkCtx): IntentDef | null { return this.scored(heard, c).it; }

  scored(heard: string[], c: TalkCtx): { it: IntentDef | null; score: number } {
    const waiting = this.waiting;
    let best: IntentDef | null = null, bestScore = 0;
    for (const phrase of heard.slice(0, 3)) {
      let p = norm(phrase);
      // le nom du dragon et du loup ne comptent pas comme des mots-clés
      for (const n of [c.dragon, c.wolf]) if (n) { const nn = norm(n).trim(); if (nn) p = p.split(' ' + nn + ' ').join(n === c.wolf ? ' le loup ' : ' '); }
      p = dropVocative(p);
      for (const it of INTENTS) {
        if (it.ctx && it.ctx !== waiting) continue;
        if (it.not?.some(n => p.includes(' ' + n + ' '))) continue;
        if (it.who && it.who !== c.role) continue;
        let s = 0;
        for (const k of it.k) {
          if (k === '*') { s = Math.max(s, 1); continue; } // n'importe quelle phrase : un sujet net (≥ 10) passe devant
          if (k.endsWith('*')) { const stem = k.slice(0, -1); if (p.includes(' ' + stem)) s = Math.max(s, stem.length + 1); }
          else if (p.includes(' ' + k + ' ')) s = Math.max(s, k.length + 2);
        }
        if (!s) continue;
        if (it.ctx) s += it.k.includes('*') && s === 1 ? 5 : 60;  // réponse à sa question
        s += it.prio ?? 0;
        if (s > bestScore) { best = it; bestScore = s; }
      }
      if (best) break;
    }
    return { it: best, score: bestScore };
  }

  /** Correspondance approchée : les mots importants de la phrase retrouvés dans les mots-clés d'un sujet. */
  private fuzzy(heard: string[], c: TalkCtx): IntentDef | null {
    if (!fuzzyIndex) fuzzyIndex = INTENTS.filter(it => !it.ctx && !(it.prio && it.prio >= 50)).map(it => ({ it, words: new Set(it.k.flatMap(k => contentWords(k.replace('*', '')))) }));
    const words = contentWords(heard[0] ?? '').filter(w => w !== contentWords(c.dragon)[0]);
    if (!words.length) return null;
    let best: IntentDef | null = null, bestN = 0, bestLong = 0;
    for (const { it, words: set } of fuzzyIndex) {
      if (it.who && it.who !== c.role) continue;
      const hits = words.filter(w => set.has(w));
      const long = hits.reduce((a, w) => Math.max(a, w.length), 0);
      if (hits.length > bestN || (hits.length === bestN && long > bestLong)) { best = it; bestN = hits.length; bestLong = long; }
    }
    if (bestN >= 2 || (bestN === 1 && words.length <= 3 && bestLong >= 5)) return best;
    return null;
  }

  /** Phrases non comprises (gardées sur ce téléphone seulement, pour enrichir le dragon). */
  unknown(): Array<{ t: string; at: number }> { return this.mem.unknown; }
  clearUnknown(): void { this.mem.unknown = []; this.save(); }

  /** Réponse du dragon à ce qui a été entendu (plusieurs propositions de la reconnaissance vocale). */
  reply(heard: string[], c: TalkCtx): TalkReply {
    if (/\d+ (fois|x|plus|moins|divise par) \d+/.test(norm(heard[0] ?? ''))) {
      const r = this.dynamic('calcul', heard, c, null);
      this.save();
      return { ...r, intent: 'calcul' };
    }
    const { it: found, score } = this.scored(heard, c);
    const prevCtx = this.waiting;
    this.mem.ctx = null;
    let out: TalkReply;
    let it = found;
    // un sujet net l'emporte ; sinon on essaie de comprendre la tournure de la phrase, puis les mots
    const sharp = score >= 14 || (!!it?.prio && it.prio >= 20) || (!!it?.ctx && !it.k.includes('*'));
    const strong = it && (score >= 7 && !(it.ctx && it.k.includes('*') && score < 10)) && (sharp || !heard.slice(0, 1).some(priorityPattern));
    if (!strong) {
      const pr = heard.slice(0, 2).map(h => patternReply(h, c)).find(Boolean) ?? null;
      if (pr) {
        if (pr.like) this.mem.likes = [pr.like, ...this.mem.likes.filter(l => l !== pr.like)].slice(0, 20);
        if (pr.dislike) this.mem.dislikes = [pr.dislike, ...this.mem.dislikes.filter(l => l !== pr.dislike)].slice(0, 20);
        if (pr.ask) { this.mem.ctx = pr.ask; this.mem.ctxAt = Date.now(); }
        out = { text: c.role === 'parent' ? feminine(pr.text) : pr.text, intent: 'pattern', anim: pr.anim, fx: pr.fx, then: pr.then };
        this.mem.last = 'pattern';
        this.save();
        return out;
      }
      if (!it) it = this.fuzzy(heard, c);
    }
    if (!it) {
      const t = (heard[0] ?? '').trim();
      if (t) this.mem.unknown = [{ t, at: Date.now() }, ...this.mem.unknown.filter(u => u.t !== t)].slice(0, 40);
      out = { text: this.choose(FALLBACK.map(t => t), c, 'fallback'), intent: 'fallback' };
    }
    else if (it.dyn) out = { ...this.dynamic(it.dyn, heard, c, prevCtx), intent: it.id, anim: it.anim, fx: it.fx, then: it.then };
    else out = { text: this.choose(it.r ?? [], c, it.id), intent: it.id, anim: it.anim, fx: it.fx, then: it.then };
    if (c.role === 'parent') out.text = feminine(out.text);
    this.mem.last = out.intent === 'encore' ? this.mem.last : out.intent;
    this.save();
    return out;
  }

  /** Choisit une réplique valable maintenant, en évitant les répétitions récentes ; applique {ask:...}. */
  private choose(list: string[], c: TalkCtx, id: string): string {
    const ok = list.map((raw, i) => ({ raw, i, tags: [...raw.matchAll(/^\s*(?:\{[^}]+\}\s*)+/g)][0]?.[0] ?? '' }))
      .filter(x => this.tagsOk(x.tags, c));
    if (!ok.length) return this.fill(pickFrom(FALLBACK), c);
    const fresh = ok.filter(x => !this.mem.recent.includes(`${id}:${x.i}`));
    const pick = pickFrom(fresh.length ? fresh : ok);
    this.mem.recent = [`${id}:${pick.i}`, ...this.mem.recent.filter(r => r !== `${id}:${pick.i}`)].slice(0, 60);
    return this.fill(pick.raw, c);
  }

  private tagsOk(tags: string, c: TalkCtx): boolean {
    const h = c.now.getHours();
    for (const m of tags.matchAll(/\{([^}]+)\}/g)) {
      const t = m[1];
      if (t.startsWith('ask:')) continue;
      const ok = t === 'kid' ? c.role === 'kid' : t === 'parent' ? c.role === 'parent'
        : t === 'morning' ? h >= 5 && h < 11 : t === 'day' ? h >= 11 && h < 18 : t === 'evening' ? h >= 18 && h < 22 : t === 'night' ? h >= 22 || h < 5
        : t === 'sad' ? c.mood === 'sad' || c.mood === 'meh' : t === 'happy' ? c.mood === 'great' || c.mood === 'good'
        : t === 'hungry' ? c.hunger < 45 : t === 'dirty' ? c.clean < 45
        : t === 'rain' ? !!c.weather && /rain|drizzle|heavy|storm/.test(c.weather.kind) : t === 'snow' ? c.weather?.kind === 'snow'
        : t === 'sun' ? c.weather?.kind === 'clear' : t === 'cold' ? !!c.weather && c.weather.temp <= 5 : t === 'hot' ? !!c.weather && c.weather.temp >= 27
        : t === 'wolfaway' ? !!c.wolfAway : t === 'wolfhome' ? !c.wolfAway : true;
      if (!ok) return false;
    }
    return true;
  }

  /** Retire les étiquettes, garde la question posée, remplace les noms. */
  private fill(raw: string, c: TalkCtx): string {
    let ask: string | null = null;
    let t = raw.replace(/\{([^}]+)\}/g, (_, tag: string) => { if (tag.startsWith('ask:')) ask = tag.slice(4); return ''; }).replace(/\s+/g, ' ').trim();
    t = t.replace(/\[nom\]/g, c.dragon).replace(/\[loup\]/g, c.wolf).replace(/\[maman\]/g, c.role === 'kid' ? 'ta maman' : 'Louanne')
      .replace(/\[prenom\]/g, c.person || (c.role === 'kid' ? 'toi' : 'ma belle'));
    t = t.replace(/ +([,.…])/g, '$1').replace(/ {2,}/g, ' ').replace(/^[,\s]+/, '');
    if (ask) { this.mem.ctx = ask; this.mem.ctxAt = Date.now(); }
    return c.role === 'parent' ? feminine(t) : t;
  }

  private ask(ctx: string): void { this.mem.ctx = ctx; this.mem.ctxAt = Date.now(); }

  // ---------------- Réponses calculées ----------------
  private dynamic(kind: string, heard: string[], c: TalkCtx, prevCtx: string | null): Omit<TalkReply, 'intent'> {
    const h = c.now.getHours(), mi = c.now.getMinutes();
    const kid = c.role === 'kid';
    switch (kind) {
      case 'ca_va': {
        const bits: string[] = [];
        if (c.hunger < 35) bits.push('J’ai un petit creux, par contre… Tu me donnes à manger ?');
        else if (c.clean < 35) bits.push('Ça va, mais je me sens un peu poussiéreux. Un bain, peut-être ?');
        const base = c.mood === 'great' ? pickFrom(['Je pète le feu ! Littéralement.', 'Super bien ! Je suis rayonnant.', 'À merveille, maintenant que tu es là.'])
          : c.mood === 'good' ? pickFrom(['Ça va bien, merci !', 'Plutôt bien ! Une journée tranquille de dragon.', 'Bien ! J’ai fait une bonne sieste.'])
          : c.mood === 'meh' ? pickFrom(['Bof… je m’ennuyais un peu sans toi.', 'Ça va mieux depuis que tu me parles.'])
          : 'Pas trop… tu m’as manqué. Un câlin et ça ira mieux.';
        this.ask('moi_ca_va');
        return { text: `${base} ${bits.join(' ')} Et toi, ça va ?`.replace(/\s+/g, ' ') };
      }
      case 'ma_journee': {
        const bits = [
          c.wolfAway ? `Le loup est parti ${c.wolfAway}, alors j’ai gardé la grotte tout seul.` : pickFrom(['J’ai joué avec le loup.', 'Le loup et moi, on a fait la course jusqu’à la cascade.', 'J’ai regardé le loup dormir. Passionnant.']),
          c.hunger < 40 ? 'Et j’ai faim, maintenant !' : pickFrom(['J’ai fait une sieste au soleil.', 'J’ai compté mes écailles. Il en manque une, je crois.', 'J’ai entraîné mon souffle de feu.']),
          c.weather && /rain|heavy|drizzle/.test(c.weather.kind) ? 'J’ai regardé la pluie tomber dehors.' : ''
        ].filter(Boolean);
        this.ask('journee');
        return { text: `${bits.join(' ')} Et toi, ta journée ?` };
      }
      case 'age': return { text: `Je suis un ${c.stage.toLowerCase()} de niveau ${c.level}. En années de dragon, c’est… très jeune. Les dragons vivent mille ans !` };
      case 'plat': return { text: c.fav ? `Mon plat préféré ? ${c.fav} ! Rien que d’y penser, je bave.` : 'Hmm… c’est un secret. Essaie de me donner différentes choses à manger, tu finiras par trouver !' };
      case 'faim':
        if (c.hunger < 40) return { text: pickFrom(['Oui ! Mon ventre fait des bruits de volcan. Tu me nourris ?', 'Très faim ! Un poisson, une ration… je ne suis pas difficile.']), then: 'feed', anim: 'happy' };
        if (c.hunger > 85) return { text: 'Non merci, je suis plein comme un œuf de dragon !' };
        return { text: 'Un petit peu… mais je peux attendre. Un poisson ne serait pas de refus, hein.' };
      case 'bain':
        if (c.clean < 45) return { text: pickFrom(['Hmm… oui, je crois que j’ai besoin d’un bain. Tu me frottes les écailles ?', 'Je sens un peu le volcan, c’est vrai. Un bain ?']), then: 'wash' };
        return { text: pickFrom(['Je suis tout propre ! Regarde comme je brille.', 'Propre comme un sou neuf. Enfin, comme un dragon neuf.']) };
      case 'fatigue_toi':
        if (h >= 21 || h < 7) return { text: 'Un peu… Il est tard, on devrait aller dormir tous les deux.', anim: 'yawn' };
        return { text: pickFrom(['Non, je suis en pleine forme ! Une partie ?', 'Juste un peu. Une petite sieste, et je repars.']) };
      case 'besoin': {
        if (c.hunger < 40) return { text: 'À manger, s’il te plaît ! J’ai faim.', then: 'feed' };
        if (c.clean < 40) return { text: 'Un bain ! Je me sens tout poussiéreux.', then: 'wash' };
        if (c.mood === 'meh' || c.mood === 'sad') return { text: 'Un câlin… et jouer avec toi.' };
        return { text: pickFrom(['Rien du tout, j’ai tout ce qu’il me faut : toi.', 'Une histoire, peut-être ? Ou jouer ?', 'Que tu restes encore un peu avec moi.']) };
      }
      case 'heure': {
        const t = `${h} heure${h > 1 ? 's' : ''}${mi ? ` ${mi}` : ''}`;
        const tail = kid && h >= 22 ? ' Tu ne devrais pas être au lit, toi ?' : h < 7 ? ' Tu es bien matinale !' : h >= 12 && h < 14 ? ' C’est l’heure de manger !' : '';
        return { text: `Il est ${t}.${tail}` };
      }
      case 'date': {
        const d = c.now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
        const we = c.now.getDay() === 0 || c.now.getDay() === 6;
        return { text: `On est ${d}.${we ? ' C’est le week-end !' : ''}` };
      }
      case 'meteo': {
        const w = c.weather;
        if (!w) return { text: 'Je ne vois pas le ciel d’ici… Regarde par la fenêtre et dis-le-moi !' };
        const k = w.kind;
        const say = k === 'storm' ? 'Il y a de l’orage ! Reste à l’abri.' : k === 'snow' ? 'Il neige ! Couvre-toi bien.' : k === 'heavy' ? 'Il pleut très fort.' : k === 'rain' ? 'Il pleut.' : k === 'drizzle' ? 'Il bruine un peu.'
          : k === 'fog' ? 'Il y a du brouillard.' : k === 'cloudy' ? 'Le ciel est couvert.' : 'Il fait beau !';
        const temp = `Il fait ${w.temp} degrés à Rozay.`;
        const tip = w.temp <= 3 ? ' Prends ton manteau, ton bonnet, tout !' : w.temp >= 28 ? ' Bois de l’eau et reste à l’ombre.' : /rain|heavy|storm|drizzle/.test(k) ? ' Pense au parapluie !' : '';
        return { text: `${say} ${temp}${tip}` };
      }
      case 'taches': {
        if (!c.tasksLeft) return { text: 'Tu n’as pas de quêtes, toi ! Tu es la cheffe de la grotte.' };
        if (!c.tasksLeft.length) return { text: c.tasksDone ? 'Tout est fait pour aujourd’hui ! Je suis super fier de toi.' : 'Rien de prévu pour l’instant. Profite !', anim: c.tasksDone ? 'cheer' : undefined };
        const list = c.tasksLeft.slice(0, 3).join(', ');
        return { text: `Il te reste : ${list}. ${c.tasksLeft.length === 1 ? 'Plus qu’une, tu y es presque !' : 'On s’y met ? Je t’encourage !'}` };
      }
      case 'fini': {
        if (c.tasksLeft && c.tasksLeft.length) return { text: `Bravo ! Pense à la cocher dans tes quêtes pour gagner ton XP. Il te reste encore : ${c.tasksLeft.slice(0, 2).join(', ')}.`, anim: 'happy' };
        return { text: pickFrom(['Bravo ! Je suis fier de toi. Tu mérites une pause.', 'Génial ! Mission accomplie, cheffe !', 'Trop fort ! Tu vois quand tu veux ?']), anim: 'cheer' };
      }
      case 'loup': {
        if (c.wolfAway) return { text: `${c.wolf} est parti ${c.wolfAway}. Il revient dans ${c.wolfMinutes >= 60 ? `${Math.round(c.wolfMinutes / 60)} heure${c.wolfMinutes >= 90 ? 's' : ''}` : `${Math.max(1, c.wolfMinutes)} minutes`} environ. Il me manque un peu.` };
        if (c.wolfBack) return { text: `${c.wolf} est rentré ! Il a sûrement quelque chose dans sa sacoche. Touche-le !` };
        return { text: pickFrom([`${c.wolf} est juste à côté de moi. Il fait semblant de dormir, mais il écoute tout.`, `${c.wolf} ? Il est là ! C’est mon meilleur copain. Tu peux l’envoyer en quête avec le bouton Voyage.`, `Il est là, il remue la queue. Je crois qu’il a entendu son nom.`]) };
      }
      case 'fete': {
        const ev: Record<string, string> = {
          noel: 'C’est bientôt Noël ! J’ai demandé une montagne de poissons au Père Noël.', nouvelan: 'Bonne année ! Cette année, je vais apprendre à faire des feux d’artifice.',
          valentin: 'C’est la Saint-Valentin ! Je t’envoie plein de cœurs de feu.', paques: 'C’est Pâques ! Tu as trouvé les œufs cachés dans la grotte ?',
          ete: 'C’est l’été ! Les lucioles dansent le soir.', halloween: 'Bouh ! C’est Halloween ! Tu as des bonbons pour moi ?', anniversaire: 'C’est ton anniversaire !!! Joyeux anniversaire !'
        };
        if (c.event && ev[c.event]) return { text: ev[c.event], anim: 'cheer' };
        const said = heard.map(norm).join(' ');
        const days = (m: number, d: number) => { const t = new Date(c.now.getFullYear(), c.now.getMonth(), c.now.getDate()); let x = new Date(c.now.getFullYear(), m - 1, d); if (x < t) x = new Date(c.now.getFullYear() + 1, m - 1, d); return Math.round((x.getTime() - t.getTime()) / 86400000); };
        const fetes: Array<[RegExp, string, number, number]> = [[/noel/, 'Noël', 12, 25], [/halloween/, 'Halloween', 10, 31], [/valentin/, 'la Saint-Valentin', 2, 14], [/nouvel an|bonne annee/, 'le Nouvel An', 1, 1]];
        const f = fetes.find(([re]) => re.test(said));
        if (f) { const n = days(f[2], f[3]); return { text: n === 0 ? `C’est aujourd’hui, ${f[1]} !` : `${cap(f[1])}, c’est dans ${n} jour${n > 1 ? 's' : ''} ! ${n < 30 ? 'J’ai hâte !' : 'Encore un peu de patience.'}`, anim: 'happy' }; }
        return { text: 'J’adore les fêtes ! À Noël, à Pâques, à ton anniversaire… je décore toute la grotte.' };
      }
      case 'anniv': {
        const b = c.birthdayIn;
        if (b === 0) return { text: `C’est aujourd’hui ! JOYEUX ANNIVERSAIRE${c.person ? ' ' + c.person : ''} ! Je te souffle un feu d’artifice !`, anim: 'cheer', fx: 'confetti' };
        if (b === null) return { text: 'Je ne connais pas la date de ton anniversaire ! Règle-la dans ton profil, et je le fêterai avec toi.' };
        if (b <= 30) return { text: `Ton anniversaire, c’est dans ${b} jour${b > 1 ? 's' : ''} ! J’ai déjà une idée de cadeau…` };
        return { text: `Ton anniversaire est dans ${b} jours. Je compte, je compte !` };
      }
      case 'envie': {
        const opts: string[] = [];
        if (c.hunger < 45) opts.push('Manger ! Mon ventre fait des bruits de volcan. Tu me donnes quelque chose ?');
        if (c.clean < 45) opts.push('Un bain, je crois… je me sens tout poussiéreux. Tu me frottes les écailles ?');
        if (h >= 21 || h < 7) opts.push('Un câlin, une petite histoire… et dodo. Tu veux que je te raconte une histoire ?');
        if (c.wolfBack) opts.push(`Ouvrir la sacoche de ${c.wolf} ! Il est rentré avec plein de trucs.`);
        if (!c.wolfAway && !c.wolfBack && h >= 8 && h < 20) opts.push(`Envoyer ${c.wolf} en quête ! Il trépigne d’impatience. Ou alors, on va pêcher ensemble ?`);
        if (c.weather && /rain|heavy|drizzle|storm/.test(c.weather.kind)) opts.push('Il pleut dehors… Une partie de pêche au lac, bien au sec ? Ou une histoire au coin du feu ?');
        if (c.weather?.kind === 'clear' && h >= 9 && h < 19) opts.push('Il fait beau ! Une balade ? Mets-moi dans ta poche, tes pas me font gagner de l’or.');
        opts.push('Jouer avec toi ! La pêche, la course dans les nuages, ou le tir de feu ?',
          'Que tu me racontes ta journée. Et après, un jeu ?',
          'Faire des tours ! Dis « crache du feu » ou « danse », et regarde-moi.',
          'Une devinette ! Dis « devinette » et je t’en pose une.',
          'Rien de spécial… juste rester avec toi. C’est déjà parfait.');
        const t = pickFrom(opts.slice(0, Math.max(3, opts.length - 2)).concat(pickFrom(opts)));
        if (/Jouer avec toi|pêche/.test(t)) this.ask('jeu_propose');
        if (/histoire \?/.test(t)) this.ask('histoire_propose');
        return { text: t, anim: 'happy', };
      }
      case 'pensee': return { text: pickFrom([
        'Tu sais quoi ? Ce matin, le loup a essayé d’attraper sa queue pendant dix minutes. Il a gagné. Enfin, il dit.',
        'Je pensais à un truc : si les nuages sont de l’eau, alors je pourrais boire le ciel ?',
        'J’ai compté les cristaux de la grotte : 247. Le loup dit 248. On n’est pas d’accord.',
        'Hier soir, j’ai vu une étoile filante. J’ai fait un vœu… pour toi. C’est secret.',
        'Les dragons du Nord disent : « Un feu partagé brûle deux fois plus longtemps. » Je trouve ça joli.',
        'J’ai entendu le chat ronronner tout à l’heure. Il ronronne plus fort que moi, c’est vexant.',
        c.weather && /rain|heavy|drizzle/.test(c.weather.kind) ? 'J’adore le bruit de la pluie dehors. Ça me donne envie de faire une sieste.' : 'Je trouve que la lumière est belle aujourd’hui. Tu as vu le ciel ?',
        c.role === 'kid' ? 'Tu sais que tu es la seule humaine qui me comprend vraiment ?' : 'Tu sais que tu es la plus douce des humaines ? Je le pense vraiment.',
        'Parfois, je me demande à quoi ressemble le monde vu d’en haut, très haut. Un jour, je volerai jusque-là.',
        'Je me suis entraîné à souffler des ronds de fumée. J’en ai réussi un ! Bon, il ressemblait à une patate.'
      ]) };
      case 'question_pour_toi': {
        this.ask('raconte_libre');
        return { text: pickFrom([
          'D’accord ! Quel est ton plus beau souvenir ?', 'Si tu étais un animal, tu serais lequel ?', 'C’est quoi ton plat préféré ? Que je sache quoi demander au loup.',
          'Qu’est-ce qui t’a fait rire aujourd’hui ?', 'Si tu pouvais aller n’importe où demain, tu irais où ?', 'C’est quoi ta chanson du moment ?',
          'Tu préfères la mer ou la montagne ?', 'Quel super pouvoir tu aimerais avoir ?', 'Qu’est-ce qui te rend fière de toi ?', 'C’est qui ta personne préférée… à part moi ?',
          'Tu préfères le chocolat ou les bonbons ?', 'C’est quoi le meilleur moment de ta semaine ?'
        ]) };
      }
      case 'savoir': return { text: pickFrom([
        'Le savais-tu ? Les loups peuvent entendre un bruit à dix kilomètres en forêt. Le mien entend surtout le paquet de friandises.',
        'Les poissons rouges ont une meilleure mémoire qu’on le croit : plusieurs mois ! Contrairement au loup.',
        'Le cœur d’une baleine bleue est aussi gros qu’une petite voiture. Le mien est gros comme ça pour toi.',
        'Les chats passent environ deux tiers de leur vie à dormir. Le chat de la maison vise sûrement le record.',
        'La lave d’un volcan peut dépasser 1000 degrés. Moi, je reste à une température câline.',
        'Les dauphins dorment avec un œil ouvert. Moi aussi, pour surveiller la grotte.',
        'Il y a plus d’étoiles dans l’univers que de grains de sable sur toutes les plages de la Terre.',
        'Le miel ne périme jamais : on en a retrouvé de plusieurs milliers d’années dans des tombeaux égyptiens, encore mangeable.',
        'Les pieuvres ont trois cœurs. Trois ! Et moi qui n’en ai qu’un, entièrement pour toi.',
        'Un éclair est cinq fois plus chaud que la surface du soleil. Même moi je ne rivalise pas.',
        'Les fourmis peuvent porter environ cinquante fois leur poids. Le loup, lui, porte surtout sa sacoche.'
      ]) };
      case 'mes_gouts': {
        const l = this.mem.likes, d = this.mem.dislikes;
        if (!l.length && !d.length) return { text: 'Hmm… tu ne m’as pas encore dit ce que tu aimes ! Dis-moi « j’aime… » et je m’en souviendrai.' };
        const a = l.length ? `Tu aimes ${l.slice(0, 3).join(', ')}.` : '';
        const b = d.length ? ` Et tu n’aimes pas ${d.slice(0, 2).join(', ni ')}.` : '';
        return { text: `Bien sûr que je me souviens ! ${a}${b} Je fais attention à toi, tu vois.`, anim: 'happy' };
      }
      case 'humeur_toi': {
        if (c.mood === 'great') return { text: pickFrom(['Je suis de super humeur ! Rayonnant, même.', 'Heureux comme un dragon dans un volcan tout chaud !']), anim: 'happy' };
        if (c.mood === 'good') return { text: pickFrom(['Ça va bien ! Content que tu sois là.', 'Plutôt de bonne humeur. Un câlin et ce sera parfait.']) };
        if (c.hunger < 40) return { text: 'Un peu grognon… mais c’est parce que j’ai faim. Tu me nourris ?', then: 'feed' };
        if (c.clean < 40) return { text: 'Un peu bof. Je me sens tout poussiéreux… Un bain me ferait du bien.', then: 'wash' };
        return { text: 'Un peu triste… Tu m’as manqué. Mais maintenant que tu me parles, ça va mieux.', anim: 'pet' };
      }
      case 'nourrir':
        if (c.hunger >= 92) return { text: 'Merci, mais je suis plein comme un œuf ! Plus tard, d’accord ?' };
        return { text: pickFrom(['Oh oui ! Avec plaisir !', 'Miam, je ne dis jamais non !', c.hunger < 45 ? 'Oui, oui, oui ! J’ai trop faim !' : 'Un petit quelque chose, je veux bien !']), then: 'feed', anim: 'happy' };
      case 'laver':
        if (c.clean >= 90) return { text: 'Je suis déjà tout propre… mais un petit bain, pourquoi pas, si tu insistes !', then: 'wash' };
        return { text: pickFrom(['D’accord, un bon bain ! Frotte bien derrière les ailes.', 'Hmm, c’est vrai que je sens un peu le volcan. Allez, au bain !']), then: 'wash' };
      case 'gold': return { text: `Tu as ${c.gold} pièces d’or. ${c.gold >= 300 ? 'Tu es riche ! Va faire un tour dans le Coffre.' : c.gold >= 80 ? 'De quoi t’offrir quelque chose de sympa dans le Coffre.' : 'Encore quelques quêtes et tu pourras t’offrir un joli truc !'}` };
      case 'calcul': {
        const t = heard.map(norm).join(' ');
        const m = t.match(/(\d+) (fois|x|plus|moins|divise par|sur) (\d+)/);
        if (!m) return { text: 'Donne-moi un calcul, par exemple « combien font 7 fois 8 ». Mais attention, je compte avec mes griffes.' };
        const a = Number(m[1]), b = Number(m[3]);
        const r = m[2] === 'fois' || m[2] === 'x' ? a * b : m[2] === 'plus' ? a + b : m[2] === 'moins' ? a - b : b ? Math.round((a / b) * 100) / 100 : NaN;
        if (!Number.isFinite(r)) return { text: 'Diviser par zéro ? Même un dragon ne peut pas faire ça !' };
        return { text: `${a} ${m[2] === 'x' ? 'fois' : m[2]} ${b}, ça fait ${String(r).replace('.', ',')} ! ${pickFrom(['Facile.', 'J’ai compté sur mes griffes.', 'Mais vérifie quand même, hein.'])}` };
      }
      case 'anglais': {
        const t = heard.map(norm).join(' ');
        const DICO: Record<string, string> = { dragon: 'dragon', loup: 'wolf', chat: 'cat', chien: 'dog', feu: 'fire', eau: 'water', poisson: 'fish', maison: 'house', ecole: 'school', bonjour: 'hello', merci: 'thank you', 'au revoir': 'goodbye', ami: 'friend', amie: 'friend', amour: 'love', 'je t aime': 'I love you', soleil: 'sun', lune: 'moon', etoile: 'star', ciel: 'sky', mer: 'sea', montagne: 'mountain', arbre: 'tree', fleur: 'flower', livre: 'book', pomme: 'apple', gateau: 'cake', rouge: 'red', bleu: 'blue', vert: 'green', noir: 'black', blanc: 'white', jaune: 'yellow', violet: 'purple', grand: 'big', petit: 'small', chaud: 'hot', froid: 'cold', aile: 'wing', ailes: 'wings', or: 'gold', tresor: 'treasure', famille: 'family', maman: 'mum', papa: 'dad', soeur: 'sister', frere: 'brother', fille: 'girl', garcon: 'boy', nuit: 'night', jour: 'day', 'bonne nuit': 'good night', pluie: 'rain', neige: 'snow', vent: 'wind', voler: 'to fly', manger: 'to eat', dormir: 'to sleep', jouer: 'to play', chanter: 'to sing', danser: 'to dance', courir: 'to run', lire: 'to read', ecrire: 'to write' };
        const m = t.match(/ (?:dit|dire|traduis|traduit) (?:le mot |le |la |l |un |une |les )?([a-z ]+?) (?:en anglais)?\s*$/) ?? t.match(/ ([a-z]+(?: [a-z]+)?) en anglais/);
        const w = m?.[1]?.trim().replace(/^(le|la|les|l|un|une) /, '');
        if (w && DICO[w]) return { text: `« ${w} », en anglais, ça se dit « ${DICO[w]} » ! Facile, non ?` };
        if (w) return { text: `Hmm… « ${w} » en anglais ? Je ne connais pas celui-là. Je ne connais que les mots de dragon : fire, wing, treasure, friend…` };
        return { text: 'A little bit ! Hello, I am a dragon, and you are my best friend. Pas mal, non ?' };
      }
      case 'meteo_dit': {
        const t = heard.map(norm).join(' ');
        if (/ neige| grele/.test(t)) return { text: pickFrom(['Il neige ?! J’adore faire fondre les flocons. Couvre-toi bien !', 'De la neige ! Fais un bonhomme de neige… avec une écharpe de dragon.']), anim: 'happy' };
        if (/ orage| tonnerre| eclair/.test(t)) return { text: pickFrom(['De l’orage ? Brrr… Je fais le courageux, mais je me colle au loup.', 'Reste à l’intérieur ! Les éclairs, c’est le seul feu qui me fait peur.']) };
        if (/ pleut| pluie/.test(t)) return { text: pickFrom(['Il pleut ? Parfait pour rester au chaud avec moi. Un jeu, une histoire ?', 'La pluie… Pense au parapluie si tu sors !']) };
        if (/ arc en ciel/.test(t)) return { text: 'Un arc-en-ciel ! Fais un vœu, vite ! Les dragons disent que ça porte bonheur.', anim: 'happy' };
        if (/ vent/.test(t)) return { text: 'Du vent ! Parfait pour voler… Accroche bien ton bonnet.' };
        if (/ brouillard/.test(t)) return { text: 'Du brouillard… même le loup s’y perdrait. Fais attention en marchant.' };
        if (/ moche| gris/.test(t)) return { text: 'Un temps gris ? On met de la couleur ici : une partie de pêche au coucher du soleil ?' };
        return { text: pickFrom(['Il fait beau ? Trop bien ! Une petite balade ? Tes pas me rapportent de l’or.', 'Du soleil ! Mes écailles adorent ça.']), anim: 'happy' };
      }
      case 'heure_avis': {
        if (h >= 21 || h < 5) return { text: kid ? 'Oui, il est tard… File au lit, je garde la grotte !' : 'Il est tard, oui. Tu devrais te reposer, tu en as besoin.', anim: 'yawn' };
        if (h < 8) return { text: 'Oui, il est tôt ! Tu es une vraie lève-tôt. Moi, je baille encore.' };
        return { text: `Il est ${h} heure${h > 1 ? 's' : ''}${mi ? ` ${mi}` : ''}. Ni trop tôt, ni trop tard : parfait pour un câlin.` };
      }
      case 'mange_quoi':
        if (c.hunger >= 70) return { text: pickFrom(['Une bonne ration de dragon, et un poisson. Je suis bien calé !', 'J’ai mangé, merci ! Mon ventre est tout chaud.']) };
        return { text: 'Pas grand-chose… Tu me donnes à manger ?', then: 'feed' };
      case 'tours':
        if (!c.tricks.length) return { text: 'Je débute ! Plus on est amis, plus j’apprends de tours.' };
        return { text: `Je sais faire : ${c.tricks.slice(0, 6).join(', ')}. Dis-le moi et je le fais ! Les autres tours s’apprennent avec l’amitié et les mini-jeux.` };
      case 'weekend': {
        const d = c.now.getDay();
        if (d === 0 || d === 6) return { text: 'Mais c’est le week-end ! Profite !', anim: 'happy' };
        const n = 6 - d;
        return { text: n === 1 ? 'Demain ! Encore une journée de courage.' : `Dans ${n} jours. Courage, ça arrive vite !` };
      }
      case 'saison': {
        const m = c.now.getMonth() + 1, d = c.now.getDate();
        const s = (m === 12 && d >= 21) || m <= 2 || (m === 3 && d < 20) ? 'l’hiver' : (m === 3 || m <= 5 || (m === 6 && d < 21)) ? 'le printemps' : (m <= 8 || (m === 9 && d < 22)) ? 'l’été' : 'l’automne';
        return { text: `On est en ${s.replace('l’', '').replace('le ', '')} ! ${s === 'l’automne' ? 'Les feuilles tombent, parfait pour se blottir au chaud.' : s === 'l’hiver' ? 'Mon feu sert de chauffage à tout le monde.' : s === 'l’été' ? 'Les lucioles dansent le soir.' : 'Les fleurs sentent bon, le loup éternue.'}`.replace('en automne', 'en automne').replace('On est en été', 'On est en été').replace('On est en printemps', 'On est au printemps') };
      }
      case 'histoire_theme': {
        const t = heard.map(norm).join(' ');
        if (/pirate/.test(t)) return { text: 'Histoire de pirates : le capitaine Barbe-Grise voulait voler le trésor d’un dragon. Il navigua trois jours, trouva la grotte… et le dragon lui offrit un thé. Ils devinrent amis, et le trésor ? C’était une collection de coquillages. Fin !' };
        if (/peur|fantome|horreur/.test(t)) return { text: 'Une histoire qui fait un peu peur… Une nuit, le loup entendit « tic… tac… tic… » dans la grotte. Il chercha partout, le poil hérissé. C’était… le réveil oublié sous mon aile. Fin ! Tu as eu peur ?' };
        if (/princesse|chevalier/.test(t)) return { text: 'Il était une fois une princesse qui voulait devenir chevalier. Tout le monde riait. Alors elle apprit à monter un dragon. Plus personne ne rit, et elle devint la protectrice du royaume. Fin !' };
        if (/loup/.test(t)) return { text: 'L’histoire du petit loup : il avait peur de tout, même de son ombre. Un jour, un dragonneau perdu pleura dans la forêt. Le petit loup oublia sa peur et le ramena chez lui. Depuis, ils ne se quittent plus. Ça te rappelle quelqu’un ?' };
        if (/dormir|soir/.test(t)) return { text: 'Une histoire pour dormir : la lune, chaque soir, envoie une petite étoile garder chaque enfant qui dort. Ce soir, la tienne est déjà là, juste au-dessus de ton lit. Elle brille doucement… Ferme les yeux. Bonne nuit.' };
        return this.dynamic('histoire', heard, c, prevCtx);
      }
      case 'niveau': return { text: `Je suis au niveau ${c.level}. Chaque quête et chaque soin me fait grandir. Un jour, je serai immense !` };
      case 'amitie': return { text: `Bien sûr qu’on est amis ! Notre amitié est au niveau « ${c.bond} ». Et elle grandit à chaque câlin.`, anim: 'purr', fx: 'hearts' };
      case 'histoire': {
        const i = this.mem.story % STORY.length;
        this.mem.story++;
        return { text: STORY[i] };
      }
      case 'blague': return { text: this.choose(JOKES, c, 'joke'), anim: 'giggle' };
      case 'devinette': {
        const i = this.mem.riddle % RIDDLES.length;
        this.mem.riddle++;
        this.mem.riddleOpen = i;
        this.mem.riddleTries = 0;
        this.ask('devinette');
        return { text: `Devinette ! ${RIDDLES[i].q}` };
      }
      case 'devinette_abandon': {
        if (this.mem.riddleOpen === null) return { text: 'Quelle devinette ? Je n’en ai pas posé ! Dis « devinette » et je t’en pose une.' };
        const r = RIDDLES[this.mem.riddleOpen];
        this.mem.riddleOpen = null;
        return { text: `La réponse, c’était : ${r.say} ! Tu en veux une autre ? Dis « devinette ».` };
      }
      case 'devinette_rep': {
        const r = RIDDLES[this.mem.riddleOpen ?? 0];
        const said = heard.map(norm).join(' ');
        const good = r.a.some(a => said.includes(' ' + norm(a).trim()));
        if (good) {
          this.mem.riddleOpen = null;
          const day = c.now.toDateString();
          if (this.mem.riddleDay !== day) { this.mem.riddleDay = day; this.mem.riddleWins = 0; }
          const gold = this.mem.riddleWins < 3 ? 5 : 0;
          this.mem.riddleWins++;
          return { text: `Bravo ! C’était bien ${r.say} ! ${gold ? 'Tiens, 5 pièces d’or pour ton cerveau de génie.' : 'Tu es trop forte.'}`, anim: 'cheer', gold };
        }
        if (prevCtx === 'devinette' && this.mem.riddleTries < 1) {
          this.mem.riddleTries++;
          this.ask('devinette');
          return { text: pickFrom(['Non, ce n’est pas ça… Essaie encore ! Ou dis « je donne ma langue au chat ».', 'Raté ! Encore un essai ?']) };
        }
        this.mem.riddleOpen = null;
        return { text: `Presque ! La réponse était : ${r.say}. On en fait une autre ?` };
      }
      case 'encore': {
        const last = this.mem.last;
        if (last === 'blague') return this.dynamic('blague', heard, c, prevCtx);
        if (last === 'histoire') return this.dynamic('histoire', heard, c, prevCtx);
        if (last === 'devinette' || last === 'devinette_rep' || last === 'devinette_abandon') return this.dynamic('devinette', heard, c, prevCtx);
        return { text: 'Encore quoi ? Une histoire, une blague, ou une devinette ?' };
      }
    }
    return { text: pickFrom(FALLBACK) };
  }
}

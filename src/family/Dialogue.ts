// Conversation avec le dragon : on lui parle librement, il reconnaît le sujet par mots-clés
// et répond à partir de la banque de répliques (DialogueData). Tout se passe sur le téléphone :
// rien de ce qui est dit n'est enregistré ni envoyé.
import { FALLBACK, INTENTS, JOKES, OPENERS, RIDDLES, STORY, type IntentDef } from './DialogueData.js';

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
  now: Date;
}

export interface TalkReply { text: string; anim?: string; fx?: string; then?: IntentDef['then']; intent: string; gold?: number }

interface Mem { ctx: string | null; ctxAt: number; recent: string[]; story: number; riddle: number; riddleOpen: number | null; last: string | null; riddleDay: string; riddleWins: number; riddleTries: number }
const KEY = 'quete-du-dragon:talk';

/** Sans accents, minuscules, ponctuation en espaces. */
export const norm = (s: string) => ' ' + s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/['’]/g, ' ').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim() + ' ';

/** La dragonne parle d'elle au féminin (les répliques sont écrites au masculin). */
const FEM: Array<[RegExp, string]> = [
  [/\bContent\b/g, 'Contente'], [/\bcontent\b/g, 'contente'], [/\bFier\b/g, 'Fière'], [/\bfier\b/g, 'fière'], [/\bprêt\b/g, 'prête'], [/\bJe suis né\b/g, 'Je suis née'],
  [/\btout propre\b/g, 'toute propre'], [/\bTout propre\b/g, 'Toute propre'], [/\brayonnant\b/g, 'rayonnante'], [/\bplein comme\b/g, 'pleine comme'], [/\bpoussiéreux\b/g, 'poussiéreuse'],
  [/\bvégétarien\b/g, 'végétarienne'], [/\btout seul\b/g, 'toute seule'], [/\bJe suis sûr\b/g, 'Je suis sûre'], [/\bdésolé\b/g, 'désolée'], [/\bJe suis un dragon\b/g, 'Je suis une dragonne'],
  [/\bun dragon de câlins\b/g, 'une dragonne de câlins'], [/\bun dragon d’appli\b/g, 'une dragonne d’appli'], [/\bun vrai dragon\b/g, 'une vraie dragonne'], [/\bton dragon\b/g, 'ta dragonne'],
  [/\bmon meilleur copain\b/g, 'mon meilleur copain'], [/\bJe suis prêt\b/g, 'Je suis prête'], [/\bheureux\b/g, 'heureuse'], [/\bJe suis tout\b/g, 'Je suis toute'], [/\bje suis sûr\b/g, 'je suis sûre'], [/\bsuis pas sûr\b/g, 'suis pas sûre'], [/\bje suis tout\b/g, 'je suis toute'], [/\btout écailles\b/g, 'toute écailles']
];
const feminine = (t: string) => FEM.reduce((acc, [re, to]) => acc.replace(re, to), t);

const pickFrom = <T>(list: T[]): T => list[Math.floor(Math.random() * list.length)];

export class Dialogue {
  private mem: Mem;
  constructor(private storageKey = KEY) {
    let m: Partial<Mem> = {};
    try { m = JSON.parse(localStorage.getItem(storageKey) ?? '{}') as Partial<Mem>; } catch { /* */ }
    this.mem = { ctx: null, ctxAt: 0, recent: [], story: 0, riddle: Math.floor(Math.random() * RIDDLES.length), riddleOpen: null, last: null, riddleDay: '', riddleWins: 0, riddleTries: 0, ...m };
  }
  private save(): void { try { localStorage.setItem(this.storageKey, JSON.stringify(this.mem)); } catch { /* */ } }

  opener(c: TalkCtx): string { return this.fill(pickFrom(OPENERS), c); }

  /** Le dragon attend-il une réponse précise ? */
  get waiting(): string | null { return this.mem.ctx && Date.now() - this.mem.ctxAt < 3 * 60000 ? this.mem.ctx : null; }

  /** Trouve le sujet de la phrase (meilleur score de mots-clés ; un sujet attendu passe avant). */
  match(heard: string[], c: TalkCtx): IntentDef | null {
    const waiting = this.waiting;
    let best: IntentDef | null = null, bestScore = 0;
    for (const phrase of heard.slice(0, 3)) {
      let p = norm(phrase);
      // le nom du dragon et du loup ne comptent pas comme des mots-clés
      for (const n of [c.dragon, c.wolf]) if (n) { const nn = norm(n).trim(); if (nn) p = p.split(' ' + nn + ' ').join(n === c.wolf ? ' le loup ' : ' '); }
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
    return best;
  }

  /** Réponse du dragon à ce qui a été entendu (plusieurs propositions de la reconnaissance vocale). */
  reply(heard: string[], c: TalkCtx): TalkReply {
    const it = this.match(heard, c);
    const prevCtx = this.waiting;
    this.mem.ctx = null;
    let out: TalkReply;
    if (!it) out = { text: this.choose(FALLBACK.map(t => t), c, 'fallback'), intent: 'fallback' };
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
        return { text: 'J’adore les fêtes ! À Noël, à Pâques, à ton anniversaire… je décore toute la grotte.' };
      }
      case 'anniv': {
        const b = c.birthdayIn;
        if (b === 0) return { text: `C’est aujourd’hui ! JOYEUX ANNIVERSAIRE${c.person ? ' ' + c.person : ''} ! Je te souffle un feu d’artifice !`, anim: 'cheer', fx: 'confetti' };
        if (b === null) return { text: 'Je ne connais pas la date de ton anniversaire ! Règle-la dans ton profil, et je le fêterai avec toi.' };
        if (b <= 30) return { text: `Ton anniversaire, c’est dans ${b} jour${b > 1 ? 's' : ''} ! J’ai déjà une idée de cadeau…` };
        return { text: `Ton anniversaire est dans ${b} jours. Je compte, je compte !` };
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
        const r = RIDDLES[this.mem.riddleOpen ?? 0];
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

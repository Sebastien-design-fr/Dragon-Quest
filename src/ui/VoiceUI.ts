// Ordres à la voix : on appuie sur le micro, on dit « Crache du feu ! », le dragon obéit (s'il connaît le tour).
// Une seule écoute courte à chaque appui : rien n'écoute en arrière-plan.
import { STATS } from '../family/Training.js';
import type { SpeechEvent } from '../link/Transport.js';
import type { App } from './App.js';
import { ICONS, h, icon } from './dom.js';

/** Sans accents, minuscules, ponctuation retirée. */
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

export interface Command { id: string; label: string; words: string[]; unlocked: boolean; need: string; run: () => void }

/** Ordres possibles (tours d'amitié, tours d'entraînement, quelques gestes toujours permis). Les plus précis d'abord. */
export function commands(app: App): Command[] {
  const comp = app.family.companion!;
  const training = app.family.training;
  const list: Command[] = [];
  const friend: Record<string, string[]> = {
    ring: ['anneau', 'cercle de feu', 'couronne'],
    fire: ['crache', 'feu', 'flamme', 'souffle', 'brule'],
    attack: ['griffe', 'attaque', 'coup de patte', 'griffes'],
    bow: ['reverence', 'salue', 'salut', 'incline'],
    hover: ['vole', 'envole', 'decolle', 'vol', 'voler'],
    dance: ['danse', 'danser'],
    roar: ['rugis', 'rugissement', 'rugir', 'grogne', 'crie']
  };
  const trainingWords: Record<string, string[]> = {
    storm: ['tempete'], fireball: ['boule de feu', 'boule'], pirouette: ['pirouette', 'tourne'],
    looping: ['looping'], wise_bow: ['sage'], dash: ['eclair']
  };
  if (training) for (const t of training.tricks()) {
    const stat = STATS.find(s => s.id === t.stat)?.label ?? t.stat;
    list.push({ id: 'tr_' + t.id, label: t.label, words: trainingWords[t.id] ?? [], unlocked: t.unlocked, need: `${stat} ${t.level}`,
      run: () => { void app.act(t.anim); app.view.emit(t.stat === 'feu' ? 'fireRing' : 'happySparkle', 'head_anchor'); comp.practise('tr_' + t.id, t.label); } });
  }
  for (const t of comp.tricks()) {
    list.push({ id: t.id, label: t.label, words: friend[t.id] ?? [], unlocked: t.unlocked, need: `Amitié ${t.level}`,
      run: () => { void app.act(t.anim); if (comp.stars(t.id) >= 3) app.view.emit('happySparkle', 'head_anchor'); comp.practise(t.id, t.label); } });
  }
  // gestes toujours permis
  list.push({ id: 'hello', label: 'Bonjour', words: ['bonjour', 'coucou', 'salut toi', 'hello'], unlocked: true, need: '', run: () => void app.act('happy') });
  list.push({ id: 'praise', label: 'Bravo', words: ['bravo', 'gentil', 'bon dragon', 'bonne dragonne', 'je t aime', 'trop beau', 'trop belle', 'magnifique'], unlocked: true, need: '',
    run: () => { void app.act('purr'); app.view.emit('hearts', 'head_anchor'); } });
  return list;
}

/** Trouve l'ordre dans les phrases entendues (plusieurs propositions du téléphone). */
export function matchCommand(list: Command[], heard: string[]): Command | null {
  // l'ordre le plus précis l'emporte (« anneau de feu » plutôt que « feu »)
  for (const phrase of heard) {
    const p = ' ' + norm(phrase) + ' ';
    let best: Command | null = null, score = 0;
    for (const c of list) for (const w of c.words) {
      if ((p.includes(' ' + w + ' ') || (w.length > 4 && p.includes(w))) && w.length > score) { best = c; score = w.length; }
    }
    if (best) return best;
  }
  return null;
}

let busy = false;

/** Écoute un ordre et le fait exécuter. */
export async function startVoice(app: App): Promise<void> {
  const comp = app.family.companion;
  if (!comp || busy) return;
  if (app.sleeping) { app.say('Chut… il dort. Réveille-le d’abord.', null, 2500); return; }
  busy = true;
  const link = app.family.link;
  const said = h('div', { class: 'vc-said' }, '…');
  const bars = h('div', { class: 'vc-bars' }, ...Array.from({ length: 5 }, () => h('i')));
  const label = h('div', { class: 'sn-label' }, 'Je t’écoute…');
  const overlay = h('div', { class: 'sn-blow vc' },
    h('div', { class: 'sn-card' }, h('span', { class: 'vc-mic' }, icon(ICONS.mic, 30)), label, bars, said,
      h('p', { class: 'small muted' }, `Dis par exemple : « ${comp.name}, crache du feu ! »`),
      h('button', { class: 'btn ghost small-btn', onclick: () => void link.stopListening() }, 'Arrêter')));
  app.root.querySelector('.stage-view')?.append(overlay);
  app.view.lookAt(window.innerWidth / 2, window.innerHeight * 0.75);
  const onEv = (e: SpeechEvent) => {
    if (!overlay.isConnected) return;
    if (e.state === 'ready') label.textContent = 'Je t’écoute…';
    if (e.state === 'speaking') overlay.classList.add('hot');
    if (e.state === 'thinking') { label.textContent = 'Il réfléchit…'; overlay.classList.remove('hot'); }
    if (e.state === 'partial' && e.text) said.textContent = `« ${e.text} »`;
    if (e.state === 'level') {
      const k = Math.max(0, Math.min(1, ((e.level ?? 0) + 2) / 12));
      bars.querySelectorAll('i').forEach((b, i) => { (b as HTMLElement).style.transform = `scaleY(${(0.25 + k * (0.6 + 0.4 * Math.sin(i * 1.7 + performance.now() / 120))).toFixed(2)})`; });
    }
  };
  listenerOnce(app, onEv);
  current = onEv;
  const res = await link.listen(6000);
  current = null;
  overlay.classList.add('out');
  setTimeout(() => overlay.remove(), 300);
  app.view.lookAt(null);
  busy = false;
  if (res.error && !res.matches.length) {
    if (res.error === 'permission') app.toast('Autorise le micro pour lui parler, puis réessaie');
    else if (res.error === 'unavailable') app.toast('La reconnaissance vocale n’est pas disponible sur ce téléphone');
    else if (res.error === 'network') app.toast('La reconnaissance vocale a besoin d’Internet sur ce téléphone');
    else app.say('Hein ? Je n’ai rien entendu. Parle un peu plus fort !', null, 3000);
    return;
  }
  const list = commands(app);
  const cmd = matchCommand(list, res.matches);
  const heard = res.matches[0] ?? '';
  if (!cmd) {
    void app.act('dizzy');
    app.say(`« ${heard} » ? Je ne connais pas cet ordre… Essaie « crache du feu », « la révérence » ou « danse ».`, null, 5000);
    return;
  }
  if (!cmd.unlocked) {
    app.say(`${cmd.label} ? Je ne sais pas encore le faire… (${cmd.need})`, null, 4000);
    return;
  }
  cmd.run();
}

// un seul abonnement aux événements de la reconnaissance (le natif garde les écouteurs)
let current: ((e: SpeechEvent) => void) | null = null;
let subscribed = false;
function listenerOnce(app: App, _cb: (e: SpeechEvent) => void): void {
  if (subscribed) return;
  subscribed = true;
  app.family.link.onSpeech(e => current?.(e));
}

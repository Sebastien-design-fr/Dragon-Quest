// « Parler avec lui » : conversation à la voix (ou au clavier) avec le dragon.
// On appuie sur le micro, on parle ; il répond (bulle + voix de dragon) puis réécoute tout seul quelques tours.
// Les ordres (« crache du feu ! ») déclenchent les tours. Rien n'est enregistré ni envoyé.
import { Dialogue, norm, type TalkCtx, type TalkReply } from '../family/Dialogue.js';
import { FOODS } from '../family/Companion.js';
import type { SpeechEvent } from '../link/Transport.js';
import type { App } from './App.js';
import { gamesSheet } from './CareSheets.js';
import { ICONS, h, icon } from './dom.js';
import { isBirthday } from './Events.js';
import { activeEvent } from './Seasonal.js';
import { commands, matchCommand } from './VoiceUI.js';
import { currentWeather } from './Weather.js';

let dialogue: Dialogue | null = null;
let panel: HTMLElement | null = null;

/** « à la forêt des brumes », « au lac d’argent », « aux cimes », « à l’île ». */
function toPlace(name: string): string {
  if (name.startsWith('La ')) return 'à la ' + name.slice(3);
  if (name.startsWith('Le ')) return 'au ' + name.slice(3);
  if (name.startsWith('Les ')) return 'aux ' + name.slice(4);
  if (name.startsWith('L’')) return 'à l’' + name.slice(2);
  return 'à ' + name;
}

function daysToBirthday(app: App, now: Date): number | null {
  const b = app.state.data.settings.birthday;
  if (!b) return null;
  if (isBirthday(app, now)) return 0;
  const [m, d] = b.split('-').map(Number);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let next = new Date(now.getFullYear(), m - 1, d);
  if (next < today) next = new Date(now.getFullYear() + 1, m - 1, d);
  return Math.round((next.getTime() - today.getTime()) / 86400000);
}

function talkCtx(app: App): TalkCtx {
  const comp = app.family.companion!;
  const v = app.family.voyage;
  const now = new Date();
  const moodKey = comp.mood().key;
  const mood = (['great', 'good', 'meh', 'sad'].includes(moodKey) ? moodKey : 'good') as TalkCtx['mood'];
  const trip = v?.data.trip ?? null;
  const away = !!v?.away();
  const book = app.family.book;
  const today = !app.isParent && book ? book.today() : null;
  const wx = app.state.data.settings.weather !== false ? currentWeather() : null;
  return {
    role: app.isParent ? 'parent' : 'kid',
    dragon: comp.name,
    person: (!app.isParent && book?.childName && book.childName !== 'Votre enfant' ? book.childName : '') || app.family.linkState.deviceName || '',
    wolf: v?.wolfName(true) ?? 'Le loup',
    wolfAway: away && trip ? toPlace(v!.dest(trip.dest).name) : null,
    wolfBack: !!v?.data.back,
    wolfMinutes: away ? Math.round(v!.remaining() / 60000) : 0,
    mood,
    hunger: comp.data.hunger, clean: comp.data.clean,
    fav: comp.data.favKnown ? (FOODS.find(f => f.id === comp.data.fav)?.label.toLowerCase() ?? null) : null,
    level: app.state.data.level,
    stage: app.view.stage?.label ?? 'dragon',
    bond: comp.bondLevel().label,
    weather: wx ? { kind: wx.kind, temp: wx.temp } : null,
    event: activeEvent(app),
    tasksLeft: today ? today.filter(t => t.status === 'todo' || t.status === 'refused').map(t => t.mission.title) : null,
    tasksDone: today ? today.filter(t => t.status === 'done' || t.status === 'pending').length : 0,
    birthdayIn: daysToBirthday(app, now),
    now
  };
}

/** Un ordre plutôt qu'une question : « crache du feu », « Pyros, danse ! », « fais une révérence », « tu peux voler ? ». */
function asCommand(app: App, heard: string[]) {
  const list = commands(app);
  const comp = app.family.companion!;
  for (const phrase of heard.slice(0, 2)) {
    let p = norm(phrase);
    const nn = norm(comp.name).trim();
    if (nn) p = p.split(' ' + nn + ' ').join(' ');
    p = ' ' + p.replace(/^ (allez|vas y|aller|hop|dis|eh|hey|s il te plait) /, ' ').trim() + ' ';
    const imperative = /^ (fais|fait|montre|tu peux|peux tu|tu sais|refais|encore|crache|lance|danse|vole|rugis|salue|griffe|attaque|envole|tourne|souffle|fait nous|fais nous|fais moi|montre moi)/.test(p);
    if (!imperative) continue;
    const c = matchCommand(list, [p]);
    if (c) return c;
  }
  return null;
}

export function openTalk(app: App): void {
  const comp = app.family.companion;
  if (!comp || panel) return;
  if (!dialogue) dialogue = new Dialogue(app.isParent ? 'quete-du-dragon:talk:parent' : 'quete-du-dragon:talk');
  const d = dialogue;
  const link = app.family.link;
  const log = h('div', { class: 'tk-log' });
  const status = h('div', { class: 'tk-status small muted' }, 'Appuie sur le micro et parle-lui');
  const bars = h('span', { class: 'vc-bars' }, ...Array.from({ length: 5 }, () => h('i')));
  const micBtn = h('button', { class: 'tk-mic', 'aria-label': 'Parler' }, icon(ICONS.mic, 28)) as HTMLButtonElement;
  const input = h('input', { type: 'text', placeholder: 'Écris-lui…', 'aria-label': 'Écrire au dragon', maxlength: '140', enterkeyhint: 'send' }) as HTMLInputElement;
  const send = h('button', { class: 'btn small-btn', 'aria-label': 'Envoyer' }, '➤');
  const closeBtn = h('button', { class: 'tk-close', 'aria-label': 'Fermer' }, '×');
  panel = h('div', { class: 'tk-panel', role: 'dialog', 'aria-label': `Parler avec ${comp.name}` },
    h('div', { class: 'tk-head' }, h('strong', null, `Parler avec ${comp.name}`), closeBtn),
    log, status,
    h('div', { class: 'tk-controls' }, micBtn, bars, h('form', { class: 'tk-type', onsubmit: (e: Event) => { e.preventDefault(); submitText(); } }, input, send)));
  app.root.append(panel);
  requestAnimationFrame(() => panel?.classList.add('in'));

  let listening = false, speaking = false, closed = false, turns = 0, exchanges = 0;
  const addLine = (who: 'me' | 'him', text: string) => {
    log.append(h('div', { class: `tk-line ${who}` }, text));
    while (log.children.length > 6) log.firstElementChild?.remove();
    log.scrollTop = log.scrollHeight;
  };
  const setStatus = (t: string) => { status.textContent = t; };
  const close = () => {
    if (closed) return;
    closed = true;
    void link.stopListening(); void link.stopSpeaking();
    current = null;
    panel?.classList.remove('in');
    const p = panel; panel = null;
    setTimeout(() => p?.remove(), 250);
    app.view.lookAt(null);
    if (exchanges >= 3) rewardOnce(app);
  };
  closeBtn.addEventListener('click', close);

  const voiceOn = () => app.state.data.settings.talkVoice !== false;
  const speak = async (text: string) => {
    if (!voiceOn() || closed) return;
    speaking = true;
    setStatus(`${comp.name} parle…`);
    const pitch = app.isParent ? 0.92 : 0.72;
    await link.speak(text.replace(/[«»]/g, ''), pitch, 0.96);
    speaking = false;
  };

  const answer = async (heard: string[], byVoice: boolean) => {
    if (closed) return;
    const said = heard[0] ?? '';
    addLine('me', said);
    exchanges++;
    // un ordre ? il fait le tour
    const cmd = asCommand(app, heard);
    let r: TalkReply;
    if (cmd) {
      if (!cmd.unlocked) r = { text: `${cmd.label} ? Je ne sais pas encore le faire… (${cmd.need})`, intent: 'cmd-locked' };
      else { cmd.run(); r = { text: pick(['Regarde bien !', 'Et voilà !', 'Avec plaisir !', 'Admire un peu !']), intent: 'cmd' }; }
    } else r = d.reply(heard, talkCtx(app));
    addLine('him', r.text);
    if (r.anim && !cmd) void app.act(r.anim);
    if (r.fx) app.view.emit(r.fx === 'confetti' ? 'rewardBurst' : r.fx, 'head_anchor');
    if (r.gold) { app.state.addGold(r.gold); }
    await speak(r.text);
    if (closed) return;
    if (r.then === 'end') { setTimeout(close, voiceOn() ? 400 : 2200); return; }
    if (r.then === 'games') { setTimeout(() => { close(); gamesSheet(app); }, 900); return; }
    if (r.then === 'feed' || r.then === 'wash') { const a = r.then; setTimeout(() => { close(); app.focusAction(a); }, 1200); return; }
    // conversation continue : il réécoute tout seul quelques tours après une réponse à la voix
    if (byVoice && turns < 8) { turns++; setTimeout(() => void listen(true), 350); }
    else setStatus('Appuie sur le micro pour lui répondre');
  };

  const listen = async (auto = false) => {
    if (listening || speaking || closed) return;
    if (app.sleeping) { addLine('him', 'Zzz… (il dort. Réveille-le d’abord !)'); return; }
    listening = true;
    panel?.classList.add('listening');
    setStatus(auto ? 'Je t’écoute… (ou ferme pour arrêter)' : 'Je t’écoute…');
    app.view.lookAt(window.innerWidth / 2, window.innerHeight * 0.8);
    current = (e: SpeechEvent) => {
      if (e.state === 'partial' && e.text) setStatus(`« ${e.text} »`);
      if (e.state === 'thinking') setStatus('Il réfléchit…');
      if (e.state === 'level') {
        const k = Math.max(0, Math.min(1, ((e.level ?? 0) + 2) / 12));
        bars.querySelectorAll('i').forEach((b, i) => { (b as HTMLElement).style.transform = `scaleY(${(0.25 + k * (0.6 + 0.4 * Math.sin(i * 1.7 + performance.now() / 120))).toFixed(2)})`; });
      }
    };
    hook(app);
    const res = await link.listen(7000);
    current = null;
    listening = false;
    panel?.classList.remove('listening');
    if (closed) return;
    if (res.error && !res.matches.length) {
      if (res.error === 'permission') setStatus('Autorise le micro, puis réappuie sur le bouton');
      else if (res.error === 'unavailable') { setStatus('Pas de reconnaissance vocale sur ce téléphone : écris-lui !'); input.focus(); }
      else if (res.error === 'network') setStatus('La reconnaissance vocale a besoin d’Internet ici. Tu peux aussi écrire.');
      else setStatus(auto ? 'Je n’entends plus rien. Appuie sur le micro pour reprendre.' : 'Je n’ai rien entendu… réessaie ?');
      return;
    }
    await answer(res.matches, true);
  };
  micBtn.addEventListener('click', () => { turns = 0; if (speaking) { void link.stopSpeaking(); } if (listening) void link.stopListening(); else void listen(); });
  const submitText = () => {
    const t = input.value.trim();
    if (!t || closed) return;
    input.value = '';
    turns = 99; // au clavier : pas de réécoute automatique
    void answer([t], false);
  };
  send.addEventListener('click', e => { e.preventDefault(); submitText(); });

  // il ouvre la conversation, puis écoute tout de suite
  const hello = d.waiting ? null : d.opener(talkCtx(app));
  if (hello) addLine('him', hello);
  setTimeout(() => void listen(), 250);
}

const pick = <T>(l: T[]) => l[Math.floor(Math.random() * l.length)];

// un seul abonnement aux événements de la reconnaissance (partagé avec les ordres simples)
let current: ((e: SpeechEvent) => void) | null = null;
let hooked = false;
function hook(app: App): void {
  if (hooked) return;
  hooked = true;
  app.family.link.onSpeech(e => current?.(e));
}

/** Première vraie conversation du jour : un peu de bonne humeur pour le dragon. */
function rewardOnce(app: App): void {
  const key = 'quete-du-dragon:talk-day:' + (app.isParent ? 'p' : 'k');
  const day = new Date().toDateString();
  try { if (localStorage.getItem(key) === day) return; localStorage.setItem(key, day); } catch { return; }
  app.family.companion?.cheer();
  app.view.emit('hearts', 'head_anchor');
}

/** Bouton micro posé sur la scène (seulement sur son propre dragon). */
export function installTalk(app: App): void {
  const fab = h('button', { class: 'talk-fab', 'aria-label': 'Parler avec ton dragon', onclick: () => openTalk(app) }, icon(ICONS.mic, 22), h('span', null, 'Parler'));
  // sous la carte d'état (colonne de gauche) : le coin droit est pris par le badge du loup en quête
  const col = app.root.querySelector('.sh-left');
  if (col) col.append(fab); else app.root.querySelector('.stage-view')?.append(fab);
  const sync = () => { fab.hidden = !app.family.companion || !app.showingOwn || app.currentId !== 'dragon' || !!panel || app.root.classList.contains('lair-edit'); };
  sync();
  window.setInterval(sync, 800);
}

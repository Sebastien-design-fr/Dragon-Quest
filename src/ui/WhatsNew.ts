// Panneau « Nouveautés » : affiché une fois après une mise à jour qui apporte quelque chose de visible.
import { APP_VERSION, type App } from './App.js';
import { ICONS, h, icon } from './dom.js';
import { openSheet } from './screens/common.js';

const KEY = 'quete-du-dragon:news-seen';

interface News { version: string; items: Array<{ icon: string; title: string; text: string; parentOnly?: boolean; childOnly?: boolean }> }

/** Du plus récent au plus ancien. */
const NEWS: News[] = [
  { version: '0.29.3', items: [
    { icon: ICONS.flame, title: 'Le feu se sent', text: 'Les flammes éclairent la grotte, le loup se tapit puis se secoue, le téléphone vibre au rythme du feu et le son suit tout le tour. Pendant les fêtes, le souffle a sa petite surprise.' }
  ] },
  { version: '0.29.2', items: [
    { icon: ICONS.flame, title: 'Un vrai souffle de feu', text: 'Ton dragon recule d’un bond pour prendre son élan, crache de vraies flammes (avec braises et fumée), puis revient à sa place.' }
  ] },
  { version: '0.29.1', items: [
    { icon: ICONS.star, title: 'Nouvelles illustrations', text: 'Les accessoires du loup, les décors des fêtes, la gamelle, la balle de feu et les gemmes ont été repeints.' }
  ] },
  { version: '0.29.0', items: [
    { icon: ICONS.compass, title: 'Le loup compagnon', text: 'Donne-lui un nom, caresse-le, offre-lui une friandise, envoie-le en quête pour ton dragon. Il gagne des niveaux, et tu peux lui acheter un foulard, un collier, une médaille ou une grande sacoche.' },
    { icon: ICONS.heart, title: 'La journée du dragon', text: 'Sous la scène, la ligne « Aujourd’hui » montre tes soins, quêtes, pas et le loup. Fais les 5 soins du jour pour un petit bonus.' },
    { icon: ICONS.gift, title: 'Les fêtes de l’année', text: 'Noël, Nouvel An, Saint-Valentin, Pâques (chasse aux œufs), l’été… et ton anniversaire : règle sa date dans le profil, ton dragon le fêtera.' },
    { icon: ICONS.foot, title: 'Tes pas comptent', text: 'Le téléphone compte tes pas : chaque palier rapporte de l’XP et de l’or, et raccourcit les quêtes du loup.' },
    { icon: ICONS.wifi, title: 'Sortie en famille', text: 'Dehors ensemble ? Coche « Sortie en famille » : vos dragons se retrouvent et les messages passent sans Wi-Fi.' },
    { icon: ICONS.settings, title: 'Confort', text: 'Taille du texte réglable et lumière tamisée le soir, dans le profil (Famille pour les parents).' }
  ] }
];

const cmp = (a: string, b: string) => { const x = a.split('.').map(Number), y = b.split('.').map(Number); for (let i = 0; i < 3; i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) - (y[i] ?? 0); return 0; };

export function installWhatsNew(app: App): void {
  let seen = '';
  try { seen = localStorage.getItem(KEY) ?? ''; } catch { /* */ }
  const mark = () => { try { localStorage.setItem(KEY, APP_VERSION); } catch { /* */ } };
  // première installation : rien à annoncer
  if (!seen && !app.family.companion?.data.name) { mark(); return; }
  const fresh = NEWS.filter(n => !seen || cmp(n.version, seen) > 0);
  if (!fresh.length) { mark(); return; }
  setTimeout(() => {
    if (document.querySelector('.sheet')) { setTimeout(() => installWhatsNew(app), 5000); return; }
    mark();
    const items = fresh.flatMap(n => n.items).filter(i => !(i.parentOnly && !app.isParent) && !(i.childOnly && app.isParent));
    openSheet('Nouveautés', close => [
      h('p', { class: 'small muted' }, `Version ${APP_VERSION}`),
      ...items.map(i => h('div', { class: 'wn-item' }, h('span', { class: 'wn-ico' }, icon(i.icon, 20)), h('div', null, h('strong', null, i.title), h('p', { class: 'small muted' }, i.text)))),
      h('div', { class: 'row end' }, h('button', { class: 'btn primary', onclick: close }, 'Super !'))
    ]);
  }, 2500);
}

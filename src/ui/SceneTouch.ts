// Le décor répond au doigt : cristaux qui tintent, torches qui lancent des étincelles, cascades qui éclaboussent,
// or qui cliquette. La nuit, toucher l'étoile filante (ou le feu follet des grottes fermées) fait un vœu,
// avec une petite surprise (3 par nuit au plus).
import { Sound } from '../engine/Sound.js';
import type { App } from './App.js';
import { floatReward } from './Reactions.js';

const PRESET = { crystal: 'crystalChime', torch: 'torchSparks', lava: 'torchSparks', water: 'splash', gold: 'sparkle' } as const;
const WISHES = [
  'Un vœu ! Je l’ai fait… mais c’est un secret.',
  'J’ai souhaité qu’on joue encore ensemble demain.',
  'Mon vœu : une montagne de guimauves grillées !',
  'J’ai fait le vœu de voler jusqu’à la lune.',
  'J’ai souhaité que tu fasses de jolis rêves.',
  'Mon vœu : que le loup arrête de ronfler !'
];
const WISH_KEY = 'dq.wishes';
let lastSpot = 0;

/** Nuit en cours (une nuit va de midi à midi) : la clé du compteur de vœux. */
function nightKey(): string {
  const d = new Date(Date.now() - 12 * 3600 * 1000);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function wishesTonight(): number {
  try {
    const v = JSON.parse(localStorage.getItem(WISH_KEY) ?? 'null') as { night: string; n: number } | null;
    return v && v.night === nightKey() ? v.n : 0;
  } catch { return 0; }
}

function countWish(): void {
  try { localStorage.setItem(WISH_KEY, JSON.stringify({ night: nightKey(), n: wishesTonight() + 1 })); } catch { /* stockage indisponible */ }
}

/** Le dragon fait un vœu : étoiles, carillon, et une surprise tant qu'il en reste pour cette nuit. */
function makeWish(app: App, clientX: number, clientY: number, wisp: boolean): void {
  app.view.burstAt(clientX, clientY, 'wishStars');
  Sound.scenery('wish');
  const n = wishesTonight();
  countWish();
  if (app.sleeping) { app.say(wisp ? 'Un feu follet… il a souri dans son sommeil.' : 'Une étoile filante… il sourit en dormant.', null, 4000); return; }
  void app.act('happy');
  const line = WISHES[Math.floor(Math.random() * WISHES.length)];
  app.say(wisp ? `Un feu follet ! ${line}` : line, null, 5000);
  if (n >= 3) return; // la surprise, c'est trois fois par nuit
  const roll = Math.random();
  if (roll < 0.6) { const g = 5 + Math.floor(Math.random() * 11); app.state.addGold(g); floatReward(app, 0, g, 600); }
  else { app.state.addXp(10); floatReward(app, 10, 0, 600); }
}

/** Un toucher sur la scène vise-t-il le ciel ou un coin du décor ? Renvoie true s'il a été pris en charge. */
export function sceneTouch(app: App, clientX: number, clientY: number): boolean {
  const v = app.view, b = v.backdrop;
  const p = v.toCanvas(clientX, clientY);
  const dpr = v.canvas.width / (v.canvas.getBoundingClientRect().width || 1);
  if (b.sky.hitShootingStar(p.x, p.y, 36 * dpr)) { makeWish(app, clientX, clientY, !b.sky.hasSky); return true; }
  // le dragon garde ses caresses : un coin du décor caché derrière lui ne répond pas
  if (v.hitTest(clientX, clientY)) return false;
  const spot = b.touchAt(p.x, p.y);
  if (!spot) return false;
  const now = performance.now();
  if (now - lastSpot < 220) return true;
  lastSpot = now;
  v.burstAt(clientX, clientY, PRESET[spot.kind]);
  Sound.scenery(spot.kind, spot.fx);
  return true;
}

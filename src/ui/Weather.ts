// Météo réelle dans la grotte : le ciel suit le temps qu'il fait à Rozay-en-Brie (pluie, neige, brouillard, orage…)
// et le dragon le commente une fois par jour. Service Open-Meteo (gratuit, sans compte, aucune donnée personnelle
// envoyée : seulement les coordonnées fixes de la ville). Lecture toutes les 30 minutes, appli ouverte uniquement.
import type { App } from './App.js';
import { h } from './dom.js';

const LAT = 48.6833, LON = 2.9586;
const KEY = 'quete-du-dragon:weather';
const FORCE = 'quete-du-dragon:weather-force';
const SAID = 'quete-du-dragon:weather-said';

export type WxKind = 'clear' | 'cloudy' | 'fog' | 'drizzle' | 'rain' | 'heavy' | 'snow' | 'storm';
interface Wx { kind: WxKind; temp: number; at: number; isDay: boolean; wind: number }

/** Codes météo OMM → ambiance. */
export function kindOf(code: number): WxKind {
  if (code === 0 || code === 1) return 'clear';
  if (code === 2 || code === 3) return 'cloudy';
  if (code === 45 || code === 48) return 'fog';
  if (code >= 51 && code <= 57) return 'drizzle';
  if (code === 65 || code === 67 || code === 82) return 'heavy';
  if ((code >= 61 && code <= 66) || code === 80 || code === 81) return 'rain';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  if (code >= 95) return 'storm';
  return 'cloudy';
}

function cached(): Wx | null { try { return JSON.parse(localStorage.getItem(KEY) ?? 'null') as Wx | null; } catch { return null; } }

async function fetchWx(): Promise<Wx | null> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current=weather_code,temperature_2m,is_day,wind_speed_10m&timezone=Europe%2FParis`;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 8000);
  try {
    const r = await fetch(url, { signal: ctl.signal });
    if (!r.ok) return null;
    const j = await r.json() as { current?: { weather_code: number; temperature_2m: number; is_day: number; wind_speed_10m: number } };
    const c = j.current;
    if (!c) return null;
    const wx: Wx = { kind: kindOf(c.weather_code), temp: Math.round(c.temperature_2m), at: Date.now(), isDay: c.is_day === 1, wind: c.wind_speed_10m };
    try { localStorage.setItem(KEY, JSON.stringify(wx)); } catch { /* */ }
    return wx;
  } catch { return null; } finally { clearTimeout(timer); }
}

/** Ce que dit le dragon (une fois par jour et par temps). */
function line(app: App, wx: Wx): string | null {
  void app;
  const t = wx.temp;
  if (wx.kind === 'storm') return 'Tu entends l’orage dehors ? Moi je n’ai pas peur… enfin, presque.';
  if (wx.kind === 'snow') return `Il neige à Rozay ! J’adore faire fondre les flocons.`;
  if (wx.kind === 'heavy') return 'Quelle averse ! On reste bien au sec dans la grotte.';
  if (wx.kind === 'rain' || wx.kind === 'drizzle') return 'Il pleut dehors. Parfait pour une journée au chaud avec toi.';
  if (wx.kind === 'fog') return 'Tout est dans le brouillard ce matin… même le loup s’y perd.';
  if (t >= 28) return `${t} °C dehors ! Même pour un dragon, il fait chaud. Pense à boire de l’eau.`;
  if (t <= 0) return `${t} °C dehors… Viens te réchauffer près de moi !`;
  if (wx.kind === 'clear' && wx.isDay) return 'Grand soleil à Rozay ! Une belle journée pour se promener.';
  return null;
}

let layer: HTMLElement | null = null;
let shownKind = '';

/** Couche visuelle (pluie, neige, brouillard, nuages, orage) posée sur la scène. */
function render(app: App, kind: WxKind | null): void {
  const host = app.root.querySelector<HTMLElement>('.stage-view');
  if (!host) return;
  const k = kind && kind !== 'clear' ? kind : '';
  if (k === shownKind && (!k || layer?.isConnected)) return;
  layer?.remove(); layer = null; shownKind = k;
  if (!k) return;
  const drops = k === 'heavy' || k === 'storm' ? 70 : k === 'rain' ? 45 : k === 'drizzle' ? 26 : k === 'snow' ? 40 : 0;
  layer = h('div', { class: `wx wx-${k}`, 'aria-hidden': 'true' },
    ...(k === 'fog' ? [h('div', { class: 'wx-fog a' }), h('div', { class: 'wx-fog b' })] : []),
    ...(k === 'storm' ? [h('div', { class: 'wx-flash' })] : []),
    ...Array.from({ length: drops }, () => {
      const d = h('i');
      d.style.left = `${Math.random() * 104 - 2}%`;
      d.style.animationDelay = `${-Math.random() * 3}s`;
      if (k === 'snow') { const s = 2 + Math.random() * 3.5; d.style.width = `${s}px`; d.style.height = `${s}px`; d.style.animationDuration = `${6 + Math.random() * 6}s`; }
      else d.style.animationDuration = `${(k === 'drizzle' ? 0.9 : 0.55) + Math.random() * 0.35}s`;
      return d;
    }));
  host.append(layer);
}

/** Temps affiché (forcé pour les tests, sinon dernière lecture de moins de 3 h). */
export function currentWeather(): Wx | null {
  try { const f = localStorage.getItem(FORCE) as WxKind | null; if (f) return { kind: f, temp: f === 'snow' ? -2 : 14, at: Date.now(), isDay: true, wind: 10 }; } catch { /* */ }
  const c = cached();
  return c && Date.now() - c.at < 3 * 3600000 ? c : null;
}

export function installWeather(app: App): void {
  const apply = () => {
    const on = app.state.data.settings.weather !== false;
    const wx = on ? currentWeather() : null;
    render(app, wx && app.showingOwn && app.currentId === 'dragon' ? wx.kind : null);
    document.documentElement.dataset.wx = wx?.kind ?? '';
  };
  const refresh = async () => {
    if (document.hidden || app.state.data.settings.weather === false) { apply(); return; }
    const c = cached();
    if (!c || Date.now() - c.at > 30 * 60000) await fetchWx();
    apply();
    maybeSay();
  };
  const maybeSay = () => {
    const wx = currentWeather();
    if (!wx || app.state.data.settings.weather === false || !app.showingOwn || app.sleeping) return;
    const key = `${new Date().toDateString()}:${wx.kind}`;
    try { if (localStorage.getItem(SAID) === key) return; } catch { return; }
    const text = line(app, wx);
    if (!text) return;
    setTimeout(() => {
      if (document.querySelector('.sheet, .bubble.show') || app.sleeping) return;
      try { localStorage.setItem(SAID, key); } catch { /* */ }
      app.say(text, null, 6000);
    }, 9000);
  };
  setTimeout(() => void refresh(), 3000);
  window.setInterval(() => void refresh(), 10 * 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) void refresh(); });
  // suit l'écran affiché (scène du dragon uniquement) et le réglage
  app.state.events.on('change', apply);
  window.setInterval(apply, 1500);
}

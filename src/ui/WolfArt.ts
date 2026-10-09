import { Assets } from '../engine/AssetManager.js';
// Le petit loup messager (voyages) : dessins SVG — assis, deux images de course, avec ou sans sacoche.
// Une illustration peinte peut les remplacer : assets/companions/wolf_sit.webp, wolf_run1.webp, wolf_run2.webp (et _bag).
const FUR = '#8d8f9c', FUR_D = '#5d5f6e', FUR_L = '#c7c9d3', CREAM = '#efe6d6', NOSE = '#1d1b22', EYE = '#2a1d0e';
function defs(): string {
  return `<defs>
  <linearGradient id="wf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${FUR_L}"/><stop offset=".55" stop-color="${FUR}"/><stop offset="1" stop-color="${FUR_D}"/></linearGradient>
  <linearGradient id="wt" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${FUR}"/><stop offset="1" stop-color="${FUR_D}"/></linearGradient>
  <linearGradient id="wb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a0683a"/><stop offset="1" stop-color="#6b4022"/></linearGradient>
  </defs>`;
}
const head = (x: number, y: number, s = 1): string => `<g transform="translate(${x} ${y}) scale(${s})">
  <path d="M-22 -22 L-30 -58 L-6 -34 Z" fill="${FUR_D}"/><path d="M-21 -27 L-26 -50 L-11 -34 Z" fill="#d9a3a0"/>
  <path d="M4 -30 L8 -66 L24 -30 Z" fill="${FUR_D}"/><path d="M8 -33 L10 -57 L19 -33 Z" fill="#d9a3a0"/>
  <path d="M-34 -6 C-36 -30 -14 -42 6 -38 C26 -34 36 -22 38 -10 C52 -8 62 -2 62 6 C62 14 50 18 36 16 C26 26 6 30 -10 26 C-28 22 -34 10 -34 -6 Z" fill="url(#wf)"/>
  <path d="M30 2 C40 2 56 4 60 7 C56 13 44 15 32 13 Z" fill="${CREAM}"/>
  <path d="M-12 8 C-4 22 18 24 30 14 C22 26 0 30 -12 22 Z" fill="${CREAM}"/>
  <ellipse cx="60" cy="4" rx="6" ry="5" fill="${NOSE}"/>
  <path d="M42 13 C46 16 52 16 56 13" stroke="${NOSE}" stroke-width="2" fill="none" stroke-linecap="round"/>
  <ellipse cx="18" cy="-10" rx="6" ry="7" fill="${EYE}"/><circle cx="20" cy="-13" r="2.2" fill="#fff"/>
  <path d="M8 -20 C14 -24 22 -24 28 -20" stroke="${FUR_D}" stroke-width="2.5" fill="none" stroke-linecap="round"/>
  <ellipse cx="-2" cy="6" rx="7" ry="4" fill="#e8a3a8" opacity=".45"/>
</g>`;
const bagSit = `<path d="M70 92 C90 112 104 128 112 150" stroke="#5a341a" stroke-width="6" fill="none" stroke-linecap="round"/>
  <rect x="48" y="118" width="40" height="32" rx="8" fill="url(#wb)" stroke="#4a2a14" stroke-width="2.5"/>
  <path d="M48 128 C60 136 76 136 88 128 L88 122 C76 128 60 128 48 122 Z" fill="#8a5630"/><circle cx="68" cy="132" r="3.5" fill="#f2c14e"/>`;
function sit(bag: boolean): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 210">${defs()}
  <ellipse cx="110" cy="200" rx="78" ry="8" fill="#000" opacity=".25"/>
  <path d="M70 192 C30 198 4 178 6 150 C8 128 22 118 34 124 C30 136 32 150 44 160 C52 168 62 172 72 172 Z" fill="url(#wt)"/>
  <path d="M6 150 C8 136 16 126 26 124 C22 132 20 140 20 150 Z" fill="${FUR_L}"/>
  <path d="M56 196 C40 196 36 160 52 130 C66 104 96 84 122 86 C146 90 154 120 150 150 C148 176 140 196 120 198 Z" fill="url(#wf)"/>
  <path d="M120 96 C140 104 146 130 142 160 C132 168 120 164 116 150 C112 130 110 110 120 96 Z" fill="${CREAM}"/>
  <ellipse cx="70" cy="178" rx="30" ry="22" fill="${FUR}"/><ellipse cx="62" cy="196" rx="20" ry="6" fill="${FUR_D}"/>
  <rect x="118" y="150" width="15" height="48" rx="7" fill="${FUR}"/><rect x="134" y="150" width="15" height="48" rx="7" fill="${FUR_L}"/>
  <ellipse cx="126" cy="197" rx="10" ry="5" fill="${FUR_D}"/><ellipse cx="143" cy="197" rx="10" ry="5" fill="${FUR}"/>
  ${bag ? bagSit : ''}
  ${head(140, 76)}
  </svg>`;
}
function run(frame: 1 | 2, bag: boolean): string {
  const f = frame === 1;
  const legs = f
    ? `<path d="M64 120 L36 150" stroke="${FUR_D}" stroke-width="14" stroke-linecap="round"/><path d="M84 122 L70 156" stroke="${FUR}" stroke-width="14" stroke-linecap="round"/>
       <path d="M140 118 L172 140" stroke="${FUR_D}" stroke-width="13" stroke-linecap="round"/><path d="M152 116 L186 128" stroke="${FUR}" stroke-width="13" stroke-linecap="round"/>`
    : `<path d="M70 124 L86 152" stroke="${FUR_D}" stroke-width="14" stroke-linecap="round"/><path d="M84 124 L104 150" stroke="${FUR}" stroke-width="14" stroke-linecap="round"/>
       <path d="M140 122 L122 152" stroke="${FUR_D}" stroke-width="13" stroke-linecap="round"/><path d="M152 120 L138 154" stroke="${FUR}" stroke-width="13" stroke-linecap="round"/>`;
  const y = f ? -8 : 0;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180">${defs()}
  <ellipse cx="118" cy="170" rx="70" ry="7" fill="#000" opacity="${f ? .15 : .25}"/>
  <g transform="translate(0 ${y})">
  <path d="M60 92 C40 ${f ? 74 : 84} 18 ${f ? 66 : 82} 4 ${f ? 70 : 92} C2 ${f ? 84 : 104} 22 ${f ? 104 : 114} 44 112 C52 112 58 110 62 108 Z" fill="url(#wt)"/>
  <path d="M4 ${f ? 70 : 92} C10 ${f ? 66 : 86} 18 ${f ? 66 : 84} 24 ${f ? 70 : 88} C16 ${f ? 74 : 94} 10 ${f ? 78 : 98} 4 ${f ? 84 : 104} Z" fill="${FUR_L}"/>
  ${legs}
  <path d="M50 104 C50 84 76 74 110 76 C142 78 168 82 172 102 C174 122 146 128 110 128 C76 128 50 122 50 104 Z" fill="url(#wf)"/>
  <path d="M120 120 C140 124 160 120 168 108 C164 124 146 132 120 128 Z" fill="${CREAM}"/>
  ${bag ? `<path d="M120 80 C116 96 112 108 106 118" stroke="#5a341a" stroke-width="5" fill="none"/><rect x="86" y="96" width="34" height="26" rx="7" fill="url(#wb)" stroke="#4a2a14" stroke-width="2.5"/><circle cx="103" cy="108" r="3" fill="#f2c14e"/>` : ''}
  ${head(176, 76, .9)}
  </g></svg>`;
}
export const WOLF_SVG = { sit, run };

/** Image (data URL) d'une pose du loup. */
const cache = new Map<string, string>();
export function wolfImage(pose: 'sit' | 'run1' | 'run2', bag: boolean): string {
  const key = pose + (bag ? '_bag' : '');
  const painted = Assets.art('companions/wolf_' + key);
  if (painted) return painted;
  let url = cache.get(key);
  if (!url) {
    const svg = pose === 'sit' ? sit(bag) : run(pose === 'run1' ? 1 : 2, bag);
    url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    cache.set(key, url);
  }
  return url;
}

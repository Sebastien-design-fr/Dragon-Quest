import { readFileSync, existsSync } from 'node:fs';

const manifest = JSON.parse(readFileSync('www/assets/manifest.json','utf8'));
const poses = JSON.parse(readFileSync('www/data/poses.json','utf8'));
const cap = JSON.parse(readFileSync('capacitor.config.json','utf8'));

const required = [];
for (const v of ['dragon','dragonne']) {
  for (const s of ['baby','young','adult','legendary']) {
    required.push(`${v}/${s}/${v}_${s}_full.svg`);
  }
}
required.push('brand/dragon-mission-logo.svg');

const missing = required.filter(p => !manifest.files.includes(p));
if (missing.length) throw new Error('Assets Dragon Mission absents du manifeste: ' + missing.join(', '));

for (const v of ['dragon','dragonne']) {
  for (const s of ['baby','young','adult','legendary']) {
    const list = poses.poses?.[v]?.[s] ?? [];
    if (list.length) throw new Error(`Anciennes poses encore actives: ${v}/${s}: ${list.join(',')}`);
  }
}
if (cap.appId !== 'fr.dragonmission.app' || cap.appName !== 'Dragon Mission') {
  throw new Error('Identité Android Dragon Mission incorrecte');
}
if (!existsSync('www/assets/brand/dragon-mission-logo.svg')) throw new Error('Logo SVG absent');

const html = readFileSync('www/index.html','utf8');
const theme = readFileSync('www/css/mission-theme.css','utf8');
const themePos = html.indexOf('css/mission-theme.css');
const devPos = html.indexOf('css/dev.css');
if (themePos < 0 || themePos < devPos) throw new Error('Le thème Dragon Mission doit être chargé en dernier');
if (!theme.includes('min-height: 0 !important') || !theme.includes('touch-action: pan-y !important')) {
  throw new Error('Correctif de défilement Android absent');
}
if (!theme.includes('--mission-blue') || !theme.includes('#152446')) {
  throw new Error('Nouvelle identité visuelle Dragon Mission absente');
}

const viewSource = readFileSync('src/engine/DragonView.ts','utf8');
if (!viewSource.includes("d.partPath?.toLowerCase().endsWith('.svg')")) {
  throw new Error('Protection Canvas 2D des dragons SVG absente');
}
if (!viewSource.includes('pipeline WebGL')) {
  throw new Error('Correctif anti-sprite-noir Android absent');
}

console.log('Dragon Mission: assets, identité, thème, défilement et rendu dragon Android validés.');

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

console.log('Dragon Mission: assets, identité Android et désactivation des anciens visuels validés.');

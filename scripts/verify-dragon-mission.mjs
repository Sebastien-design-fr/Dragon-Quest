import { readFileSync, existsSync } from 'node:fs';

const manifest = JSON.parse(readFileSync('www/assets/manifest.json','utf8'));
const poses = JSON.parse(readFileSync('www/data/poses.json','utf8'));
const cap = JSON.parse(readFileSync('capacitor.config.json','utf8'));

const required = [];
for (const v of ['dragon','dragonne']) {
  for (const s of ['baby','young','adult','legendary']) {
    required.push(`${v}/${s}/${v}_${s}_full.webp`);
    required.push(`${v}/${s}/${v}_${s}_full.svg`);
  }
}
required.push('brand/dragon-mission-logo.svg');

const missing = required.filter(p => !manifest.files.includes(p));
if (missing.length) throw new Error('Assets Dragon Mission absents du manifeste: ' + missing.join(', '));

const expectedPoses = {
  dragon: {
    baby: ['sleep','flyUp','flyDown'],
    young: ['sleep','flyUp','flyDown'],
    adult: ['sleep','flyUp','flyMid','flyDown'],
    legendary: ['sleep','flyUp','flyDown']
  },
  dragonne: {
    baby: ['sleep','flyUp','flyDown'],
    young: ['sleep','flyUp','flyDown'],
    adult: ['sleep','flyUp','flyDown'],
    legendary: ['sleep','flyUp','flyDown']
  }
};
for (const [variant, stages] of Object.entries(expectedPoses)) {
  for (const [stage, wanted] of Object.entries(stages)) {
    const list = poses.poses?.[variant]?.[stage] ?? [];
    if (JSON.stringify(list) !== JSON.stringify(wanted)) {
      throw new Error(`Poses Dragon Mission incorrectes: ${variant}/${stage}: ${list.join(',')}`);
    }
    for (const pose of wanted) {
      const asset = `${variant}/${stage}/${variant}_${stage}_${pose}.webp`;
      if (!manifest.files.includes(asset)) throw new Error('Sprite peint absent: ' + asset);
      const rig = `www/data/rigs/${stage}.${variant}.${pose}.json`;
      if (!existsSync(rig)) throw new Error('Rig de pose absent: ' + rig);
    }
  }
}

for (const sound of ['purr','chirp','baby','roar_young','roar_adult','roar_legendary','grumble','fire','eat','attack','wings','coins','gem','chest','levelup','evolution']) {
  const path = `www/assets/sounds/${sound}.mp3`;
  if (!existsSync(path)) throw new Error('Son Dragon Mission absent: ' + path);
}
for (const clip of ['idle@sprite','happy@sprite','sleep@sprite','eat@sprite','attack@sprite','fire@sprite','level_up@sprite','evolution@sprite','pet@sprite','sad@sprite','bow@sprite','dance@sprite','ring@sprite','roar@sprite','hover@sprite','wake@sprite','welcome@sprite','shake@sprite','stretch@sprite','yawn@sprite','scratch@sprite','look_around@sprite','sniff@sprite','tail_swish@sprite','sleep_pose@sprite','fly_pose@sprite','catch@sprite','giggle@sprite','tail_chase@sprite','purr@sprite','dizzy@sprite','cheer@sprite']) {
  const path = `www/data/animations/${clip}.json`;
  if (!existsSync(path)) throw new Error('Animation Dragon Mission absente: ' + path);
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

const assetSource = readFileSync('src/engine/AssetManager.ts','utf8');
if (!assetSource.includes("const EXTENSIONS = ['webp', 'png', 'jpg', 'svg']")) {
  throw new Error('Priorité des illustrations peintes WebP incorrecte');
}
const viewSource = readFileSync('src/engine/DragonView.ts','utf8');
if (!viewSource.includes("spritePath.endsWith('.webp') || spritePath.endsWith('.svg')")) {
  throw new Error('Protection Canvas 2D des sprites dragon WebP/SVG absente');
}
if (!viewSource.includes('pipeline WebGL')) {
  throw new Error('Correctif anti-sprite-noir Android absent');
}

console.log('Dragon Mission: assets, sprites, poses, animations, sons et rendu Android validés.');

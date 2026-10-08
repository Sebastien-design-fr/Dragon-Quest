import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const sourceDir = 'assets/dragon-mission-approved';
const targetRoot = 'www/assets';
const installed = [];

for (const bundleName of readdirSync(sourceDir).filter(n => n.endsWith('.json')).sort()) {
  const [variant, stage] = bundleName.replace(/\.json$/, '').split('-');
  if (!['dragon','dragonne'].includes(variant) || !['baby','young','adult','legendary'].includes(stage)) {
    throw new Error('Bundle de dragon invalide: ' + bundleName);
  }
  const bundle = JSON.parse(readFileSync(join(sourceDir, bundleName), 'utf8'));
  const dir = join(targetRoot, variant, stage);
  mkdirSync(dir, { recursive: true });
  for (const [name, b64] of Object.entries(bundle)) {
    const expectedPrefix = variant + '_' + stage + '_';
    if (!name.startsWith(expectedPrefix) || !name.endsWith('.webp')) {
      throw new Error('Nom de sprite invalide dans ' + bundleName + ': ' + name);
    }
    const dest = join(dir, name);
    writeFileSync(dest, Buffer.from(b64, 'base64'));
    installed.push(variant + '/' + stage + '/' + name);
  }
}

if (installed.length !== 40) throw new Error('Jeu de sprites incomplet: ' + installed.length + '/40');

writeFileSync(join(targetRoot, 'approved-dragons.json'), JSON.stringify({
  reference: 'f4532b70-bfde-4b8e-9bfa-5257a8da20ac',
  source: 'sprites Dragon Mission validés',
  files: installed.sort()
}, null, 2));

console.log('Sprites Dragon Mission approuvés installés:', installed.length);

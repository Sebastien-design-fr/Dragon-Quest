// Génère www/assets/manifest.json : la liste des fichiers graphiques réellement présents.
// L'AssetManager ne demande au réseau QUE les fichiers listés ici ; tout le reste
// est remplacé instantanément par un placeholder procédural (aucune requête 404 sur mobile).
// Ajouter un asset = déposer le fichier au bon endroit. Ce script le détecte au build.
import { readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const ROOT = new URL('../www/assets/', import.meta.url).pathname;
const EXT = /\.(svg|png|webp|jpg|jpeg|avif|json)$/i;

function walk(dir, out) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (EXT.test(name) && name !== 'manifest.json') out.push(relative(ROOT, full).split(sep).join('/'));
  }
  return out;
}

const files = walk(ROOT, []).sort();
writeFileSync(join(ROOT, 'manifest.json'), JSON.stringify({ generatedAt: new Date().toISOString(), files }, null, 2));
console.log(`manifest: ${files.length} asset(s) référencé(s)`);

// Copie le runtime JavaScript de Capacitor dans www/js/vendor/ (l'appli n'utilise pas de bundler).
// Sans node_modules (développement dans un simple navigateur), l'appli bascule sur le lien simulé.
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';

const src = new URL('../node_modules/@capacitor/core/dist/index.js', import.meta.url).pathname;
const dir = new URL('../www/js/vendor/', import.meta.url).pathname;
mkdirSync(dir, { recursive: true });
if (existsSync(src)) {
  copyFileSync(src, dir + 'capacitor-core.js');
  console.log('vendor: @capacitor/core copié');
} else {
  console.log('vendor: @capacitor/core absent (mode navigateur uniquement)');
}

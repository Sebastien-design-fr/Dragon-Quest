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

// PixiJS for the offline Android graphics lab: no CDN or runtime fetch.
const pixiSource = new URL('../node_modules/pixi.js/dist/pixi.min.js', import.meta.url).pathname;
const pixiTarget = new URL('../www/labs/vendor/', import.meta.url).pathname;
mkdirSync(pixiTarget, { recursive: true });
if (existsSync(pixiSource)) {
  copyFileSync(pixiSource, pixiTarget + 'pixi.min.js');
  console.log('vendor: PixiJS copied for offline Lumia V2');
} else {
  throw new Error('PixiJS distribution missing: install dependencies before build');
}

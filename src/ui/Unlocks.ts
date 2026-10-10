// Déblocage progressif (enfant) : on ne découvre pas tout le premier jour.
// les câlins et cadeaux cachés entre dragons au niveau 4 (le loup est là dès le début). Annoncés par le dragon. Un parent a tout d'emblée.
import type { App } from './App.js';

export type Feature = 'wolf' | 'gifts';
export const UNLOCK_LEVEL: Record<Feature, number> = { wolf: 1, gifts: 4 };
const ANNOUNCE: Record<Feature, string> = {
  wolf: 'Regarde ! Un petit loup est arrivé dans la grotte. Il veut devenir mon compagnon : va le voir !',
  gifts: 'Nouveau : tu peux envoyer des câlins et cacher des cadeaux dans la grotte de l’autre dragon !'
};

export function unlocked(app: App, f: Feature): boolean {
  return app.isParent || app.state.data.level >= UNLOCK_LEVEL[f];
}

/** Annonce les nouveautés au passage de niveau. */
export function installUnlocks(app: App): void {
  if (app.isParent) return;
  app.state.events.on('levelUp', ({ level }) => {
    for (const f of Object.keys(UNLOCK_LEVEL) as Feature[]) {
      if (UNLOCK_LEVEL[f] !== level) continue;
      setTimeout(() => { app.say(ANNOUNCE[f], null, 9000); app.toast(f === 'wolf' ? 'Nouveau compagnon : le loup !' : 'Nouveau : câlins et cadeaux cachés'); app.refresh(); }, 4500);
    }
  });
}

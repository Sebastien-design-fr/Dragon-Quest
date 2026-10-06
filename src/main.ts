// Point d'entrée : charge les données, la sauvegarde, puis assemble moteur + interface.
import { AnimationLibrary } from './engine/Animator.js';
import { Assets } from './engine/AssetManager.js';
import { DragonView } from './engine/DragonView.js';
import { Catalog } from './game/Catalog.js';
import { GameState } from './game/GameState.js';
import { LocalSaveBackend } from './game/save/SaveBackend.js';
import { App } from './ui/App.js';

async function boot(): Promise<void> {
  const catalog = new Catalog();
  const library = new AnimationLibrary();
  await Promise.all([Assets.init(), catalog.load(), library.load()]);

  const state = new GameState(catalog, new LocalSaveBackend());
  await state.load();

  const canvas = document.querySelector<HTMLCanvasElement>('#dragon')!;
  const view = new DragonView(canvas, {
    library, presets: catalog.presets, categories: catalog.categories, rarities: catalog.rarities
  });
  const { quality, effects } = state.data.settings;
  view.setQuality(catalog.quality[quality], effects);
  await view.setStage(state.stage, true);
  view.setEquipment(state.equippedDefs());
  void view.play('idle');
  view.start();

  // Économie de batterie : la boucle s'arrête quand l'appli passe en arrière-plan.
  document.addEventListener('visibilitychange', () => (document.hidden ? view.stop() : view.start()));

  new App(document.querySelector('#app')!, catalog, state, view);
  document.body.classList.add('ready');
}

boot().catch(err => {
  console.error(err);
  document.body.innerHTML = `<p style="color:#eee;padding:24px;font-family:sans-serif">Erreur de démarrage : ${String(err?.message ?? err)}</p>`;
});

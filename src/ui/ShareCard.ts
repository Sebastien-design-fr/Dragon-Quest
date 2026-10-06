// Carte du dragon à partager : une belle image avec son nom, son niveau, ses exploits.
import { getCore } from '../platform/capacitor.js';
import type { App } from './App.js';
import { h } from './dom.js';
import { openSheet } from './screens/common.js';

interface SharePlugin { share(o: { title?: string; text?: string; files?: string[]; dialogTitle?: string }): Promise<unknown> }
interface FsPlugin { writeFile(o: { path: string; data: string; directory: string }): Promise<{ uri: string }> }

export async function shareCard(app: App): Promise<void> {
  const url = drawCard(app);
  const comp = app.family.companion;
  const name = comp?.name ?? 'Mon dragon';
  const core = getCore();
  if (core) {
    try {
      const fs = core.registerPlugin<FsPlugin>('Filesystem');
      const share = core.registerPlugin<SharePlugin>('Share');
      const file = await fs.writeFile({ path: `dragon-${Date.now()}.png`, data: url.split(',')[1], directory: 'CACHE' });
      await share.share({ title: name, text: `Voici ${name}, mon dragon !`, files: [file.uri], dialogTitle: 'Partager mon dragon' });
      return;
    } catch (e) {
      if (String(e).includes('cancel')) return;
      console.warn('Partage impossible', e);
    }
  }
  openSheet('Carte de ' + name, () => [
    h('img', { src: url, alt: `Carte de ${name}`, class: 'share-preview' }),
    h('p', { class: 'small muted' }, 'Fais une capture d’écran pour l’envoyer.')
  ]);
}

function drawCard(app: App): string {
  const W = 1080, H = 1350;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d')!;
  const bg = g.createRadialGradient(W / 2, H * 0.42, 50, W / 2, H * 0.42, H * 0.8);
  bg.addColorStop(0, '#3a2a1c'); bg.addColorStop(0.6, '#15121a'); bg.addColorStop(1, '#0b0a0d');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  g.strokeStyle = '#d9a84a'; g.lineWidth = 6; g.strokeRect(36, 36, W - 72, H - 72);
  g.strokeStyle = 'rgba(217,168,74,.4)'; g.lineWidth = 2; g.strokeRect(52, 52, W - 104, H - 104);

  // Le dragon tel qu'il est maintenant (avec ses équipements)
  const src = app.view.canvas;
  const k = Math.min((W - 140) / src.width, 760 / src.height);
  g.drawImage(src, (W - src.width * k) / 2, 150, src.width * k, src.height * k);

  const comp = app.family.companion, book = app.family.book;
  const name = comp?.name ?? 'Mon dragon';
  g.textAlign = 'center';
  g.fillStyle = '#f2d48a'; g.font = '600 92px Cinzel, Georgia, serif';
  g.fillText(name, W / 2, 140);
  g.fillStyle = '#ece4d4'; g.font = '40px system-ui, sans-serif';
  g.fillText(`${app.state.stage.label} · niveau ${app.state.data.level}`, W / 2, 970);
  const stats: Array<[string, string]> = [];
  if (comp) stats.push(['Amitié', comp.bondLevel().label], ['Tours', String(comp.tricks().filter(t => t.unlocked).length)]);
  if (book) stats.push(['Série', `${book.streak()} j`], ['Succès', String(Object.keys(book.data.badges).length)]);
  const cw = (W - 160) / Math.max(1, stats.length);
  stats.forEach(([label, value], i) => {
    const x = 80 + cw * i + cw / 2;
    g.fillStyle = '#d9a84a'; g.font = '600 54px Cinzel, Georgia, serif'; g.fillText(value, x, 1090);
    g.fillStyle = '#a2988a'; g.font = '30px system-ui, sans-serif'; g.fillText(label, x, 1135);
  });
  g.fillStyle = 'rgba(242,212,138,.7)'; g.font = '28px Cinzel, Georgia, serif';
  g.fillText('Quête du Dragon', W / 2, H - 80);
  return c.toDataURL('image/png');
}

// Mode photo « Selfie avec mon dragon » : le dragon détouré posé sur une photo, ou une photo dans sa grotte.
// Cadre doré, polaroid ou sans cadre ; image 1080 × 1350 enregistrée ou partagée.
import { getCore } from '../platform/capacitor.js';
import type { App } from './App.js';
import { ICONS, clear, h, icon } from './dom.js';
import { openSheet } from './screens/common.js';

interface SharePlugin { share(o: { title?: string; text?: string; files?: string[]; dialogTitle?: string }): Promise<unknown> }
interface FsPlugin { writeFile(o: { path: string; data: string; directory: string }): Promise<{ uri: string }> }

type FrameStyle = 'gold' | 'polaroid' | 'none';
type Source = CanvasImageSource & { width: number; height: number };

const OUT_W = 1080, OUT_H = 1350;
const ICON_CAMERA = 'M4 8h3l2-3h6l2 3h3v11H4z M12 10a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z';
const ICON_FLIP = 'M12 3v18 M9 7L4 17h5z M15 7l5 10h-5z';
const DISPLAY = "Cinzel, 'Trajan Pro', Georgia, serif";
const HAND = "'Segoe Print', 'Bradley Hand', 'Comic Sans MS', cursive";

/** Copie du canvas du dragon. Sans décor : on attend deux images pour que le dragon soit redessiné seul. */
async function grab(app: App, backdrop: boolean): Promise<HTMLCanvasElement | null> {
  const v = app.view, src = v.canvas;
  if (src.width < 4 || src.height < 4) return null;
  const prev = v.showBackdrop;
  v.showBackdrop = backdrop;
  const frame = () => new Promise<void>(r => requestAnimationFrame(() => r()));
  await frame(); await frame();
  const c = document.createElement('canvas');
  c.width = src.width; c.height = src.height;
  c.getContext('2d')!.drawImage(src, 0, 0);
  v.showBackdrop = prev;
  return backdrop ? c : crop(c);
}

/** Recadre sur les pixels non transparents. */
function crop(c: HTMLCanvasElement): HTMLCanvasElement | null {
  const g = c.getContext('2d', { willReadFrequently: true })!;
  const { width: W, height: H } = c;
  const d = g.getImageData(0, 0, W, H).data;
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) {
    const row = y * W * 4;
    for (let x = 0; x < W; x++) {
      if (d[row + x * 4 + 3] > 12) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
  }
  if (x1 < 0) return null;
  const pad = 4;
  x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(W - 1, x1 + pad); y1 = Math.min(H - 1, y1 + pad);
  const out = document.createElement('canvas');
  out.width = x1 - x0 + 1; out.height = y1 - y0 + 1;
  out.getContext('2d')!.drawImage(c, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
  return out;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('image')); };
    img.src = url;
  });
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, hh: number, r: number): void {
  g.beginPath();
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + hh, r); g.arcTo(x + w, y + hh, x, y + hh, r);
  g.arcTo(x, y + hh, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

export function openPhotoMode(app: App): void {
  const comp = app.family.companion;
  const name = comp?.name ?? 'Mon dragon';
  const dateText = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

  // État de la composition (coordonnées relatives au cadre 1080 × 1350)
  const s = {
    mode: 'photo' as 'photo' | 'cave',
    photo: null as Source | null,
    cutout: null as HTMLCanvasElement | null,
    scene: null as HTMLCanvasElement | null,
    x: 0.66, y: 0.64, size: 0.62, flip: false,
    frame: 'gold' as FrameStyle,
    sticker: true, stickerText: 'Mon dragon et moi'
  };

  const overlay = h('div', { class: 'pq-photo', role: 'dialog', 'aria-label': 'Selfie avec mon dragon' });
  const close = () => { overlay.classList.remove('open'); window.removeEventListener('keydown', onKey); setTimeout(() => overlay.remove(), 200); };
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
  window.addEventListener('keydown', onKey);
  document.body.append(overlay);
  requestAnimationFrame(() => overlay.classList.add('open'));

  // Polices du canvas et captures du dragon (pendant que l'écran de choix s'affiche)
  const fontsReady = Promise.all([
    document.fonts?.load(`600 60px ${DISPLAY}`).catch(() => null),
    document.fonts?.load(`700 40px ${HAND}`).catch(() => null)
  ]);
  const captures = (async () => {
    // on attend que l'écran photo soit opaque : le décor qui disparaît un instant ne se voit pas
    await new Promise(r => setTimeout(r, 230));
    s.scene = await grab(app, true);
    s.cutout = await grab(app, false);
  })();

  const top = (title: string, back: (() => void) | null) => h('div', { class: 'pq-top' },
    back ? h('button', { class: 'pq-icon-btn', 'aria-label': 'Retour', onclick: back }, icon('M15 5l-7 7 7 7', 22)) : h('span', { class: 'pq-icon-spacer' }),
    h('h2', null, title),
    h('button', { class: 'pq-icon-btn', 'aria-label': 'Fermer', onclick: close }, icon('M6 6l12 12 M18 6L6 18', 22)));

  // ---------- 1. Choix ----------
  const showChoice = () => {
    clear(overlay);
    const input = h('input', { type: 'file', accept: 'image/*', capture: 'user', class: 'pq-file' }) as HTMLInputElement;
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        s.photo = await loadImage(file);
        s.mode = 'photo';
        await captures;
        showCompose();
      } catch { app.toast('Impossible d’ouvrir cette photo'); }
    });
    const hero = h('div', { class: 'pq-hero' });
    void captures.then(() => {
      if (!s.cutout) return;
      const c = s.cutout;
      const img = h('img', { src: c.toDataURL('image/png'), alt: name, class: 'pq-hero-img' });
      hero.append(img);
      requestAnimationFrame(() => hero.classList.add('ready'));
    });
    overlay.append(
      top('Selfie avec mon dragon', null),
      h('div', { class: 'pq-choice' },
        hero,
        h('p', { class: 'pq-lead' }, `Prends la pose avec ${name} ! Choisis d’abord le décor.`),
        h('label', { class: 'pq-tile' },
          h('span', { class: 'pq-tile-art pq-tile-me' }, icon(ICON_CAMERA, 34)),
          h('span', { class: 'pq-tile-text' }, h('strong', null, 'Avec une photo de moi'), h('span', null, 'Prends-toi en photo ou choisis-en une dans ta galerie')),
          input),
        h('button', {
          class: 'pq-tile', onclick: async () => { await captures; if (!s.scene) { app.toast('Le dragon n’est pas visible pour l’instant'); return; } s.mode = 'cave'; showCompose(); }
        },
          h('span', { class: 'pq-tile-art pq-tile-cave' }, icon(ICONS.dragon, 34)),
          h('span', { class: 'pq-tile-text' }, h('strong', null, 'Dans sa grotte'), h('span', null, `Une photo souvenir de ${name} chez lui`)))));
  };

  // ---------- 2. Composition ----------
  const showCompose = () => {
    clear(overlay);
    if (s.mode === 'cave') { s.x = 0.5; s.y = 0.5; s.size = 1; s.flip = false; }
    else { s.x = 0.66; s.y = 0.64; s.size = 0.62; s.flip = false; }
    const preview = h('canvas', { class: 'pq-canvas', 'aria-label': 'Aperçu de la photo' }) as HTMLCanvasElement;
    const stage = h('div', { class: 'pq-stage' }, preview, h('div', { class: 'pq-hint' }, s.mode === 'cave' ? 'Glisse pour cadrer' : `Glisse ${name} avec ton doigt`));
    const redraw = () => {
      // Cadre 4:5 le plus grand possible dans la zone disponible
      const sr = stage.getBoundingClientRect();
      const aw = Math.max(40, sr.width - 32), ah = Math.max(40, sr.height - 50);
      const cw = Math.floor(Math.min(aw, ah * OUT_W / OUT_H));
      preview.style.width = `${cw}px`; preview.style.height = `${Math.round(cw * OUT_H / OUT_W)}px`;
      const r = preview.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = Math.max(1, Math.round(r.width * dpr)), hh = Math.max(1, Math.round(r.height * dpr));
      if (preview.width !== w || preview.height !== hh) { preview.width = w; preview.height = hh; }
      const g = preview.getContext('2d')!;
      g.setTransform(w / OUT_W, 0, 0, hh / OUT_H, 0, 0);
      draw(g);
    };
    let queued = false;
    const schedule = () => { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; redraw(); }); };

    // Glisser (un doigt) et pincer (deux doigts)
    const pts = new Map<number, { x: number; y: number }>();
    let pinch: { d: number; size: number } | null = null;
    const dist = () => { const [a, b] = [...pts.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
    preview.addEventListener('pointerdown', e => {
      preview.setPointerCapture(e.pointerId);
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      stage.classList.add('touched');
      if (pts.size === 2) pinch = { d: dist(), size: s.size };
    });
    preview.addEventListener('pointermove', e => {
      const p = pts.get(e.pointerId);
      if (!p) return;
      const r = preview.getBoundingClientRect();
      if (pts.size === 1) {
        const k = s.mode === 'cave' ? -1 / s.size : 1;
        s.x = clamp(s.x + (e.clientX - p.x) / r.width * k, -0.2, 1.2);
        s.y = clamp(s.y + (e.clientY - p.y) / r.height * k, -0.2, 1.2);
      }
      p.x = e.clientX; p.y = e.clientY;
      if (pts.size === 2 && pinch) { setSize(pinch.size * dist() / Math.max(10, pinch.d)); slider.value = String(s.size); }
      schedule();
    });
    const up = (e: PointerEvent) => { pts.delete(e.pointerId); if (pts.size < 2) pinch = null; };
    preview.addEventListener('pointerup', up);
    preview.addEventListener('pointercancel', up);

    const range = s.mode === 'cave' ? { min: 1, max: 2.5 } : { min: 0.2, max: 1.3 };
    const setSize = (v: number) => { s.size = clamp(v, range.min, range.max); schedule(); };
    const slider = h('input', { type: 'range', min: range.min, max: range.max, step: 0.01, value: s.size, class: 'pq-slider', 'aria-label': s.mode === 'cave' ? 'Zoom' : 'Taille du dragon' }) as HTMLInputElement;
    slider.addEventListener('input', () => setSize(Number(slider.value)));

    const chips = (items: Array<[FrameStyle, string]>) => {
      const row = h('div', { class: 'pq-chips', role: 'radiogroup', 'aria-label': 'Cadre' });
      const paint = () => row.querySelectorAll('button').forEach(b => { const on = b.dataset.id === s.frame; b.classList.toggle('active', on); b.setAttribute('aria-checked', String(on)); });
      for (const [id, label] of items) row.append(h('button', { class: `pq-chip pq-chip-${id}`, role: 'radio', 'data-id': id, onclick: () => { s.frame = id; paint(); schedule(); } }, h('span', { class: 'pq-swatch' }), label));
      paint();
      return row;
    };
    const stickerInput = h('input', { type: 'text', value: s.stickerText, maxlength: 28, class: 'pq-sticker-input', 'aria-label': 'Texte de l’autocollant' }) as HTMLInputElement;
    stickerInput.addEventListener('input', () => { s.stickerText = stickerInput.value; schedule(); });
    const stickerBtn = h('button', { class: `pq-chip pq-toggle${s.sticker ? ' active' : ''}`, 'aria-pressed': String(s.sticker), onclick: () => {
      s.sticker = !s.sticker; stickerBtn.classList.toggle('active', s.sticker); stickerBtn.setAttribute('aria-pressed', String(s.sticker));
      stickerInput.disabled = !s.sticker; schedule();
    } }, icon(ICONS.star, 16), 'Texte');

    const saveBtn = h('button', { class: 'btn primary pq-save', onclick: async () => {
      saveBtn.disabled = true;
      try { await exportImage(); } finally { saveBtn.disabled = false; }
    } }, icon(ICONS.check, 18), ' Enregistrer / Partager');

    overlay.append(
      top(s.mode === 'cave' ? 'Dans sa grotte' : 'Selfie avec mon dragon', showChoice),
      stage,
      h('div', { class: 'pq-controls' },
        h('div', { class: 'pq-row' },
          h('span', { class: 'pq-size-ico small' }, icon(s.mode === 'cave' ? 'M10 10m-6 0a6 6 0 1 0 12 0a6 6 0 1 0-12 0 M14.5 14.5L20 20 M7.5 10h5' : ICONS.dragon, 16)),
          slider,
          h('span', { class: 'pq-size-ico' }, icon(s.mode === 'cave' ? 'M10 10m-6 0a6 6 0 1 0 12 0a6 6 0 1 0-12 0 M14.5 14.5L20 20 M7.5 10h5 M10 7.5v5' : ICONS.dragon, 24)),
          h('button', { class: 'pq-icon-btn pq-flip', 'aria-label': 'Retourner', title: 'Retourner', onclick: () => { s.flip = !s.flip; schedule(); } }, icon(ICON_FLIP, 20))),
        chips([['gold', 'Doré'], ['polaroid', 'Polaroid'], ['none', 'Sans cadre']]),
        h('div', { class: 'pq-row' }, stickerBtn, stickerInput),
        saveBtn));

    new ResizeObserver(schedule).observe(stage);
    void fontsReady.then(schedule);
    schedule();
  };

  // ---------- Dessin (aperçu et export partagent le même code) ----------
  const photoRect = (): [number, number, number, number] => s.frame === 'polaroid' ? [64, 64, OUT_W - 128, OUT_H - 64 - 250] : [0, 0, OUT_W, OUT_H];

  const draw = (g: CanvasRenderingContext2D) => {
    g.save();
    g.fillStyle = s.frame === 'polaroid' ? '#f6f1e6' : '#0b0a0d';
    g.fillRect(0, 0, OUT_W, OUT_H);
    const [px, py, pw, ph] = photoRect();
    g.save();
    g.beginPath(); g.rect(px, py, pw, ph); g.clip();
    if (s.mode === 'cave' && s.scene) {
      const img = s.scene;
      const k = Math.max(pw / img.width, ph / img.height) * s.size;
      const w = img.width * k, hh = img.height * k;
      // s.x / s.y : centre visé dans l'image (0..1)
      const cx = clamp(s.x, 0, 1), cy = clamp(s.y, 0, 1);
      let x = px + pw / 2 - cx * w, y = py + ph / 2 - cy * hh;
      x = Math.min(px, Math.max(px + pw - w, x)); y = Math.min(py, Math.max(py + ph - hh, y));
      s.x = (px + pw / 2 - x) / w; s.y = (py + ph / 2 - y) / hh;
      if (s.flip) { g.translate(px + pw / 2, 0); g.scale(-1, 1); g.translate(-(px + pw / 2), 0); }
      g.drawImage(img, x, y, w, hh);
    } else {
      if (s.photo) {
        const img = s.photo;
        const k = Math.max(pw / img.width, ph / img.height);
        g.drawImage(img, px + (pw - img.width * k) / 2, py + (ph - img.height * k) / 2, img.width * k, img.height * k);
      }
      // léger dégradé pour que le dragon « se pose » dans la photo
      const shade = g.createLinearGradient(0, py + ph * 0.55, 0, py + ph);
      shade.addColorStop(0, 'rgba(0,0,0,0)'); shade.addColorStop(1, 'rgba(0,0,0,.28)');
      g.fillStyle = shade; g.fillRect(px, py, pw, ph);
      const d = s.cutout;
      if (d) {
        const w = OUT_W * s.size, hh = w * d.height / d.width;
        g.save();
        g.translate(px + s.x * pw, py + s.y * ph);
        if (s.flip) g.scale(-1, 1);
        g.shadowColor = 'rgba(0,0,0,.35)'; g.shadowBlur = 24; g.shadowOffsetY = 8;
        g.drawImage(d, -w / 2, -hh / 2, w, hh);
        g.restore();
      }
    }
    g.restore();

    if (s.frame === 'gold') drawGold(g);
    if (s.frame === 'polaroid') drawPolaroid(g, py + ph);
    if (s.sticker && s.stickerText.trim()) drawSticker(g, s.stickerText.trim(), px, py);
    g.restore();
  };

  const drawGold = (g: CanvasRenderingContext2D) => {
    const gold = g.createLinearGradient(0, 0, OUT_W, OUT_H);
    gold.addColorStop(0, '#f6dc8f'); gold.addColorStop(0.35, '#b07a26'); gold.addColorStop(0.55, '#f2d48a'); gold.addColorStop(1, '#8a5a18');
    // vignette intérieure
    const vig = g.createRadialGradient(OUT_W / 2, OUT_H / 2, OUT_H * 0.35, OUT_W / 2, OUT_H / 2, OUT_H * 0.75);
    vig.addColorStop(0, 'rgba(0,0,0,0)'); vig.addColorStop(1, 'rgba(20,10,0,.45)');
    g.fillStyle = vig; g.fillRect(0, 0, OUT_W, OUT_H);
    g.lineJoin = 'miter';
    g.strokeStyle = gold; g.lineWidth = 34; g.strokeRect(17, 17, OUT_W - 34, OUT_H - 34);
    g.strokeStyle = 'rgba(40,24,6,.7)'; g.lineWidth = 3; g.strokeRect(36, 36, OUT_W - 72, OUT_H - 72);
    g.strokeStyle = gold; g.lineWidth = 3; g.strokeRect(50, 50, OUT_W - 100, OUT_H - 100);
    // ornements d'angle
    for (const [cx, cy, sx, sy] of [[50, 50, 1, 1], [OUT_W - 50, 50, -1, 1], [50, OUT_H - 50, 1, -1], [OUT_W - 50, OUT_H - 50, -1, -1]]) {
      g.save(); g.translate(cx, cy); g.scale(sx, sy);
      g.fillStyle = gold; g.strokeStyle = gold; g.lineWidth = 4;
      g.beginPath(); g.moveTo(0, 0); g.lineTo(54, 0); g.quadraticCurveTo(30, 6, 24, 24); g.quadraticCurveTo(6, 30, 0, 54); g.closePath(); g.fill();
      g.beginPath(); g.arc(34, 34, 9, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.moveTo(70, 8); g.quadraticCurveTo(100, 8, 120, 24); g.stroke();
      g.beginPath(); g.moveTo(8, 70); g.quadraticCurveTo(8, 100, 24, 120); g.stroke();
      g.restore();
    }
    // cartouche du nom
    const bw = 640, bh = 150, bx = (OUT_W - bw) / 2, by = OUT_H - 50 - bh + 34;
    g.save();
    g.shadowColor = 'rgba(0,0,0,.5)'; g.shadowBlur = 20;
    g.fillStyle = 'rgba(18,12,8,.88)';
    roundRect(g, bx, by, bw, bh, 22); g.fill();
    g.restore();
    g.strokeStyle = gold; g.lineWidth = 5; roundRect(g, bx, by, bw, bh, 22); g.stroke();
    g.lineWidth = 1.5; roundRect(g, bx + 10, by + 10, bw - 20, bh - 20, 14); g.stroke();
    g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    g.fillStyle = '#f2d48a';
    fitText(g, name, `600 {px}px ${DISPLAY}`, 70, bw - 80);
    g.fillText(name, OUT_W / 2, by + 82);
    g.fillStyle = 'rgba(242,212,138,.8)'; g.font = `500 30px ${DISPLAY}`;
    g.fillText(dateText, OUT_W / 2, by + 124);
  };

  const drawPolaroid = (g: CanvasRenderingContext2D, photoBottom: number) => {
    g.strokeStyle = 'rgba(0,0,0,.08)'; g.lineWidth = 2;
    g.strokeRect(64, 64, OUT_W - 128, photoBottom - 64);
    g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    g.fillStyle = '#2b2530';
    const line = `${name} et moi`;
    fitText(g, line, `700 {px}px ${HAND}`, 76, OUT_W - 200);
    g.fillText(line, OUT_W / 2, photoBottom + 120);
    g.fillStyle = '#7b7180'; g.font = `500 34px ${HAND}`;
    g.fillText(dateText, OUT_W / 2, photoBottom + 182);
  };

  const drawSticker = (g: CanvasRenderingContext2D, text: string, px: number, py: number) => {
    g.save();
    const inset = s.frame === 'gold' ? 96 : 44;
    g.font = `700 52px ${DISPLAY}`;
    const tw = Math.min(g.measureText(text).width, OUT_W - 2 * inset - 80);
    const w = tw + 76, hh = 96;
    g.translate(px + inset + w / 2, py + inset + hh / 2 + 6);
    g.rotate(-0.07);
    g.shadowColor = 'rgba(0,0,0,.35)'; g.shadowBlur = 16; g.shadowOffsetY = 6;
    g.fillStyle = '#fffaf0'; roundRect(g, -w / 2, -hh / 2, w, hh, 48); g.fill();
    g.shadowColor = 'transparent';
    g.strokeStyle = '#d9a84a'; g.lineWidth = 5; roundRect(g, -w / 2 + 9, -hh / 2 + 9, w - 18, hh - 18, 40); g.stroke();
    g.fillStyle = '#5a2d0c'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, 0, 3, tw);
    g.restore();
  };

  // ---------- 3. Export ----------
  const exportImage = async () => {
    await fontsReady;
    const c = document.createElement('canvas'); c.width = OUT_W; c.height = OUT_H;
    draw(c.getContext('2d')!);
    const url = c.toDataURL('image/png');
    if (comp) {
      const first = !comp.data.album.some(a => a.id === 'selfie1');
      comp.remember('selfie1', `Premier selfie avec ${name}`, s.mode === 'cave' ? `Une photo souvenir de ${name} dans sa grotte.` : `${name} a posé pour sa première photo avec toi.`);
      if (first) { comp.save(); app.toast('Nouveau souvenir dans l’album !'); }
    }
    const core = getCore();
    if (core) {
      try {
        const fs = core.registerPlugin<FsPlugin>('Filesystem');
        const share = core.registerPlugin<SharePlugin>('Share');
        const file = await fs.writeFile({ path: `selfie-dragon-${Date.now()}.png`, data: url.split(',')[1], directory: 'CACHE' });
        await share.share({ title: `${name} et moi`, text: `Moi et ${name}, mon dragon !`, files: [file.uri], dialogTitle: 'Enregistrer ou partager la photo' });
        return;
      } catch (e) {
        if (String(e).toLowerCase().includes('cancel')) return;
        console.warn('Partage impossible', e);
      }
    }
    openSheet('Ta photo est prête', () => [
      h('img', { src: url, alt: `Photo avec ${name}`, class: 'pq-result' }),
      h('p', { class: 'small muted pq-result-hint' }, 'Fais un appui long pour l’enregistrer.'),
      h('a', { class: 'btn pq-download', href: url, download: `selfie-${name.toLowerCase().replace(/[^a-z0-9]+/gi, '-')}.png` }, 'Télécharger')
    ]);
  };

  showChoice();
}

function fitText(g: CanvasRenderingContext2D, text: string, font: string, size: number, max: number): void {
  let px = size;
  g.font = font.replace('{px}', String(px));
  while (px > 24 && g.measureText(text).width > max) { px -= 4; g.font = font.replace('{px}', String(px)); }
}

function clamp(v: number, a: number, b: number): number { return v < a ? a : v > b ? b : v; }

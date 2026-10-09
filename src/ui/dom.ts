// Petits utilitaires DOM (pas de framework : léger et rapide sur mobile).
type Child = Node | string | number | null | undefined | false | Child[];
type Attrs = Record<string, unknown>;

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs | null = null, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === undefined || v === null || v === false) continue;
      if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
      else if (k === 'style' && typeof v === 'object') {
        for (const [sk, sv] of Object.entries(v as Record<string, unknown>)) {
          if (sv === undefined || sv === null) continue;
          if (sk.startsWith('--')) el.style.setProperty(sk, String(sv));
          else (el.style as unknown as Record<string, string>)[sk] = String(sv);
        }
      }
      else if (k === 'class') el.className = String(v);
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, String(v));
    }
  }
  append(el, children);
  return el;
}

/** Comme Element.append, mais ignore null / false et aplatit les tableaux. */
export function put(el: Element, ...children: Child[]): void { append(el, children); }

function append(el: Element, children: Child[]): void {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    if (Array.isArray(c)) { append(el, c); continue; }
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

const SVG = 'http://www.w3.org/2000/svg';
export function icon(path: string, size = 22, color = 'currentColor'): SVGSVGElement {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', color);
  svg.setAttribute('stroke-width', '1.8');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  const p = document.createElementNS(SVG, 'path');
  p.setAttribute('d', path);
  svg.append(p);
  return svg;
}

export function clear(el: Element): void { while (el.firstChild) el.firstChild.remove(); }

export const ICONS = {
  dragon: 'M4 18c2-6 6-9 11-9l4-4v6l-3 2c0 3-2 6-6 7H4z M15 9l1-3',
  shop: 'M5 8h14l-1 12H6z M9 8V6a3 3 0 0 1 6 0v2',
  inventory: 'M4 7h16v13H4z M4 11h16 M9 7V4h6v3',
  settings: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z M19 12l2-1-1-3-2 .3-1.4-1.4L17 5l-3-1-1 2h-2l-1-2-3 1 .4 1.9L6 8.3 4 8 3 11l2 1v0l-2 1 1 3 2-.3 1.4 1.4L7 19l3 1 1-2h2l1 2 3-1-.4-1.9 1.4-1.4 2 .3 1-3z',
  coin: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10z',
  heart: 'M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z',
  meat: 'M15 4a5 5 0 0 1 5 5c0 4-5 7-9 7l-4 4-3-3 4-4c0-4 3-9 7-9z',
  moon: 'M20 14A8 8 0 1 1 10 4a6 6 0 0 0 10 10z',
  claw: 'M5 20c2-6 5-10 9-13 M9 20c2-5 4-8 8-10 M13 20c1-3 3-5 6-6',
  flame: 'M12 3c1 4 5 5.5 5 10a5 5 0 0 1-10 0c0-2.5 1.5-3.5 2-5 1 1.5 2 2 3 2-1-3 0-5 0-7z',
  star: 'M12 3l2.6 5.6 6 .8-4.4 4.2 1.1 6L12 16.8 6.7 19.6l1.1-6L3.4 9.4l6-.8z',
  lock: 'M6 11h12v9H6z M9 11V8a3 3 0 0 1 6 0v3',
  missions: 'M9 6h11 M9 12h11 M9 18h11 M4 6l1 1 2-2 M4 12l1 1 2-2 M4 18l1 1 2-2',
  check: 'M5 12l5 5 9-10',
  clock: 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16z M12 8v4l3 2',
  family: 'M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M17 11a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z M2 20c.5-4 3-6 6-6s5.5 2 6 6 M14 14c3 0 5.5 1.5 6 5',
  shield: 'M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z M9 12l2 2 4-4',
  gift: 'M4 10h16v10H4z M3 7h18v3H3z M12 7v13 M12 7c-2-4-6-3-5 0 M12 7c2-4 6-3 5 0',
  plus: 'M12 5v14 M5 12h14',
  edit: 'M4 20h4L19 9l-4-4L4 16z M14 6l4 4',
  trash: 'M5 7h14 M9 7V4h6v3 M7 7l1 13h8l1-13',
  spark: 'M12 3v4 M12 17v4 M3 12h4 M17 12h4 M6 6l2.5 2.5 M15.5 15.5L18 18 M6 18l2.5-2.5 M15.5 8.5L18 6',
  drop: 'M12 3c3 4.5 6 8 6 11a6 6 0 0 1-12 0c0-3 3-6.5 6-11z M9.5 14.5a2.5 2.5 0 0 0 2.5 2.5',
  game: 'M7 9h10a4 4 0 0 1 4 4v2a3 3 0 0 1-5 2l-1.5-1.5h-5L8 17a3 3 0 0 1-5-2v-2a4 4 0 0 1 4-4z M8 11v4 M6 13h4 M16 12h0 M18 14h0',
  album: 'M5 4h12a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2z M5 18a2 2 0 0 1 2-2h12 M10 8h5 M10 11h5',
  hand: 'M8 13V6a1.5 1.5 0 0 1 3 0v5 M11 11V4.5a1.5 1.5 0 0 1 3 0V11 M14 11V6a1.5 1.5 0 0 1 3 0v7c0 4-2.5 7-6 7-3 0-4.5-1.5-6-4l-2-3.5a1.5 1.5 0 0 1 2.5-1.5L8 13',
  wing: 'M3 17c3-1 5-3 6-7 1 3 3 4 5 4-1-4 1-8 7-10-1 5-2 9-6 12-3 2-8 2-12 1z',
  wifi: 'M2 9a15 15 0 0 1 20 0 M5 12.5a10 10 0 0 1 14 0 M8.5 16a5 5 0 0 1 7 0 M12 19.5h0',
  foot: 'M8 3c2 0 3 2 3 5s-1 5-3 5-3-2-3-5 1-5 3-5z M7 15h3v2.5a1.5 1.5 0 0 1-3 0z M16 7c2 0 3 2 3 5s-1 5-3 5-3-2-3-5 1-5 3-5z M15 19h3v1a1.5 1.5 0 0 1-3 0z',
  compass: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M15.5 8.5l-2 5-5 2 2-5z',
  potion: 'M10 3h4 M10.5 3v5L6 16a3 3 0 0 0 2.6 5h6.8A3 3 0 0 0 18 16l-4.5-8V3 M8 14h8'
};

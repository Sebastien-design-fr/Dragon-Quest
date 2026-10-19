// Relief du décor peint (2,5D) : quand on penche le téléphone, les rochers proches glissent plus que le fond,
// comme à travers une petite fenêtre. La profondeur est estimée une fois sur l'illustration :
// - au-dessus du sol : ce qui est sombre et contrasté est proche (parois, stalactites), ce qui est clair et
//   voilé est loin (ciel, brume, fond de grotte) ; les bords de l'image sont plutôt proches ;
// - le sol se rapproche à mesure qu'on descend dans l'image.
// Le rendu passe par WebGL (une texture pour l'image, une pour la profondeur) ; sans WebGL, rien ne change.

const VS = `attribute vec2 p; varying vec2 v; void main(){ v = p * 0.5 + 0.5; v.y = 1.0 - v.y; gl_Position = vec4(p, 0.0, 1.0); }`;
const FS = `precision mediump float;
varying vec2 v;
uniform sampler2D img, dep;
uniform vec4 rect;      // x, y, w, h de l'image en pixels écran
uniform vec2 screen;    // taille de l'écran (pixels)
uniform vec2 shift;     // décalage maximal (pixels) selon l'inclinaison
uniform float plane;    // profondeur qui ne bouge pas (le sol sous les pattes)
void main(){
  vec2 px = v * screen;
  vec2 uv = (px - rect.xy) / rect.zw;
  // deux passes : on lit la profondeur là où le pixel viendrait, pour limiter les déchirures
  float d = texture2D(dep, uv).r;
  vec2 off = shift * (d - plane) / rect.zw;
  d = texture2D(dep, uv - off).r;
  off = shift * (d - plane) / rect.zw;
  gl_FragColor = texture2D(img, clamp(uv - off, 0.001, 0.999));
}`;

const GW = 96, GH = 64;

export class DepthParallax {
  readonly canvas = document.createElement('canvas');
  private gl: WebGLRenderingContext | null = null;
  private prog: WebGLProgram | null = null;
  private texImg: WebGLTexture | null = null;
  private texDep: WebGLTexture | null = null;
  private loc: Record<string, WebGLUniformLocation | null> = {};
  private source: HTMLImageElement | HTMLCanvasElement | null = null;
  /** Profondeur du sol sous le dragon (ce plan reste immobile). */
  plane = 0.6;
  failed = false;

  private init(): boolean {
    if (this.gl) return true;
    if (this.failed) return false;
    const gl = this.canvas.getContext('webgl', { premultipliedAlpha: false, alpha: false, antialias: false }) as WebGLRenderingContext | null;
    if (!gl) { this.failed = true; return false; }
    const sh = (type: number, src: string) => { const s = gl.createShader(type)!; gl.shaderSource(s, src); gl.compileShader(s); return s; };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { this.failed = true; return false; }
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const a = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(a);
    gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
    for (const n of ['img', 'dep', 'rect', 'screen', 'shift', 'plane']) this.loc[n] = gl.getUniformLocation(prog, n);
    gl.uniform1i(this.loc.img, 0);
    gl.uniform1i(this.loc.dep, 1);
    const tex = () => {
      const t = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      return t;
    };
    this.texImg = tex(); this.texDep = tex();
    this.gl = gl; this.prog = prog;
    return true;
  }

  /** Nouvelle illustration : envoi de l'image et calcul de sa profondeur. floor = hauteur du sol (0..1). */
  setImage(img: HTMLImageElement | HTMLCanvasElement | null, floor: number): void {
    this.source = img;
    if (!img || !this.init()) return;
    const gl = this.gl!;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texImg);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
    const depth = estimateDepth(img, floor);
    if (!depth) { this.source = null; return; }
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.texDep);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, GW, GH, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, depth);
    // le sol sous le dragon (milieu de l'image, ligne du sol) reste immobile
    this.plane = depth[Math.min(GH - 1, Math.round(floor * GH)) * GW + GW / 2] / 255;
  }

  get ready(): boolean { return !!this.source && !!this.gl; }

  /** Image du décor avec relief, à la taille de l'écran ; shift = décalage max en pixels (x, y). */
  render(W: number, H: number, rect: { x: number; y: number; w: number; h: number }, sx: number, sy: number): HTMLCanvasElement | null {
    const gl = this.gl;
    if (!gl || !this.source) return null;
    if (this.canvas.width !== W || this.canvas.height !== H) { this.canvas.width = W; this.canvas.height = H; }
    gl.viewport(0, 0, W, H);
    gl.useProgram(this.prog);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.texImg);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.texDep);
    gl.uniform4f(this.loc.rect, rect.x, rect.y, rect.w, rect.h);
    gl.uniform2f(this.loc.screen, W, H);
    gl.uniform2f(this.loc.shift, sx, sy);
    gl.uniform1f(this.loc.plane, this.plane);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    return this.canvas;
  }
}

/** Carte de profondeur (0 = loin, 255 = proche), GW × GH, lissée. */
function estimateDepth(img: HTMLImageElement | HTMLCanvasElement, floor: number): Uint8Array | null {
  const c = document.createElement('canvas');
  c.width = GW * 2; c.height = GH * 2;
  const g = c.getContext('2d', { willReadFrequently: true });
  if (!g) return null;
  g.drawImage(img, 0, 0, c.width, c.height);
  let px: Uint8ClampedArray;
  try { px = g.getImageData(0, 0, c.width, c.height).data; } catch { return null; }
  const lum = (x: number, y: number) => { const i = (y * c.width + x) * 4; return (0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]) / 255; };
  const sat = (x: number, y: number) => { const i = (y * c.width + x) * 4; const mx = Math.max(px[i], px[i + 1], px[i + 2]), mn = Math.min(px[i], px[i + 1], px[i + 2]); return mx ? (mx - mn) / mx : 0; };
  const d = new Float32Array(GW * GH);
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
    // case 2×2 : luminosité moyenne et contraste local
    let s = 0, s2 = 0, sa = 0;
    for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) { const L = lum(x * 2 + i, y * 2 + j); s += L; s2 += L * L; sa += sat(x * 2 + i, y * 2 + j); }
    const m = s / 4, sd = Math.sqrt(Math.max(0, s2 / 4 - m * m)), sm = sa / 4;
    const fy = (y + 0.5) / GH, fx = (x + 0.5) / GW;
    const edge = Math.abs(fx - 0.5) * 2;
    let near: number;
    if (fy < floor) {
      // sombre, contrasté, saturé = proche ; clair, voilé = loin ; bords de l'image plutôt proches
      near = 0.45 * (1 - Math.min(1, m * 1.6)) + 0.25 * Math.min(1, sd * 8) + 0.1 * sm + 0.25 * edge * edge;
      near = Math.min(0.75, near);
    } else {
      // le sol se rapproche vers le bas de l'image
      near = 0.55 + 0.45 * Math.min(1, (fy - floor) / Math.max(0.05, 1 - floor));
    }
    d[y * GW + x] = near;
  }
  // lissage (4 passes de flou 3×3) : pas de marches, pas de déchirures
  const tmp = new Float32Array(d.length);
  for (let pass = 0; pass < 4; pass++) {
    for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
      let s = 0, n = 0;
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
        const xx = x + i, yy = y + j;
        if (xx < 0 || yy < 0 || xx >= GW || yy >= GH) continue;
        s += d[yy * GW + xx]; n++;
      }
      tmp[y * GW + x] = s / n;
    }
    d.set(tmp);
  }
  const out = new Uint8Array(GW * GH);
  for (let i = 0; i < d.length; i++) out[i] = Math.round(Math.max(0, Math.min(1, d[i])) * 255);
  return out;
}

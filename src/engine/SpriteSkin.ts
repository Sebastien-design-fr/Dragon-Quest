// Illustration « vivante » : l'image entière du dragon est posée sur un maillage dont chaque sommet
// est lié aux os souples les plus proches (cou, tête, ailes, queue, pattes…). Quand un os tourne,
// la zone de l'image qui l'entoure suit, avec des transitions douces vers les zones voisines.
// Les ancrages d'équipement sont déformés de la même façon : un casque suit exactement la tête dessinée.
import { Mat2D } from '../core/math.js';
import type { PartDef } from '../core/types.js';
import type { Bone, Skeleton } from './Skeleton.js';

const MAX_INFLUENCES = 4;

interface SkinBone { bone: Bone; restInv: Mat2D; ox: number; oy: number; tx: number; ty: number; radius: number; m: Mat2D }

export class SpriteSkin {
  private bones: SkinBone[] = [];
  /** Positions au repos (monde), UV, index des os et poids par sommet. */
  private rest = new Float32Array(0);
  readonly uv: Float32Array;
  readonly indices: Uint16Array;
  readonly positions: Float32Array;
  private infl = new Uint8Array(0);
  private wts = new Float32Array(0);
  readonly count: number;
  private tmp = new Mat2D();

  constructor(skeleton: Skeleton, partBone: Bone, part: PartDef, img: CanvasImageSource & { width: number; height: number }, grid: number) {
    // Pose de repos.
    skeleton.resetPose();
    skeleton.update(new Mat2D());
    for (const b of skeleton.bones) {
      if (!b.def.radius) continue;
      const w = b.world;
      const s = Math.hypot(w.a, w.b);
      const tip = w.point(b.def.length, 0);
      this.bones.push({ bone: b, restInv: w.invert(), ox: w.e, oy: w.f, tx: tip.x, ty: tip.y, radius: b.def.radius * s, m: new Mat2D() });
    }

    // Grille sur l'image, sans les mailles entièrement transparentes.
    const cols = Math.max(2, Math.ceil(part.w / grid)), rows = Math.max(2, Math.ceil(part.h / grid));
    const used = opaqueCells(img, cols, rows);
    const vid = new Int32Array((cols + 1) * (rows + 1)).fill(-1);
    const verts: number[] = [], uvs: number[] = [], tris: number[] = [];
    const base = partBone.world;
    const vert = (i: number, j: number) => {
      const k = j * (cols + 1) + i;
      if (vid[k] >= 0) return vid[k];
      const u = i / cols, v = j / rows;
      const p = base.point((u - part.pivot[0]) * part.w, (v - part.pivot[1]) * part.h);
      vid[k] = verts.length / 2;
      verts.push(p.x, p.y); uvs.push(u, v);
      return vid[k];
    };
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      if (!used[j * cols + i]) continue;
      const a = vert(i, j), b = vert(i + 1, j), c = vert(i, j + 1), d = vert(i + 1, j + 1);
      tris.push(a, b, c, b, d, c);
    }
    this.rest = new Float32Array(verts);
    this.uv = new Float32Array(uvs);
    this.indices = new Uint16Array(tris);
    this.count = verts.length / 2;
    this.positions = new Float32Array(verts.length);

    // Poids : les os les plus proches, atténuation douce selon leur rayon.
    this.infl = new Uint8Array(this.count * MAX_INFLUENCES);
    this.wts = new Float32Array(this.count * MAX_INFLUENCES);
    const w = new Float32Array(MAX_INFLUENCES), id = new Uint8Array(MAX_INFLUENCES);
    for (let v = 0; v < this.count; v++) {
      this.weightsAt(this.rest[v * 2], this.rest[v * 2 + 1], id, w);
      this.infl.set(id, v * MAX_INFLUENCES);
      this.wts.set(w, v * MAX_INFLUENCES);
    }
  }

  get boneCount(): number { return this.bones.length; }

  private weightsAt(x: number, y: number, idOut: Uint8Array, wOut: Float32Array): void {
    idOut.fill(0); wOut.fill(0);
    for (let i = 0; i < this.bones.length; i++) {
      const b = this.bones[i];
      const d = segDist(x, y, b.ox, b.oy, b.tx, b.ty) / b.radius;
      const wt = 1 / (1 + d * d * d * d);
      // insertion dans les 4 meilleurs
      let k = MAX_INFLUENCES - 1;
      if (wt <= wOut[k]) continue;
      while (k > 0 && wOut[k - 1] < wt) { wOut[k] = wOut[k - 1]; idOut[k] = idOut[k - 1]; k--; }
      wOut[k] = wt; idOut[k] = i;
    }
    let sum = 0;
    for (let k = 0; k < MAX_INFLUENCES; k++) sum += wOut[k];
    for (let k = 0; k < MAX_INFLUENCES; k++) wOut[k] /= sum || 1;
  }

  /** Recalcule les sommets d'après la pose courante du squelette (déjà mise à jour). */
  update(): void {
    for (const b of this.bones) b.bone.world.multiply(b.restInv, b.m);
    const P = this.positions, R = this.rest, I = this.infl, W = this.wts, B = this.bones;
    for (let v = 0, n = this.count; v < n; v++) {
      const x = R[v * 2], y = R[v * 2 + 1];
      let ox = 0, oy = 0;
      for (let k = 0; k < MAX_INFLUENCES; k++) {
        const wt = W[v * MAX_INFLUENCES + k];
        if (wt < 1e-4) continue;
        const m = B[I[v * MAX_INFLUENCES + k]].m;
        ox += wt * (m.a * x + m.c * y + m.e);
        oy += wt * (m.b * x + m.d * y + m.f);
      }
      P[v * 2] = ox; P[v * 2 + 1] = oy;
    }
  }

  /** Le point (monde) est-il sur un triangle visible du maillage déformé ? */
  contains(x: number, y: number): boolean {
    const P = this.positions, I = this.indices;
    for (let i = 0; i < I.length; i += 3) {
      const a = I[i] * 2, b = I[i + 1] * 2, c = I[i + 2] * 2;
      const d1 = (x - P[b]) * (P[a + 1] - P[b + 1]) - (P[a] - P[b]) * (y - P[b + 1]);
      const d2 = (x - P[c]) * (P[b + 1] - P[c + 1]) - (P[b] - P[c]) * (y - P[c + 1]);
      const d3 = (x - P[a]) * (P[c + 1] - P[a + 1]) - (P[c] - P[a]) * (y - P[a + 1]);
      const neg = d1 < 0 || d2 < 0 || d3 < 0, pos = d1 > 0 || d2 > 0 || d3 > 0;
      if (!(neg && pos)) return true;
    }
    return false;
  }

  /** Repère monde déformé d'un repère de repos (ancrage) : mélange des matrices des os voisins. */
  deform(restWorld: Mat2D, out: Mat2D): Mat2D {
    const id = new Uint8Array(MAX_INFLUENCES), w = new Float32Array(MAX_INFLUENCES);
    this.weightsAt(restWorld.e, restWorld.f, id, w);
    const t = this.tmp;
    t.a = t.b = t.c = t.d = t.e = t.f = 0;
    for (let k = 0; k < MAX_INFLUENCES; k++) {
      const m = this.bones[id[k]].m, wt = w[k];
      t.a += wt * m.a; t.b += wt * m.b; t.c += wt * m.c; t.d += wt * m.d; t.e += wt * m.e; t.f += wt * m.f;
    }
    // Retire le cisaillement / l'écrasement du mélange : l'objet garde ses proportions.
    const sx = Math.hypot(t.a, t.b) || 1;
    const ang = Math.atan2(t.b, t.a);
    const det = t.a * t.d - t.b * t.c;
    const sy = det / sx;
    const s = Math.sqrt(Math.abs(sx * sy)) || 1;
    t.a = Math.cos(ang) * s; t.b = Math.sin(ang) * s; t.c = -Math.sin(ang) * s; t.d = Math.cos(ang) * s;
    return t.multiply(restWorld, out);
  }
}

const isPow2 = (n: number) => (n & (n - 1)) === 0;
const nextPow2 = (n: number) => 2 ** Math.ceil(Math.log2(n));

function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay;
  const l2 = dx * dx + dy * dy;
  let t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Mailles contenant au moins un pixel visible (avec une maille de marge). */
function opaqueCells(img: CanvasImageSource, cols: number, rows: number): Uint8Array {
  const out = new Uint8Array(cols * rows);
  try {
    const k = 4;
    const c = document.createElement('canvas');
    c.width = cols * k; c.height = rows * k;
    const g = c.getContext('2d', { willReadFrequently: true })!;
    g.drawImage(img, 0, 0, c.width, c.height);
    const data = g.getImageData(0, 0, c.width, c.height).data;
    const raw = new Uint8Array(cols * rows);
    for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
      if (data[(y * c.width + x) * 4 + 3] > 4) raw[Math.floor(y / k) * cols + Math.floor(x / k)] = 1;
    }
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      let on = 0;
      for (let dj = -1; dj <= 1 && !on; dj++) for (let di = -1; di <= 1 && !on; di++) {
        const ii = i + di, jj = j + dj;
        if (ii >= 0 && jj >= 0 && ii < cols && jj < rows && raw[jj * cols + ii]) on = 1;
      }
      out[j * cols + i] = on;
    }
  } catch {
    out.fill(1);
  }
  return out;
}

/** Rendu WebGL du maillage dans un canvas hors écran, recopié ensuite dans le canvas 2D. */
export class MeshRenderer {
  /** Mipmaps (réduction propre de l'illustration, sans scintillement). Désactivables pour comparer. */
  static mipmaps = true;
  /** Nombre de contextes WebGL ouverts (panneau développeur). */
  static contexts = 0;
  readonly canvas = document.createElement('canvas');
  private gl: WebGLRenderingContext;
  /** WebGL 2 : mipmaps sur des images de toutes tailles. */
  readonly webgl2: boolean;
  private texMip: boolean | null = null;
  /** Taille de la texture envoyée (après éventuelle mise en puissance de 2). */
  texInfo = '';
  private prog: WebGLProgram;
  private posBuf: WebGLBuffer;
  private uvBuf: WebGLBuffer;
  private idxBuf: WebGLBuffer;
  private tex: WebGLTexture;
  private texImg: unknown = null;
  private mesh: SpriteSkin | null = null;
  private uMat: WebGLUniformLocation;

  static create(): MeshRenderer | null {
    try { return new MeshRenderer(); } catch { return null; }
  }

  private constructor() {
    const opts = { premultipliedAlpha: true, alpha: true, antialias: true, preserveDrawingBuffer: false };
    const gl2 = this.canvas.getContext('webgl2', opts) as unknown as WebGLRenderingContext | null;
    const gl = gl2 ?? (this.canvas.getContext('webgl', opts) as WebGLRenderingContext | null);
    if (!gl) throw new Error('WebGL indisponible');
    this.gl = gl;
    this.webgl2 = !!gl2;
    MeshRenderer.contexts++;
    this.canvas.addEventListener('webglcontextlost', () => { MeshRenderer.contexts--; this.released = true; });
    const vs = `attribute vec2 p; attribute vec2 uv; uniform mat3 m; varying vec2 vUv;
      void main(){ vec3 q = m * vec3(p, 1.0); gl_Position = vec4(q.xy, 0.0, 1.0); vUv = uv; }`;
    // léger biais de niveau de détail : un peu plus net sans réintroduire de scintillement
    const fs = `precision mediump float; uniform sampler2D t; varying vec2 vUv;
      void main(){ gl_FragColor = texture2D(t, vUv, -0.25); }`;
    const sh = (type: number, src: string) => {
      const s = gl.createShader(type)!; gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader');
      return s;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, vs));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('programme WebGL');
    this.prog = prog;
    this.uMat = gl.getUniformLocation(prog, 'm')!;
    this.posBuf = gl.createBuffer()!;
    this.uvBuf = gl.createBuffer()!;
    this.idxBuf = gl.createBuffer()!;
    this.tex = gl.createTexture()!;
  }

  setMesh(mesh: SpriteSkin, img: TexImageSource): void {
    const gl = this.gl;
    this.mesh = mesh;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.uvBuf);
    gl.bufferData(gl.ARRAY_BUFFER, mesh.uv, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.idxBuf);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuf);
    gl.bufferData(gl.ARRAY_BUFFER, mesh.positions.byteLength, gl.DYNAMIC_DRAW);
    if (this.texImg !== img || this.texMip !== MeshRenderer.mipmaps) {
      this.texImg = img;
      this.texMip = MeshRenderer.mipmaps;
      this.upload(img as TexImageSource & { width: number; height: number });
    }
  }

  /** Envoi de l'illustration au GPU, avec mipmaps (WebGL 2 : directement ; WebGL 1 : image redimensionnée en puissance de 2). */
  private upload(img: TexImageSource & { width: number; height: number }): void {
    const gl = this.gl;
    const mip = MeshRenderer.mipmaps;
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    let src: TexImageSource = img;
    let w = img.width, h = img.height;
    if (mip && !this.webgl2 && (!isPow2(w) || !isPow2(h))) {
      // WebGL 1 : pas de mipmaps sans puissance de 2 → image agrandie au format puissance de 2 (les UV restent 0..1)
      const c = document.createElement('canvas');
      c.width = Math.min(4096, nextPow2(w)); c.height = Math.min(4096, nextPow2(h));
      const g = c.getContext('2d')!;
      g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
      g.drawImage(img as CanvasImageSource, 0, 0, c.width, c.height);
      src = c; w = c.width; h = c.height;
    }
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    if (mip) {
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      const aniso = gl.getExtension('EXT_texture_filter_anisotropic');
      if (aniso) gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT, 4);
    } else gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.texInfo = `${w}×${h}${mip ? ' + mipmaps' : ''}${this.webgl2 ? ' (WebGL 2)' : ' (WebGL 1)'}`;
  }

  /** Libère le contexte WebGL (vue supprimée, changement de stade) : évite d'en accumuler. */
  release(): void {
    if (this.released) return;
    this.released = true;
    this.gl.getExtension('WEBGL_lose_context')?.loseContext();
    this.canvas.width = this.canvas.height = 1;
  }
  private released = false;

  get ready(): boolean { return !!this.mesh && !this.gl.isContextLost(); }

  /** Dessine le maillage (coordonnées monde) avec la matrice caméra donnée, dans un canvas W x H. */
  render(cam: Mat2D, W: number, H: number): HTMLCanvasElement {
    const gl = this.gl, mesh = this.mesh!;
    if (this.canvas.width !== W || this.canvas.height !== H) { this.canvas.width = W; this.canvas.height = H; }
    gl.viewport(0, 0, W, H);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.prog);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    // monde -> pixels (caméra) -> espace de découpe
    const sx = 2 / W, sy = -2 / H;
    gl.uniformMatrix3fv(this.uMat, false, new Float32Array([
      cam.a * sx, cam.b * sy, 0,
      cam.c * sx, cam.d * sy, 0,
      cam.e * sx - 1, cam.f * sy + 1, 1
    ]));
    const pLoc = gl.getAttribLocation(this.prog, 'p'), uvLoc = gl.getAttribLocation(this.prog, 'uv');
    gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, mesh.positions);
    gl.enableVertexAttribArray(pLoc);
    gl.vertexAttribPointer(pLoc, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.uvBuf);
    gl.enableVertexAttribArray(uvLoc);
    gl.vertexAttribPointer(uvLoc, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.idxBuf);
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.drawElements(gl.TRIANGLES, mesh.indices.length, gl.UNSIGNED_SHORT, 0);
    return this.canvas;
  }
}

// Passe finale de l'image (shader WebGL 1, une seule passe plein écran) :
// - étalonnage doux : courbe en S légère, saturation un peu relevée, ombres et hautes lumières teintées
//   selon l'heure (ombres bleutées et lumières dorées le jour, ombres violines le soir, bleu nuit la nuit) ;
// - vignette : les bords s'assombrissent, le regard va au dragon ;
// - grain fin animé qui casse les marches des dégradés (halos, brume, ciel) ;
// - air qui tremble au-dessus des flammes pendant le souffle (distorsion par bruit, limitée à une zone).
// Sans WebGL, ou si les effets permanents sont coupés, l'image reste telle quelle.

const VS = `attribute vec2 p; varying vec2 v; void main(){ v = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }`;
const FS = `precision mediump float;
varying vec2 v;
uniform sampler2D img;
uniform vec2 res;
uniform float t;
uniform vec3 shadowTint, lightTint;
uniform float grade, vig;
uniform vec4 heat;          // centre x, y (0..1, origine en bas), rayon (fraction de la largeur), force
float hash(vec2 p){ p = fract(p * vec2(234.34, 435.345)); p += dot(p, p + 34.23); return fract(p.x * p.y); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
void main(){
  vec2 uv = v;
  // air chaud : petites ondulations qui montent, seulement près du jet de flammes
  if (heat.w > 0.001) {
    vec2 d = (uv - heat.xy) * vec2(res.x / res.y, 1.0);
    float k = heat.w * (1.0 - smoothstep(0.0, heat.z, length(d)));
    vec2 q = uv * res / 18.0;
    vec2 off = vec2(noise(q + vec2(0.0, -t * 3.0)) - 0.5, noise(q * 1.3 + vec2(5.0, -t * 4.0)) - 0.5);
    uv += off * k * 0.012;
  }
  vec3 c = texture2D(img, uv).rgb;
  // courbe en S douce et saturation
  vec3 s = c * c * (3.0 - 2.0 * c);
  c = mix(c, s, 0.22 * grade);
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(l), c, 1.0 + 0.08 * grade);
  // teintes séparées : les ombres prennent la couleur de l'air, les lumières celle de la source
  float sh = 1.0 - smoothstep(0.0, 0.45, l), hi = smoothstep(0.55, 1.0, l);
  c += grade * (shadowTint * sh + lightTint * hi);
  // vignette ovale
  vec2 e = (v - 0.5) * vec2(1.0, 1.25);
  c *= 1.0 - vig * smoothstep(0.32, 0.85, length(e));
  // grain (dithering) : ±1/255, change à chaque image
  c += (hash(v * res + fract(t) * 91.7) - 0.5) / 255.0 * 1.6;
  gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}`;

export interface PostParams {
  shadowTint: [number, number, number];
  lightTint: [number, number, number];
  grade: number;
  vignette: number;
  /** Air chaud : centre (pixels du canvas), rayon (pixels), force 0..1. */
  heat: { x: number; y: number; r: number; k: number } | null;
}

export class PostFX {
  readonly canvas = document.createElement('canvas');
  private gl: WebGLRenderingContext | null = null;
  private tex: WebGLTexture | null = null;
  private loc: Record<string, WebGLUniformLocation | null> = {};
  failed = false;

  private init(): boolean {
    if (this.gl) return true;
    if (this.failed) return false;
    const gl = this.canvas.getContext('webgl', { alpha: false, antialias: false, premultipliedAlpha: false }) as WebGLRenderingContext | null;
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
    for (const n of ['img', 'res', 't', 'shadowTint', 'lightTint', 'grade', 'vig', 'heat']) this.loc[n] = gl.getUniformLocation(prog, n);
    gl.uniform1i(this.loc.img, 0);
    this.tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    // le canvas 2D a son origine en haut : on retourne à l'envoi pour garder v.y = 0 en bas
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    this.gl = gl;
    return true;
  }

  /** Applique la passe à l'image du canvas principal et la recopie à sa place. */
  apply(ctx: CanvasRenderingContext2D, src: HTMLCanvasElement, W: number, H: number, time: number, p: PostParams): boolean {
    if (W < 8 || H < 8 || !this.init()) return false;
    const gl = this.gl!;
    if (this.canvas.width !== W || this.canvas.height !== H) { this.canvas.width = W; this.canvas.height = H; }
    gl.viewport(0, 0, W, H);
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, src);
    gl.uniform2f(this.loc.res, W, H);
    gl.uniform1f(this.loc.t, time % 1000);
    gl.uniform3f(this.loc.shadowTint, ...p.shadowTint);
    gl.uniform3f(this.loc.lightTint, ...p.lightTint);
    gl.uniform1f(this.loc.grade, p.grade);
    gl.uniform1f(this.loc.vig, p.vignette);
    const h = p.heat;
    gl.uniform4f(this.loc.heat, h ? h.x / W : 0, h ? 1 - h.y / H : 0, h ? h.r / W : 0, h ? h.k : 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'copy';
    ctx.drawImage(this.canvas, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    return true;
  }
}

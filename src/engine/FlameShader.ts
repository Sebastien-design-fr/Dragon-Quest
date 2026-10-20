// Flammes calculées par la carte graphique : un jet continu de langues de feu qui ondulent (bruit qui défile
// dans le sens du jet), cœur blanc, puis jaune, orange et bords rouges, qui monte un peu en s'éloignant.
// Il se dessine sous les particules du souffle (braises, fumée), qui gardent le détail.

const VS = `attribute vec2 p; varying vec2 v; void main(){ v = p * 0.5 + 0.5; v.y = 1.0 - v.y; gl_Position = vec4(p, 0.0, 1.0); }`;
const FS = `#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec2 v;
uniform float t, power;
float hash(vec2 p){ vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * noise(p); p *= 2.03; a *= 0.5; } return s; }
void main(){
  float x = v.x, len = power;                     // x : de la gueule (0) au bout du jet (1)
  float c = 0.5 - 0.16 * x * x;                   // la flamme monte en s'éloignant
  float w = 0.04 + 0.4 * pow(x, 0.8);           // et s'élargit
  float n = fbm(vec2(x * 5.0 - t * 7.0, v.y * 4.0 + t * 1.3));
  float n2 = fbm(vec2(x * 11.0 - t * 13.0, v.y * 9.0));
  float d = abs(v.y - c + (n - 0.5) * 0.12 * x) / w;
  float body = clamp(1.0 - d * (0.85 + 0.7 * n2), 0.0, 1.0);
  float reach = 1.0 - smoothstep(len * 0.55, len, x + 0.3 * (n - 0.5));
  float a = body * reach * smoothstep(0.0, 0.03, x);
  float heat = a * (1.25 - 0.75 * x / max(len, 0.01));
  vec3 col = mix(vec3(0.55, 0.05, 0.0), vec3(1.0, 0.35, 0.03), smoothstep(0.1, 0.45, heat));
  col = mix(col, vec3(1.0, 0.78, 0.25), smoothstep(0.45, 0.75, heat));
  col = mix(col, vec3(1.0, 0.97, 0.85), smoothstep(0.8, 1.05, heat));
  a = clamp(a * 1.4, 0.0, 1.0);
  gl_FragColor = vec4(col * a, a);
}`;

export class FlameShader {
  readonly canvas = document.createElement('canvas');
  private gl: WebGLRenderingContext | null = null;
  private loc: { t: WebGLUniformLocation | null; power: WebGLUniformLocation | null } = { t: null, power: null };
  private failed = false;

  private init(): boolean {
    if (this.gl) return true;
    if (this.failed) return false;
    this.canvas.width = 256; this.canvas.height = 128;
    const gl = this.canvas.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false }) as WebGLRenderingContext | null;
    if (!gl) { this.failed = true; return false; }
    // contexte perdu (mémoire du téléphone) : on n'insiste pas, le souffle garde ses particules
    this.canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); this.failed = true; this.gl = null; });
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
    this.loc = { t: gl.getUniformLocation(prog, 't'), power: gl.getUniformLocation(prog, 'power') };
    this.gl = gl;
    return true;
  }

  /**
   * Dessine le jet depuis la gueule (pixels écran), vers la droite (dir = 1) ou la gauche (-1).
   * power : 0..1 (le jet s'allonge à l'allumage et se rétracte à la fin) ; reach : longueur maximale en pixels.
   */
  draw(ctx: CanvasRenderingContext2D, x: number, y: number, dir: number, reach: number, power: number, time: number): void {
    if (power < 0.02 || !this.init() || this.gl!.isContextLost()) return;
    const gl = this.gl!;
    gl.viewport(0, 0, 256, 128);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform1f(this.loc.t, time % 100); // petit nombre : précise même en précision réduite
    gl.uniform1f(this.loc.power, Math.min(1, power));
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    const L = reach, Hh = reach * 0.5;
    ctx.setTransform(dir, 0, 0, 1, x, y);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = Math.min(1, power * 1.3);
    // la gueule est au premier quart de la hauteur centrale : l'image commence un peu en arrière des crocs
    ctx.drawImage(this.canvas, -L * 0.02, -Hh * 0.5, L, Hh);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }
}

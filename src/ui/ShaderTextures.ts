// Matières de l'interface générées une seule fois au démarrage par un shader (WebGL 1), puis réutilisées
// en CSS comme images : la pierre de la grotte (grain, veines, petites fissures) pour les boutons, les cartes,
// la barre d'actions et les panneaux. Texture raccordable dans les deux sens, grise centrée sur 50 % :
// posée en « overlay » sur les couleurs existantes, elle ajoute de la matière sans changer la teinte.
// Aucun coût pendant le jeu ; sans WebGL, l'interface garde ses dégradés lisses.

const VS = `attribute vec2 p; varying vec2 v; void main(){ v = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }`;
const FS = `#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec2 v;
uniform float seed;
// bruit de valeur périodique : la texture se raccorde sur ses bords
float hash(vec2 p){ vec3 q = fract(vec3(p.xyx) * 0.1031 + seed); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
float pnoise(vec2 p, float per){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash(mod(i, per)), b = hash(mod(i + vec2(1.0, 0.0), per));
  float c = hash(mod(i + vec2(0.0, 1.0), per)), d = hash(mod(i + vec2(1.0, 1.0), per));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float fbm(vec2 p, float per){
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { s += a * pnoise(p, per); p *= 2.0; per *= 2.0; a *= 0.5; }
  return s;
}
void main(){
  vec2 p = v * 8.0;
  float base = fbm(p, 8.0);                         // grain large de la roche
  float fine = pnoise(v * 64.0, 64.0);              // grain fin
  float vein = 1.0 - abs(fbm(p * 0.75 + 3.1, 6.0) * 2.0 - 1.0);
  float crack = smoothstep(0.93, 0.995, vein);      // fines fissures sombres
  float g = 0.5 + (base - 0.5) * 0.42 + (fine - 0.5) * 0.16 - crack * 0.2;
  gl_FragColor = vec4(vec3(clamp(g, 0.0, 1.0)), 1.0);
}`;

function render(size: number, seed: number): string | null {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const gl = c.getContext('webgl', { preserveDrawingBuffer: true, antialias: false }) as WebGLRenderingContext | null;
  if (!gl) return null;
  const sh = (type: number, src: string) => { const s = gl.createShader(type)!; gl.shaderSource(s, src); gl.compileShader(s); return s; };
  const prog = gl.createProgram()!;
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS));
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const a = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(a);
  gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
  gl.uniform1f(gl.getUniformLocation(prog, 'seed'), seed);
  gl.viewport(0, 0, size, size);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  const url = c.toDataURL('image/png');
  gl.getExtension('WEBGL_lose_context')?.loseContext(); // le contexte ne sert plus : on le rend tout de suite
  return url;
}

/** Calcule les matières et les expose en variables CSS (--tex-stone). À appeler une fois. */
export function installShaderTextures(): void {
  try {
    const stone = render(256, 0.37);
    if (stone) document.documentElement.style.setProperty('--tex-stone', `url("${stone}")`);
  } catch { /* sans WebGL : dégradés lisses */ }
}

// Prototype isolé, aucun import de la logique du jeu ou changement d'APK.
const { Application, Assets, Sprite, Container, Graphics } = window.PIXI ?? {};
const viewport = document.getElementById('viewport');
const stats = document.getElementById('stats');
const status = document.getElementById('status');
const controls = Object.fromEntries(['variant','stage','pose','animate','retina'].map(k=>[k,document.getElementById(k)]));
if (!Application) {
  status.textContent = 'PixiJS indisponible : vérifier la connexion CDN.';
  throw new Error('PIXI non disponible');
}
const app = new Application();
await app.init({
  resizeTo: viewport, background: '#162740', preference: 'webgl',
  resolution: Math.min(devicePixelRatio || 1, 2), autoDensity: true,
  antialias: true, powerPreference: 'high-performance'
});
viewport.appendChild(app.canvas);
const scenery = new Container();
const dragonLayer = new Container();
app.stage.addChild(scenery, dragonLayer);
const mountain = new Graphics().poly([0,0, 120,-80, 230,-20, 350,-130, 550,-20, 750,-95, 1000,0]).fill({color:0x233d58,alpha:0.75});
scenery.addChild(mountain);
const sprite = new Sprite();
sprite.anchor.set(0.5);
dragonLayer.addChild(sprite);
let sequence = 0, activePath = '', busy = false;
let failures = 0, frames = 0, totalFrame = 0, lastMeasurement = performance.now();
let nextFlap = 0, flapDown = false;
controls.autoflap.addEventListener('change', () => {if (controls.autoflap.checked) {controls.pose.value='flyUp'; void selectTexture();} else {controls.pose.value='full'; void selectTexture();}});
function pathFor(v,s,p){ return '../assets/'+v+'/'+s+'/'+v+'_'+s+'_'+p+'.webp'; }
async function selectTexture(){
  const id = ++sequence, {variant,stage,pose} = Object.fromEntries(['variant','stage','pose'].map(k=>[k,controls[k].value]));
  controls.pose.querySelector('option[value="flyMid"]').disabled = !(variant==='dragon' && stage==='adult');
  if (pose==='flyMid' && !(variant==='dragon' && stage==='adult')) {controls.pose.value='flyUp';return selectTexture();}
  const next = pathFor(variant,stage,controls.pose.value);
  busy = true;status.textContent = 'Chargement : '+next;
  try {
    const texture = await Assets.load(next);
    if (id !== sequence) return;
    sprite.texture = texture;
    activePath = next;
    failures = 0;
    status.textContent = 'Texture chargée : '+texture.width+' × '+texture.height+' px — '+next;
    layout();
  } catch (err) {
    if (id !== sequence) return;
    failures++;
    status.textContent = 'Image absente : '+next+'. Exécuter npm run build pour installer les sprites avant le test local.';
    console.error(err);
  } finally { if (id === sequence) busy = false; }
}
function layout(){
  const w = app.screen.width,h=app.screen.height;
  scenery.x=0;scenery.y=h*0.82;scenery.scale.set(w/1000);
  dragonLayer.position.set(w*0.5,h*0.54);
  if(sprite.texture?.width && sprite.texture?.height) {
    const targetW=w*.83,targetH=h*.75;
    sprite.scale.set(Math.min(targetW/sprite.texture.width,targetH/sprite.texture.height,1.25));
  }
}
for(const key of ['variant','stage','pose']) controls[key].addEventListener('change',()=>{if(key==='pose')controls.autoflap.checked=false;void selectTexture();});
controls.retina.addEventListener('change',()=>{
  app.renderer.resolution = controls.retina.checked ? Math.min(devicePixelRatio||1,2):1;
  app.renderer.resize(viewport.clientWidth,viewport.clientHeight);
  layout();
});
window.addEventListener('resize',layout);
let elapsed=0;
app.ticker.add((ticker)=>{
  const dt=Math.min(ticker.deltaMS,80);
  elapsed+=dt/1000;
  if (controls.autoflap.checked && elapsed >= nextFlap && !busy) {
    flapDown = !flapDown;
    controls.pose.value = flapDown ? 'flyDown' : 'flyUp';
    nextFlap = elapsed + (flapDown ? 0.24 : 0.42);
    void selectTexture();
  }
  // Subtle movement only: do not claim this is articulated animation.
  dragonLayer.y=app.screen.height*.54+(controls.animate.checked?Math.sin(elapsed*1.8)*4:0);
  dragonLayer.rotation=controls.animate.checked?Math.sin(elapsed*.7)*.004:0;
  frames++;totalFrame+=dt;
  const now=performance.now();
  if(now-lastMeasurement>1000){
    const fps=Math.round(frames*1000/(now-lastMeasurement));
    stats.textContent='WebGL GPU direct | '+fps+' FPS | '+(totalFrame/frames).toFixed(1)+' ms/frame RAF | DPR '+app.renderer.resolution+' | '+(sprite.texture?.width||'–')+'×'+(sprite.texture?.height||'–')+' | '+(busy?'chargement':failures?'image absente':'actif');
    frames=0;totalFrame=0;lastMeasurement=now;
  }
});
layout();
await selectTexture();

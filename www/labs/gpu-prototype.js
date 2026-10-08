import { BabyMotion } from './baby-motion.js';
import { FrameDiagnostics } from './frame-diagnostics.js';
import { auditBabyAssets } from './baby-assets-audit.js';
import { DepthStage } from './depth-stage.js';
import { CharacterPoseCache } from './pose-cache.js';
import { ClipPlayer } from './clip-player.js';
import { RigDebug } from './rig-debug.js';
import { LayeredCharacter } from './layered-character.js';
import { applyClipToCharacter, loadLayers } from './character-driver.js';
// Prototype isolé, aucun import de la logique du jeu ou changement d'APK.
const { Application, Assets, Sprite, Container, Graphics } = window.PIXI ?? {};
const viewport = document.getElementById('viewport');
const stats = document.getElementById('stats');
const status = document.getElementById('status');
const controls = Object.fromEntries(['variant','stage','pose','animate','retina','autoflap','depth','rig','speed','light','compare','capture','audit'].map(k=>[k,document.getElementById(k)]));
if (!Application) {
  status.textContent = 'PixiJS indisponible : vérifier la connexion CDN.';
  throw new Error('PIXI non disponible');
}
const babyMotion = new BabyMotion();
const diagnostics = new FrameDiagnostics(600);
let previousFrameTime = null;
const clipPlayer = new ClipPlayer();
const poseCache = new CharacterPoseCache(Assets);
const app = new Application();
await app.init({
  resizeTo: viewport, background: '#162740', preference: 'webgl',
  resolution: Math.min(devicePixelRatio || 1, 2), autoDensity: true,
  antialias: true, powerPreference: 'high-performance'
});
viewport.appendChild(app.canvas);
const scenery = new Container();
const dragonLayer = new Container();
app.stage.addChild(scenery);
const depthStage = new DepthStage(window.PIXI, app.stage);
app.stage.addChild(dragonLayer); // dragon always renders in front of depth cues
const mountain = new Graphics().poly([0,0, 120,-80, 230,-20, 350,-130, 550,-20, 750,-95, 1000,0]).fill({color:0x233d58,alpha:0.75});
scenery.addChild(mountain);
const sprite = new Sprite();
sprite.anchor.set(0.5);
dragonLayer.addChild(sprite);
const comparisonSprite=new Sprite();
comparisonSprite.anchor.set(.5);
comparisonSprite.visible=false;
dragonLayer.addChild(comparisonSprite);
const rigDebug = new RigDebug(window.PIXI,dragonLayer);
const layered = new LayeredCharacter(window.PIXI, path => Assets.load(path));
dragonLayer.addChild(layered.root);
let layerGeneration=0;
let activeRigIdentity=null;
const rigIdentity=()=>controls.variant.value+':'+controls.stage.value;
const mayDisplayRig=()=>controls.stage.value==='baby' && controls.pose.value==='full' && !controls.compare.checked && activeRigIdentity===rigIdentity();
function updateRigVisibility(){
  const useRig=!!layered.definition && mayDisplayRig();
  layered.root.visible=useRig;
  sprite.visible=!useRig;
}
async function refreshLayers(){
  const request=++layerGeneration;
  layered.cancelPending();
  activeRigIdentity=null;
  updateRigVisibility();
  if(controls.stage.value!=='baby')return;
  try {
    const def=await loadLayers(controls.variant.value,'baby');
    if(request!==layerGeneration)return;
    if(!def)return; // flat-sprite fallback until artists approve individual layers
    const ok=await layered.load(def);
    if(request!==layerGeneration||!ok)return;
    activeRigIdentity=rigIdentity();
    updateRigVisibility();
    layout();
    status.textContent='Rig multicouche chargé: '+controls.variant.value+' bébé';
  }catch(error){if(request===layerGeneration){console.warn('Layers unavailable: flat sprite fallback',error);activeRigIdentity=null;updateRigVisibility();}}
}

let sequence = 0, activePath = '', busy = false;
let failures = 0, frames = 0, totalFrame = 0, lastMeasurement = performance.now();
let nextFlap = 0, flapDown = false;
let flightTextures=null,flightRequest=0;
async function prepareFlight(){
  const ticket=++flightRequest;
  flightTextures=null;
  if(!controls.autoflap.checked)return;
  const {variant,stage}=controls;
  const selectedVariant=variant.value,selectedStage=stage.value;
  try{
    const [up,down]=await Promise.all([
      poseCache.load(selectedVariant,selectedStage,'flyUp'),
      poseCache.load(selectedVariant,selectedStage,'flyDown')
    ]);
    if(ticket!==flightRequest||!controls.autoflap.checked)return;
    flightTextures={up,down};
    sprite.texture=up;
    flapDown=false;
    nextFlap=elapsed+.35;
    layout();
  }catch(e){if(ticket===flightRequest){controls.autoflap.checked=false;status.textContent='Vol indisponible : poses manquantes';console.warn(e);}}
}

let babyPose = null;
let happyUntil = 0;
let compareGeneration=0;
controls.audit.addEventListener('click',async()=>{
  controls.audit.disabled=true;
  status.textContent='Vérification des illustrations articulées des deux bébés…';
  try{
    const result=await auditBabyAssets();
    status.textContent=result.reports.map(r=>r.variant+': '+(r.ready?'calques prêts':'non prêt — '+r.issue+(r.missing.length?' ('+r.missing.join(', ')+')':''))).join(' | ');
  }catch(e){status.textContent='Audit impossible : '+e.message;}
  finally{controls.audit.disabled=false;}
});
const recolor=()=>{const value=Number(controls.light.value)/100;dragonLayer.alpha=.55+value*.45;};
controls.light.addEventListener('input',recolor);recolor();
async function loadComparison(){
  const id=++compareGeneration;
  comparisonSprite.visible=false;
  if(!controls.compare.checked||controls.stage.value!=='baby')return;
  const opposite=controls.variant.value==='dragon'?'dragonne':'dragon';
  try{
    const texture=await poseCache.load(opposite,'baby',controls.pose.value);
    if(id!==compareGeneration)return;
    comparisonSprite.texture=texture;
    comparisonSprite.visible=true;layout();
  }catch(e){if(id===compareGeneration){status.textContent='Comparaison indisponible : illustration absente';console.warn(e);}}
}
controls.compare.addEventListener('change',()=>{
  if(controls.compare.checked){layered.cancelPending();++layerGeneration;}
  updateRigVisibility();
  if(!controls.compare.checked && controls.pose.value==='full' && controls.stage.value==='baby' && !mayDisplayRig())void refreshLayers();
  void loadComparison();layout();
});
controls.capture.addEventListener('click',()=>{
  try{const a=document.createElement('a');a.download='lumia-bebes-v2.png';a.href=app.canvas.toDataURL('image/png');a.click();}
  catch(e){status.textContent='Capture indisponible (WebGL ou droits du navigateur).';console.warn(e);}
});
controls.autoflap.addEventListener('change', () => {
  controls.pose.value=controls.autoflap.checked?'flyUp':'full';
  if(controls.autoflap.checked){void selectTexture();void prepareFlight();}
  else{++flightRequest;flightTextures=null;void selectTexture();}
});
function pathFor(v,s,p){ return '../assets/'+v+'/'+s+'/'+v+'_'+s+'_'+p+'.webp'; }
async function selectTexture(){
  const id = ++sequence, {variant,stage,pose} = Object.fromEntries(['variant','stage','pose'].map(k=>[k,controls[k].value]));
  controls.pose.querySelector('option[value="flyMid"]').disabled = !(variant==='dragon' && stage==='adult');
  if (pose==='flyMid' && !(variant==='dragon' && stage==='adult')) {controls.pose.value='flyUp';return selectTexture();}
  const next = pathFor(variant,stage,controls.pose.value);
  if(activeRigIdentity!==rigIdentity())updateRigVisibility();
  if(pose!=='full' || stage!=='baby'){
    layered.cancelPending();
    ++layerGeneration;
    activeRigIdentity=null;
    updateRigVisibility();
  }
  busy = true;status.textContent = 'Chargement : '+next;
  try {
    const texture = await poseCache.load(variant,stage,controls.pose.value);
    if (id !== sequence) return;
    sprite.texture = texture;
    activePath = next;
    failures = 0;
    status.textContent = 'Texture chargée : '+texture.width+' × '+texture.height+' px — '+next;
    layout();
    void loadComparison();
    if(pose==='full' && stage==='baby')void refreshLayers();
    if (stage === 'baby' && pose === 'full') void poseCache.preload(variant,stage,['sleep','flyUp','flyDown']);
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
  depthStage.resize(w,h);
  if(sprite.texture?.width && sprite.texture?.height) {
    const targetW=w*.83,targetH=h*.75;
    const comparisonOn=controls.compare.checked && controls.stage.value==='baby';
    const slotW=comparisonOn?targetW*.49:targetW;
    sprite.scale.set(Math.min(slotW/sprite.texture.width,targetH/sprite.texture.height,1.25));
    sprite.x=comparisonOn?-w*.22:0;
    layered.root.position.set(sprite.x,0);
    layered.root.scale.set(sprite.scale.x);
    updateRigVisibility();
    comparisonSprite.x=w*.22;
    comparisonSprite.y=0;
    if(comparisonSprite.texture?.width && comparisonSprite.texture?.height){
      comparisonSprite.scale.set(Math.min(slotW/comparisonSprite.texture.width,targetH/comparisonSprite.texture.height,1.25));
    }
    comparisonSprite.visible=comparisonOn && !!comparisonSprite.texture?.width && comparisonSprite.visible;
  }
}
for(const key of ['variant','stage','pose']) controls[key].addEventListener('change',()=>{
  if(key==='pose')controls.autoflap.checked=false;
  ++flightRequest;flightTextures=null;
  void selectTexture();
  if(controls.autoflap.checked)void prepareFlight();
});
controls.retina.addEventListener('change',()=>{
  app.renderer.resolution = controls.retina.checked ? Math.min(devicePixelRatio||1,2):1;
  app.renderer.resize(viewport.clientWidth,viewport.clientHeight);
  layout();
});
controls.depth.addEventListener('change',()=>depthStage.configure({enabled:controls.depth.checked}));
depthStage.configure({enabled:controls.depth.checked});
window.addEventListener('resize',layout);
let elapsed=0;
app.ticker.add((ticker)=>{
  const frameTime=performance.now();
  if(previousFrameTime!==null)diagnostics.add(frameTime-previousFrameTime);
  previousFrameTime=frameTime;
  const dt=Math.min(ticker.deltaMS,80)*Number(controls.speed.value);
  elapsed+=dt/1000;
  if (controls.autoflap.checked && flightTextures && elapsed >= nextFlap) {
    flapDown = !flapDown;
    controls.pose.value = flapDown ? 'flyDown' : 'flyUp';
    sprite.texture=flapDown ? flightTextures.down : flightTextures.up;
    nextFlap = elapsed + (flapDown ? 0.24 : 0.42);
    layout();
  }
  // Subtle movement only: do not claim this is articulated animation.
  if(controls.stage.value==='baby' && controls.animate.checked){
    babyMotion.setMode(controls.autoflap.checked?'fly':controls.pose.value==='sleep'?'sleep':'idle');
    babyPose=babyMotion.update(dt/1000);
    dragonLayer.position.set(app.screen.width*.5+babyPose.x,app.screen.height*.54+babyPose.y);
    dragonLayer.rotation=babyPose.rotation;
    // Sprite scale is established by layout. Only apply minimal breathing to the container.
    dragonLayer.scale.set(babyPose.scaleX,babyPose.scaleY);
  }else{
    dragonLayer.position.set(app.screen.width*.5,app.screen.height*.54);
    dragonLayer.rotation=0;dragonLayer.scale.set(1);
  }
  const nextClip = elapsed < happyUntil ? 'happy' : controls.autoflap.checked?'fly':controls.pose.value==='sleep'?'sleep':'idle';
  if(controls.stage.value==='baby')clipPlayer.play(nextClip);
  const poseState=clipPlayer.update(dt/1000);
  rigDebug.visible=controls.rig.checked && controls.stage.value==='baby';
  rigDebug.draw(poseState);
  if(layered.root.visible)applyClipToCharacter(layered,poseState);
  depthStage.tick(dt/1000,{x:0,y:0,width:app.screen.width,height:app.screen.height,airborne:controls.autoflap.checked});
  frames++;totalFrame+=dt;
  const now=performance.now();
  if(now-lastMeasurement>1000){
    const fps=Math.round(frames*1000/(now-lastMeasurement));
    const diag=diagnostics.summary();
    stats.textContent='WebGL | '+fps+' FPS (1 s) | p95 '+(diag.p95Ms?.toFixed(1)??'–')+' ms | DPR '+app.renderer.resolution+' | '+(sprite.texture?.width||'–')+'×'+(sprite.texture?.height||'–')+' | '+(busy?'chargement':failures?'image absente':'actif');
    frames=0;totalFrame=0;lastMeasurement=now;
  }
});
layout();
await selectTexture();

// Screen-space tap interaction in the isolated prototype.
app.canvas.addEventListener('pointerdown',event=>{
  if(controls.stage.value!=='baby')return;
  const rect=app.canvas.getBoundingClientRect();
  const x=((event.clientX-rect.left)/rect.width-.5)*2;
  const y=((event.clientY-rect.top)/rect.height-.5)*2;
  babyMotion.touch(x,y);
  happyUntil = elapsed + .7;
  clipPlayer.play('happy',{reset:true});
  depthStage.movePointer(x,y);
});

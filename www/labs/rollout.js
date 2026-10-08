/**
 * Promotion pipeline for an animation rig: validate both babies first, then
 * compile the SAME skeleton/clip schema for the other ages.
 *
 * A promotion is explicitly gated by validation results; no APK is published.
 * This module has no dependency on Lumia or Pixi and is reusable.
 */
export const STAGES=['baby','young','adult','legendary'];
export const VARIANTS=['dragon','dragonne'];
const required=['body','head','tail','wingNear','wingFar'];
const clips=['idle','sleep','fly','happy'];
const n=x=>typeof x==='number'&&Number.isFinite(x);
export function validateRig(rig){
  const errors=[];
  if(!rig||!Array.isArray(rig.parts)){return ['Missing rig.parts'];}
  const names=new Set();
  for(const p of rig.parts){
    if(!p.name||names.has(p.name))errors.push('Duplicate/invalid name: '+p.name);
    names.add(p.name);
    if(!Array.isArray(p.position)||p.position.length!==2||!p.position.every(n))errors.push('Invalid position: '+p.name);
    if(typeof p.texture!=='string'||!p.texture.endsWith('.webp'))errors.push('Invalid texture: '+p.name);
  }
  for(const key of required)if(!names.has(key))errors.push('Missing bone: '+key);
  for(const p of rig.parts){
    if(p.parent&&!names.has(p.parent))errors.push('Unknown parent: '+p.name);
    let node=p,seen=new Set();
    while(node){
      if(seen.has(node.name)){errors.push('Cycle: '+p.name);break;}
      seen.add(node.name);node=rig.parts.find(x=>x.name===node.parent);
    }
  }
  return errors;
}
export function validateClips(animationClips){
  const errors=[];
  for(const key of clips){
    const clip=animationClips?.[key];
    if(!clip||!n(clip.duration)||clip.duration<=0||!clip.bones){errors.push('Missing/invalid clip: '+key);continue;}
    for(const [bone,channels] of Object.entries(clip.bones)){
      if(!required.includes(bone)&&bone!=='neck'&&bone!=='jaw'&&bone!=='eyelid'&&bone!=='eye')
        errors.push('Unknown clip bone: '+bone);
      for(const [channel,keys] of Object.entries(channels)){
        if(!Array.isArray(keys)||!keys.length||keys.some((v,i)=>!Array.isArray(v)||v.length!==2||!v.every(n)||v[0]<0||(i>0&&v[0]<keys[i-1][0])))
          errors.push('Bad animation keys: '+key+'/'+bone+'/'+channel);
      }
    }
  }
  return errors;
}
const key=(v,s)=>v+':'+s;
/** For each baby, attest independent asset, animation and Android performance tests. */
export function babyReady(reports,{maxP95Ms=25,minFps=30}={}){
  return VARIANTS.every(variant=>{
    const report=reports?.[key(variant,'baby')];
    return report?.artApproved===true&&report?.rigValidated===true&&
      report?.animationsValidated===true&&report?.androidTested===true&&
      n(report.p95FrameMs)&&report.p95FrameMs<=maxP95Ms&&
      n(report.fps)&&report.fps>=minFps&&report?.crashes===0;
  });
}
/** No blind promotion. A stage only inherits motion curves, not images/pivots. */
export function planRollout(reports,{stages=STAGES}={}){
  const approved=babyReady(reports);
  return {
    approved,
    next:approved?stages.filter(stage=>stage!=='baby').flatMap(stage=>VARIANTS.map(variant=>({
      variant,stage,task:'prepare artwork + measure rig pivots + Android validation'
    }))):[],
    blockedReason:approved?null:'Both baby variants need complete signed-off Android and art reports'
  };
}
/** Per-stage proportional motion retargeting; input source clips are never mutated. */
export function retargetClips(source,{motionScale=1,tempo=1}={}){
  if(!n(motionScale)||motionScale<=0||!n(tempo)||tempo<=0)throw Error('Invalid retarget parameters');
  const out=structuredClone(source);
  for(const clip of Object.values(out)){
    clip.duration/=tempo;
    for(const channels of Object.values(clip.bones)){
      for(const [channel,frames] of Object.entries(channels)){
        channels[channel]=frames.map(([time,value])=>[
          time/tempo,channel.startsWith('scale')?1+(value-1)*motionScale:value*motionScale
        ]);
      }
    }
  }
  return out;
}

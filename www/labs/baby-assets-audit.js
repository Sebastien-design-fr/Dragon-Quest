import { validateLayerManifest } from './character-driver.js';
export const BABY_VARIANTS=['dragon','dragonne'];
export const REQUIRED_BONES=['body','head','tail','wingNear','wingFar'];
export function auditRig(rig){
  try{
    validateLayerManifest(rig);
    const names=new Set(rig.parts.map(part=>part.name));
    const missing=REQUIRED_BONES.filter(name=>!names.has(name));
    return {ready:missing.length===0,missing,issue:missing.length?'missing mandatory anatomy':null};
  }catch(e){return {ready:false,missing:[...REQUIRED_BONES],issue:String(e.message)};}
}
export async function auditBabyAssets(fetcher=fetch){
  const reports=[];
  for(const variant of BABY_VARIANTS){
    const base='../assets/layers/'+variant+'/baby/';
    try{
      const response=await fetcher(base+'rig.json');
      if(!response.ok){reports.push({variant,ready:false,missing:[...REQUIRED_BONES],issue:'rig manifest unavailable ('+response.status+')'});continue;}
      const rig=await response.json();
      const audit=auditRig(rig);
      if(!audit.ready){reports.push({variant,...audit});continue;}
      // Some Android WebViews reject HEAD for bundled file:// assets.
      const checks=await Promise.all(rig.parts.map(async part=>{
        try{
          const response=await fetcher(base+part.texture);
          return response.ok;
        }catch{return false;}
      }));
      const missing=rig.parts.filter((part,i)=>!checks[i]).map(part=>part.name);
      reports.push({variant,ready:missing.length===0,missing,issue:missing.length?'missing texture files':null});
    }catch(e){reports.push({variant,ready:false,missing:[...REQUIRED_BONES],issue:String(e?.message||e)});}
  }
  return {ready:reports.every(report=>report.ready),reports};
}

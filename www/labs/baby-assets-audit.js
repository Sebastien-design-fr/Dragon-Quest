/** Audit resources for both baby dragons before enabling articulated rendering. */
export const BABY_VARIANTS=['dragon','dragonne'];
export const REQUIRED_BONES=['body','head','tail','wingNear','wingFar'];
export function auditRig(rig){
  if(!rig||!Array.isArray(rig.parts))return {ready:false,missing:[...REQUIRED_BONES],issue:'missing manifest'};
  const names=new Set(rig.parts.map(p=>p.name));
  const missing=REQUIRED_BONES.filter(k=>!names.has(k));
  return {ready:missing.length===0,missing,issue:missing.length?'missing mandatory anatomy':null};
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
      const textures=await Promise.all(rig.parts.map(p=>fetcher(base+p.texture,{method:'HEAD'}).then(r=>r.ok).catch(()=>false)));
      const missing=rig.parts.filter((p,i)=>!textures[i]).map(p=>p.name);
      reports.push({variant,ready:missing.length===0,missing,issue:missing.length?'missing texture files':null});
    }catch(e){reports.push({variant,ready:false,missing:[...REQUIRED_BONES],issue:String(e?.message||e)});}
  }
  return {ready:reports.every(r=>r.ready),reports};
}

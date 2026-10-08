/** Vérifie les dimensions WebP dans les bundles (pas d'upscale). */
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
export function inspectWebp(buffer){
  if(buffer.toString('ascii',0,4)!=='RIFF'||buffer.toString('ascii',8,12)!=='WEBP')throw Error('WebP invalide');
  let off=12,width=0,height=0,alpha=false;
  while(off+8<=buffer.length){
    const type=buffer.toString('ascii',off,off+4),size=buffer.readUInt32LE(off+4);
    const p=off+8;if(p+size>buffer.length)throw Error('WebP tronqué');
    if(type==='VP8X'&&size>=10){alpha=!!(buffer[p]&0x10);width=1+buffer.readUIntLE(p+4,3);height=1+buffer.readUIntLE(p+7,3);}
    if(type==='ALPH')alpha=true;
    if(type==='VP8 '&&size>=10&&!width){width=buffer.readUInt16LE(p+6)&0x3fff;height=buffer.readUInt16LE(p+8)&0x3fff;}
    if(type==='VP8L'&&size>=5&&!width){
      const b0=buffer[p+1],b1=buffer[p+2],b2=buffer[p+3],b3=buffer[p+4];
      width=1+(((b1&0x3f)<<8)|b0);height=1+(((b3&0x0f)<<10)|(b2<<2)|(b1>>6));alpha=!!(b3&0x10);
    }
    off=p+size+(size%2);
  }
  if(!width||!height)throw Error('Dimensions WebP introuvables');
  return {width,height,alpha};
}
export function verifyApprovedBundles(directory,{minimum=1600,strict=true}={}){
  const variations=['dragon','dragonne'],stages=['baby','young','adult','legendary'];
  const issues=[],report=[];let count=0;
  for(const variant of variations)for(const stage of stages){
    const bundle=JSON.parse(readFileSync(join(directory,variant+'-'+stage+'.json'),'utf8'));
    for(const [name,encoded] of Object.entries(bundle)){
      count++;
      const valid=name.startsWith(variant+'_'+stage+'_')&&/_(full|sleep|flyUp|flyDown|flyMid)\.webp$/.test(name);
      if(!valid)issues.push('Nom invalide '+name);
      let info;
      try{info=inspectWebp(Buffer.from(encoded,'base64'));}catch(e){issues.push(name+': '+e.message);continue;}
      report.push({name,...info});
      if(strict&&(info.width<minimum||!info.alpha))issues.push(name+': '+info.width+'x'+info.height+', alpha='+info.alpha);
    }
  }
  if(count!==40)issues.push('Nombre inattendu: '+count+'/40');
  if(issues.length)throw Error('Sprites HD non conformes:\n'+issues.join('\n'));
  return report.sort((a,b)=>a.name.localeCompare(b.name));
}
if(process.argv[1]?.endsWith('verify-approved-webp.mjs')){
  const report=verifyApprovedBundles('assets/dragon-mission-approved',{strict:process.env.DRAGON_HD_REQUIRED==='1'});
  console.log('Contrôle WebP: '+report.length+' fichiers, mode '+(process.env.DRAGON_HD_REQUIRED==='1'?'HD strict':'inventaire historique'));
  if(process.env.DRAGON_HD_REQUIRED==='1')console.log('Tous les sprites respectent 1600px et contiennent un canal alpha.');
}

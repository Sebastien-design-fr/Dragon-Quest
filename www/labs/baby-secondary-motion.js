/** Procedural secondary animation for articulated Lumia babies (radians/seconds). */
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
export class BabySecondaryMotion {
  constructor(seed=0){this.time=0;this.seed=seed;this.touchTime=-100;this.touchSide=1;}
  touch(side=1){this.touchTime=this.time;this.touchSide=side<0?-1:1;}
  update(dt,mode='idle'){
    this.time+=clamp(Number.isFinite(dt)?dt:0,0,.1);
    const t=this.time+this.seed;
    const flying=mode==='fly',sleeping=mode==='sleep';
    const blinkPhase=(t%4.7),blink=blinkPhase<.12?Math.sin(Math.PI*blinkPhase/.12):0;
    const pulse=Math.sin(t*(sleeping?1.3:2.25)*Math.PI);
    const touchAge=this.time-this.touchTime;
    const response=touchAge>=0&&touchAge<.65?Math.sin(Math.PI*touchAge/.65)*(1-touchAge/.65):0;
    return {
      body:{scaleX:1+pulse*(sleeping?.009:.006),scaleY:1-pulse*(sleeping?.013:.008)},
      neck:{rot:Math.sin(t*1.1)*.009},
      head:{rot:Math.sin(t*1.7)*.013-response*this.touchSide*.095},
      jaw:{rot:response*.09},
      eye:{x:Math.sin(t*.53)*.9,y:Math.sin(t*.41)*.55},
      eyelid:{scaleY:sleeping?1:.02+blink*.98},
      tail:{rot:Math.sin(t*(flying?5.4:1.9))*(sleeping?.02:.075)+response*.11},
      wingNear:{rot:Math.sin(t*1.45)*.012},
      wingFar:{rot:-Math.sin(t*1.45)*.012},
      frontLegNear:{rot:response*.055},
      frontLegFar:{rot:-response*.025}
    };
  }
}
export function combineMotion(primary={},secondary={}){
  const result={};
  for(const name of new Set([...Object.keys(primary),...Object.keys(secondary)])){
    const a=primary[name]??{},b=secondary[name]??{},channels={};
    for(const key of new Set([...Object.keys(a),...Object.keys(b)])){
      const neutral=key.startsWith('scale')?1:0;
      channels[key]=(a[key]??neutral)+(b[key]??neutral)-neutral;
    }
    result[name]=channels;
  }
  return result;
}

/** Small reusable 2.5D skeletal animation engine. Angles in radians, times in seconds. */
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export const ease=(t)=>{const x=clamp(t,0,1);return x*x*(3-2*x);};
export const lerp=(a,b,t)=>a+(b-a)*t;
/** Interpolate keyframes ([seconds,value]), holding first/last outside the range. */
export function sample(keys,t){
  if(!Array.isArray(keys)||!keys.length)return 0;
  if(t<=keys[0][0])return keys[0][1];
  for(let i=1;i<keys.length;i++){
    const [end,value]=keys[i], [start,prev]=keys[i-1];
    if(t<=end){if(end<=start)return value;return lerp(prev,value,ease((t-start)/(end-start)));}
  }
  return keys[keys.length-1][1];
}
export const BABY_CLIPS={
  idle:{duration:3.2,loop:true,bones:{
    body:{y:[[0,0],[.8,-2],[1.6,0],[2.4,2],[3.2,0]],scaleY:[[0,1],[.8,1.008],[1.6,1],[2.4,.994],[3.2,1]]},
    head:{rot:[[0,-.018],[1.6,.018],[3.2,-.018]]},
    tail:{rot:[[0,-.09],[1.6,.09],[3.2,-.09]]},
    wingNear:{rot:[[0,.018],[1.6,-.02],[3.2,.018]]},
    wingFar:{rot:[[0,-.01],[1.6,.012],[3.2,-.01]]}
  }},
  sleep:{duration:4.8,loop:true,bones:{
    body:{scaleY:[[0,1],[1.2,1.012],[2.4,1],[3.6,.992],[4.8,1]]},
    head:{rot:[[0,.045],[2.4,.055],[4.8,.045]]},
    tail:{rot:[[0,.02],[2.4,-.015],[4.8,.02]]}
  }},
  fly:{duration:.85,loop:true,bones:{
    body:{y:[[0,0],[.21,-5],[.43,1],[.64,3],[.85,0]],rot:[[0,0],[.43,-.012],[.85,0]]},
    wingNear:{rot:[[0,-.55],[.22,.62],[.45,.76],[.68,-.28],[.85,-.55]]},
    wingFar:{rot:[[0,.52],[.22,-.58],[.45,-.72],[.68,.25],[.85,.52]]},
    tail:{rot:[[0,-.1],[.4,.15],[.85,-.1]]}
  }},
  happy:{duration:.7,loop:false,bones:{
    body:{y:[[0,0],[.24,-11],[.47,-6],[.7,0]]},
    head:{rot:[[0,0],[.23,-.12],[.45,.1],[.7,0]]},
    tail:{rot:[[0,0],[.3,.23],[.7,0]]},
    wingNear:{rot:[[0,0],[.2,.2],[.5,-.11],[.7,0]]}
  }}
};
export class ClipPlayer {
  constructor(clips=BABY_CLIPS){this.clips=clips;this.name='idle';this.time=0;this.blend=1;this.previous=null;}
  play(name,{reset=false}={}){
    if(!this.clips[name])throw Error('Unknown clip '+name);
    if(name===this.name&&!reset)return;
    this.previous=this.current();this.name=name;this.time=0;this.blend=0;
  }
  current(){
    const clip=this.clips[this.name];
    const t=clip.loop?this.time%clip.duration:Math.min(this.time,clip.duration);
    const out={};
    for(const [bone,fields] of Object.entries(clip.bones))
      out[bone]=Object.fromEntries(Object.entries(fields).map(([key,keys])=>[key,sample(keys,t)]));
    return out;
  }
  update(dt){
    const d=clamp(Number.isFinite(dt)?dt:0,0,.1);
    this.time+=d;this.blend=Math.min(1,this.blend+d/.2);
    const next=this.current();
    if(this.previous&&this.blend<1){
      const out={};
      for(const bone of new Set([...Object.keys(next),...Object.keys(this.previous)])){
        const a=this.previous[bone]||{},b=next[bone]||{};
        out[bone]={};
        for(const key of new Set([...Object.keys(a),...Object.keys(b)])){
          const neutral=key.startsWith('scale')?1:0;
          out[bone][key]=lerp(a[key]??neutral,b[key]??neutral,ease(this.blend));
        }
      }
      return out;
    }
    this.previous=null;return next;
  }
}

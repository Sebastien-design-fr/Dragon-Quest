import { BabyMotion } from './baby-motion.js';
const motion=new BabyMotion();
function assert(ok,msg){if(!ok)throw Error(msg);}
for(const mode of ['idle','sleep','fly']){
  motion.setMode(mode);
  for(let i=0;i<1000;i++){const pose=motion.update(1/60);for(const [key,v] of Object.entries(pose))assert(Number.isFinite(v),mode+': '+key);}
}
motion.touch(.5,0);
assert(motion.update(1/60).glow>0,'Touch feedback absent');
console.log('BabyMotion: basic deterministic tests passed');

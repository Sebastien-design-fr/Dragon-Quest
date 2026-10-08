import assert from 'node:assert/strict';
import {BabyAnimationDirector} from './baby-animation-director.js';
const d=new BabyAnimationDirector();
for(const mode of ['idle','sleep','fly']){
 d.setMode(mode);
 for(let i=0;i<150;i++){
   const pose=d.update(1/60);
   assert.ok(Number.isFinite(pose.body.scaleY));
   assert.ok(Number.isFinite(pose.head.rot));
 }
}
d.setMode('idle');d.react(-1);assert.equal(d.mode,'happy');
for(let i=0;i<55;i++)d.update(1/60);
assert.equal(d.mode,'idle');
d.paused=true;const before=d.primary.time;d.update(1);assert.equal(d.primary.time,before);
assert.throws(()=>d.setMode('not-a-clip'));
console.log('Baby animation director transitions passed');

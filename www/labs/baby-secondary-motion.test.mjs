import assert from 'node:assert/strict';
import {BabySecondaryMotion,combineMotion} from './baby-secondary-motion.js';
const motion=new BabySecondaryMotion();
for(const mode of ['idle','sleep','fly']){
  for(let i=0;i<600;i++){
    const sample=motion.update(1/60,mode);
    for(const bone of Object.values(sample))for(const value of Object.values(bone))assert.ok(Number.isFinite(value));
  }
}
const blinkCheck=new BabySecondaryMotion();
blinkCheck.update(.1,'idle');
const lidOpen=blinkCheck.update(.1,'idle').eyelid.scaleY;
for(let i=0;i<270;i++)blinkCheck.update(1/60,'idle');
const lidClosed=blinkCheck.update(.06,'idle').eyelid.scaleY;
assert.ok(lidOpen < .1);
assert.ok(lidClosed > .1);
motion.touch(-1);
const result=motion.update(.15,'idle');
assert.ok(Number.isFinite(result.jaw.rot));
assert.equal(combineMotion({body:{scaleY:1.1},head:{rot:.1}},{body:{scaleY:.98},head:{rot:.02}}).body.scaleY,1.08);
console.log('Baby secondary animation tests passed');

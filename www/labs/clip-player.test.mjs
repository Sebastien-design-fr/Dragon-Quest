import assert from 'node:assert/strict';
import {sample,ClipPlayer,BABY_CLIPS} from './clip-player.js';
assert.equal(sample([[0,1],[1,2]],-.1),1);
assert.equal(sample([[0,1],[1,2]],2),2);
assert.equal(sample([[0,0],[1,10]],.5),5);
const p=new ClipPlayer();
for(const name of Object.keys(BABY_CLIPS)){
  p.play(name,{reset:true});
  for(let i=0;i<200;i++){
    const state=p.update(1/60);
    for(const bone of Object.values(state))for(const val of Object.values(bone))assert.ok(Number.isFinite(val));
  }
}
p.play('happy',{reset:true});p.update(4);
assert.equal(p.time,.1); // safe delta clamp prevents jumps during tab inactivity
console.log('ClipPlayer interpolation, blending and frame-clamping passed');

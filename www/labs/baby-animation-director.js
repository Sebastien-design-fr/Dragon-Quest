/** Reusable performance-safe animation director for a layered baby dragon. */
import {ClipPlayer,BABY_CLIPS} from './clip-player.js';
import {BabySecondaryMotion,combineMotion} from './baby-secondary-motion.js';
const MODES=new Set(['idle','sleep','fly','happy']);
export class BabyAnimationDirector{
  constructor({clips=BABY_CLIPS,seed=0}={}){
    this.primary=new ClipPlayer(clips);this.secondary=new BabySecondaryMotion(seed);
    this.mode='idle';this.baseMode='idle';this.happyRemaining=0;
    this.paused=false;this.speed=1;
  }
  setMode(mode){
    if(!MODES.has(mode))throw Error('Unknown animation '+mode);
    this.baseMode=mode==='happy'?'idle':mode;
    if(mode==='happy'){this.react();return;}
    if(this.happyRemaining<=0)this.#play(mode);
  }
  #play(mode){
    if(this.mode===mode)return;
    this.mode=mode;this.primary.play(mode);
  }
  react(side=1){
    this.secondary.touch(side);this.happyRemaining=this.primary.clips.happy.duration;
    this.mode='happy';this.primary.play('happy',{reset:true});
  }
  update(deltaSeconds){
    if(this.paused)return this.lastPose??{};
    const dt=Math.max(0,Math.min(.1,Number.isFinite(deltaSeconds)?deltaSeconds:0))*this.speed;
    if(this.happyRemaining>0){
      this.happyRemaining=Math.max(0,this.happyRemaining-dt);
      if(this.happyRemaining===0)this.#play(this.baseMode);
    }else this.#play(this.baseMode);
    const base=this.primary.update(dt);
    const secondary=this.secondary.update(dt,this.mode);
    this.lastPose=combineMotion(base,secondary);
    return this.lastPose;
  }
}

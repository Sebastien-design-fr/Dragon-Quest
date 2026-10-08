/* Lumia baby lab — phase 1. A procedural secondary-motion controller for approved flat sprites.
 * Not a replacement for articulated assets; deliberately avoids destructive deformation.
 */
export class BabyMotion {
  constructor(){this.time=0;this.mode='idle';this.transition=0;this.tap=0;this.pointer={x:0,y:0};}
  setMode(mode){if(this.mode!==mode){this.mode=mode;this.transition=0;}}
  touch(x=0,y=0){this.pointer={x,y};this.tap=1;}
  update(dt){
    dt=Math.max(0,Math.min(.05,dt));this.time+=dt;this.transition+=dt;
    this.tap=Math.max(0,this.tap-dt*1.8);
    const t=this.time, sleep=this.mode==='sleep', fly=this.mode==='fly';
    const breathing=Math.sin(t*(sleep?1.25:2.6));
    const hop=this.tap>0?Math.sin((1-this.tap)*Math.PI)*this.tap*12:0;
    return {
      x:Math.sin(t*.64)*(sleep?0:1.7)+this.pointer.x*this.tap*3,
      y:breathing*(sleep?1.4:2.3)-(fly?Math.sin(t*5)*6:hop),
      rotation:Math.sin(t*.9)*(sleep?.0015:.006)+this.pointer.x*this.tap*.018,
      scaleX:1+breathing*.0025,
      scaleY:1+breathing*(sleep?.005:.008),
      glow:Math.max(0,Math.sin(t*1.3))*.12+this.tap*.2
    };
  }
}

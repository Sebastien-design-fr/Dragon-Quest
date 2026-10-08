/** Debug skeleton overlay. It is a diagnostic visual aid, NOT approved dragon artwork. */
export class RigDebug {
  constructor(PIXI,parent){
    this.lines=new PIXI.Graphics();parent.addChild(this.lines);
    this.visible=false;this.time=0;
  }
  draw(state,scale=1){
    this.lines.clear();this.lines.visible=this.visible;
    if(!this.visible)return;
    const nodes={
      body:[0,0],head:[70,-65],tail:[-98,26],
      wingNear:[-24,-56],wingFar:[-55,-65]
    };
    const body=state.body||{};
    const mid=[body.x||0,body.y||0];
    const spin=(point,rot)=>[point[0]*Math.cos(rot)-point[1]*Math.sin(rot),point[0]*Math.sin(rot)+point[1]*Math.cos(rot)];
    this.lines.moveTo(-90,40).lineTo(60,40).stroke({color:0x8de5ff,width:1.8,alpha:.42});
    for(const [name,pos] of Object.entries(nodes)){
      if(name==='body')continue;
      const part=state[name]||{};
      const pivot=[pos[0]+mid[0],pos[1]+mid[1]];
      const endpoint=spin(name.startsWith('wing')?[0,-75]:name==='tail'?[-65,14]:[30,-22],part.rot||0);
      this.lines.moveTo(mid[0],mid[1]).lineTo(...pivot).stroke({color:0x77caf8,width:2,alpha:.8});
      this.lines.moveTo(...pivot).lineTo(pivot[0]+endpoint[0],pivot[1]+endpoint[1]).stroke({color:0xffd28b,width:3,alpha:.95});
      this.lines.circle(...pivot,4).fill({color:0xffffff,alpha:.9});
    }
    this.lines.circle(...mid,5).fill(0x5ac9fa);
  }
  destroy(){this.lines.parent?.removeChild(this.lines);this.lines.destroy();}
}

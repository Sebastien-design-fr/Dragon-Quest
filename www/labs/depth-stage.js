/**
 * Reusable 2.5D scene accessories. No dependency on Lumia assets/game state.
 * Creates screen-space parallax ambience and a ground shadow. This is NOT actual
 * 3D geometry or normal-map lighting on the dragon texture.
 *
 * PixiJS 8 injected by caller, no CDN or global imports here.
 */
export class DepthStage {
  constructor(PIXI, world) {
    const { Container, Graphics } = PIXI;
    this.Container = Container; this.Graphics = Graphics;
    this.world = world;
    this.background = new Container();
    this.floor = new Container();
    this.shadow = new Graphics();
    this.halo = new Graphics();
    this.world.addChildAt(this.background, 0);
    this.world.addChild(this.floor);
    this.world.addChild(this.halo);
    this.world.addChild(this.shadow);
    this.width=0;this.height=0;this.enabled=true;this.strength=0.65;
    this.pointer={x:0,y:0};this.smooth={x:0,y:0};
  }
  configure({enabled=this.enabled,strength=this.strength}={}) {
    this.enabled=Boolean(enabled);
    this.strength=Math.max(0,Math.min(1,Number(strength)||0));
    this.background.visible=this.floor.visible=this.halo.visible=this.shadow.visible=this.enabled;
  }
  resize(w,h) {
    this.width=w;this.height=h;
    for(const layer of [this.background,this.floor]) layer.removeChildren().forEach(child=>child.destroy());
    const {Graphics}=this;
    const make=(points,color,alpha,parent)=>{
      const g=new Graphics();g.poly(points).fill({color,alpha});parent.addChild(g);
    };
    make([0,h*.75,w*.17,h*.47,w*.34,h*.68,w*.54,h*.41,w*.77,h*.65,w,h*.46,w,h,0,h],
      0x233f62,.38,this.background);
    make([0,h*.85,w*.22,h*.67,w*.41,h*.79,w*.65,h*.61,w,h*.83,w,h,0,h],
      0x345471,.53,this.background);
    make([0,h*.82,w,h*.82,w,h,0,h],0x162b32,.75,this.floor);
    this.drawShadow(w*.5,h*.79,w*.23);
  }
  drawShadow(x,y,r) {
    if(!this.enabled)return;
    this.shadow.clear();
    // Three nested translucent ellipses approximate a soft contact shadow cheaply.
    for(const [s,a] of [[1.5,.075],[1.12,.09],[.7,.13]]) {
      this.shadow.ellipse(x,y,r*s,r*.24*s).fill({color:0x030913,alpha:a*this.strength});
    }
    this.halo.clear();
    for(const [s,a] of [[1.5,.025],[1.0,.035],[.55,.05]]) {
      this.halo.circle(x,y-r*.48,r*s).fill({color:0x7acaf3,alpha:a*this.strength});
    }
  }
  movePointer(x,y){this.pointer.x=Math.max(-1,Math.min(1,x));this.pointer.y=Math.max(-1,Math.min(1,y));}
  tick(dt,{x=0,y=0,width=this.width,height=this.height,airborne=false}={}) {
    if(!this.enabled)return;
    const k=1-Math.exp(-Math.min(dt,.05)*5);
    this.smooth.x+=(this.pointer.x-this.smooth.x)*k;
    this.smooth.y+=(this.pointer.y-this.smooth.y)*k;
    this.background.position.set(-this.smooth.x*9*this.strength,-this.smooth.y*5*this.strength);
    this.floor.position.set(-this.smooth.x*3*this.strength,0);
    const groundY=height*.81;
    this.drawShadow(width*.5+x*.15,groundY,Math.min(width,height)*(.23+(airborne?.06:0)));
    this.shadow.alpha=airborne?.6:1;
  }
  destroy(){
    for(const layer of [this.background,this.floor,this.halo,this.shadow]) {
      layer.parent?.removeChild(layer);layer.destroy({children:true});
    }
  }
}

/**
 * Runtime skeleton for 2.5D characters. Depends only on an injected PixiJS
 * instance and a texture loader; no Lumia-specific logic or artwork.
 * Each part is a separate transparent sprite, so the source art MUST be
 * prepared as independent layers with consistent pivot coordinates.
 */
export class LayeredCharacter {
  constructor(PIXI, loadTexture){
    this.PIXI=PIXI;this.loadTexture=loadTexture;
    this.root=new PIXI.Container();
    this.parts=new Map();
    this.definition=null;
    this.generation=0;
  }
  async load(definition){
    const generation=++this.generation;
    this.clear();
    this.validate(definition);
    const staged=[];
    for(const part of definition.parts){
      const texture=await this.loadTexture(part.texture);
      if(generation!==this.generation)return false;
      const joint=new this.PIXI.Container();
      const img=new this.PIXI.Sprite(texture);
      img.anchor.set(part.pivot?.[0]??.5,part.pivot?.[1]??.5);
      img.position.set(part.offset?.[0]??0,part.offset?.[1]??0);
      joint.position.set(part.position[0],part.position[1]);
      joint.addChild(img);
      staged.push({name:part.name,joint,parent:part.parent??null,z:part.z??0});
    }
    if(generation!==this.generation)return false;
    const byName=new Map(staged.map(p=>[p.name,p]));
    for(const part of staged.sort((a,b)=>a.z-b.z)){
      const parent=part.parent?byName.get(part.parent)?.joint:this.root;
      if(!parent)throw Error('Missing parent '+part.parent);
      parent.addChild(part.joint);
      this.parts.set(part.name,part.joint);
    }
    this.definition=definition;
    return true;
  }
  validate(def){
    if(!def||!Array.isArray(def.parts)||!def.parts.length)throw Error('parts array required');
    const names=new Set();
    for(const p of def.parts){
      if(!p.name||names.has(p.name))throw Error('Duplicate or missing part name');
      if(typeof p.texture!=='string'||!Array.isArray(p.position)||p.position.length!==2)throw Error('Invalid part '+p.name);
      names.add(p.name);
    }
    for(const p of def.parts){
      let parent=p.parent,visited=new Set([p.name]);
      while(parent){if(visited.has(parent))throw Error('Bone cycle '+p.name);visited.add(parent);
        parent=def.parts.find(x=>x.name===parent)?.parent??null;
      }
      if(p.parent&&!names.has(p.parent))throw Error('Unknown parent '+p.parent);
    }
  }
  pose(rotations={},translations={}){
    for(const [name,node] of this.parts){
      node.rotation=Number.isFinite(rotations[name])?rotations[name]:0;
      const def=this.definition.parts.find(p=>p.name===name);
      const move=translations[name]??[0,0];
      node.position.set(def.position[0]+(move[0]??0),def.position[1]+(move[1]??0));
    }
  }
  clear(){
    this.root.removeChildren().forEach(child=>child.destroy({children:true,texture:false,textureSource:false}));
    this.parts.clear();
    this.definition=null;
  }
  destroy(){this.generation++;this.clear();this.root.destroy();}
}

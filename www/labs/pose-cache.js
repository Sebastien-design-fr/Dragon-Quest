/** Reusable GPU texture/pose cache for 2D and 2.5D characters (PixiJS 8). */
export class CharacterPoseCache {
  constructor(assets,{baseUrl='../assets',maxEntries=28}={}){
    this.assets=assets;this.baseUrl=baseUrl.replace(/\/$/,'');
    this.maxEntries=maxEntries;this.cache=new Map();this.missing=new Set();
  }
  path(variant,stage,pose){
    for(const part of [variant,stage,pose])if(!/^[a-zA-Z0-9]+$/.test(part))throw new Error('Invalid character identifier');
    return `${this.baseUrl}/${variant}/${stage}/${variant}_${stage}_${pose}.webp`;
  }
  async load(variant,stage,pose){
    const path=this.path(variant,stage,pose);
    if(this.cache.has(path)){
      const value=this.cache.get(path);this.cache.delete(path);this.cache.set(path,value);return value;
    }
    const texture=await this.assets.load(path);
    this.cache.set(path,texture);
    // Do not destroy textures: PixiJS owns its cache; just release our references.
    while(this.cache.size>this.maxEntries)this.cache.delete(this.cache.keys().next().value);
    return texture;
  }
  async preload(variant,stage,poses){
    return Promise.allSettled(poses.map(p=>this.load(variant,stage,p)));
  }
  dispose(){this.cache.clear();this.missing.clear();}
}

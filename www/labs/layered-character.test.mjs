import assert from 'node:assert/strict';
import {LayeredCharacter} from './layered-character.js';
class Node {
  constructor(){this.children=[];this.parent=null;this.position={set:(x,y)=>{this.x=x;this.y=y;}};this.scale={set:()=>{}};this.anchor={set:()=>{}};}
  addChild(n){this.children.push(n);n.parent=this;return n;}
  removeChildren(){const c=this.children;this.children=[];for(const n of c)n.parent=null;return c;}
  destroy(){this.destroyed=true;}
}
class Sprite extends Node {constructor(tex){super();this.texture=tex;}}
const engine={Container:Node,Sprite};
const part=(name,parent=null)=>({name,parent,texture:name+'.webp',position:[0,0],pivot:[.5,.5]});
const character=new LayeredCharacter(engine,async path=>({path}));
const first={parts:[part('body'),part('head','body')]};
assert.equal(await character.load(first),true);
assert.equal(character.parts.size,2);
assert.equal(character.parts.get('head').parent,character.parts.get('body'));
assert.equal(await character.load({parts:[part('body')]}),true);
assert.equal(character.parts.size,1);
character.destroy();
console.log('LayeredCharacter tests passed');

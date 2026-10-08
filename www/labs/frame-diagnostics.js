/** Frame timing diagnostic, intended for a reusable GPU renderer. */
export class FrameDiagnostics {
  constructor(capacity=600){
    if(!Number.isInteger(capacity)||capacity<10)throw Error('Invalid capacity');
    this.capacity=capacity;this.samples=[];this.frames=0;this.started=null;
  }
  add(ms){
    if(!Number.isFinite(ms)||ms<=0)return;
    this.samples.push(ms);
    if(this.samples.length>this.capacity)this.samples.shift();
    this.frames++;
  }
  summary(){
    if(!this.samples.length)return {samples:0,averageMs:null,p95Ms:null,fps:null};
    const sorted=[...this.samples].sort((a,b)=>a-b);
    const averageMs=this.samples.reduce((sum,v)=>sum+v,0)/this.samples.length;
    return {samples:this.samples.length,averageMs,p95Ms:sorted[Math.ceil(sorted.length*.95)-1],fps:1000/averageMs};
  }
  reset(){this.samples=[];this.frames=0;}
}

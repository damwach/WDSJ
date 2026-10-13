export interface Gesture { up:number; side:number; duration:number }
export class GestureInput {
  private queue:Gesture[]=[];
  private motion:{up:number;side:number}[]=[];
  private lastTime:number|null=null;
  constructor(canvas:HTMLCanvasElement){
    canvas.addEventListener('contextmenu',event=>event.preventDefault());
    canvas.addEventListener('pointerdown',event=>{if((event.buttons&3)===3)this.lastTime=event.timeStamp;});
    canvas.addEventListener('pointermove',event=>{
      this.motion.push({up:-event.movementY,side:event.movementX});
      if((event.buttons&3)!==3){this.lastTime=null;return;}
      const samples=event.getCoalescedEvents?.()??[];
      for(const sample of samples.length?samples:[event]){
        const duration=this.lastTime===null?1/120:Math.max(.0001,(sample.timeStamp-this.lastTime)/1000);
        this.queue.push({up:-sample.movementY,side:sample.movementX,duration});
        this.lastTime=sample.timeStamp;
      }
    });
    window.addEventListener('pointerup',()=>{this.lastTime=null});
    window.addEventListener('blur',()=>this.clear());
  }
  consume(){return this.queue.splice(0)}
  consumeMotion(){return this.motion.splice(0)}
  clear(){this.queue=[];this.motion=[];this.lastTime=null}
}

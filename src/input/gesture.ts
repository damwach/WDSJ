export interface Gesture { up:number; side:number; duration:number }
export class GestureInput {
 private queue:Gesture[]=[]; private last=0;
 constructor(canvas:HTMLCanvasElement){canvas.addEventListener('contextmenu',e=>e.preventDefault());canvas.addEventListener('pointermove',e=>{const now=e.timeStamp;if((e.buttons&3)===3)this.queue.push({up:-e.movementY,side:e.movementX,duration:Math.max(.008,Math.min(.1,(now-this.last)/1000))});this.last=now});window.addEventListener('blur',()=>this.clear());}
 consume(){return this.queue.splice(0)} clear(){this.queue=[];this.last=0}
}

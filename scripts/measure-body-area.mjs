// Reproducible geometry measurement; does not validate aerodynamic polars.
import {createServer} from 'vite';
const server=await createServer({server:{middlewareMode:true},logLevel:'silent'});
try {
 const {Athlete}=await server.ssrLoadModule('/src/athlete/rig.ts');
 const {loadAthleteAsset}=await server.ssrLoadModule('/src/athlete/skin.ts');await loadAthleteAsset();
 const a=new Athlete();a.pose(1,1,0);a.root.updateMatrixWorld(true);
 const beta=Math.PI/2-1.27,c=Math.cos(beta),s=Math.sin(beta),triangles=[];
 let minU=Infinity,maxU=-Infinity,minZ=Infinity,maxZ=-Infinity;
 a.root.traverse(o=>{
  if(!o.isMesh)return;
  for(let p=o;p;p=p.parent)if(p.userData.equipment)return;
  const pos=o.geometry.getAttribute('position'),ix=o.geometry.index;
  for(let i=0;i<(ix?ix.count:pos.count);i+=3){
   const points=[];
   for(let j=0;j<3;j++){
    const k=ix?ix.getX(i+j):i+j,v=a.root.position.clone();o.getVertexPosition(k,v);v.applyMatrix4(o.matrixWorld);
    const u=v.x*c+v.y*s,z=v.z;points.push([u,z]);minU=Math.min(minU,u);maxU=Math.max(maxU,u);minZ=Math.min(minZ,z);maxZ=Math.max(maxZ,z);
   }
   triangles.push(points);
  }
 });
 for(const step of [.004,.002,.001]){
  const w=Math.ceil((maxU-minU)/step)+1,h=Math.ceil((maxZ-minZ)/step)+1,mask=new Uint8Array(w*h);
  for(const [a,b,c] of triangles){
   const det=(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);if(Math.abs(det)<1e-12)continue;
   const x0=Math.max(0,Math.floor((Math.min(a[0],b[0],c[0])-minU)/step)),x1=Math.min(w-1,Math.ceil((Math.max(a[0],b[0],c[0])-minU)/step));
   const y0=Math.max(0,Math.floor((Math.min(a[1],b[1],c[1])-minZ)/step)),y1=Math.min(h-1,Math.ceil((Math.max(a[1],b[1],c[1])-minZ)/step));
   for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
    const u=minU+(x+.5)*step,z=minZ+(y+.5)*step;
    const d1=(b[0]-a[0])*(z-a[1])-(b[1]-a[1])*(u-a[0]);
    const d2=(c[0]-b[0])*(z-b[1])-(c[1]-b[1])*(u-b[0]);
    const d3=(a[0]-c[0])*(z-c[1])-(a[1]-c[1])*(u-c[0]);
    if((d1>=0&&d2>=0&&d3>=0)||(d1<=0&&d2<=0&&d3<=0))mask[y*w+x]=1;
   }
  }
  let occupied=0;for(const value of mask)occupied+=value;
  console.log(JSON.stringify({step,projectedBodyArea:occupied*step*step,beta,minU,maxU,minZ,maxZ,triangles:triangles.length}));
 }
}finally{await server.close();}

import * as T from 'three';
const material=(color:string)=>new T.MeshStandardMaterial({color,roughness:.58});
const red=material('#cb403b'),dark=material('#192e3a'),white=material('#f3f4ed'),gold=material('#d8b976');
export const dimensions={thigh:.44,shin:.43,torso:.53,ski:2.6};
function mesh(g:T.BufferGeometry,m:T.Material,parent:T.Object3D,x=0,y=0,z=0){const o=new T.Mesh(g,m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o}
function bone(parent:T.Object3D,length:number,r:number,m:T.Material){mesh(new T.CylinderGeometry(r*.85,r,length,16),m,parent,0,-length/2);}
export class Athlete {
 root=new T.Group();pelvis=new T.Group();torso=new T.Group();legs:{hip:T.Group,knee:T.Group,ankle:T.Group,ski:T.Group}[]=[];arms:T.Group[]=[];
 constructor(){this.root.add(this.pelvis);mesh(new T.SphereGeometry(.16,20,12),red,this.pelvis).scale.set(1,.8,1.15);this.pelvis.add(this.torso);
 mesh(new T.CylinderGeometry(.205,.15,.53,24),red,this.torso,0,.265).scale.z=.72;
 mesh(new T.BoxGeometry(.022,.23,.24),white,this.torso,.175,.32);
 mesh(new T.SphereGeometry(.19,24,16),red,this.torso,0,.46).scale.set(.75,.55,1.18);mesh(new T.CylinderGeometry(.06,.07,.10,16),dark,this.torso,0,.57);const head=new T.Group();head.position.y=.64;this.torso.add(head);mesh(new T.SphereGeometry(.125,24,16),white,head);mesh(new T.SphereGeometry(.128,24,16,0,Math.PI/2),dark,head).rotation.y=-Math.PI/4;
 for(const side of [-1,1]){const hip=new T.Group();hip.position.z=side*.105;this.pelvis.add(hip);bone(hip,.44,.082,dark);const knee=new T.Group();knee.position.y=-.44;hip.add(knee);mesh(new T.SphereGeometry(.078,16,12),dark,knee);bone(knee,.43,.058,dark);const ankle=new T.Group();ankle.position.y=-.43;knee.add(ankle);mesh(new T.BoxGeometry(.26,.16,.115),white,ankle,.055,-.02);const ski=new T.Group();ankle.add(ski);
 const shape=new T.Shape();shape.moveTo(-1,-.065);shape.lineTo(1.48,-.065);shape.quadraticCurveTo(1.6,0,1.48,.065);shape.lineTo(-1,.065);shape.quadraticCurveTo(-1.06,0,-1,-.065);
 const skiMesh=mesh(new T.ExtrudeGeometry(shape,{depth:.025,bevelEnabled:true,bevelSize:.008,bevelThickness:.006,bevelSegments:2,steps:1}),white,ski,0,-.11);skiMesh.rotation.x=Math.PI/2;
 const tip=mesh(new T.BoxGeometry(.16,.025,.115),white,ski,1.47,-.075);tip.rotation.z=.25;mesh(new T.BoxGeometry(1.7,.007,.045),gold,ski,.25,-.096);mesh(new T.BoxGeometry(.3,.04,.10),dark,ski,0,-.07);this.legs.push({hip,knee,ankle,ski});
 const arm=new T.Group();arm.position.set(0,.47,side*.21);this.torso.add(arm);bone(arm,.30,.048,red);const elbow=new T.Group();elbow.position.y=-.30;elbow.rotation.z=-.25;arm.add(elbow);bone(elbow,.26,.037,red);mesh(new T.SphereGeometry(.045,12,8),dark,elbow,0,-.29);this.arms.push(arm);
 }this.pose(0,0,0);}
 pose(extension:number,flight:number,landing:number){const f=Math.min(1,flight/.7),e=extension*(1-f);const shin=-.62+.46*e+.48*f;const thigh=1.40-1.25*e-1.35*f;const torso=-1.12+.83*e-.2*f+1.2*landing;
 this.torso.rotation.z=torso;this.arms.forEach(a=>a.rotation.z=.30+.85*f);
 this.legs.forEach(({hip,knee,ankle,ski},i)=>{hip.rotation.z=thigh;knee.rotation.z=shin-thigh;ankle.rotation.z=-shin;ski.rotation.y=(i===0?1:-1)*.24*f*(1-landing);});
 // Solve pelvis translation from exact forward kinematics to keep boots on the ski plane.
 this.pelvis.position.set(-(.44*Math.sin(thigh)+.43*Math.sin(shin)),.11+.44*Math.cos(thigh)+.43*Math.cos(shin),0);
 }
}

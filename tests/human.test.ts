import { describe, expect, it } from 'vitest';
import * as T from 'three';
import { Athlete } from '../src/athlete/rig';

function skins(a:Athlete) { const result:T.SkinnedMesh[]=[];a.root.traverse(o=>{if(o instanceof T.SkinnedMesh)result.push(o)});return result; }
describe('GLB athlete',()=>{
 it('loads a weighted continuous suit and a complete armature, without procedural limb pieces',()=>{
  const a=new Athlete(),suit=a.root.getObjectByName('AthleteSuit') as T.SkinnedMesh;
  expect(suit).toBeInstanceOf(T.SkinnedMesh);
  expect(suit.skeleton.bones.length).toBe(19);
  expect(a.root.getObjectByName('deltoid-cap')).toBeUndefined();
  for(const mesh of skins(a)){
   const w=mesh.geometry.getAttribute('skinWeight'),j=mesh.geometry.getAttribute('skinIndex'),n=mesh.geometry.getAttribute('normal');
   for(let i=0;i<w.count;i++){
    expect(w.getX(i)+w.getY(i)+w.getZ(i)+w.getW(i)).toBeCloseTo(1,5);
    for(let k=0;k<4;k++)expect(j.getComponent(i,k)).toBeLessThan(mesh.skeleton.bones.length);
    expect(Math.hypot(n.getX(i),n.getY(i),n.getZ(i))).toBeCloseTo(1,4);
   }
  }
 });
 it('keeps GPU skin data stable and every deformed vertex finite through the full motion',()=>{
  const a=new Athlete(),meshes=skins(a),ids=meshes.map(m=>m.geometry.uuid),v=new T.Vector3();
  for(const [e,t,l] of [[0,0,0],[.4,0,0],[1,.2,0],[1,.5,0],[1,1,0],[1,3,1]]){
   a.pose(e,t,l);a.root.updateMatrixWorld(true);
   for(const mesh of meshes){
    for(let i=0;i<mesh.geometry.getAttribute('position').count;i+=13){
     mesh.getVertexPosition(i,v);expect(Number.isFinite(v.x+v.y+v.z)).toBe(true);
     expect(v.length()).toBeLessThan(3);
    }
   }
  }
  expect(meshes.map(m=>m.geometry.uuid)).toEqual(ids);
 });
 it('puts armature joint heads exactly on solved hip, knee and ankle pivots',()=>{
  const a=new Athlete(),v=new T.Vector3(),w=new T.Vector3();
  for(let i=0;i<=100;i++){
   a.pose(1,i/100,0);a.root.updateMatrixWorld(true);
   for(const [index,suffix] of ['L','R'].entries())for(const [bone,joint] of [['thigh','hip'],['shin','knee'],['ankle','ankle']] as const){
    const target=a.legs[index][joint];const b=a.root.getObjectByName(bone+'_'+suffix)!;
    expect(b.getWorldPosition(v).distanceTo(target.getWorldPosition(w))).toBeLessThan(1e-6);
   }
  }
 });
});

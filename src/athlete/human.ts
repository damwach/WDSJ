import * as T from 'three';
import { athleteMaterials as m, type LimbKind } from './surfaces';

/** Render-only anatomical surfaces. Joint pivots and mass/physics stay in pose.ts.
 * All meshes are immutable after construction and have no bitmap textures. */
type Ring = { y: number; rx: number; rz: number; cx?: number };
type LoftOptions = { start?: number; arc?: number; offset?: number; segments?: number;
  minY?: number; maxY?: number; shape?: 'torso' | 'pelvis' | 'thigh' | 'shin' | 'arm' | 'skull' | 'helmet' };
const PI2 = Math.PI * 2;
const gaussian = (x: number, center: number, scale: number) =>
  Math.exp(-(((x - center) / scale) ** 2));
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));

function section(rings: Ring[], key: 'rx' | 'rz' | 'cx', height: number) {
  const y = clamp(height, rings[0].y, rings[rings.length - 1].y);
  let i = 0;
  while (i < rings.length - 2 && y > rings[i + 1].y) i++;
  const p = rings[i], n = rings[i + 1], h = n.y - p.y;
  const value = (index: number) => rings[index][key] ?? 0;
  const delta = (index: number) =>
    (value(index + 1) - value(index)) / (rings[index + 1].y - rings[index].y);
  // PCHIP prevents exaggerated bulges and preserves the measured ring extrema.
  const tangent = (index: number) => {
    if (index === 0) return delta(0);
    if (index === rings.length - 1) return delta(index - 1);
    const left = delta(index - 1), right = delta(index);
    if (left * right <= 0) return 0;
    const before = rings[index].y - rings[index - 1].y;
    const after = rings[index + 1].y - rings[index].y;
    const w1 = 2 * after + before, w2 = after + 2 * before;
    return (w1 + w2) / (w1 / left + w2 / right);
  };
  const t = (y - p.y) / h, t2 = t * t, t3 = t2 * t;
  return (2*t3 - 3*t2 + 1) * value(i) +
    (t3 - 2*t2 + t) * h * tangent(i) +
    (-2*t3 + 3*t2) * value(i + 1) +
    (t3 - t2) * h * tangent(i + 1);
}

function point(rings: Ring[], y: number, a: number, options: LoftOptions) {
  const rx = section(rings, 'rx', y), rz = section(rings, 'rz', y);
  const c = Math.cos(a), s = Math.sin(a), absC = Math.abs(c);
  let x = section(rings, 'cx', y) + rx*c, z = rz*s;
  switch (options.shape) {
    case 'torso': {
      // Rib cage has a sternum, paired pectoral volumes, back and shoulder blades.
      const chest = gaussian(y, .345, .11);
      const front = Math.max(c, 0), back = Math.max(-c, 0);
      x += .012 * chest * front * (1 - gaussian(Math.abs(z), 0, .038) * .32);
      x -= .006 * gaussian(y, .37, .12) * back * (1 + .4*Math.abs(s));
      z *= 1 + .045*gaussian(y, .435, .075)*absC;
      // The waist and suit remain smooth beneath the bib.
      break;
    }
    case 'pelvis':
      // Projected gluteal contours are stronger posteriorly than anteriorly.
      x -= .012 * gaussian(y, -.053, .057) * Math.max(-c, 0) * (1 + .2*Math.abs(s));
      z *= 1 + .045 * gaussian(y, -.04, .060) * absC;
      break;
    case 'thigh':
      // Quadriceps and adductors taper into the knee. Hamstrings fill the rear.
      x += .010 * gaussian(y, -.19, .12)*Math.max(c, 0);
      x -= .008 * gaussian(y, -.20, .14)*Math.max(-c, 0);
      z *= 1 + .06*gaussian(y, -.20, .18)*absC;
      break;
    case 'shin':
      // Front tibial ridge and a posterior calf belly, not a uniform pipe.
      x += .004 * gaussian(y, -.17, .20)*Math.max(c, 0);
      x -= .014 * gaussian(y, -.145, .095)*Math.max(-c, 0);
      break;
    case 'arm':
      // Deltoid/upper-arm asymmetry and slight forearm extensor ridge.
      x += .004 * gaussian(y, -.12, .13)*Math.max(c, 0);
      break;
    case 'skull':
      // Cheekbones and an anatomically narrower mandibular arch.
      z *= 1 + .055 * gaussian(y, .108, .036) * absC;
      break;
    case 'helmet':
      // Aerodynamic shell, slightly flattened laterally toward its rim.
      x += .004 * gaussian(y, .160, .060)*Math.max(-c, 0);
      break;
  }
  const k = options.offset ?? 0;
  return [x + k*c, y, z + k*s] as const;
}

function loft(rings: Ring[], options: LoftOptions = {}) {
  const start = options.start ?? 0, arc = options.arc ?? PI2;
  const full = Math.abs(arc - PI2) < 1e-6;
  const columns = options.segments ?? (full ? 56 : 28);
  const lo = options.minY ?? rings[0].y, hi = options.maxY ?? rings[rings.length - 1].y;
  const rows = Math.max(18, Math.ceil((hi-lo)/.0075));
  const vertices: number[] = [], triangles: number[] = [];
  for (let r=0;r<=rows;r++) for(let j=0;j<=columns;j++){
    vertices.push(...point(rings, lo + (hi-lo)*r/rows, start+arc*j/columns, options));
  }
  for(let r=0;r<rows;r++) for(let j=0;j<columns;j++){
    const a=r*(columns+1)+j,b=a+columns+1;
    triangles.push(a,b,a+1,b,b+1,a+1);
  }
  if(full) for(const end of [0,rows]){
    const index=vertices.length/3;
    vertices.push(section(rings,'cx',end?hi:lo),end?hi:lo,0);
    for(let j=0;j<columns;j++){
      const a=end*(columns+1)+j;
      if(end===0)triangles.push(index,a,a+1);
      else triangles.push(index,a+1,a);
    }
  }
  const geo=new T.BufferGeometry();
  geo.setAttribute('position',new T.Float32BufferAttribute(vertices,3));
  geo.setIndex(triangles);geo.computeVertexNormals();
  if(full){
    const normals=geo.getAttribute('normal');
    for(let r=0;r<=rows;r++){
      const a=r*(columns+1),b=a+columns;
      const v=new T.Vector3(normals.getX(a)+normals.getX(b),
        normals.getY(a)+normals.getY(b),normals.getZ(a)+normals.getZ(b)).normalize();
      normals.setXYZ(a,v.x,v.y,v.z);normals.setXYZ(b,v.x,v.y,v.z);
    }
  }
  geo.computeBoundingBox();geo.computeBoundingSphere();
  return geo;
}

function mesh(parent:T.Group, geometry:T.BufferGeometry, material:T.Material,name:string) {
  const out=new T.Mesh(geometry,material);
  out.name=name;out.castShadow=true;out.receiveShadow=true;parent.add(out);return out;
}
function fabric(parent:T.Group, rings:Ring[], mat:T.Material,name:string, opts:LoftOptions={}) {
  return mesh(parent,loft(rings,opts),mat,name);
}

const chest: Ring[]=[
  {y:-.055,rx:.105,rz:.135,cx:-.011},
  {y:.015,rx:.112,rz:.138,cx:-.008},
  {y:.095,rx:.105,rz:.131,cx:-.003},
  {y:.175,rx:.112,rz:.145,cx:.005},
  {y:.252,rx:.124,rz:.161,cx:.009},
  {y:.328,rx:.135,rz:.182,cx:.009},
  {y:.398,rx:.128,rz:.199,cx:.005},
  {y:.445,rx:.107,rz:.190,cx:-.003},
  {y:.476,rx:.076,rz:.123,cx:-.011},
  {y:.510,rx:.047,rz:.060,cx:-.008},
  {y:.540,rx:.041,rz:.045,cx:-.005}
];

export function makeHumanTorso() {
  const root=new T.Group();root.name='anatomically-tailored-torso';
  fabric(root,chest,m.suit,'suit-chest-and-back',{shape:'torso'});
  // Narrow continuous side panels and flatlock stitching.
  for(const side of [-1,1]){
    const a=side*Math.PI/2;
    fabric(root,chest,m.navy,'suit-side-panel',{start:a-.28,arc:.56,offset:.001,shape:'torso',minY:-.005,maxY:.443});
    fabric(root,chest,m.seam,'suit-flatlock-side-seam',{start:a-.285,arc:.022,offset:.002,shape:'torso',minY:.025,maxY:.435,segments:3});
  }
  for(const center of [0,Math.PI]){
    fabric(root,chest,m.cream,'race-bib',{start:center-1.03,arc:2.06,offset:.003,shape:'torso',minY:.230,maxY:.431});
    fabric(root,chest,m.navy,'bib-bottom-seam',{start:center-1.01,arc:2.02,offset:.0038,shape:'torso',minY:.230,maxY:.238});
    fabric(root,chest,m.suit,'bib-top-border',{start:center-1.00,arc:2,offset:.004,shape:'torso',minY:.416,maxY:.429});
  }
  // Shoulder/trapezius forms belong to the torso; arm caps rotate with the arms.
  for(const side of [-1,1]){
    const shoulder=mesh(root,new T.SphereGeometry(1,28,20),m.suit,'trapezius-shoulder-transition');
    shoulder.position.set(-.009,.461,side*.125);
    shoulder.scale.set(.070,.045,.077);
  }
  fabric(root,[
    {y:.515,rx:.045,rz:.053,cx:-.009},
    {y:.549,rx:.044,rz:.050,cx:-.006},
    {y:.564,rx:.038,rz:.045,cx:-.006}
  ],m.navy,'close-fitting-collar');
  // Low-profile seam running up the back. Does not simulate cloth folds.
  fabric(root,chest,m.navy,'rear-zipper',{start:Math.PI-.017,arc:.034,offset:.002,shape:'torso',minY:.036,maxY:.207,segments:3});
  return root;
}

const pelvis:Ring[]=[
  {y:-.108,rx:.067,rz:.095,cx:-.007},
  {y:-.080,rx:.094,rz:.135,cx:-.015},
  {y:-.038,rx:.116,rz:.166,cx:-.013},
  {y:.013,rx:.119,rz:.162,cx:-.009},
  {y:.058,rx:.106,rz:.142,cx:-.004},
];
export function makeHumanPelvis(){
  const root=new T.Group();root.name='anatomical-pelvis';
  fabric(root,pelvis,m.navy,'suit-seat',{shape:'pelvis'});
  for(const s of [-1,1])fabric(root,pelvis,m.black,'pelvis-side-seam',{shape:'pelvis',
    start:s*Math.PI/2-.22,arc:.44,offset:.001});
  return root;
}

function limbRings(length:number,kind:LimbKind):Ring[]{
  // Ordered distal to proximal (local -Y is the bone axis).
  const sections:Record<LimbKind,Array<[number,number,number,number]>>={
    thigh:[
      [-1.05,.044,.054,0],[-.97,.050,.058,0],[-.85,.057,.062,0],
      [-.70,.065,.070,.002],[-.52,.079,.084,.003],
      [-.36,.086,.092,.004],[-.18,.087,.090,.002],
      [-.03,.081,.088,-.002],[.07,.051,.063,-.003]
    ],
    shin:[
      [-1.05,.029,.032,0],[-.94,.034,.036,0],[-.78,.037,.040,0],
      [-.62,.047,.050,-.002],[-.40,.053,.060,-.005],
      [-.25,.056,.059,-.004],[-.12,.053,.056,-.002],
      [-.02,.049,.055,0],[.075,.031,.035,0]
    ],
    upperArm:[
      [-1.06,.022,.024,0],[-.93,.026,.029,0],[-.76,.030,.032,0],
      [-.53,.034,.037,0],[-.32,.038,.042,0],
      [-.14,.049,.051,0],[-.02,.055,.055,-.003],
      [.08,.034,.039,-.004]
    ],
    forearm:[
      [-1.07,.017,.022,0],[-.96,.020,.024,0],[-.76,.025,.029,0],
      [-.55,.029,.032,0],[-.34,.031,.034,0],
      [-.12,.029,.033,0],[.02,.026,.030,0],[.08,.019,.022,0]
    ]
  };
  return sections[kind].map(([t,x,z,cx])=>({y:t*length,rx:x,rz:z,cx}));
}
export function makeHumanLimb(length:number,kind:LimbKind,side:-1|1){
  const root=new T.Group();root.name='sculpted-'+kind;
  const rings=limbRings(length,kind);
  const leg=kind==='thigh'||kind==='shin';
  fabric(root,rings,leg?m.navy:m.sleeve,kind+'-fabric',
    {shape:kind==='shin'?'shin':kind==='thigh'?'thigh':'arm'});
  const a=side*Math.PI/2;
  fabric(root,rings,leg?m.black:m.navy,kind+'-stretch-panel',{
    shape:kind==='shin'?'shin':kind==='thigh'?'thigh':'arm',start:a-(leg ? .28 : .20),
    arc:leg ? .56 : .40,offset:.001,minY:-length+.025,maxY:-.015
  });
  fabric(root,rings,m.seam,kind+'-seam',{
    shape:kind==='shin'?'shin':kind==='thigh'?'thigh':'arm',start:a-(leg ? .30 : .22),
    arc:.020,offset:.0017,minY:-length+.030,maxY:-.019,segments:3
  });
  if(kind==='upperArm'){
    // Sculpted deltoid cap masks the circular socket without a ball joint.
    const cap=mesh(root,new T.SphereGeometry(1,28,20),m.sleeve,'deltoid-cap');
    cap.position.set(-.012,-.032,0);cap.scale.set(.057,.093,.058);
  }
  if(kind==='forearm')fabric(root,rings,m.navy,'glove-cuff',{
    minY:-length-.006,maxY:-length+.022,offset:.001
  });
  return root;
}

export function makeHumanGlove(side:-1|1){
  const root=new T.Group();root.name='articulated-racing-glove';
  fabric(root,[
    {y:-.077,rx:.009,rz:.021,cx:.002},
    {y:-.056,rx:.017,rz:.027,cx:.001},
    {y:-.015,rx:.019,rz:.028,cx:0},
    {y:.006,rx:.016,rz:.023,cx:0}
  ],m.black,'glove-palm');
  // A subtle separation of digits gives a human hand silhouette in close-ups.
  for(let i=0;i<4;i++){
    const width=[.007,.008,.008,.0065][i];
    const finger=mesh(root,new T.CapsuleGeometry(width,.032+(.008-Math.abs(i-1.5)*.006),5,8),
      m.black,'glove-finger-'+i);
    finger.position.set(.004,-.092,(i-1.5)*.013);
    finger.rotation.z=.10+(i-1.5)*.035;
  }
  const thumb=mesh(root,new T.CapsuleGeometry(.010,.028,6,12),m.black,'glove-thumb');
  thumb.position.set(.022,-.041,-side*.029);thumb.rotation.z=.48;
  return root;
}

const skull:Ring[]=[
  {y:.009,rx:.024,rz:.029,cx:.020},
  {y:.031,rx:.033,rz:.040,cx:.025},
  {y:.050,rx:.040,rz:.046,cx:.025},
  {y:.082,rx:.051,rz:.054,cx:.021},
  {y:.115,rx:.062,rz:.061,cx:.012},
  {y:.156,rx:.068,rz:.066,cx:-.002},
  {y:.185,rx:.055,rz:.058,cx:-.010},
  {y:.214,rx:.014,rz:.018,cx:-.017},
  {y:.219,rx:.002,rz:.002,cx:-.017}
];
const shell:Ring[]=[
  {y:.078,rx:.069,rz:.078,cx:-.025},
  {y:.094,rx:.079,rz:.089,cx:-.022},
  {y:.122,rx:.094,rz:.101,cx:-.019},
  {y:.159,rx:.100,rz:.103,cx:-.019},
  {y:.193,rx:.089,rz:.094,cx:-.021},
  {y:.222,rx:.062,rz:.068,cx:-.023},
  {y:.240,rx:.009,rz:.012,cx:-.025}
];
export function makeHumanHead(){
  const root=new T.Group();root.name='anatomical-head-helmet';
  fabric(root,skull,m.skin,'human-face-and-jaw',{shape:'skull'});
  fabric(root,shell,m.helmet,'helmet-shell',{shape:'helmet'});
  fabric(root,shell,m.navy,'helmet-rim',{shape:'helmet',offset:.0015,minY:.081,maxY:.088});
  for(const center of [0,Math.PI]){
    fabric(root,shell,m.suit,'helmet-racing-stripe',{shape:'helmet',
      start:center-.070,arc:.140,offset:.0016,minY:.178,maxY:.236});
  }
  fabric(root,shell,m.navy,'helmet-goggle-strap',{shape:'helmet',start:.89,
    arc:PI2-1.78,minY:.121,maxY:.131,offset:.002});
  const goggles:Ring[]=[
    {y:.109,rx:.077,rz:.077,cx:.009},
    {y:.119,rx:.084,rz:.083,cx:.010},
    {y:.144,rx:.083,rz:.086,cx:.010},
    {y:.153,rx:.076,rz:.083,cx:.009}
  ];
  fabric(root,goggles,m.black,'goggle-seal',{start:-1.23,arc:2.46,offset:.002});
  fabric(root,goggles,m.visor,'continuous-goggle-lens',
    {start:-1.16,arc:2.32,offset:.004,minY:.115,maxY:.149});
  fabric(root,[
    {y:.075,rx:.007,rz:.010,cx:.080},
    {y:.092,rx:.012,rz:.012,cx:.084},
    {y:.111,rx:.004,rz:.006,cx:.073}
  ],m.skin,'anatomical-nose');
  const mouth=mesh(root,new T.CapsuleGeometry(.0014,.014,3,9),m.lip,'subtle-mouth');
  mouth.rotation.x=Math.PI/2;mouth.position.set(.073,.057,0);
  for(const side of [-1,1]){
    const pts=[
      new T.Vector3(.001,.108,side*.070),
      new T.Vector3(.020,.070,side*.058),
      new T.Vector3(.026,.040,side*.041)
    ];
    mesh(root,new T.TubeGeometry(new T.CatmullRomCurve3(pts),18,.0035,5,false),
      m.navy,'helmet-chinstrap');
    const vent=mesh(root,new T.CapsuleGeometry(.002,.018,4,8),m.navy,'helmet-vent');
    vent.rotation.z=Math.PI/2;vent.position.set(-.018,.184,side*.096);
  }
  return root;
}

import * as THREE from 'three';
import { height, landing, hill, certificate, pisteWidth, xAtDistance } from './hill';

/** All dimensions are metres. The visible piste follows the simulation profile. */
export function createVenue(): THREE.Group {
  const venue = new THREE.Group();
  venue.name = 'wielka-krokiew-hs140';
  const inrunFrom=hill.points.A.x, trackHalf=certificate.inrun.width/2;
  const pisteEnd=hill.points.outrunEnd.x, blendEnd=pisteEnd+8;
  const stairZ=trackHalf+.60, stairRailZ=stairZ+.50;
  const snow = new THREE.MeshStandardMaterial({ color: '#eef5f9', roughness: .91 });
  const packed = new THREE.MeshStandardMaterial({ color: '#e5eff4', roughness: .73 });
  const ice = new THREE.MeshStandardMaterial({ color: '#8caebe', roughness: .37, metalness: .08 });
  const concrete = new THREE.MeshStandardMaterial({ color: '#a9b9c1', roughness: .94 });
  const steel = new THREE.MeshStandardMaterial({ color: '#637c8c', roughness: .48, metalness: .45 });
  const darkSteel = new THREE.MeshStandardMaterial({ color: '#233d51', roughness: .6, metalness: .3 });
  const rail = new THREE.MeshStandardMaterial({ color: '#c0d0db', roughness: .36, metalness: .66 });
  const navy = new THREE.MeshStandardMaterial({ color: '#173f64', roughness: .77 });
  const blue = new THREE.MeshStandardMaterial({ color: '#1879ac', roughness: .87 });
  const red = new THREE.MeshStandardMaterial({ color: '#db493c', roughness: .71 });
  const wood = new THREE.MeshStandardMaterial({ color: '#836953', roughness: .88 });
  const glass = new THREE.MeshStandardMaterial({ color: '#44778e', roughness: .2, metalness: .58 });
  const lamp = new THREE.MeshStandardMaterial({ color: '#f1f7ff', emissive: '#dcf2ff', emissiveIntensity: .8 });
  const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
  const poleGeometry = new THREE.CylinderGeometry(1, 1, 1, 8);
  const up = new THREE.Vector3(0, 1, 0);

  const box = (name: string, x: number, y: number, z: number, sx: number, sy: number, sz: number, material: THREE.Material) => {
    const mesh = new THREE.Mesh(boxGeometry, material);
    mesh.name = name;
    mesh.position.set(x, y, z);
    mesh.scale.set(sx, sy, sz);
    mesh.castShadow = mesh.receiveShadow = true;
    venue.add(mesh);
    return mesh;
  };
  const beam = (a: THREE.Vector3, b: THREE.Vector3, radius: number, material: THREE.Material, name = 'structure-beam') => {
    const mesh = new THREE.Mesh(poleGeometry, material);
    mesh.name = name;
    mesh.position.copy(a).add(b).multiplyScalar(.5);
    mesh.scale.set(radius, a.distanceTo(b), radius);
    mesh.quaternion.setFromUnitVectors(up, b.clone().sub(a).normalize());
    mesh.castShadow = true;
    venue.add(mesh);
    return mesh;
  };
  const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  const ribbon = (name: string, from: number, to: number, width: number | ((x: number) => number), elevation: (x: number) => number, material: THREE.Material, z = 0, step = .5) => {
    const positions: number[] = [];
    for (let x = from; x < to; x += step) {
      const b = Math.min(x + step, to);
      const wa = (typeof width === 'number' ? width : width(x)) / 2;
      const wb = (typeof width === 'number' ? width : width(b)) / 2;
      const ya = elevation(x), yb = elevation(b);
      // Counterclockwise from above, so the snow receives upward-facing normals.
      positions.push(x, ya, z - wa, x, ya, z + wa, b, yb, z + wb,
        x, ya, z - wa, b, yb, z + wb, b, yb, z - wb);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.computeVertexNormals();
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    mesh.receiveShadow = true;
    venue.add(mesh);
    return mesh;
  };

  // Keep the central snow corridor clear. Lateral contours rise into the forest.
  const terrainHeight = (x: number, z: number) => {
    const front=landing(THREE.MathUtils.clamp(x, -125, blendEnd))-1.3;
    const base=x<0?THREE.MathUtils.lerp(front,height(x)-8,THREE.MathUtils.smoothstep(-x,0,35)):front;
    const shoulder = Math.max(0, Math.abs(z) - 24);
    const rise = Math.min(26, shoulder * .075);
    return base + rise + Math.min(1, shoulder / 35) *
      (2.8 * Math.sin(x * .028 + z * .012) + 1.3 * Math.cos(z * .04 - x * .017));
  };
  const terrainGeometry = new THREE.PlaneGeometry(900, 680, 130, 110);
  terrainGeometry.rotateX(-Math.PI / 2);
  const terrainPositions = terrainGeometry.attributes.position;
  for (let i = 0; i < terrainPositions.count; i++) {
    const x = terrainPositions.getX(i) + 90, z = terrainPositions.getZ(i);
    terrainPositions.setXYZ(i, x, terrainHeight(x, z), z);
  }
  terrainGeometry.computeVertexNormals();
  const terrain = new THREE.Mesh(terrainGeometry, snow);
  terrain.name = 'snowy-alpine-terrain';
  terrain.receiveShadow = true;
  venue.add(terrain);

  // The concrete trough gives the inrun a credible, legible silhouette in wide shots.
  const deck = ribbon('inrun-deck', inrunFrom, 0, certificate.inrun.width, x => height(x) - .4, concrete);
  deck.castShadow = true;
  ribbon('inrun-snow', inrunFrom, 0, certificate.inrun.width, height, packed);
  for (const z of [-trackHalf, trackHalf]) {
    const sidePositions: number[] = [];
    for (let x = inrunFrom; x < 0; x += .5) {
      const b = Math.min(0, x + .5);
      sidePositions.push(x, height(x) + .12, z, b, height(b) + .12, z, b, height(b) - .55, z,
        x, height(x) + .12, z, b, height(b) - .55, z, x, height(x) - .55, z);
    }
    const sideGeometry = new THREE.BufferGeometry();
    sideGeometry.setAttribute('position', new THREE.Float32BufferAttribute(sidePositions, 3));
    sideGeometry.computeVertexNormals();
    const side = new THREE.Mesh(sideGeometry, new THREE.MeshStandardMaterial({ color: '#839aa7', roughness: .78, side: THREE.DoubleSide }));
    side.name = 'inrun-structural-side';
    side.castShadow = true;
    venue.add(side);
    for (let x = inrunFrom+.5; x < -.4; x += 2.5) {
      const b = Math.min(-.15, x + 2.5);
      beam(v(x, height(x) + .08, z), v(x, height(x) + .95, z), .032, rail, 'inrun-guardrail-post');
      beam(v(x, height(x) + .95, z), v(b, height(b) + .95, z), .037, rail, 'inrun-guardrail');
      beam(v(x, height(x) + .24, z), v(b, height(b) + .24, z), .065, navy, 'inrun-blue-edge');
    }
  }
  // Two narrow ice channels, with a bright inset rail at either edge.
  for (const z of [-.105, .105]) {
    ribbon('inrun-ice-groove', inrunFrom, -.02, .065, x => height(x) + .005, ice, z);
    for (const offset of [-.038, .038]) ribbon('groove-snow-edge', inrunFrom, -.02, .012, x => height(x) + .014, snow, z + offset);
  }
  for (let x = inrunFrom+5; x <= -5; x += 8) {
    const baseY = terrainHeight(x, 0), deckY = height(x) - .5;
    for (const z of [-trackHalf+.12, trackHalf-.12]) {
      box('inrun-footing', x, baseY + .22, z, 1.2, .5, 1.2, concrete);
      beam(v(x, baseY + .45, z), v(x, deckY, z), .14, steel, 'inrun-support');
    }
    beam(v(x, baseY + .6, -trackHalf+.12), v(x, deckY - .1, trackHalf-.12), .08, steel);
    beam(v(x, baseY + .6, trackHalf-.12), v(x, deckY - .1, -trackHalf+.12), .08, steel);
    beam(v(x, deckY, -trackHalf), v(x, deckY, trackHalf), .13, darkSteel);
  }
  // A continuous access stair follows the inrun on the far side.
  for (let x = inrunFrom+.3; x < -1; x += .45) {
    box('inrun-access-stair', x, height(x) - .13, stairZ, .46, .2, .9, concrete);
  }
  for (let x = inrunFrom+.5; x < -1; x += 2.5) {
    const b = Math.min(-.5, x + 2.5);
    beam(v(x, height(x), stairRailZ), v(x, height(x) + .9, stairRailZ), .027, rail);
    beam(v(x, height(x) + .9, stairRailZ), v(b, height(b) + .9, stairRailZ), .027, rail);
  }
  box('red-takeoff-lip', -.07, -.155, 0, .14, .31, certificate.inrun.width, red);
  box('takeoff-table-face', -.09, -.46, 0, .13, .27, certificate.inrun.width, navy);
  for (const z of [-trackHalf-.24, trackHalf+.24]) {
    beam(v(-.05, -.1, z), v(-.05, 1.45, z), .035, red, 'takeoff-edge-marker');
  }

  const pisteHeight = (x: number) => THREE.MathUtils.lerp(landing(x), terrainHeight(x, 0), THREE.MathUtils.smoothstep(x, pisteEnd, blendEnd));
  const bankHeight = (x: number, side: number, fraction: number) => {
    const z = side * (pisteWidth(x) / 2 + fraction * 4.2);
    return THREE.MathUtils.lerp(pisteHeight(x), terrainHeight(x, z) - .025, THREE.MathUtils.smoothstep(fraction, 0, 1));
  };
  ribbon('landing-piste', 0, pisteEnd, pisteWidth, landing, packed);
  ribbon('outrun-snow-blend', pisteEnd, blendEnd, pisteWidth, pisteHeight, snow);
  // Rounded snow shoulders close the piste into the surrounding terrain.
  for (const side of [-1, 1]) {
    const positions: number[] = [], indices: number[] = [];
    const crossSections = 5, bankSections=Math.ceil(blendEnd);
    for (let i = 0; i <= bankSections; i++) {
      const x=Math.min(i,blendEnd);
      for (let j = 0; j < crossSections; j++) {
        const fraction = j / (crossSections - 1);
        positions.push(x, bankHeight(x, side, fraction), side * (pisteWidth(x) / 2 + fraction * 4.2));
      }
    }
    for (let x = 0; x < bankSections; x++) for (let j = 0; j < crossSections - 1; j++) {
      const a = x * crossSections + j, b = a + crossSections;
      if (side > 0) indices.push(a, a + 1, b + 1, a, b + 1, b);
      else indices.push(a, b + 1, a + 1, a, b, b + 1);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const shoulder = new THREE.Mesh(geometry, snow);
    shoulder.name = 'landing-snow-shoulder';
    shoulder.receiveShadow = true;
    venue.add(shoulder);
  }
  const border = (side: number) => {
    const positions: number[] = [];
    for (let x = 1; x < pisteEnd-1; x += 1) {
      const z1 = side * pisteWidth(x) / 2, z2 = side * pisteWidth(x + 1) / 2;
      const y1 = landing(x) + .015, y2 = landing(x + 1) + .015;
      positions.push(x, y1, z1 - .085, x, y1, z1 + .085, x + 1, y2, z2 + .085,
        x, y1, z1 - .085, x + 1, y2, z2 + .085, x + 1, y2, z2 - .085);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.computeVertexNormals();
    const mesh = new THREE.Mesh(g, blue);
    mesh.name = 'blue-landing-perimeter';
    venue.add(mesh);
  };
  border(-1); border(1);
  ribbon('p-point-line',hill.points.P.x,hill.points.P.x+.12,pisteWidth(hill.points.P.x),x=>landing(x)+.018,blue,0,.12);
  // Distance stripes live on the same slope as the landing surface.
  for (let distance = 50; distance <= 165; distance += 5) {
    const x=xAtDistance(distance);
    const full = distance === certificate.k || distance === certificate.hs;
    const width = pisteWidth(x);
    if (full) {
      ribbon(distance === certificate.k ? 'k-point-line' : 'hill-size-line', x, x + .17, width, p => landing(p) + .018, red, 0, .17);
    } else {
      for (const side of [-1, 1]) ribbon('distance-marker', x, x + (distance % 10 === 0 ? .13 : .09), distance % 10 === 0 ? 2 : 1.05,
        p => landing(p) + .018, blue, side * (width / 2 - (distance % 10 === 0 ? 1 : .525)), .2);
    }
  }
  // Low perimeter boards leave the snowy slope visually dominant.
  for (const side of [-1, 1]) {
    for (let x = 18; x <= pisteEnd-6; x += 6) {
      const z = side * (pisteWidth(x) / 2 + 2.1);
      const nextZ = side * (pisteWidth(x + 6) / 2 + 2.1);
      const y = bankHeight(x, side, .5);
      beam(v(x, y - .2, z), v(x, y + .75, z), .045, steel, 'landing-fence-post');
      beam(v(x, y + .7, z), v(x + 6, bankHeight(x + 6, side, .5) + .7, nextZ), .035, rail, 'landing-fence');
      if (x >= hill.points.P.x-10 && x <= hill.points.L.x+6) {
        const board = box('venue-sponsor-board', x + 2.95, bankHeight(x + 2.95, side, .5) + .27, (z + nextZ) / 2, 5.6, .54, .09, (x / 6) % 3 === 0 ? red : navy);
        board.rotation.z = Math.atan((bankHeight(x + 5.75, side, .5) - bankHeight(x + .15, side, .5)) / 5.6);
      }
    }
  }

  // Start house: a compact timber/steel pavilion aligned with the inrun platform.
  const startX = inrunFrom-2.7, startY = height(inrunFrom);
  box('start-platform', startX, startY - .22, 0, 5.4, .44, 6.7, concrete);
  box('start-house-body', inrunFrom-4.15, startY + 1.57, 1.3, 2.3, 3.1, 3.8, wood);
  box('start-house-glazing', inrunFrom-2.96, startY + 1.85, 1.3, .05, 1.45, 3.35, glass);
  box('start-house-roof', inrunFrom-3.7, startY + 3.25, 1.3, 3.7, .18, 5, darkSteel);
  box('start-house-roof-snow', inrunFrom-3.7, startY + 3.37, 1.3, 3.8, .12, 5.1, snow);
  for (const x of [inrunFrom-4.8, inrunFrom-.4]) for (const z of [-2.6, 2.6]) {
    const groundY = terrainHeight(x, z);
    box('start-tower-column', x, (startY + groundY) / 2, z, .4, startY - groundY, .4, steel);
    box('start-tower-footing', x, groundY + .25, z, 1.3, .5, 1.3, concrete);
  }
  for (const z of [-2.6, 2.6]) {
    beam(v(inrunFrom-4.8, terrainHeight(inrunFrom-4.8, z) + .8, z), v(inrunFrom-.4, startY - .2, z), .1, steel);
    beam(v(inrunFrom-.4, terrainHeight(inrunFrom-.4, z) + .8, z), v(inrunFrom-4.8, startY - .2, z), .1, steel);
  }
  for (const z of [-3.22, 3.22]) {
    for (let x = inrunFrom-5.3; x <= inrunFrom-.2; x += 1.3) beam(v(x, startY, z), v(x, startY + 1, z), .03, rail);
    beam(v(inrunFrom-5.3, startY + 1, z), v(inrunFrom-.05, startY + 1, z), .035, rail);
  }
  // Gate band/endpoints come from e1/e2; gate seats use the reported tread size.
  // The ambiguous 68cm pitch annotation is retained in certificate.ts, not
  // silently used to stretch the 20.80m A--B band.
  for(let gate=0;gate<certificate.inrun.gates;gate++){
    const t=gate/(certificate.inrun.gates-1);
    const x=THREE.MathUtils.lerp(hill.points.A.x,hill.points.B.x,t);
    const seat=box('start-gate-seat',x,height(x)+.18,stairZ,
      certificate.inrun.gateTread,.06,certificate.inrun.gateWidth,wood);
    seat.rotation.z=-certificate.inrun.angle*Math.PI/180;
  }
  // Only d/q are survey constraints; the building itself is procedural scenery.
  const judges=new THREE.Group();judges.name='judges-tower';
  judges.position.set(certificate.judges.x,terrainHeight(certificate.judges.x,certificate.judges.lateralOffset),certificate.judges.lateralOffset);
  venue.add(judges);
  const judgesPart=(name:string,x:number,y:number,z:number,sx:number,sy:number,sz:number,material:THREE.Material)=>{
    const part=new THREE.Mesh(boxGeometry,material);part.name=name;part.position.set(x,y,z);part.scale.set(sx,sy,sz);
    part.castShadow=part.receiveShadow=true;judges.add(part);
  };
  judgesPart('judges-tower-base',0,6.4,0,4.8,12.8,7,concrete);
  for(let floor=0;floor<5;floor++){
    judgesPart('judges-window',0,1.6+floor*2.4,-3.51,4.2,1.6,.04,glass);
    judgesPart('judges-floor-edge',0,.55+floor*2.4,-3.62,5.1,.14,.35,darkSteel);
  }
  judgesPart('judges-roof',0,13.2,0,5.6,.2,7.8,darkSteel);
  judgesPart('judges-roof-snow',0,13.35,0,5.7,.12,7.9,snow);
  // Restrained spectator terraces; no unrelated structures inside the jumping corridor.
  for (let section = 0; section < 7; section++) for (let row = 0; row < 5; row++) {
    const z = 19 + row * 1.35, x = hill.points.K.x-10 + section * 4;
    const topY = terrainHeight(x - 2, z) + row * .6 + .3;
    const bottomY = terrainHeight(x + 2, z) - .2;
    box('spectator-terrace', x, (topY + bottomY) / 2, z, 3.85, topY - bottomY, 1.35, concrete);
    box('spectator-bench', x, topY + .46, z + .18, 3.4, .14, .45, navy);
  }
  for (const x of [hill.points.K.x-19, hill.points.K.x+8]) {
    const z = 26.7, groundY = terrainHeight(x, z);
    beam(v(x, groundY, z), v(x, groundY + 9, z), .13, steel, 'floodlight-column');
    box('floodlight-bar', x, groundY + 9, z, .25, .23, 3, darkSteel);
    for (const offset of [-1, -.34, .34, 1]) {
      const light = box('floodlight', x + .06, groundY + 9.05, z + offset, .32, .52, .5, lamp);
      light.rotation.z = -.28;
    }
  }

  // Repeatable world dressing. Trees are single irregular crowns, not stacked cones.
  let seed = 4719;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const crownPositions: number[] = [], crownColors: number[] = [];
  const green = new THREE.Color('#345853'), greenLight = new THREE.Color('#54746a');
  const addCrownTriangle = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, color: THREE.Color) => {
    crownPositions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    for (let i = 0; i < 3; i++) crownColors.push(color.r, color.g, color.b);
  };
  const branchCount = 11;
  for (let tier = 0; tier < 11; tier++) {
    const y = .13 + tier * .067;
    const radius = (.88 - y) * .31;
    for (let branch = 0; branch < branchCount; branch++) {
      const angle = branch / branchCount * Math.PI * 2 + tier * .71;
      const reach = radius * (.77 + random() * .35);
      const tip = v(Math.cos(angle) * reach, y - .022 - random() * .025, Math.sin(angle) * reach);
      const shoulder1 = v(Math.cos(angle - .23) * reach * .73, y + .06, Math.sin(angle - .23) * reach * .73);
      const shoulder2 = v(Math.cos(angle + .23) * reach * .73, y + .06, Math.sin(angle + .23) * reach * .73);
      const root = v(0, y + .16, 0);
      const underside = v(0, y - .02, 0);
      const color = green.clone().lerp(greenLight, random() * .85);
      addCrownTriangle(root, shoulder1, tip, color);
      addCrownTriangle(root, tip, shoulder2, color);
      addCrownTriangle(tip, shoulder1, underside, green);
      addCrownTriangle(shoulder2, tip, underside, green);
    }
  }
  // A narrow crown tip closes the silhouette above the branch whorls.
  for (let i = 0; i < 7; i++) {
    const a = i / 7 * Math.PI * 2, b = (i + 1) / 7 * Math.PI * 2;
    addCrownTriangle(v(0, 1, 0), v(Math.cos(a) * .019, .88, Math.sin(a) * .019), v(Math.cos(b) * .019, .88, Math.sin(b) * .019), greenLight);
  }
  const crownGeometry = new THREE.BufferGeometry();
  crownGeometry.setAttribute('position', new THREE.Float32BufferAttribute(crownPositions, 3));
  crownGeometry.setAttribute('color', new THREE.Float32BufferAttribute(crownColors, 3));
  crownGeometry.computeVertexNormals();
  const treeCount = 220;
  const crowns = new THREE.InstancedMesh(crownGeometry, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.DoubleSide }), treeCount);
  const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(.028, .048, .56, 6), wood, treeCount);
  crowns.name = 'instanced-alpine-fir-crowns'; trunks.name = 'instanced-alpine-fir-trunks';
  crowns.castShadow = true; crowns.receiveShadow = true; trunks.castShadow = true;
  const matrix = new THREE.Matrix4(), quaternion = new THREE.Quaternion();
  for (let i = 0; i < treeCount; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const cluster = Math.floor(i / 11);
    const centerX = inrunFrom-30 + (cluster % 10) * ((pisteEnd-inrunFrom+40)/9);
    const centerZ = 39 + Math.floor(cluster / 10) * 47;
    const x = centerX + (random() - .5) * 34;
    let z = side * Math.max(30, centerZ + (random() - .5) * 29);
    if(Math.abs(x-certificate.judges.x)<10&&Math.abs(z-certificate.judges.lateralOffset)<12)z+=18;
    const y = terrainHeight(x, z);
    const treeHeight = 5.5 + random() * 7;
    const slimness = .76 + random() * .32;
    quaternion.setFromAxisAngle(up, random() * Math.PI * 2);
    matrix.compose(v(x, y, z), quaternion, v(treeHeight * slimness, treeHeight, treeHeight * slimness));
    crowns.setMatrixAt(i, matrix);
    matrix.compose(v(x, y + treeHeight * .28, z), quaternion, v(treeHeight, treeHeight, treeHeight));
    trunks.setMatrixAt(i, matrix);
  }
  venue.add(crowns, trunks);

  // Broad, layered alpine ridges have smooth shoulders and continuous snow/rock color.
  // Dense shared vertices avoid the giant triangular faces of the early landscape.
  const mountainMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 });
  for (const side of [-1, 1]) for (let layer = 0; layer < 2; layer++) {
    const positions: number[] = [], colors: number[] = [], indices: number[] = [];
    const length = 780, segments = 100, rows = 19;
    const rockColor = new THREE.Color(layer === 0 ? '#9fb4c2' : '#b2c6d2');
    const snowColor = new THREE.Color(layer === 0 ? '#e3edf4' : '#d9e7f0');
    for (let row = 0; row < rows; row++) {
      const t = row / (rows - 1);
      for (let i = 0; i <= segments; i++) {
        const x = -310 + i * length / segments;
        const z = side * (156 + layer * 142 + t * 176 + 13 * Math.sin(x * .02 + t * 2.8));
        const peak = 42 + layer * 22 + 23 * Math.pow(Math.sin(x * .017 + layer * 1.6), 2)
          + 11 * Math.sin(x * .043 + layer) + 5 * Math.cos(x * .089);
        const cross = Math.pow(Math.sin(t * Math.PI), 1.6);
        const relief = cross * peak * (1 + .12 * Math.sin(x * .049 + t * 6));
        const y = terrainHeight(x, z) + relief;
        positions.push(x, y, z);
        const rockAmount = Math.max(0, Math.sin(x * .031 + t * 8 + layer) * .56) * cross;
        const color = snowColor.clone().lerp(rockColor, rockAmount);
        colors.push(color.r, color.g, color.b);
      }
    }
    for (let row = 0; row < rows - 1; row++) for (let i = 0; i < segments; i++) {
      const a = row * (segments + 1) + i, b = a + segments + 1;
      if (side > 0) indices.push(a, b, b + 1, a, b + 1, a + 1);
      else indices.push(a, b + 1, b, a, a + 1, b + 1);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const mountain = new THREE.Mesh(geometry, mountainMaterial);
    mountain.name = 'distant-alpine-ridge';
    venue.add(mountain);
  }

  // The venue is static: repeat rail posts, supports and stair treads in GPU batches.
  // Retain semantic object names so the visual checks can still identify each part.
  const batches = new Map<string, THREE.Mesh[]>();
  for (const child of venue.children) {
    if (!(child instanceof THREE.Mesh) || child instanceof THREE.InstancedMesh ||
      (child.geometry !== boxGeometry && child.geometry !== poleGeometry) || Array.isArray(child.material)) continue;
    const key = `${child.name}:${child.geometry.uuid}:${child.material.uuid}`;
    const batch = batches.get(key) ?? [];
    batch.push(child);
    batches.set(key, batch);
  }
  for (const meshes of batches.values()) {
    if (meshes.length < 2) continue;
    const template = meshes[0];
    const instances = new THREE.InstancedMesh(template.geometry, template.material, meshes.length);
    instances.name = template.name;
    instances.castShadow = template.castShadow;
    instances.receiveShadow = template.receiveShadow;
    for (let i = 0; i < meshes.length; i++) {
      meshes[i].updateMatrix();
      instances.setMatrixAt(i, meshes[i].matrix);
      venue.remove(meshes[i]);
    }
    venue.add(instances);
  }
  return venue;
}

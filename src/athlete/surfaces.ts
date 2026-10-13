import * as T from 'three';

/** Anatomical surface coordinates: +X face/forward, +Y up, Z left/right. */
export const athleteMaterials = {
  suit: new T.MeshStandardMaterial({ color: '#c32a3d', roughness: .83 }),
  sleeve: new T.MeshStandardMaterial({ color: '#ad2135', roughness: .85 }),
  navy: new T.MeshStandardMaterial({ color: '#132b3b', roughness: .79 }),
  cream: new T.MeshStandardMaterial({ color: '#f0f3ed', roughness: .76 }),
  seam: new T.MeshStandardMaterial({ color: '#e34a56', roughness: .8 }),
  black: new T.MeshStandardMaterial({ color: '#10202a', roughness: .62 }),
  skin: new T.MeshStandardMaterial({ color: '#d0a186', roughness: .87 }),
  lip: new T.MeshStandardMaterial({ color: '#956a5c', roughness: .94 }),
  helmet: new T.MeshStandardMaterial({ color: '#f0f3ee', roughness: .34 }),
  visor: new T.MeshPhysicalMaterial({ color: '#174454', metalness: .36,
    roughness: .14, clearcoat: 1, clearcoatRoughness: .09 }),
  silver: new T.MeshStandardMaterial({ color: '#78959f', roughness: .29, metalness: .65 }),
};

type Section = { y: number; x: number; z: number; offset?: number };
type Profile = Section[];
export type LimbKind = 'thigh' | 'shin' | 'upperArm' | 'forearm';

function addMesh(parent: T.Object3D, geometry: T.BufferGeometry, material: T.Material,
  name: string) {
  const mesh = new T.Mesh(geometry, material);
  mesh.name = name;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

/** Shape-preserving cubic interpolation. Smooth silhouettes without negative radii
 * or overshoot around narrow necks, ankles and the crown of the helmet. */
function smoothValue(profile: Profile, key: 'x' | 'z' | 'offset', y: number) {
  const value = (i: number) => profile[i][key] ?? 0;
  let i = 0;
  while (i < profile.length - 2 && y > profile[i + 1].y) i++;
  const spacing = (j: number) => profile[j + 1].y - profile[j].y;
  const slope = (j: number) => (value(j + 1) - value(j)) / spacing(j);
  const derivative = (j: number) => {
    if (j === 0) return slope(0);
    if (j === profile.length - 1) return slope(j - 1);
    const a = slope(j - 1), b = slope(j);
    if (a * b <= 0) return 0;
    const h0 = spacing(j - 1), h1 = spacing(j);
    const w0 = 2 * h1 + h0, w1 = h1 + 2 * h0;
    return (w0 + w1) / (w0 / a + w1 / b);
  };
  const h = spacing(i);
  const t = T.MathUtils.clamp((y - profile[i].y) / h, 0, 1);
  const t2 = t * t, t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * value(i)
    + (t3 - 2 * t2 + t) * h * derivative(i)
    + (-2 * t3 + 3 * t2) * value(i + 1)
    + (t3 - t2) * h * derivative(i + 1);
}

/** A tailored, smooth elliptical surface. Partial arcs are exact conforming suit
 * panels; the whole-ring seam has explicitly welded lighting normals. */
function surface(profile: Profile, options: { from?: number; arc?: number;
  inset?: number; low?: number; high?: number; segments?: number } = {}) {
  const low = options.low ?? profile[0].y;
  const high = options.high ?? profile[profile.length - 1].y;
  const from = options.from ?? 0, arc = options.arc ?? Math.PI * 2;
  const full = Math.abs(arc - Math.PI * 2) < 1e-6;
  const columns = options.segments ?? (full ? 48 : 20);
  const rows = Math.max(8, Math.ceil((high - low) / .009));
  const positions: number[] = [], indices: number[] = [];
  for (let i = 0; i <= rows; i++) {
    const y = T.MathUtils.lerp(low, high, i / rows);
    const x = smoothValue(profile, 'x', y) + (options.inset ?? 0);
    const z = smoothValue(profile, 'z', y) + (options.inset ?? 0);
    const offset = smoothValue(profile, 'offset', y);
    for (let j = 0; j <= columns; j++) {
      const a = from + arc * j / columns;
      positions.push(offset + x * Math.cos(a), y, z * Math.sin(a));
    }
  }
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < columns; j++) {
      const a = i * (columns + 1) + j, b = a + columns + 1;
      indices.push(a, b, b + 1, a, b + 1, a + 1);
    }
  }
  if (full) {
    for (const end of [0, rows]) {
      const y = end === 0 ? low : high;
      const center = positions.length / 3;
      positions.push(smoothValue(profile, 'offset', y), y, 0);
      for (let j = 0; j < columns; j++) {
        const a = end * (columns + 1) + j;
        indices.push(...(end === 0 ? [center, a, a + 1] : [center, a + 1, a]));
      }
    }
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  if (full) {
    const normals = geometry.getAttribute('normal');
    const averaged = new T.Vector3();
    for (let i = 0; i <= rows; i++) {
      const a = i * (columns + 1), b = a + columns;
      averaged.set(normals.getX(a) + normals.getX(b), normals.getY(a) + normals.getY(b),
        normals.getZ(a) + normals.getZ(b)).normalize();
      normals.setXYZ(a, averaged.x, averaged.y, averaged.z);
      normals.setXYZ(b, averaged.x, averaged.y, averaged.z);
    }
  }
  return geometry;
}

const torsoProfile: Profile = [
  { y: -.048, x: .110, z: .143, offset: -.007 },
  { y: .035, x: .107, z: .143, offset: -.008 },
  { y: .125, x: .099, z: .135, offset: -.002 },
  { y: .220, x: .115, z: .153, offset: .006 },
  { y: .315, x: .132, z: .176, offset: .012 },
  { y: .390, x: .136, z: .189, offset: .007 },
  { y: .440, x: .116, z: .183, offset: -.001 },
  { y: .479, x: .090, z: .135, offset: -.008 },
  { y: .510, x: .055, z: .078, offset: -.005 },
  { y: .538, x: .042, z: .048, offset: -.002 },
];

/** Printed vector paths conformed to the curved chest; no text/canvas textures. */
function bibNumber(parent: T.Group, back = false) {
  const paths = [
    [[-.028, .035], [-.011, .048], [-.011, -.042]],
    [[.003, .030], [.007, .043], [.020, .050], [.036, .048], [.046, .036],
      [.044, .020], [.037, .008], [.007, -.032], [.006, -.042], [.047, -.042]],
  ];
  const material = athleteMaterials.navy;
  for (const path of paths) {
    const points = path.map(([u, v]) => {
      const y = .313 + v;
      const zRadius = smoothValue(torsoProfile, 'z', y);
      const xRadius = smoothValue(torsoProfile, 'x', y);
      const x = smoothValue(torsoProfile, 'offset', y)
        + (back ? -1 : 1) * (xRadius * Math.sqrt(1 - (u / zRadius) ** 2) + .0024);
      // Looking at the chest from +X, screen-right is -Z. Reverse this on
      // the back so the printed number reads 12 from both sides.
      return new T.Vector3(x, y, back ? u : -u);
    });
    const curve = new T.CatmullRomCurve3(points, false, 'centripetal');
    const mark = addMesh(parent, new T.TubeGeometry(curve, 32, .0027, 6, false),
      material, 'bib-number-12');
    mark.castShadow = false;
  }
}

/** The torso and shoulder blend are smooth and anatomically sized: .38 m wide,
 * .27 m deep, .53 m from pelvis pivot to base of neck. */
export function makeTorso() {
  const body = new T.Group();
  body.name = 'tailored-torso';
  addMesh(body, surface(torsoProfile), athleteMaterials.suit, 'suit-chest-and-back');
  for (const side of [-1, 1]) {
    const center = side * Math.PI / 2;
    addMesh(body, surface(torsoProfile, { from: center - .29, arc: .58,
      low: .008, high: .460, inset: .0007 }), athleteMaterials.navy, 'suit-side-panel');
    addMesh(body, surface(torsoProfile, { from: center - .313, arc: .022,
      low: .020, high: .447, inset: .0011, segments: 3 }),
    athleteMaterials.seam, 'flatlock-side-seam');
  }
  for (const center of [0, Math.PI]) {
    addMesh(body, surface(torsoProfile, { from: center - 1.12, arc: 2.24,
      low: .205, high: .435, inset: .0012 }), athleteMaterials.cream, 'conforming-race-bib');
    addMesh(body, surface(torsoProfile, { from: center - 1.12, arc: 2.24,
      low: .198, high: .212, inset: .0018 }), athleteMaterials.navy, 'bib-hem');
    addMesh(body, surface(torsoProfile, { from: center - .92, arc: 1.84,
      low: .407, high: .415, inset: .0018 }), athleteMaterials.suit, 'bib-brand-stripe');
  }
  bibNumber(body);
  bibNumber(body, true);
  addMesh(body, surface([
    { y: .515, x: .043, z: .050 }, { y: .543, x: .045, z: .050 },
    { y: .565, x: .040, z: .044 },
  ]), athleteMaterials.navy, 'close-fitting-collar');
  // Fine zipped seam from the waist to the bib instead of exaggerated padding.
  addMesh(body, surface(torsoProfile, { from: -.022, arc: .044,
    low: .030, high: .198, inset: .0013, segments: 3 }), athleteMaterials.navy, 'suit-zipper');
  return body;
}

export function makePelvis() {
  const pelvis = new T.Group();
  pelvis.name = 'fitted-pelvis';
  const profile: Profile = [
    { y: -.099, x: .070, z: .105, offset: -.007 },
    { y: -.071, x: .111, z: .152, offset: -.012 },
    { y: -.025, x: .120, z: .163, offset: -.010 },
    { y: .020, x: .114, z: .149, offset: -.007 },
    { y: .062, x: .108, z: .139, offset: -.002 },
  ];
  addMesh(pelvis, surface(profile), athleteMaterials.navy, 'suit-seat');
  for (const side of [-1, 1]) addMesh(pelvis, surface(profile, {
    from: side * Math.PI / 2 - .31, arc: .62, inset: .0008,
  }), athleteMaterials.black, 'hip-side-panel');
  return pelvis;
}

/** Local -Y is the bone axis. Soft closed ends overlap the adjacent segment
 * around the anatomical pivot; there are no visible ball-shaped joints. */
export function makeLimb(length: number, kind: LimbKind, side: -1 | 1 = 1) {
  const limb = new T.Group();
  limb.name = `tailored-${kind}`;
  const sizes: Record<LimbKind, [number, number][]> = {
    thigh: [[.046, .051], [.055, .060], [.066, .072], [.078, .083], [.085, .089],
      [.084, .089], [.049, .069]],
    shin: [[.029, .032], [.038, .041], [.047, .050], [.054, .056], [.051, .053],
      [.049, .051], [.032, .040]],
    upperArm: [[.023, .026], [.029, .032], [.034, .035], [.040, .040], [.045, .044],
      [.046, .045], [.025, .036]],
    forearm: [[.018, .022], [.023, .026], [.029, .029], [.031, .032], [.029, .031],
      [.028, .030], [.018, .022]],
  };
  const positions = [-length - .021, -length, -length * .78, -length * .52,
    -length * .27, -.010, .028];
  const profile = sizes[kind].map(([x, z], i) => ({ y: positions[i], x, z }));
  addMesh(limb, surface(profile), kind === 'upperArm' || kind === 'forearm'
    ? athleteMaterials.sleeve : athleteMaterials.navy, `${kind}-fabric`);
  const isLeg = kind === 'thigh' || kind === 'shin';
  const center = side * Math.PI / 2;
  addMesh(limb, surface(profile, { from: center - (isLeg ? .31 : .21),
    arc: isLeg ? .62 : .42, inset: .0007, low: -length + .008, high: .009 }),
  isLeg ? athleteMaterials.black : athleteMaterials.navy, `${kind}-side-panel`);
  addMesh(limb, surface(profile, { from: center - (isLeg ? .332 : .231),
    arc: .022, inset: .001, low: -length + .013, high: .004, segments: 3 }),
  athleteMaterials.seam, `${kind}-flatlock-seam`);
  if (kind === 'forearm') addMesh(limb, surface(profile, {
    low: -length - .009, high: -length + .020, inset: .001,
  }), athleteMaterials.navy, 'glove-cuff');
  return limb;
}

/** A narrow racing glove with a flattened palm, rounded fingers and fitted thumb. */
export function makeGlove(side: -1 | 1 = 1) {
  const hand = new T.Group();
  hand.name = 'racing-glove';
  const profile: Profile = [
    { y: -.104, x: .006, z: .008, offset: .007 },
    { y: -.093, x: .014, z: .021, offset: .004 },
    { y: -.073, x: .018, z: .027 },
    { y: -.035, x: .020, z: .027, offset: -.002 },
    { y: -.011, x: .017, z: .023 },
    { y: .008, x: .016, z: .022 },
  ];
  addMesh(hand, surface(profile), athleteMaterials.black, 'glove-palm-and-fingers');
  const thumb = addMesh(hand, new T.CapsuleGeometry(.010, .025, 6, 12),
    athleteMaterials.black, 'glove-thumb');
  thumb.position.set(.020, -.044, -side * .012);
  thumb.rotation.z = .48;
  addMesh(hand, surface(profile, { from: Math.PI - .6, arc: 1.2,
    low: -.069, high: -.022, inset: .0006 }), athleteMaterials.navy, 'glove-back-panel');
  return hand;
}

/** Human skull, jaw and small exposed nose under a correctly fitted helmet.
 * Attach at neck origin y=.558; entire group can articulate as one head. */
export function makeHead() {
  const head = new T.Group();
  head.name = 'human-head-and-race-helmet';
  addMesh(head, surface([
    { y: .012, x: .026, z: .035, offset: .024 },
    { y: .029, x: .034, z: .041, offset: .027 },
    { y: .048, x: .047, z: .051, offset: .026 },
    { y: .075, x: .056, z: .058, offset: .024 },
    { y: .109, x: .065, z: .063, offset: .012 },
    { y: .148, x: .066, z: .066, offset: .002 },
    { y: .181, x: .055, z: .059, offset: -.008 },
    { y: .208, x: .020, z: .030, offset: -.015 },
    { y: .216, x: .002, z: .003, offset: -.018 },
  ]), athleteMaterials.skin, 'human-skull-and-jaw');
  const helmetProfile: Profile = [
    { y: .076, x: .067, z: .078, offset: -.029 },
    { y: .093, x: .080, z: .091, offset: -.023 },
    { y: .125, x: .094, z: .103, offset: -.016 },
    { y: .163, x: .101, z: .105, offset: -.014 },
    { y: .193, x: .090, z: .093, offset: -.020 },
    { y: .218, x: .069, z: .070, offset: -.024 },
    { y: .237, x: .038, z: .037, offset: -.025 },
    { y: .243, x: .002, z: .003, offset: -.025 },
  ];
  addMesh(head, surface(helmetProfile), athleteMaterials.helmet, 'helmet-shell');
  addMesh(head, surface(helmetProfile, { low: .078, high: .084, inset: .001 }),
    athleteMaterials.navy, 'helmet-rubber-edge');
  for (const center of [0, Math.PI]) addMesh(head, surface(helmetProfile, {
    from: center - .10, arc: .20, low: .169, high: .239, inset: .0008,
  }), athleteMaterials.suit, 'helmet-crown-race-stripe');
  // A narrow strap encircles the sides and back; no decorative giant ear discs.
  addMesh(head, surface(helmetProfile, { from: 1.0, arc: Math.PI * 2 - 2.0,
    low: .115, high: .125, inset: .0011 }), athleteMaterials.navy, 'goggle-strap');
  const lensProfile: Profile = [
    { y: .108, x: .074, z: .074, offset: .011 },
    { y: .121, x: .083, z: .083, offset: .010 },
    { y: .143, x: .082, z: .085, offset: .010 },
    { y: .148, x: .076, z: .083, offset: .010 },
  ];
  addMesh(head, surface(lensProfile, { from: -1.24, arc: 2.48, inset: .002 }),
    athleteMaterials.black, 'fitted-goggle-frame');
  addMesh(head, surface(lensProfile, { from: -1.17, arc: 2.34,
    low: .112, high: .144, inset: .003 }), athleteMaterials.visor, 'continuous-goggle-lens');
  // Short exposed nose: its bridge finishes under the lens, not out in front.
  addMesh(head, surface([
    { y: .080, x: .007, z: .009, offset: .081 },
    { y: .088, x: .013, z: .012, offset: .080 },
    { y: .101, x: .008, z: .009, offset: .077 },
    { y: .111, x: .003, z: .005, offset: .074 },
  ]), athleteMaterials.skin, 'nose-profile');
  const mouth = addMesh(head, new T.CapsuleGeometry(.0015, .018, 4, 12),
    athleteMaterials.lip, 'subtle-mouth-line');
  mouth.rotation.x = Math.PI / 2;
  mouth.position.set(.078, .058, 0);
  for (const side of [-1, 1]) {
    const strapCurve = new T.CatmullRomCurve3([
      new T.Vector3(-.004, .107, side * .064),
      new T.Vector3(.016, .058, side * .053),
      new T.Vector3(.038, .031, side * .035),
    ]);
    addMesh(head, new T.TubeGeometry(strapCurve, 18, .0035, 6, false),
      athleteMaterials.navy, 'helmet-chinstrap');
    for (const offset of [-.010, .014]) {
      const vent = addMesh(head, new T.CapsuleGeometry(.0022, .022, 4, 10),
        athleteMaterials.navy, 'helmet-vent');
      vent.rotation.z = Math.PI / 2;
      vent.position.set(offset, .181, side * .100);
    }
  }
  return head;
}

/** A flexible fabric envelope bridges a hinge without a ball-shaped knee or
 * elbow. The positive-Y end follows the parent bone; negative Y follows the
 * child. Attach to the child joint and pass its local Z hinge angle to bend.
 * Geometry, backing arrays, bounds and materials are allocated only once. */
export function makeJointSleeve(kind: 'knee' | 'elbow') {
  const knee = kind === 'knee';
  const halfLength = knee ? .070 : .045;
  const centerX = knee ? .057 : .032;
  const centerZ = knee ? .060 : .034;
  const endX = knee ? .052 : .028;
  const endZ = knee ? .055 : .031;
  const rows = 20, columns = 32;
  const count = (rows + 1) * (columns + 1);
  const positions = new Float32Array(count * 3);
  const normals = new Float32Array(count * 3);
  const indices = new Uint16Array(rows * columns * 6);
  const cosines = new Float32Array(columns + 1);
  const sines = new Float32Array(columns + 1);
  for (let j = 0; j <= columns; j++) {
    cosines[j] = Math.cos(j / columns * Math.PI * 2);
    sines[j] = Math.sin(j / columns * Math.PI * 2);
  }
  let index = 0;
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < columns; j++) {
      const a = i * (columns + 1) + j, b = a + columns + 1;
      indices[index++] = a; indices[index++] = b; indices[index++] = b + 1;
      indices[index++] = a; indices[index++] = b + 1; indices[index++] = a + 1;
    }
  }
  const geometry = new T.BufferGeometry();
  const positionAttribute = new T.BufferAttribute(positions, 3).setUsage(T.DynamicDrawUsage);
  const normalAttribute = new T.BufferAttribute(normals, 3).setUsage(T.DynamicDrawUsage);
  geometry.setAttribute('position', positionAttribute);
  geometry.setAttribute('normal', normalAttribute);
  geometry.setIndex(new T.BufferAttribute(indices, 1));
  geometry.boundingBox = new T.Box3();
  geometry.boundingSphere = new T.Sphere(new T.Vector3(),
    Math.sqrt(halfLength * halfLength + Math.max(centerX, centerZ) ** 2) + .005);
  const object = new T.Mesh(geometry, knee ? athleteMaterials.navy : athleteMaterials.sleeve);
  object.name = `flexible-${kind}-sleeve`;
  object.castShadow = true;
  object.receiveShadow = true;

  const bend = (angle: number) => {
    // Finite anatomical hinge angles also prevent corrupt input from placing
    // NaN vertices into the shared renderer buffer.
    const hinge = Number.isFinite(angle) ? T.MathUtils.clamp(angle, -2.35, .15) : 0;
    const transition = halfLength * .76;
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    for (let i = 0; i <= rows; i++) {
      const y = -halfLength + 2 * halfLength * i / rows;
      const t = T.MathUtils.clamp((y + transition) / (2 * transition), 0, 1);
      const blend = t * t * (3 - 2 * t);
      const blendDerivative = t > 0 && t < 1 ? 6 * t * (1 - t) / (2 * transition) : 0;
      const rotation = -hinge * blend;
      const rotationDerivative = -hinge * blendDerivative;
      const c = Math.cos(rotation), s = Math.sin(rotation);
      const fraction = y / halfLength;
      const rx = centerX + (endX - centerX) * fraction * fraction;
      const rz = centerZ + (endZ - centerZ) * fraction * fraction;
      const drx = 2 * (endX - centerX) * y / (halfLength * halfLength);
      const drz = 2 * (endZ - centerZ) * y / (halfLength * halfLength);
      for (let j = 0; j <= columns; j++) {
        const ca = cosines[j], sa = sines[j];
        const x = rx * ca;
        const px = c * x - s * y, py = s * x + c * y, pz = rz * sa;
        const n = (i * (columns + 1) + j) * 3;
        positions[n] = px; positions[n + 1] = py; positions[n + 2] = pz;
        minX = Math.min(minX, px); minY = Math.min(minY, py); minZ = Math.min(minZ, pz);
        maxX = Math.max(maxX, px); maxY = Math.max(maxY, py); maxZ = Math.max(maxZ, pz);
        // Analytic derivatives of the deformed surface give smooth normals
        // even at the wrap seam; no computeVertexNormals allocations per pose.
        const dxTheta = -c * rx * sa, dyTheta = -s * rx * sa, dzTheta = rz * ca;
        const dxY = c * drx * ca - s - rotationDerivative * py;
        const dyY = s * drx * ca + c + rotationDerivative * px;
        const dzY = drz * sa;
        let nx = dyY * dzTheta - dzY * dyTheta;
        let ny = dzY * dxTheta - dxY * dzTheta;
        let nz = dxY * dyTheta - dyY * dxTheta;
        // On the compressed inside of a deeply folded knee, two parametric
        // tangents may momentarily coincide. Use its radial fabric normal at
        // that crease so every vertex still has a finite unit lighting normal.
        if (nx * nx + ny * ny + nz * nz < 1e-16) {
          nx = c * ca / rx; ny = s * ca / rx; nz = sa / rz;
        }
        const inverse = 1 / Math.sqrt(nx * nx + ny * ny + nz * nz);
        normals[n] = nx * inverse; normals[n + 1] = ny * inverse; normals[n + 2] = nz * inverse;
      }
    }
    geometry.boundingBox!.min.set(minX, minY, minZ);
    geometry.boundingBox!.max.set(maxX, maxY, maxZ);
    positionAttribute.needsUpdate = true;
    normalAttribute.needsUpdate = true;
  };
  bend(0);
  return { object, bend };
}

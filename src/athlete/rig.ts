import * as T from 'three';

/** Metres. The anatomical joints remain at fixed distances in every pose. */
export const dimensions = { thigh: .44, shin: .43, torso: .53, ski: 2.6 };
const ankleHeight = .115;
const suit = new T.MeshStandardMaterial({ color: '#ea4d3d', roughness: .77 });
const navy = new T.MeshStandardMaterial({ color: '#172d3c', roughness: .7 });
const cream = new T.MeshStandardMaterial({ color: '#f5efda', roughness: .68 });
const black = new T.MeshStandardMaterial({ color: '#101d27', roughness: .5 });
const sole = new T.MeshStandardMaterial({ color: '#405260', roughness: .45, metalness: .2 });
const visor = new T.MeshStandardMaterial({ color: '#334650', roughness: .12, metalness: .55 });
const edge = new T.MeshStandardMaterial({ color: '#98b0b9', roughness: .35, metalness: .65 });
const skin = new T.MeshStandardMaterial({ color: '#bc9479', roughness: .9 });

/** Angles are relative to the root ski datum, in radians. */
export type PoseControl = {
  /** Forward inclination from +Y: positive brings the chest toward +X. */
  bodyLean?: number;
  /** Positive lifts the ski tips; the binding/boot rotates with the ski. */
  skiPitch?: number;
};

function mesh(geometry: T.BufferGeometry, material: T.Material, parent: T.Object3D,
  x = 0, y = 0, z = 0) {
  const object = new T.Mesh(geometry, material);
  object.position.set(x, y, z);
  object.castShadow = true;
  object.receiveShadow = true;
  parent.add(object);
  return object;
}

function ellipsoid(parent: T.Object3D, material: T.Material, at: number[], size: number[]) {
  const object = mesh(new T.SphereGeometry(1, 24, 16), material, parent, ...at as [number, number, number]);
  object.scale.set(...size as [number, number, number]);
  return object;
}

type Ring = { y: number; x: number; z: number; offset?: number };

/** Elliptical cross sections make a fitted suit, without stacked primitive cylinders. */
function tailoring(rings: Ring[], segments = 32, from = 0, arc = Math.PI * 2, inset = 0) {
  const positions: number[] = [], indices: number[] = [];
  for (const ring of rings) {
    for (let j = 0; j <= segments; j++) {
      const angle = from + arc * j / segments;
      positions.push((ring.offset ?? 0) + (ring.x + inset) * Math.cos(angle),
        ring.y, (ring.z + inset) * Math.sin(angle));
    }
  }
  for (let i = 0; i < rings.length - 1; i++) {
    for (let j = 0; j < segments; j++) {
      const a = i * (segments + 1) + j, b = a + segments + 1;
      indices.push(a, b, b + 1, a, b + 1, a + 1);
    }
  }
  if (arc === Math.PI * 2) {
    for (const end of [0, rings.length - 1]) {
      const centre = positions.length / 3, ring = rings[end];
      positions.push(ring.offset ?? 0, ring.y, 0);
      for (let j = 0; j < segments; j++) {
        const a = end * (segments + 1) + j;
        indices.push(...(end === 0 ? [centre, a, a + 1] : [centre, a + 1, a]));
      }
    }
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function limb(parent: T.Object3D, length: number, radii: [number, number][], material: T.Material) {
  return mesh(tailoring(radii.map(([x, z], i) => ({
    y: -length + length * i / (radii.length - 1), x, z,
  }))), material, parent);
}

/** Full 2.60 m ski, with a rising shovel and rounded, tapered planform. */
function skiGeometry() {
  const positions: number[] = [], indices: number[] = [];
  const sections = 54;
  for (let i = 0; i <= sections; i++) {
    const x = -1.06 + dimensions.ski * i / sections;
    const nose = T.MathUtils.smoothstep(x, 1.22, 1.54);
    const tail = T.MathUtils.smoothstep(-x, 1.01, 1.06);
    const halfWidth = (.056 + .0015 * Math.abs(x) / 1.54) * (1 - .75 * nose ** 4) * (1 - .3 * tail);
    const y = -ankleHeight + .105 * nose ** 2 + .012 * tail;
    positions.push(x, y, -halfWidth, x, y, halfWidth,
      x, y + .021, -halfWidth, x, y + .021, halfWidth);
  }
  for (let i = 0; i < sections; i++) {
    const a = i * 4, b = a + 4;
    indices.push(a, a + 1, b + 1, a, b + 1, b,
      a + 2, b + 2, b + 3, a + 2, b + 3, a + 3,
      a, b, b + 2, a, b + 2, a + 2,
      a + 1, a + 3, b + 3, a + 1, b + 3, b + 1);
  }
  indices.push(0, 2, 3, 0, 3, 1);
  const end = sections * 4;
  indices.push(end, end + 1, end + 3, end, end + 3, end + 2);
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

const skiShape = skiGeometry();
const trunkProfile: Ring[] = [
  { y: -.045, x: .102, z: .128 }, { y: .025, x: .108, z: .136 },
  { y: .10, x: .097, z: .129 }, { y: .20, x: .103, z: .139 },
  { y: .31, x: .119, z: .160 }, { y: .40, x: .122, z: .178 },
  { y: .45, x: .106, z: .176 }, { y: .49, x: .078, z: .126 },
  { y: .53, x: .046, z: .056 },
];

export class Athlete {
  root = new T.Group();
  pelvis = new T.Group();
  torso = new T.Group();
  legs: { hip: T.Group; knee: T.Group; ankle: T.Group; ski: T.Group }[] = [];
  arms: T.Group[] = [];
  private elbows: T.Group[] = [];
  private head = new T.Group();
  private cuffs: T.Group[] = [];

  constructor() {
    this.root.name = 'ski-jumper';
    this.root.add(this.pelvis);
    this.pelvis.add(this.torso);
    mesh(tailoring([
      { y: -.09, x: .09, z: .105 }, { y: -.045, x: .121, z: .15 },
      { y: .025, x: .121, z: .151 }, { y: .065, x: .11, z: .132 },
    ]), suit, this.pelvis);
    mesh(tailoring(trunkProfile), suit, this.torso);

    // Race bib conforms to the chest and back instead of floating as a white box.
    const bibProfile = trunkProfile.slice(3, 7);
    for (const centre of [0, Math.PI]) {
      mesh(tailoring(bibProfile, 24, centre - 1.18, 2.36, .003), cream, this.torso);
      mesh(tailoring([trunkProfile[2], trunkProfile[3]], 24, centre - 1.18, 2.36, .003), navy, this.torso);
    }
    for (const side of [-1, 1]) {
      mesh(tailoring(trunkProfile.slice(1, 6), 8, side * Math.PI / 2 - .19, .38, .003), navy, this.torso);
    }
    mesh(new T.CylinderGeometry(.043, .049, .065, 24), navy, this.torso, 0, .549);

    this.head.name = 'helmet-and-head';
    this.head.position.set(.006, .558, 0);
    this.torso.add(this.head);
    // One anatomically scaled skull/jaw, one fitted helmet shell and one curved
    // goggle lens. The lens wraps around the face rather than forming two eyes.
    mesh(tailoring([
      { y: .019, x: .031, z: .040, offset: .029 },
      { y: .042, x: .043, z: .052, offset: .034 },
      { y: .068, x: .061, z: .064, offset: .025 },
      { y: .102, x: .073, z: .070, offset: .014 },
      { y: .152, x: .074, z: .071, offset: .007 },
      { y: .192, x: .060, z: .059, offset: -.003 },
      { y: .218, x: .010, z: .018, offset: -.012 },
    ]), skin, this.head);
    const helmetProfile: Ring[] = [
      { y: .075, x: .073, z: .075, offset: -.016 },
      { y: .105, x: .091, z: .087, offset: -.015 },
      { y: .145, x: .099, z: .093, offset: -.016 },
      { y: .185, x: .091, z: .085, offset: -.021 },
      { y: .219, x: .069, z: .065, offset: -.025 },
      { y: .239, x: .039, z: .037, offset: -.026 },
      { y: .246, x: .001, z: .001, offset: -.026 },
    ];
    const helmet = mesh(tailoring(helmetProfile, 40), cream, this.head);
    helmet.name = 'helmet-shell';
    mesh(tailoring([
      { y: .074, x: .073, z: .075, offset: -.016 },
      { y: .084, x: .080, z: .080, offset: -.016 },
    ], 40), navy, this.head);
    // Dark frame lies behind a continuous, narrow cylindrical lens.
    const goggle = mesh(tailoring([
      { y: .094, x: .091, z: .077, offset: .017 },
      { y: .117, x: .098, z: .088, offset: .012 },
      { y: .146, x: .093, z: .085, offset: .012 },
    ], 32, -1.44, 2.88, .003), black, this.head);
    goggle.name = 'goggle-frame';
    const lens = mesh(tailoring([
      { y: .099, x: .092, z: .078, offset: .018 },
      { y: .118, x: .098, z: .088, offset: .013 },
      { y: .141, x: .094, z: .085, offset: .012 },
    ], 32, -1.38, 2.76, .004), visor, this.head);
    lens.name = 'continuous-goggle-lens';
    mesh(tailoring([
      { y: .066, x: .006, z: .010, offset: .096 },
      { y: .078, x: .013, z: .012, offset: .098 },
      { y: .095, x: .006, z: .009, offset: .089 },
      { y: .105, x: .001, z: .002, offset: .085 },
    ], 16), skin, this.head);
    // An understated jaw/strap reads correctly at athlete-camera distance.
    mesh(tailoring([
      { y: .021, x: .032, z: .041, offset: .026 },
      { y: .027, x: .035, z: .044, offset: .028 },
    ], 32, -.85, 1.7, .001), navy, this.head);
    for (const side of [-1, 1]) {
      // The strap conforms to the shell. No circular ear accessories.
      mesh(tailoring(helmetProfile.slice(1, 3), 12,
        side * Math.PI / 2 - .32, .64, .001), navy, this.head);
      mesh(tailoring(helmetProfile.slice(2, 5), 12,
        side * Math.PI / 2 - .075, .15, .0015), suit, this.head);
      const strap = mesh(new T.BoxGeometry(.009, .061, .005), navy, this.head,
        .006, .052, side * .059);
      strap.rotation.z = -.20;
    }

    for (const side of [-1, 1]) {
      const hip = new T.Group();
      hip.position.z = side * .105;
      this.pelvis.add(hip);
      const thighProfile = [[.051, .057], [.062, .068], [.077, .082], [.083, .09], [.075, .083]]
        .map(([x, z], i) => ({y: -dimensions.thigh + dimensions.thigh * i / 4, x, z}));
      mesh(tailoring(thighProfile), suit, hip);
      // The side panel shares the suit cross sections, avoiding intersections.
      mesh(tailoring(thighProfile, 8, side * Math.PI / 2 - .27, .54, .003), navy, hip);
      const knee = new T.Group();
      knee.position.y = -dimensions.thigh;
      hip.add(knee);
      ellipsoid(knee, suit, [0, 0, 0], [.057, .063, .061]);
      limb(knee, dimensions.shin, [[.037, .039], [.042, .044], [.055, .057], [.062, .061], [.052, .056]], suit);
      const ankle = new T.Group();
      ankle.position.y = -dimensions.shin;
      knee.add(ankle);
      const ski = new T.Group();
      ankle.add(ski);
      mesh(skiShape, cream, ski);
      mesh(new T.BoxGeometry(1.47, .002, .021), suit, ski, .19, -ankleHeight + .022);
      mesh(new T.BoxGeometry(.32, .002, .083), navy, ski, -.74, -ankleHeight + .022);
      mesh(new T.BoxGeometry(.15, .003, .08), suit, ski, 1.10, -ankleHeight + .023);
      // Binding plate, toe clamp, heel block, and boot follow the ski's V yaw.
      mesh(new T.BoxGeometry(.32, .027, .10), sole, ski, .045, -.080);
      mesh(new T.BoxGeometry(.065, .046, .105), black, ski, .158, -.052);
      mesh(new T.BoxGeometry(.078, .034, .086), edge, ski, -.079, -.058);
      ellipsoid(ski, cream, [.04, -.025, 0], [.14, .054, .052]);
      const cuff = new T.Group();
      ski.add(cuff);
      ellipsoid(cuff, navy, [-.012, .028, 0], [.060, .083, .054]);
      mesh(new T.BoxGeometry(.071, .017, .112), sole, cuff, -.012, .041);
      mesh(new T.BoxGeometry(.064, .015, .108), sole, cuff, -.011, .069);
      this.cuffs.push(cuff);
      this.legs.push({ hip, knee, ankle, ski });

      const arm = new T.Group();
      arm.position.set(-.005, .437, side * .173);
      this.torso.add(arm);
      ellipsoid(arm, suit, [0, -.016, side * .004], [.052, .065, .052]);
      limb(arm, .29, [[.031, .034], [.036, .039], [.045, .046], [.048, .048]], suit);
      const elbow = new T.Group();
      elbow.position.y = -.29;
      arm.add(elbow);
      ellipsoid(elbow, suit, [0, 0, 0], [.033, .035, .036]);
      limb(elbow, .25, [[.024, .027], [.030, .032], [.034, .036], [.031, .033]], suit);
      mesh(new T.CylinderGeometry(.027, .025, .035, 16), navy, elbow, 0, -.240);
      ellipsoid(elbow, black, [0, -.299, .003 * side], [.024, .058, .031]);
      ellipsoid(elbow, black, [.023, -.284, -.012 * side], [.012, .027, .016]);
      this.arms.push(arm);
      this.elbows.push(elbow);
    }
    this.pose(0, 0, 0);
  }

  pose(extension: number, flightSeconds: number, landing: number, controls?: PoseControl) {
    const e = T.MathUtils.clamp(extension, 0, 1);
    // Passive flight setup follows the brief leg extension; it does not stretch
    // the extension action over almost a second.
    const flight = T.MathUtils.smoothstep(flightSeconds, .025, .40);
    const contact = T.MathUtils.smoothstep(landing, 0, 1);
    const mix = T.MathUtils.lerp;
    // Joint rotations describe motion; geometry and limb lengths never change.
    const thigh = mix(mix(1.24, .14, e), -.86, flight);
    const shin = mix(mix(-.53, -.10, e), -1.10, flight);
    const upperLeg = mix(thigh, .63, contact);
    const lowerLeg = mix(shin, -.40, contact);
    const lean = T.MathUtils.clamp(controls?.bodyLean ?? 1.27, .4, 1.52);
    const trunk = mix(mix(mix(-1.17, -.40, e), -lean, flight), -.35, contact);
    this.torso.rotation.z = trunk;
    // The athlete extends the neck but the face still points slightly down in
    // flight, rather than staying unnaturally vertical through every pose.
    this.head.rotation.z = -trunk - mix(.11, .39, flight * (1 - contact));
    this.arms.forEach((arm, i) => {
      arm.rotation.z = mix(.05, .09, flight) + .30 * contact;
      arm.rotation.x = (i === 0 ? 1 : -1) * (.035 + .14 * contact);
      this.elbows[i].rotation.z = -.12 + .025 * flight - .28 * contact;
    });
    this.legs.forEach(({ hip, knee, ankle, ski }, i) => {
      hip.rotation.z = upperLeg;
      knee.rotation.z = lowerLeg - upperLeg;
      ankle.rotation.z = -lowerLeg;
      ski.rotation.z = T.MathUtils.clamp(controls?.skiPitch ?? 0, -.5, .5) * flight * (1 - contact);
      ski.rotation.y = (i === 0 ? 1 : -1) * .25 * flight * (1 - contact);
      this.cuffs[i].rotation.z = lowerLeg * .6;
    });
    // Exact two-link FK pins both ankle pivots to the ski datum during extension.
    this.pelvis.position.set(
      -(dimensions.thigh * Math.sin(upperLeg) + dimensions.shin * Math.sin(lowerLeg)),
      ankleHeight + dimensions.thigh * Math.cos(upperLeg) + dimensions.shin * Math.cos(lowerLeg), 0,
    );
  }
}

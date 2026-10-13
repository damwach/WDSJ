import * as T from 'three';

/** Metres. The anatomical joints remain at fixed distances in every pose. */
export const dimensions = { thigh: .44, shin: .43, torso: .53, ski: 2.6 };
const ankleHeight = .115;
const suit = new T.MeshStandardMaterial({ color: '#ea4d3d', roughness: .77 });
const navy = new T.MeshStandardMaterial({ color: '#172d3c', roughness: .7 });
const cream = new T.MeshStandardMaterial({ color: '#f5efda', roughness: .68 });
const black = new T.MeshStandardMaterial({ color: '#101d27', roughness: .5 });
const sole = new T.MeshStandardMaterial({ color: '#405260', roughness: .45, metalness: .2 });
const visor = new T.MeshStandardMaterial({ color: '#31434c', roughness: .13, metalness: .7 });
const edge = new T.MeshStandardMaterial({ color: '#98b0b9', roughness: .35, metalness: .65 });
const skin = new T.MeshStandardMaterial({ color: '#bc9479', roughness: .9 });

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
    const halfWidth = (.057 + .011 * Math.abs(x) / 1.54) * (1 - .75 * nose ** 4) * (1 - .3 * tail);
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
  { y: -.045, x: .115, z: .13 }, { y: .025, x: .123, z: .143 },
  { y: .10, x: .109, z: .132 }, { y: .20, x: .118, z: .146 },
  { y: .31, x: .137, z: .174 }, { y: .40, x: .14, z: .192 },
  { y: .45, x: .122, z: .191 }, { y: .49, x: .097, z: .142 },
  { y: .53, x: .063, z: .073 },
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
    mesh(new T.CylinderGeometry(.054, .062, .075, 24), navy, this.torso, 0, .55);

    this.head.position.set(.015, .57, 0);
    this.torso.add(this.head);
    // +X is forward. The neck counter-rotates so the athlete looks down the hill.
    ellipsoid(this.head, skin, [.047, .064, 0], [.091, .112, .084]);
    ellipsoid(this.head, cream, [-.027, .101, 0], [.113, .132, .110]);
    ellipsoid(this.head, navy, [.058, -.009, 0], [.066, .012, .075]);
    ellipsoid(this.head, visor, [.115, .098, 0], [.027, .031, .098]);
    ellipsoid(this.head, cream, [.073, .145, 0], [.048, .012, .103]);
    for (const side of [-1, 1]) {
      ellipsoid(this.head, navy, [-.009, .07, side * .108], [.027, .032, .008]);
      // Narrow helmet stripe and goggle strap are geometry, with no image textures.
      mesh(new T.BoxGeometry(.12, .02, .008), suit, this.head, -.025, .115, side * .108);
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
      arm.position.set(0, .43, side * .185);
      this.torso.add(arm);
      ellipsoid(arm, suit, [0, -.01, side * .009], [.068, .079, .065]);
      limb(arm, .29, [[.036, .039], [.042, .045], [.050, .052], [.056, .053]], suit);
      const elbow = new T.Group();
      elbow.position.y = -.29;
      arm.add(elbow);
      ellipsoid(elbow, suit, [0, 0, 0], [.039, .040, .041]);
      limb(elbow, .25, [[.026, .030], [.034, .035], [.039, .041], [.036, .038]], suit);
      mesh(new T.CylinderGeometry(.031, .028, .047, 16), navy, elbow, 0, -.239);
      ellipsoid(elbow, black, [0, -.29, .004 * side], [.031, .066, .037]);
      ellipsoid(elbow, black, [.029, -.28, -.014 * side], [.019, .037, .021]);
      this.arms.push(arm);
      this.elbows.push(elbow);
    }
    this.pose(0, 0, 0);
  }

  pose(extension: number, flightSeconds: number, landing: number) {
    const e = T.MathUtils.clamp(extension, 0, 1);
    const flight = T.MathUtils.smoothstep(flightSeconds, 0, .85);
    const contact = T.MathUtils.smoothstep(landing, 0, 1);
    const mix = T.MathUtils.lerp;
    // Joint rotations describe motion; geometry and limb lengths never change.
    const thigh = mix(mix(1.24, .14, e), -.94, flight);
    const shin = mix(mix(-.53, -.10, e), -1.03, flight);
    const upperLeg = mix(thigh, .63, contact);
    const lowerLeg = mix(shin, -.40, contact);
    const trunk = mix(mix(mix(-1.17, -.40, e), -1.13, flight), -.35, contact);
    this.torso.rotation.z = trunk;
    this.head.rotation.z = -trunk - .10;
    this.arms.forEach((arm, i) => {
      arm.rotation.z = mix(.05, -.04, flight) + .30 * contact;
      arm.rotation.x = (i === 0 ? 1 : -1) * (.06 + .14 * contact);
      this.elbows[i].rotation.z = -.12 + .07 * flight - .28 * contact;
    });
    this.legs.forEach(({ hip, knee, ankle, ski }, i) => {
      hip.rotation.z = upperLeg;
      knee.rotation.z = lowerLeg - upperLeg;
      ankle.rotation.z = -lowerLeg;
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

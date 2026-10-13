# Milestone 1: independent skis and mechanical bindings

All equipment dimensions are in metres, masses in kilograms and angles in radians. `src/equipment/config.ts` defines the typed equipment parameters. `cloneEquipmentConfig` creates an editable preview copy; `freezeEquipmentConfig` validates and freezes a separate snapshot for an attempt. The immutable default is not a measured commercial ski/binding specification.

## Toe-based mounting

The ski's longitudinal coordinate runs from the tail at 0 towards the tip at `ski.lengthM`. The boot toe is at `binding.bootToePositionM`. Consequently:

```
tip-to-toe length = ski.lengthM - binding.bootToePositionM
bootToePositionM = ski.lengthM * (1 - binding.frontSkiFraction)
front mount = bootToePositionM + frontAttachmentOffsetM
rear boot attachment = bootToePositionM + rearAttachmentOffsetM
ankle = bootToePositionM + ankleOffsetM
```

The default 2.60 m ski has 1.482 m ahead of the boot toe and 1.118 m behind it. The displayed nearest whole-centimetre front measurement is 148 cm. The ankle is at 0.938 m from the tail; the front pivot is at 1.093 m. Neither replaces the toe measurement.

The requested rule and source [FIS ski jumping documents](https://www.fis-ski.com/ski-jumping/documents) were supplied in the task. The exact wording and rounding procedure in Competition Equipment 2026/2027 have not been independently verified. Competition validation conservatively rejects every nominal fraction greater than 0.57, even if a centimetre display would round it down to 148 cm. It also rejects inconsistent fraction/toe values. `setBindingFraction` updates both together. The laboratory can explore a larger fraction; competition snapshots cannot accept it.

Changing the mounting fraction moves the boot and every attachment relative to the ski. It changes the front-pivot-to-pressure-point force arm and the ski's inertia about that pivot. The aerodynamic pressure point defaults to 46% of length from the tail; this is an exposed engineering assumption, not a FIS requirement or measured pressure distribution.

## Each ski's mass and inertia

Each rigid ski has a separate dynamic state. Its 2.2 kg mass is distributed over three uniform-density longitudinal segments. Their mass fractions are 0.31, 0.42 and 0.27; their boundaries are 0, 0.35, 0.65 and 1 of ski length. The resulting COM is at 48.7% of length from the tail. The longitudinal second moment, width and thickness give the pitch, edge and yaw inertias. The pitch solver uses the parallel-axis inertia about the actual front attachment. These mass fractions and equipment mass remain estimates.

## Front attachment, flexible sole and rear rod

The front pivot is fixed in the ski frame. The boot's rear point follows a rotation about that front attachment, so the heel can lift relative to the ski. The metal rear rod connects a fixed ski anchor with the moving rear boot point. Its telescoping length cannot exceed `binding.rodMaxLengthM`.

The heel limit is found from that geometric length constraint, rather than from a hardcoded heel height. The default rod has a neutral length of approximately 2.44 cm and a maximum length of 7.5 cm. The resulting rear attachment lift is approximately 5.5 cm. Altering the anchors or rod length changes the travel. Both anchors are placed 5.6 cm outwards from the boot centreline so the metal rod is visible beside the sole. Their equal lateral offsets leave the planar rod length unchanged. The front pivot remains attached throughout; the ski does not rotate freely about the ankle.

Binding and sole compliance are represented by two torsional springs in series. Their default stiffnesses are both 180 N·m/rad, giving an effective stiffness of 90 N·m/rad. Damping is 5 N·m·s/rad. This single relative-pitch coordinate is a reduced model of boot/sole/binding flexibility, rather than a deformable solid or a detailed model of a particular product.

## Coupled angular solver

The sagittal system has one body angle and two independent relative ski angles. Each ski's absolute angular velocity equals the body velocity plus its relative heel velocity. Binding torque acts on the ski and body with equal and opposite signs.

The solver uses backward Euler for spring and damping forces. Both rod stops and heel-on-ski contact are solved simultaneously using an active-set constraint solve. The stop impulse transfers angular momentum between the corresponding ski and body. There is no target for global body pitch.

In vacuum, with no actuator work, the system preserves total angular momentum and cannot increase its sum of rotational kinetic and spring potential energy. Damping, backward Euler and inelastic stops dissipate energy. Aerodynamic forces can transfer energy from the air; an optional bounded muscle torque has explicit internal work and is not active in this milestone's controller.

The nominal 18 kg·m² whole-system pitch inertia remains an estimate. The nominal body inertia is 18 minus the two nominal ski front-pivot inertias (15.779953 kg·m²). It scales with body mass; moving a binding changes ski inertia without silently changing the athlete inertia. Default total mass is 70 kg athlete + two configured skis + 3.6 kg other equipment. An explicit total-mass override changes the athlete share in both COM and inertia.

Aerodynamic ski moments use each pressure-point force arm. The existing whole-system estimated aerodynamic reference moment must be partitioned consistently: the body's external torque equals that total reference moment minus the two local ski torques. This avoids counting pressure-point moments twice. It does not turn the existing estimated coefficient curves into measured body or ski polars.

## V clearance and anatomy

`requiredAnkleHalfSeparation` calculates the foot separation needed for the requested V angle, ski width, real mounting position and `ski.minTailGapM`. It conservatively bounds the tail's full-width cross-section over the permitted independent heel travel and any common boot pitch, using the maximum ankle-to-tail radius. The default 3 cm clearance is a design parameter, not a FIS rule. For the default 0.25 rad half-angle, the required ankle half-separation is approximately 0.311 m. This is slightly wider than the exact neutral-pitch minimum and avoids weakening the clearance when the boot inclination changes.

The renderer's skeletal pose must reach these feet through its fixed-length legs. A requested V angle beyond anatomical reach must be reduced; moving skis away from attached boots or stretching leg bones is not an acceptable correction. The existing smooth V opening and closing provides finite transition time. Active finite-torque lateral control and flow disturbances belong to subsequent milestones.

## Checks and limits

The equipment tests check the toe-based 57% measurement, competition rejection, moving mounting force arms, mass-derived inertia, rod geometry, clearance throughout asymmetric heel motion, deterministic integration, finite response time and passive angular momentum/energy behavior, including mechanical stops. Separate rig/browser tests inspect the visible assembly and skeletal reach.

This milestone remains a reduced sagittal rotational model. It does not solve a general six-degree-of-freedom multibody system, distributed aerodynamic pressure, elastic ski bending, measured sole deformation, a full snow contact impulse/compliance solver or product-specific binding certification. Existing athlete mass distribution and aerodynamics still require measured validation. Subtle flutter, ankle-driven player control, a new human mesh and the complete Physics Studio are later milestones, not represented as completed here.

## Landing geometry and angular response

The sole profile and its 64 sections are shared between rendering and collision. Both edges of each ski are sampled (260 vertices). Airborne landing queries are restricted to the landing-hill domain; inrun support remains the earlier reduced contact model. This avoids mistaking a trailing ski at the table boundary for immediate landing preparation. Distributed exit contact with the last portion of the inrun is not resolved.

First sole crossing triggers the existing inelastic COM normal impulse. Its normal uses the actual contact station. On the outrun a finite ground angular spring/damper acts on each ski, with stiffness derived from half of the normal static load and a quarter-ski lever, critical ski damping and a bounded contact torque. It does not impose a free-flight body-angle target. Joint and global orientations remain integrated; the previous abrupt ground-angle projection was removed. The lowest sole vertex supplies vertical nonpenetration correction. This is a reduced penalty/position-constraint contact model, not a full multibody impact solution; complete ground energy/work and deformable snow are not validated.

The 0.489 m² body reference area comes from the earlier pose projection. The new lateral stance is not claimed to be the same measured projected area, and aerodynamic coefficients were not retuned to compensate for a distance change. All aerodynamic polars and the whole-system moment remain engineering estimates.

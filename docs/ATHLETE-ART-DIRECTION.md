# Skinned athlete art direction

Reference set: [five supplied photographs, original sources and licences](../references/athlete/README.md). Photographs are analysis references only, excluded from the runtime model, textures and deployment. The athlete geometry, panel colours and number are original.

- **Prevc (01), primary side reference:** long, nearly continuous chest–hip–thigh line, modest knee flexion, chin near the chest axis, shoulders relaxed and hands carried aft alongside the hips. The photograph is an oblique view, not a calibrated sagittal measurement. Do not copy its image-plane slope into global body pitch.
- **Front V (02):** narrow torso, shoulder width larger than waist, long legs and a reachable lateral ankle separation. Ski opening must come from the existing stance/binding solver, not visual translation.
- **Hvala (03):** check chest volume, sleeve separation, head orientation, and the gap between boot and ski in three-quarter projection.
- **Schmitt (04):** check relaxed arm carriage and symmetry. Equipment/stance differs from the other photos; do not combine every projected angle into one impossible pose.
- **Stoch (05):** asymmetrical knee flexion and foot stagger, with arms spread to balance landing. Keep the existing contact/stride limits. This is one landing instant, not a complete measured motion sequence.

## Model

Original Blender-authored continuous suit surface, welded at hips/shoulders and weighted to a 19-bone armature. Editable source: `assets/athlete/athlete.blend`; repeatable modelling script: `assets/athlete/build.py`; runtime export: `src/athlete/assets/athlete.glb`. Hidden construction cages remain in the Blender file, excluded from export. Unlike the old model, no limb surface, joint sleeve or muscle cap is generated or deformed by JavaScript.

Anatomical dimensions remain tied to the solver: thigh 0.44 m, shin 0.43 m, trunk 0.53 m. A neutral A-pose separates the sleeves for weighting. The runtime retargeter uses the authored bind frames and solved joint transforms, including spatial leg IK. Spine/chest follow the shared trunk axis; there is no independent cinematic trajectory. Skis, boot front anchors, heel travel and rear guide rods remain in `SkiAssembly`.

The suit uses original vertex-colour panels and a vector race number. Helmet, face, lens and gloves are separately weighted accessories. No photograph is embedded as a texture. These are a stylised game athlete and simplified facial features, not a likeness of a photographed athlete.

## Posture adjustments

In `jointPose`, flight neck extension is reduced from 0.38 to 0.22 rad. Arm spread is 0.115 rad in the tuck and 0.145 rad in flight to clear the thighs; landing spread rises to about 60 degrees and then recovers on the existing contact clock. A bounded shoulder response follows the existing body-lean state (maximum 0.018 rad), with no random idle motion. Flight thigh/shin targets change from −0.86/−1.10 rad to −1.04/−1.18 rad. This reduces knee flexion from about 14° to 8° and the nominal sagittal thigh–trunk bend from about 24° to 13°. Spatial IK still determines the reachable final joints. V deployment timing, mass/COM formulas, aerodynamic forces, ski solver and contact equations are unchanged; the COM now follows the updated joint targets, so physical output is intentionally not identical. See the measured comparison in ATHLETE-VALIDATION.md. Existing staggered knee/hip extension and 0.12–0.52 s V opening are retained rather than replaced with an animation clip.

The five photographs do not establish measured angular trajectories, inrun timing or takeoff force. Those remain model assumptions. Visual comparisons must use matched before/after cameras; reference comparisons match approximate direction, not camera calibration.

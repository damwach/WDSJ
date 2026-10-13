# Athlete anatomy v2 — render-only sculpt and limitations

This prototype replaces the visible human surfaces while retaining the Milestone 1
joint pivots, inverse kinematics, boot/binding assembly and ski dynamics. It is
intended for visual review **on top of** PR #4 (feature/m1-ski-bindings).
It is not an independent replacement for PR #4 and must not be merged separately
into main before the equipment code it imports.

## Render geometry
- src/athlete/human.ts creates smooth PCHIP-interpolated, ring-based surfaces
  with localized asymmetry for chest, scapulae, buttocks, quadriceps,
  calf, tibia, shoulder and skull.
- A fitted race suit has narrow stretch panels, seam accents, shaped shoulder
  covers and a conforming bib. It uses material colors, not bitmap textures.
- The helmet has a separate skull, jaw, shell, goggles, chin strap and vents;
  racing gloves have an identifiable thumb and four separate fingers.
- Procedural lofts are allocated once when a new Athlete is
  constructed. Ordinary animation does not allocate or regenerate meshes.
- The original bone hierarchy, knee/elbow fabric sleeves, binding solver, toe
  attachment, rear guide and moving heel are preserved.

## What this does NOT do
- It is not a medical-anatomy scan or a manually sculpted Blender character.
  Proportions remain plausible design estimates, not measurements from an
  individual skier.
- The aerodynamic reference area in pose.ts is still the older v0.8 estimate.
  These visual changes **do not change** aerodynamic coefficients or forces.
  Before using the new geometry as an aerodynamic reference, rerun body-area
  measurement and calibrate against wind-tunnel data.
- Current mouse flight trim still writes to Simulation.bodyLean, not a
  muscle-actuated ankle controller. The front attachment and rear guide are
  mechanical constraints; neither is an input actuator. Ankle-muscle control
  needs a separate physics change with new tests before claiming that the
  skier controls lean by ankle articulation.
- No animation is claimed to have been validated against motion capture.

## Review before merging
Use isolated-pose screenshots and manually inspect:
1. Suit silhouette, shoulders and neck from the front, side and rear;
2. Knee, calf and arm contours during tuck, push, flight and telemark;
3. Glove hands and helmet/goggles at athlete-camera distance;
4. Both boots aligned with the real bindings and heel mechanism;
5. Mesh intersections, lighting defects and performance regressions.

Prefer an artist-sculpted, skinned glTF character for a genuinely premium
close-up model once we have a clean editable Blender source, licensing and
reference images. This procedural v2 is an incremental visual improvement,
not a substitute for art direction or user evaluation.

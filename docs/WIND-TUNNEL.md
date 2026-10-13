# Wind Tunnel Lab — first playable diagnostic

## Why this exists

The tunnel is an interactive 3D diagnostic for SKYLIFT's *existing* reduced-order
aerodynamics, not a CFD solver and not a physical wind-tunnel experiment.
Its primary purpose is to expose otherwise opaque forces and compare conditions
while keeping gameplay feel and scientific validation separate.

Launch it via **Tunel aerodynamiczny** in the bottom toolbar. The inrun/flight
simulation pauses while the lab is open. Escape or **Zamknij** closes the lab.

## Shared physics

`src/lab/windTunnel.ts` directly calls
`src/physics/aerodynamics.ts::aerodynamicForces` with horizontal relative flow.
It does not define or re-tune CL, CD or CM. The browser UI and automated tests
consume this same helper.

Controls: flow speed (m/s), system/root pitch (degrees relative to horizontal wind),
body lean (degrees measured from the local vertical), half-angle of V (degrees per
ski), air density (kg/m³, including zero for a vacuum diagnostic). Three.js previews the same angular pose and V-deployment
parameter that are fed to the coefficient function; it does not model flexible
cloth, deformation or interference flow.

Readouts: vertical lift [N], longitudinal drag [N], signed ratio of those
components, pitching moment [N m], dynamic pressure [Pa], ski and trunk incidence
[degrees]. The torso incidence is root pitch + 90° minus body lean; its local
vertical rotates with the ski/root. Arrows originate at the same approximate
centre of mass used by the game. Their lengths are capped for legibility, so they
are schematic rather than a common linear force scale. Flow tracers also run at
a display speed of 8% of the specified stream speed. A polar sweep over -10..30 degrees
is calculated with the *same* aerodynamic function; CSV export and A/B comparison
are available. The plot includes a signed L/D axis, zero line and current setting.
A/B slots preserve the complete settings as well as the resulting forces. CSV
rows include flow speed, lean, V half-angle and density, making the curve's input
conditions reproducible.

For the stationary specimen the relative velocity used by the solver is
`u = (speed, 0, 0)`: the displayed air passes from the ski tips toward the tail,
in the -X direction. `q = rho * speed² / 2`; no gravity or contact forces belong
in this steady aerodynamic measurement. Vertical lift is `lift.y`, longitudinal
drag is `-drag.x`, and signed L/D is their ratio. At zero speed or zero density,
all forces and the moment vanish. The UI displays **—** for L/D when drag is
zero, and both incidence angles are undefined at zero flow. JSON helper results
retain the documented numeric ratio convention of zero for that undefined case.

M1 adds **Sylwetka / Wiązania** views. The latter frames the left boot, front
fixation and telescopic rear rod, with static heel-angle fixtures for each ski.
The two slider maxima come from `maximumHeelAngleRad`, solved from the actual
rear anchors and maximum rod length. `createBindingSystemState` and
`heelGeometry` provide the same rig state as the game, but this laboratory pose
is prescribed rather than integrated: there is no idle heel animation, muscle
input, training mode or simulated release in this view.

`sampleTunnel(settings, [leftHeelRad, rightHeelRad])` and
`sweepIncidence(settings, min, max, step, heelAnglesRad)` pass those independent
angles into the shared aerodynamic solver. Invalid/non-finite heel angles are
rejected, including angles outside the rear-rod travel. A/B slots preserve them;
CSV appends `heel_left_rad,heel_right_rad` after the existing eight columns.
The alpha readout now shows **left ski / right ski / body** directly from each
surface calculation. With V or raised heels, neither ski alpha can be inferred
solely from root pitch. The sweep's `angle_deg` remains root pitch, not the
individual plates' measured incidence.

The specimen is suspended above the display floor and camera distance is fitted
to its bounds when angles or viewport size change. This presentation translation
does not change any force or gameplay state.

Important: **peak L/D is not an ideal flight posture**. A real jump is a dynamic
optimization of lift, drag, controllability, stability, takeoff energy, and safe
landing. Treat ratios as diagnostics, not evidence of scientific accuracy.

## Known shortcomings inherited from the current flight model

- One reduced body and two independent ski plates: no validated athlete/suit/ski polars.
- Each ski uses its own chord/normal and incidence in 3D, including V and heel
  rotation. V also retains an estimated lift multiplier; no measured
  interference or V-specific moment/drag polar has been calibrated.
- An estimated trim moment: actual derivative dCm/dalpha, damping and stability
  have not been measured.
- Only one steady uniform, horizontal flow case here. No turbulence, gust
  spectrum, boundary layer, head/side yaw sweep, rotational wind-tunnel test, or
  force feedback on individual articulated body segments.
- The pose's V-open override is strictly presentation/lab-only; ordinary
  flight deployment and gameplay have not been changed.

## Validating without making the game less playable

1. Save time-stamped simulation telemetry at 120 Hz (forces, moments, angular
   momentum, joint pose, player input, wind, flight path, contact).
2. Collect *citable measured data* for force coefficients and trajectories
   with compatible reference area, angle convention, equipment and speed.
3. Fit polars for CL/CD/CM and their derivatives to measurements. Hold out
   flight trajectories for independent validation; do not tune solely to 125m.
4. Evaluate sensitivity at plausible incidence, V, lean and yaw. Measure
   stability and recovery against sample disturbances.
5. Keep **simulation realism**, **input response**, and **visual animation**
   independent. Give players forgiving control ranges without inventing forces.
6. Use replay and comparative scenarios to diagnose the current model. Label
   numerical repeatability separately from experimental calibration; defer
   claims about real-world optimal technique until independent validation.

## Developer checks

`npm test` (including eleven cases in `tests/wind-tunnel.test.ts`), `npm run build`,
and `npm run test:visual` in a Chromium environment with WebGL. Four focused
browser cases check all sliders against the rendered skeleton and shared solver,
unchanged interrupted jump state, zero-flow tracers, a single animation loop
after rapid reopen, saved A/B inputs, CSV round-trip, and the complete specimen
on a 390×844 portrait viewport. They also collect page and console errors.
Two additional equipment browser cases use native keyboard events on the heel
sliders and check front attachment coincidence, rear-anchor distance, positive
heel rise, world chord/normal agreement with the solver, full ski-mesh lateral
separation of at least 3 cm, CSV heel values and mobile binding framing.

API calls reject non-finite settings. Finite values are bounded explicitly and
the normalized settings are returned with the sample. Polar sweeps reject
non-finite bounds, angles outside the diagnostic range, non-positive steps and
more than 400 intervals; indexed sampling avoids accumulated angle drift.

Screenshots: `artifacts/tunnel-desktop.png`, `artifacts/tunnel-mobile.png` and
`artifacts/tunnel-mobile-controls.png`. These are visual review artifacts,
not evidence that the estimated aerodynamic coefficients are physically valid.
M1 close views are `artifacts/m1-bindings-neutral-desktop.png`,
`artifacts/m1-bindings-raised-desktop.png`, `artifacts/m1-bindings-mobile.png`
and `artifacts/m1-bindings-mobile-close.png`.

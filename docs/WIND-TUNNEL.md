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

Controls: flow speed (m/s), ski incidence (degrees relative to horizontal wind),
body lean (degrees measured from the local vertical), half-angle of V (degrees per
ski), air density (kg/m³). Three.js previews the same angular pose and V-deployment
parameter that are fed to the coefficient function; it does not model flexible
cloth, deformation or interference flow.

Readouts: vertical lift [N], longitudinal drag [N], signed ratio of those
components, pitching moment [N m], dynamic pressure [Pa], actual incidence
[degrees]. Arrows visualize lift and drag. A polar sweep over -10..30 degrees
is calculated with the *same* aerodynamic function; CSV export and A/B comparison
are available.

Important: **peak L/D is not an ideal flight posture**. A real jump is a dynamic
optimization of lift, drag, controllability, stability, takeoff energy, and safe
landing. Treat ratios as diagnostics, not evidence of scientific accuracy.

## Known shortcomings inherited from the current flight model

- Single reduced body + pair of ski plates: no validated athlete/suit/ski polars.
- V deployment mainly scales aerodynamic magnitudes instead of modifying full
  interference, 3D side force and moment curves. Real V-effects may be different.
- An estimated trim moment: actual derivative dCm/dalpha, damping and stability
  have not been measured.
- Only one steady uniform, horizontal flow case here. No turbulence, gust
  spectrum, boundary layer, head/side yaw sweep, rotational wind-tunnel test, or
  force feedback on individual articulated body segments.
- Sketch pose's V-open override is strictly presentation/lab-only; ordinary
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
6. Add training challenges and replay only after calibration, so they do not
   reward exploiting known aerodynamic approximations.

## Developer checks

`npm test` (including `tests/wind-tunnel.test.ts`), `npm run build`, and
`npm run test:visual` in a Chromium environment with WebGL. For the new UI,
check opening/closing the lab, live values and pose, resizing, keyboard focus,
returning to an interrupted jump, and CSV data. Review mobile layout manually.

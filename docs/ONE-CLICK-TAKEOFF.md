# Single-click timing takeoff (experimental)

The player chooses **when** to start the leg extension, not the strength of a
mouse dragging gesture. A single **left mouse button press** on the WebGL
canvas is accepted in the last 8 m before the table edge.

Implementation:
- `GestureInput.consumeClicks()` records one pointerdown edge (not pointermove).
- `Simulation.clickTakeoff()` arms a one-shot finite-rate leg actuator, with
  full extension as its target and a 45 ms activation ramp.
- `Simulation.stepContact()` integrates reaction forces over the 120 Hz fixed
  time step. No velocity impulse is applied immediately on click.
- Force is capped at `2.85 * mass * gravity` for the new single-click path.
  The older internal `gesture()` interface is retained for existing regression
  callers but is no longer mapped to player input. The demonstration uses the
  same click path as the player.
- The departure velocity is the sum of the approach tangent component and
  integrated normal component:
  `v = v_approach * tangent + v_normal * normal`,
  where `tangent=(cos(theta),sin(theta))`,
  `normal=(-sin(theta),cos(theta))`,
  `theta` is the downward slope of the table.
- Contact duration naturally affects total impulse: a late click leaves
  insufficient time to develop normal velocity; very early clicking can lead
  to premature release if extension completes before the lip.
- Once airborne the player currently adjusts fore/aft body lean vertically with
  the mouse; horizontal pointer movement no longer changes flight bank.
  **Ankle-actuated flight control remains Issue #6**. The transition to V
  is still a shared procedural phase of the athlete pose, not measured motion.

## Force scale and direction

A 1993 study (Virmavirta and Komi, Part I) reported two athletes' peak normal
takeoff forces of 25.46 ± 0.80 and 27.97 ± 0.98 N/kg (body mass normalized).
That corresponds to ~2.6–2.9 times body weight, and to ~1.9–2.1 kN for
75 kg total mass. These are measurements of peak values in a small
sample; they are NOT measurements of the force curve or of this game's athlete.

- Part I: https://doi.org/10.1111/j.1600-0838.1993.tb00387.x
- Part II: https://doi.org/10.1111/j.1600-0838.1993.tb00388.x
- Virmavirta and Komi (1989) report a major force peak about 149 ± 9 ms
  before release: https://doi.org/10.1123/ijsb.5.2.248
- Reference ski jump chapter estimates 2.78 m/s normal release velocity
  for one 140 m simulation scenario:
  https://doi.org/10.1007/978-3-319-14418-4_131
- Review on force decomposition and overall velocity remaining slightly
  downward relative to ground:
  https://doi.org/10.3389/fspor.2026.1784281

Current constants are **engineering starting points**, not a fit to athlete
force-plate time series. In particular, the current force-time curve follows
the preexisting reduced-order actuator and the 45 ms motor activation. It should
be calibrated against multi-subject normal ground-reaction-force recordings
and observed COM/rotational motion, not optimized only to reach HS140.

For an 11° downward table, the normal component points slightly forward and
predominantly upward; the resultant ground-frame velocity can still point
slightly downward because the approach is fast. Do NOT add the above 2.78 m/s
as a world-vertical impulse directly.

## Acceptance tests

- Single click only, no two-button hold or drag.
- Too-early click is ignored; second click cannot change a launched takeoff.
- Takeoff forces occur over actual contact time and peak at a finite cap.
- Normal component of release velocity matches integrated actuator velocity.
- Late clicks generally accumulate smaller impulse than properly timed clicks.
- Horizontal mouse movement during flight never changes pilot bank.
- Existing physics, real WebGL/Chromium and replay tests must remain green.

Physics-studio tuning should eventually expose force ceiling, activation
rise, start window, strength/pose strategy and expected motion confidence,
with SI units and separate experimental vs gameplay parameters.

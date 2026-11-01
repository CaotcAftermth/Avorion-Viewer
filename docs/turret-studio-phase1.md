# Turret Studio Phase 1

Open a library turret and expand **Turret Properties > Turret Studio**. Select any of the 19 weapon families independently of the design. Play/Resume, Pause, Restart, playback speed, target motion, world-coordinate target positions, orbit radius/period, tracking rate, normal/coaxial behavior, and demonstration mode are available. The pink wireframe target is a demonstration marker, not a combat entity. Firing simulation reports events; it does not render weapon effects. Guide toggles remain independent.

## Architecture

- `simulation.js`: pure fixed-step clock (120 Hz), independent firing channels, origin-plus-index scheduling, alternating/simultaneous muzzles, multi-shot, configurable burst groups, start/stop and continuous activate/deactivate lifecycles. `update(time, firing, gate)` supplies a future cooling/energy gate. Event consumers may attach future audio/impact systems without coupling them to rendering. Discrete visual lifetime is separate from cadence.
- `tracking.js`: tracking and muzzle world frames reuse `partMatrices`, authored pivots, native elevation sign, mount orientation, and scale. The yaw solver uses projected signed angles and the shortest angular difference; pitch and optional yaw limits are clamped. Coaxial mode preserves the initial authored editor pose. Existing native muzzle conversion is reused; marked-block/front-face or barrel-bounds fallback is explicitly estimated.
- `weapon-profiles.js`: all 19 source families with source line references, retained visual expressions and branch context, cooling expressions, turning generation calls, and deterministic midpoint firing intervals. These are base representative settings, not complete native generated weapon instances. No recoil fields are present.
- `studio.js`: connects the clock, target sampler, scheduler, and UI. `scene.turretStudio.subscribe(listener)` exposes firing events with simulation timestamps and muzzle frames. Runtime counters retain only the latest event, not an unbounded event log. Per-frame poses use the existing textured model's `setBlockTransforms`; they do not reconstruct block geometry each frame. Existing geometry expands out of instancing only as required by the existing pose implementation.
- The isolated asset workspace owns and disposes the runtime. Simulation settings save with the library asset; imported XML remains untouched. Runtime target and playback time are not written into XML or the main ship session. Playback does not change the saved manual pose.

## Explicit fidelity boundaries

Tracking speed is a viewer setting in degrees/second. Native `turningSpeed` units are still unverified; `nativeTurningSpeed` requires an explicit unit choice and throws without it. No inferred conversion is silently applied.

Generator midpoints are deterministic and are not rerolled on restart. This phase does not execute native RNG or native setters. Source expressions document details not yet resolved into a full generated profile. Railgun/lightning are discrete beams, Tesla is continuous lightning, pulse is a projectile, force includes its additional swirl layer, and repair retains its operating-mode distinction.

Scheduling starts at the first simulation tick. Alternating phase order and first-shot phase are viewer conventions pending native verification. UI burst mode is a clearly labeled demonstration of three events and a one-second rest, not a claim to reproduce the game's heat-driven BurstFire specialty. The scheduler can accept independent channels and other burst configurations. Continuous lifecycle activation is separate from damage ticks; pausing freezes simulation time rather than emitting a false firing-stop event.

Custom targets interpolate a user-supplied list, restarting at the end of each period; linear targets ping-pong. Orbit uses an elliptical vertical component. These are viewer demonstration paths. Coordinates are native world coordinates, not Blender meters.

No recoil animation or force simulation exists. No projectile, beam, flash, trail, impact, audio, or cooling visualization is implemented. Animated video export and native visual calibration remain Phase 2 work. Existing static export behavior is retained; a paused simulation pose is not a new animated-export contract.

## Validation

`node --test tests/turret-simulation.test.mjs` covers deterministic clock partitions, pause/speed/restart, profile resolution, scheduling modes and lifecycle, native pitch sign, yaw wrapping, angled/inverted mounts, multiple muzzle transforms, coaxial restrictions, custom paths, and unchanged source assets/XML.

`node tests/turret-studio.check.mjs` exercises the actual embedded workspace with all 19 profile choices, playback, event mode, pause/restart, coaxial control, existing pose/color editing, save/reopen, and main-layout isolation. `npm test` and `npm run build` remain the repository checks.

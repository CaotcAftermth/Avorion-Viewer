# Weapon-family effects and resources — development history

> Historical milestone report. For current behavior, see [Turret Studio](TURRET_STUDIO.md).

## Status since this milestone

Later work added cinematic playback, deterministic animation export and local comparison/calibration tools. Recommendations below for those features are historical. Matched native references, verified native unit conversion and audio remain unresolved.

## Milestone record

Implemented October 29, 2026. All 19 standard families now produce firing visuals from the current turret's authored muzzle transforms, or the existing labeled fallback when muzzle data is absent. This completes functional effect coverage, not native visual parity. No audio, video export, combat damage, ship physics, recoil animation or new XML format was added.

## Changed files

- `src/turrets/effect-profiles.js`: all 19 appearance profiles, deterministic color/statistic variations, firing flags, source burst resolution, cooling configuration, source references and fidelity classifications.
- `src/turrets/effect-simulation.js`: projectile guidance, bounded path histories, timed flak death, discrete beam snapshots, continuous layers and repair offsets; preserves collision-driven impacts and range/lifetime misses.
- `src/turrets/effect-renderer.js`: shared projectile/particle pools, non-emissive rocket geometry, exhaust samples, animated plasma/pulse presentation, energy/dust impacts and reusable beam pools.
- `src/turrets/beam-effects.js` (new): reusable buffered straight, lightning and swirling paths, camera-facing beam ribbons, independently colored core/body/aura, alpha, discrete fade and acceleration-aware animation.
- `src/turrets/firing-resource.js` (new): normalized Standard heat and BatteryCharge recovery using source relationships and explicit restart calibration.
- `src/turrets/studio.js`: profile resolution, resource gating, shot-time pose interpolation, family tracking factors, conditional family controls and resolved status. Existing clock, scheduler, collision BVHs and workspace API remain the integration points.
- `src/turrets/tracking.js`: adds the transformed local X direction and scale to muzzle frames for source-defined repair offsets.
- `tests/turret-effects.test.mjs`: replaces the obsolete unsupported-Tesla expectation with an unknown-family check.
- New tests: `tests/turret-phase3.test.mjs`, `tests/turret-phase3.check.mjs`, `tests/turret-phase3-native.check.mjs`, `tests/turret-phase3-performance.check.mjs`.

## Functional coverage

| Canonical identifiers | Rendering and lifecycle |
| --- | --- |
| ChainGun, PointDefenseChainGun, Bolter | Ballistic projectiles and physical impacts; distinct source speed, size and cadence |
| Cannon | Heavy ballistic projectile and collision explosion |
| PlasmaGun, PulseCannon | Discrete energy projectiles; animated plasma core/halo and pulse streaks; energy impacts |
| RocketLauncher | Oriented rocket mesh, bounded exhaust history, optional representative seeker, collision explosion |
| AntiFighter | Timed projectile death and dust expansion with source radius 35, including misses |
| Laser, PointDefenseLaser | Continuous straight beams |
| MiningLaser, RawMiningLaser, SalvagingLaser, RawSalvagingLaser | Continuous straight beams with half-strength demonstration-material RGB/alpha and source ranges 75/150 |
| RailGun | Discrete straight beams with warm/blue generation branches; independent calibrated lifetime |
| LightningGun | Discrete deterministic lightning paths; independent calibrated lifetime |
| TeslaGun | Sustained electrical paths animated from simulation time |
| RepairBeam | Shield, hull and dual modes with separate colors and local X offsets |
| ForceGun | Separate primary straight and secondary swirling layers on one firing lifecycle |

Visual activation is independent of damage ticks. Discrete shots retain separate origin/direction/lifetime records; continuous beams follow current muzzle direction, not perfect target aim. All beam center rays stop at the nearest valid target or BVH surface. Lightning and swirl displacement are visual approximations around that center ray, not separate combat collision geometry.

Dual repair uses ±0.1 multiplied by source turret size and transformed barrel scale along local X. Each authored muzzle gets the two-mode composition; custom turret muzzle coordinates are retained rather than replaced with a procedural game turret layout. Force Gun's invisible duplicated weapon appearance does not suppress its swirling beam.

## Source evidence and resolution choices

Reviewed the prior research and machine-readable evidence, current Phase 1/2 code, and installed Avorion `weapongenerator.lua`, `turretgenerator.lua` and Weapon API field definitions. Relevant references include W:9–837 for weapon effects; T:192–229 for cooling equations; T:249 for tracking factors; T:463–543 for simultaneous generation; T:670–712 for bursts; T:1548–1566 for independent rocket draws; T:1707–1735 for dual repair; T:1889–1897 for Force Gun composition.

Profiles expose `fidelity`: parameters are **source-confirmed**, firing reconstruction is **source-derived**, appearance is **approximate**, and `calibrated` is false. Missing native shape/animation defaults remain distinct from explicit assignments; renderer fallback choices do not establish native defaults. No additional weapon types were inferred from sound files.

The default representative uses source midpoint statistics with deterministic generated colors and flags. “Seeded source ranges” samples applicable base delay, velocity, size and range expressions. This is a viewer seed generator, not an emulation of Avorion's RNG or complete rarity/tech/specialty pipeline. Imported design XML is geometry, not a fully resolved game weapon loadout. Effects therefore use labeled base representative statistics rather than inferring slots, damage or technology from visual size.

Simultaneous flags resolve once per profile using the source probabilities. Chaingun, Bolter and Rocket multishot use the 5% branch and `{2,2,2,2,2,3,4}` selection, independently of muzzle count. Rocket delay-count and generated position-count draws are separate and displayed; actual custom-design muzzle coordinates/count remain authoritative for spawning. Users can choose explicit custom alternating/simultaneous/multishot modes without altering XML.

For multiplied-delay families, the resolved per-weapon delay includes weapon count before alternating distribution. Rocket uses its independent delay-count draw. For families without that assignment, source base per-weapon delay remains intact. Point Defense Laser's count-multiplied damage interval is separate from continuous beam visibility. Initial phase/order and automatic restart scheduling remain representative where native execution is unavailable.

The burst preview replaces the old arbitrary three-shot pattern. It applies aggregate `max(baseRate * 2.5, 6)`, distributes that rate across weapons, uses a one-second shooting period, and sets recovery to `newRate / baseRate`. The factor 2.5 is the midpoint of the source 2–3 draw. Battery weapons use BurstFireEnergy's charge mode; heat weapons use Standard. This is an explicitly selected specialty preview, not a randomly inferred specialty of the imported geometry.

## Heat and charge

The simulation stores normalized resource debt. Standard displays debt as heat; BatteryCharge displays one minus debt as remaining charge. Normalizing by maxHeat/maxCharge preserves the inspected formulas without inventing combat DPS:

- Passive debt recovery: `1 / recoveryTime` per second.
- Debt per firing: `(1 / shootingTime + 1 / recoveryTime) / firingsPerSecond`.
- Multishot pellets do not each count as additional physical weapon firings.

Heat starts empty and charge starts full. Nominal shooting/recovery times use the documented source midpoints, including Bolter's 1.1 and Pulse's 1.25 multipliers. Families without a source cooling constructor retain an explicit unresolved native-default status. Stop occurs at full debt; restart at debt ≤0.05 is a configurable approximation. No external ship battery, damage or energy-consumption system is simulated.

## Approximation controls and remaining fidelity gaps

`CALIBRATION` isolates flash envelopes, trail opacity, impact durations, particle count, discrete beam lifetime, lightning segments/displacement, swirl radius/turns, guidance turn rate/acceleration and restart threshold. The provisional world-unit mapping remains 1:1 through `nativeDistance()`; it is not described as meters.

Representative seekers turn toward an acquired target at up to 90 degrees/s with zero acceleration by default. They lose acquisition when the target becomes invalid or exceeds configured range and then continue unguided. This algorithm, acquisition policy and lack of reacquisition are explicit viewer approximations. Range tracks traveled path length; lifetime remains finite. Unguided trajectories retain their launch orientation.

Lightning uses seeded bounded offsets with endpoint pinning. Discrete lightning stays stable during its visible lifetime; Tesla changes through simulation-time-indexed shapes. Swirls use an endpoint-tapered helix. Both reuse geometry buffers; no uncontrolled per-frame randomness is used. Source animation speed and explicit acceleration are retained; omitted acceleration is unresolved in metadata and uses zero as a renderer fallback.

Discrete beams default to 0.14 seconds with linear visual fade, independently of fireDelay. This can be previewed in Studio. Exact path generation, transparency, blend response, beam lifetime/fade, plasma shape, rocket/exhaust geometry and dust particles have not been matched to native recordings. Cannon/rocket radius remains provisional because the source damage-dependent radius requires a resolved weapon's damage. Flak radius 35 is explicit in source. The configured material input is a demonstration RGB value, not a discovered asteroid/ship material.

The existing fixed 120 Hz simulation remains authoritative. Firing snapshots interpolate pose within each step. Swept projectile/target tests prevent tunneling; articulated block geometry is tested at the step pose rather than continuously swept through rotation. Native targeting lead, exact restart hysteresis and RNG equivalence remain unverified.

## Verification and performance recorded at this milestone

- Automated suite: 327 tests pass, including 33 Phase 3 tests and the existing importer, transform, rendering and export tests.
- All 19 families have profile/lifecycle, render-pool, deterministic replay and cleanup coverage. Additional tests cover guided/lost targets, timed flak misses, independent discrete beams, material colors, dual offsets, layers, source burst equations, recovery, playback speed, mounting orientation, coaxial limits and stationary/linear/orbit targets passing behind arcs or beyond range.
- Edge/SwiftShader: all 19 shaders/effects render without console errors; conditional controls, family switching, pause/restart and Force-layer visibility pass. Screenshots are `test-results/phase3-<canonical family>.png`.
- Original `Craft 2_turret2.xml`: 250 blocks, three authored muzzles; six advanced effect families tested through repeated workspace replacement. Source XML and block positions remain unchanged. Capture: `test-results/phase3-native-custom.png`.
- WebGL resource test: three complete family-switch cycles plateau at 4 geometries, 0 textures and 3 shader programs for a one-muzzle scene with dual repair. Disposal returns geometry and program counts to zero. Raw results: `test-results/phase3-gpu-resources.json`.
- CPU stress benchmark: six representative families, eight simultaneous muzzles, four shots per muzzle, 1,200 simulation/render-preparation steps over ten simulated seconds. Recorded p95 CPU costs range about 0.04–0.80 ms per step on this host; rockets peak at 288 active projectiles. No pool overflow after bounding exhaust samples to eight per rocket (four at low quality). These are CPU simulation/buffer-preparation timings, not GPU frame-rate claims. Raw results: `test-results/phase3-performance.json`.
- Effects use a 4096-instance particle/projectile pool, a 4096-instance rocket pool and up to 256 reusable beam meshes. Overflow remains explicit in status and cannot remove simulation events. The beam mesh pool grows to the peak needed and stays stable until workspace disposal.
- Existing full-workspace browser checks pass for viewport/editor controls, pose/color editing, save/reopen and parent-workspace isolation. Static production build succeeds.

Visual review caught and corrected ribbon twisting in electrical/swirl paths. Stress testing caught excessive exhaust sampling and reduced presentation density without altering trajectories, event timing or range. Native visual parity is still not established by these tests.

## Follow-up proposed at this milestone

Capture known native weapon instances and frame-aligned gameplay for every family, especially seeker loss/reacquisition, Lightning/Tesla geometry, dual repair, Force layering and flak death. Verify unit conversion, cooling thresholds and initial barrel phase before tuning approximate shaders and envelopes. Add source-backed audio synchronization and deterministic cinematic export as separate work. Neither is claimed complete here.

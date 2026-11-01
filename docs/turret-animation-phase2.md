# Initial weapon effects — development history

> Historical milestone report. For current behavior, see [Turret Studio](TURRET_STUDIO.md).

## Status since this milestone

The three-family limit and “visuals pending” status below were superseded by the all-family implementation. Later work added guided rockets, electrical beams, repair/force layers, resource behavior, effect capture and animation export. Native visual parity remains unverified.

## Milestone record

Implemented October 29, 2026. Visual support is limited to ChainGun, Cannon and standard Laser. The other 16 families remain selectable with an explicit “visuals pending” label. No substitute rendering, recoil, damage or ship physics was added.

## Files and systems

- `src/turrets/effect-profiles.js`: deterministic representative effect profiles, native-distance conversion and separate visual calibration constants.
- `src/turrets/effect-simulation.js`: timestamped ballistic shots, swept target collision, finite ray queries, range/lifetime termination, flashes, physical/explosive impacts and continuous beam activation/contact.
- `src/turrets/effect-collision.js`: reuses the existing block triangle BVH and bounded ray queries. Builds one tree per turret component, updates inverse transforms as the turret articulates, and permits a muzzle to exit its containing source block.
- `src/turrets/effect-renderer.js`: reusable 4096-instance GPU pool for projectiles, streaks, flashes and seeded particles; reused camera-facing beam planes with layered animated shaders. Pool overflow is reported in Studio status and never removes simulation shots. No per-shot lights or global exposure changes.
- `src/turrets/studio.js`: integrates effects with the existing fixed 120 Hz clock, firing scheduler, native muzzle transforms and tracking. Adds presentation controls, firing release, appearance seed, quality and readable resolved parameters. `runtime.advance(seconds)` advances exact simulation duration while paused, independent of wall time and playback-speed settings.
- `src/game-renderer.js`: attaches effects to the existing world, shares depth conventions, extends effect clipping without changing viewport pan, excludes effects from shadow/mask passes and static exports, and disposes GPU resources on release.
- `src/app.js`: disposes the old Studio when configuring another asset and exposes deterministic `advance(seconds)` on the workspace controller.
- Tests: `tests/turret-effects.test.mjs`, `tests/turret-effects.check.mjs`, `tests/turret-effects-visual.check.mjs`.

Simulation owns lifetimes, trajectories and collision outcomes. Rendering reads that state without scheduling events. Visibility and quality settings never change cadence, hits or active lifetimes. Disabling firing explicitly releases scheduler channels; pausing preserves effects. Restart/family changes clear simulation state and reuse GPU capacity. Leaving or replacing the workspace disposes resources.

## Source evidence and representative values

Research reviewed: `docs/turret-animation-research.md`, `docs/turret-animation-evidence.json`, installed `weapongenerator.lua`, `turretgenerator.lua`, and relevant shader/texture candidates. Asset filenames alone were not treated as evidence of native rendering use.

| Family | Base interval | Speed | Size/width | Reach | Additional source values |
| --- | --- | --- | --- | --- | --- |
| ChainGun | 0.1 s | 600 | 0.125 | 375 | HSV midpoint 35°, 0.7, 1 |
| Cannon | 2 s | 700 | 0.35 | 1300 | HSV midpoint 35°, 0.7, 1 |
| Laser | 0.2 s damage tick | continuous | width 0.5 | 600 | aura 1; animation speed 4 |

These are representative source midpoints, not universal final weapon statistics. ChainGun and Cannon simultaneous volleys multiply the base interval by weapon/muzzle count, matching the generator's weapon-count delay adjustment; alternating selection preserves aggregate base cadence. Multishot and demonstration bursts remain separate scheduler controls. Laser colors are generated deterministically within the source expressions using the appearance seed; no universal laser color is assumed.

`nativeDistance()` currently assumes an **unverified 1:1 mapping** from native distance to viewer native-coordinate units. This mapping applies consistently to projectile speed, size, range, beam width and aura. No claim that these are meters is made. Projectile lifetime is derived from reach/speed.

## Collision and playback behavior

Shots copy the firing muzzle's position and direction and then travel straight. The fixed simulation step preserves every scheduled event even across long rendering frames. Moving spherical demo targets use relative swept collision; the visible sphere matches the 0.75-radius collision proxy. Beams use the current muzzle direction and stop at the nearest valid target or articulated turret surface. They do not snap toward targets or flicker between damage ticks. Range/lifetime expiry produces no fabricated impact.

Block geometry is tested at each simulation step's pose, rather than continuously swept through rotational motion. Shot pose sampling is at 120 Hz; this is a bounded substep approximation. Target tracking has no predictive ballistic lead. Fallback muzzle estimation remains explicitly labeled when XML has no authored muzzle data. The standalone workspace has no parent ship combat scene. Its geometry collision covers the actual edited turret and demo target.

## Visual calibration and limitations

Source-confirmed numbers do not establish visual parity. No matched native gameplay recording was available for frame-by-frame comparison. Procedural projectile shape, flash duration/size/fade, trail, additive falloff, beam temporal modulation and impact particles remain unverified approximations. The Laser uses independent central, body and aura falloff in a dedicated shader; existing bloom may contribute if already enabled, but this feature does not enable global bloom.

Tune `CALIBRATION` for flash brightness/duration/expansion, streak length/opacity, beam core/aura intensity, physical/explosive duration, explosion radius, particle count and contact size. Tune source-derived profiles separately. Cannon explosion radius is provisionally 2 viewer-coordinate units: the native generator's damage-dependent radius cannot be resolved without a corresponding representative damage pipeline, which is outside this phase. Particle positions are seeded and derived from impact age, so quality changes preserve stable prefixes. Low quality draws 8 particles per impact; standard draws 24. GPU resources remain bounded/reusable while presentation is hidden and are disposed when the workspace closes.

## Verification recorded at this milestone

- Full automated suite: 294 passing tests (283 existing plus 11 focused effects tests).
- Focused tests cover frozen shot direction, timestamp travel, range/lifetime misses, swept hits and moving targets, nearest obstruction, impact categories/expiry, beam lifecycle/intersection, deterministic seeds, low-frame-rate multishot scheduling, pause/replay, presentation isolation, BVH reuse and pool overflow/disposal.
- Edge/SwiftShader integration validates all three families, shader compilation, visibility controls, pause/restart, pending families, existing pose/color editing, save/reopen and main-workspace isolation.
- Deterministic browser captures validate two muzzle hits for both ballistic families, two sustained laser contacts, replacement of an existing asset and cleanup. Local captures (not bundled): `test-results/turret-effects-visible-ChainGun.png`, `turret-effects-visible-Cannon.png`, `turret-effects-visible-Laser.png`.
- Static production build succeeds. Captures demonstrate renderer behavior; they are not native-appearance parity evidence.

## Follow-up proposed at this milestone

First obtain native recordings with known weapon statistics and verify distance/size conversion. Calibrate beam widths, flash curves and explosion radius/particles against those references. Then add source-specific projectile and straight-beam profiles using these foundations. Discrete rail beams, guided rockets, lightning arcs, repair/force layering and flak require their own explicit behavior extensions; none is silently represented by current effects.

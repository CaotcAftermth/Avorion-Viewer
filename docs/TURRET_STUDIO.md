# Turret Studio

Open a turret library asset and select Turret Properties. The editor uses an isolated workspace so editing and playback do not replace the main ship scene.

## Capabilities

- Pose controls, rotation-axis and muzzle guides, tracking targets and normal/coaxial behavior.
- Fixed-step playback, pause, restart, speed controls and deterministic seeking.
- Firing visuals for all 19 standard weapon families, including projectiles, continuous/discrete beams, rockets, electrical effects and repair/force layers.
- Resource and burst behavior based on representative source-derived weapon profiles.
- Cinematic cameras, automated sequences and per-asset appearance calibration.
- Local screenshot/video comparison, PNG stills, PNG sequence ZIP, GIF and feature-detected VP8 WebM export.

Model geometry and authored muzzle information remain separate from simulation and presentation settings. Where authored muzzle information is absent, fallback positions are estimates. Source XML is preserved.

## Fidelity and limits

Source assignments provide evidence for parameters such as cadence, speed, range, width and color. They do not prove that procedural rendering matches the game. Native visual parity has not been established with matched recordings and approved baselines.

Native distance/turning-speed unit conversion, random-stream equivalence, hidden engine defaults and parts of guidance/resource recovery remain unverified or approximate. Tracking targets are demonstrations, not a full combat scene. Audio, recoil, ship physics and native damage simulation are not implemented.

Animation exports are silent. WebM requires browser support for the requested WebCodecs VP8 configuration; MP4 is not supported. GIF has palette and timing limits. Resolution, duration and memory guards can reject large exports. See the [showcase/export report](turret-animation-phase4.md#export-support) for format limits and the [image export guide](IMAGE_EXPORT.md).

## Evidence and development history

[Source research](turret-animation-research.md) and [machine-readable evidence](turret-animation-evidence.json) distinguish inspected source facts from reconstruction choices. Keep those distinctions when changing defaults.

The following reports record implementation milestones. Their test counts, local capture paths and performance samples describe the original validation runs; they are not current test results or shipped reference assets.

1. [Tracking and scheduling](turret-studio-phase1.md).
2. [Initial projectile and beam effects](turret-animation-phase2.md).
3. [All-family effects and resources](turret-animation-phase3.md).
4. [Showcase, calibration and export](turret-animation-phase4.md).

Run `npm test` and `npm run build` for current automated checks. Browser checks and native-fixture comparisons have additional local prerequisites described in the reports. Passing these checks does not establish native visual parity.

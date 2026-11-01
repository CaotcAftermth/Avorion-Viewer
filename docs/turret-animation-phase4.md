# Turret Studio — Phase 4

Implemented October 29, 2026. Adds deterministic cinematic presentation, local reference comparison, reusable appearance calibration, and silent animation export to the existing Three.js workspace. Native visual parity remains unverified: no matched native gameplay recordings or approved screenshot baselines were supplied.

## Use

Open a turret asset and its Turret Properties editor. Existing family, target, firing, resource, coaxial and visibility controls remain available. Under **Showcase and timeline**, select a camera, enable Automated sequence if desired, then use Play / Resume. Sequence phase settings allow changing each phase's camera, start fraction, tracking, firing and target visibility. Fractions scale with total sequence duration; starts are sorted. Inspection always starts at zero.

Eight cameras: orbit, close-up, barrel-focus, tracking-view, firing-profile, projectile-follow, beam-showcase and hero-shot. The sequence progresses through inspection, acquisition, tracking, firing, detail and closing, blending transitions. Camera field of view and distance scale control framing. Backgrounds include existing viewer, dark, neutral and solid; lighting includes existing, neutral, contrast and cinematic. These settings never change source weapon statistics.

Selecting Manual restores the view saved before cinematic mode. Dragging or wheeling in the viewport interrupts cinematic control and keeps the current pose for free inspection. Frame stepping uses 1/30 second; numeric seeking permits arbitrary times through 300 seconds, quantized to the existing 1/120-second simulation. Backward seeks rebuild pose, resource state, targets, beams, projectiles and impacts; reconstruction suppresses external firing/impact subscribers. Looping resets the sequence; restart pauses at zero. Playback speed affects interactive playback, not exported frame timestamps.

## Comparison and calibration

Expand **Development comparison and calibration**. Open a local screenshot or video; compare side by side or with adjustable overlay opacity. Reference video stays muted and is stepped by simulation time, offset and rate. Manual reference timestamp and step-seconds controls accommodate clips whose native frame rate is unknown. Camera yaw, pitch and scale assist alignment. Two clicks on the live capture report pixel separation and sampled RGB. This is a development aid, not automated photometric matching or a native-fidelity score.

Calibration JSON version 1 contains `families`, with optional `Default` and canonical weapon identifiers. Each family contains `flash`, `projectile`, `beam`, `impact`, `lightning`, and/or `swirl` component objects. Populate selected family defaults to obtain an editable example. Import validates into the text field; Apply installs it. Reset removes all asset overrides. Export writes reusable JSON. Profiles persist in the asset's simulation settings, separate from native XML and source-derived profile data.

All overrides are finite, bounded, recognized appearance parameters. Source cadence, size, colors, width, range, turn factors and resource formulas remain separately defined. Flash brightness/duration, trail presentation, beam glow, impact particles/fade, electrical displacement and swirl reconstruction are calibration data. Guidance and resource restart approximations remain explicit mechanical approximations rather than appearance overrides.

## Export support

| Output | Validated implementation | Limitations |
| --- | --- | --- |
| PNG still | Existing tiled image pipeline, weapon effects included | RGBA; resolution subject to browser allocation and postprocessing tile budget |
| PNG sequence ZIP | Ordered `frame-000000.png` names plus `showcase.json` | Full alpha; PNGs already compressed, ZIP stores them without recompression |
| Animated GIF | Existing palette/LZW encoder, variable centisecond delays and optional loop extension | 256-color palette, binary transparency, centisecond timing; at most 1280 pixels per side and 120 million frame-pixels |
| WebM | Feature-detected WebCodecs VP8 encoder and local EBML muxer | No alpha or audio; supported only when runtime accepts VP8 configuration |
| MP4 | Not implemented | Select WebM, GIF or PNG sequence |

UI resolutions: 720p, 1080p, 1440p, 4K and custom dimensions (16–4096 pixels each). Rates: 24/30/60 fps. Maximum animation duration: 60 seconds. Quick preview, full showcase, transparent sequence and high-resolution still presets are available. If VP8 is unavailable the exporter explains the GIF/PNG alternatives; it never silently substitutes a format.

Each frame evaluates simulation at `start + frame / fps`, independent of wall-clock rendering speed. Export uses an isolated runtime and cloned camera/settings while sharing immutable model geometry and the existing GPU renderer. The interactive runtime pauses and resumes its prior playing state. Completion, errors and cancellation release temporary canvases, framebuffers, encoders and runtime state. The render lock prevents concurrent GPU capture conflicts.

Raw animation frames never accumulate: one frame is rendered, encoded, then released. Encoded output is capped at 256 MiB. The image pipeline estimates memory and bounds tile allocation; showcase frames above four million pixels use a 2048 MiB estimate budget, smaller frames 768 MiB. These are allocation guards, not promises of physical memory usage. Very close cameras with large world-space AO kernels can still exceed safe tile padding; use a wider camera or reduce AO in existing viewer settings. Long/high-resolution exports can be slow on software rendering and can hit the output cap. Metadata records seed, canonical family, configuration, camera, dimensions, fps, frame count and application version; design identifier excludes directory components. No source file path is embedded.

## Fidelity audit

Evidence remains in `turret-animation-research.md`, `turret-animation-evidence.json`, generated `weapon-profiles.js` and `effect-profiles.js`, including generator line references. Phase 4 inspected the existing profile/rendering chain and captured all 19 families with fixed seed, camera, viewport and simulation timestamp. Captures establish functionality and a review starting point, not approved native baselines.

Classification: **Source-confirmed** = explicit inspected Lua assignments; **Source-derived** = deterministic reconstruction from those assignments; **Approximate** = viewer procedural rendering/calibration; **Unverified** = missing native evidence. **Reference-calibrated** applies to none yet.

| Property group | Classification and audit result |
| --- | --- |
| Explicit speed, range, projectile size, color formulas, beam width/aura/shape, animation arguments | Source-confirmed where assigned; omitted engine defaults remain Unverified |
| Cadence, muzzle sequencing, simultaneous flags, multi-shot, burst/resource relationships | Source-derived representative generation; exact native random stream and hidden engine defaults Unverified |
| Shot origins/directions, rotated muzzle hierarchy, coaxial restriction | Source-derived; authored geometry preserved, fallback muzzle positions labeled estimated |
| Projectile mesh geometry, apparent scale, brightness, emissivity, alpha, trails | Approximate; source size/color assignments do not prove apparent native appearance |
| Beam core/body/aura composition, glow falloff, procedural texture, endpoint contacts, discrete visibility duration | Approximate; source width/aura/color arguments retained separately |
| Lightning density/displacement, temporal noise, width variation; swirl geometry/composition | Approximate; native branching Unverified and not synthesized as a fidelity claim |
| Flash timing/shape, activation presentation, impact particle density/expansion/fade | Approximate; scheduler activation/deactivation is Source-derived |
| Projectile orientation and travel; continuous versus discrete lifecycle | Source-derived; seeker steering law and acceleration Unverified/Approximate |
| Explosion triggering and flak timed death | Source-derived; flak radius assignment Source-confirmed; procedural visuals Approximate |
| World-unit mapping, postprocessing exposure, native attenuation, camera/exposure matching | Unverified |

| Family | Source-backed distinction | Procedural/native gap |
| --- | --- | --- |
| ChainGun | Fast ballistic cadence, size/speed/color ranges | Streak, flash, trail and physical impact Approximate |
| PointDefenseChainGun | Higher projectile velocity and turn factor | Same ballistic gaps; native engine defaults Unverified |
| Bolter | Ballistic size/speed, heat relationships | Physical projectile and impact presentation Approximate |
| Cannon | Larger ballistic shot, heat and explosive behavior | Explosion profile, particles and expansion Approximate |
| PlasmaGun | Energy projectile ranges/colors and charge behavior | Animated plasma halo and energy impact Approximate |
| PulseCannon | Fast energy projectile and pulse ranges | Pulse streak/brightness/fade Approximate |
| RocketLauncher | Non-emissive rocket, seeker generation flag, source speed and firing-count draws | Mesh, exhaust and seeker steering Approximate |
| AntiFighter | Timed death, death explosion, radius 35 | Dust expansion and particle presentation Approximate |
| Laser | Continuous straight beam, source width/aura and charge behavior | Procedural texture, glow and contact Approximate |
| PointDefenseLaser | Continuous beam and higher tracking factor | Procedural beam presentation Approximate |
| MiningLaser | Material-derived half-strength color/alpha, range 75 | Low-contrast beam against bright backgrounds; native appearance Unverified |
| RawMiningLaser | Raw variant range 150 | Same material-beam calibration gap |
| SalvagingLaser | Material-derived beam, range 75 | Same material-beam calibration gap |
| RawSalvagingLaser | Raw variant range 150 | Same material-beam calibration gap |
| RailGun | Discrete straight beam, color branches and animation arguments | Visibility lifetime/fade and contact Approximate |
| LightningGun | Discrete electrical shape and shape-size argument | Noise/branching/lifetime native behavior Unverified; current path Approximate |
| TeslaGun | Continuous electrical shape and animation arguments | Electrical noise/glow Approximate |
| RepairBeam | Shield/hull/dual colors, swirl argument and local X offsets | Swirl reconstruction, blend and contact Approximate |
| ForceGun | Primary straight plus secondary swirl layer | Layer geometry/glow reconstruction Approximate |

No source parameters were inflated to make showcase effects more dramatic. Improvements are centralized per-component appearance controls, repeatable comparison, proper effect inclusion in still/animation exports, and deterministic cinematic inspection. Matching native footage remains necessary before tuning defaults or claiming parity.

## Optional future event adapter

No adapter is installed. `studio.subscribe(listener)` returns an unsubscribe function. Events carry simulation seconds in `time`. `start`/`stop` delimit a firing channel; `activate`/`deactivate` delimit continuous effects; `shot` identifies `channel`, muzzle index, shot index and transformed `muzzleFrame`; `tick` is a continuous damage tick, not a separate loop start. `projectileImpact` carries impact position/kind/seed; `projectileExpired` carries projectile id, position and reason. `weaponOverheated`/`weaponRecovered` mark resource transitions. `timelineSeek` and `timelineReset` invalidate any adapter scheduling.

A future adapter can map these semantic events to optional sounds, pair continuous loops by channel, use muzzle/impact positions for spatialization, and read `clock.time`, `clock.playing` and `settings.speed` for synchronization. It must stop loops on pause/dispose/seek/reset, avoid duplicate continuous starts, own its volume policy and explicitly opt into any future export mixing. Seek reconstruction emits only the final timeline notification to subscribers, not replayed shot/impact events; offline exports have no subscribers. There is no AudioContext, audio asset, playback adapter, volume UI or exported audio track. Local reference video is muted.

## Validation and performance

Commands: `npm test` (334 passing), `npm run build` (passing), `node tests/turret-phase4.check.mjs`, `node tests/turret-phase4-decode.check.mjs`, `node tests/turret-phase3.check.mjs`, `node tests/turret-phase3-native.check.mjs`, `node tests/turret-phase3-performance.check.mjs`. Browser scripts use installed Edge with software WebGL and route workspace files locally; they do not depend on the development server. The native fixture is the existing 250-block, three-muzzle custom XML.

Validated: deterministic seeking for all 19 families; camera restore and manual interruption; conditional controls and family switching; native XML preservation; calibration validation/source separation; exports with effects; 1080p RGBA min/max alpha 0/255; ordered PNG ZIP manifests; decoded six-frame GIF totaling 250 ms; decoded 320×180 WebM with 250 ms duration and successful seek; cancellation and viewer-state restoration; custom ChainGun/Laser/RailGun/RocketLauncher moving-target cinematic sequences; fixed coaxial pose; 3840x2160 PNG decoding.

Representative software-rendering export timings: cold 1080p PNG ~11.8 s; six 320×180 frames ~0.42 s GIF, ~0.75 s PNG ZIP, ~0.97 s VP8 WebM. A 4K cinematic still completed in ~66 s on software rendering. These are local diagnostic samples, not hardware performance guarantees. Eight-muzzle/four-shot stress cases cover rapid projectiles, explosive impacts, beams, lightning, force and rocket trails: no visual-pool overflow; peak 288 rockets. All-family GPU cycles stabilize at four geometries, three shader programs, zero textures; disposal returns geometries/programs to zero. Existing pools and per-frame resource release remain in place.

Edge is the validated encoding runtime. Other browsers and desktop shells are unverified; VP8 is runtime-detected. Captures in `test-results/phase3-*.png` and `phase4-family-contact.png` are candidate regression references, not approved baselines. Hardware-independent native screenshot comparison remains future work.

## Files and follow-up

Added: `calibration.js`, `showcase.js`, `showcase-ui.js`, `comparison.js`, `showcase-export.js`, `webm.js` under `src/turrets`; Phase 4 unit/browser/decode tests and local route helper; this report.

Modified: turret studio, effect profiles/simulation/renderer/beam shaders, app workspace API, viewport manual interruption, shared renderer, existing image pipeline, GIF loop support, and two existing browser checks to use local routing. Geometry importers, XML formats, ship physics and recoil are unchanged.

Next useful refinements: matched native clips with exact weapon configuration and exposure; approved per-family image baselines with perceptual tolerances; better adaptive framing for unusual moving geometry and very long beam trails; optional streaming-to-disk output beyond the encoded-memory cap; verified additional browser/desktop encoders. Current framing is conservative bounds-based framing, not collision-aware cinematic path planning. Following the oldest live projectile can change target when that projectile expires. Native damage/combat and audio remain outside this phase.

# Avorion turret animation reconstruction

Research date: October 28, 2026. This is a source-based reconstruction specification, not an implemented animation system or a claim of visual parity.

The installed scripts specify all 19 standard weapon families, their appearance parameters, firing cadence, cooling, and turn-speed generation. They do not expose the complete renderer, barrel recoil curves, muzzle flash envelopes, or beam geometry algorithms. Faithful reconstruction requires preserving the scripted parameters and measuring the remaining native behavior in game.

## Evidence and scope

Source root: `C:/Program Files (x86)/Steam/steamapps/common/Avorion`.

- `data/scripts/lib/weapongenerator.lua` (W below): weapon effects and base statistics.
- `data/scripts/lib/turretgenerator.lua` (T below): barrels, scaling, firing specialties, and cooling.
- `data/scripts/lib/weapontype.lua`: the 19 registered standard types.
- `data/scripts/weaponsounds/*.lua`: 23 sound profiles, including extra named profiles that do not establish additional standard weapon families.
- `Documentation/{Weapon,Turret,TurretTemplate,TurretDesign,TurretDesignPart,Enums}.html`: native API surface. Many fields have signatures but no behavioral explanation.
- `data/shaders/turret.vert`: three incoming part transforms; it does not compute an animation curve. `weapon.frag` handles lit solid weapon surfaces, not projectile animation.

[Machine-readable evidence](turret-animation-evidence.json) preserves line-numbered expressions, conditional context, shared rules, sound definitions, cross-file mutation hits, and SHA-256 source hashes. A static pattern scan covered 648 Lua files, finding 28 files with additional relevant assignments (including some non-turret objects). This is a search inventory, not a claim that every line of all 648 scripts was manually reviewed. Rebuild it with `node scripts/audit-turret-animation-sources.mjs`, optionally passing another installation root.

## Standard effect catalog

These are **base generator values**, before turret scaling and specialties. Delays are seconds; sizes, ranges, and speeds are raw game values. Do not silently map game coordinates to Blender meters. The evidence retains exact color expressions and branch conditions. A missing field means the Lua leaves it to the native object default, not zero.

| Family | Visual and temporal behavior | Base parameters | Source |
| --- | --- | --- | --- |
| Chaingun | Projectile stream; physical impacts | delay .08–.12; velocity 500–700; size .05–.2; reach 300–450 | W:614 |
| Point defense cannon | Faster projectile stream; physical impacts | delay .075–.1; velocity 1000–1100; size .05–.2; reach 700–750 | W:665 |
| Bolter | Larger projectile stream; physical impacts | delay .1–.3; velocity 800–1000; size .15–.25; reach 650–700 | W:9 |
| Plasma | Explicit `ProjectileShape.Plasma`; energy impacts | delay .15–.2; velocity 500–700; size .4–.8; reach 550–800 | W:703 |
| Pulse cannon | Projectile, not a continuous beam; energy impacts | delay .05–.2; velocity 700–800; size .08–.3; reach 450–750 | W:524 |
| Cannon | Projectile with impact explosion | delay 1.5–2.5; velocity 600–800; size .2–.5; reach 1100–1500 | W:797 |
| Rocket launcher | Explicit rocket shape; impact explosion; 1/8 base seeker chance | delay .5–1.5; velocity 150–200; size .2–.4; reach 1300–1800 | W:744 |
| Anti-fighter | Timed projectile death and dust explosion | delay 2–2.5; velocity 300–400; size .3; reach 300–350; explosion radius 35 | W:569 |
| Laser | Continuous straight beam | damage interval .2; reach 450–750; width .5; aura 1; animation speed 4 | W:337 |
| Point defense laser | Continuous straight beam | interval .2; reach 500–600; width .5; aura 1; speed 4 | W:300 |
| Mining laser | Continuous straight beam, material-dependent inner color | interval .2; reach 75; width .5; aura 1; speed 4 | W:57 |
| Raw mining laser | Continuous straight beam, distinct sound | interval .2; reach 150; width .5; aura 1; speed 4 | W:126 |
| Salvaging laser | Continuous straight beam, material-dependent inner color | interval .2; reach 75; width .5; aura 1; speed 4 | W:91 |
| Raw salvaging laser | Continuous straight beam, distinct sound | interval .2; reach 150; width .5; aura 1; speed 4 | W:163 |
| Railgun | Discrete straight beam shot, not a traveling projectile | delay 1–2.5; reach 950–1400; width .5; aura 3; speed 1; acceleration -2 | W:421 |
| Lightning gun | Discrete lightning beam | delay 1–2.5; reach 950–1400; width .5; aura 3; shape size 13; speed and acceleration 0 | W:200 |
| Tesla gun | Continuous lightning beam | interval .2; reach 250–350; width .5; aura 1; shape size 5; speed 4 | W:252 |
| Repair beam | Continuous `Swirly` beam; blue shield repair or green/white hull repair | interval .2; reach 200–300; width .5; aura 1; shape size 2; speed 4 | W:378 |
| Force gun | Continuous straight beam plus extra swirling layer | interval .2; reach 450–550; width 2; aura 1; speed 4; extra layer shape size 1.25 | W:475, T:1867 |

Most ballistic projectile colors use HSV hue 10–60, saturation .7, value 1. Pulse hue is 180–290; plasma hue is 0–360. Ordinary laser/Tesla colors are generated from a random hue with separate inner/outer saturation and brightness. Railgun colors choose warm or blue ranges; lightning uses blue ranges. Preserve generated per-weapon colors rather than assigning a single fixed color to each family.

Force generation assigns animation speed 1 and then overwrites it with 4. Use the final assignment. T:1889 onward duplicates each force weapon, clears its forces, makes its **weapon appearance** invisible, and gives its beam a swirly shape. Invisible appearance does not mean the beam should disappear.

Repair generation has a 12.5% branch that adds both repair modes at local X offsets ±.1 (before later scaling). A single green repair beam cannot represent that variant (T:1707).

## Firing schedule and lifecycle

Do not use one global firing animation for every type. Separate weapon statistics, part pose, shot events, continuous effects, impacts, and audio.

1. Preserve final resolved weapon instances. Many projectile turrets multiply each weapon's delay by the generated weapon count before attachment. Ordinary alternating barrels and simultaneous firing are different modes. Native phase order and first-shot timing still require observation.
2. Preserve `shotsFired` separately from barrel count. Chaingun, bolter, and rockets have a 5% multi-shot branch selecting from `{2,2,2,2,2,3,4}`. This does not prove a timed burst between those shots.
3. Continuous beams remain visually active across their .2-second damage intervals. Do not blink them off between ticks. Discrete railgun/lightning beams need native lifetime/fade measurements; `fireDelay` is not their visible lifetime.
4. Projectiles begin with lifetime `reach / velocity`. Later Lua mutates reach and velocity without always explicitly updating lifetime. Some story scripts explicitly recalculate it. Native property coupling is unresolved: capture final serialized values instead of assuming a setter recalculates related fields.
5. Apply impact, impact explosion, timed death, and death explosion as separate conditions. Anti-fighter flak is not simply a cannon with a different color. Cannon/rocket base explosion radius is `sqrt(damage * 5)` at its assignment point.

Simultaneous-shooting probabilities in T:463–543: Tesla/lightning .15; plasma/chaingun/railgun/pulse .25; cannon/rocket .5. Other types start with probability zero in this function. Use an existing turret's actual flag instead of rerolling it.

`BurstFire` and `BurstFireEnergy` (T:670–716) increase aggregate fire rate by a random factor 2–3 with a minimum of 6, distribute it across the weapons, and configure a one-second shooting period. HighFireRate, HighShootingTime, and LessEnergyConsumption also change the timeline. Do not apply a fixed arbitrary three-shot burst.

Rocket generation has a subtle source quirk: the random count used to multiply delay and the later one/two-position selection are separate draws (T:1548–1566). Preserve the actual weapon list and final delay instead of assuming they match.

## Cooling and energy

T:192–229 defines these equations:

```text
Standard:
  maxHeat = 10
  coolingRate = maxHeat / coolingTime
  heatingRate = maxHeat / shootingTime + coolingRate
  heatPerShot = heatingRate / firingsPerSecond

BatteryCharge:
  maxCharge = dps > 0 ? dps * 10 : 5
  rechargeRate = maxCharge / rechargeTime
  consumptionRate = maxCharge / shootingTime + rechargeRate
  consumptionPerShot = consumptionRate / firingsPerSecond
```

The battery case stores these values in `maxHeat`, `heatPerShot`, and `coolingRate` too. CoolingType determines interpretation. Threshold behavior and restart hysteresis remain native details to measure.

| Family | Nominal shooting / recovery seconds | Mode |
| --- | --- | --- |
| Bolter | 7 × random(.9,1.3) / 5 × random(.8,1.2) | Standard |
| Cannon | 25 / 15 | Standard |
| Railgun | 27.5 / 10 | Standard |
| Rocket | 20 / 15 | Standard |
| Pulse | 15 × random(1,1.5) / 5 × random(1,1.5) | Standard |
| Laser | 20 / 30 | BatteryCharge |
| Plasma, Tesla, lightning | 15 / 20 | BatteryCharge |
| Repair | 10 / 15 | BatteryCharge |

Except where explicit multipliers are shown, each nominal time above is independently multiplied by random(.8,1.2). The other standard generators do not call these cooling constructors; this does not establish all native default behavior.

## Aiming, part transforms, and recoil

T:231–310 sets:

```text
turningSpeed = lerp(size, .5, 3, 1, .5) * random(.8,1.2) * familyFactor
```

Family factors: chaingun 1; point defense cannon/laser 2; bolter/plasma .7; laser .75; mining/salvaging including raw .8; rocket .6; cannon/railgun/lightning/Tesla .5; repair 1; force 2; pulse .8; anti-fighter 1.2. The inspected API signature does not explain angular units or interpolation; verify these before mapping into the viewer's degree-based pose fields. Coaxial behavior must be distinguished from normal tracking; the generator can choose coaxial at five or more slots, but excludes it for mining/salvaging types.

The viewer already has base/body/barrel transforms and native muzzle coordinates in `src/turrets/core.js`. Its hierarchy is mount, mount × yaw, mount × yaw × pitch. Native pitch sign and authored pivots must be preserved. Apply time-varying pose to these existing transforms; do not rebuild block meshes each frame. `src/turrets/render.js` currently updates matrices during its scene/revision-driven rebuild, so animated matrices need a separate per-frame update path.

Use transformed muzzle coordinates for every shot and beam origin, including underside and angled mounts. Visual design geometry and weapon statistics are separate: an imported turret design does not by itself identify a complete generated weapon loadout.

Lua assigns recoil proportional to damage: bolter 16; lightning 5; railgun 20; pulse 10; anti-fighter 75; chaingun 20; point defense cannon 10; plasma 4; rocket 2; cannon 20. Mining and salvaging variants explicitly set zero. These are **recoil property assignments, not measured barrel travel distances or animation amplitudes**. Later scaling can change damage without a corresponding explicit recoil assignment. Do not translate these numbers directly into Blender keyframe displacement or recompute them from final damage without evidence.

No reviewed script supplied mechanical barrel extension/retraction curves, rotary barrel spin-up, return springs, idle motion, or muzzle-flash duration. The three matrices in the vertex shader are supplied externally. The `getMoveBarrels` API name alone does not establish an animation channel. Native-code investigation or controlled in-game capture is needed for these details.

## Audio and special variants

The evidence includes every weaponsounds file, preserving clip choices, volumes, ranges, and optional loop definitions. Laser, point defense laser, mining/salvaging/raw variants, Tesla, and repair have initial clips plus a loop. Their initial profile uses range 150 and volume .15; the loop uses range 300 and volume 1. Force has initial clips but no explicit loop in its profile. Do not add a loop simply because its beam is continuous. Exact start/stop/fade behavior is not specified there.

Additional named sound profiles include emperor, ion-cannon, party-trumpet, and thunder. Sound filenames alone are insufficient to infer their full weapon behavior.

Special scripted examples include:

- Behemoth railgun (`sector/background/spawnbehemoth.lua:213`): reach and beam length 8000, width 4, aura 8, size 8, turning speed .25, and delay jitter .85–1.15.
- AI/corrupted AI (`player/events/spawnbigai.lua:191`, `spawnbigaicorrupted.lua:191`): altered rate, material-colored projectiles, beam lengths 1500/2500, warm beam colors, turning speed 2.
- World bosses: several set turning speed 6 and replace projectile/beam colors. Examples include blue ancient sentinel, green chemical accident, and red cult ship effects.
- Scientist (`lib/story/scientist.lua:96`): beam width zero with a comment about avoiding shooting through blocks. A blanket positive-width clamp would discard this source behavior.
- Rift objects (`dlc/rift/lib/riftobjects.lua:143`): turning speed 2 and an explicit zero-recoil override.

The override inventory is intentionally broader than turrets: torpedo and fighter fields must not be imported into turret motion accidentally. Native-only, modded, or unobserved unique weapons are not certified covered by the 19-family catalog.

## Implementation and fidelity acceptance

Recommended implementation sequence:

1. Capture a resolved weapon/turret profile, with its generated values, seed, design, muzzle positions, and native defaults. Keep appearance, projectile/beam shape, and damage type distinct.
2. Add a deterministic simulation clock with per-weapon schedules and events. Derive continuous-effect activation from firing state, not damage ticks. Keep geometry shared while updating part matrices independently.
3. Implement straight, lightning, and swirly beam renderers, projectile families, and impact events. Reuse verified local assets where appropriate. `data/textures/beam.png` is a candidate asset, but filename presence alone does not prove its native binding or blend mode.
4. Add cooling/energy gating, simultaneous firing, multi-shot, and burst specialties from resolved fields. Couple sound starts/loops/stops to the same lifecycle.
5. Calibrate native-only behavior against captures before labeling the result faithful.

Capture protocol: use a stationary ship and target, fixed camera/exposure, known distance and turret profile; record at a known frame rate. Test each standard family plus dual repair, force overlay, seeker, burst, multi-shot, simultaneous/alternating barrels, and coaxial mounts. Record initial trigger, sustained fire, release, cooling, restart, hit, and miss. Repeat with different turret sizes and moving targets. Measure yaw/pitch speed, first-shot and barrel phases, travel time, beam persistence, brightness/fade, muzzle flash, recoil, explosion lifetime, and audio transitions. Compare frame-aligned crops with identical camera and scale, and document tolerances before claiming parity.

Current confidence: high for the quoted Lua assignments and catalog coverage; incomplete for native defaults, RNG equivalence, scheduler details, world-unit conversion, shader bindings, mechanical recoil, and exact visual curves. No in-game capture or native disassembly was performed in this research pass. The saved evidence makes those gaps explicit and preserves the findings for implementation.

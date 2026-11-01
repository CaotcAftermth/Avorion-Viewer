# Avorion skybox reverse engineering

Investigated October 1, 2026. Source: the supplied `AvorionGame.zip`, its Lua/GLSL files, and native machine code from the matching installed `bin/Avorion.exe`. The installed executable was checked against the archive executable and has SHA-256 `0f3749b75dbae3e0fcbdca3173c6f6ecb68d203cc6764bb94d6b868a46c8ae4b`.

## What produces the sky

Avorion composes sky images procedurally into cubemaps. The colored nebulae are grayscale image stamps tinted and layered by shaders. The star field combines generated geometry, sector-dependent placement, star colors, and noise. Planets and the sun are additional rendered components. Fog affects the final scene separately. Rift sectors add another rendering path.

The archive does not provide the original C++ implementation. This report reconstructs behavior from native disassembly and original Lua/GLSL. Addresses below are executable RVAs, not file offsets; the executable image base is `0x400000`. Descriptive function names below are assigned from behavior unless a native diagnostic identifies them.

This is a detailed reconstruction, **not a pixel-identical renderer validated against the running game**. The final section lists the parts that remain unresolved. In particular, do not mistake the 23 predefined palettes for the only possible skies.

## Evidence and recovered files

All supporting material is in `test-results/skybox-audit/`:

- `renderer.asm`, `core.asm`, and `fn-*.asm`: annotated disassembly of generation and rendering.
- `seed-config.asm`, `defaults-state.asm`, `details.asm`, `geometry.asm`, `caller-context.asm`, and `sector-generation.asm`: seed, defaults, RNG, blending, and caller evidence.
- `native.py`: repeatable read-only executable inspection utility, using Capstone and pefile from `test-results/native-tools/`.
- `presets.json`: all 23 recovered presets, including exact float32 values.
- `recover_presets.py`: interprets the initializer's literal stores and color-constructor calls; it does not execute game code.
- `seed_probe.py`: reconstructed seed, initial procedural HSV, and conditional preset selector.
- `texture-contact-sheet.png`, `preset-palettes.png`, and `texture-metadata.json`.
- `data/shaders/`: extracted original sky shaders. Additional `noise.frag`, `stars.vert`, and `stars.frag` are under `AvorionGame/data/shaders/`.
- `AvorionGame/data/scripts/sectorspecifics.lua`: original sector input generation.

## 1. Sector inputs and deterministic randomness

The native sky specification routine at `0x19bcc0` receives sector data, a planet-enable flag, a preset-enable flag, and an optional dust override. Relevant sector data fields are:

| Offset | Meaning | Evidence |
|---|---|---|
| `+0x00`, `+0x04` | Integer sector coordinates x, y | Seed hash and coordinate-copy functions |
| `+0x10` | Numeric 64-bit server seed | Sector construction at `0xcedbe0` |
| `+0x40` | Dust level | Native Lua field lookup explicitly says `dustyness` |
| `+0x6a` | Rift flag | Native Lua field lookup explicitly says `inRift` |
| `+0x70..+0x78` | Planet specification vector | Native `generatePlanets` lookup and renderer iteration |

### Sky seed

`0xceb060` starts a hash at zero, then feeds x as four little-endian bytes, y as four little-endian bytes, and `(serverSeed + 1)` as eight little-endian bytes. The helper at `0x1007010` processes these calls byte by byte, with **signed** byte extension:

```python
h = 0
for b in pack_le_i32(x) + pack_le_i32(y) + pack_le_u64(server_seed + 1):
    signed_byte = b if b < 128 else b - 256
    h = (h ^ (h << 5) ^ signed_byte) & 0xffffffffffffffff
```

The `+1`, signed bytes, wrapping, byte order, and separate byte widths are required. A generic string hash of coordinates will not match. The displayed world-seed string is not necessarily the numeric server-seed value; that string conversion was not reconstructed here.

The random engine is MT19937-64: 312 64-bit state words, initialization multiplier `6364136223846793005`, and the matching twist/temper constants. Evidence: `0x108ee30`, `0x1820ee0`.

The native integer helper uses the low **32** bits of its next 64-bit output, modulo the inclusive range size. For preset selection this is:

```python
preset_index = (MT19937_64(sky_seed).next() & 0xffffffff) % 23
```

The float helper at `0x108f3f0` also uses the low 32 bits, takes `% 1000000`, and divides by `1000000.0` in float32. It then interpolates the bounds with the observed float32/double conversion order. It is not a standard-library uniform real distribution. Its upper bound is excluded.

`getDirection` at `0x108f9f0` draws three components in `[-1,1)`, normalizes the cube sample, and writes them in reverse draw order. This is not uniform sphere sampling. Substituting a mathematically uniform sphere sampler would change the game's result.

### Procedural specifications

The constructor first draws H, hue variation, S, and V in that order. It converts `HSV(H,S,V)` to the base/fog color and first nebula color, and `HSV(H + variation,S,V)` to the second nebula color. It subsequently draws light strength, chooses a star color, generates a direction, creates a separate rendering seed, and draws cloud counts/intensities.

Defaults from native configuration construction at `0x15f70`:

| Setting | Default |
|---|---:|
| BackgroundResolutionFactor / PlanetResolutionFactor | 1 / 1 |
| BackgroundMinHue / MaxHue | 0 / 360 |
| BackgroundMinSaturation / MaxSaturation | 0.4 / 0.9 |
| BackgroundMinValue / MaxValue | 0.65 / 1.0 |
| BackgroundHueVariation | 60 degrees |
| BackgroundMinNebulasPerType / Max | 10 / 14 |
| BackgroundMinNebulaIntensity / Max | 0.08 / 0.2 |
| BackgroundMinDarkNebulasPerType / Max | 3 / 6 |
| LightMinValue / LightMaxValue | 0.85 / 1.25 |
| LightAmbient | 0.13 |
| Highlight intensity draw | 0.5 to 1.5 |

These are defaults, not a claim that every installation uses them. The configuration loader at `0x1a2b0` can override the corresponding `Background.*`, `Lighting.*`, and `Fog.*` keys.

### The 23 presets are conditional

The table initializer at `0x195bc0` constructs exactly 23 records of 120 bytes each. It includes red/orange, green, cyan, blue, and purple palettes, sunlight RGB, dust levels 0–3, bright/dark cloud counts, and highlight/intensity values. All records are exported in `presets.json`.

The branch at `0x19c0d8` requires both the caller's preset-enable flag and a zero renderer field at `+0x128`. It reseeds a fresh RNG from the same sector hash before selecting the preset. Thus preset choice does not depend on earlier HSV RNG consumption.

The preset overrides several previously randomized specification fields, including colors and dust. A later explicit dust override can replace the preset's dust. The main callers inspected derive the preset-enable flag from coordinate equality; the semantic identity of the compared player coordinate has not been conclusively named. **Do not apply these 23 presets to every sector.**

## 2. Dust, planets, and special sectors

Sky rendering is native, but some of its inputs are Lua-generated. `sectorspecifics.lua:103` computes a third fast hash using:

```lua
makeFastHash(x * 961748941 + 49979687,
             y * 982451653 + 553105243,
             serverSeed.int32)
```

Its remainder modulo 26 selects dust: 0 for remainders 0–15, 1 for 16–21, 2 for 22–24, and 3 for 25. Those are weights 16:6:3:1; they are not a distance-based dust gradient. Subsequent sector rules, presets, and explicit overrides still matter.

Native dust application at `0x198980` sets fog and related nebula parameters:

| Dust | Max fog | Fog strength | Fog alpha | Fog nebula count |
|---|---:|---:|---:|---:|
| 0 | 0 | 0 | 0 | 1 |
| 1 | 0.8 | 0.0005 | 0.15 | 3 |
| 2 | 0.9 | 0.002 | 0.3 | 5 |
| 3 | 0.95 | 0.005 | 0.4 | 10 |

The fog RGB is derived from the base color and the packed alpha. These fog nebula counts are separate from background billboard counts. Scripts can further override the result: `sector/worldbosses/chemicalaccident.lua` sets yellow fog, color factor 1.5, and density 3.

Planets use another deterministic stream: `SectorSeed(x, y + 2, serverSeed)` (`sectorspecifics.lua:312`). At `(0,0)`, Lua always creates a black hole. Otherwise it tests a 0.6 probability to create a primary planet. Planet type, atmosphere, clouds, inhabited status, ring/moon choice, size, and position are generated there. Position uses a random direction with distance from `0.7 * size` to `2 * size`. Native rendering has separate planet implementations; a planet is not part of a static nebula image.

## 3. Cubemap generation and pass order

The allocation routine at `0x1a2dd0` creates the main RGBA cubemap with face size:

```text
truncate(2048 * Background.BackgroundResolutionFactor)
```

It also allocates cubemaps with face sizes 512, 2, and 32. These are auxiliary products; their allocation and use are confirmed, but this report does not assign an unverified reflection/irradiance role to each one.

`SkyboxRenderer::initialize` is identified by the executable's diagnostic string at `0x1a2820`. It prepares meshes and invokes four generation stages. The main background stage at `0x1a1ec0` does the following:

1. Clear the main cubemap to black; prepare two deterministic RNG streams from the stored render seed.
2. For dust 0 or 1, draw an initial dense point-star field.
3. Apply `darkenstarfield.frag` to the existing cubemap.
4. Add bright nebula billboards with `nebula.frag`.
5. Add the multi-octave `starnoise.frag` contribution.
6. Multiply in dark nebula billboards with `darknebula.frag`.
7. Draw two more point-star batches, then a batch of larger textured stars.
8. For rift sectors, apply two additional dark-nebula passes and another point-star batch.
9. Render the additional prepared background objects; later initialization stages build auxiliary cubemaps.

The stamp and noise passes render all six faces using the same generated world geometry. Independently randomizing each face would introduce discontinuities and produce the wrong sky.

### Nebula stamps and blending

`bg0.png` through `bg9.png` are 1024×1024 grayscale-looking RGB cloud textures, not complete sky faces. See `texture-contact-sheet.png`.

Bright-cloud generation at `0x19deb0` builds ten geometry buffers. Each has four vertices per cloud. It creates indices 0–8, shuffles them by repeated swaps with a random index from the full nine-element range, keeps either three or four, and **always appends index 9**. Thus each bright pass uses four or five texture types, including `bg9.png`.

Dark-cloud generation at `0x19cdb0` uses all ten texture types, with the configured dark-cloud count per type. The native renderer sets blend mode 7 for this pass. The jump table resolves this to `GL_DST_COLOR, GL_ONE_MINUS_SRC_ALPHA`. Because the shader outputs alpha 1, the resulting RGB operation is multiplication.

Bright-cloud and star passes set blend mode 1, which resolves to `GL_ONE, GL_ONE` for RGB and preserves destination alpha through separate alpha factors. This is additive RGB blending. Ordinary alpha-over compositing will not reproduce the background.

### Exact shader math

For the bright nebula, T is the sampled RGB texture, C is interpolated vertex RGB, A is vertex alpha, and h is `highlightIntensity`:

```text
H = mix(C, white, 0.75) * h
output.rgb = A * (T*C + 0.75*T^2*H + 0.75*T^8*H + 0.5*T^16*H)
output.a = 1
```

The dark nebula fragment emits `1 - 1.5*T`, alpha 1, and is multiplied into the destination. Render-target clamping and format behavior remain relevant to the final pixels.

The initial star darkening uses 3D Perlin noise, not a sampled grayscale fog texture:

```text
b = clamp((noise(position*2.5 + 240) + 0.2) / 0.4, 0, 1)
output.rgb = starCube(position).rgb*b + 0.05*b*C
```

The star-noise pass uses nine octaves:

```text
p = position*5 + 240
n = sum(noise(p*2^k) / 2^k for k = 0..8)
n = (n*0.5 + 0.5) / 15.05
output.rgb = starCube(position).rgb + n*C + n/3
```

`noise.frag` implements classic gradient Perlin noise using a permutation texture, texel spacing `1/256`, half-texel offset `1/512`, and quintic interpolation `t^3*(t*(6*t-15)+10)`. A generic Blender Noise Texture will not reproduce this function or its permutation lookup.

The final `skybox.frag` samples the cubemap, scales RGB to 0–255, applies contrast 3 around 128, clamps, and divides by 255:

```text
factor = 259*(3+255) / (255*(259-3))
result = clamp(factor*(sample*255-128)+128, 0, 255) / 255
```

## 4. Stars depend on position in the galaxy

At `0x1a1ec0`, define `r = clamp(sqrt(x*x+y*y)/500, 0, 1)` and `f = 4 - 3.5*r`. An explicit renderer distance override can replace the coordinate-derived distance.

The normal main-background counts are:

| Batch | Count |
|---|---:|
| Initial point stars, only dust ≤ 1 | `int(20000*f + 15000)` |
| Second point-star batch | `int(5000*f + 5000 - 3000*dust)` |
| Third point-star batch | Same as second |
| Larger textured stars | `450 - 75*dust` |

Nonpositive point-star counts return without drawing. At the center with dust 0, the initial batch is 95,000; at radius 500 or more it is 25,000. These are generated point counts, not the number necessarily visible on screen.

The two later point-star calls pass size ranges 3–6 and 3–8, brightness 0.2–1.0. Point size is additionally scaled by `BackgroundResolutionFactor / 1.41421354`. Larger stars use `star0.bmp`–`star2.bmp`, with angular geometry size parameters 0.001–0.015.

Point-star generation at `0x19e980` is more structured than a uniform random sphere. Approximately half the batch is placed in a mixture of cylindrical distributions around the galaxy; the remainder uses normalized random cube directions offset by the observer position. The galaxy-plane observer offset is `(20*x/500, 0, 20*y/500)`. The first population's brightness is divided by distance from that offset. Colors come from the native star-color collection, whose labels include Carbon Star, Red Giant, Red Dwarf, Orange Dwarf, Sol, Yellow Dwarf, Blue Giant, White Dwarf, and Bright Giant.

`stars.vert` uses `gl_PointSize = vSize`. The supplied `stars.frag` notably computes its falloff using **dot**, not distance:

```text
light = 1 - clamp(dot(gl_PointCoord, vec2(0.5))*2, 0, 1)
output = vec4(light^2 * color.rgb, 1)
```

That unusual expression is present in the original shader. Replacing it with a radial glow is an artistic change, not an exact port. The separate `backgroundsun.frag` does use radial distance and a fourth-power falloff.

## 5. Rift treatment

The rift flag changes procedural saturation to 0.25, value to 0.2, light strength to 0.8, dark-nebula count to 4, and highlight intensity to 0.25. Native dust application gives rifts gray fog, max fog 0.95, strength 0.001, alpha 0.05, and three fog nebulae. The background pass adds two extra multiplicative cloud passes and 2,500 point stars with size parameters 3–5 and brightness 0.6–1.

Rift-specific shaders supply additional distortion and lightning. In `riftnebula.frag`:

```text
height = heightTexture((position.xy + position.z)*0.5 + offset*0.075)
mask = diffuseCube(position)
background = riftCube(-position + vec3(height.r*0.04))
output.rgb = vec3(0.12) * dot(background.rgb, vec3(0.299, 0.587, 0.144))
output.a = pow(min(1, (mask.r + height.r*0.15)*2.5), 4)
```

The last luminance coefficient is **0.144 in the shader**, not 0.114. `backgroundlightning.frag` multiplies lightning texture, mask texture, tint, and intensity by the tenth power of the rift-mask red channel. The complete timing and native setup of these animated effects have not been reconstructed.

## Reproduction and verification

Example invocation from the workspace root:

```powershell
python test-results/skybox-audit/seed_probe.py 100 -200 12345
```

For this synthetic numeric server seed, the recovered hash is `8032238194343651465`; the conditional preset index is 7. This is an algorithmic example, not a captured real-game sector. The script also prints the first procedural HSV draws. It preserves the recovered float rounding and does not use Python's unrelated default RNG.

Validation performed: executable identity checked; 23 initializer records recovered through literal instruction interpretation; color packing independently traced to `0xfe6fe0`; blend modes resolved through the native jump table; shaders inspected directly; contact sheet inspected; MT19937-64 checked against its seed-5489 first-output vector. No live-game framebuffer comparison was performed.

## What is still needed for pixel-identical replication

The recovered implementation details above are enough to explain why systems differ and to guide a faithful renderer. They are not evidence that an exact clone is complete. Remaining work includes:

1. Resolve the semantic identity of the caller coordinate that enables predefined palettes, all saved/runtime override paths, and displayed seed-string conversion.
2. Finish reconstructing every nebula billboard position, size, rotation, color draw, and RNG consumption step. The generation functions are preserved in disassembly; using approximate billboard placement would change the image.
3. Recover the exact permutation-texture contents/setup and validate all six cubemap camera orientations, sampling, internal formats, mipmaps, and color-space behavior.
4. Finish planet surface generation, sun placement constraints, fog geometry, and animated rift effect setup.
5. Capture known live-game sectors with their numeric seed, coordinates, settings, and overrides, then compare rendered faces and final frames.

For the Blender viewer, replacing this pipeline with one environment photograph, tinting one cloud texture, or using Blender procedural noise would only approximate Avorion. A faithful implementation should first port the deterministic specification generator and original GLSL composition, bake its cubemap, and then use that generated result as the environment while reproducing fog and lighting separately.

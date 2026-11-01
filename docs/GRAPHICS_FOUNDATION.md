# Avorion graphics foundation

For the September 30, 2026 material-layer and functional-surface corrections, current verification counts, and launcher calibration limits, see [the shader audit](SHADER_AUDIT.md). The original foundation results below describe the earlier port.

Implemented from the user-supplied September 29, 2026 handoff: `GRAPHICS_TEST_APP_HANDOFF.md`, `GRAPHICS_SOURCE_REFERENCE.md`, and `NATIVE_SHADER_EVIDENCE.md`. Source modules came from the accompanying `avorion-viewer-v3/avorion-viewer` tree and were converted from TypeScript to standalone ES modules. Original source hashes are recorded in `graphics-port-sources.json`. Three.js 0.169.0 and its license are bundled under `src/vendor`; no network CDN or package installation is required at runtime.

## Placement contract

- The complete supplied block catalog retains the nonconsecutive shape families and corrected functional IDs. Unknown types remain boxes with diagnostics.
- All eight supplied unit meshes are centered on the bounding cube center, with flat triangle normals and exact face winding.
- Axis IDs are −X,+X,−Y,+Y,−Z,+Z. Local X maps to look, local Y maps to up, local Z is their right-handed cross product. There are 24 valid pairs; invalid IDs or parallel axes use identity for display and generate diagnostics.
- World dimensions are applied after the signed axis rotation. Local scales are permuted before Three.js composition. XML parent indices identify relationships, not additional ship-space transforms.
- Native coordinates and units stay unchanged. The camera converts the existing workspace Z-up basis into native Y-up space. Viewport labels therefore describe the workspace viewing directions; Properties shows native look/up explicitly.
- Parsing retains the original DOM, unknown attributes, ARGB alpha, and embedded turret XML. Turret-local geometry is not rendered without assembly reconstruction. XML saving preserves data, not original bytes or whitespace.

## Renderer

WebGL2 texture arrays carry plating, normal maps, paint masks, local artwork, and emission. Gamma-space light/texture multiplication follows the supplied port. Lighting has independent direct light, uniform fill, six-axis sky ambient, reflection, specular, and emission inputs. Texture scale defaults to one tile per ten native units. Array metadata is flat-interpolated. Browser image decoding handles BMP BGR storage; the renderer does not swap decoded channels.

Local artwork, engine rear emission, circular thruster masks, generator emission, red-channel framework cutouts, solar panels, glass, holograms, ore variants, striped hull, names/emblems, hangar recesses, and preview effects reuse the supplied implementation. The source's native-calibration qualifications still apply.

Corrections made during this port:

- Orientation IDs outside 0–5 are rejected as invalid instead of aliasing an axis.
- Crew windows have a dedicated post-lighting pass at world texture coordinates / 8. They receive raw secondary RGBA separately, avoiding a second inherited-color blend. Default window color and strength are explicit viewer controls because native uniform defaults are unknown.
- Hangar interior triangles retain side IDs >=6, use local UV ×2 for plating/normal sampling, and no longer darken all exterior faces uniformly.
- Preview RGB repaint retains the original alpha byte. Imported geometry remains read-only; Color Editor repaint uses incremental appearance updates and exports a cloned XML document; changing opacity never relies on the old in-place batch update path.
- Texture URLs resolve relatively for GitHub Pages subpaths; folder loading is session-local. No game textures are shipped.
- A single GPU context/model is shared across tiled viewports. Completed frames are copied into the existing interaction canvases. This favors compatibility with the current shell; it is not a large-ship throughput claim.

## Verification

`npm test`: 88 passing tests, including every shape × orientation with unequal 2×4×8 extents, outward winding, volume, UV bounds, scale permutation, corrected IDs, hangar interior metadata, alpha-preserving RGB changes, and large-model framing.

`/tests/graphics.html`: eight passing browser checks covering XML preservation/diagnostics, actual WebGL rendering/picking/hiding, 36-angle face-ID stability, rotated engine rear emission, flat normal-map decoding, repeated model disposal and released texture-array cache, and crew-window emission with raw secondary alpha. The provided 65-block catalog XML was also loaded through the application's File menu.

## Remaining fidelity limits

This establishes placement and a working shader foundation, not native pixel parity. No matched in-game screenshot calibration has been performed.

- Native environment cubemaps, deferred lighting and shadows are absent. Ambient occlusion is a viewer addition (screen-space, from the depth buffer, Material and Rendered shading); the game has no AO pass. Light spill is forward-shaded from light blocks and engine exhausts through a sparse hash grid of light radius cells, with no spill shadows; radius and intensity are viewer defaults. Spill lights do not follow viewer-only block poses. Rendered-mode bloom ports the game's `PostProcessing/brightnesspass`, `blur` and `addbloom` shaders over four half-resolution levels; the native threshold and per-level amplification live in the executable, so the Bloom and Bloom Threshold preferences are uncalibrated viewer defaults. Sky lighting/reflection uses the supplied gradient approximation.
- Exhaust geometry, port pitch, light sprites, barriers, and several texture bindings are viewer approximations. Thrust changes opacity, not plume length; boost is absent.
- Transparent triangles sort by centroid; intersections remain unresolved. Effects are split around the translucent pass with a nearest-translucent depth map: effects behind glass draw first and are attenuated by it (glass alpha 0.7, as in `blocks/glass.frag`), effects in front draw afterwards. With several glass layers, an effect between two layers is attenuated by both.
- Hologram opacity follows XML as an explicit viewer policy; native pass selection is unresolved. XML preservation is independent of this display policy.
- Plain stone/rift shading, Glow Stone identity, some artwork bindings, native slope projection, and solar face selection still need calibration. Housing `_manywindows` binding is unknown.
- Picking uses triangle geometry; texture cutout holes still pick their underlying faces. Ship structure supports per-block/group selection, filtering, visibility, and isolation; modifier-click selection is linked to the viewport.
- Imported models/textures are session-only. There is no ship editing, turret assembly import, or material-preserving mesh export in this pass.

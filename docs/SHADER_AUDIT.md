# Block material and surface audit — September 30, 2026

## Evidence

Inspected the supplied installation at `C:/Program Files (x86)/Steam/steamapps/common/Avorion`, its `data/shaders/blocks` fragment/vertex shaders, block texture pixels, `Documentation/Enums.html`, and native shader bindings in `bin/Avorion.exe`. The archive copies of `block.vert` and `armormaskoverlay.frag` match the installed copies byte for byte. The supplied [Blocks wiki](https://avorion.fandom.com/wiki/Blocks) confirms the catalog entries; it does not specify shader bindings or UV conventions.

Native executable SHA-256: `0F3749B75DBAE3E0FCBDCA3173C6F6ECB68D203CC6764BB94D6B868A46C8AE4B`. Addresses below are RVAs for this executable, not portable version identifiers.

- Shader binding function at RVA `0x17c210`: material 2 binds `plates2_glow`; material 4 binds `plates4_overlay`; material 6 binds both `plates6_overlay` and `plates6_glow`. Binding branches are at `0x17d5f0`, `0x17d7c1`, and `0x17d6a0`. The hangar shader variant omits the material overlay.
- Torpedo texture binding at `0x18323f` uses `torpedotube.png` as `overlay2Texture` and `torpedotube_n.png` as `overlay2Normals`. Local coordinates are enabled, inversion is enabled, and the coordinate factor is `(1,1)`. The color image is a black rectangular aperture with alpha bounds `(16,48)-(112,80)` in a 128×128 image.
- `armor.frag`, `armormask.frag`, and `armormaskoverlay.frag` apply material accents before lighting and material glow afterward. Functional shaders keep an additional artwork sampler. `cloningpods.frag` has a third independent emission source, `overlayGlow`.
- `colorableoverlay.frag`, `overlay.frag`, and `dock.frag` suppress plating glow beneath opaque artwork. `dock.frag` recolors yellow markings only. `shieldgenerator.frag` adds glow RGB; ordinary hull glow mixes RGB ×2 using alpha.
- Real plating normal BMPs decode to predominantly blue RGB normals (for example, `plates0_n.bmp` averages approximately 128,127,248). The existing decision not to apply the native `.zyx` swizzle a second time remains correct for browser-decoded images.

## Corrections

1. Material accents and material glow have independent GPU layer attributes. They no longer compete with torpedo/dock artwork, windows, generator highlights, or cloning-pod glow. Missing optional maps retain transparent fallbacks; materials without native glow maps do not receive invented emission.
2. Plain hull no longer inherits Alternate Pattern A's paint mask. Pattern A and B remain separate. Restoring raw secondary alpha exposed this pre-existing binding error as unwanted camouflage on blank hull.
3. Secondary RGBA reaches the shader unblended, allowing each surface to apply its native default and alpha once. The color-update path preserves this contract, including the window attribute.
4. Functional decals and their normal maps sample inverted local UVs together. Tangent perturbations follow that inversion. World-projected normal perturbations no longer reverse on negative faces while their UVs remain unchanged.
5. Frontal launcher artwork is limited to local +Z, following the viewer's existing front/rear convention, with ordinary plating on the other five faces. Its normal map follows the same face routing. **The native mesh's exact launcher face convention has not been conclusively recovered; this direction is a viewer assumption, not a proven native mapping.** No arbitrary opening size or additional mesh recess was invented.
6. Dock yellow markings support secondary paint without tinting the entire machinery decal. Cloning-pod artwork and additive pod glow remain separate from plating emission.
7. The development server now serves supported texture extensions with image MIME types, allowing the existing app-folder texture scanner to accept them.

## Verification

- `node --test tests/*.test.mjs`: 101 tests passed, including independent GPU layers, raw alpha updates, and frontal-face routing through all 24 orientations with unequal extents.
- `/tests/graphics.html`: 18 browser checks passed with no WebGL shader or page errors. New pixel checks cover dark-scene material glow, no fabricated glow for other materials, accent/artwork coexistence, glow occlusion by artwork, inverted decal/normal alignment, secondary-alpha blending, blank-hull masks, and opposite-face normal mapping.
- `test-results/material-surfaces.png`: 21 rendered cases using 34 actual installed texture files. The gallery uses the same gray primary paint across materials so their texture accents can be compared. These are viewer renders, not matched native screenshots. Assets remain local and are not copied into the distributable.

## Remaining fidelity limits

This audit does not establish complete native block parity. The regular launcher still uses the inherited generic face treatment; exact launcher exit-side selection, native face UV construction on sloped geometry, artwork borders and physical sizing, some functional shader variants, and windowed-hull versus crew-window assignments need further native mesh evidence or matched in-game views. World plating remains triplanar rather than the native mesh-provided `vTexWorld`. Native environment lighting, reflection aberration, bloom, and material-specific highlight parameters are not fully reproduced.

The frontal launcher direction should be checked against a known in-game block with its XML `look`/`up` values before claiming orientation parity.

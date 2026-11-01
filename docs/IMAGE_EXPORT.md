# Image export

Open **File → Advanced Export… → Image Export**.

## Goals, visible controls and remembered settings

The tab starts with goal buttons: **Screenshot** (current viewport as PNG at viewport size), **Transparent render** (PNG with alpha, ship framed to fit, 2× supersampling), **Turntable GIF** and **Blueprint**. A goal sets the export type and its defaults; changing a value the goal sets (type, format, background, framing or supersampling) switches the highlight to **Custom**. The Export type select still works and does the same as picking a type.

Rows that do not apply are hidden rather than disabled. Image format is hidden for Turntable GIF, quality shows only for WebP and JPEG, background color only for a solid background, framing margin only when framing is used, and navigation gizmos, labels and grid are hidden where the mode ignores them. Supersampling, projection, framing margin, memory budget and the memory estimate sit under **Advanced**.

The last settings for each export type, the last type used and the Advanced open state are kept in `localStorage` under `avorion-viewer.image-export-settings.v1`. Switching type restores that type's saved settings; a goal button applies the goal's defaults instead. Saved values that no longer validate are ignored. The ship name is not remembered.

## Output modes

- **Current viewport** uses the current camera, working colors, visibility, shading, background, and overlay defaults. Animation uses the last rendered viewport time. The image contains viewport content, not application panels, menus, or transient mouse gestures.
- **Transparent ship** starts with no background, navigation, labels, grid, or selection decoration. PNG and WebP retain actual alpha, including antialiased silhouettes and translucent glass. The checkerboard belongs only to the preview.
- **Blueprint** uses a dedicated technical shader with simplified shading and depth-tested crease edges. Triangle diagonals are suppressed by the existing geometry edge-angle metadata. Materials retain geometric cutouts; glass is drawn as an opaque technical surface. Blueprint grid, title block, ship name, and dimensions are optional. Dimension labels use native model units, not assumed physical units.

PNG is the default. WebP and JPEG expose a quality control. JPEG requires an opaque background; the exporter does not silently flatten a transparent request. Unsupported browser encoders report an error instead of returning a PNG with the wrong extension.

## Resolution and framing

Enter custom pixel dimensions, choose a preset, or retain viewport size. Supersampling is 1×, 2×, or 4× **per axis**, so 4× uses 16 times as many working pixels. The final image always has the requested dimensions.

Current-camera contain/crop options preserve the source view scale while changing the field of view to match the new aspect ratio. Fit Visible Ship recomputes framing on an export-only camera, with adjustable margin. Front, back, left, right, top, bottom, and isometric presets are available, along with perspective/orthographic projection controls.

Overlay, navigation, selection, world-grid, label, and dimension controls are independent. Background may follow the viewport, use a solid color, or remain transparent. Blueprint page grid is separate from the world-space grid.

Preview uses the same pipeline at a smaller resolution. Prepare Image renders and encodes the requested resolution. Changes invalidate the prepared image. Download uses the already prepared snapshot, so later edits cannot change it.

## Rendering and lifecycle

The pipeline captures model data and camera/preferences without transferring or editing live buffers. It uses the shared WebGL renderer, camera math, texture library, instanced geometry, lighting, glass-depth pass, and post-processing. A matching visible GPU model is reused when model and appearance revisions permit; otherwise large geometry preparation uses the existing worker.

Image output uses offscreen RGBA targets with supported multisample antialiasing. Large output is rendered in padded tiles, read back, unpremultiplied, downsampled, and composited locally. Tile padding accounts for depth of field, bloom, and the projected ambient-occlusion radius. Shadows and animation remain stable across tiles. Labels and blueprint presentation are drawn at final resolution. Normal viewport canvas saving is not used.

Export temporarily owns the shared renderer. Other viewport draws wait; their images and interaction state remain intact. Completion, cancellation, and failure release export targets and restore renderer ownership. Cancellation is cooperative between preparation/render/encoding stages; an individual GPU draw or browser encode cannot be interrupted midway.

## Limits

Dimensions accept whole pixels from 1 to 32,768, subject to the browser's actual allocation/encoding limits and the selected memory budget. Tiling removes the single-GPU-target restriction, but the final image still needs memory for assembly and encoding. Memory estimates include model preparation, multisample/depth/effect targets, and encoder copies; they are conservative estimates, not a browser memory guarantee.

When effect padding cannot fit safely, export reports an error. Increase the budget or reduce effects/resolution; quality is never silently reduced. The viewer's existing simplified-rendering threshold is retained, including its policy for animated effects on large ships. No new geometry simplification is introduced.

All rendering, asset use, preview, and encoding stay local. GPU/context or encoder failures leave a clear error and preserve the working model.

## Verification

- `node --test tests/*.test.mjs`
- `node tests/image-export.check.mjs`: viewport/tile parity, alpha, format encoding, supersampling, cancellation, restoration.
- `node tests/image-effects.check.mjs`: perspective tiling with AO, shadows, grid and selection; glass alpha; bloom coverage; injected failure recovery.
- `node tests/image-export-ui.check.mjs`: controls, download, JPEG transparency validation, blueprint preview, mesh-export integration, local-only requests.
- `node tests/image-graphics-suite.check.mjs`: existing graphics regressions.
- `node tests/image-export-stress.check.mjs`: real local Ship Stress Test XML, supersampled blueprint, source preservation and UI heartbeat measurements. Set `IMAGE_STRESS_SHIP` to another fixture.

Browser checks use the existing local Playwright runtime. Set `VIEWER_TEST_URL` to the running viewer URL (default `http://127.0.0.1:5183`). The stress fixture has 40,429 ship blocks. Software-renderer testing completed without source changes; large GPU uploads/draws can still stall the main thread for several seconds on software rendering.

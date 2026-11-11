# User guide

A Blender-inspired tiled workspace for viewing Avorion XML models, inspecting native blocks, and adjusting a WebGL2 game-style shader.


## Local asset persistence

Use **File > Save Project…** to download a named `.avproject` file, **Save Project As…** for a variant, and **Open Project…** to resume. Projects contain source XML, paint and opacity edits, regions, hidden blocks, and turret and component attachments. Use **Save Current Views with Project** to include cameras. Turret Studio can export a Model Project that reopens in the Studio.

**Export Workspace Profile…** saves editor layout, themes, input settings, World, and shaders as readable JSON in an `.avprofile` file. Use **Import Workspace Profile…** to apply it while keeping the current model open.

**Replace Source XML…** previews transfers after scale, origin, hierarchy, or block changes. Review paint conflicts and missing sockets or mounts before applying. Kept turret mounts retain their size, and the preview flags changed clearance.

The current model (including paint edits and placement) and imported texture originals are saved automatically in IndexedDB and restored after reload. Storage belongs to this browser profile and site address. A toast confirms when saved textures are restored, and Preferences > Asset Library shows how many are saved.

File > Asset folders… remembers the texture, model, and other folders you choose. In Chrome and Edge each folder is stored as a browser folder handle and reopens on the next visit: without a prompt when the browser kept the permission, otherwise after one **Reconnect folders** click. Model folders are searched recursively and shown in a model browser: search by name or subfolder, see block count, size, and date, star **Favorites**, and reopen from **Recent**. Double-click or press Enter to open a model. Block counts are cached per file version, so large folders are only read once. **Forget** stops remembering a folder without touching the files. Chrome and Edge refuse to remember folders inside Program Files or AppData, which is where Steam installs Avorion and where the game saves ships; picking one shows "Can't open this folder". After that, the row offers **Use one-time picker…**, the classic folder input, which can read those folders but is forgotten afterwards. Textures read this way are saved in the browser as usual, so it is a one-time step. Ships read this way are saved as a copy in IndexedDB, so the model browser works on every visit; **Refresh…** re-reads the folder to pick up ships saved since, and **Forget** deletes the copy. Browsers without the File System Access API always use the one-time picker. Typed folder paths were removed because browsers cannot open a folder from a path string. File > Clear scene saves an empty scene; File > Unload textures removes saved texture imports. Browser data clearing or eviction removes these copies, so keep your source files. Storage failures are reported without interrupting the current session.

In Trackpad mode on a touchscreen, tap to select, drag one finger to orbit, drag two fingers to pan, and pinch or spread to zoom. For Box Select, tap, lift, then immediately touch down nearby and drag. Touch and hold to open the context menu, then tap an option or tap outside to dismiss it. In Paint Mode, active paint tools still use touch to paint.

## Controls (default keymap)

| Action | Control |
| --- | --- |
| Resize areas | Drag a divider; Ctrl snaps; double-click equalizes |
| Keyboard resize | Focus divider, then arrow keys; Shift uses larger steps |
| Split / join / swap | Right-click a header or border, or use the header's ⋮ menu |
| Corner split | Drag the top-right or bottom-left grip inward |
| Corner join | Drag a grip into the sibling editor |
| Swap editor contents | Ctrl-drag a corner into another area |
| Maximize hovered area | Ctrl+Space |
| Focus mode | Ctrl+Alt+Space |
| Restore / cancel operation | Escape |
| Toggle viewport toolbar / sidebar | T / N |
| Input style | Help > Input style (also available beside model and texture loading in the No ship loaded screen) or Preferences > Input: Blender, Laptop (Alt+left-drag, number-row views) or Trackpad (two-finger scroll pans, pinch zooms, Shift+scroll orbits) |
| Orbit / pan | Middle mouse / Shift+middle mouse, or the left toolbar tools |
| Snap orbit to an axis | Hold Alt when releasing an orbit drag |
| Stepped orbit | Numpad 2 / 4 / 6 / 8 (15°) |
| Stepped pan | Ctrl+Numpad 2 / 4 / 6 / 8; Shift+wheel also pans |
| Roll | Shift+Numpad 4 / 6 (15°); axis alignment resets roll |
| Zoom | Wheel, Ctrl+middle mouse, Numpad + / −, or drag the magnifier |
| Dolly | Ctrl+Shift+middle mouse; switches orthographic to perspective |
| Zoom region | Shift+B, then left-drag to zoom in or middle-drag to zoom out |
| Cancel navigation | Escape, right-click, pointer cancellation, or loss of window focus restores the pre-drag camera |
| Frame all / selected | Home / Numpad .; framing uses visible geometry bounds |
| Front / right / top view | Numpad 1 / 3 / 7, or axis buttons; Ctrl selects the opposite side |
| Opposite view | Numpad 9; clicking the current axis also flips sides |
| Perspective / orthographic | Numpad 5 or the projection gizmo button |
| Select / deselect model | A / Alt+A, or click model geometry / empty space |
| Switch workspace | Ctrl+Alt+PageUp / Ctrl+Alt+PageDown, or tabs |
| Rename workspace | Double-click its tab |
| Open Preferences | Edit > Preferences, Ctrl+Comma, or choose Preferences in an area's editor selector |
| Search / clear Preferences | Ctrl+F / Alt+F inside Preferences |

Text inputs and open dialogs do not trigger editor shortcuts. Some browsers or operating systems reserve shortcuts; the same actions are available in menus. Layouts preserve usable minimum sizes and scroll on narrow windows instead of collapsing editors. A desktop pointer and keyboard give the intended experience.

## Preferences

**Generated space sky:** open the **World** tab (globe icon) of the Properties editor; it edits live beside the viewport. Use **Show World in Viewports** to enable it in existing layouts; new viewports use World by default. **New Sky** changes the seed. Seed and sector coordinates reproduce the same sky; palette/custom colors, cloud count/size/intensity/highlights, dark clouds, dust haze, star density/brightness, sun glow, world brightness, rotation, and cube-face resolution are saved with preferences. Changes apply live. Rotation reuses the cached sky; other generation settings rebake it once for all viewports. Choose Theme or Viewport in an individual viewport's Background controls to hide the sky there.

The generator uses the supplied Avorion `bg0–bg9`, `fog0–fog9`, and `star0–star2` textures bundled under `src/assets/sky/`. It approximates the game's layered nebula/highlight/dark-cloud response with seeded spherical placement and a star field. It does not reproduce exact game sectors, planets, animated rifts, or local volumetric fog. Dust Haze affects the distant sky; the existing ship lighting remains independently adjustable. These original game assets are not covered by the Three.js license.

Preferences apply immediately across all editors. Hover a setting label for its description; descriptions remain searchable and available to assistive technology. The Interface Tooltips setting controls these hover hints. The eight categories expose app settings. Scene look settings live in the Properties editor's **World** and **Shaders** tabs, and asset folders in **File > Asset folders…**; they are still saved, reverted and reset with preferences.

- **Interface:** language, status bar, tooltips, and corner handle visibility.
- **Viewport:** axis gizmo or rotating view cube (80–240 px), view labels, block statistics, and selection outline width for the legacy reference fallback. WebGL selection uses the editor accent tint.
- **Themes:** Blender Dark, Graphite, or High Contrast, with a selection color. Each editor can override its background, header, text, and accent colors independently. Enable that editor’s Custom Colors to apply its palette; the first time, its colors start from the active theme preset. Color settings show an editable hex value beside the swatch, and per-editor colors are dimmed while Custom Colors is off.
- **Input:** input style (Blender, Laptop, Trackpad), Alt+left-drag middle-mouse emulation, trackpad gestures, and top-row numpad emulation.
- **Keymap:** editable application shortcuts, viewport navigation, mouse/wheel gestures, operation bindings, and layout modifiers. Click a binding and press the replacement combination; Clear removes it and Reset restores it. Conflicts in the same context are rejected. Native text editing and standard control navigation retain their usual keys. Input emulation takes priority when enabled.
- **Navigation:** orbit and zoom sensitivity, keyboard rotation angle, automatic perspective when leaving an axis view, and inverted zoom gestures.
- **Shaders (Properties > Shaders tab):** Blender-inspired collapsible node cards with color sockets, swatches, and blue value sliders. Drag a value bar, use arrow keys, or type into its numeric value; descriptions appear on hover. Surface, lighting, texture scale, normals, reflection, emission, crew windows, and debug passes update the WebGL2 viewport live. These are shader parameters, not a node graph editor.
- **System:** canvas resolution limit for display quality and memory use.
- **Save & Load:** whether workspace layouts and cameras are saved and restored.

Number settings show their unit: `px`, `°`, `×` for multipliers, `u` for native model units, and `blocks` for block counts. Every number default sits on its slider step, so browser validation never flags a factory value.

### Language

**Preferences > Interface > Language** switches menus, dialogs, the status bar, Quick Start, and every preference label, description and option. Choices: Automatic (browser language), English, Deutsch, Español, Français, 日本語, Português (Brasil), Русский, 中文（简体）. Japanese uses the standard `ja` code. Preference search matches both English and the selected language.

Translations live in `src/i18n/<code>.js`, keyed by the English source text, and load on demand; a missing key falls back to English. `src/i18n.js` provides `t()`, `tf()` for `{0}` templates, and `translateDom()` for static markup in `index.html` (elements with inline markup use `data-i18n-html`). Not translated yet: Properties panels other than World and Shaders, Outliner and Ship Structure contents, the Color Workshop, export dialogs, the Turret Studio, and toast/log messages. Block names, file contents and key names stay as they are. `tests/i18n.test.mjs` fails when a preference string is missing from any language or a placeholder is lost.

The footer's options menu controls **Auto-Save Preferences**, **Revert to Saved Preferences**, and **Load Factory Preferences**. With auto-save disabled, changes remain live until reload but persist only after **Save Preferences**. Factory preferences are a temporary preview with auto-save disabled; they replace saved preferences only when explicitly saved or auto-save is enabled. Preference storage is separate from workspace storage. Disabling workspace persistence retains the previous saved layout, pauses layout writes, and starts with the default layout on the next load.

## Architecture and boundaries

`src/layout.js` owns a binary split tree. Leaves store editor type, region visibility, and camera settings. This provides predictable tiled layouts with no overlapping floating panels. `src/app.js` owns browser interactions, editor UI, and persistence. `src/navigation.js` owns shared camera math and shortcut resolution; `src/viewport.js` handles pointer gestures and composites a frame from `src/game-renderer.js`. One WebGL2 context and a shared model serve all tiled viewports. `src/avorion/` contains the block catalog, exact unit geometry, orientation rules, XML parser, texture arrays, and game shader. `src/styles.css` defines the theme, with original inline icons in `src/icons.js`.

Joins currently require sibling leaves sharing one split. Blender supports more general docking across areas; that topology and native multi-window behavior are not reproduced here. The viewport supports orthographic and perspective projection with depth-tested geometry. Navigation uses a turntable camera; trackball preferences, walk/fly navigation, and sculpt-only Frame Last Stroke are not implemented. XML loading, native shapes, materials, preview transformations, animated effects, and block counts are implemented. Imported geometry is read-only; the Color Editor repaints imported blocks. Turret library assets open in an isolated workspace with pose, tracking, firing effects and animation export; see [Turret Studio](TURRET_STUDIO.md). File > Advanced Export provides STL, 3MF, GLB, packaged glTF and OBJ; see docs/ADVANCED_EXPORT.md for validation and limitations. Scene selection, visibility, and activity logs are session-only; workspaces and camera settings persist locally. Existing first-pass layouts remain compatible; new camera fields are added when their viewport opens.

`src/keymaps.js` is the shared binding registry for preferences, dispatch, menus, and shortcut help. `src/view-cube.js` projects the navigation cube from the current camera; face-aligned labels rotate and foreshorten with the cube, 26 selectable regions (6 faces, 12 edges, and 8 corners) align views, and dragging the cube or its background orbits. Hovering or focusing an edge or corner highlights its patches across adjacent faces. Surrounding arrows orbit by 90°; Home restores the Top Front Right camera position, zoom, and target. Home, all cube targets, and gizmo axes retain the current projection toggle; new views default to Perspective. Top and Bottom views expose clockwise/counterclockwise 90° roll buttons at the cube’s upper left. Clicking an already aligned cardinal face flips to the opposite face; edge and corner selections retain their alignment behavior. Cube size is saved under Preferences > Viewport.

`src/preferences.js` owns the validated preference schema, live state, saved snapshot, and storage errors. `src/preferences-editor.js` renders the same settings interface in either a tiled area or the Preferences dialog. Settings are stored per browser origin; Blender-only categories such as add-ons, animation, and rendering devices are not exposed.

The document model and WebGL renderer retain the layout engine and editor-region contracts. The current implementation does not execute Blender or include Blender source code, assets, or branding.

## Design references

Design references for workspace behavior:

- [Window system introduction](https://docs.blender.org/manual/en/dev/interface/window_system/introduction.html): topbar, editor areas, status bar.
- [Areas](https://docs.blender.org/manual/en/5.0/interface/window_system/areas.html): border resizing, splits/joins, corner gestures, maximizing, and hover-based context.
- [Workspaces](https://docs.blender.org/manual/en/latest/interface/window_system/workspaces.html): saved arrangements and workspace tabs.
- [Preferences introduction](https://docs.blender.org/manual/en/5.3/editors/preferences/introduction.html): category navigation, search, auto-save, manual save, revert, and temporary factory preferences.
- [Regions](https://docs.blender.org/manual/en/3.1/interface/window_system/regions.html): headers, toolbars, sidebars, and panels.
- [Navigation](https://docs.blender.org/manual/en/latest/editors/3dview/navigate/navigation.html): navigation controls and gesture mapping. Additional references: [Blender 5.1 navigation documentation](https://docs.blender.org/UATEST/manual/en/dev/editors/3dview/navigate/navigation.html) and the [3.2 English manual](https://docs.blender.org/manual/en/3.2/editors/3dview/navigate/navigation.html) supplied the readable references.
- [Blender screen data structures](https://github.com/blender/blender/blob/main/source/blender/makesdna/DNA_screen_types.h) and [screen operators](https://github.com/blender/blender/blob/main/source/blender/editors/screen/screen_ops.cc): conceptual separation of screens, areas, editor state, and regions.
- [GitHub Pages custom workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

This is an independent browser implementation inspired by those behaviors, not a port of Blender's window manager.

## Avorion rendering

- **File > Import Avorion XML**, dropping an `.xml` onto the window, or **Open Avorion XML…** on the empty viewport loads a local plan. The app starts with an empty scene (or the model restored from this browser). Dropping texture images or the game's texture folder loads them like **File > Load local texture folder**; the viewport's **Textures** badge shows how many maps are loaded. A file that fails to parse opens an error dialog and leaves the current model unchanged. Click a block to inspect its type, material, look/up, world dimensions, item identity, and color. File > Export Avorion XML serializes the original DOM, retaining unknown data and embedded turret designs; it does not guarantee byte-identical formatting.
- **Help > Developer > Load Block Gallery** lays out the cube of every block type as 2 × 2 × 2 blocks with 2-unit gaps. Click a block to select it, then pick its shape in **Properties > Variant** (Edge, Corner 1–3, Twisted Corner 1–2, Flat Corner; turret bases, rotation locks, ship names and emblems have Cube and Edge). Material, orientation, dimensions and primary/secondary colors stay editable in Properties, and gallery edits are saved with the current browser session. **Double-click** a block in Object Mode to open it alone in a block workspace (viewport, outliner and properties, like the turret workspace); **Apply to gallery** copies the shape, orientation, material and colors back to that gallery block.
- **Help > Developer > Load orientation gallery** displays the seven non-cube plain Hull shapes (Edge, Corner 1–3, Twisted Corner 1–2, Flat Corner) in all 24 rotations, one row per orientation, as 2 × 2 × 2 blocks with 1-unit gaps. Cubes are left out because rotation does not change them. Use Frame All to fit it.
- **File > Load local texture folder** loads your existing Avorion block texture images for this session. Missing maps use neutral fallbacks. No proprietary textures are included in the static build.
- **Properties > Shaders > Game Surface > View Pass** includes local face IDs (dark/bright red = −/+X, green = −/+Y, blue = −/+Z), world normals, albedo, paint masks, lighting, and projection debugging.
- Native XML remains X-right/Y-up/Z-back. The camera bridge maps it into the existing Z-up workspace without rewriting model coordinates. Native units are not labeled as meters.

Run `npm test` for CPU regression checks; open `/tests/graphics.html` on the development server for XML/GPU pixel checks. See [graphics foundation notes](GRAPHICS_FOUNDATION.md) for evidence, port modifications, and remaining fidelity limits.

The [September 30 shader audit](SHADER_AUDIT.md) documents material accent/glow restoration, separate functional artwork layers, raw secondary-color blending, UV/normal corrections, and remaining launcher calibration limits. Reload the local texture folder after updating so newly supported material overlay maps are included.

## Viewport display controls

Each viewport saves its own Gizmos, Overlays, X-Ray, shading, and camera settings with the workspace. The Overlays popover groups floor/axes/grid scale, information/render timing/statistics, selection outlines, and crease-filtered wire overlays. Popovers apply edits immediately and close with Escape or an outside click. Controls activate only through their input, not their descriptive caption.

Material Preview uses neutral preview lighting with imported textures. Rendered uses Preferences shader lighting, block effects, optional directional shadow maps, and optional screen-space depth of field. Solid uses block colors with Studio lighting or a procedural Red Wax MatCap approximation (not Blender's `red_wax.exr` asset). Wireframe shows block edges without triangulation diagonals. X-Ray operates in Solid and Wireframe; its header toggle and opacity controls share state. Wireframe Threshold filters crease angles; it is not line thickness. World background uses the shader world's horizon color.

The View sidebar provides a 50 mm default lens (36 mm sensor fitted to the shorter viewport dimension) and Clip Start/End defaults of 0.01/1000 in native model units. No unverified conversion to meters is applied. These per-viewport clip values supersede the older global Preferences clip values. Depth of field starts disabled; focus distance uses native units and aperture controls preview blur strength. Outlines and depth of field use screen-space passes, and Rendered shadows use a 2048-pixel directional depth map; these are viewer previews rather than Blender's render engine.

## Ship structure

The Outliner is a flat, grouped block browser, not the XML attachment hierarchy. Its root shows the filename and live block count; deleted or detached blocks are excluded. Choose alphabetical groups by block type or material. Expand a group to inspect `Type · b123` entries; these are viewer IDs, not native XML item indices. Search matches type, material, or viewer ID without case sensitivity and expands matching groups. Group counts and actions operate on the filtered members only.

Click replaces selection; Ctrl/Cmd-click adds targets or removes them when all are already selected. Double-click frames targets without changing direction or projection. Viewport selection and group highlights stay synchronized; a group highlights only when every displayed member is selected.

Eyes hide all targets if any are visible, otherwise show all. Isolate shows only targets; Unhide all restores every live block. Visibility never changes XML or clears selection. Right-click offers Select, Add/Remove selection, Focus, Isolate, Hide, Show, and Show all. Right-click on an already-selected block addresses the entire current selection.

Preferences > System > Simplified Rendering Threshold defaults to 30,000 live blocks. Strictly above it, textures and the game shader remain active and animated effects are omitted. Selection, focus, and picking remain available. Visibility actions remain active. Returning below the threshold restores normal rendering and the retained selection. Repeated opaque blocks share instanced geometry in spatial batches; unique shapes and translucent geometry retain a merged fallback. Very large or highly varied models can still be memory intensive.


### Ambient lighting and world guides

Material Preview uses studio lighting; Rendered honors the shader lighting toggles in Preferences. For equal illumination in any surface shading mode, enable **Viewport Shading > Lighting > Ambient Only** and adjust Ambient Brightness. This uses white ambient fill without directional lighting, reflections, or surface emission shading. Disable it to restore the previous lighting setup.

**Viewport Overlays > Guides** provides Infinite Axes, total Axis Length centered on the origin, Axis Width in screen pixels, and Axis Brightness. The floor is an unbounded grid with decade-based spacing that adapts to camera zoom. Grid Scale adjusts the spacing base; Statistics reports the current cell size in native model units. Distant subpixel lines fade at the horizon.

The Info header's **Newest on Top / Newest on Bottom** button reverses entry order. Each editor saves its own order with the layout.


### Large-model optimization

The Ship Structure Outliner renders only a window of rows. Group actions still include every matching block, including offscreen rows. Cached group summaries and stable block IDs preserve selection, visibility, isolation, and focus as the list scrolls. Arrow keys, Page Up/Down, Home, and End navigate virtual rows.

Repeated opaque blocks with matching type, material, orientation, and dimensions share instanced geometry in spatial batches of at most 1,024 instances. Groups need at least 16 matching blocks; a model-wide batch budget favors larger groups and merges the rest to avoid excessive draw calls. Ordinary opaque surfaces use hardware backface culling; two-sided surfaces retain their existing behavior. Picking uses a hierarchy of block bounds followed by exact surface triangle tests. Fully hidden batches skip rendering. Selection and appearance edits update affected buffer ranges, and both primary and secondary ARGB channels remain independent.

Large models using simplified effects prepare geometry and picking bounds in a worker. The source XML stays on the main thread; transferred preparation records include secondary-color presence separately from its numeric value. New model loads cancel stale preparation. XML parsing and final GPU uploads still have main-thread costs.

The appearance transaction API returns before/after patches for stroke and region undo. The Color Editor and viewport paint tools use that API for incremental appearance changes. Existing preview color controls use the same path. Crossing opaque/translucent hologram alpha requires rebuilding render batches.

Validation fixtures: `tests/outliner-scale.html` (40,339 / 100,000 / 500,000 synthetic blocks), `tests/model-worker.html` (background preparation and cancellation), and `tests/graphics.html` (merged/instanced parity, picking, both color channels, and XML preservation). Synthetic cube geometry results do not establish a universal 500,000-block frame-rate guarantee.

The local Ship Stress Test imported 40,429 live blocks. Whole-ship selection, individual selection, and focus passed with 25 mounted Outliner rows. Its varied geometry uses 55 render batches and approximately 193.85 MiB of geometry attributes versus 199.05 MiB for the equivalent expanded attributes; instancing benefits repetitive ships much more. These figures exclude textures, source XML, picking data, and temporary allocations. Graphics checks use software WebGL and do not establish hardware frame-rate improvements.

### Import placement and selection actions

Preferences > Save & Load > Model Import > Placement applies to the next imported model. **Default** centers its bounding box on the world origin. **Placed** centers workspace X/Y and rests the lowest extent on the Z=0 floor. **As Imported** retains the imported coordinates. Placement is a viewer transform; native XML positions remain unchanged when exported.

Selecting a block in the viewport brings a selected-block shortcut to the top of each Ship Structure Outliner, even when its group is collapsed or filtered out. Group membership and group selection remain unchanged. Right-click an idle viewport with a selection to open the Focus / Isolate / Hide / Show Last / Show All pie menu. Show Last reverses the most recent visibility change recorded by Hide or Isolate (up to 20 actions); Show All clears this history. Custom right-button navigation gestures retain their bindings.

Viewport Overlays > Objects > Outline Selected controls both selection highlighting and the visible silhouette in the theme's Selection Color. Turning it off does not deselect blocks. The master Overlays toggle also suppresses this display. Object Outline in shading settings is a separate outline for the model.

### Color Editor

Open **Window > Open Color Workshop** for a viewport, Outliner, and Color Editor side by side, or choose **Color Editor** from any area's editor-type menu. The editor uses a bundled, unmodified copy of the installed game's `data/rgb.txt`: 407 named colors, comprising 132 bases and 275 variants. See [the Color Editor architecture and data notes](COLOR_EDITOR.md).

The Family Fan wheel samples only chromatic base colors in twelve separated hue families, with four dark-to-light bands and a large central comparison disk. Sparse ranges repeat existing bases; all colors remain accessible through the List tab. Select a base, choose one of its existing variants, and select a harmony mode. Each suggested base has its own independent variants. **Link Variants** follows the primary family only where it exists. The list searches names, RGB, hex, and source rows; neutrals and browns remain in separate list categories. No color values are synthesized.

Choosing colors only changes the editor's proposed palette. **Apply to Selected** or **Apply to Region** repaints the working ship and updates the viewport immediately. Primary alpha is retained; secondary painting can preserve alpha or explicitly use full strength (FF). Existing zero secondary alpha can make its RGB change visually inactive until full strength is chosen. **Undo Paint / Redo Paint**, also available in Edit and through Ctrl+Z / Ctrl+Shift+Z, reverse color transactions. Existing preview color controls use the same paint history. Undo is limited to 30 transactions and roughly one million changed records, retaining at least the latest operation.

Use **Regions > Save Selection as Region** to name an arbitrary selection. The Regions tab lists every region with its color, size, and two toggles: the eye highlights it in the viewport with its color, and the target isolates it. The card below the list edits the active region: rename it inline, click the swatch to change its color, choose Off, Highlight, or Isolate, and press **Edit in Viewport** to change members directly. While editing, click or box-drag blocks to add them, hold Ctrl to remove them, and press Esc to finish; your selection is not changed. **Add Selected**, **Remove Selected**, and **Replace with Selection** work from the current selection. **Grow** adds every block touching the region, hidden or not. Highlight and isolation update immediately after every change. If you change visibility elsewhere (for example Show All), isolation turns into a highlight instead of overriding you. A region cannot become empty; delete it instead. **Undo** reverses the last region change for the current model. Regions can overlap and do not depend on rendering chunks. They persist in Model Projects and browser recovery. **Palettes > Add Active / Add Harmony**, then **Save Palette**, stores named Avorion color references in this browser. Palettes persist locally; models and textures are saved locally; regions persist in browser recovery. Nothing is uploaded.

Painting leaves the imported XML document and original coordinates untouched. **File > Export Avorion XML** exports a cloned document with only the working color overrides applied. Unknown attributes, parent references, and embedded turret plans remain in that document. Loading another model resets paint history. Existing generated previews have no native XML document to export.

### Viewport selection and painting

Choose Object Mode, Paint Mode, or Socket Mode in each viewport header; Tab cycles through the three in that order. In Object Mode, left-drag box-selects blocks whose projected centers fall inside the rectangle (through the model); Ctrl-left-drag subtracts those blocks. Hidden blocks are excluded. A click retains individual picking.

Paint Mode shares its active color, channel, and secondary strength with the Color Editor. Its left tool shelf includes Select, Brush, Eyedropper, Replace Color, Connected Fill, and Restore. Select box-selects and click-picks blocks like Object Mode (Ctrl-drag subtracts), so you can build a selection for the Selected Blocks scope without leaving Paint Mode. A compact settings row beneath the header provides Whole Ship / Selected Blocks / Active Region scope locks, color, channel, radius, and undo/redo. A radius of zero paints the block under the cursor center; larger radii sample visible surfaces across a circular footprint. The segmented cursor remains an aiming aid; the blue circle shows the actual radius. Hover previews tint the actual visible block surfaces and show current ARGB, without altering selection or paint data. A stroke is one paint undo operation; Escape, pointer cancellation, or loss of focus rolls it back. Source XML stays unchanged until exporting a working copy. Without a Color Editor choice, the initial brush is Dodger Blue on the primary channel.

Saved palettes have a **Make Active** control in Color Editor > Palettes and can also be chosen in the Paint palettes popover. The active palette and the twelve most recent colors persist locally. In Paint Mode, click and release MMB without dragging to open its color pie; MMB-drag still orbits. Palettes longer than eight entries have Previous/Next pages. Choosing a swatch changes the brush without painting until the next stroke. The paint cursor has a contrasting center dot for precise targeting. Hold RMB over a target to open an offset magnifier. Its source stays anchored while you move into the lens; hold LMB to paint there. Release LMB to finish a stroke, release RMB to dismiss, or press Escape to cancel. **Paint symmetry** offers native-axis mirror planes. **Paint magnifier** offers 2–8× magnification, 120–360 px lens size, and either smooth enlargement or an additional detail render. Detail rendering adds GPU work while the lens is open.

See the [paint tools and T&E checklist](PAINT_TOOLS.md) for tool behavior, scope rules, limitations, and validation steps.

## Advanced 3D export

**File > Advanced Export** opens local mesh export. Pick a goal (Blender / game asset, 3D print, Quick share) to fill the form, or adjust it as Custom; less common options sit under Advanced. GLB, glTF and OBJ default to real scale (1 Avorion unit = 1 m) and prepare automatically; STL, 3MF and printable shells are sized in millimetres and wait for Prepare & Validate. The last settings for each format are remembered. See [export documentation and test criteria](ADVANCED_EXPORT.md).

Image export: File > Advanced Export > Image Export supports viewport, transparent ship, and technical blueprint images. Goal buttons (Screenshot, Transparent render, Turntable GIF, Blueprint) fill the form, rarely used options sit under Advanced, and the last settings for each type are remembered. See [Image export](IMAGE_EXPORT.md) for formats, resolution, framing, and limits.

# Getting started with Avorion Viewer

Use the viewer to explore a ship's construction, try paint schemes, inspect turret layouts, and create images, animations, or 3D files. This guide introduces what each view is useful for so you can choose where to start.

## Load a ship and get your bearings

Choose **Open Avorion XML…** on the welcome screen, or drop a ship `.xml` onto the viewport. To replace an open ship, use **File > Import Avorion XML…**. Textures are optional: **Load texture folder…** adds the game's surface textures; without them, blocks use plain material colors.

Choose **Blender** or **Laptop** controls on the welcome screen or through **Help > Input style…**. Trackpad is temporarily unavailable while its controls are being fixed. With the default Blender controls, middle-drag rotates, Shift+middle-drag pans, and the wheel zooms. **Home** or **Frame all** brings the ship back into view. Click the view cube or axis controls for standard angles.

## Choose what you want to do

The viewport's **mode menu** controls how you interact with the ship. Its **shading buttons** control how the ship looks. Workspace tabs arrange the panels around it.

### Inspect blocks: Object Mode

Use **Object Mode** to select and examine parts of the ship. Click a block, or drag a box to select several. Box selection can include blocks behind the visible surface; Ctrl-drag subtracts from the selection.

Inspect block details such as type, material, dimensions, and color. Use **Hide** or **Isolate** to reveal internal construction or focus on one section; **Show All** restores hidden blocks. This is useful for checking armor arrangements, identifying components, and examining details obscured by the hull. Imported ship geometry is read-only: selection does not let you build or reshape blocks.

### Try colors: Paint Mode and Color Workshop

Choose **Paint Mode** in the viewport header, or press **Tab** to switch between Object and Paint modes.

- **Brush** paints blocks under the cursor. A radius of **0** targets one block at a time.
- **Eyedropper** samples a block's color.
- **Replace Color** and **Connected Fill** help recolor matching areas.
- **Restore** returns painted blocks to their imported colors.

Choose the **Primary** or **Secondary** color channel and a scope: **Whole Ship**, **Selected Blocks**, or **Active Region**. Scope limits where the tool can act; Whole Ship does not make every brush stroke repaint the entire ship. **Ctrl+Z** undoes paint and **Ctrl+Shift+Z** redoes it.

Open **Window > Open Color Workshop** for palette and harmony choices, applying colors to selections, and named regions. Regions let you highlight or isolate sections such as engines, armor, or trim. Use these tools to compare a paint scheme or show how a ship is organized. Regions are session-only, so do not treat them as saved ship data.

### Preview turret placement: Select Sockets

Choose **Select Sockets** to pick turret mounting points without selecting hull blocks. In **Properties > Turrets**, enable **Show sockets**; choose **All turret blocks** if you want to see candidates across the ship.

Select a turret asset in the **Asset Library**, choose an available socket, and use **Attach selected asset**. Pose and size controls let you explore how a mounted turret sits on the ship. This is useful for comparing placements and checking how barrels line up with nearby hull sections.

## Choose how the ship looks

Use the shading buttons in the viewport header. Hover over a button to see its name.

| Display mode | Useful for showing… |
| --- | --- |
| **Wireframe** | Block edges and construction details that are harder to distinguish on shaded surfaces. |
| **Solid** | Hull shape and surface form under simple lighting. Studio and MatCap options help emphasize contours. |
| **Material Preview** | Colors and loaded textures under consistent preview lighting, useful while repainting. |
| **Rendered** | The ship with your scene lighting settings, useful for presentation images. |

**X-Ray** is available in Solid and Wireframe modes for seeing through surfaces. Overlay controls can add wire edges, block bounds, and model dimensions. Turn unnecessary overlays off for a cleaner presentation.

Use **Properties > World** to adjust the space background and **Properties > Shaders** to adjust the ship's appearance. Choose **Rendered** to judge your scene lighting changes. An orthographic view is useful for comparing proportions; perspective gives a more natural presentation view.

The **Layout** and **Inspection** workspaces provide different panel arrangements. **Compare** places two viewports side by side so you can inspect the same ship from different angles or with different display settings. It does not load a separate ship into each viewport. Hover over a panel and press **Ctrl+Space** to maximize or restore it.

## Explore turret behavior and coverage

### Weapon Coverage: where can the turrets aim?

After attaching turrets, open **Properties > Turrets > Weapon Coverage** and enable **Show Weapon Coverage**.

- **Directional Slices** show coverage around a chosen plane. Outer arcs show distant aiming directions; the inner field shows nearby dead zones. Use top, side, or front views to examine different parts of the layout.
- **Spherical Heatmap** shows coverage around the ship at a chosen distance. Use it to spot weak directions and areas covered by several turrets.
- **Coverage Display** can show clear coverage, potential coverage, structural obstructions, or blind spots. Inspect a point to see contributing turrets and blocking geometry.
- Save a comparison baseline to see how a changed layout affects coverage. Spherical comparisons require matching radius and quality.

Coverage is an approximate geometric analysis under the displayed aiming assumptions. It does not measure damage or simulate combat, and the analysis radius is not weapon range.

### Turret Studio: how does a turret move and fire?

Open a turret library asset and select **Turret Properties**. This opens an isolated workspace for posing the turret, previewing tracking and firing effects, and arranging showcase cameras and playback.

Use it for a close-up demonstration of a turret design or an animated presentation. Firing visuals are approximations; playback does not reproduce the full game combat system.

## Choose an export

### Save a painted ship for Avorion

Use **File > Save preserved XML…** to download a copy with your paint changes while retaining the imported XML structure and original coordinates. Keep your original file too. This is the paint-saving route, not an export of every viewport, lighting, or studio setting.

**Ctrl+S saves the workspace layout, not the ship XML.** Browser-restored models and textures are convenient working copies, not backups.

### Export pictures and a rotating ship

Open **File > Advanced Export… > Image Export** and choose a goal:

| Export | Use it for… |
| --- | --- |
| **Screenshot** | A still of the current viewport's camera and appearance, without the app's panels or menus. |
| **Transparent render** | A ship cutout for compositing onto another background. Choose PNG or WebP to retain transparency. |
| **Blueprint** | A technical presentation with one view or a four-view sheet, optional grid, title block, dimensions, and annotations. Use **Customize blueprint...** to arrange it. |
| **Turntable GIF** | A looping, full-turn presentation of the ship. |

Still images support **PNG**, **WebP**, and **JPEG**. JPEG needs an opaque background. Choose the image size, check the preview, prepare the output, and download it. Blueprint dimensions use native model units.

Weapon Coverage overlays are currently viewport-only: they are not included in image or blueprint exports.

### Export a 3D model

Open **File > Advanced Export…**. Start with **Blender / game asset**, **Quick share**, or **3D print**, then choose the format and scope.

| Format | Best starting use |
| --- | --- |
| **GLB** | A single-file model for sharing or importing into 3D software. |
| **glTF** | A ZIP package containing the model, buffer, and metadata. |
| **OBJ** | A ZIP package with OBJ geometry, MTL materials, and metadata for other 3D tools. |
| **STL** | Print-oriented geometry without colors or block metadata. |
| **3MF** | A print-oriented package with explicit units and material information. |

Choose the whole ship, visible blocks, a selection, or a named region. Editable outputs retain block surfaces; **printable shell** combines them into a solid result. Print exports require preparation and validation. Check the processed preview and size before downloading; passing topology checks does not establish printer suitability.

Mesh exports do not reproduce the full viewport shader or its animated effects, and embedded turret designs are omitted. Use XML to retain the original embedded turret plans.

### Export turret animations or coverage data

In **Turret Studio > Export showcase**, choose **PNG** for a still, **PNG sequence ZIP** for individual animation frames, **GIF** for a short animation, or **WebM** for video when the browser supports it. Animation exports are silent; MP4 is not supported.

In Weapon Coverage's **Statistics and comparison** section, use **Export coverage CSV/JSON** to save analyzed targets, coverage counts, classifications, and contributing turret IDs for further review.

## A first project to try

Load a ship, inspect it in Material Preview, then switch to Solid or Wireframe to examine its shape. Try a small paint change and save a preserved XML copy. Finish with a Screenshot or Blueprint export. Explore turret placement and coverage when you want to examine the ship's weapon layout.

For more detail: [controls and settings](USER_GUIDE.md), [paint tools](PAINT_TOOLS.md), [image exports](IMAGE_EXPORT.md), [3D exports](ADVANCED_EXPORT.md), [Weapon Coverage](weapon-coverage.md), and [Turret Studio](TURRET_STUDIO.md).

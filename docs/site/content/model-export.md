# Export 3D models and print geometry

## Choose a starting goal

Open **File > Advanced Export…**.

| Goal | Starting use |
|---|---|
| **Blender / game asset** | Editable model for another 3D tool |
| **Quick share** | Convenient visible-block GLB |
| **3D print** | Sized printable exterior shell |
| **Custom** | Your own combination |

These are starting settings. Read the selected format, geometry output, scope, and size before downloading.

## Choose the format

| Format | Download | Main properties |
|---|---|---|
| **GLB** | One `.glb` | Basic materials, geometry, and metadata in one file |
| **glTF** | ZIP containing model, buffer, and metadata | Package for compatible 3D software |
| **OBJ** | ZIP containing OBJ, MTL, and metadata | Geometry and basic material transfer |
| **STL** | Binary `.stl` | Geometry only; no colors, metadata, or built-in unit field |
| **3MF** | One `.3mf` package | Explicit millimeter units and supported material information |

Mesh exports do not bake the full game-style shader, surface textures, secondary-color blending, glow sprites, or animated effects. Metadata can retain information that the visible mesh material does not reproduce.

Embedded turret designs are omitted by the documented mesh conversion. Do not assume a mesh contains every native turret plan or every item visible in another workflow. Read warnings and examine the processed result. Keep XML for original game data.

Mounted component geometry participates in supported mesh and image outputs.

## Choose geometry output

| Output | What it preserves or combines |
|---|---|
| **Editable grouped mesh** | Groups surfaces while keeping block intersections and internal boundaries |
| **Individual blocks** | Keeps blocks as separate objects |
| **Printable exterior shell** | Combines solid geometry and removes internal boundaries and overlaps |
| **Visual STL (block surfaces)** | Direct STL surfaces without shell union; intersections and internal faces can remain |

A shell can still contain separate disconnected solids. It does not add supports, thicken small details, or make separate pieces physically connected.

**Fill sealed cavities** fills enclosed air pockets when enabled. Openings to outside air stay open. Shell conversion can lose material boundaries; inspect the color warning.

Visual STL is useful when you need direct geometry. It is not proof of a printable solid. Its less restrictive download route does not repair a failed shell.

## Choose scope and filtering

| Scope | Inclusion |
|---|---|
| **Entire ship** | All live hull blocks, including hidden blocks |
| **Visible blocks** | The active viewport's visible blocks and filters |
| **Selected blocks** | Selected members, including hidden members |
| **Named region** | The region's members, including hidden members |

**Exclude zero / thin blocks** applies separately to every scope and is on by default. It excludes blocks with any dimension below 0.01 native units.

Also check transparency inclusion and any explicit problem-block exclusions. A scope name alone does not override those filters.

## Set size, units, and position

**Real scale (1 unit = 1 m)** is the default conversion for GLB, glTF, and OBJ goals. **Fit longest dimension** sizes the largest dimension to the millimeter value you enter. STL and 3MF use print-oriented sizing by default.

For printing, enter a known longest dimension and verify it in the receiving software. STL has no unit field, so tell the slicer to interpret its coordinates as millimeters.

| Output | Coordinate convention |
|---|---|
| GLB / glTF | Y up; meters |
| OBJ | Y up; millimeter coordinates by convention |
| STL / 3MF | Z up; millimeter coordinates; 3MF states its unit |

Under Advanced, **Placement** chooses centered, native imported, or displayed position. **Color source** chooses working or imported colors. These change the export copy, not the original XML file.

Remember that on-screen dimension labels use a separate conversion in this release. Use the export's size summary and the receiving program to confirm physical size.

## Prepare, inspect, and download

Editable GLB, glTF, and OBJ can prepare automatically after a setting change. Print and shell paths use **Prepare & Validate**.

After preparation:

1. Examine the processed preview.
2. Read the pass/fail line.
3. Open **Details** for diagnostics and warnings.
4. Check size, omissions, and visible shape.
5. Select **Download** when available.
6. Open the file in the destination software and verify it there.

**Preview processed mesh** reloads the result and resets its preview camera. Very large outputs can omit the preview without reducing the exported geometry.

The prepared file is a snapshot. Changing the live ship does not update an already prepared export. Prepare again when you need the new state.

## Use repair and recovery controls

The dialog can offer these actions when relevant:

- **Exclude zero/thin blocks & retry**.
- **Repair & revalidate**.
- **Resolve overlaps as shell**.
- **Keep blocks separate & retry**.
- **Select problem blocks in model**.
- Exclude identified problem blocks from the export.
- **Restore excluded problem blocks**.
- Retry with a stated **Solid tolerance**.
- **Export Visual STL instead**.

Excluding a problem block removes that whole block from this export, not only a damaged triangle. Inspect the shape after exclusion.

**Solid tolerance 0** disables optional extra simplification. A positive tolerance permits a surface change within that distance before output. It can remove small detail and does not guarantee a repair.

Failed mandatory shell or 3MF checks keep the validated download unavailable. Narrow the scope or use an appropriate alternative output. Do not label an unchecked visual export as a validated printable shell.

## Validate for the intended use

The app checks mesh connectivity and related geometry conditions. Passing those checks does not establish wall thickness, support needs, printer suitability, or freedom from every possible intersection.

For printing, inspect scale, thin details, cavities, disconnected parts, and supports in your slicer. For editing, verify object grouping, color, and orientation in the receiving program.

Large exports depend on browser memory. Reduce scope to a selection or region if necessary. Increasing the estimated working-memory budget does not increase device capacity.

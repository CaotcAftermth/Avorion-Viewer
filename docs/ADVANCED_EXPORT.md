# Advanced Export — milestones 1–4

Open **File > Advanced Export** after loading a ship or block preview. Start with a goal: **Blender / game asset** (GLB, editable grouped mesh, real scale), **3D print** (3MF printable shell, 100 mm longest dimension, sealed cavities filled) or **Quick share** (GLB of the visible blocks, real scale). A goal fills the form; changing any value switches to **Custom**. File format, geometry output, scope and size stay visible. Placement, colors, repair, transparency, thin-block filtering, cavity fill, solid tolerance and memory budget sit under **Advanced**, and rows that do not apply to the current format or mode are hidden.

**Size** is either **Real scale (1 unit = 1 m)**, the default for GLB, glTF and OBJ, or **Fit longest dimension** in millimetres, the default for STL and 3MF. Real scale passes `unitScale: 1000` (mm per native unit) to the pipeline, so glTF output stays at one metre per Avorion unit.

GLB, glTF and OBJ exports that do not use the printable shell prepare automatically about 400 ms after a change, and **Download** unlocks when the mesh is ready. STL, 3MF and shell exports wait for **Prepare & Validate**. Results show the processed preview first, then a pass/fail line; the full table and notes are under **Details**, and recovery actions stay visible when validation fails. The last settings for each format, the last format used and the Advanced open state are kept in `localStorage` under `avorion-viewer.export-settings.v1`. Excluded problem blocks and the chosen region are not remembered.

**Prepare & Validate** builds an immutable snapshot in a dedicated worker; **Preview processed mesh** reloads that result; **Download** writes it. Cancelling or closing terminates the worker. No uploads, external runtime requests, source XML writes, or paint-history changes occur.

## Delivered stages

1. Shared snapshot, scope, native/displayed/centered placement, uniform physical scale, reused block surfaces, worker progress/cancellation, topology diagnostics.
2. Binary STL and GLB with explicit scale conventions, flat normals, indexed GLB geometry, basic colors/transparency and independent validation.
3. Type/material/transparency grouping, optional individual blocks with shared GLB meshes, original block IDs, parent references, region names, primary and secondary ARGB metadata; OBJ/MTL and glTF/buffer ZIP packages.
4. Core 3MF ZIP packaging, explicit millimeters, base materials and objects; local Manifold WASM unions; serialized-output validation gates. Difficult inputs can still fail validation and are not offered as printable downloads.

Shader texture/secondary-blend baking, native emissive effects, normal maps, per-error-category viewport overlays, exhaustive self-intersection scans and printer suitability analysis are outside these stages. The processed preview highlights problematic triangles in red; the source-block selection button identifies contributors when attribution is available. Boolean shell attribution is not retained.

## Formats and units

| Format | Output | Axes and units | Modes |
|---|---|---|---|
| STL | Binary `.stl` | Z up, millimeter coordinates; STL has no unit field | Visual block surfaces or validated printable shell |
| 3MF | `.3mf` | Z up, explicit `unit="millimeter"` | Shell, grouped, individual; every mesh must pass topology validation |
| GLB | `.glb` | Native Y up, meters per glTF specification | All modes |
| glTF | ZIP: `model.gltf`, `model.bin`, `metadata.json` | Native Y up, meters | All modes |
| OBJ | ZIP: `model.obj`, `model.mtl`, `metadata.json` | Native Y up, millimeter coordinates by convention | All modes |

The size summary uses native X/Y/Z axes. Print files rotate `[x,y,z]` to `[x,-z,y]`, preserving handedness. GLB embeds metadata in `extras`; 3MF stores it in `Metadata/avorion.json`. STL cannot retain block metadata or colors. Metadata records export transforms; these do not alter the original ship.

All means every live ship block, including hidden blocks. Visible respects the active viewport's visibility/thin-block filters. Selection and named-region scopes include their members even when hidden. Embedded turret designs are omitted, matching the viewer's existing lack of turret assembly transforms; the dialog reports their omission. XML export remains available separately with turret plans and unknown attributes intact.

## Geometry and validation policy

- Editable grouped output preserves intersections between blocks. It combines triangles by block type, material and color without an expensive union. Each block retains its own vertex connectivity within the group, so shared positions do not create artificial non-manifold edges. Intersections remain explicitly reported as unchecked. Individual mode avoids grouping blocks into the same mesh.
- Shell mode performs a solid union, removes internal boundaries and resolves overlaps. Disconnected solids remain. Enclosed cavities remain unless **Fill sealed cavities** is explicitly enabled. Openings to outside air stay open. It does not manufacture supports, thicken details, or preserve material boundaries. Shell color is the first included material, with an explicit warning.
- Unknown shapes, nonpositive bounds, invalid orientations/numeric XML values and malformed ARGB fail explicitly. Export never substitutes unknown blocks with boxes.
- Shared hangar surfaces require T-junction subdivision. Optional cleanup corrects block winding and removes duplicate/degenerate faces. These changes stay within the export copy. Hangar rim/depth still match the viewer's existing approximation, not a new claim of calibrated native geometry.
- Manifold's merge mapping and union surface constraints are preserved. Coincident vertices from separate shells are not indiscriminately welded after union. Intermediate `asOriginal()` simplification and final mesh re-ingestion are deliberately avoided: both damaged Tachi's hull despite producing closed topology. Targeted float32 repair runs on the output, followed by independent topology checks.
- **Solid tolerance** defaults to **0**. Positive values explicitly request Manifold simplification within the entered millimeter tolerance before float32 serialization. Maximum permitted tolerance is 1% of the longest dimension. It may remove small details; inspect the processed mesh. It is not a guarantee of repair.
- Diagnostics count triangles, vertices, boundary/non-manifold edges, non-manifold vertex fans, duplicate/degenerate faces, components, and consistent winding. Closed topology does not prove freedom from geometric self-intersections or printer suitability.
- Shell exports and 3MF downloads are blocked if mandatory output checks fail or exceed the validation budget. Mesh validation is separate from Watertight topology: closed edge/vertex connectivity can pass while zero-area triangles still fail overall validation. No blind hole filling or undocumented voxel approximation is used.

## Performance and limits

The worker owns geometry, validation, solid processing and encoding. Only snapshots and bounded preview data cross the thread boundary. Detailed GLB reuses geometry/accessors across instances. Preview is omitted above 500,000 triangles or 2,000 objects without reducing export geometry.

Working-memory budget is a conservative **estimate**, not a browser-enforced memory limit. Preflight estimates 6,000 bytes per block for editable export and 20,000 for solid processing. Complex unique shapes, JavaScript maps, ZIP encoding and WASM can exceed estimates. Validation has a separate triangle budget; large unchecked meshes cannot be downloaded as validated shells. Export a selection or region if memory is insufficient. Full 500,000-block export is not certified; its default-budget rejection is tested.

Current local `Ship Stress Test.xml` contains **40,429** exportable ship blocks and **13,034** embedded turret-design blocks. Grouped GLB produced 282 objects, 395,352 triangles and a roughly 45.6 MB file in about 2.5–3.3 seconds during local testing. A 25 ms UI heartbeat continued; measured maximum interval was about 40–47 ms during worker preparation/encoding. This is a local benchmark, not a cross-device performance promise. Source XML comparison was unchanged.

The full Stress Test now passes strict shell validation and serialization in STL, 3MF, GLB, glTF and OBJ at 100 mm with zero optional simplification tolerance. The repair preserves surface geometry and connectivity instead of discarding collapsed triangles. Independent slicer import, minimum wall thickness and print suitability remain separate checks.

## Test criteria

| Check | Acceptance |
|---|---|
| Cube and all eight shapes × 24 orientations | Closed topology, outward volume, preserved geometry and dimensions |
| Adjacent, overlapping and duplicate cubes | Union volume matches analytic result; no internal shared face remains |
| Disconnected and point-touching solids | Preserve separate shells without welding their contacts |
| Angled wedge intersection and recessed hangar | Union and output topology pass; bay recess remains |
| Corrupted mesh | Detect open edges, duplicate/degenerate faces, invalid indices, inconsistent winding and disconnected vertex fans |
| Size and coordinates | 100 mm longest dimension; uniform proportions; STL/3MF Z-up rotation and glTF meter conversion |
| Selection/visibility/region snapshots | Correct membership, source coordinates and both ARGB channels; no source mutation |
| GLB/glTF | Khronos validator reports zero errors and zero warnings |
| STL/OBJ | Independent Three.js loaders parse geometry and expected bounds/normals |
| 3MF | Independent ThreeMFLoader parses mesh/bounds; Python ZIP CRC, XML, units, references and secondaryColor checks pass |
| Browser workflow | All five formats download; preview renders; empty scope errors; cancel and close clean up; no page errors or external requests |
| Large ship | Grouped export completes; source XML unchanged; UI heartbeat continues; invalid shell is blocked |
| Regression | Full existing Node suite and 28 graphics checks pass |

Commands (run the local server before browser checks):

```sh
npm ci
npm test
node tests/export-ui.check.mjs
python tests/export-package.check.py
node tests/export-stress.check.mjs
node tests/export-stress.check.mjs --shell
node test-results/check-graphics.mjs
npm run build
```

Browser check scripts use the local Playwright runtime and Edge channel. The stress check reads the user's existing local ship fixture. Python package verification reads files produced by the UI check. Blender 5.2.2 was subsequently found and used for native STL, OBJ, GLB and glTF imports, comparison renders and independent surface checks. STL import welded coincident positions and removed 70 duplicate triangles on the 200 mm Tachi; sampled exterior surfaces remained unchanged. This importer behavior is separate from the indexed topology validation. A slicer and printer have not been tested. Manual T&E should still check supports, thin walls and physical print suitability.

## Dependency and code map

- `src/export/snapshot.js`: scope and immutable plain-data capture.
- `pipeline.js`, `mesh.js`, `solid.js`: shared surfaces, diagnostics, safe cleanup and boolean processing.
- `formats.js`: indexed GLB/glTF, binary STL, OBJ/MTL, core 3MF.
- `worker.js`: processing/encoding lifecycle; `dialog.js`, `preview.js`, `export.css`: native UI and processed-mesh preview.
- `src/vendor/manifold/`: manifold-3d **3.5.4**, Apache-2.0, JS plus WASM; copied from the pinned npm package's `manifold.js`, `manifold.wasm`, and `LICENSE`.
- `src/vendor/fflate.js`: fflate **0.8.3**, MIT; copied from `fflate/esm/browser.js`, license beside it. Version 0.8.3 avoids the earlier malformed-ZIP64 advisory.
- Development-only independent validators: gltf-validator **2.0.0-dev.3.10**, Three.js **0.169.0** loaders. Production uses locally vendored assets and requires no npm runtime installation or network access beyond serving the local app.

Runtime dependency audit: zero reported vulnerabilities after the fflate update. Static hosting must serve `.wasm` as `application/wasm`; the bundled server now does so.


## Thin blocks and recovery actions

**Exclude zero / thin blocks** defaults on in the export dialog. It reuses the viewport rule: any dimension with absolute size below **0.01 native units**. It applies to all export scopes, independently of viewport visibility, before geometry validation and physical scaling. Counts appear in the summary and metadata. Original model/XML remain untouched.

A **Resolve export issues** panel appears above failed diagnostics. Depending on the failure/settings it offers:

- Exclude zero/thin blocks and retry.
- Repair and revalidate when winding/face cleanup was disabled.
- Resolve grouped overlaps as a shell, or retain separate blocks instead.
- Select identified source blocks, or explicitly exclude them from this export and retry. Exclusion removes whole blocks, not merely bad faces. **Restore excluded problem blocks** reverses these exclusions.

Invalid input reports carry source IDs through the worker. Errors after boolean union may have no reliable source attribution; those cannot offer selective block removal. Existing Solid tolerance and scope controls remain available, and failed shells stay blocked. Recovery does not promise to fix every mesh.

Regression checks: `node tests/export-recovery.check.mjs` exercises the real dialog's filter, retry, exclusion/restore, union recovery and winding repair. Unit coverage verifies threshold boundaries, all scopes, exclusion counts, multiple invalid IDs and preservation of model data. The real Stress Test filters **90** thin blocks, leaving **40,339** blocks; its shell now passes with **zero** degenerate triangles at zero optional tolerance.


## Restored v3 STL workflow

Choose **STL > Geometry output > Visual STL (block surfaces)** for direct block geometry without Boolean union. Internal faces and overlaps remain; topology diagnostics do not block this visual download. **Printable exterior shell** retains strict output validation. Failed shell preparation offers **Export Visual STL instead**, which prepares a fresh original-block snapshot rather than downloading the failed union.

Shell construction reuses v3's unit geometry and kernel transforms, analytic hangar subtraction, and spatial median partitioning into 16-block leaves. It retains each union's surface constraints rather than applying v3's intermediate `asOriginal()` simplification. Physical scaling happens after the native-unit union. Cavity filling is opt-in. Float32 cleanup includes topology-preserving retriangulation, with the repaired candidate accepted only if independent validation passes within the triangle budget. A labeled small-tolerance retry is available; it changes geometry within the selected tolerance and is not guaranteed to fix a model.

Verified: all 8 shapes in 24 orientations for both visual and shell paths; overlaps, duplicates, disconnected and touching solids; sealed cavity fill versus open recess preservation; independent STL loading and unchanged source data. Browser checks download both STL modes plus the other formats. The 40,339-block Stress Test's Visual STL exports 394,272 triangles / 19,713,684 bytes in about 1.8 seconds with source XML unchanged. After removing the destructive simplification, its shell validates and serializes in all five formats in approximately 35–43 seconds per export on this machine.

Additional stress command: `node tests/export-stress.check.mjs --visual`.


## Precision repair and completed real-model checks

`src/export/repair.js` preserves half-edge adjacency while flipping collinear triangles into valid neighboring triangles. Collinear strips can use strictly shorter intermediate diagonals to reach valid triangulation without cycling. Zero-length edges are stitched, opposite coincident zero-volume faces are cancelled, and separate contacts retain separate connectivity. Parallel topological edges receive distinct midpoint vertices; their float32 rounding is recorded in millimeters. Where a contact edge has no representable float32 midpoint, only its participating endpoints are rounded to that midpoint and the original closed topology is repaired again. These exceptional contacts and a cumulative displacement bound are reported. The Stress Test required a bound below 0.0000024 mm at 100 mm overall size. No voxel resampling, hole filling, blanket tolerance welding, arbitrary face deletion, or source XML mutation is used. The strict mesh validator remains the download gate.

GLB/glTF repairs run in meter precision. The exporter retains double-precision millimeter equivalents until final serialization, avoiding a second float32 rounding that previously reintroduced degenerate triangles. The dialog's default memory budget is now 1,024 MiB, sufficient for the Stress Test's 770 MiB preflight estimate. The budget remains editable; it is an estimate, not a browser memory guarantee.

Acceptance checks now include:

- Collinear triangle repair preserves the original surface vertices and volume.
- Collapsed-edge repair stitches adjacent faces without opening holes.
- Open meshes are not silently filled; valid tiny triangles are preserved.
- Grouped 3MF retains closed independent block topology instead of welding block contacts.
- Real Stress Test strict shell exports: STL / 3MF / OBJ have 450,492 triangles; GLB / glTF have 450,354 triangles at their meter output precision. All pass; re-reading serialized coordinates finds zero degenerate triangles. 3MF vertices/indices independently pass full mesh validation after XML decoding.
- Tachi strict shell exports at the user's 200 mm size: STL / 3MF / OBJ have 113,704 triangles; GLB / glTF have 113,784 triangles. All pass, including serialized-file checks.
- Source XML remains unchanged and UI heartbeat continues during worker preparation.

Run `node tests/export-roundtrip.check.mjs`, optionally with `--tachi` or `--grouped`, for real-model preparation, encoding, file decoding and triangle/topology checks. Results are written under `test-results/export-validated-*.json`. This checks actual generated data; it does not claim that a particular slicer or printer has been tested.

## Exterior surface regression

Topology validation alone missed the original hull damage. Regression coverage now also compares the exported exterior against the original viewer block surfaces. `node tests/export-surface.check.mjs [metadata.json]` reconstructs the saved export settings and block snapshot, writes all five formats under `test-results/tachi-corrected`, decodes their actual serialized coordinates, and checks finite vertices and nondegenerate faces. It leaves the source metadata unchanged.

Run `blender -b --factory-startup --python tests/export-surface.check.py` afterward. Blender's independent BVH casts a 300 × 220 grid from six directions for each decoded format. Acceptance: no missing or extra silhouette hits, and no surface-depth discrepancy above 0.005 mm for this 200 mm fixture. All five corrected Tachi formats pass. The old OBJ had 378 mismatches in the earlier focused comparison view; the repaired mesh had zero under the same test. This sampling supplements topology checks; it is not an exhaustive proof for arbitrary models.

Comparison renders retain fine lines that are also visible in the original block geometry. Source surfaces are not automatically flattened or smoothed across intended hard edges. The native Blender import comparison and its renders are saved under `test-results/tachi-corrected` as additional local evidence.

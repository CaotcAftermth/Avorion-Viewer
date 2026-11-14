# Memory & Performance Diagnostics

Open **Help → Developer → Performance Diagnostics**. Check **Enable diagnostics**, close the panel, and reproduce the workload. Reopen the panel to download **avorion-performance-diagnostics.json**. Enable before loading a ship to capture its import and first frame. Closing the panel keeps collection active. Disabling it drops the session. **Reset session** starts a new baseline without reloading the viewer. Diagnostics stay off at startup and use browser-local processing.

Use **Lightweight** for stress runs. It samples rendering at four times the configured interval and skips GPU timer queries. For pass-level GPU timing, enable **GPU timing** on a supported WebGL2 context. It uses asynchronous timer queries with a bounded queue, polls only for available results, and drops disjoint or stale samples. [Khronos timer query specification](https://registry.khronos.org/webgl/extensions/EXT_disjoint_timer_query_webgl2/)

## Reading the report

| Category | Meaning |
| --- | --- |
| Session and operation timeline | App version, browser, model revision and block count, operation settings, elapsed time, and outcomes. XML import records read, DOM parse, logical extraction, embedded-asset restoration, build and installation, and first model frame submission. Geometry worker round trip includes queueing, worker startup, computation, and message delivery. It cannot isolate native transfer latency. |
| Hull | Retained typed-array bytes, indices, attributes, template and instance storage, buffer count, and logical/submitted geometry counts. Detailed batch breakdown is capped at 64. Reported triangle counts here describe geometry before render-pass culling. The expanded path currently uses 188 attribute bytes per vertex. Builder staging records numeric slots and estimates based on eight bytes per slot. JavaScript array capacity, object storage, BVH object overhead, and transient per-block arrays are outside that estimate. |
| Geometry worker | Exact packed and returned typed-buffer byte counts and worker-side durations. IDs, ranges, and picking trees use structured clone. Their native allocation and copy sizes are unavailable. |
| JavaScript heap | Browser-provided value where exposed, sampled at most once per five seconds when reading a report. This API is browser-specific and can report coarse values. It does not establish backing-store, native DOM, GPU, or browser-process memory. |
| CPU geometry | Observed attribute and index backing stores, deduplicated by ArrayBuffer identity. A shared backing store is assigned to its first observed category. |
| GPU geometry, textures and render targets | Estimated resource footprints. Geometry uses attribute lengths and attribute identity. Textures use source dimensions, layers/faces, channels, element width and generated mip levels. Render targets account for color, a four-byte depth assumption, multisample and resolve storage. Observation and disposal are application events. Driver storage, alignment, default framebuffers, cross-context duplication, delayed reclamation, and resources outside the instrumented paths are unavailable. |
| Mesh export | Snapshot creation, logical clone-size estimate, worker build/validation/shell stages, typed geometry retained by the worker, preview copy, render geometry created by the processed preview, encoding, and Blob/output size. glTF, GLB, OBJ, and 3MF report known encoding inputs or buffers. STL reports its encoded transfer. Worker output is transferred. The preview payload is cloned. The joint worker/preview high-water mark covers distinct known typed buffers and excludes heap objects and native copies. |
| Image and animation | PNG, WebP, JPEG, blueprint, turntable GIF, and Turret Studio PNG/GIF/WebM/sequence runs record output bytes and relevant image/tile counters. RGBA backing store estimates use four bytes per pixel. Frame counts, average and peak render time, encode time, retained encoded bytes, and available encoder queue depth aggregate over the run. Native encoder scratch, decoded image storage, and canvas backing implementation are browser-dependent. |
| Shell and Wasm | Solid input, union, extraction, repair, validation, cleanup, and output bytes. Linear-memory capacity is reported if the current Manifold module exposes it. Live Wasm allocations and the browser-process footprint are unavailable. |
| Viewport and preview rendering | Latest sampled render submission duration, interval since the preceding draw, per-pass calls/triangles/lines/points, context IDs, attachment meshes, and changed attribute capacities. Attribute capacity is distinct from the number of bytes uploaded. Three.js counters are read immediately after each instrumented pass. Cube-map generation and driver-internal passes are outside this pass breakdown. |

Current and peak values are scoped to the observed lifetime of each resource category. Missing values mean no observation or unavailable. A zero indicates a tracked category has been logically released. Memory domains can overlap. Keep their peaks separate when comparing runs. Resource ownership is attributed at first observation. The collector caps the timeline at 256 events, view histories at 64, and tracked live Three.js resources at 8,192. It reports dropped events and skipped resource observations. It keeps no per-block diagnostic records and holds Three.js objects only by weak identity.

The report omits original XML, model names, paths, coordinates, and textures. The current filename appears only in the open panel. The static app exposes its version. This build does not embed a Git commit ID.

## Baseline procedure

1. Enable diagnostics before import. Use a fresh session for each workload and keep viewport count, shading, texture library, and device pixel ratio fixed.
2. Import the model. Wait for the first model frame, then open additional viewports or exercise selection and painting as needed.
3. Prepare the target export. Download a report while its result and preview are open. Download the export, then close the dialog. Capture a second report after cleanup.
4. Repeat with cancellation during preparation. Clear the model and reload it. Compare the owner counts, phase timestamps, and per-category peaks.
5. For a large run, keep the panel closed during the workload and use Lightweight mode. Save separate reports for import, mesh preparation, and animation if the timeline wraps.

Automated checks use `node --test tests/performance-diagnostics.test.mjs`. The browser check `node tests/performance-diagnostics.check.mjs` uses an existing Playwright installation and Chrome. Set `AVORION_PLAYWRIGHT_URL` to the local Playwright module URL if it is outside the repository. It exercises the app menu, XML import, mesh prepare/download/cancel, preview disposal, clear and reload, JSON download, rendering parity, image cancellation, and a generated 40,339-block worker job. No binary fixture is required.

### Counted hull construction

The hull writer counts vertices from shared topology and writes final attribute buffers directly. The legacy staging counters retain their meaning and report zero for this writer. The hull construction event records final attribute and index bytes, largest batch bytes, and vertex and instance counts. A separate event records classification, sizing, and writing with bounds calculation. Worker replies include the same metrics under `construction`. Finalization time includes picking tree setup, which is also reported separately. On worker installation the payload already owns its attribute buffers.

These figures exclude block-local surface and crease scratch, classification records, seam processing storage, picking metadata, transparent sort records, and runtime pose copies. Zero model-scale numeric staging describes the hull attributes and initial blended indices. It does not measure worker heap or peak browser-process memory.

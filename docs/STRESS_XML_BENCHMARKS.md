# Extreme-scale XML development fixtures

Run from the repository root with Node 22 or later. The generator and grouping model use Node built-ins and the viewer's existing block definitions and orientation helpers.

```powershell
node scripts/generate-stress-xml.mjs --help
node scripts/generate-stress-xml.mjs --profile canonical --preset smoke
node scripts/generate-stress-xml.mjs --profile adversarial --preset medium --unsupported-percent 15
node scripts/generate-stress-xml.mjs --profile station-replica --source "C:/path/Station Stress Test.xml" --preset station-xl --output output/stress/station-xl-500k.xml
node scripts/model-stress-xml.mjs output/stress/station-xl-500k.xml m5
```

`--blocks` selects an exact count. Presets are smoke (1k), small (10k), medium (100k), station-xl (500k), station-xxl (1M), megastructure (2M) and extreme (5M). The last two are explicit commands. The default output is under the existing ignored `output/` directory. Existing XML and manifest files are protected from overwrite. Keep the original source and generated fixtures out of Git.

## Profiles

- **station-replica** reads one native hull plan from the supplied source. It accepts native ship, ship_design and bare plan roots with direct item/block records. It omits ancillary ship metadata and embedded turret designs. One source root is required. Parent indices may be sparse or out of order. The generator validates uniqueness and parent existence, then produces a breadth-first ordering from the root. A partial copy takes a parent-closed prefix. Each copy root attaches to item zero across a documented physical gap. Copies are displaced along X by an integer greater than the full source width. Decimal translation preserves the source endpoints exactly at serialization precision. Browser parsing still uses JavaScript Number and the renderer still applies its normal Float32 precision guards. Full copies preserve the source composition. Remainders may bias the distribution toward nodes near the original root. The seed is recorded and has no effect on the station copy order.
- **canonical**, also called **canonical-mixed**, builds four plate arrays around a longitudinal spine using the current canonical box and wedge families. Default weights are 44 Smart Hull, 32 Smart Hull Edge, 9 rectangular Glow, 12 Glow Edge and 3 Armor. Procedural choices derive from the seed, item index and channel. Materials, dimensions, orientation and colors vary independently. **canonical-uniform** uses the same panel geometry with fixed dimensions and one default material.
- **adversarial** uses the panel arrangement with corners, twisted shapes, hangars, directional thrusters, glass and other noncanonical blocks. Set the unsupported share with `--unsupported-percent`. It also includes thin and stretched blocks. Material, orientation, dimension, pitch and plate size controls let the same profile stress different spatial groupings.

Procedural controls include `--types 2:3,100:5`, `--materials 0:1,5:2`, `--orientations 1/3:1,5/3:1`, `--dimensions .5:1.5`, `--pitch 4` and `--module-side 32`. `--gap` applies to station replication. See `--help` for the exact syntax. Physical game connectivity and buildability are outside this fixture contract.

## Integrity and storage

Generated items have consecutive native indices. Every non-root parent precedes its child, which guarantees one root and an acyclic hierarchy. Blocks are validated against the viewer's known native type/material/orientation definitions. The generator emits numeric coordinates and validated hexadecimal colors without interpolating arbitrary text into XML. A companion `.manifest.json` records actual type, material and orientation counts, bounds, dimension ranges, byte length, checksum, source hash and replication details. Generation duration and output paths can differ between manifests. Identical effective inputs produce identical XML.

The writer buffers 1,024 items at a time and honors backpressure. It stages both files on the destination volume and publishes exclusive links after generation succeeds. A filesystem supporting hard links, such as NTFS, is required. SIGINT/SIGTERM cancel an active generation and remove temporary files. A forced kill can leave temporary files. Station replication retains one source plan and its hierarchy. Output copies are streamed. Procedural fixtures do not retain block objects for the complete model.

## Grouping model

```powershell
node scripts/model-stress-xml.mjs output/stress/station-xl-500k.xml m5
node scripts/model-stress-xml.mjs --project --profile canonical --blocks 2000000
```

The model checks a generated file's checksum and simulates current renderer eligibility, centered coordinates and batch admission. `--project` computes the same estimates directly from generator options without writing XML. It retains one counter per distinct group, so extremely fragmented fixtures can still need substantial estimator memory.

Current group minimum is 16, chunk maximum 1,024 and shared allowance `max(16, 2 * ceil(liveBlocks / 1024))`. The cell edge is `max(1, largestModelSpan / max(1, cbrt(liveBlocks / 1024)))`. Groups sort by descending population and consume all their chunks together. M5 removes orientation from eligible canonical keys. Type, material and spatial cell still partition candidates. A group that misses the minimum or remaining allowance expands in full. Estimates account for the 172 B expanded vertex layout, 80 B template vertices, 104 B legacy instances, 116 B M4 boxes, 128 B endpoint instances and blended indices. They cover hull buffers only.

## Run the browser benchmark

Use Chrome with hardware acceleration and Playwright installed separately. If Playwright is available from another runtime, set `AVORION_PLAYWRIGHT_URL` to its ESM entry URL. The runner starts a loopback-only fixture server and opens an isolated Chrome session. It checks the actual WebGL renderer, verifies fixture checksum before opening Chrome, enforces a serial-run lock, writes checkpoints, and closes the browser on failure. On large runs it monitors available system RAM. It uses the existing renderer and memory safeguards.

```powershell
$env:AVORION_PLAYWRIGHT_URL = 'file:///C:/path/to/playwright/index.mjs'
node scripts/benchmark-stress-xml.mjs output/stress/station-xl-500k.xml output/stress/station-xl-500k.json
```

Defaults are M5, ANGLE D3D11, 640×480, DPR 1, Solid shading, a 10,000,000-unit far clip for long structures, shadows enabled, and one cold load. A trailing number requests warm reloads. `AVORION_MODES=legacy,m4,m5` compares small fixtures. At 500k and above use M5. `AVORION_PARSE_ONLY=1` exercises the actual XML importer and records the parsed block count without building geometry. `AVORION_TIMEOUT_MS` controls the per-run timeout. `AVORION_MIN_FREE_MIB` controls the large-run host headroom floor (default 4,096 MiB). A report contains the last stage reached, model estimates and raw browser diagnostics. PNG captures accompany completed rendered runs.

Start with smoke imports and 100k worker runs. Establish 500k headroom before attempting 1M. Leave 2M and 5M for explicit runs. Use a distinct output path per comparison. Preserve a failed report before retrying. Fixture transport, parser, worker and first-frame failures are different outcomes. Compare measured JS heap, system RAM, CPU geometry buffers, nominal GPU resources and worker transfer sizes separately. The runner does not measure GPU allocation, worker heap peaks or isolated XML DOM bytes.

The viewport harness calls the actual importer and renderer, including Frame All and a bounded orbit and edit loop. The full app adds additional UI, persistence and editing overhead. Treat these benchmarks as measurements of the documented harness and hardware. Run normal tests with `npm test`. For the importer integration, generate a canonical smoke fixture and run the benchmark in M5. The runner requires exact logical count and a nonzero discrete instance count.

## Fixture scope and measurements

Station source input uses UTF-8 with a single direct hull plan. The source reader supports quoted native scalar attributes and comments and is not a general XML schema validator. The browser integration parses generated output with the actual viewer DOM importer. Procedural extents use a small binary lattice, so the manifest records actual extents after quantization. Extremely small dimensions at distant coordinates can trigger the existing endpoint guard.

For benchmark interpretation, the bundled runner logs file read, DOM parsing, extraction, placement, Frame All, worker construction, installation, first-frame submission, and interaction stages. A completed canvas readback provides the first image. The worker installation phase includes shader preflight. The edit loop mutates the working color and exercises the renderer's dirty-attribute path. It does not measure the entire brush UI or undo history. GPU query samples are asynchronous and sparse. Use phase counts and raw values when comparing them.

## Generate from the viewer

Open **Help > Developer > Generate Stress Test XML** to choose a profile, size and seed, then save XML. Station Replica asks for the source XML. The dialog provides a separate manifest download after generation. Chromium browsers with direct file saving stream to disk. Other browsers use a bounded download and may need a smaller fixture. Direct saves omit the checksum to avoid reading the completed XML into memory. The grouping estimator computes the checksum when inspecting the file.

Enable M5 in **Edit > Preferences > System > Viewport Rendering > Hull Renderer > Canonical (Experimental)**. The viewport footer identifies the active renderer and indicates a fallback or a model with no canonical batches. The setting is local to the browser and the default remains Legacy.

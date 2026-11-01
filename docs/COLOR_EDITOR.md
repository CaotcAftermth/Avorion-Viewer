# Color Editor architecture

## Inspected systems and reuse

The existing app uses vanilla JavaScript, a binary split-tree layout (`layout.js`), shared scene state and editor lifecycle (`app.js`), stable block IDs and Outliner selection (`ship-structure.js`), and incremental GPU appearance updates (`game-renderer.js` and `texturedModel.js`). `block-colors.js` already returned before/after appearance patches. It did not previously provide a named palette, region membership, saved palettes, or an undo stack.

The new editor is another native area type. It uses those same block IDs and appearance transactions; it has no second model or renderer. Existing preview repaint controls remain available and now participate in color history. Selection does not depend on DOM rows, GPU instances, or spatial chunks.

## Authoritative data

`src/data/avorion-rgb.txt` is an unmodified copy of the installed game's `data/rgb.txt`. Its provenance hash is in `avorion-palette-source.json`. It has 407 records: 132 unprefixed bases and 275 prefixed variants. There are no unmatched variants. Names and RGB components come directly from that file; hex strings are exact encodings of those components. The original row number is shown as **Row**, not presented as a verified game ID. No mockup numbers or CSS named-color values were substituted.

`color-palette.js` matches only exact `Star`, `Eternal`, `Infinity`, or `Solar` prefixes to an existing unprefixed name. Absent variants remain absent; for example, Snow has no Star entry. A malformed dataset fails instead of silently generating colors.

The original file has no category metadata. Viewer browsing categories use explicit neutral/beige/brown name rules and saturation/lightness thresholds, then hue ranges for chromatic categories. These derived categories are labeled as viewer groupings. OKLCH chroma below 0.08 moves bases off the wheel; OKLab lightness at least 0.88 puts them in Pale / Near-white, otherwise Muted / Neutrals. These are viewer design thresholds, not universal color boundaries. There are 74 chromatic bases available to the wheel sampler. Off-wheel colors remain in List categories, without duplicate groups on Wheel. Every List category sorts by ascending OKLab lightness, then source row for ties; filtering and variant inclusion preserve this order. Every original base remains selectable with its variants. The Family Fan wheel has 12 hue families separated by 3-degree gutters. Each fan has three angular columns and four tonal bands constrained to increase in lightness outward. Its central comparison disk occupies about 40% of the outer wheel diameter, with the harmony caption below the wheel. Each cell samples an actual base color near that hue, balancing hue distance and target lightness. Sparse ranges repeat existing colors; no RGB values or variants are synthesized. All 132 bases remain accessible through List, including bases not selected by the wheel sampler. Selection markers use the actual base hue. Wheel and List are separate tabs so the wheel, comparison panels, visual harmony controls, and suggested palette strips remain a compact workspace.

## Harmony mapping

The base RGB is converted to HSL. Hue offsets are 180° for complementary, ±30° for analogous, 150°/210° for split complementary, 120°/240° for triadic, and 60°/180°/240° for tetradic (a rectangular tetrad). Targets wrap modulo 360. Candidate colors are chromatic bases only, excluding the selected base.

Matching retains HSL base-hue targets but balances appearance using OKLab lightness and OKLCH chroma. Candidates must lie within 8 degrees of the nearest eligible hue error. The score is `(hueError/20)^2 + (lightnessDifference/0.25)^2 + (chromaDifference/0.12)^2`; lowest wins, with hue error then source row breaking ties. These weights are explicit design choices, not a universal harmony standard. The interface labels the result as a balanced base rather than the nearest hue. Near-neutral bases do not receive arbitrary hue harmonies. RGB values are never altered. Conversion follows [Ottosson's OKLab reference](https://bottosson.github.io/posts/oklab/).

The previous `test-results/harmony-audit.json` records the old hue-only algorithm and is not validation of this matching policy.

Variant choices are keyed by base name, independently of this calculation. Optional linking copies the primary variant only to suggested families that contain it; other choices stay unchanged. Palettes may mix any existing variants, including unrelated families selected through the list.

## Ownership and persistence

- Area state: current base, variant choices, active paint color, harmony, search/category, tabs, collapsed groups, region target, and palette draft. Existing layout persistence stores it.
- Scene state: selected block IDs, named regions, and paint history. Regions are reusable ID sets for one loaded model, not geometric volumes or appearance layers. Overlap means the later explicit fill wins. Region edits (`addRegion`, `renameRegion`, `deleteRegion`, `editRegion`, `growRegion`) replace `scene.regions` with a new array and push the previous array onto a model-scoped 30-step region undo stack. `touchingBlocks` finds blocks whose bounds touch the seeds using a uniform spatial hash. `region-display.js` owns the live viewport display (`scene.regionDisplay`): highlight sets state bit 4 on the textured model (tinted with the region color in the game shader), and isolation rewrites `scene.hiddenIds` after every region edit, restoring the earlier visibility when it ends. `scene.regionEdit` routes viewport clicks and box drags to region membership instead of selection (Ctrl removes).
- Model state: actual ARGB values, appearance dirty IDs, and color overrides for export.
- Browser storage: saved palettes contain verified color names, not arbitrary RGB values. No remote persistence is used.

`color-workshop.js` wraps existing patches with undo/redo, filters target IDs against live blocks, and supports selected-block and region fills. Paint history is model-scoped and limited to 30 operations and about one million changed records (the latest transaction is always retained). Undo/redo uses the same incremental update path. Model replacement resets history. Region creation and palette saving are metadata operations, outside paint undo.

The low-level appearance API keeps its existing XML-writing default for compatibility; app UI commands use `writeXml:false`. The imported document is left unchanged. Export clones it and applies overrides to corresponding block nodes, preserving unknown content and native placement. Missing secondary color and explicit `00000000` remain distinct, including undo. Source files are only read; saving produces a browser download.

## Validation

`tests/color-workshop.test.mjs` covers dataset identities, missing variants, fixed wheel hue positions and radial lightness ordering, nearest-hue rules, region targeting, alpha preservation, undo/redo, source-node immutability, and saved palette validation. `tests/graphics.browser.js` verifies that Apply changes pixels and Undo restores them without RGB edits rebuilding geometry. The browser integration check in `test-results/check-color-editor.mjs` exercises real editor switching, independent variants, selected and region painting, XML downloads, local palettes, narrow layouts, and absence of external requests.

## Compact wheel palette

The wheel shows one horizontal palette for the chosen base and current harmony. Each swatch has its own existing-variant dropdown. The black-to-white slider previews a grayscale target and chooses the nearest grayscale Avorion base in OKLab on release; it never creates paint RGB values. Apply-to-selection, region, channel, and history controls are available from the header Apply menu instead of a permanent footer.

Tab toggles Object and Paint in the viewport, except while typing or interacting with dialogs. The shortcut is configurable in Keymap preferences.

The paint toolbar Model Palette lists actual RGB colors by descending block count, counting identical primary and secondary RGB once per block and omitting disabled secondary overrides. Counts update after appearance changes and undo. Imported RGB colors without a named palette match remain visible, with their value and count in the tooltip. Grayscale selections have no hue harmony; lighter and darker grays can form a tonal palette.

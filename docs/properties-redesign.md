# Properties redesign: GitHub repository port

This implementation targets `C:/Users/joshu/OneDrive/Documents/GitHub/Avorion-Viewer` (version 0.11.63). The earlier implementation and its report were produced against the older `Avorion Viewer 4 (Blender Based)` directory. Their conclusion that the Component System was absent does **not** apply to this repository.

## Preserved architecture

The port was prepared from the current working tree, including existing uncommitted attachment work. It preserves component sockets and persistence, symmetry, attachment placement, source provenance/revisions, source update and save-as-new actions, turret replacement, restoration review, pinned inspectors, viewport attachment gizmos, texture integration, embedded editors, and Properties search. Package versions, worker code, deployment settings and serialized attachment keys are unchanged.

## New organization

- Ship editor: separate Turrets, Components and Weapon Coverage categories.
- Turrets: Socket Display, Mounting, Selected Turret (including existing Library Source actions), Transform & Pose, Aiming Configuration, Socket Details.
- Weapon Coverage: Visualization, Turret Scope, Analysis, Slice Settings, Appearance & Colors, Inspection & Statistics, Comparison & Export, Advanced Analysis. Legacy and experimental controls remain accessible. The aiming shortcut edits the same mounted-turret coverage state.
- Components: Socket Display, Attachment, Selected Component, Transform, Position & Alignment, Socket Details and Socket Creation. Existing Library Asset, History, Symmetry, Appearance, Clearance and Component Setup controls remain available. The source-component window retains its attachment-point editor.
- Turret asset editor: Structure, Pose & Mechanics, Turret Studio, Showcase & Timeline, Showcase Export, Calibration & Development. Search spans all six categories.

## Shared numeric field

`src/numeric-field.js` enhances existing native number inputs: signed value fill, optional units, drag, Shift fine adjustment, Ctrl stepping, double-click/Enter text editing, Enter commit, Escape cancellation, keyboard adjustment, Alt+Backspace reset, mixed values and programmatic fill updates. It retains existing field constraints and callbacks.

Turret/coverage/asset transactions use turret history with one record per drag. Component numeric controls use their own transaction adapter: preview through `previewSetup`, save through `changeSetup` once on commit, restore the pre-drag setup on cancellation or save failure, and use component undo/redo. Component source-library attachment fields and source-window draft attachment fields have separate numeric history, preventing source edits from undoing mounted instances.

## Control migration map

| Existing controls | Location after port |
| --- | --- |
| Turret socket visibility, through-geometry display, scope | Turrets / Socket Display |
| Socket selector, attach/detach, attachment history and errors | Turrets / Mounting |
| Mounted identity and source edit/update/save-as-new actions | Turrets / Selected Turret / Library Source |
| Mount/body rotation, elevation, size, presets, copy/paste | Turrets / Transform & Pose |
| Coverage enable, fixed aiming, azimuth/elevation limits, spread, group, field color | Turrets / Aiming Configuration |
| Socket identifiers, owner, normal, availability | Turrets / Socket Details |
| Coverage mode, metric, opacity, sphere radius | Weapon Coverage / Visualization |
| All/selected/group filters | Weapon Coverage / Turret Scope |
| Sampling, ship/grid/obstacles, overlap, recalculate/reset | Weapon Coverage / Analysis |
| Six directions, slice offset/radius, polar/legacy view | Weapon Coverage / Slice Settings |
| Palette, count scale and legacy turret colors | Weapon Coverage / Appearance & Colors |
| Picking, frame, statistics and contributing turrets | Weapon Coverage / Inspection & Statistics |
| Baselines and CSV/JSON | Weapon Coverage / Comparison & Export |
| Inclusion rules, GPU rays and assumptions | Weapon Coverage / Advanced Analysis |
| Component socket display | Components / Socket Display |
| Component socket selection, attachment and swap | Components / Attachment |
| Mounted component identity/source lifecycle | Components / Selected Component |
| Component scale, twist and snapping | Components / Transform |
| Existing serialized XYZ rotation | Components / Transform (new exposure of existing transform model) |
| Existing serialized socket-local XYZ offset and reset/alignment | Components / Position & Alignment (new exposure of existing transform model) |
| Automatic/manual/free socket creation | Components / Socket Creation |
| Manual socket name, position/rotation, turn/remove and metadata | Components / Socket Details |
| Symmetry, clearance, component history, setup import/export and bake | Retained dedicated Components panels |
| Turret Base/Body/Barrel selection and color | Asset Structure |
| Asset preview pose and guides | Asset Pose & Mechanics |
| All weapon profiles, target/tracking/firing/effects/playback overrides | Asset Turret Studio, grouped by purpose |
| Cameras, phases, scrub/playback, keys and events | Asset Showcase & Timeline |
| Formats, dimensions, timing and render options | Asset Showcase Export |
| Reference media, comparison, alignment, measurements and calibration JSON/numeric overrides | Asset Calibration & Development |

## Deliberately not introduced

Independent XYZ component scale, nested component hierarchy, unsupported socket compatibility/scope filters, new through-geometry component socket semantics, turret rig/pivot/muzzle editing and recoil are not added. Component XYZ offsets and rotations reuse the existing `offset` and `rotation` arrays; no new transform format is introduced. Existing source-update and replacement workflows are preserved rather than replaced by the older folder's implementation.

## Verification

The unmodified GitHub working tree passed 419 unit tests before the port. The new numeric suite adds six tests. `tests/properties-redesign.check.mjs` exercises real component transforms, live preview, grouped undo/redo, persistence, source/draft isolation, six turret asset categories, pose undo, all 19 profiles, Studio playback, camera keys, export options, calibration availability and cross-category asset search. Final test results are reported with the completed port; earlier test counts for the older folder are not evidence for this repository.

Historical standalone browser scripts using the former one-page asset inspector may need their navigation selectors updated. No claim is made that every historical manual script has been run. High-resolution/long-duration exports and native visual parity are not newly certified by this port.

## Files

Shared/app: `src/numeric-field.js` (new), `src/property-ui.js` (new), `src/app.js`, `src/editor-panels.js`, `src/icons.js`, `src/styles.css`.

Turrets: `src/turrets/properties.js`, `editors.js`, `mounts.js`, `coverage-ui.js`, `asset-properties.js`, `studio.js`, `showcase-ui.js`, `camera-keys-ui.js`, `comparison.js`, `calibration.js`.

Components: `src/components/properties.js`, `src/components/mounting.js`.

Tests/docs: `tests/numeric-field.test.mjs` (new), `tests/properties-redesign.check.mjs` (new), this report.

Changed files are checked against the captured GitHub working-tree hashes before application. Original target versions are backed up in the port staging folder. Existing uncommitted changes are retained; no reset, checkout, staging, commit or push is performed.

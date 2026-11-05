# Turret and Component UX implementation plan

Status: proposed; application implementation is not authorized by this planning document alone.

## Outcome

Make mounting and editing attachments a consistent workflow across the Asset Library, Properties, Outliner, and viewport. Keep turret-specific articulation and simulation distinct from rigid component placement.

The intended flow is: choose an asset, preview it on a socket, place it, then edit the mounted instance. Editing a library asset is an explicit separate action.

## Existing foundation

Build on the current implementation rather than replacing working systems:

- Separate Turrets and Components library categories.
- Full application workspaces for both asset types, including component face picking.
- Component drag/drop, selection, socket tools, history, clearance handling, symmetry, setup persistence, and XML baking.
- Turret placement, pose controls, simulation, asset guides, embedded-design restoration, and mounted copies.
- Component and turret Outliner entries, image/mesh exports, and blueprint rendering.
- Pending local mounted-texture changes in `src/turrets/textured-attachments.js`, `src/turrets/render.js`, and `src/game-renderer.js`. Preserve and verify these as part of the baseline.

Relevant ownership boundaries:

| Area | Existing code |
| --- | --- |
| Editor routing and shortcut focus | `src/app.js` |
| Library categories | `src/attachment-library.js`, `src/turrets/library.js`, `src/components/library.js` |
| Properties | `src/turrets/properties.js`, `src/turrets/editors.js`, `src/components/properties.js` |
| Asset workspaces | `src/turrets/workspace.js`, `src/components/workspace.js` |
| Placement and history | `src/turrets/mounts.js`, `src/turrets/placement.js`, `src/components/mounting.js` |
| Socket geometry and tools | `src/turrets/sockets.js`, `src/components/core.js`, `src/components/viewport-tools.js` |
| Viewport and picking | `src/viewport.js`, `src/game-renderer.js`, `src/components/overlay.js` |
| Rendering and exports | `src/turrets/render.js`, `src/turrets/posed-blocks.js`, `src/export/` |
| Persistence and restoration | `src/session-persistence.js`, `src/components/storage.js`, `src/turrets/embedded.js` |

Recheck repository state before implementation; other local work may advance independently.

## Interaction contract

### Selection and Properties

Maintain one active attachment context: none, turret instance, component instance, socket, or library asset. Keep existing multi-selection, with a primary selected item. Selecting an attachment updates the Outliner, viewport outline, and the relevant unpinned Properties editor together. Clear incompatible active attachment selections. Preserve block selection when it is needed to define a socket, without treating that block as the active attachment.

Properties follows selection by default. Offer a pin control so a user can inspect one item while working elsewhere. Do not switch every Properties editor in a multi-editor layout. Respect editor focus, a designated inspector, and pinned contexts. Deleted pinned targets show a clear empty state.

Socket picking belongs to Edit Sockets mode. Ordinary selection picks the mounted object. Show placement targets automatically while placing an asset. Paint and navigation gestures retain their current behavior.

### Properties structure

Use a common header: item name, type, context badge (Mounted instance / Library asset / Socket), and a small action menu.

For a mounted instance, use this order:

1. Attachment: socket identity, source asset, Select socket, Replace, Detach.
2. Transform: native turret size or component scale; mount twist and offsets where supported; coordinate-space selector; reset controls.
3. Appearance: supported instance color/material overrides and visibility. Do not expose texture assignment that the renderer does not support.
4. Behavior: turret yaw/elevation, aiming limits, tracking and firing controls. Components have no weapon controls.
5. Advanced: diagnostics and less common simulation/calibration settings, collapsed by default.

Keep mounting orientation separate from turret aiming. Show common fields and mixed-value states for same-type multi-selection; do not invent a common size field for mixed turret/component selections. Applying a batch edit creates one undo entry.

For sockets, show name, attachment type, anchor, position/orientation, occupant, and relevant compatibility/clearance information. For a library asset, show metadata and Edit asset; detailed geometry and attachment editing opens its workspace.

### Placement and direct manipulation

Use a shared interaction controller with idle, placing, editing socket, and manipulating states. Domain-specific validation remains in turret/component modules. Reuse existing navigation/keymap handling rather than adding competing pointer handlers.

A placement preview shows the asset, target socket, mounting plane, and attachment direction. Use screen-space target ranking and hysteresis so the target does not jump between neighboring sockets. Keep occluded/back-facing targets unavailable unless the user explicitly enables through-geometry socket editing.

A compact viewport strip provides Rotate, Size/Scale, Snap, Confirm, and Cancel. Drag/drop onto an empty valid socket remains a one-step commit. Selecting Place from the library supports click placement with Enter to confirm and Escape to cancel. Dropping on an occupied socket opens an explicit Replace preview; it must not silently replace an existing component.

One pointer gesture produces one history operation. Escape, lost capture, closing an editor, changing model, or invalidating the target cancels the transient preview without saving it.

### Socket presentation

Use rings for turrets and squares for components, plus consistent colors, icons, text, and selected outlines. Differentiate available, occupied, selected, and invalid states without relying on color alone. Hover labels name the socket and explain invalid targets.

Default visibility: selected socket only during normal work; relevant eligible sockets during placement; configured scope during Edit Sockets. Filters: Turrets / Components / Both, selected blocks / all, and through geometry. Keep dense-model labels on hover/selection rather than rendering every label.

Block-type component sockets remain configurable per model with no default. Preserve manual sockets. Picking a face offers Center on face, Align to face, and Reset. Gizmos support translation and rotation in socket/local/ship space with numeric alternatives. Asset attachment frames and ship sockets use clear, consistent direction arrows, while retaining their distinct alignment conventions.

### Library assets, instances, and saving

Library edits do not silently change mounted copies. Preserve the mounted geometry snapshot and per-instance overrides. Track source asset identity and revision separately from the mounted snapshot.

Edit library asset opens a draft workspace. Save commits; Cancel discards. If the source is deleted or unavailable, the mounted instance remains usable and can be saved as a new asset.

Update from library previews changes before confirmation. Preserve compatible mount position, size/scale, pose, and overrides; identify incompatible fields instead of silently resetting them. Replacement and update are undoable.

Expose Saving, Saved locally, and Save failed states. Failures retain a recoverable draft and offer retry. Library persistence and ship-setup persistence are separate operations with separate status. Setup import previews additions, replacement, and unresolved sockets before applying one transaction.

## Delivery sequence

### Phase 1 — Baseline and state contracts

- Record current import, placement, selection, undo, persistence, simulation, baking, and export behavior using representative fixtures.
- Inventory existing state fields and make a selection/interaction ownership map.
- Define adapters for turret and component capabilities: selection, sockets, validation, placement, update, detach, and history. Share only actual common behavior; do not merge asset schemas.
- Identify model replacement paths that could discard attachment metadata and cover them before refactoring UI.
- Establish versioned migration rules for source revision metadata and any new socket/instance fields. Legacy records without provenance remain valid.

Acceptance: baseline passes, existing saved data loads, and the transition rules above are represented in a small state contract before UI changes begin.

### Phase 2 — Contextual Properties and selection

- Reorganize both Properties editors around the shared hierarchy.
- Connect viewport and Outliner selection to one active context and a designated unpinned inspector.
- Add context badges, selection-following/pinning, useful empty states, and mixed-value handling.
- Move library-only settings away from mounted-instance editing; preserve existing advanced tools.

Acceptance: selecting any instance or socket exposes the correct controls; stale fields from another selection disappear; pinned/multiple inspectors behave predictably; keyboard focus survives routine updates.

### Phase 3 — Socket editing and asset attachment tools

- Standardize marker shape, visibility, hover information, scope filters, and selected state.
- Extend existing component face picking and manipulation tools to the shared interaction controller, then apply them to turret attachment frames.
- Add mounting-plane and direction guides, Center/Align/Reset, and precise numeric controls.
- Preserve manual sockets, automatic sockets, component symmetry, and existing clearance semantics. Materialize an editable manual override when editing an automatically generated socket rather than mutating procedural geometry invisibly.

Acceptance: top, bottom, side, and angled faces align correctly; centering/reloading does not move saved sockets; users can identify occupied and invalid sockets without color; no socket tool intercepts painting or ordinary navigation.

### Phase 4 — Placement, replacement, and mounted transforms

- Implement stable target snapping, ghost previews, the placement strip, and cancellation rules.
- Preserve fast empty-socket drag/drop and add keyboard-accessible Place.
- Make occupied-socket replacement explicit and previewable for both attachment types.
- Add mounted transform gizmos, axis constraints, snapping, and coordinate-space labels.
- Pause turret simulation while manually changing mount or aim controls; restore the prior playback state after commit/cancel. Distinguish temporary simulation pose from saved neutral/edit pose.

Acceptance: target choice remains stable on dense ships; invalid placement explains its reason; cancel leaves no mutations; one gesture is one undo step; dropping or confirming selects the new instance; replacement undo restores the exact previous occupant.

### Phase 5 — Library revision and workspace lifecycle

- Add source identity/revision tracking while preserving legacy assets and independent mounted copies.
- Add Edit library asset, Save as new asset, Update from library, and explicit replacement previews.
- Standardize workspace Save/Cancel behavior, unsaved-change handling, and shortcut isolation.
- Preserve full component and turret workspaces, textures, guides, and turret simulation.

Acceptance: changing a library asset leaves existing mounts unchanged until requested; missing/deleted source assets do not break mounts; updates preserve compatible instance edits; cancellation does not leak draft changes.

### Phase 6 — Unified history and persistence feedback

- Route undo/redo through active context, preserving existing paint history and domain-specific histories.
- Standardize transaction boundaries for placement, socket edits, symmetry batches, replacement, and library updates.
- Queue saves without dropping later edits or replacing another model's state after an asynchronous operation.
- Add local save status, actionable failure recovery, and setup-import preview.
- Keep existing component file association and XML baking. Surface the current 90-degree baking constraint before export, with direct links to affected instances.

Acceptance: reload restores final committed state; rapid edits and undo during saving are deterministic; storage failure retains recoverable work; corrupt imports do not partially apply; valid existing setup files still work.

### Phase 7 — Embedded restoration and repair flow

- Return structured restoration results rather than relying only on log strings: restored mounts, reused/new assets, unresolved mounts, and reasons.
- Show a compact completion notice after opening a ship, with Review only when attention is needed.
- Build a review list that selects and frames the affected mounting block and offers an appropriate repair action.
- Preserve original embedded data. Mark inferred face/orientation choices honestly; do not present ambiguous restoration as verified native placement.

Acceptance: successful loads do not open interruptive dialogs; unresolved entries are actionable; repeated imports do not duplicate assets; each repair is undoable and persistable where supported.

### Phase 8 — Accessibility, performance, and release verification

- Add accessible names, visible keyboard focus, discoverable shortcuts, and screen-reader status messages. Provide numeric/property alternatives to every pointer-only operation.
- Test narrow Properties columns, maximized workspaces, multiple viewports, high-DPI displays, and supported Blender/Laptop controls. Do not claim Trackpad support while it remains unavailable elsewhere in the app.
- Cache socket geometry, eligible targets, outlines, and preview resources. Keep storage writes and expensive geometry rebuilds out of pointer-move handlers.
- Measure baseline and final frame times on the same machine and fixtures. Target 60 fps when the baseline can support it; report actual median/p95 and avoid a blanket hardware-independent guarantee. Attachment editing must not materially regress viewport p95 on those fixtures.
- Verify GPU resources return near baseline after repeated placement, cancel, workspace open/close, and model changes.
- Update the user guide, component guide, tooltips, and release notes around the final behavior.

Acceptance: full automated suite and build pass; focused browser tests and visual review pass; rendering/shading/export regressions are absent; measured performance and any remaining limitations are recorded.

## Verification matrix

Cover both attachment types with empty and occupied sockets; manual and automatic sockets; flat and angled bases; hidden/deleted anchors; duplicate assets; missing source assets; centered and native ship placement; symmetry; same-type and mixed selection; multiple editors; and keyboard-only placement/cancellation.

Persistence checks include old records, valid and malformed setup imports, delayed/failed IndexedDB writes, reload after undo, and model changes during a pending save. Rendering checks include Solid, material/rendered views, blueprint, transparent image export, and mesh export. Verify loaded textures remain attached through turret articulation and component transforms.

Use a small deterministic fixture for transform correctness, a medium ship for everyday interaction, and a large/densely mounted ship for performance and target stability. Retain a real embedded-turret ship as an integration fixture without committing private game assets.

## Boundaries and rollout

No cloud account system, automatic synchronization of all mounted copies, arbitrary-angle XML baking, new weapon mechanics, or general-purpose CAD constraints in this scope. Preserve current file compatibility and exported geometry semantics.

Implement in the listed order. Each phase should be independently reviewable and runnable, with its acceptance checks passing before proceeding. Do not publish partial replacement UI that removes existing capabilities. Commit/push/merge/deployment remain separate user-authorized actions.

Completion means all eight phases pass, the documented interaction contract works in both asset systems, legacy data remains usable, and visual/performance checks support the result. Unit-test success alone is not sufficient.

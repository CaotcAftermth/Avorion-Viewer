# Turret placement

Choose **Asset Library** from an editor-type menu. The gray **+** imports turret XML independently of the ship. Assets remain in browser-local storage.

In the viewport mode menu, choose **Select Sockets**. Only socket selection changes; block selection is retained without its highlight. Cyan rings have dark outlines, and selected sockets have a second ring. Properties > Turrets exposes socket details and an optional Show through geometry inspection toggle. Placement always requires an exposed, unoccupied socket.

Drag a turret tile onto a visible socket. A translucent preview snaps to its attachment frame. Dropping opens a size panel with Keep original size, Fit base, and Custom size. Place commits; Cancel or Escape removes the preview. The Properties Attach selected asset button provides the same workflow without dragging. Generic ship-format assets require their authored source size before scaling.

Size S uses a maximum S by S by S base envelope. Fit base computes the largest centered square inside the attachment face, rounds down to a 0.5 step, and caps at 10. Faces below 0.5 cannot use Fit base. Smaller custom sizes remain allowed, and explicit custom sizes may exceed the suggested fit. Scaling transforms geometry, pivots, and muzzle coordinates together around the attachment frame; the library asset is unchanged.

Mounted instances are saved with the ship session and include a copy of the asset. Detach, Undo attachment, and Redo attachment are available in Properties. The configured undo/redo shortcuts control attachment history while the socket viewport or Turrets properties area is active. History is session-only. Imported or replaced ships do not inherit another ship's attachments.

Current mounted rendering uses solid shaded block geometry. Full game-material rendering, color editing, mesh/game XML export integration, and comprehensive export parity remain future work. Existing image captures use the viewport render; no export-format completeness is claimed. Face-center visibility checks prevent placement through hull geometry but do not certify game placement rules or turret-to-hull collision clearance.

Checks: npm test; npm run build; node tests/turret-placement.check.mjs with the local server running. Browser checks use the Windows Playwright runtime path shared by existing prototype checks.

## Pose, Outliner, and library controls

Properties > Turrets includes mount rotation, body rotation, barrel elevation, and size for selected mounted turrets. Lower/Neutral/Upper presets, Reset pose, and Copy/Paste pose and size operate on the selection. Ctrl/Command or Shift clicking Outliner turret rows adds to the selection; viewport additive selection uses its configured modifier. Pose changes use the same undo history as placement and persist with the ship.

The Outliner lists mounted turrets under a ship-named Turrets section with rename, hide/show, and detach actions. Library assets support rename and delete; deleting a library asset preserves mounted copies. Reimporting identical source XML selects the existing asset instead of duplicating it.

Rendering shares merged Base/Body/Barrel geometry across copies of the same source design. Instance matrices handle pose and size. A 100-copy regression checks that only three component geometries are allocated. This verifies geometry reuse, not a hardware-independent frame-rate guarantee. Geometry still uses solid shaded colors rather than full game materials.

## Weapon Coverage

The previous direction-sector and swept-ray overlays have been superseded by target-based directional slices and a spherical heatmap. Open **Properties > Turrets > Weapon Coverage**. See [Weapon Coverage](weapon-coverage.md) for controls, geometric assumptions, implementation details, and validation.

Properties refreshes preserve scroll position. Whole workspace redraws restore scroll independently per editor area and Properties category after nested split dimensions settle. Restoration stops on new mouse, keyboard, or wheel input. Asset Library redraws retain their current scroll position too.

## Turret asset workspace

The asset modal embeds an isolated instance of the application. It uses the application's actual viewport renderer, shading and skybox, navigation controls, view cube, selection tools, searchable block Outliner, editor headers, menus, keyboard shortcuts, and split/join/swap/maximize operations. Properties is specialized for turret pose, component selection, and selected-block colors.

The embedded instance has its own scene and GPU lifecycle. It does not restore or save the main ship session or main workspace layout. Current texture blobs are copied into its texture library. Save asset commits the draft, pose, and workspace layout (including viewport camera state); Cancel discards them. The main ship scene remains independent. Closing disposes the embedded renderers and removes the document.

Browser regression: `node tests/turret-workspace-layout.check.mjs`. The test exercises real editor headers, viewport navigation widgets, Outliner search, corner grips, editor switching, pose and color edits, save/reopen, Cancel, source-asset isolation, and main-layout isolation.

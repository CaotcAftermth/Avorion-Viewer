# Paint tools and T&E

Choose **Paint Mode** in the viewport header. The left tool shelf selects Select, Brush, Eyedropper, Replace Color, Connected Fill, or Restore. A single settings row below the viewport header holds the named Avorion color, channel, radius, scope, and undo/redo. Palette, symmetry, and magnifier icons open the same style of popover used by viewport shading and overlays. Recent colors and the active palette are in the palette popover. The settings row scrolls horizontally in narrow editors instead of covering the model. When the tool shelf is hidden, the settings row provides a tool picker. Changing colors in either the toolbar or Color Editor updates the shared brush. Browsing other Color Editor tabs does not reset it.

## Tools

- **Brush:** Paints entire blocks hit by visible-surface ray samples. Radius 0 uses the center point; 1–64 px samples a circular footprint. Movement is interpolated, repeated block IDs are deduplicated, and each pointer event applies one batch. The blue footprint and translucent surface tint preview eligible targets; orange indicates a scope lock. Highlights follow the actual block geometry, including slopes and texture cutouts, and respect occlusion. They appear in both magnifier modes, remain independent of selection, and do not change either paint channel. The hover line shows the first hit's current channel ARGB, proposed color, and sampled target count.
- **Eyedropper:** Click to sample the current channel. Exact palette RGB matches select the existing named color. Imported ARGB is shown verbatim. Non-palette RGB or an absent secondary channel leaves the brush unchanged; there is no automatic nearest-color conversion. If several names have identical RGB, the first dataset match is used. Sampling does not repaint or add undo history. Alpha is reported, not copied into the brush.
- **Replace Color:** Click a source block to replace every identical ARGB in the active scope, using the current channel. It can reach hidden interior surfaces on otherwise visible blocks. Different alpha values are separate matches. Missing secondary color is a distinct match from explicit `00000000`.
- **Connected Fill:** Click a seed to fill connected eligible blocks matching its ARGB, material, or block type. Choose the rule under **Fill match** in the settings row (visible when Connected Fill is active). A matching path must connect every member; mismatched or excluded blocks interrupt it. Face contact and overlapping bounds connect; edge-only or corner-only contacts do not.
- **Restore:** Uses the brush footprint to restore the chosen channel's originally imported ARGB, including removing a secondary attribute that was originally absent. Generated previews restore their values before the first color edit. Restoration is itself undoable.

All tools honor the primary/secondary channel. Primary painting preserves each block's alpha. Secondary can preserve its alpha or set full strength (`FF`); a missing secondary channel starts at `FF`. A single stroke, replacement, or connected fill creates one undo entry. Escape cancels the active stroke or pending worker calculation. Switching modes, rebuilding the workspace, or importing another model cancels pending bulk calculations. Undo/redo and source-preserving export reuse the existing color transaction system.

## Scope and symmetry

**Whole Ship** includes live, visible blocks. **Selected Blocks** intersects that set with Outliner/viewport selection. **Active Region** uses the named region chosen in the toolbar. Empty selection or a missing/empty region locks painting; it never falls back to the whole ship. Manually hidden blocks and blocks excluded by the viewport's thin-block setting are not painted. Eyedropper can sample any visible hit without changing it.

Enable any combination of Mirror X/Y/Z and set each plane coordinate in the **Paint symmetry** popover. These are native Avorion coordinates: X right, Y up, Z back, rather than the workspace's Z-up display. **Use Ship Center** moves the mirror planes to the working model's bounds center. Mirroring matches existing blocks with reflected centers and the same dimensions/type, using a 0.0001-unit signature. It does not create geometry or infer mirrored face orientation. Both original and mirrored targets must be in scope.

Regions remain named selections independent of renderer chunks. The brush region selector does not change the region selected for the Color Editor's separate **Apply to Region** action.

## Magnifier and palette navigation

The **Paint magnifier** popover configures zoom, size, and quality. Hold RMB over the source, move into the offset lens, then click or drag LMB to paint. Release LMB to end the stroke and RMB to close the lens. The lens is anchored to the initial source position. Target previews appear in both the viewport and lens; pointer coordinates map back to the original surface.

- **Lens zoom:** 2–8×, default 4×.
- **Lens size:** 120–360 px, default 200 px; constrained by the viewport dimensions.
- **Smooth pixels:** Enlarges the already-rendered view with smoothing.
- **Render detail:** Renders a cropped camera view at twice the lens's CSS resolution. It improves small-object visibility at additional GPU cost, without loading extra textures or geometry. Scene overlays and depth of field are omitted from the detail pass; paint targets remain visible.

Radius remains measured in the original viewport's pixels, so it appears larger inside the lens. Use Radius 0 for precise small-object work. MMB click opens the active palette pie; MMB drag still orbits. Recent colors keep twelve dataset references in this browser. Palette names, brush colors, and tool options remain local; no backend or uploads are added.

## Current limits

Connected fill uses axis-aligned block bounds, not exact mesh-to-mesh contact. Slopes, corners, or hollow blocks can therefore connect where their bounds meet even if their rendered surfaces do not. The radius brush uses a bounded sample pattern; very small blocks between samples can be missed. Surface highlights use the existing merged/instanced geometry and update only changed preview IDs; they do not add bounding-box overlays or change selection. Replace/fill hover previews show the seed; the complete target set is computed after clicking.

Bulk searches run in a worker. Preparing its records and committing a large color transaction still run on the main thread. Stationary hover picking is cached, but these changes do not establish a 500,000-block performance guarantee. Test the stress ship on the intended browser/GPU before drawing performance conclusions.

## Suggested T&E sequence

1. Import a copy of a ship. Select several blocks in the Outliner, choose Selected Blocks scope, and brush across their boundary. Confirm that excluded and hidden blocks remain unchanged. Repeat with an empty selection and a named region.
2. Try Radius 0 and a larger radius. Check that visible targets follow the footprint and that undo reverses the entire stroke. Start another stroke and press Escape; then change radius/scope to check continued responsiveness.
3. Sample a known palette color and an imported non-palette color. Confirm the exact match or explicit unmatched report, with no repaint.
4. Replace a color on the primary channel. Undo, switch to secondary, and repeat. Confirm alpha preservation/full-strength behavior and that the other channel remains unchanged.
5. Fill a connected area using each rule. Include separated islands, mixed materials, slopes, and hollow blocks to evaluate whether the bounds-based behavior suits your ships.
6. Test X/Y/Z symmetry with a centered ship and an offset plane. Restrict scope to one side and confirm the other stays unchanged.
7. Restore several painted blocks, undo restoration, and redo it. Export and reimport the working copy; inspect primary, secondary, missing secondary attributes, and unrelated XML fields.
8. Try both magnifier qualities in perspective and orthographic views after panning. Paint a tiny block while holding RMB; release, cancel, and undo. Confirm MMB click/drag and recent-palette choices still work.
9. Repeat on the Ship Stress Test, then larger fixtures. Record worst pauses during strokes, worker completion, undo, and detail magnification, as well as memory and navigation responsiveness.

Automated coverage: `npm test`, `/tests/graphics.html`, and local Playwright checks `test-results/check-paint-tools.mjs`, `check-viewport-paint.mjs`, and `check-color-editor.mjs`. GPU checks use software WebGL; hardware performance remains part of T&E.

Symmetry settings include an independent eye toggle for each enabled axis plane. The translucent viewport guides use native ship coordinates and remain visible through geometry; hiding a guide does not disable mirroring. Guides respect the viewport overlays switch. Brush Color opens a searchable swatch list. After Undo/Redo, Paint Palettes is followed by the active saved palette swatches (falling back to the current harmony when no saved palette is active); Model Palette is followed by the four most-used model colors and opens the full usage list.

Symmetry planes also draw derivative-scaled contour lines where rendered model surfaces cross each enabled plane. These contours respect geometry, depth, and plane visibility. Paint and Model palette groups have spacing and distinct icons. Model colors appear in the paint toolbar only, not the Color Editor.

The MMB palette menu uses eight radial segments with outer color bands and a central name/page hub. Arrow keys navigate choices; Enter selects, Escape dismisses. Pagination remains inside the hub. MMB dragging still orbits without opening the menu.

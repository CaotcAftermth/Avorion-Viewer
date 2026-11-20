# Select blocks and examine construction

## Select in the viewport

Choose **Object Mode** and a selection tool.

- Click a block to select it.
- Click empty space to clear the selection.
- Drag a box to select blocks whose projected centers are inside it.
- Hold **Ctrl** while dragging a box to subtract blocks.
- Press **A** to select the model, or **Alt+A** to deselect.

Box selection can pass through the ship. It is not limited to the visible front surface. Hidden blocks are excluded from box selection.

## Browse Ship Structure

In the Outliner, group blocks by **Block type** or **Material**. Search for a type, material, or viewer ID.

Click a row to select its blocks. Hold **Ctrl** or the platform's selection modifier to add or remove the row's selection. Double-click a row to focus its blocks.

Use the eye control to change visibility. Use the isolate control to show only that group.

Right-click a row for **Select**, **Add selection / Remove selection**, **Focus**, **Hide**, **Show**, **Isolate**, **Show Last**, and **Show all**.

**Show Last** reverses the latest recorded hide or isolate change. **Show all**, or **Unhide all**, restores the full ship's manual visibility.

## Read Object Data

Select a block, then open **Properties > Object properties > Object Data**.

The inspector shows information from the ship file, including:

- Native item index and parent reference.
- Child blocks, with links to select or frame them.
- Block type and material.
- Facing direction and up direction.
- Lower and upper coordinate bounds.
- Primary and secondary color values, when present.
- Other imported attributes and an XML excerpt.

The item's index and the block type index are different numbers. A viewer-generated ID is also different from the native item index. Use the native data when you need to identify the original file record.

Use **Show Parent** or **Show Children** in Ship Structure to follow the file's parent relationships. A parent relationship records the design structure; it is not a list of every physically touching block.

The **Copy** control copies the displayed XML excerpt. Use a full ship save to keep the complete design.

## Visibility and geometry

Hiding a block changes the display. It does not delete the block from the source ship.

The thin-block control hides blocks with any dimension below **0.01 native units**. This filter is separate from manual hiding. A block can remain absent after **Show all** if the thin-block filter excludes it.

Imported hull geometry is read-only in the main ship view. Inspection does not let you move, reshape, or add ordinary hull blocks.

## Learn block shapes with the galleries

The Help menu's **Developer** section includes **Load Block Gallery** and **Load orientation gallery · 7 × 24**. These are optional reference tools.

The Block Gallery shows block types. Select a block to see **Variants** in Object Data. Double-click a variant to open its block workspace. **Apply to gallery** copies the edited variant back to the gallery block.

The orientation gallery shows seven non-cube shapes in their 24 orientations. Press **Home** to frame it.

Opening a gallery replaces the current scene. Save your ship work first. Gallery previews do not have an original ship XML for **Save preserved XML…**.

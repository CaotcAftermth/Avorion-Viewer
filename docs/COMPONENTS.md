# Components

Open an Asset Library editor and select **Components**. This library is separate from Turrets.

1. Import a component XML and select its tile.
2. Set its attachment point under **Component attachment**. Choose a block face or enter a local position and XYZ rotation in degrees. The default is the bottom center; local +Y points into the component.
3. Under **Ship component sockets**, choose a block type to generate sockets on its faces. No block type is assigned by default.
4. Alternatively, select a ship block in the viewport and choose **Add socket on selected block**, or use **Add free socket**. Manual sockets have editable positions and rotations. Block sockets use offsets from their mounting block; free sockets use the ship's original XML coordinates.
5. Choose a socket and click **Attach selected component**. Adjust scale and twist, or detach it, in the same panel. Enable **Show component sockets** to display orange square markers; Select Sockets mode lets you pick visible markers.

Mounted components participate in framing, image and blueprint output, and mesh export. Mounted copies retain their geometry and attachment point when the library asset changes or is removed. A deleted mounting block hides its attachment; the library offers a detach control for missing sockets.

## Storage

The component library and ship setups are saved in this browser's IndexedDB. Ship setups are associated with the exact source XML contents, so renaming a file does not break the association. A changed XML file is a different source: use **Export component setup** and **Import component setup** to transfer its setup when needed. Import replaces the current ship's component setup.

Setup JSON includes socket definitions and mounted component copies. Keep these backups if you clear browser data or change browsers. Avorion XML export preserves the original game data; these viewer-defined component attachments are not written into game XML. Mesh and image exports include them.

Component placement aligns attachment frames. It does not enforce the turret size grid or perform collision checks, so components may overlap the hull when their chosen attachment requires it.

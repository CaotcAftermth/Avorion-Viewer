# Move around the ship

## Mouse and Laptop navigation

An orbit rotates the camera around its target. A pan moves the view sideways or vertically. A zoom changes how large the model appears.

| Action | Blender controls | Laptop controls |
|---|---|---|
| Orbit | Middle-button drag | **Alt+left-drag** |
| Pan | **Shift+middle-drag** | **Alt+Shift+left-drag** |
| Zoom | Wheel, or **Ctrl+middle-drag** | Wheel, or **Alt+Ctrl+left-drag** |
| Dolly | **Ctrl+Shift+middle-drag** | Use the navigation menu if needed |

Dolly moves the perspective camera along its viewing direction. Starting a dolly from orthographic view switches to perspective.

Press **Escape** or right-click during a navigation drag to restore its starting view. Losing window focus can also cancel the drag.

## Frame the model or selection

- **Home**, or **View > Frame all**, fits visible geometry in the viewport.
- **F**, or **View > Frame selected**, frames the selected visible blocks in this release's default keymap.

Frame All depends on visibility. Use **Show all** first if you want the complete hull.

## Standard views

| View action | Default key |
|---|---|
| Front / back | **Numpad 1 / Ctrl+Numpad 1** |
| Right / left | **Numpad 3 / Ctrl+Numpad 3** |
| Top / bottom | **Numpad 7 / Ctrl+Numpad 7** |
| Opposite side | **Numpad 9** |
| Perspective / orthographic | **Numpad 5** |
| Orbit in steps | **Numpad 2 / 4 / 6 / 8** |
| Pan in steps | **Ctrl+Numpad 2 / 4 / 6 / 8** |
| Roll left / right | **Shift+Numpad 4 / 6** |
| Zoom in / out | **Numpad + / −** |

Laptop controls use number-row emulation for view commands. Menus and the view cube provide the same main actions without a numeric keypad.

## Use the view cube

Click a cube face for a standard view. Click an edge or corner for an angled view. Clicking an already aligned main face switches to its opposite face.

Drag the cube to orbit. Its surrounding arrows rotate by quarter turns. In top and bottom views, extra controls rotate the view clockwise or counterclockwise.

The cube's Home control restores its standard top-front-right presentation. The **Home keyboard command** frames visible geometry. These controls have different purposes.

Choose a navigation cube or axis gizmo in **Preferences > 3D Viewport**.

## Perspective, orthographic, and region zoom

Perspective makes distant parts appear smaller. Use it for a natural presentation.

Orthographic keeps parallel lines parallel. Use it for proportion checks and technical views.

For a closer view of one area:

1. Press **Shift+B**, or choose **View > Zoom region…**.
2. Drag with the left button to zoom into the rectangle.
3. Use the middle button for a region zoom out.

## Camera clipping

Press **N** to show the viewport sidebar, then open **View**. Adjust **Focal Length (mm)**, **Clip Start**, or **Clip End** as needed.

Clip Start and Clip End set the nearest and farthest visible camera depths. If a nearby surface disappears, check Clip Start. If distant parts disappear, check Clip End. Clip Start must remain less than Clip End.

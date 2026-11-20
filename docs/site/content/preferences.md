# Set preferences and shortcuts

## Open and search Preferences

Use **Edit > Preferences…**, **Ctrl+Comma**, or change an editor area to **Preferences**.

Select a category or search for a setting. **Ctrl+F** focuses search; **Alt+F** clears it. Search includes descriptions, and language search can match English and translated labels.

Changes apply immediately. Read the save controls before closing if Auto-Save Preferences is off.

## Preference categories

| Category | What to change |
|---|---|
| **Interface** | Language, status bar, tooltips, and area corner handles |
| **3D Viewport** | Navigation widget, information, dimensions, paint magnifier, selection appearance, vignette, and clipping |
| **Cursors** | Cursor size, line weight, colors, and target location |
| **Themes** | App theme, selection color, and editor-specific colors |
| **Keymap** | Keyboard commands, mouse gestures, and operation modifiers |
| **Input** | Blender/Laptop input choices and supported mouse/numpad emulation |
| **Navigation** | Orbit/zoom speed, step angle, automatic perspective, framing margin, and zoom direction |
| **System** | Display resolution limit and simplified-rendering threshold |
| **Save & Load** | Next-import placement and workspace persistence |
| **Thruster Preview** | Active state and direction choices for thruster display |

World and Shaders settings are in the ship **Properties** editor. Asset-folder management is in **File > Asset folders…**. Those settings still participate in their relevant local storage and preference behavior.

## Set the interface language

Open **Interface > Language**. Choices include Automatic, English, Deutsch, Español, Français, 日本語, Português (Brasil), Русский, and 中文（简体）.

Automatic follows the browser language. Some areas remain English-only, including parts of Properties, Color Workshop, export tools, and Turret Studio. Block names, file content, and keyboard key names retain their original forms.

This guide uses English labels so that menu paths remain consistent.

## Set themes and contrast

Choose **Blender Dark**, **Graphite**, or **High Contrast** in Themes. Set **Selection Color** to make selections easier to see.

Editor-specific **Custom Colors** can override background, header, text, and accent colors. Enable that editor's Custom Colors before expecting its custom swatches to apply.

Viewport theme options also include a gradient background. The viewport must use the Theme background for that theme appearance to show.

Use a strong contrast between text, selection, and background. Turning off selection decoration can make active selections harder to identify.

## Adjust cursors and targeting

In Cursors, change **Scale**, **Line Weight**, **Primary Color**, and **Secondary Color**.

**Adjust Target Location** controls the target offset for supported cursor types. Azimuth chooses the direction of the target from the cursor artwork; distance sets the offset in screen pixels.

Cursor artwork size does not change paint radius. If precision feels wrong, compare the target mark, brush footprint, and hover preview before changing several settings at once.

## Adjust navigation and framing

Orbit Sensitivity and Zoom Sensitivity change pointer response. Rotation Angle changes keyboard and menu rotation steps.

**Auto Perspective** switches an aligned orthographic view to perspective when you orbit. Turn it off if you want to retain orthographic projection during inspection.

**Frame All Viewport Fill** sets how much of the viewport the framed model can occupy. Lower values leave a larger margin.

**Invert Zoom Direction** reverses wheel and drag zoom. Explicit Zoom In and Zoom Out menu commands retain their meaning.

## Control display cost

**Resolution Limit** selects a maximum display pixel ratio: Performance, Balanced, or Quality. A higher value uses more pixels and graphics memory.

**Simplified Rendering Threshold** reduces animated block effects above the chosen block count. Selection, framing, textures, and visibility tools remain available.

For a demanding ship, start with a lower display resolution, fewer effects, and one viewport. This can improve responsiveness without changing the saved XML geometry.

## Change a shortcut

1. Open **Keymap**.
2. Find the command in its category.
3. Click its binding.
4. Press the replacement key combination or requested gesture.
5. Use **Clear** to remove a binding, or **Reset** to restore it.

Press Escape while recording a binding to cancel. Conflicts within the same context are rejected. Input emulation can take priority over a custom gesture.

Normal text editing keeps its usual behavior. Click or focus the intended editor before trying an editor shortcut. A browser or operating system can reserve a combination; use the menu equivalent in that case.

## Default shortcut reference

These defaults come from the deployed keymap. Saved custom bindings can differ.

| Task | Shortcut |
|---|---|
| Object / Paint Mode | **Tab** |
| Quick Asset Library | **Space** |
| Show/hide tool shelf | **T** |
| Show/hide viewport sidebar | **N** |
| Frame all | **Home** |
| Frame selected | **F** |
| Select all / deselect all | **A / Alt+A** |
| Zoom region | **Shift+B** |
| Undo / redo in the active context | **Ctrl+Z / Ctrl+Shift+Z** |
| Maximize / restore area | **Ctrl+Space** |
| Focus Mode | **Ctrl+Shift+Space** |
| Save Model Project | **Ctrl+S** |
| Previous / next workspace | **Ctrl+Alt+PageUp / PageDown** |
| Open Preferences | **Ctrl+Comma** |
| Search Preferences or Properties | **Ctrl+F** in the applicable editor |
| Cancel an active operation | **Escape** |

Navigation-key details are in section 6. In particular, older documentation can list a different Frame Selected or Focus Mode shortcut. Use the current Keymap and menu labels as the reference.

## Save, revert, and reset preferences

The Preferences footer provides:

- **Auto-Save Preferences**: saves preference changes automatically when enabled.
- **Save Preferences**: writes the current preference values.
- **Revert to Saved Preferences**: restores the saved values.
- **Load Factory Preferences**: previews defaults with preference auto-save disabled.

Factory preferences replace the saved settings only when you save them or enable auto-save. Closing a temporary factory preview does not by itself make it your permanent preference set.

**Remember Workspace Layout** is a separate setting. Disabling it pauses layout saving and opens a default layout on a later load. The previous saved layout is retained. Preference saving and workspace saving are separate operations.

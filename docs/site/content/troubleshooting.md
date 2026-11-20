# Solve problems and recover a session

## Find the likely control

| Symptom | Check or action |
|---|---|
| No ship appears | Wait for loading, press Home, check visibility, and confirm the XML imported successfully |
| Frame All shows only part of the ship | Use Show all; check thin-block filtering |
| A nearby or distant surface disappears | Check Clip Start and Clip End |
| Surface detail is missing | Load textures and use Material Preview or Rendered |
| Loaded textures look incomplete | Check the texture count and reload the appropriate texture folder |
| Sky changes do nothing | Enable Skybox and set viewport Background to World |
| Lighting changes do nothing | Choose Rendered; disable Ambient Only if it overrides the intended lighting |
| Engines show no plume | Choose Rendered, check Engine State, visibility, and simplified-rendering threshold |
| Selection tint or outlines are absent | Enable Show Overlays and the corresponding selection decoration |
| Painting is locked | Check scope, selected blocks, active region, and visibility |
| A brush paints too much | Set Radius 0 and restrict scope to Selected Blocks |
| Secondary paint has no visible effect | Check the material and secondary alpha/strength |
| Eyedropper does not change the brush | The sampled RGB may have no exact named match, or the channel can be absent |
| Connected Fill reaches an unexpected block | It uses block bounds; undo and use a narrower scope |
| Mirror paint misses the other side | Check native axes, plane position, matching geometry, scope, and visibility |
| A named region disappeared | Reopen the Model Project that owns it. When replacing XML, check the preview for unmatched region members. |
| A component will not drag or attach | Assign its primary attachment point and Save asset |
| A component faces the wrong way | Check its primary attachment frame and the receiving socket direction |
| Socket position editing is unavailable | The original mounting face may be missing, or it may be a legacy socket without a face |
| Delete Socket is disabled | Detach the occupying component first |
| Component XML conversion fails | Check the reported blocks and combined 90° orientation requirement |
| A turret cannot attach | Check occupancy, visibility, socket fit, and authored asset size |
| A turret source update has no effect on another copy | Mounted instances retain their own copies; update the intended instance |
| A pinned inspector no longer follows selection | Select Unpin |
| Coverage does not appear | Attach turrets, enable coverage, wait for analysis, and check scope and display settings |
| Coverage difference falls back to clear | Use a compatible spherical baseline with matching radius and quality |
| A shortcut affects the wrong history | Focus the intended paint, turret, or component context |
| WebM is unavailable | Use GIF or PNG sequence; supported VP8 WebCodecs is required |
| Transparent JPEG is rejected | Choose PNG/WebP or use an opaque background |
| GIF size changes after a preset | The dialog is fitting the resolution to duration and frame limits |
| Print download is blocked | Read Details and use the offered recovery actions; validate again |
| Folder permission fails | Reconnect, choose the folder again, or use the one-time picker |
| Work is absent in another browser | Local browser storage is not synchronized; use downloaded files |

## Use the Info editor

Change an area to **Info** if it is not already visible. Read the activity messages around the failed operation.

- **Errors & Warnings** filters the list to problems.
- **Newest on Top / Newest on Bottom** changes order.
- **Copy** copies the applicable activity log.
- **Clear** removes the current activity messages.

Copy useful error details before clearing the log or reloading. Activity messages are not a permanent diagnostic archive.

## Recover after a memory or graphics failure

The viewer can detect that a previous session did not finish cleanly. It then asks before restoring the saved model.

| Recovery choice | Action |
|---|---|
| **Try without textures** | Attempts the model without restoring texture data for that load |
| **Try again** | Attempts normal restoration |
| **Clear scene** | Starts empty and retains textures; the original XML file on disk is untouched |

If the model repeatedly crashes the viewer, choose Clear scene, lower the display resolution, and open a smaller design. You can also open **[Safe start](https://avorion-viewer.com/?safe)** to request the recovery choice before automatic model loading.

A live memory warning offers **Keep model** or **Clear scene**. Keeping a model does not resolve a device memory limit. Save or export only if the app remains responsive.

## Reduce a demanding workload

Try one change at a time:

1. Close extra viewer tabs or unneeded editor areas.
2. Use a lower Resolution Limit.
3. Disable costly display effects or detail magnification.
4. Use fewer active viewports.
5. Reduce image dimensions or supersampling.
6. Reduce animation duration, frame rate, or resolution.
7. Export a selection or region instead of the full ship.

The app does not guarantee a fixed maximum ship size across all devices. A high memory-budget setting does not guarantee enough free memory.

## Report a problem

Open **Help > Send feedback…**. Choose **Bug report**, **Idea or request**, or **Other**.

For a useful bug report, describe:

1. What you opened or selected.
2. The commands or gestures you used.
3. The result you expected.
4. The result that occurred.
5. Whether the problem repeats after reopening the app.

Browser/graphics details, model name, and recent errors are optional. Review those choices and **Preview report** before sharing.

Use **Open GitHub issue** to review a prefilled issue, or **Copy report** to share it yourself. A long report can be copied to the clipboard instead of fitting entirely into the link.

When anonymous reporting is available, **Submit public report** can send without a GitHub account. It requires review consent and bot verification. You can choose up to three PNG/JPEG screenshots, at most 2 MiB each.

**Submitted reports and chosen screenshots become public.** Do not include private information or private game content. Model and texture files are not attached automatically. Screenshot storage has a 90-day expiry, but GitHub or other caches can retain copies.

If submission is uncertain, retain the displayed report reference and check for the issue before making a new report. A retry in the same report uses the same reference. If the anonymous service is unavailable, use the GitHub link or Copy report.

## Check the app version

Open **Help > About Avorion Viewer**, or use the version control in the status bar. Include the version when reporting a problem.

If this guide's version differs from the app, use current on-screen labels and release guidance where behavior has changed.

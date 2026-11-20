# Save work and choose the correct file

## Use the save route for your result

## Update a revised source model

Use **File > Replace Source XML…** to preview a revised source without immediately discarding supported edits. Save a project copy first. Review block correspondence, paint conflicts and unmatched edits before applying. Scaling, origin changes and hierarchy changes can affect matching. Kept mounts retain their size; review any clearance warnings after replacement.

## Choose a file to keep

There is no single command that downloads every app setting and every kind of work.

| Work to keep | Save route | What the result contains |
|---|---|---|
| Editable model | **File > Save Project…**, or **Ctrl+S** | `.avproject` with source, paint, regions, and mounted turrets |
| Game XML with paint | **File > Export Avorion XML…** | Imported XML structure with working paint changes |
| Workspace layout, interface, and shaders | **File > Export Workspace Profile…** | `.avprofile` that can be applied to any model |
| Turret asset edits, Studio settings, camera keys | **Export Model Project** or **Save asset** in the turret workspace | Portable turret project or updated local library asset |
| Component attachment point and asset sockets | **Save asset** in the component workspace | Updated local component asset |
| Reusable component library | Components > **Library Files > Export Shown Components (.json)** | Component pack for reuse |
| Editable ship component setup | Components > **Ship Component Files > Export Ship Component Setup (.json)** | Socket definitions and mounted component copies |
| Component geometry for Avorion | **Save Ship XML with Components** | Ship XML copy with supported component blocks added |
| App preferences | **Save Preferences**, or enabled preference auto-save | Local settings |
| Coverage results | **Export coverage CSV / JSON** | Analyzed data |
| Still, blueprint, animation, or mesh | Its export dialog | Prepared presentation or geometry file |

## Export Avorion XML

1. Finish or cancel the active paint stroke.
2. Select **File > Export Avorion XML…**.
3. Keep the downloaded XML with a useful name.
4. Keep the original XML separately.

The save retains the imported structure, original coordinates, unknown attributes, parent references, and embedded turret plans while applying supported working paint overrides. Formatting can change; the file is not promised to be byte-identical.

This command is not a save of viewport lighting, regions, camera paths, or every attachment change. Newly arranged viewer turret instances are not a promised round-trip through this command. Keep original turret designs and do not use a preserved XML download as a complete backup of every armament edit.

## Save component setup and component XML

Use setup JSON when you want to restore editable sockets and attachments. Use component XML conversion when you want supported mounted geometry written as ship blocks for the game.

A component pack and a ship setup are different JSON formats. Use their matching import controls.

Ship setups are associated with the source XML contents. Renaming the same source file does not necessarily break the association. Changing its contents can make it a different source. Export setup JSON before moving the arrangement to a changed ship.

Importing a ship component setup replaces the current setup after its review. Read the counts and unresolved-socket warnings. Export the current setup first if you need it.

**Save Ship XML with Components** starts from the painted ship copy and adds supported visible mounted component blocks. Hidden attachments and arrangements that cannot be represented correctly need attention before this conversion. Check the output in Avorion before treating it as the final ship.

Keep setup JSON even after making the XML copy. The JSON preserves the viewer's editable attachment structure; added game blocks do not substitute for that structure.

## Understand automatic browser storage

The app can restore the current model, paint, placement, and loaded textures from this browser. Libraries, component setups, saved palettes, preferences, and layouts also use local browser storage.

This storage belongs to the browser profile and site address. It is not a cross-device account or synchronization service. It can fail or be removed by site-data clearing, storage pressure, private browsing behavior, or a profile change.

Use a Model Project to back up regions. Ordinary selection, activity messages, and working history last for the current session.

## Clear only what you intend

| Command | Effect |
|---|---|
| **Clear scene** | Empties the current scene and saves that empty scene state |
| **Unload textures** | Removes loaded and saved texture imports |
| Folder **Forget** | Stops remembering that folder or removes its saved browser copy |
| Remove library asset | Removes the local reusable asset; mounted copies can remain |
| Reset workspace | Restores a screen arrangement |
| Load Factory Preferences | Previews default preference values under the preference save rules |
| Browser Clear site data | Can remove models, textures, libraries, palettes, layouts, and preferences |

These actions do not delete your original disk files. Download needed backups before clearing browser data.

## Keep processing and reporting separate

Model loading, painting, texture processing, and normal exports run locally. Sending feedback is a separate sharing action.

If you submit a public feedback report, its text and screenshots that you deliberately choose can leave your device. Read the preview and consent controls. Model and texture files are not attached automatically.

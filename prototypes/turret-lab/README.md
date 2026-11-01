# Turret Lab — milestone 1

This is an isolated, working prototype. It does not add turret behavior to the main application or write the application's saved assets or preferences.

With the existing development server running, open:

**http://127.0.0.1:5173/prototypes/turret-lab/**

If necessary, start the server from the repository root with `npm run dev`. The normal production build does not include `prototypes/`; use the development server for this lab.

## Try the milestone

1. Start with the supplied twin-barrel design on four mounts: top, underside, side, and angled. Select a turret in the viewport or the Mounted turret list.
2. Change its scale above or below 100%, mounting twist, body rotation, barrel elevation, or individual part colors. Other copies keep their own settings. Scaling stays anchored to the socket.
3. Import a standalone turret XML file. The import retains the source XML and uses the existing Avorion parser, shape geometry, and block orientation code. A single embedded `turretDesign` can also be isolated. Files containing multiple embedded designs are rejected with an explanation.
4. In Design view, set the attachment position and orientation, yaw/pitch pivot positions, and joint axes. Select blocks in the list (Ctrl/Shift for multiple selection), choose Fixed base, Rotating body, or Elevating barrels, then Assign selected. Newly imported blocks start fixed; the lab does not guess game joint metadata.
5. Leave Design view. Detach an existing demo turret, select an empty socket and the imported design, and attach it. Alternatively, import a ship, click a hull face, create a socket on that face, then attach the design. Importing a new ship clears existing mount placements; save the current project first if you want to keep them.
6. Save project and reopen its JSON file. Reloading the page also restores the most recent local project after its debounced save completes. Export PNG for an image or Export posed STL for the assembled geometry. Frame all includes the posed barrels; Frame selected focuses one copy.

The lab uses a separate IndexedDB database, `avorion-viewer.turret-lab.v1`. It saves source blocks/XML, library designs, assignments, sockets, copy transforms, and color overrides. Camera position, selection, and editing guides are workspace-only. Download a project file for a portable copy or before resetting the demo.

## Component rules and game sizing

The canonical components are **Base**, **Body**, and **Barrel**. Base is fixed and has no rotation point. Body uses **Body Rotation Point**; Barrel uses **Barrel Rotation Point** and inherits the body's rotation. The point buttons use the center of exactly one selected block in the appropriate component; numerical coordinates remain editable.

Select one or more Barrel blocks and choose **Assign selected as muzzles**. Muzzles are stored by block ID, support multiple assignments, and appear as yellow center markers under the guide toggle. These are manual assignments, not inferred game block types or firing origins. Reassigning a muzzle block to another component removes its muzzle assignment.

**Turret Size** offers 0.5 through 10 in steps of 0.5, according to the user's supplied game rules. **Viewer scale (%)** remains an independent multiplier, including enlargement beyond game sizes. First set **Source turret size** to the known size represented by the imported geometry. Effective scale is `viewer multiplier × turret size / source size`; unspecified source size leaves geometry unscaled and disables target size selection.

At size 0.5, the supplied component envelopes are:

| Component | X | Y | Z |
| --- | ---: | ---: | ---: |
| Base | 0.5 | 0.5 | 0.5 |
| Body | 0.75 | 0.75 | 0.75 |
| Barrel | 0.75 | 0.75 | 2.25 |

The lab derives larger envelopes proportionally from these values. **Component size guides** displays those extents centered on each assigned component's actual bounding box. They are diagnostic guides, not verified game build-volume origins. The report compares XML-coordinate extents directly; no undocumented unit conversion or automatic fitting is applied. Unspecified source size suppresses envelope comparison and guides.

Project format v2 renames Head to Body and adds source/target size and muzzle assignments. Version 1 files and local saves upgrade in memory without changing geometry, poses, scale multipliers, or colors. Their source size remains unspecified, preserving the previous visual scale. The database name remains unchanged.

### DX4 AutoCannon inspection

The user-supplied file contains a `ship_design` root with one `plan` and 145 blocks: 58 type 2, 81 type 100, 4 type 150, and 2 type 151. Bounds are approximately 9.590 × 5.670 × 19.560 in XML coordinates. No explicit component partition, rotation-point designation, muzzle assignment, or turret-size metadata was found. Ordinary block parent links are preserved; they are not treated as articulation declarations.

The DX4 browser check imports the real file, preserves its exact source XML, and exercises manual assignment using deliberately arbitrary test blocks. Those assignments are not a proposed correct rig for DX4. The author confirmed this is the complete Base/Body/Barrel assembly, authored at turret size 10. The calibrated starter is `examples/DX4 AutoCannon - size 10.json`: source size 10, target size 10, viewer scale 100%. All blocks remain fixed until the actual component boundaries, rotation points and muzzles are assigned. Size 0.5 corresponds to 5% of source geometry; size 1 corresponds to 10%. Component block membership still needs confirmation. Run `node tests/turret-lab-dx4.check.mjs`; optionally set `DX4_XML` to the file path. The original XML is never modified.

## Transform contract

All design, pivot, socket, and STL coordinates use the native model axes. The viewport reuses the viewer's camera convention through the existing native/view conversion functions.

- A socket's local +Y points out of its mounting surface; +Z establishes its forward reference. Attachment rotation aligns the design's mounting frame with that socket frame.
- A fixed base uses `socket frame × mounting twist × uniform scale × inverse attachment frame`.
- The body additionally applies yaw about its design-space pivot and axis.
- Barrels additionally apply pitch about their design-space pivot and axis, before the parent's yaw transform.
- Poses are calculated from original geometry on every update. Repeated changes do not accumulate vertex drift.
- Scale is a dimensionless multiplier, exposed as 1–10,000%. This is a prototype safety range, not an Avorion size or compatibility claim.

Geometry is merged by design part and reused by mounted copies. Pose, scale, and color changes do not rebuild source geometry. Editing part assignments or loading a different project invalidates that cache. Current lab limits are 100,000 source blocks, 500 library entries/sockets/copies each, 100 MB per imported file, and one million STL triangles. These bounds are protective limits, not benchmarked performance promises.

## Verification

From the repository root:

```sh
node --test tests/turret-lab.test.mjs
node tests/turret-lab.check.mjs
```

The browser check uses the same locally installed Playwright/Edge setup as the existing project checks. It requires the development server at port 5173; `VIEWER_TEST_URL` can override the address.

Verified automatically:

- Attachment stays on differently oriented sockets through scaling and rotated attachment frames.
- Yaw leaves the base fixed; elevation leaves the body fixed and preserves the barrel pivot.
- Underside, side, and oblique face normals create valid, non-reflected socket frames.
- Copy scale/color changes leave shared designs and other copies unchanged.
- XML import, manual part assignment, hull-face picking, and attachment work through the UI.
- Project serialization and browser reload preserve model data and posed matrices.
- STL is byte-identical before/after reload; the fixture has the expected triangle count.
- PNG downloads successfully, invalid project files leave the current project intact, and no remote requests or main-application storage writes occur.

Browser evidence is written to `test-results/turret-lab/`.

## Before main-app integration

This milestone validates assembly mechanics, not native game compatibility. Test representative real turret XML files against in-game screenshots next: fixed weapons, a rotating body with elevating barrels, asymmetric geometry, and side/underside installations. Confirm actual part identifiers, parent transforms, pivot conventions, and game size semantics before automating joint discovery or writing Avorion turret XML.

The lab deliberately uses simple solid materials. Game textures/effects, translucent block rendering, Color Editor block painting, selection hierarchy, mount-following after ship geometry edits, undo/redo, collision constraints, firing arcs, and animation are not implemented here. Colors currently override complete base/body/barrel parts per copy.

STL includes the ship and mounted copies in the current pose, in native model units. It contains no colors, joints, or game metadata and does not perform boolean union or printing repair. PNG captures the visible lab viewport without socket/pivot guides. Project JSON is the lossless editable export for this milestone.


## Native turret XML import

The corrected DX4 file has explicit `base`, `body`, and `barrel` sections. Import now detects those sections independently of the root element name, assigns component membership automatically, allows an empty Base, and prefixes block/parent IDs by component. Source-local block positions, section offsets, original XML, root size, coaxial flag, shot color, and version are preserved in project data.

The native DX4 starter is `examples/DX4 AutoCannon - native turret.json`; use it instead of the earlier ship-version starter. It has 0 Base blocks, 79 Body blocks, 66 Barrel blocks, size 10, and three explicit muzzle points.

For neutral geometry, each component receives its own section offset exactly once. Comparison against the ship version reproduces all 145 blocks with maximum coordinate/extent difference below 0.000001. The Barrel offset must not also receive the Body offset. Source-local coordinates are retained separately while the lab's existing renderer uses assembled coordinates.

Body and Barrel offsets seed the editable rotation points. Rotation axes remain the prototype's Y/X defaults, and Body rotation still parents Barrel rotation. Those articulation assumptions need an in-game pose comparison. Base offsets affect its geometry even though Base does not rotate. The attachment frame is separate and starts at the native origin.

Explicit muzzle points remain separate from assigned muzzle block IDs. Cyan markers provisionally interpret them as barrel-local points and follow Barrel pose; yellow markers indicate manually assigned muzzle blocks. The coordinate interpretation needs an in-game reference. No native XML rewriting or game round-trip export is claimed.

Run `node tests/turret-native.check.mjs` to verify the supplied native XML, neutral geometry parity, distinct component IDs, malformed-offset rejection, project serialization, and browser reload. This check reads the original user attachment and ship XML without modifying either.

### Barrel elevation limits

Each design defaults to -15° lower and +90° upper elevation. Edit these limits in the rig controls; all mounted copies clamp when limits change. Lower, Neutral pose, and Upper provide quick endpoint checks (Neutral pose also resets body rotation). Positive elevation raises native +Z barrels. Rendering and exports share the same clamp. Older native project angles migrate from raw X rotation to elevation on load, then clamp to the permitted range. Limits persist with the project.

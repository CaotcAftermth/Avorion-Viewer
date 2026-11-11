# Model Project load test checklist

Use a disposable browser profile or a private window. Keep the source XML and the original project file. Run this against the local GitHub checkout at `http://127.0.0.1:5173`.

**Record:** app version or commit, browser, source ship, and the name of any failing step. Capture a screenshot or the relevant Info log entry for failures.

## 1. Make a reference project

- [ ] Import a ship XML. Record the ship name, block count, and placement mode.
- [ ] Change primary paint on one block and secondary paint on another. Include a block with no imported secondary color so you can test Restore Paint later.
- [ ] Create two overlapping regions with different names and colors. Note their member counts. Hide a block and change another block’s opacity.
- [ ] Mount a turret. Change its size or pose and record the socket and values. Add a custom component socket and mount a component. If available, mount a child component or a turret on the mounted component.
- [ ] Set a recognizable camera angle and choose **File > Save Current Views with Project**. Save as **Load Test A** with **File > Save Project…**. Make a visibly different **Load Test B** with **Save Project As…**.
- [ ] Export a Workspace Profile with a recognizable shader setting and editor arrangement. Keep it as a separate test file.

## 2. Open in a clean browser profile

- [ ] Open **Load Test A** from the Welcome screen or **File > Open Project…**. Confirm the project title, ship geometry, block count, placement, and saved camera.
- [ ] Check both paint channels, opacity, and the hidden block. Use **Restore Paint** on the edited blocks. Confirm their imported colors return, including the absence of a secondary color where applicable.
- [ ] Check both regions’ names, colors, counts, and shared blocks. Highlight, isolate, and paint by region to confirm membership is usable.
- [ ] Check turret socket, size, pose, and any aiming or coverage settings you saved. Check component socket position, mount transform, and any child attachments.
- [ ] Open **Asset Library > Turrets** and **Components**. Confirm the project assets appear and can be reused. Reopen **Load Test A** and verify it creates no duplicate tiles. If you have a local library copy with edits, confirm it retains them and the mounted copy still matches the project.
- [ ] If the original XML contains a native turret you detached before saving, confirm its design appears in the library while its socket remains empty.
- [ ] Open **Load Test B** by dragging it onto the viewport. Verify its edits differ from **Load Test A** and that reopening **A** restores **A**’s values.
- [ ] Import the Workspace Profile. Confirm the layout and shaders change while the project’s ship, paint, regions, and attachments remain intact.

## 3. Replace the source XML

Run each case from a fresh reopen of **Load Test A** so results are comparable.

- [ ] **Uniform scale.** Replace the source with a 2× XML. Confirm the preview reports the scale, paint and regions stay on the same blocks, and sockets follow their faces. Check that saved turret sizes stay the same.
- [ ] **Uneven scale.** Try 2× on one axis. Confirm custom component sockets move with their host blocks. If you shrink a turret base below the saved turret size, check for a clearance warning.
- [ ] **New root or reordered XML.** Confirm the new hierarchy appears and edits follow the matching blocks.
- [ ] **Added, removed, and recolored blocks.** Check that new blocks keep their incoming colors and stay outside existing regions. Remove a socket host and confirm the preview lists affected mounts. Change a channel already painted in the project and verify you can choose either color. If matching is ambiguous, confirm the preview flags the loss.
- [ ] Click **Cancel** first and verify the original project is intact. Then apply the replacement, save under a new name, reopen it, and check the results.

## 4. Check failure and recovery paths

- [ ] Make an unsaved change, then try opening another project or clearing the scene. Cancel and confirm your current model and edits remain.
- [ ] Try opening a truncated copy of a project. Confirm the app reports an error and keeps the current model.
- [ ] Edit a region, allow browser recovery to save, then reload and verify the region returns. Reopen the downloaded project to verify it still reflects the last explicit file save.
- [ ] Choose **Export Avorion XML…** and open the result as XML. Confirm the game copy contains the working paint, original coordinates, and expected native XML data. Use the `.avproject` file when you need viewer regions and attachments back.

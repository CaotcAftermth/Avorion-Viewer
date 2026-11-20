# Topbar

The topbar contains application menus and workspace tabs. It acts on the application rather than only the editor under the pointer.

![The topbar contains application menus and workspace tabs.](../assets/ui-topbar-condensed.svg)

The blueprint break line marks omitted empty spacing; the original bar is continuous.

## Application menus

| Menu | Main purpose |
| --- | --- |
| <a class="inline-control-image" href="../assets/controls/topbar-file-6.png"><img class="manual-small-image" src="../assets/controls/topbar-file-6.png" width="62" height="50" style="height:50px;width:auto;max-width:100%;box-sizing:border-box" alt="File control"></a><br>**File** | Import, save projects, manage folders, export and clear the scene |
| <a class="inline-control-image" href="../assets/controls/topbar-edit-7.png"><img class="manual-small-image" src="../assets/controls/topbar-edit-7.png" width="65" height="50" style="height:50px;width:auto;max-width:100%;box-sizing:border-box" alt="Edit control"></a><br>**Edit** | Paint undo/redo and Preferences |
| <a class="inline-control-image" href="../assets/controls/topbar-window-8.png"><img class="manual-small-image" src="../assets/controls/topbar-window-8.png" width="112" height="50" style="height:50px;width:auto;max-width:100%;box-sizing:border-box" alt="Window control"></a><br>**Window** | Color Workshop, maximize/focus and workspace management |
| <a class="inline-control-image" href="../assets/controls/topbar-help-9.png"><img class="manual-small-image" src="../assets/controls/topbar-help-9.png" width="75" height="50" style="height:50px;width:auto;max-width:100%;box-sizing:border-box" alt="Help control"></a><br>**Help** | Welcome, shortcuts, input style, Documentation, feedback and application information |

A disabled command can explain its prerequisite. For example, source-preserving XML export needs an imported XML model.

## Workspace tabs

Select a tab to change the arrangement of editors. Double-click a tab to rename it; its context menu provides further workspace actions. See [Workspaces](../workspaces/).

## Editor headers are separate

The topbar's menus are not the same as an editor's header menus. A viewport's View menu changes that viewport; a File command can replace the loaded model for every viewport.

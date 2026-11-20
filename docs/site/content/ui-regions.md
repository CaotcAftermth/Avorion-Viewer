# Regions

In the window system, a **region** is part of an editor area. It is different from a named paint region, which is a reusable set of block IDs.

## Header

The header contains the editor selector and controls for that editor. Viewport headers include mode, menu and display controls. Other editor headers can provide search, filters and activity actions.

## Toolbar

The viewport toolbar contains tools for selection, navigation, painting or sockets. **T** toggles it in the default keymap. The active tool affects the next pointer gesture.

## Main region

This is the editor's working content: a viewport canvas, Outliner tree, color chooser or property controls. Several editors can reflect the same selection.

## Sidebar

**N** opens or closes the viewport sidebar. Its controls belong to that viewport. It is not the separate Properties editor. Resize the sidebar using its inner border where available.

## Paint regions

For named sets such as hull trim or engines, see [Color Editor](../colors/). They do not change the screen layout.

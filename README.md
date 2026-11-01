# Avorion Viewer

View, inspect and repaint Avorion ship models in a browser, using a Blender-inspired workspace.

[Open the viewer](https://avorion-viewer.com) · [User guide](docs/USER_GUIDE.md)

## Get started

1. Open the viewer and choose Blender, Laptop or Trackpad controls in the startup dialog.
2. Open an Avorion `.xml` model and choose local texture folders in the same dialog. These options remain available under **File > Asset folders…**.
3. Select blocks to inspect them, or switch to Paint Mode to recolor them. Use **File > Save preserved XML** to save your edits to a new file.

Models and textures are processed locally. Browser storage restores saved assets on later visits; clearing site data can remove those copies. Keep your original files. If a browser cannot remember a game folder, use the one-time folder picker.

## Features

- Resizable editor areas, saved workspaces, block selection and visibility controls.
- Native Avorion block rendering, local textures, lighting and generated skies.
- Color palettes, paint tools, named regions and paint undo.
- Turret libraries, placement, tracking, firing previews and animation export.
- Mesh export to GLB, glTF, OBJ, STL and 3MF; image and animation export.

## Run locally

Requires Node.js 20 or newer and a browser with WebGL2.

```sh
npm ci
npm run dev
```

Open `http://127.0.0.1:5173`. Browser dependencies are bundled locally; `npm ci` installs the development dependencies used by tests.

```sh
npm test
npm run build
```

The build writes the static site to `dist/`. To preview it, stop the development server and run `node scripts/serve.mjs --dist`.

## Controls

| Action | Default control |
| --- | --- |
| Orbit / pan / zoom | Middle-drag / Shift+middle-drag / wheel |
| Frame all / selected | Home / Numpad . |
| Front / right / top | Numpad 1 / 3 / 7 |
| Perspective / orthographic | Numpad 5 |
| Paint Mode | Tab |
| Undo / redo paint | Ctrl+Z / Ctrl+Shift+Z |
| Maximize editor | Ctrl+Space |
| Preferences | Ctrl+Comma |

Laptop and Trackpad presets are available in **Help > Input style…** and **Preferences > Input**. See the [user guide](docs/USER_GUIDE.md#controls-default-keymap) for the complete controls.

## Limitations

This is an independent browser application, not Blender or the Avorion game engine. Turret previews use source-derived parameters and procedural effects; native visual parity is not established. Audio and native combat simulation are not implemented. Large models and exports depend on browser memory and GPU capacity. Some interfaces remain English-only.

Imported XML structure and coordinates are preserved when saving paint edits. Mesh exports have separate conversion and repair limits described in the export documentation. Browser storage is not a backup.

## Documentation

- [User guide and design references](docs/USER_GUIDE.md)
- [Turret Studio: capabilities, limitations and development history](docs/TURRET_STUDIO.md)
- [Color Editor](docs/COLOR_EDITOR.md) and [paint tools](docs/PAINT_TOOLS.md)
- [Mesh export](docs/ADVANCED_EXPORT.md) and [image export](docs/IMAGE_EXPORT.md)
- [Graphics implementation](docs/GRAPHICS_FOUNDATION.md) and [shader audit](docs/SHADER_AUDIT.md)

Third-party license files remain with their bundled libraries. Avorion game assets are not covered by the Three.js license; see the asset notes in the user guide.

## Deployment and version

GitHub Actions runs tests, builds `dist/`, and deploys GitHub Pages on pushes to `main`. Repository **Settings > Pages** must use **GitHub Actions** as its source. The public site uses Cloudflare DNS pointing to GitHub Pages.

`src/version.js` supplies the displayed application version. Keep the package version synchronized; `tests/version.test.mjs` checks it.

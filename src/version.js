// App version. Pre-1.0 semantic versioning:
//   0.MINOR.PATCH, where MINOR counts the major feature areas below and PATCH
//   counts smaller features and fixes shipped since the last feature area.
// Add a feature area -> bump MINOR and reset PATCH. Ship a smaller feature or a
// fix -> bump PATCH. 1.0.0 is reserved for the first release you call stable.
// Keep package.json "version" in step (tests/version.test.mjs checks it).
export const FEATURE_AREAS = [
  ['0.1', 'Workspace', 'Blender-style tiled areas, workspaces, menus, maximize and focus mode'],
  ['0.2', 'Ship import', 'Avorion XML import, native block shapes and orientations, selection and framing'],
  ['0.3', 'Game shading', 'WebGL2 game shader, local block textures, materials, glow and decals'],
  ['0.4', 'Ship Structure', 'Outliner, block inspector, scene properties, visibility and isolate'],
  ['0.5', 'Color and paint', 'Color Editor, Paint Mode, palettes, regions and preserved XML save'],
  ['0.6', '3D export', 'Advanced Export to GLB, OBJ, STL and 3MF with mesh repair'],
  ['0.7', 'World and lighting', 'Skybox, ambient lighting, shadows, outlines and depth of field'],
  ['0.8', 'Image export', 'Stills, turntable GIF and WebM, and annotated blueprints'],
  ['0.9', 'Turrets', 'Turret library, sockets, studio, animation, effects and weapon coverage'],
  ['0.10', 'Asset library', 'Asset folders, model browser, favorites and saved sessions'],
  ['0.11', 'Preferences and languages', 'Preferences, keymaps, input styles and 8 interface languages'],
];
// Smaller features and fixes shipped since the last feature area.
export const PATCH = 63;
export const APP_VERSION = `${FEATURE_AREAS.at(-1)[0]}.${PATCH}`;

import { KEYMAPS, validBinding } from './keymaps.js';
import { WORLD_FIELDS } from './sky-settings.js';
import { LANGUAGE_OPTIONS, t } from './i18n.js';
export const PREFERENCES_KEY = 'avorion-viewer.preferences.v1';

// Every exposed preference has a consumer in the application or renderer.
export const PREFERENCE_SECTIONS = [
  { id: 'interface', label: 'Interface', panels: [
    { label: 'Language', fields: [
      { key: 'language', label: 'Language', type: 'select', options: LANGUAGE_OPTIONS, default: 'auto', description: 'Language of menus, dialogs and preferences. Automatic follows the browser language. Block names, file contents and keyboard key names are not translated.' }
    ] },
    { label: 'Display', fields: [
      { key: 'showStatusBar', label: 'Status Bar', type: 'checkbox', default: true, description: 'Show contextual hints and the layout save status.' },
      { key: 'showTooltips', label: 'Tooltips', type: 'checkbox', default: true, description: 'Show hints when hovering over controls.' },
      { key: 'showCornerHandles', label: 'Always Show Corner Handles', type: 'checkbox', default: false, description: 'Keep area split and join grips visible without hovering.' }
    ] }
  ] },
  { id: 'viewport', label: '3D Viewport', panels: [
    { label: 'Overlays', fields: [
      { key: 'viewCubeSize', label: 'Navigation View Cube Size', type: 'number', min: 80, max: 240, step: 10, default: 120, suffix: 'px', description: 'Size of the view cube and its surrounding controls.' },
      { key: 'navigationWidget', label: 'Navigation Widget', type: 'select', options: [['gizmo','Navigation Gizmo'],['cube','Navigation View Cube']], default: 'cube', description: 'Choose an axis gizmo or a rotating cube with clickable view faces.' },
      { key: 'showGizmo', label: 'Navigation Gizmos', type: 'checkbox', default: true, description: 'Show axis alignment, pan, zoom, and projection controls.' },
      { key: 'showViewText', label: 'View Information', type: 'checkbox', default: true, description: 'Show the view name and active object in the viewport.' },
      { key: 'showStats', label: 'Statistics', type: 'checkbox', default: false, description: 'Show visible object, vertex, and face counts.' }
    ] },
    { label: 'Model Dimensions', fields: [
      { key: 'dimensionCage', label: 'Show Dimension Cage', type: 'checkbox', default: true, description: 'Show the depth-tested whole-model cage when Model Dimensions is enabled.' },
      {key:'dimensionUnits',label:'Dimension Units',type:'select',default:'meters',options:[['meters','Meters'],['blocks','Block Units']],description:'Choose units for dimension labels. One block equals 10 meters.'},
      { key: 'dimensionAxisColors', label: 'Match Axis Colors', type: 'checkbox', default: false, description: 'Color width red, height blue, and length green to match the displayed axes (native X, Y, Z respectively).' }
    ] },
    { label: 'Painting', fields: [
      { key: 'paletteMenuSize', label: 'Radial Palette Size', type: 'number', min: 280, max: 720, step: 20, default: 340, suffix: 'px', description: 'Diameter of the paint palette radial menu. Automatically fits within the browser window.' }
    ] },
    { label: 'Paint Magnifier', fields: [
      { key: 'paintLensZoom', label: 'Magnifier Zoom', type: 'number', min: 2, max: 8, step: 1, default: 4, suffix: '×', description: 'Zoom when holding RMB in Paint mode.' },
      { key: 'paintLensSize', label: 'Magnifier Size', type: 'number', min: 120, max: 360, step: 20, default: 200, suffix: 'px', description: 'Diameter of the paint magnifier.' },
      { key: 'paintLensQuality', label: 'Magnifier Quality', type: 'select', options: [['smooth','Smooth pixels'],['detail','Render detail']], default: 'detail', description: 'Render detail redraws the magnified model. Show Wireframe also uses detail rendering.' },
      { key: 'paintLensWireframe', label: 'Show Wireframe', type: 'checkbox', default: true, description: 'Overlay model edges inside the magnifier using the viewport wireframe styling. Uses detail rendering without changing the main viewport.' }
    ] },
    { label: 'Selection', fields: [
      { key: 'outlineWidth', label: 'Outline Width', type: 'number', min: 1, max: 4, step: 0.1, default: 1.4, suffix: 'px', description: 'Width of selected geometry edges.' }
    ] }
  ] },
  {id:'cursors',label:'Cursors',panels:[{label:'Appearance',fields:[{"key":"cursorScale","label":"Scale","type":"number","min":0.5,"max":2,"step":0.05,"default":1,"suffix":"×","description":"Scale of cursor artwork; paint radius is unchanged."},{"key":"cursorLineWeight","label":"Line Weight","type":"number","min":0.5,"max":2,"step":0.1,"default":1,"suffix":"×","description":"Thickness of cursor contours and brush ring."},{"key":"cursorPrimaryColor","label":"Primary Color","type":"color","default":"#f9f9fb","description":"White cursor details and target marks."},{"key":"cursorSecondaryColor","label":"Secondary Color","type":"color","default":"#dea466","description":"Orange cursor details and brush ring."}]},{label:'Adjust Target Location',cursorTargets:true,fields:[{"key":"cursorAngle_select","label":"Select Target Azimuth","type":"number","min":0,"max":360,"step":1,"default":254,"description":"Angle from cursor center to target. 0° points right; 90° points down."},{"key":"cursorDistance_select","label":"Select Target Distance","type":"number","min":0,"max":48,"step":1,"default":11,"suffix":"px","description":"Distance from artwork center to click target in CSS pixels."},{"key":"cursorAngle_orbit","label":"Orbit Target Azimuth","type":"number","min":0,"max":360,"step":1,"default":253,"description":"Angle from cursor center to target. 0° points right; 90° points down."},{"key":"cursorDistance_orbit","label":"Orbit Target Distance","type":"number","min":0,"max":48,"step":1,"default":9,"suffix":"px","description":"Distance from artwork center to click target in CSS pixels."},{"key":"cursorAngle_pan-open","label":"Pan Target Azimuth","type":"number","min":0,"max":360,"step":1,"default":0,"description":"Angle from cursor center to target. 0° points right; 90° points down."},{"key":"cursorDistance_pan-open","label":"Pan Target Distance","type":"number","min":0,"max":48,"step":1,"default":0,"suffix":"px","description":"Distance from artwork center to click target in CSS pixels."},{"key":"cursorAngle_frame","label":"Frame All Target Azimuth","type":"number","min":0,"max":360,"step":1,"default":0,"description":"Angle from cursor center to target. 0° points right; 90° points down."},{"key":"cursorDistance_frame","label":"Frame All Target Distance","type":"number","min":0,"max":48,"step":1,"default":0,"suffix":"px","description":"Distance from artwork center to click target in CSS pixels."},{"key":"cursorAngle_brush","label":"Brush Target Azimuth","type":"number","min":0,"max":360,"step":1,"default":0,"description":"Angle from cursor center to target. 0° points right; 90° points down."},{"key":"cursorDistance_brush","label":"Brush Target Distance","type":"number","min":0,"max":48,"step":1,"default":0,"suffix":"px","description":"Distance from artwork center to click target in CSS pixels."},{"key":"cursorAngle_eyedropper","label":"Eyedropper Target Azimuth","type":"number","min":0,"max":360,"step":1,"default":252,"description":"Angle from cursor center to target. 0° points right; 90° points down."},{"key":"cursorDistance_eyedropper","label":"Eyedropper Target Distance","type":"number","min":0,"max":48,"step":1,"default":10,"suffix":"px","description":"Distance from artwork center to click target in CSS pixels."},{"key":"cursorAngle_replace","label":"Replace Color with Selected Target Azimuth","type":"number","min":0,"max":360,"step":1,"default":30,"description":"Angle from cursor center to target. 0° points right; 90° points down."},{"key":"cursorDistance_replace","label":"Replace Color with Selected Target Distance","type":"number","min":0,"max":48,"step":1,"default":24,"suffix":"px","description":"Distance from artwork center to click target in CSS pixels."},{"key":"cursorAngle_fill","label":"Connected Fill Target Azimuth","type":"number","min":0,"max":360,"step":1,"default":33,"description":"Angle from cursor center to target. 0° points right; 90° points down."},{"key":"cursorDistance_fill","label":"Connected Fill Target Distance","type":"number","min":0,"max":48,"step":1,"default":12,"suffix":"px","description":"Distance from artwork center to click target in CSS pixels."},{"key":"cursorAngle_restore","label":"Restore Target Azimuth","type":"number","min":0,"max":360,"step":1,"default":110,"description":"Angle from cursor center to target. 0° points right; 90° points down."},{"key":"cursorDistance_restore","label":"Restore Target Distance","type":"number","min":0,"max":48,"step":1,"default":3,"suffix":"px","description":"Distance from artwork center to click target in CSS pixels."}]}]},
  { id: 'themes', label: 'Themes', panels: [
    { label: 'Theme', fields: [
      { key: 'theme', label: 'Preset', type: 'select', options: [['blender','Blender Dark'],['graphite','Graphite'],['contrast','High Contrast']], default: 'blender', description: 'Apply a theme to every editor and viewport.' },
      { key: 'accent', label: 'Selection Color', type: 'color', default: '#e9a15b', description: 'Color of selected geometry and interface accents.' }
    ] }
  ] },
  { id: 'input', label: 'Input', panels: [
    { label: 'Input Style', fields: [
      { key: 'inputStyle', label: 'Input Style', type: 'select', options: [['blender','Blender · mouse + numpad'],['laptop','Laptop · Alt-drag + number row'],['trackpad','Trackpad · gestures']], default: 'blender', description: 'Sets the mouse, numpad and trackpad options below together. Blender: middle-drag orbits, numpad views. Laptop: Alt+left-drag orbits, number-row views. Trackpad: two-finger scroll pans, pinch zooms, Shift+scroll orbits.' }
    ] },
    { label: 'Mouse', fields: [
      { key: 'emulate3Button', label: 'Emulate 3 Button Mouse', type: 'checkbox', default: false, description: 'Use Alt + left drag in place of the middle mouse button. Shift pans; Ctrl zooms.' },
      { key: 'trackpadNavigation', label: 'Trackpad Gestures', type: 'checkbox', default: false, description: 'Two-finger scroll pans, pinch zooms, Shift + scroll orbits. Option/Alt + drag also orbits. Opens a full-size 3D workspace with editors revealed by tapping an edge. A mouse wheel pans in this mode.' }
    ] },
    { label: 'Keyboard', fields: [
      { key: 'emulateNumpad', label: 'Emulate Numpad', type: 'checkbox', default: false, description: 'Use the top-row number keys for numpad view shortcuts. Text fields keep normal typing.' }
    ] }
  ] },
  { id: 'navigation', label: 'Navigation', panels: [
    { label: 'Orbit & Pan', fields: [
      { key: 'orbitSensitivity', label: 'Orbit Sensitivity', type: 'number', min: 0.2, max: 3, step: 0.1, default: 1, suffix: '×', description: 'Speed of mouse and gizmo orbiting. Keyboard steps use Rotation Angle.' },
      { key: 'rotationAngle', label: 'Rotation Angle', type: 'number', min: 5, max: 90, step: 5, default: 15, suffix: '°', description: 'Angle of each keyboard or menu orbit and roll step.' },
      { key: 'autoPerspective', label: 'Auto Perspective', type: 'checkbox', default: false, description: 'Switch an axis-aligned orthographic view to perspective when orbiting.' }
    ] },
    { label: 'Framing', fields: [
      { key:'frameAllFill', label:'Frame All Viewport Fill', type:'number', min:10, max:100, step:1, default:72, suffix:'%', description:'Maximum share of viewport width or height occupied by the framed model. Lower values leave larger margins.' }
    ] },
    { label: 'Zoom', fields: [
      { key: 'zoomSensitivity', label: 'Zoom Sensitivity', type: 'number', min: 0.2, max: 3, step: 0.1, default: 1, suffix: '×', description: 'Speed of wheel and drag zooming.' },
      { key: 'invertZoom', label: 'Invert Zoom Direction', type: 'checkbox', default: false, description: 'Reverse wheel and drag zoom; explicit Zoom In and Zoom Out commands retain their meaning.' }
    ] }
  ] },
  { id: 'system', label: 'System', panels: [
    { label: 'Viewport Rendering', fields: [
      { key: 'simplifyThreshold', label: 'Simplified Rendering Threshold', type: 'number', min: 1, max: 1000000, step: 1, default: 50000, suffix: 'blocks', description: 'Above this live block count, disable animated block effects. Block selection and focus remain available. Textures, shader settings, and visibility controls remain available.' },
      { key: 'pixelRatio', label: 'Resolution Limit', type: 'select', numeric: true, options: [[1,'1× · Performance'],[1.5,'1.5× · Balanced'],[2,'2× · Quality']], default: 2, description: 'Maximum canvas pixels per display pixel, limited by your screen. Higher values use more memory.' }
    ] }
  ] },
  { id: 'save-load', label: 'Save & Load', panels: [
    { label: 'Model Import', fields: [
      { key: 'importPlacement', label: 'Placement', type: 'select', options: [['centered','Default · Centered on world axes'],['placed','Placed · Rest on floor'],['imported','As Imported']], default: 'centered', description: 'Applies to the next imported model. Default centers all axes. Placed centers workspace X/Y and rests the lowest extent on the Z=0 floor. As Imported preserves native position. Exported XML coordinates remain unchanged.' }
    ] },
    { label: 'Workspace', fields: [
      { key: 'rememberLayout', label: 'Remember Workspace Layout', type: 'checkbox', default: true, description: 'Save layouts and camera positions locally and restore them on startup. Disabling pauses layout saving and opens the default layout next time; the saved layout is retained.' }
    ] }
  ] }
];


const VIEWPORT_THEMES = {
  blender:['Blender','#393939'],
  maya:['Autodesk Maya','#4e4e4e','#2a2a2a'],
  max:['Autodesk 3ds Max','#444444','#1d1d1d'],
  cinema4d:['Cinema 4D','#4a4a4a','#313131'],
  zbrush:['ZBrush','#3c3c3c','#000000'],
  sketchup:['SketchUp','#ccccc9']
};
export const EDITOR_THEMES = [['viewport','3D Viewport'],['outliner','Outliner'],['properties','Properties'],['info','Info'],['preferences','Preferences'],['color','Color Editor'],['assets','Asset Library']];
PREFERENCE_SECTIONS.find(section=>section.id==='themes').panels.push(...EDITOR_THEMES.map(([id,label])=>({label,fields:[
  {key: id+'CustomColors',label:label+' Custom Colors',type:'checkbox',default:false,description:'Override the theme preset for this editor.'},
  ...(id==='viewport'?[
    {key:'viewportTheme',label:'Viewport Themes',description:'Apply a preset to the viewport theme background.',type:'select',default:'blender',options:[...Object.entries(VIEWPORT_THEMES).map(([key,[name]])=>[key,name]),['custom','Custom']]},
    {key:'viewportGradient',label:'Gradient Background',type:'checkbox',default:false,description:'Blend a top color into the theme background in viewports using the Theme background.'},
    {key:'viewportGradientTop',label:'Gradient Top Color',type:'color',default:'#222831',description:'Top color of the viewport theme gradient. The theme background provides the bottom color.'}
  ]:[]),
  ...[['Background',id==='viewport'?'#393939':'#303030'],['Header','#303030'],['Text','#d6d6d6'],['Accent','#e9a15b']].map(([part,color])=>({key:id+part,label:label+' '+part,type:'color',default:color,description:part+' color for '+label+'. Enable Custom Colors to apply.'}))
]})));
PREFERENCE_SECTIONS.splice(4,0,{id:'keymap',label:'Keymap',panels:[...new Set(KEYMAPS.map(item=>item.scope))].map(scope=>({label:scope,fields:KEYMAPS.filter(item=>item.scope===scope).map(item=>({key:'keymap_'+item.id,label:item.label,type:'binding',kind:item.kind||'key',default:item.binding,description:item.kind==='modifier'?'Choose the modifier held during this operation.':'Click the binding, then press a key combination or the indicated mouse gesture. Escape cancels recording; use Clear to unassign.'}))}))});
export function activeViewportTheme(preferences) {
  const background=editorTheme(preferences,'viewport').background.toLowerCase();
  return Object.keys(VIEWPORT_THEMES).find(key=>{
    const [,bottom,top]=VIEWPORT_THEMES[key];
    return bottom===background&&!!top===preferences.viewportGradient&&(!top||top===preferences.viewportGradientTop.toLowerCase());
  })||'custom';
}

export function editorTheme(preferences,id) {
  const theme=THEMES[preferences.theme];
  return {background:preferences[id+'CustomColors']?preferences[id+'Background']:(id==='viewport'?theme.viewport:theme.panel),header:preferences[id+'CustomColors']?preferences[id+'Header']:theme.header,text:preferences[id+'CustomColors']?preferences[id+'Text']:theme.text,accent:preferences[id+'CustomColors']?preferences[id+'Accent']:preferences.accent};
}

PREFERENCE_SECTIONS.push({id:'shaders',label:'Shaders',scope:'render',panels:[
  {label:'Surface',fields:[
    {key:'shaderColor',label:'Preview Color',type:'color',default:'#a0a0a0',description:'Primary color of Block Gallery blocks. Imported XML colors stay intact.'},
    {key:'shaderSpecular',label:'Specular Strength',type:'number',min:0,max:2,step:.05,default:.25,suffix:'×',description:'Intensity of the directional light reflection on solid faces.'},
    {key:'shaderRoughness',label:'Roughness',type:'number',min:.05,max:1,step:.05,default:.5,description:'Higher values broaden reflections; lower values produce tighter highlights.'}
  ]},
  {label:'Lighting',fields:[
    {key:'shaderAmbient',label:'Ambient Light',type:'number',min:0,max:2,step:.05,default:.35,suffix:'×',description:'Uniform lighting applied to every solid face.'},
    {key:'shaderLight',label:'Directional Light',type:'number',min:0,max:3,step:.05,default:.8,suffix:'×',description:'Strength of the directional light illuminating the model.'},
    {key:'shaderAzimuth',label:'Light Azimuth',type:'number',min:-180,max:180,step:5,default:-45,suffix:'°',description:'Horizontal direction of the light around the model.'},
    {key:'shaderElevation',label:'Light Elevation',type:'number',min:-90,max:90,step:5,default:55,suffix:'°',description:'Height of the light direction above or below the model.'},
    {key:'shaderAO',label:'Ambient Occlusion',type:'number',min:0,max:2,step:.05,default:1,suffix:'×',description:'Screen-space darkening of corners and crevices in Material and Rendered shading. 0 turns it off. Approximates the game\'s AO, which is ray-traced per block when a model is built.'},
    {key:'shaderAORadius',label:'AO Radius',type:'number',min:.1,max:10,step:.1,default:1.5,suffix:'u',description:'Distance in native units that ambient occlusion searches for nearby surfaces.'},
    {key:'shaderExposure',label:'Exposure',type:'number',min:-4,max:4,step:.1,default:0,suffix:'EV',description:'Brightness in stops. Each additional stop doubles surface brightness.'}
  ]}
]});
PREFERENCE_SECTIONS.find(s=>s.id==='shaders').panels.push(
  {label:'Game Surface',fields:[
    {key:'shaderTileScale',label:'Texture Scale',type:'number',min:.01,max:1,step:.01,default:.1,suffix:'/u',description:'World-space plating tiles per native coordinate unit; 0.1 gives one tile per ten units.'},
    {key:'shaderNormal',label:'Normal Strength',type:'number',min:0,max:2,step:.05,default:1,suffix:'×',description:'Tangent normal-map strength. Browser-decoded RGB is used without channel swapping.'},
    {key:'shaderMinReflection',label:'Facing Reflection',type:'number',min:0,max:1,step:.01,default:.05,description:'Sky reflection when facing the surface.'},
    {key:'shaderMaxReflection',label:'Grazing Reflection',type:'number',min:0,max:1,step:.01,default:.35,description:'Sky reflection at grazing angles; never lower than facing reflection.'},
    {key:'shaderDebug',label:'View Pass',type:'select',numeric:true,default:0,options:[[0,'Shaded'],[1,'Albedo'],[2,'Paint / cutout mask'],[3,'World normals'],[4,'Projection weights'],[5,'Lighting'],[6,'World texture coordinates'],[8,'Local face IDs']],description:'Inspect material inputs, lighting, or local face orientation before lighting.'}
  ]},
  {label:'Environment',fields:[
    {key:'shaderLightColor',label:'Light Color',type:'color',default:'#fff4e0',description:'Directional light color in the game-style gamma-space shading model.'},
    {key:'shaderAmbientColor',label:'Fill Color',type:'color',default:'#ffffff',description:'Uniform ambient fill color.'},
    {key:'shaderSkyAmbient',label:'Sky Ambient',type:'number',min:0,max:2,step:.05,default:.45,suffix:'×',description:'Six-axis ambient lighting. Disable this and Ambient Light for emission-only inspection.'}
  ]},
  {label:'Emission',fields:[
    {key:'shaderWindowColor',label:'Window Color',type:'color',default:'#ffdba8',description:'Viewer default for crew windows without secondary color. Native runtime default remains uncalibrated.'},
    {key:'shaderWindows',label:'Window Emission',type:'number',min:0,max:3,step:.05,default:1,suffix:'×',description:'Independent crew-window emission, applied after lighting. Explicit XML secondary alpha controls window tint.'},
    {key:'shaderGlow',label:'Glow Strength',type:'number',min:0,max:3,step:.05,default:1,suffix:'×',description:'Surface and effect emission strength.'},
    {key:'shaderHologramGlow',label:'Hologram Glow',type:'number',min:0,max:2,step:.05,default:1.5,suffix:'×',description:'How much hologram blocks glow. Low values keep their translucent hologram look.'},
    {key:'shaderBloom',label:'Bloom',type:'number',min:0,max:3,step:.05,default:1,suffix:'×',description:'Rendered-mode glow around bright emission, using the game\'s bloom passes. 0 turns it off. Native strength is uncalibrated.'},
    {key:'shaderSpill',label:'Light Spill',type:'number',min:0,max:3,step:.05,default:1,suffix:'×',description:'Rendered-mode light that light blocks and engines cast on nearby hull. 0 turns it off. Native radius and intensity are uncalibrated.'},
    {key:'shaderSpillRadius',label:'Light Spill Radius',type:'number',min:1,max:50,step:.5,default:5,suffix:'u',description:'Distance in native units that spilled light reaches. Light passes through blocks; there are no spill shadows.'},
    {key:'shaderBloomThreshold',label:'Bloom Threshold',type:'number',min:0,max:2,step:.05,default:.8,description:'Brightness above which surfaces and effects bloom. Native threshold is uncalibrated.'},
    {key:'shaderThinEnginePlumes',label:'Plumes from Hidden Thin Engines',type:'checkbox',default:true,description:'Keep engine plumes when zero-thickness or thin engine bodies are hidden by Show Thin Blocks. Manually hidden engines remain hidden.'},
    {key:'shaderEngineState',label:'Engine State',type:'select',numeric:true,default:1,options:[[0,'Idle'],[1,'Cruise'],[2,'Boost']],description:'Engine plumes as in game: none when idle, fixed lengths when cruising or boosting. Length does not depend on engine size.'},
    {key:'shaderCruiseLength',label:'Cruise Plume Length',type:'number',min:0,max:30,step:.25,default:5,suffix:'u',description:'Engine plume length in native units while cruising. Observed in game: 4 blocks.'},
    {key:'shaderBoostLength',label:'Boost Plume Length',type:'number',min:0,max:30,step:.25,default:8.25,suffix:'u',description:'Engine plume length in native units while boosting. Observed in game: about 8 to 8.5 blocks.'},
    {key:'shaderThrust',label:'Thruster Preview',type:'number',min:0,max:1,step:.05,default:.2,description:'Viewer-only animated thruster jet intensity. Jet length and spacing remain approximations.'},
    {key:'shaderBarrier',label:'Hangar Barrier',type:'number',min:0,max:1,step:.05,default:1,description:'Hangar barrier visibility in the viewer preview.'}
  ]}
);
// Typed paths were dropped: browsers cannot open a folder from a path string. The
// Asset Library panel remembers real folder handles instead (src/library-folders.js).
PREFERENCE_SECTIONS.push({id:'assets',label:'Asset Library',scope:'file',panels:[{label:'Library Folders',fields:[]}]});
PREFERENCE_SECTIONS.find(s=>s.id==='shaders').panels.find(p=>p.label==='Lighting').fields.unshift(
  ...[['Ambient','Ambient Fill'],['Directional','Directional Light'],['Sky','Sky Ambient']].map(([key,label])=>({key:'shader'+key+'Enabled',label:'Enable '+label,type:'checkbox',default:true,description:'Enable or disable '+label.toLowerCase()+' without changing its saved strength.'}))
);
PREFERENCE_SECTIONS.find(s=>s.id==='viewport').panels.push(
  {label:'Vignette',fields:[
    {key:'vignetteEnabled',label:'Enable Vignette',type:'checkbox',default:false,description:'Darken viewport edges without affecting interface controls.'},
    {key:'vignetteStrength',label:'Vignette Strength',type:'number',min:0,max:1,step:.05,default:.5,suffix:'×',description:'Edge darkening strength, from none to black.'}
  ]},
  {label:'Clipping',fields:[
    {key:'clipStart',label:'Clip Start',type:'number',min:.0001,max:9999999,step:.0001,default:.05,suffix:'u',description:'Nearest visible camera depth in native model units. Must be less than Clip End.'},
    {key:'clipEnd',label:'Clip End',type:'number',min:.01,max:10000000,step:.01,default:1000000,suffix:'u',description:'Farthest visible camera depth in native model units. Must exceed Clip Start.'}
  ]}
);
PREFERENCE_SECTIONS.push({id:'world',label:'World',scope:'render',panels:[{label:'World',fields:WORLD_FIELDS}]});
// Scene look (World, Shaders) lives in the Properties editor and asset folders in File;
// they stay in the same store so saving, reverting and factory reset still cover them.
export const APP_SECTIONS = PREFERENCE_SECTIONS.filter(section => !section.scope);
export const sectionById = id => PREFERENCE_SECTIONS.find(section => section.id === id);
export const FIELDS = Object.fromEntries(PREFERENCE_SECTIONS.flatMap(section => section.panels.flatMap(panel => panel.fields)).map(field => [field.key, field]));
export const FACTORY_PREFERENCES = Object.freeze({ version: 1, autoSave: true, ...Object.fromEntries(Object.values(FIELDS).map(field => [field.key, field.default])) });
// Each input style is a bundle of the individual input preferences.
export const INPUT_STYLES = {
  blender: { emulate3Button: false, emulateNumpad: false, trackpadNavigation: false },
  laptop: { emulate3Button: true, emulateNumpad: true, trackpadNavigation: false },
  trackpad: { emulate3Button: true, emulateNumpad: true, trackpadNavigation: true }
};
export const THEMES = {
  blender: { background: '#202020', panel: '#303030', header: '#303030', text: '#d6d6d6', muted: '#959595', viewport: '#393939', grid: '#424242', majorGrid: '#505050' },
  graphite: { background: '#181d24', panel: '#272e38', header: '#303a47', text: '#dbe3ed', muted: '#9baabb', viewport: '#2b3440', grid: '#354252', majorGrid: '#48596b' },
  contrast: { background: '#111111', panel: '#202020', header: '#111111', text: '#ffffff', muted: '#c5c5c5', viewport: '#222222', grid: '#3a3a3a', majorGrid: '#626262' }
};

const COLOR_PARTS = ['Background', 'Header', 'Text', 'Accent'];
// Enabling an editor's Custom Colors starts from what the editor shows now (the active
// theme preset), not from Blender Dark factory colors. Colors the user already chose stay.
export function customColorSeed(preferences, key) {
  const id = EDITOR_THEMES.find(([editor]) => key === editor + 'CustomColors')?.[0];
  if (!id || COLOR_PARTS.some(part => preferences[id + part] !== FACTORY_PREFERENCES[id + part])) return {};
  const colors = editorTheme({ ...preferences, [key]: false }, id);
  return { [id + 'Background']: colors.background, [id + 'Header']: colors.header, [id + 'Text']: colors.text, [id + 'Accent']: colors.accent };
}

export function validPreference(key, value) {
  if (key === 'autoSave') return typeof value === 'boolean';
  if (!Object.hasOwn(FIELDS, key)) return false;
  const field = FIELDS[key];
  if (field.type === 'paths') return typeof value === 'string' && value.length <= 16000;
  if (field.type === 'binding') return validBinding(value,field.kind);
  if (field.type === 'checkbox') return typeof value === 'boolean';
  if (field.type === 'number') return Number.isFinite(value) && value >= field.min && value <= field.max;
  if (field.type === 'color') return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
  return field.options.some(([option]) => option === value);
}

export function parsePreferences(raw) {
  const parsed = JSON.parse(raw);
  if (!parsed || parsed.version !== 1 || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Unsupported preferences');
  const result = { ...FACTORY_PREFERENCES };
  for (const key of Object.keys(result)) {
    if (key === 'version' || !Object.hasOwn(parsed, key)) continue;
    if (!validPreference(key, parsed[key])) throw new Error(`Invalid preference: ${key}`);
    result[key] = parsed[key];
  }
  // 0.1 was the old Hologram Glow default; saved copies of it move to the new default.
  if (parsed.shaderHologramGlow === .1) result.shaderHologramGlow = FACTORY_PREFERENCES.shaderHologramGlow;
  if(result.clipStart>=result.clipEnd)throw new Error('Clip Start must be less than Clip End');
  return result;
}

export function matchingPanels(section, query) {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return section.panels.filter(panel => {
    // Search matches the English text and the active translation.
    const source = [section.label, panel.label, ...panel.fields.flatMap(field => [field.label, field.description])];
    const text = [...source, ...source.map(t)].join(' ').toLowerCase();
    return words.every(word => text.includes(word));
  });
}

export function createPreferencesStore(storage) {
  let current = { ...FACTORY_PREFERENCES }, saved = { ...current }, error = '';
  const listeners = new Set();
  try {
    const raw = storage.getItem(PREFERENCES_KEY);
    if (raw !== null) current = parsePreferences(raw);
    saved = { ...current };
  } catch { error = 'Saved preferences could not be loaded. Using defaults.'; }
  const emit = () => listeners.forEach(listener => listener());
  const write = value => {
    try { storage.setItem(PREFERENCES_KEY, JSON.stringify(value)); saved = { ...value }; error = ''; return true; }
    catch { error = 'Preferences could not be saved. Browser storage is unavailable.'; return false; }
  };
  return {
    get value() { return current; },
    get dirty() { return JSON.stringify(current) !== JSON.stringify(saved); },
    get error() { return error; },
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    set(key, value) {
      if (!validPreference(key, value)) return false;
      if(key==='clipStart'&&value>=current.clipEnd||key==='clipEnd'&&value<=current.clipStart)return false;
      const preset=key==='viewportTheme'?VIEWPORT_THEMES[value]:null;
      const [,bottom,top]=preset||[];
      const viewport=preset?{
        ...(!current.viewportCustomColors?customColorSeed(current,'viewportCustomColors'):{}),
        viewportCustomColors:true,viewportBackground:bottom,viewportGradient:!!top,
        ...(top?{viewportGradientTop:top}:{})
      }:{};
      current = { ...current, [key]: value, ...(key === 'inputStyle' ? INPUT_STYLES[value] : {}), ...(value === true ? customColorSeed(current, key) : {}), ...viewport };
      if (current.autoSave) write(current);
      // Persist the manual-save policy without committing other unsaved fields.
      else if (key === 'autoSave') write({ ...saved, autoSave: false });
      emit(); return true;
    },
    save() { const success = write(current); emit(); return success; },
    revert() { current = { ...saved }; error = ''; emit(); },
    factory() {
      // Like Blender, factory reset is a live preview, never an implicit overwrite.
      current = { ...FACTORY_PREFERENCES, autoSave: false };
      error = ''; emit();
    }
  };
}

import {socketToolActive} from './interaction-modes.js';
import {bindingFor,shortcutLabel} from './keymaps.js';

const editorHints={
 outliner:['Click to select','Ctrl / Shift + click extend selection','Eye toggles visibility','Isolate shows only this group','RMB block actions'],
 assets:['Click to select an asset','Double-click to edit','Drag turret or component onto a socket'],
 color:['Choose a brush color','Switch between Wheel, List, Palettes, and Regions','Apply color to a model scope'],
 info:['Filter activity or errors','Copy log for troubleshooting'],
 properties:['Choose a category on the left','Search across properties','Click panel headers to expand or collapse'],
 preferences:['Choose a settings category','Changes preview live','Save Preferences when auto-save is off']
};
const categoryHints={
 object:['Inspect selected block','Edit block appearance and native data'],
 scene:['Review model dimensions','Capture a viewport image or turntable'],
 world:['Adjust world background and lighting'],
 shaders:['Adjust lighting, material response, and engine effects'],
 workspace:['Review layout','Reset the current workspace layout'],
 turrets:['Choose a turret socket','Attach library asset','Edit mounted pose and size'],
 components:['Choose or create a socket','Attach library component','Edit transform or symmetry'],
 coverage:['Compare slices and heatmap','Filter by turret or group','Inspect coverage points in viewport'],
 structure:['Select Base, Body, or Barrel','Inspect group blocks and appearance'],
 pose:['Adjust body rotation and barrel elevation','Show mechanical guides'],
 studio:['Choose weapon profile','Run tracking and firing previews'],
 showcase:['Scrub the timeline','Edit camera keys and timed events'],
 export:['Choose format and resolution','Export or cancel rendering'],
 calibration:['Load reference media','Align and measure the reference']
};
const paintHints={
 select:'LMB select or box select',
 brush:'LMB drag to paint',
 eyedropper:'LMB sample a block color',
 replace:'LMB replace matching colors',
 fill:'LMB fill connected matching blocks',
 restore:'LMB drag to restore original colors'
};
const operationHints={
 magnifier:['Wheel resizes Brush or Restore','LMB drag to paint in lens','Release RMB to close'],
 placement:['Point at a socket','Click an empty socket to attach','Use Replace for an occupied socket'],
 attachment:['Rotate or resize with viewport handles','Copy or paste pose and size','Properties opens precise controls'],
 componentGizmo:['Drag the attachment handle','Ctrl snaps','Shift allows free adjustment'],
 paint:['Drag to continue painting','Release LMB to finish'],
 select:['Drag to box select','Release LMB to finish'],
 orbit:['Drag to orbit','Release to keep view'],
 pan:['Drag to pan','Release to keep view'],
 zoom:['Drag to zoom','Release to keep view'],
 dolly:['Drag to dolly','Release to keep view']
};

export function statusHint({editor,view={},category,target,activity,preferences={},selected=false,coverageInspect=false,assetKind,translate=text=>text}={}){
 const keys=(id,label)=>{
  const binding=bindingFor(id,preferences);
  return binding?shortcutLabel(binding)+' '+translate(label):'';
 };
 const join=(...parts)=>parts.flat().filter(part=>typeof part==='string'&&part.length).join(' · ');
 const words=(...parts)=>parts.flat().map(translate);
 if(activity==='region')return join(keys('regionIn','drag to zoom in'),keys('regionOut','drag to zoom out'),keys('cancel','Cancel'));
 if(operationHints[activity])return join(words(operationHints[activity]),activity!=='magnifier'&&keys('cancel','Cancel'));
 if(target==='numeric')return join(words('Drag to adjust','Shift for fine adjustment','Ctrl for steps','Double-click or Enter to type','Esc cancels'));
 if(target==='search')return editor==='properties'?join(words('Search across all Properties categories','Enter / Shift + Enter cycles results')):join(words('Type to filter results'));
 if(target==='divider')return join(words('Drag to resize editors','Arrow keys resize focused divider'),keys('snapResize','Snap'));
 if(target==='header')return join(words('RMB for area options'),keys('maximize','Maximize'));
 if(target==='asset')return join(words('Click to select','Double-click to edit','Drag to a compatible socket'));
 if(target==='symmetry')return join(words('Checkbox enables mirroring','Edit plane position','Eye toggles guide visibility'));
 if(target==='modelPalette')return join(words('Choose brush color','Hide or isolate blocks by color','Show All restores visibility'));
 if(target==='outlinerRow')return join(words('Click to select','Ctrl / Shift + click extend selection','Eye toggles visibility','RMB for actions'));
 if(editor==='viewport'){
  if(view.interactionMode==='paint')return join(words(paintHints[view.paint?.tool]||paintHints.select,'MMB opens palette or drag to orbit','Hold RMB for magnifier'),keys('undoPaint','Undo'));
  if(socketToolActive(view))return join(words('LMB select socket or attachment','Drag library asset onto socket','RMB mounted turret or component for tools'),keys('selected','Frame Selected'));
  if(coverageInspect)return join(words('Click a coverage point to inspect','Open Inspection & Statistics for contributors'),keys('frame','Frame All'));
  const navigation=preferences.trackpadNavigation?words('Two-finger scroll Pan','Shift + scroll Orbit','Pinch Zoom'):preferences.emulate3Button?words('Alt + LMB Orbit','Alt + Shift + LMB Pan'):[keys('orbitDrag','Orbit'),keys('panDrag','Pan')];
  return join(navigation,!preferences.trackpadNavigation&&keys('wheelZoom','Zoom'),selected?keys('selected','Frame Selected'):keys('frame','Frame All'),keys('toggleMode','Cycle Mode'),keys('assetLibrary','Asset Library'),keys('sidebar','Sidebar'));
 }
 if(editor==='properties'&&categoryHints[category])return join(words(categoryHints[category]),keys('maximize','Maximize'));
 if(editor==='assets'&&assetKind)return join(words('Click to select','Double-click to edit',assetKind==='components'?'Drag component to a component socket':'Drag turret to a turret socket'));
 return join(words(editorHints[editor]||['Drag borders to resize','RMB header for area options']),keys('maximize','Maximize'));
}

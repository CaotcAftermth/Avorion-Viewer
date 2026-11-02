// Viewport interaction modes, in the order the header menu lists them and Tab cycles them.
export const INTERACTION_MODES=[['object','Object Mode'],['paint','Paint Mode'],['socket','Socket Mode']];
export const interactionMode=mode=>INTERACTION_MODES.some(([id])=>id===mode)?mode:'object';
export function nextInteractionMode(mode,step=1){
  const i=INTERACTION_MODES.findIndex(([id])=>id===interactionMode(mode)),n=INTERACTION_MODES.length;
  return INTERACTION_MODES[((i+step)%n+n)%n][0];
}

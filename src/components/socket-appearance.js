// Viewer preferences, independent of socket placement and ship data.
export const SOCKET_APPEARANCE_KEY='avorion-viewer.socket-appearance.v1';
export const DEFAULT_SOCKET_APPEARANCE=Object.freeze({gridColor:'#8cf0dc',gridOpacity:.9,backgroundColor:'#50738a',backgroundOpacity:.2});
export function socketAppearance(value={}){
 const result={...DEFAULT_SOCKET_APPEARANCE};if(!value||typeof value!=='object')return result;
 for(const key of ['gridColor','backgroundColor'])if(typeof value[key]==='string'&&/^#[0-9a-f]{6}$/i.test(value[key]))result[key]=value[key];
 for(const key of ['gridOpacity','backgroundOpacity'])if(Number.isFinite(value[key]))result[key]=Math.max(0,Math.min(1,value[key]));
 return result;
}
export function appearanceColor(color,opacity){return `rgba(${[1,3,5].map(i=>parseInt(color.slice(i,i+2),16)).join(',')},${opacity})`;}
// Blend the tint against a fixed drafting surface before drawing. The result is
// opaque, so scene pixels cannot affect it even at zero user tint opacity.
export function draftingBackground({backgroundColor,backgroundOpacity}){
 const neutral=[32,37,43],rgb=[1,3,5].map((i,j)=>Math.round(neutral[j]*(1-backgroundOpacity)+parseInt(backgroundColor.slice(i,i+2),16)*backgroundOpacity));
 return `rgb(${rgb.join(',')})`;
}

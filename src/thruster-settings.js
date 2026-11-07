// Ship coordinates, independent of camera and individual block orientation.
// Names describe the emitting face, rather than the resulting ship motion.
export const THRUSTER_DIRECTIONS = [
  {name:'Front',key:'shaderThrustFront',axis:2,sign:1},
  {name:'Back',key:'shaderThrustBack',axis:2,sign:-1},
  {name:'Left',key:'shaderThrustLeft',axis:0,sign:-1},
  {name:'Right',key:'shaderThrustRight',axis:0,sign:1},
  {name:'Top',key:'shaderThrustTop',axis:1,sign:1},
  {name:'Bottom',key:'shaderThrustBottom',axis:1,sign:-1},
];
export const THRUSTER_DIRECTION_DESCRIPTION = 'Activate ports facing this ship direction. Multiple directions can be active together.';
export const THRUSTER_DIRECTION_FIELDS = THRUSTER_DIRECTIONS.map(({name,key})=>({key,label:`Thruster ${name}`,type:'checkbox',default:true,description:THRUSTER_DIRECTION_DESCRIPTION}));
export function thrusterDirectionVectors(settings={}) {
  const positive=[1,1,1],negative=[1,1,1];
  for(const {key,axis,sign} of THRUSTER_DIRECTIONS)(sign>0?positive:negative)[axis]=settings[key]===false?0:1;
  return {positive,negative};
}

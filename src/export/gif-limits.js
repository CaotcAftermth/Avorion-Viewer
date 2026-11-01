export const GIF_MAX_SIDE=2048,GIF_MAX_FRAME_PIXELS=160000000;
export function gifLimits(duration,fps){
  const frames=Math.round(duration*fps);
  return {frames,pixels:Math.floor(GIF_MAX_FRAME_PIXELS/frames)};
}
export function fitGifSize(width,height,duration,fps,edited=null){
  const pixels=gifLimits(duration,fps).pixels;
  width=Math.max(1,Math.round(Number.isFinite(Number(width))?Number(width):1));height=Math.max(1,Math.round(Number.isFinite(Number(height))?Number(height):1));
  if(edited==='width')return {width:Math.min(width,GIF_MAX_SIDE,Math.floor(pixels/height)),height};
  if(edited==='height')return {width,height:Math.min(height,GIF_MAX_SIDE,Math.floor(pixels/width))};
  const scale=Math.min(1,GIF_MAX_SIDE/width,GIF_MAX_SIDE/height,Math.sqrt(pixels/width/height));
  return {width:Math.max(1,Math.floor(width*scale)),height:Math.max(1,Math.floor(height*scale))};
}
export function gifDimensionMax(width,height,duration,fps,locked){
  const pixels=gifLimits(duration,fps).pixels,ratio=width/height;
  return locked?{width:Math.floor(Math.min(GIF_MAX_SIDE,GIF_MAX_SIDE*ratio,Math.sqrt(pixels*ratio))),height:Math.floor(Math.min(GIF_MAX_SIDE,GIF_MAX_SIDE/ratio,Math.sqrt(pixels/ratio)))}:
    {width:Math.min(GIF_MAX_SIDE,Math.floor(pixels/height)),height:Math.min(GIF_MAX_SIDE,Math.floor(pixels/width))};
}

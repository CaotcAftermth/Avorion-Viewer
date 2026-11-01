// Weighted median-cut palette. A bounded RGB555 histogram keeps work proportional
// to the number of distinct colors rather than pixels times palette size.
export function gifPalette(rgba,background,transparent){
  const counts=new Uint32Array(32768),sums=[new Float64Array(32768),new Float64Array(32768),new Float64Array(32768)];
  const reserved=!!background||transparent;
  const skip=i=>(transparent&&rgba[i+3]<128)||background&&background.every((v,c)=>v===rgba[i+c]);
  const key=i=>((rgba[i]>>3)<<10)|((rgba[i+1]>>3)<<5)|(rgba[i+2]>>3);
  for(let i=0;i<rgba.length;i+=4)if(!skip(i)){const k=key(i);counts[k]++;for(let c=0;c<3;c++)sums[c][k]+=rgba[i+c];}
  const entries=[];
  for(let k=0;k<counts.length;k++)if(counts[k])entries.push({key:k,count:counts[k],rgb:sums.map(s=>s[k]/counts[k])});
  function box(colors){
    const low=[255,255,255],high=[0,0,0];let weight=0;
    for(const e of colors){weight+=e.count;for(let c=0;c<3;c++){low[c]=Math.min(low[c],e.rgb[c]);high[c]=Math.max(high[c],e.rgb[c]);}}
    const ranges=high.map((v,c)=>v-low[c]),axis=ranges.indexOf(Math.max(...ranges));
    return {colors,weight,axis,score:colors.length>1?ranges[axis]*Math.sqrt(weight):0};
  }
  const boxes=entries.length?[box(entries)]:[];
  while(boxes.length<(reserved?255:256)){
    let best=-1;for(let i=0;i<boxes.length;i++)if(boxes[i].score>0&&(best<0||boxes[i].score>boxes[best].score))best=i;
    if(best<0)break;
    const b=boxes[best],colors=b.colors.sort((a,c)=>a.rgb[b.axis]-c.rgb[b.axis]||a.key-c.key);
    let weight=0,split=1;
    for(let i=0;i<colors.length-1;i++){weight+=colors[i].count;split=i+1;if(weight>=b.weight/2)break;}
    boxes.splice(best,1,box(colors.slice(0,split)),box(colors.slice(split)));
  }
  const palette=new Uint8Array(768),lookup=new Uint8Array(32768);
  boxes.forEach((b,index)=>{
    const total=[0,0,0];for(const e of b.colors){lookup[e.key]=index;for(let c=0;c<3;c++)total[c]+=sums[c][e.key];}
    for(let c=0;c<3;c++)palette[index*3+c]=Math.round(total[c]/b.weight);
  });
  if(background)palette.set(background,255*3);
  const pixels=new Uint8Array(rgba.length/4);
  for(let i=0;i<rgba.length;i+=4)pixels[i/4]=skip(i)?255:lookup[key(i)];
  return {palette,pixels};
}

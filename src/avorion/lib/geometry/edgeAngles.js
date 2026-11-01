// Opposite-edge crease angles for non-indexed triangles. Coplanar diagonals
// stay suppressed while a threshold can reveal progressively shallower edges.
export function edgeAngles(p){
  const edges=new Map(),result=new Float32Array(p.length/3),normals=[];
  const key=i=>`${p[i]},${p[i+1]},${p[i+2]}`;
  for(let i=0;i<p.length;i+=9){
    const a=[p[i+3]-p[i],p[i+4]-p[i+1],p[i+5]-p[i+2]],b=[p[i+6]-p[i],p[i+7]-p[i+1],p[i+8]-p[i+2]];
    const n=[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],l=Math.hypot(...n)||1;normals.push(n.map(x=>x/l));
    for(let e=0;e<3;e++){
      const k=[key(i+((e+1)%3)*3),key(i+((e+2)%3)*3)].sort().join('|'),list=edges.get(k)||[];
      list.push([i/9,e]);edges.set(k,list);
    }
  }
  for(const list of edges.values())for(const [t,e] of list){
    let angle=1;
    if(list.length>1){angle=0;for(const [other] of list)if(other!==t){const dot=normals[t].reduce((s,x,k)=>s+x*normals[other][k],0);angle=Math.max(angle,Math.acos(Math.min(1,Math.max(-1,dot)))/Math.PI);}}
    result[t*3+e]=angle;
  }
  return result;
}

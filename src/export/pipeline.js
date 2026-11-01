import {blockOpacity} from '../block-opacity.js';
import {blockSurfaceGeometry} from '../avorion/lib/geometry/blockSurface.js';
import {defaultOrientationProfile} from '../avorion/lib/avorion/orientation.js';
import {getBlockDefinition} from '../avorion/lib/avorion/blockDefinitions.js';
import {getShadingSpec} from '../avorion/lib/textures/shadingMap.js';
import {indexTriangles,validateMesh,splitTJunctions,orientClosedBlock} from './mesh.js';
import {unionSolids} from './solid.js';
export async function prepareExport(snapshot,options,progress=()=>{}){
 if(!['stl','3mf','glb','gltf','obj'].includes(options.format)||!['shell','grouped','detailed'].includes(options.mode))throw Error('Unsupported export format or geometry mode.');
 if(!Number.isFinite(options.longest)||options.longest<.001||options.longest>1e6||!Number.isFinite(options.budget)||options.budget<64||options.budget>4096)throw Error('Invalid export size or memory budget.');
 const tolerance=options.mode==='shell'?(options.tolerance??0):0;if(!Number.isFinite(tolerance)||tolerance<0||tolerance>options.longest*.01)throw Error('Solid tolerance must be between 0 and 1% of the longest dimension.');
 const warnings=[...snapshot.warnings],profile=defaultOrientationProfile(),budget=options.budget*1024*1024;
 const translucent=b=>{const surface=getShadingSpec(b.typeIndex).surface;return surface==='glass'||surface==='hologram';};
 const blocks=snapshot.blocks.filter(b=>options.includeTransparent||!translucent(b));if(!blocks.length)throw Error('No geometry remains with these settings.');
 // Conservative preflight for the mesh, validator maps, boolean workspace, and preview copies.
 const estimate=blocks.length*(options.mode==='shell'?20000:6000);if(estimate>budget)throw Error(`Estimated working memory ${Math.ceil(estimate/1048576)} MiB exceeds the ${options.budget} MiB budget. Export a selection/region or explicitly increase the budget.`);
 const invalid=[];
 for(const b of blocks){let reason;
  if(!['x','y','z'].every(a=>Number.isFinite(b.position[a])&&Number.isFinite(b.size[a])&&b.size[a]>0))reason='Invalid bounds';
  else if(![b.look,b.up].every(v=>Number.isInteger(v)&&v>=0&&v<6)||Math.floor(b.look/2)===Math.floor(b.up/2))reason='Invalid orientation';
  else if(getBlockDefinition(b.typeIndex).category==='Unknown')reason='Unknown block type '+b.typeIndex;
  else if(!/^[0-9a-f]{8}$/i.test(b.color)||(b.secondaryColor!==undefined&&!/^[0-9a-f]{8}$/i.test(b.secondaryColor)))reason='Invalid ARGB color';
  if(reason)invalid.push({id:b.id,reason});
 }
 if(invalid.length)throw Object.assign(Error(invalid.slice(0,8).map(v=>`${v.reason} on block ${v.id}`).join('; ')+(invalid.length>8?`; and ${invalid.length-8} more.`:'.')),{issueIds:invalid.map(v=>v.id),issues:invalid});

 const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(const b of blocks)for(const [i,a]of ['x','y','z'].entries()){min[i]=Math.min(min[i],b.position[a]-b.size[a]/2);max[i]=Math.max(max[i],b.position[a]+b.size[a]/2);}
 const factor=options.unitScale>0?options.unitScale:options.longest/Math.max(...max.map((v,i)=>v-min[i])),center=snapshot.placement==='centered'?min.map((v,i)=>(v+max[i])/2):[0,0,0];
 const geometries=[],objects=[],materials=[],materialMap=new Map(),cache=new Map(),groups=new Map(),parts=[];let removedDegenerate=0,removedDuplicate=0,splitEdges=0,reoriented=0;
 const metadata=blocks.map(({exportPositions,...b})=>({...b}));

 for(let i=0;i<blocks.length;i++){
  const b=blocks[i],surface=getShadingSpec(b.typeIndex).surface,alpha=['glass','hologram'].includes(surface)?blockOpacity(b):1;
  const materialKey=b.materialIndex+'|'+b.color+'|'+surface+'|'+alpha;let material=materialMap.get(materialKey);if(material===undefined){material=materials.length;materialMap.set(materialKey,material);materials.push({name:(b.material||'Material')+' '+b.color,hex:'#'+b.color.slice(-6),alpha,metallic:.15,roughness:.65,extras:{materialIndex:b.materialIndex,primaryARGB:b.color,surface}});}
  if(options.mode==='shell'&&b.exportPositions){const positions=b.exportPositions.map((v,j)=>v+b.position[['x','y','z'][j%3]]-center[j%3]);parts.push({id:b.id,mesh:orientClosedBlock(indexTriangles(positions,{cleanup:true})),center:['x','y','z'].map(a=>b.position[a])});continue;}
  if(options.mode==='shell'){parts.push({id:b.id,block:{...b,position:Object.fromEntries(['x','y','z'].map((a,j)=>[a,b.position[a]-center[j]]))},center:['x','y','z'].map(a=>b.position[a])});continue;}
  const key=b.exportPositions?b.id:[b.typeIndex,b.look,b.up,b.size.x,b.size.y,b.size.z].join('|');let geometry=cache.get(key);if(geometry===undefined){const positions=b.exportPositions?b.exportPositions.slice():blockSurfaceGeometry({...b,position:{x:0,y:0,z:0}},profile).positions;for(let j=0;j<positions.length;j++)positions[j]*=factor;let mesh=indexTriangles(positions,{tolerance:0,cleanup:options.cleanup});if(b.typeIndex===10){mesh=splitTJunctions(mesh);splitEdges+=mesh.splitEdges;}if(options.cleanup){mesh=orientClosedBlock(mesh);reoriented+=mesh.reoriented;}geometry=geometries.length;geometries.push(mesh);cache.set(key,geometry);removedDegenerate+=mesh.removedDegenerate;removedDuplicate+=mesh.removedDuplicate;}
  const translation=['x','y','z'].map((a,j)=>(b.position[a]-center[j])*factor),mesh=geometries[geometry];
  if(options.mode==='detailed')objects.push({name:`${b.id}_${b.type}`,geometry,material,translation,sourceIds:[b.id]});
  else{
   const key=`${translucent(b)?'Transparent':'Opaque'}_${b.type}_${b.material}_${material}`,group=groups.get(key)||{name:key,material,pieces:[],sourceIds:[],triangleRanges:[],triangles:0};
   const positions=mesh.positions.map((v,j)=>v+translation[j%3]);
   {group.pieces.push({positions,indices:mesh.indices});group.sourceIds.push(b.id);group.triangleRanges.push({id:b.id,start:group.triangles,count:mesh.indices.length/3});group.triangles+=mesh.indices.length/3;groups.set(key,group);}
  }
  if(i%128===0)progress(5+25*i/blocks.length,'Building block geometry…');
 }
 if(options.mode!=='detailed'){geometries.length=0;if(options.mode==='shell'){geometries.push(await unionSolids(parts,progress,tolerance,options.cleanup,{scale:factor,precisionScale:['glb','gltf'].includes(options.format)?.001:1,fillCavities:options.fillCavities,maxTriangles:Math.floor(budget/600)}));objects.push({name:'Printable_shell',geometry:0,material:0,translation:[0,0,0],sourceIds:[]});warnings.push('Solid union removes internal surfaces. '+(options.fillCavities?'Sealed cavities are filled.':'Cavities are preserved.')+' Disconnected solids remain disconnected. Material boundaries are not retained in the printable shell. Source-block attribution after union is unavailable.');}
 else for(const group of groups.values()){
  // Keep each block's topology. Welding equal positions across independent
  // blocks creates artificial non-manifold edges at shared faces and contacts.
  const positions=new Float32Array(group.pieces.reduce((n,p)=>n+p.positions.length,0)),indices=new Uint32Array(group.triangles*3);let vertexOffset=0,indexOffset=0;
  for(const piece of group.pieces){positions.set(piece.positions,vertexOffset*3);for(const index of piece.indices)indices[indexOffset++]=index+vertexOffset;vertexOffset+=piece.positions.length/3;}
  const geometry=geometries.length;geometries.push({positions,indices});objects.push({name:group.name,geometry,material:group.material,translation:[0,0,0],sourceIds:group.sourceIds,triangleRanges:group.triangleRanges});
 }}
 if(geometries[0]?.collapsedFaces)warnings.push(`Export cleanup removed ${geometries[0].collapsedFaces} faces after float32 output cleanup; the serialized geometry is validated again below.`);
 if(geometries[0]?.retriangulated)warnings.push(`Repaired ${geometries[0].retriangulated} collapsed triangles by retriangulation; cancelled ${geometries[0].cancelledFaces} opposite zero-volume faces and split ${geometries[0].splitContactEdges} contact edges. Maximum new-vertex rounding: ${geometries[0].repairRounding} mm. No hole filling or block removal.`);
 if(geometries[0]?.precisionCollapsedEdges)warnings.push(`Rounded ${geometries[0].precisionCollapsedEdges} contact edges without a representable float32 midpoint. Total displacement bound: ${geometries[0].repairDisplacement} mm. Closed topology is revalidated after repair.`);
 progress(88,'Validating processed geometry…');
 const reports=geometries.map(g=>validateMesh(g,{maxTriangles:Math.floor(budget/600)})),issueIds=new Set();
 for(const o of objects){const r=reports[o.geometry];if(r.status==='Failed'){if(o.triangleRanges)for(const issue of r.issueTriangles){const range=o.triangleRanges.find(v=>issue>=v.start&&issue<v.start+v.count);if(range)issueIds.add(range.id);}else for(const id of o.sourceIds)issueIds.add(id);}}
 const totals={vertices:0,triangles:0,boundaryEdges:0,nonManifoldEdges:0,nonManifoldVertices:0,degenerateTriangles:0,duplicateFaces:0,components:0};for(const o of objects)for(const key of Object.keys(totals))totals[key]+=reports[o.geometry][key]||0;
 const unchecked=reports.some(r=>r.status==='Not checked'),closed=reports.every(r=>r.watertight==='Passed');
 const geometryBounds=geometries.map(g=>{const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(const index of g.indices)for(let a=0;a<3;a++){const v=g.positions[index*3+a];min[a]=Math.min(min[a],v);max[a]=Math.max(max[a],v);}return {min,max};}),outputMin=[Infinity,Infinity,Infinity],outputMax=[-Infinity,-Infinity,-Infinity];
 for(const o of objects)for(let a=0;a<3;a++){outputMin[a]=Math.min(outputMin[a],geometryBounds[o.geometry].min[a]+o.translation[a]);outputMax[a]=Math.max(outputMax[a],geometryBounds[o.geometry].max[a]+o.translation[a]);}
 const dimensions=outputMax.map((v,i)=>v-outputMin[i]);if(!dimensions.every(Number.isFinite))throw Error('Processed geometry has no finite bounds.');
 warnings.push('Basic materials approximate primary RGB/alpha only. Secondary ARGB and original block metadata are retained, but shader textures, glows, decals, and animations are not baked.');
 warnings.push('Self-intersection scan, minimum wall thickness, supports, and printer suitability: Not checked. Closed topology alone is not a printability guarantee.');if(options.format==='stl')warnings.push('STL is unitless; coordinates are written in millimeters. Import with millimeter units.');if(unchecked)warnings.push('Topology validation exceeded the memory budget: Not checked.');
 if(reoriented)warnings.push(`Corrected winding on ${reoriented} triangles in shared block geometry.`);
 if(splitEdges)warnings.push(`Split ${splitEdges} T-junction edges in shared hangar geometry without changing its surface. Hangar rim/depth follow the current viewer approximation.`);
 if(removedDegenerate||removedDuplicate)warnings.push(`Safe cleanup removed ${removedDegenerate} degenerate and ${removedDuplicate} duplicate triangles from shared geometry.`);
 const summary={'Blocks':blocks.length,'Excluded zero/thin blocks':snapshot.excludedThinBlocks||0,'Excluded problem blocks':snapshot.excludedProblemBlocks||0,'Objects':objects.length,'Dimensions X × Y × Z (mm)':dimensions.map(v=>v.toFixed(3)).join(' × '),'Vertices':totals.vertices,'Triangles':totals.triangles,'Boundary edges':unchecked?'Not checked':totals.boundaryEdges,'Non-manifold edges':unchecked?'Not checked':totals.nonManifoldEdges,'Non-manifold vertices':unchecked?'Not checked':totals.nonManifoldVertices,'Degenerate triangles':unchecked?'Not checked':totals.degenerateTriangles,'Duplicate faces':unchecked?'Not checked':totals.duplicateFaces,'Connected shells':unchecked?'Not checked':totals.components,'Winding':unchecked?'Not checked':reports.every(r=>r.winding==='Passed')?'Passed':'Failed','Mesh validation':unchecked?'Not checked':closed?'Passed':'Failed','Watertight topology':unchecked?'Not checked':reports.every(r=>!r.boundaryEdges&&!r.nonManifoldEdges&&!r.nonManifoldVertices&&!r.invalidTriangles&&r.winding==='Passed')?'Passed':'Failed','Solid processing':options.mode==='shell'?'Manifold union passed':'Not requested','Self-intersections':'Not checked','Unit scale (mm / native unit)':factor};
 if(options.mode==='shell'&&!closed)warnings.push('Printable mesh validation failed. See separate boundary-edge, winding, and degenerate-triangle counts; this does not necessarily mean the mesh has holes. Tiny faces can collapse at output precision. Try an explicit small solid tolerance, export a smaller scope, or repair the source. No failed shell can be downloaded.');
 if(options.mode==='shell'&&tolerance>0)warnings.push(`Optional solid simplification requested with ${tolerance} mm maximum surface deviation before float32 serialization. Recheck thin details in the processed preview.`);
 if(options.mode!=='shell')warnings.push('Editable output keeps separate block surfaces and their overlaps. Choose Printable exterior shell to union blocks and remove internal surfaces.');
 if(options.format==='3mf'&&options.mode!=='shell'&&(!closed||unchecked))warnings.push('3MF requires validated closed mesh objects. Choose shell mode to resolve shared faces and overlaps, or individual blocks to preserve separate closed objects.');
 if(options.format==='stl'&&options.mode!=='shell')warnings.push('Visual STL: block surfaces are exported without union. Internal faces and overlaps remain; this is not a validated printable shell.');
 if(options.format==='stl')summary['File size (bytes)']=84+totals.triangles*50;
 summary['Estimated working memory (MiB)']=Math.ceil(estimate/1048576);
 const result={geometries,objects,materials,metadata,options:{...options},snapshot:{...snapshot,blocks:undefined},dimensions,factor,summary,warnings,issueIds:[...issueIds],reports,downloadable:!(options.mode==='shell'||options.format==='3mf')||closed&&!unchecked};progress(100,'Prepared');return result;
}

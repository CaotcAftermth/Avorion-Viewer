import test from 'node:test';
import assert from 'node:assert/strict';
import {repairCollapsedTriangles} from '../src/export/repair.js';
import {validateMesh,triangleNormal} from '../src/export/mesh.js';

const tetra=(mid=[1,0,0])=>({positions:new Float32Array([0,0,0,2,0,0,0,2,0,0,0,2,...mid]),indices:new Uint32Array([0,2,1,0,4,3,4,1,3,0,1,4,0,3,2,1,2,3])});
test('collinear triangle repaired without changing surface vertices, volume or input',()=>{
 const mesh=tetra(),before=mesh.indices.slice(),report=validateMesh(mesh);assert.equal(report.degenerateTriangles,1);assert.equal(report.boundaryEdges,0);
 const repaired=repairCollapsedTriangles(mesh),after=validateMesh(repaired);assert.equal(after.status,'Passed');assert.equal(repaired.retriangulated,1);assert.ok(Math.abs(after.volume-report.volume)<1e-12);assert.deepEqual(mesh.indices,before);
 const original=new Set(Array.from({length:mesh.positions.length/3},(_,i)=>[...mesh.positions.subarray(i*3,i*3+3)].join(',')));for(let i=0;i<repaired.positions.length;i+=3)assert.ok(original.has([...repaired.positions.subarray(i,i+3)].join(',')));
});
test('collapsed edge stitches surrounding faces without leaving a hole',()=>{
 const mesh=tetra([0,0,0]),before=validateMesh(mesh);assert.equal(before.degenerateTriangles,2);
 const repaired=repairCollapsedTriangles(mesh),after=validateMesh(repaired);assert.equal(after.status,'Passed');assert.equal(repaired.collapsedFaces,2);assert.equal(after.triangles,4);assert.equal(after.volume,before.volume);
});
test('open mesh is not silently filled by precision repair',()=>{
 const mesh=tetra();mesh.indices=mesh.indices.slice(3);const repaired=repairCollapsedTriangles(mesh);assert.equal(repaired.indices,mesh.indices);assert.ok(validateMesh(repaired).boundaryEdges>0);
});
test('valid tiny triangles are never removed merely for their size',()=>{
 const mesh=tetra([1,0,1e-7]);assert.ok(triangleNormal(mesh.positions,0,1,4).some(v=>v!==0));const repaired=repairCollapsedTriangles(mesh);assert.equal(repaired.indices,mesh.indices);assert.equal(validateMesh(repaired).status,'Passed');
});

test('collinear closed strips repair through shorter intermediate diagonals without changing the remaining surface',()=>{
 const positions=new Float32Array([0,0,0,2,0,0,0,2,0,0,0,2,4,0,0,5,0,0,6,0,0,7,0,0]);
 const indices=new Uint32Array([0,2,1,0,1,3,0,3,2,1,2,3,4,6,5,4,5,7,4,7,6,5,6,7]);
 const mesh={positions,indices},saved=positions.slice(),before=validateMesh(mesh),repaired=repairCollapsedTriangles(mesh),after=validateMesh(repaired);
 assert.equal(before.degenerateTriangles,4);assert.equal(after.status,'Passed');assert.equal(after.triangles,4);assert.equal(after.volume,before.volume);assert.ok(repaired.retriangulated>0);assert.deepEqual(positions,saved);
 for(let i=0;i<repaired.positions.length;i+=3)assert.ok(Array.from({length:4},(_,v)=>v).some(v=>[0,1,2].every(a=>positions[v*3+a]===repaired.positions[i+a])));
});

test('opposite flat faces can cancel without deleting valid neighboring shells',()=>{
 const positions=new Float32Array([0,0,0,2,0,0,0,2,0,0,0,2,4,0,0,5,0,0,6,0,0]);
 const indices=new Uint32Array([0,2,1,0,1,3,0,3,2,1,2,3,4,5,6,4,6,5]),mesh={positions,indices};
 const repaired=repairCollapsedTriangles(mesh);assert.equal(validateMesh(repaired).status,'Passed');assert.equal(repaired.indices.length,12);assert.equal(validateMesh(repaired).volume,validateMesh(mesh).volume);
});

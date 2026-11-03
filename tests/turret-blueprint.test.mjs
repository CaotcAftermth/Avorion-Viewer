import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../src/vendor/three.module.js';
import {makeBlock,makeModel} from '../src/block-model.js';
import {demoProject} from '../src/turrets/core.js';
import {blockSockets} from '../src/turrets/sockets.js';
import {placeTurret} from '../src/turrets/mounts.js';
import {syncTurrets} from '../src/turrets/render.js';

test('mounted turrets switch to blueprint edges and restore normal colors without rebuilding',()=>{
 const block=makeBlock({typeIndex:20,size:{x:4,y:1,z:4}}),model=makeModel([block]);
 const scene={model,loaded:true,visible:true,revision:1},asset=demoProject().assets[0];asset.sourceSize=1;
 placeTurret(scene,asset,blockSockets(block).find(s=>s.normal[1]===1),1);
 const world=new THREE.Scene(),normal={display:{}},blueprint={display:{blueprint:true}};
 const group=syncTurrets(world,scene,normal,()=>{}),mesh=group.children[0].children.find(o=>o.isMesh);
 assert.equal(mesh.material.vertexColors,true);
 const geometry=mesh.geometry;
 assert.equal(syncTurrets(world,scene,blueprint,()=>{}),group);
 assert.equal(mesh.geometry,geometry);assert.equal(mesh.material.vertexColors,false);
 const edges=group.children[0].children.filter(o=>o.userData.blueprintEdges);
 assert.ok(edges.length);assert.ok(edges.every(o=>o.visible&&o.geometry.attributes.position.count>0));
 syncTurrets(world,scene,normal,()=>{});assert.equal(mesh.material.vertexColors,true);
 assert.ok(edges.every(o=>!o.visible));assert.equal(mesh.material.polygonOffset,false);
});

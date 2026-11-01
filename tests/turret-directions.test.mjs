import test from 'node:test';
import assert from 'node:assert/strict';
import {inFireDirection,FIRE_DIRECTIONS} from '../src/turrets/fire-directions.js';
import {computeShipCoverage} from '../src/turrets/fire-coverage.js';
import {demoProject} from '../src/turrets/core.js';
test('six directional sectors cover the sphere using standard ship axes',()=>{
 for(const [name,[axis,sign]] of Object.entries(FIRE_DIRECTIONS)){const d=[0,0,0];d[axis]=sign;assert.equal(inFireDirection(d,name),true);assert.equal(Object.keys(FIRE_DIRECTIONS).filter(k=>inFireDirection(d,k)).length,1);}
 for(let lat=-90;lat<=90;lat+=5)for(let lon=0;lon<360;lon+=5){const a=lat*Math.PI/180,b=lon*Math.PI/180,d=[Math.cos(a)*Math.cos(b),Math.sin(a),Math.cos(a)*Math.sin(b)];assert.ok(Object.keys(FIRE_DIRECTIONS).some(k=>inFireDirection(d,k)));}
});
test('direction includes all capable turrets regardless of socket facing or selection',()=>{
 const project=demoProject(),asset=project.assets[0];asset.blocks=[];asset.parts={};asset.native={offsets:{barrel:[0,0,0]}};asset.muzzlePositions=[[0,0,0]];
 const mounts=project.instances.map(i=>({...i,asset})),result=computeShipCoverage({blocks:[],mounts,sockets:project.sockets,step:30});
 assert.equal(result.turrets.length,4);assert.equal(result.warnings.length,0);
 for(const direction of Object.keys(FIRE_DIRECTIONS))assert.ok(result.turrets.some(t=>t.samples.some(s=>inFireDirection(s.direction,direction))));
 const top=result.turrets.filter(t=>t.samples.some(s=>inFireDirection(s.direction,'top')));assert.ok(top.length>1,'top coverage includes multiple mount orientations');
});

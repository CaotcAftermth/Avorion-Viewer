import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../src/vendor/three.module.js';
import {makeBlock,makeModel,ORIENTATIONS} from '../src/block-model.js';
import {defaultOrientationProfile,resolveOrientation} from '../src/avorion/lib/avorion/orientation.js';
import {DEFAULT_GAME_SHADER} from '../src/avorion/types/index.js';
import {buildTexturedModel} from '../src/avorion/lib/geometry/texturedModel.js';
import {boxTypes,isCanonicalBox} from '../src/avorion/lib/geometry/boxInstances.js';
import {endpointBoundsWriter,instanceOrientation,encodeOrientationSeams,decodeOrientation,decodeSeams} from '../src/avorion/lib/geometry/wedgeInstances.js';
import {selectedBlockEdges} from '../src/selection-outline.js';

const profile=defaultOrientationProfile();
const build=(blocks,options)=>buildTexturedModel(makeModel(blocks),profile,{...DEFAULT_GAME_SHADER,simplified:true,...options});
const hull=m=>m.group.children.filter(child=>child.userData.textured);
const orientations=ORIENTATIONS.map(({look,up})=>({look,up}));

test('native orientation preserves all 64 seam masks exactly in Float32',()=>{
    assert.equal(orientations.length,24);
    for(const {look,up} of orientations)for(let mask=0;mask<64;mask++){
        const packed=Math.fround(encodeOrientationSeams(look,up,mask));
        assert.equal(decodeSeams(packed),mask);
        assert.equal(decodeOrientation(packed),look*6+up);
    }
});

test('endpoint boxes recover center rounding losses across the box allowlist',()=>{
    const writer=endpointBoundsWriter(profile,'box');
    let recovered=0;
    for(const typeIndex of boxTypes)for(const orientation of orientations){
        const b=makeBlock({...orientation,typeIndex,position:{x:127.9837498,y:-5.3231,z:.75},
            size:{x:.349999999999,y:.93750041,z:2.123456789}});
        assert.ok(writer(b));
        if(!isCanonicalBox(b,profile))recovered++;
        assert.equal(writer({...b,position:{...b.position,x:1e12}}),false);
        assert.equal(writer({...b,look:b.up}),false);
    }
    assert.ok(recovered>0);
    const blocks=Array.from({length:16},(_,i)=>makeBlock({...orientations[0],typeIndex:2,id:'e'+i,
        position:{x:127.9837498,y:i/16,z:.75},size:{x:.349999999999,y:.93750041+i/128,z:2.123456789}}));
    const endpoint=build(blocks,{canonicalBoxes:true,canonicalEndpointBoxes:true});
    try{assert.equal(hull(endpoint)[0].geometry.userData.canonicalLayout,'endpointBox');}finally{endpoint.dispose();}
});

for(const typeIndex of [2,150,100,151])test('discrete canonical '+typeIndex+' preserves baked triangles, picking, paint and pose across 24 orientations',()=>{
    const wedge=typeIndex===100||typeIndex===151;
    const blocks=orientations.map((orientation,i)=>makeBlock({...orientation,typeIndex,id:'b'+i,
        position:{x:(i%6)*4,y:Math.floor(i/6)*4,z:.0312345},
        size:{x:1.25+i/32,y:2.0000001,z:1.0625},secondaryColor:'80345678'}));
    const model=build(blocks,{canonicalBoxes:!wedge,canonicalWedges:wedge,canonicalDiscrete:true});
    const legacy=build(blocks,{instancing:false});
    try{
        assert.equal(hull(model).length,1);
        const [mesh]=hull(model),[reference]=hull(legacy),g=mesh.geometry;
        assert.equal(g.instanceCount,24);
        assert.equal(g.userData.canonicalLayout,wedge?'discreteWedge':'discreteBox');
        assert.equal(Object.keys(g.attributes).length,14);
        assert.equal(Object.values(g.attributes).filter(a=>a.isInstancedBufferAttribute).reduce((n,a)=>n+a.itemSize*4,0),128);
        const idSet=new Set(['b0','b12','b23']);
        assert.deepEqual(selectedBlockEdges(model.group,idSet),selectedBlockEdges(legacy.group,idSet));
        for(const [i,b] of blocks.entries()){
            const {quaternion}=resolveOrientation(profile,b.look,b.up,typeIndex);
            const rotation=instanceOrientation(g,i),p=new THREE.Vector3(.25,1,2);
            assert.ok(p.clone().applyMatrix3(rotation).distanceTo(p.clone().applyQuaternion(quaternion))<1e-12);
            const center=new THREE.Vector3(b.position.x,b.position.y,b.position.z);
            for(const [x,y] of [[.25,-.25],[-.32,.32]]){
                const origin=new THREE.Vector3(x,y,4).applyQuaternion(quaternion).add(center);
                const ray=new THREE.Raycaster(origin,new THREE.Vector3(0,0,-1).applyQuaternion(quaternion),0,5);
                const hit=ray.intersectObject(mesh).find(h=>h.blockId===b.id);
                const baked=ray.intersectObject(reference).find(h=>h.blockId===b.id);
                if(wedge&&x<0)assert.equal(baked,undefined);
                else assert.ok(baked);
                assert.equal(!!hit,!!baked);
                if(hit){
                    assert.equal(hit.faceIndex,baked.faceIndex-i*g.getAttribute('position').count/3);
                    assert.deepEqual(hit.point,baked.point);
                    assert.deepEqual(hit.face.normal,baked.face.normal);
                    assert.equal(hit.distance,baked.distance);
                }
            }
        }
        const emission=g.getAttribute('aEmission').array.slice();
        blocks[0].secondaryColor='40aabbcc';
        for(const m of [model,legacy]){
            m.updateColors(makeModel(blocks),new Set(['b0']));
            m.setHidden(new Set(['b1']));
        }
        assert.deepEqual(g.getAttribute('aEmission').array,emission);
        const pose=new Map([['b0',new THREE.Matrix4().makeTranslation(0,2,0)]]);
        for(const m of [model,legacy])m.setBlockTransforms(pose);
        assert.equal(mesh.geometry.getAttribute('aScale'),undefined);
        for(const [name,attribute] of Object.entries(reference.geometry.attributes))
            assert.deepEqual(mesh.geometry.getAttribute(name).array,attribute.array,name);
    }finally{model.dispose();legacy.dispose();}
});

test('discrete grouping keeps the 16-block threshold and 1024-instance chunk limit',()=>{
    const blocks=Array.from({length:1040},(_,i)=>makeBlock({...orientations[i%24],id:'b'+i,typeIndex:100,
        position:{x:0,y:0,z:0},size:{x:1+i/4096,y:2,z:1}}));
    const options={canonicalWedges:true,canonicalDiscrete:true};
    for(const [size,counts] of [[15,[undefined]],[16,[16]],[1040,[1024,16]]]){
        const model=build(blocks.slice(0,size),options);
        try{
            assert.deepEqual(hull(model).map(m=>m.userData.instanced?m.geometry.instanceCount:undefined),counts);
            assert.equal(model.ranges.size,size);
        }finally{model.dispose();}
    }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {fittedSize,socketSizeLimit,snappedMountRotation} from '../src/turrets/context-toolbar.js';
test('toolbar resize respects half steps, hard limits and socket clearance',()=>{
 assert.equal(socketSizeLimit({fitSize:1.7}),1.5);assert.equal(fittedSize(10,{fitSize:1.7}),1.5);
 assert.equal(fittedSize(.1,{fitSize:10}),.5);assert.equal(fittedSize(20,{fitSize:20}),10);
 assert.equal(fittedSize(1.3,{fitSize:4}),1.5);assert.equal(fittedSize(1,{fitSize:null}),null);
});
test('toolbar mount rotation snaps only near cardinal angles and wraps safely',()=>{
 assert.equal(snappedMountRotation(0,40),40);assert.equal(snappedMountRotation(0,50),50);
 assert.equal(snappedMountRotation(90,90),-180);assert.equal(snappedMountRotation(0,-95),-90);
 assert.equal(snappedMountRotation(15,90),105);assert.equal(snappedMountRotation(0,81),90);assert.equal(snappedMountRotation(0,-9),0);assert.equal(snappedMountRotation(0,101),101);assert.equal(snappedMountRotation(0,33.25),33.25);
});

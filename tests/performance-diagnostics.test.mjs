import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../src/vendor/three.module.js';
import {configureDiagnostics,resetDiagnostics,diagnosticReport,diagnosticStart,diagnosticEnd,diagnosticFailure,diagnosticEvent,
  diagnosticAllocation,diagnosticGeometry,diagnosticTarget,diagnosticTypedBytes,diagnosticImage,diagnosticFrame,
  diagnosticDrawStart,diagnosticDrawEnd,diagnosticRender,diagnosticModel,diagnosticAwaitFirstFrame,diagnosticFirstFrame} from '../src/performance-diagnostics.js';

test('diagnostics stay inert by default and across session resets',()=>{
  assert.equal(diagnosticStart('import','xml'),undefined);
  assert.equal(diagnosticDrawStart({},'viewport'),undefined);
  assert.equal(diagnosticReport().enabled,false);
  configureDiagnostics(true);
  const operation=diagnosticStart('export','obj',10,{width:1200,regionId:'private',colors:'private',format:'obj'});
  const release=diagnosticAllocation('preparedExportGeometry',40,'export worker',operation);
  assert.deepEqual(diagnosticReport().events[0].options,{width:1200,format:'obj'});
  resetDiagnostics();
  release();
  diagnosticEnd(operation);
  assert.deepEqual(diagnosticReport().events,[]);
  assert.deepEqual(diagnosticReport().memory.trackedBytesByCategory,{});
  configureDiagnostics(false);
});

test('resource accounting deduplicates backing stores and tracks disposal, resizing and peaks',()=>{
  configureDiagnostics(true);
  const shared=new Float32Array(32),a=new THREE.BufferGeometry(),b=new THREE.BufferGeometry();
  a.setAttribute('position',new THREE.BufferAttribute(shared.subarray(0,12),3));
  b.setAttribute('position',new THREE.BufferAttribute(shared.subarray(12,24),3));
  a.setIndex(new THREE.BufferAttribute(new Uint16Array(6),1));
  diagnosticGeometry(a,'hull');diagnosticGeometry(a,'hull');diagnosticGeometry(b,'hull');
  assert.equal(diagnosticTypedBytes([{positions:shared},{positions:shared.subarray(4)}]),128);
  assert.equal(diagnosticReport().memory.trackedBytesByCategory.cpuGeometryAttributes,128);
  assert.equal(diagnosticReport().memory.trackedBytesByCategory.cpuGeometryIndices,12);
  a.dispose();assert.equal(diagnosticReport().memory.trackedBytesByCategory.cpuGeometryAttributes,128);
  b.dispose();assert.equal(diagnosticReport().memory.trackedBytesByCategory.cpuGeometryAttributes,0);
  const target=new THREE.WebGLRenderTarget(10,10,{samples:4});
  diagnosticTarget(target,'post');assert.equal(diagnosticReport().memory.trackedBytesByCategory.estimatedGpuTargets,4000);
  target.setSize(20,20);diagnosticTarget(target,'post');target.dispose();
  assert.equal(diagnosticReport().memory.trackedBytesByCategory.estimatedGpuTargets,0);
  assert.equal(diagnosticReport().memory.peakTrackedBytesByCategory.estimatedGpuTargets,16000);
  assert.equal(diagnosticReport().trackedResources,0);
  configureDiagnostics(false);
});

test('timeline is bounded across repeated operations and aggregates long animations',()=>{
  configureDiagnostics(true,{interval:1,lightweight:true});
  const animation=diagnosticStart('export','gif',270000);
  for(let i=0;i<3600;i++){
    diagnosticImage(animation,4096,4096,[{width:1024,height:1024}],32,2);
    diagnosticFrame(animation,8+i%3,1,i*10,1);
  }
  diagnosticEnd(animation);
  assert.equal(diagnosticReport().events.at(-1).frames,3600);
  assert.equal(diagnosticReport().events.at(-1).image.tiles,3600);
  for(let i=0;i<5000;i++){
    const op=diagnosticStart('import','xml',270000);
    diagnosticFailure(op,i%2?new DOMException('secret name','AbortError'):Error('secret path'));
  }
  diagnosticEvent('last');
  const data=JSON.parse(JSON.stringify(diagnosticReport()));
  assert.equal(data.configuration.intervalMs,100);
  assert.equal(data.events.length,256);
  assert.ok(data.droppedEvents>0);
  assert.equal(data.events.at(-1).type,'last');
  assert.equal(data.counts['import failed'],2500);
  assert.equal(data.counts['import cancelled'],2500);
  assert.equal(data.activeOperations.length,0);
  assert.equal(JSON.stringify(data).includes('secret'),false);
  assert.equal(data.memory.measuredHeap,null);
  assert.equal(data.memory.browserProcessBytes,null);
  configureDiagnostics(false);
});

test('each sampled viewport has independent pass totals even when renderer counters reset',()=>{
  configureDiagnostics(true);
  const scene=new THREE.Scene(),camera=new THREE.Camera();
  let calls=0;
  const renderer={
    info:{render:{},memory:{geometries:0,textures:0}},
    getRenderTarget:()=>null,
    render(){this.info.render={calls:++calls,triangles:3,lines:1,points:0};}
  };
  const first={},second={},op=diagnosticStart('import','xml',1);
  diagnosticAwaitFirstFrame(op,2);
  const model={revision:2,loaded:true,model:{blocks:[{}]}};
  diagnosticModel(model);diagnosticFirstFrame(model);diagnosticFirstFrame(model);
  for(const view of [first,second]){
    const sample=diagnosticDrawStart(view,'viewport');
    diagnosticRender(renderer,scene,camera,'scene',sample);
    diagnosticRender(renderer,scene,camera,'bloom',sample);
    diagnosticRender(renderer,scene,camera,'bloom',sample);
    diagnosticDrawEnd(sample,renderer,scene);
    assert.equal(diagnosticDrawStart(view,'viewport'),undefined);
  }
  const report=diagnosticReport(),views=Object.values(report.rendering);
  assert.equal(report.events.filter(event=>event.type==='first model frame submitted').length,1);
  assert.equal(report.events.at(-1).operation,op.id);
  assert.equal(views.length,2);
  assert.equal(views[0].contextId,views[1].contextId);
  assert.equal(views[0].passes.bloom.calls,5);
  assert.equal(views[1].passes.bloom.calls,11);
  configureDiagnostics(false);
});

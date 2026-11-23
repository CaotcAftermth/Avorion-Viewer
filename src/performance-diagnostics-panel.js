import {configureDiagnostics,diagnosticModel,diagnosticReport,resetDiagnostics} from './performance-diagnostics.js';

const categories={
  cpuGeometryAttributes:'CPU geometry attributes',cpuGeometryIndices:'CPU geometry indices',
  estimatedGpuGeometry:'Estimated GPU geometry',estimatedGpuTextures:'Estimated GPU textures',
  estimatedGpuTargets:'Estimated GPU render targets',geometryWorkerPayload:'Geometry worker transfer',
  exportWorkerPayload:'Export worker payload',preparedExportGeometry:'Prepared export geometry',
  retainedPreviewGeometry:'Retained preview payload',estimatedCanvas:'Estimated image backing stores',
  encodedExportOutput:'Encoded export output',estimatedSnapshot:'Estimated export snapshot payload',
};
const format=bytes=>bytes==null?'Unavailable':bytes<1024?bytes+' B':(bytes/1024**2).toFixed(2)+' MiB';
let dialog,timer;
export function openDiagnostics(scene,viewportCount){
  if(dialog?.open)return;
  if(!dialog){
    dialog=document.createElement('dialog');
    dialog.setAttribute('aria-labelledby','performance-diagnostics-title');
    dialog.style.cssText='width:min(720px,90vw);max-height:85vh;overflow:auto';
    dialog.innerHTML=`
      <form method="dialog"><button type="submit" style="float:right">Close</button></form>
      <h2 id="performance-diagnostics-title">Performance Diagnostics</h2>
      <p>Opt-in, local session measurements. Closing this panel keeps an enabled session running.</p>
      <p><label><input type="checkbox" data-enabled> Enable diagnostics</label>
      <label><input type="checkbox" data-light> Lightweight</label>
      <label><input type="checkbox" data-gpu> GPU timing</label>
      <label>Sampling interval (ms) <input type="number" data-interval min="100" max="60000" step="100" value="500"></label></p>
      <p><button type="button" data-reset>Reset session</button> <button type="button" data-download>Download JSON report</button></p>
      <p data-overview></p>
      <h3>Memory by category</h3><pre data-memory></pre>
      <h3>Sampled rendering</h3><pre data-render></pre>
      <h3>Recent timeline</h3><pre data-timeline></pre>
    `;
    document.body.append(dialog);
    dialog.addEventListener('close',()=>clearInterval(timer));
  }
  const query=key=>dialog.querySelector('[data-'+key+']');
  const enabled=query('enabled'),light=query('light'),gpu=query('gpu'),interval=query('interval'),download=query('download'),reset=query('reset');
  function report(){
    diagnosticModel(scene);
    return {...diagnosticReport(),activeViewports:viewportCount()};
  }
  function refresh(){
    const data=report(),active=data.activeOperations||[];
    download.disabled=reset.disabled=!data.enabled;
    query('overview').textContent=data.enabled?
      `${scene.model?.fileName||'No model'} · ${data.model.blocks.toLocaleString()} blocks · revision ${data.model.revision??' - '} · ${data.activeViewports} viewports · ${active.map(op=>op.kind+' '+op.format).join(', ')||'Idle'} · ${(data.elapsedMs/1000).toFixed(1)} s · ${Object.entries(data.counts).map(([key,value])=>key+' '+value).join(' · ')||'0 completed operations'}`:'Disabled';
    const memory=data.memory?.trackedBytesByCategory||{},peak=data.memory?.peakTrackedBytesByCategory||{};
    const wasm=data.events?.findLast(event=>event.wasmCapacityBytes!=null)?.wasmCapacityBytes;
    query('memory').textContent=data.enabled?[
      'JavaScript heap  '+format(data.memory.measuredHeap?.usedBytes),
      ...Object.entries(categories).map(([key,name])=>name+'  '+format(memory[key])+' (peak '+format(peak[key])+')'),
      'Wasm capacity (last observed)  '+format(wasm),'Browser-process memory  Unavailable',
    ].join('\n'):'';
    query('render').textContent=Object.entries(data.rendering||{}).map(([id,sample])=>id+'  '+sample.durationMs.toFixed(1)+' ms CPU\n'+
      Object.entries(sample.passes).map(([pass,s])=>'  '+pass+'  '+s.calls+' calls · '+s.triangles+' triangles · '+s.cpuMs.toFixed(2)+' ms').join('\n')).join('\n');
    if(data.configuration?.gpuTiming)query('render').textContent+='\nGPU timing: '+(data.configuration.lightweight?'Paused in lightweight mode':
      Object.values(data.rendering).some(sample=>sample.gpuTimingSupported)?'Supported; results in JSON report':'Waiting for a supported render context');
    query('timeline').textContent=(data.events||[]).slice(-16).map(event=>event.ms.toFixed(1)+' ms  '+event.type+(event.durationMs==null?'':' · '+event.durationMs.toFixed(1)+' ms')).join('\n');
  }
  enabled.onchange=light.onchange=gpu.onchange=interval.onchange=()=>{
    configureDiagnostics(enabled.checked,{lightweight:light.checked,gpuTiming:gpu.checked,interval:interval.valueAsNumber});refresh();
  };
  reset.onclick=()=>{resetDiagnostics();refresh();};
  download.onclick=()=>{
    const url=URL.createObjectURL(new Blob([JSON.stringify(report(),null,2)],{type:'application/json'}));
    const link=document.createElement('a');link.href=url;link.download='avorion-performance-diagnostics.json';link.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  refresh();dialog.showModal();timer=setInterval(refresh,1000);
}

import {configureDiagnostics,diagnosticModel,diagnosticReport} from './performance-diagnostics.js';

let stoppedReport=null;
const mib=bytes=>((bytes||0)/1024**2).toFixed(1)+' MiB';
export function mountInfoPerformance(body,scene,redraw){
  body.style.cssText='overflow:auto;padding:10px;font-size:12px';
  body.innerHTML=`<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
    <button data-capture></button><label><input type="checkbox" data-gpu> GPU timing</label>
    <button data-download>Download Report</button></div>
    <p data-status></p><p data-memory></p>
    <p>Sampled CPU render time · dashed line: 16.7 ms (60 FPS budget)</p>
    <svg data-chart viewBox="0 0 600 100" style="width:100%;height:100px;background:#202124" role="img" aria-label="Sampled CPU render time history"></svg>
    <div data-views></div><p class="muted">FPS uses sampled frame intervals. Idle viewports do not render continuously. GPU and memory measurements depend on browser support; graphics memory is estimated.</p>`;
  const query=k=>body.querySelector('[data-'+k+']');
  const history=new Map(),rows=new Map();
  let lastState=undefined;
  function report(){diagnosticModel(scene);const data=diagnosticReport();return data.enabled?data:stoppedReport;}
  function refresh(){
    const current=diagnosticReport(),active=current.enabled;
    if(active)diagnosticModel(scene);
    const data=active?current:stoppedReport;
    if(!active&&lastState===data)return;
    lastState=data;
    query('capture').textContent=active?'Stop Capture':'Start Capture';
    query('gpu').checked=active?!!data.configuration.gpuTiming:query('gpu').checked;
    query('download').disabled=!data;
    query('status').textContent=active?'Capturing · '+(data.elapsedMs/1000).toFixed(1)+' s':data?'Capture stopped · report retained':'Capture is off. Start capture, then orbit or zoom the model.';
    const memory=data?.memory?.trackedBytesByCategory||{};
    query('memory').textContent=data?'Estimated GPU geometry: '+mib(memory.estimatedGpuGeometry)+' · textures: '+mib(memory.estimatedGpuTextures)+' · render targets: '+mib(memory.estimatedGpuTargets):'';

    const series=[];
    for(const [id,sample] of Object.entries(data?.rendering||{})){
      let h=history.get(id);if(!h){h=[];history.set(id,h);}
      if(h.at(-1)?.at!==sample.atMs){h.push({at:sample.atMs,ms:sample.durationMs});if(h.length>120)h.shift();}
      series.push(h);
      const idle=active&&data.elapsedMs-sample.atMs>1000;
      const passes=Object.entries(sample.passes||{}),gpu=data.gpuPasses?.[id]||{};
      const calls=passes.reduce((n,[,p])=>n+p.calls,0),triangles=passes.reduce((n,[,p])=>n+p.triangles,0);
      let row=rows.get(id);
      if(!row){
        const section=document.createElement('section'),title=document.createElement('h3'),summary=document.createElement('p'),details=document.createElement('details'),label=document.createElement('summary'),pre=document.createElement('pre');
        label.textContent='Render passes';details.append(label,pre);section.append(title,summary,details);query('views').append(section);
        row={section,title,summary,pre};rows.set(id,row);
      }
      const {title,summary,pre}=row;
      title.textContent=id+' · '+(idle?'Idle':sample.frameIntervalMs>0?(1000/sample.frameIntervalMs).toFixed(1)+' sampled FPS':'FPS unavailable');
      summary.textContent='CPU render: '+sample.durationMs.toFixed(2)+' ms · '+calls.toLocaleString()+' draw calls · '+triangles.toLocaleString()+' triangles';
      pre.textContent=passes.map(([name,p])=>name+': '+p.cpuMs.toFixed(2)+' ms CPU · '+(gpu[name]?.lastMs==null?'GPU unavailable':gpu[name].lastMs.toFixed(2)+' ms GPU')+' · '+p.calls+' calls · '+p.triangles+' triangles').join('\n');

    }
    const max=Math.max(33.4,...series.flatMap(h=>h.map(p=>p.ms))),y=ms=>100-ms/max*95;
    query('chart').innerHTML=`<path d="M0 ${y(16.7)} H600" stroke="#aaa" stroke-dasharray="4 4"/>`+series.map((h,i)=>`<polyline fill="none" stroke="${['#82b5e4','#e9a15b','#90c890'][i%3]}" points="${h.map((p,n)=>`${n*600/119},${y(p.ms)}`).join(' ')}"/>`).join('');
  }
  query('capture').onclick=()=>{
    if(diagnosticReport().enabled){stoppedReport=report();configureDiagnostics(false);}
    else{stoppedReport=null;history.clear();rows.clear();query('views').replaceChildren();configureDiagnostics(true,{gpuTiming:query('gpu').checked,interval:500});redraw();}
    refresh();
  };
  query('gpu').onchange=()=>{const data=diagnosticReport();if(data.enabled)configureDiagnostics(true,{gpuTiming:query('gpu').checked,lightweight:data.configuration.lightweight,interval:data.configuration.intervalMs});refresh();};
  query('download').onclick=()=>{
    const data=report();if(!data)return;
    const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
    const link=document.createElement('a');link.href=url;link.download='avorion-performance-diagnostics.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  refresh();const timer=setInterval(refresh,1000);
  return {dispose(){clearInterval(timer);}};
}

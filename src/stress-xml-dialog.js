import {fixtureOptions,planFixture,presets,readHullStream,serializeFixture} from './stress-xml.js';

const labels={smoke:'Smoke',small:'Small',medium:'Medium','station-xl':'Station XL','station-xxl':'Station XXL',megastructure:'Megastructure',extreme:'Extreme'};
const format=n=>n.toLocaleString();
const downloadLimit=128*1024**2;
function download(blob,name){
  const url=URL.createObjectURL(blob),link=document.createElement('a');
  link.href=url;link.download=name;document.body.append(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),30000);
}
const pause=()=>new Promise(resolve=>setTimeout(resolve,0));

export function openStressXmlDialog(){
  const dialog=document.createElement('dialog');
  dialog.setAttribute('aria-labelledby','stress-xml-heading');
  dialog.innerHTML=`
    <h1 id="stress-xml-heading">Generate Stress Test XML</h1>
    <form>
      <label class="check-row">Profile <select name="profile">
        <option value="canonical">Canonical Mixed</option>
        <option value="canonical-uniform">Canonical Uniform</option>
        <option value="adversarial">Adversarial</option>
        <option value="station-replica">Station Replica</option>
      </select></label>
      <label class="check-row">Size <select name="preset">
        ${Object.entries(presets).map(([id,count])=>`<option value="${id}">${labels[id]} · ${format(count)} blocks</option>`).join('')}
        <option value="">Custom</option>
      </select></label>
      <label class="check-row" hidden>Block count <input name="blocks" type="number" min="1" max="5000000" step="1" value="1000" required></label>
      <label class="check-row">Seed <input name="seed" type="number" min="0" max="4294967295" step="1" value="42" required></label>
      <label class="check-row" hidden>Unsupported blocks (%) <input name="unsupported" type="number" min="0" max="100" value="15" required></label>
      <label class="check-row" hidden>Source station XML <input name="source" type="file" accept=".xml,application/xml,text/xml"></label>
      <p class="dialog-note">Saves an XML fixture for import. Large fixtures can take substantial memory to open.</p>
      <p role="status" aria-live="polite"></p>
      <div class="dialog-actions">
        <button type="button" data-close>Close</button>
        <button type="button" data-manifest hidden>Download Manifest</button>
        <button class="primary" type="submit">Generate XML</button>
      </div>
    </form>`;
  const form=dialog.querySelector('form'),field=name=>form.elements.namedItem(name);
  const profile=field('profile'),preset=field('preset'),blocks=field('blocks'),source=field('source'),unsupported=field('unsupported');
  const status=dialog.querySelector('[role=status]'),submit=form.querySelector('[type=submit]');
  const close=form.querySelector('[data-close]'),manifestButton=form.querySelector('[data-manifest]');
  let controller,manifest,name;
  function sync(){
    for(const [input,show] of [[blocks,!preset.value],[source,profile.value==='station-replica'],[unsupported,profile.value==='adversarial']]){
      input.closest('label').hidden=!show;input.disabled=!show||!!controller;
    }
    source.required=!source.disabled;
  }
  profile.onchange=preset.onchange=sync;
  close.onclick=()=>{if(controller)controller.abort();else dialog.close();};
  dialog.oncancel=event=>{if(controller){event.preventDefault();controller.abort();}};
  dialog.onclose=()=>dialog.remove();
  manifestButton.onclick=()=>download(new Blob([JSON.stringify(manifest,null,2)+'\n'],{type:'application/json'}),name+'.manifest.json');
  form.onsubmit=async event=>{
    event.preventDefault();
    if(controller)return;
    const inputFile=source.disabled?undefined:source.files[0];
    const count=preset.value?presets[preset.value]:Number(blocks.value);
    const started=performance.now();
    name=profile.value+'-'+count+'.xml';
    const values={profile:profile.value,blocks:count,seed:field('seed').value,source:inputFile?.name,output:name,
      ...(unsupported.disabled?{}:{'unsupported-percent':unsupported.value})};
    const config=fixtureOptions(values);
    const direct=typeof window.showSaveFilePicker==='function';
    if(!direct&&count*(inputFile?400:260)>downloadLimit){
      status.textContent='This fixture needs direct file saving. Open the viewer in Chrome or Edge on localhost or HTTPS, or choose fewer blocks.';
      return;
    }
    controller=new AbortController();
    const {signal}=controller;
    manifestButton.hidden=true;submit.disabled=true;close.textContent='Cancel';
    for(const input of form.querySelectorAll('input,select'))input.disabled=true;
    status.textContent='Preparing fixture…';
    let writer,reader,abortRead;
    try{
      if(direct){
        const handle=await window.showSaveFilePicker({suggestedName:name,types:[{description:'Avorion XML',accept:{'application/xml':['.xml']}}]});
        name=handle.name;
        signal.throwIfAborted();
        writer=await handle.createWritable();
      }
      if(inputFile){
        reader=inputFile.stream().getReader();
        abortRead=()=>{void reader.cancel().catch(()=>{});};
        signal.addEventListener('abort',abortRead,{once:true});
      }
      async function* sourceChunks(){
        while(true){
          signal.throwIfAborted();
          const {done,value}=await reader.read();
          if(done)break;
          yield value;
        }
      }
      const plan=await planFixture(config,reader&&readHullStream(sourceChunks()),()=>({name:inputFile.name}));
      const fixture=serializeFixture(config,plan,{signal,progress:n=>{status.textContent='Generated '+format(n)+' / '+format(count)+' blocks';}});
      const parts=[],encoder=new TextEncoder();
      let xmlBytes=0,chunks=0;
      for await(const text of fixture.chunks()){
        signal.throwIfAborted();
        const bytes=encoder.encode(text);xmlBytes+=bytes.length;
        if(writer)await writer.write(bytes);
        else{
          if(xmlBytes>downloadLimit)throw Error('Browser download limit reached. Use direct file saving or a smaller fixture.');
          parts.push(bytes);
        }
        if(++chunks%8===0)await pause();
      }
      signal.throwIfAborted();
      let file;
      if(writer){await writer.close();writer=undefined;}
      else{file=new Blob(parts,{type:'application/xml'});download(file,name);}
      const evidence={xmlBytes,generationMs:Math.round(performance.now()-started)};
      if(file&&crypto.subtle){
        const hash=await crypto.subtle.digest('SHA-256',await file.arrayBuffer());
        evidence.sha256=Array.from(new Uint8Array(hash),n=>n.toString(16).padStart(2,'0')).join('');
      }
      manifest=fixture.manifest(name.replace(/\.xml$/i,''),evidence);
      manifestButton.hidden=false;
      status.textContent='Saved '+format(count)+' blocks · '+(xmlBytes/1024**2).toFixed(2)+' MiB';
    }catch(error){
      if(writer)await writer.abort().catch(()=>{});
      status.textContent=signal.aborted||error.name==='AbortError'?'Generation canceled.':error.message;
    }finally{
      if(reader){signal.removeEventListener('abort',abortRead);await reader.cancel().catch(()=>{});reader.releaseLock();}
      controller=undefined;submit.disabled=false;close.textContent='Close';
      for(const input of form.querySelectorAll('input,select'))input.disabled=false;
      sync();
    }
  };
  sync();document.body.append(dialog);dialog.showModal();
}

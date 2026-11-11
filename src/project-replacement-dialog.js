const element=(tag,text)=>Object.assign(document.createElement(tag),{textContent:text??''});

export function confirmReplacement(fileName,preview){
  const dialog=element('dialog');
  dialog.setAttribute('aria-label','Replace Source XML');
  const title=element('h2','Replace Source XML');
  const summary=element('p',`${fileName} · ${preview.map.size} matched · ${preview.beforeCount-preview.map.size} old blocks unmatched · ${preview.model.blocks.length-preview.map.size} incoming blocks unmatched`);
  const scale=preview.fit.scale.map(value=>Number(value.toPrecision(5))).join(' × ');
  const details=element('p',`Detected scale (X, Y, Z): ${scale}. ${preview.paint.length} paint changes can transfer. ${preview.regions.length} regions and ${preview.mounts.mounts.length} mounts can transfer.`);
  const notes=element('ul');
  const note=text=>notes.append(element('li',text));
  if(preview.ambiguous)note('Ambiguous block matches were skipped.');
  if(preview.missingPaint)note(`${preview.missingPaint} painted blocks could not be matched.`);
  if(preview.missingOpacity)note(`${preview.missingOpacity} block opacity overrides could not be matched.`);
  for(const {name,lost,empty} of preview.regionLosses)note(`${name}: ${lost} members unmatched${empty?' (region would be removed)':''}.`);
  for(const name of preview.mounts.missing)note(`${name}: socket could not be matched; mount would be removed.`);
  for(const name of preview.mounts.clearance)note(`${name}: saved size may no longer fit the socket.`);
  if(preview.components){
    const {setup,missingSockets,missingMounts}=preview.components;
    note(`${setup.sockets.length} custom component sockets and ${setup.mounts.length} component mounts can transfer.`);
    for(const name of missingSockets)note(`${name}: component socket could not be matched.`);
    for(const name of missingMounts)note(`${name}: component mount could not be matched.`);
  }
  dialog.append(title,summary,details);
  if(notes.childElementCount)dialog.append(notes);

  let defaultChoice,choices=new Map();
  if(preview.conflicts.length){
    const heading=element('h3',`${preview.conflicts.length} paint conflicts`);
    const label=element('label','Default for paint conflicts ');
    defaultChoice=element('select');
    for(const [value,text] of [['incoming','Use incoming XML'],['project','Keep project paint']])defaultChoice.add(new Option(text,value));
    label.append(defaultChoice);
    const list=element('div'),pager=element('div');
    const previous=element('button','Previous'),next=element('button','Next'),range=element('span');
    pager.className='dialog-actions';
    pager.append(previous,range,next);
    let page=0;
    const pageSize=25;
    const show=()=>{
      list.replaceChildren();
      const start=page*pageSize,end=Math.min(start+pageSize,preview.conflicts.length);
      for(const conflict of preview.conflicts.slice(start,end)){
        const row=element('label',`${conflict.id} · ${conflict.channel==='color'?'Primary':'Secondary'} · project ${conflict.saved??'absent'} / incoming ${conflict.current??'absent'} `);
        row.className='check-row';
        const select=element('select');
        for(const [value,text] of [['default','Use default'],['incoming','Use incoming XML'],['project','Keep project paint']])select.add(new Option(text,value));
        select.value=choices.get(conflict)||'default';
        select.onchange=()=>choices.set(conflict,select.value);
        row.append(select);
        list.append(row);
      }
      range.textContent=`${start+1}–${end} of ${preview.conflicts.length}`;
      previous.disabled=page===0;
      next.disabled=end===preview.conflicts.length;
    };
    previous.onclick=()=>{page--;show();};
    next.onclick=()=>{page++;show();};
    show();
    dialog.append(heading,label,list);
    if(preview.conflicts.length>pageSize)dialog.append(pager);
  }

  const actions=element('div');
  actions.className='dialog-actions';
  const cancel=element('button','Cancel'),replace=element('button','Replace Source');
  replace.className='primary';
  cancel.onclick=()=>dialog.close();
  replace.onclick=()=>dialog.close('replace');
  actions.append(cancel,replace);
  dialog.append(actions);
  document.body.append(dialog);
  return new Promise(resolve=>{
    dialog.onclose=()=>{
      const answer=dialog.returnValue==='replace'?(conflict=>{
        const choice=choices.get(conflict);
        return (choice&&choice!=='default'?choice:defaultChoice?.value)==='project';
      }):null;
      dialog.remove();
      resolve(answer);
    };
    dialog.showModal();
    cancel.focus();
  });
}

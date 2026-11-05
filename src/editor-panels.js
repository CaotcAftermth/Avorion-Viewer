// Shared tab keyboard navigation and persistent, independently collapsible panels.
let nextId=0;
export function wireTabs(nav,content){
  const tabs=[...nav.querySelectorAll('button')],id=content.id||`editor-panel-${++nextId}`;
  content.id=id;content.setAttribute('role','tabpanel');
  nav.setAttribute('role','tablist');nav.setAttribute('aria-orientation','vertical');
  tabs.forEach((tab,index)=>{
    const selected=tab.classList.contains('active');tab.id=`${id}-tab-${index}`;
    tab.setAttribute('role','tab');tab.setAttribute('aria-selected',String(selected));tab.removeAttribute('aria-pressed');
    tab.setAttribute('aria-controls',id);tab.tabIndex=selected?0:-1;
    if(selected)content.setAttribute('aria-labelledby',tab.id);
    tab.onkeydown=event=>{
      const offset=event.key==='ArrowDown'?1:event.key==='ArrowUp'?-1:0;
      if(!offset&&!['Home','End'].includes(event.key))return;
      event.preventDefault();event.stopPropagation();
      tabs[event.key==='Home'?0:event.key==='End'?tabs.length-1:(index+offset+tabs.length)%tabs.length].click();
      nav.querySelector('[aria-selected="true"]')?.focus();
    };
  });
  if(!tabs.some(tab=>tab.classList.contains('active'))){content.removeAttribute('aria-labelledby');content.setAttribute('aria-label','Search results');tabs[0].tabIndex=0;}
}
export function wirePanels(content,state,prefix='',searching=false){
  state.panelOpen??={};
  const panels=[...content.querySelectorAll('details.panel,details.preferences-panel')];
  for(const panel of panels){
    const summary=panel.querySelector('summary'),key=prefix+summary.textContent;
    if(!searching&&key in state.panelOpen)panel.open=state.panelOpen[key];
    panel.addEventListener('toggle',()=>{if(!searching)state.panelOpen[key]=panel.open;});
    summary.addEventListener('click',event=>{
      if(!event.ctrlKey&&!event.metaKey)return;
      event.preventDefault();
      for(const other of panels){other.open=other===panel||other.contains(panel);if(!searching)state.panelOpen[prefix+other.querySelector('summary').textContent]=other.open;}
    });
  }
}

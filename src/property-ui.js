// Small DOM primitives shared by the existing Properties renderers.
export function propertyPanel(host,title,open=false){
 const panel=document.createElement('details');panel.className='panel';panel.open=open;
 const summary=document.createElement('summary');summary.textContent=title;panel.append(summary);host.append(panel);return panel;
}
export function propertyNote(host,text){const p=document.createElement('p');p.className='panel-note';p.textContent=text;host.append(p);return p;}
export function propertyAction(host,label,action,disabled=false){const b=document.createElement('button');b.type='button';b.className='setting-button';b.textContent=label;b.disabled=disabled;b.onclick=action;host.append(b);return b;}
// Move existing controls with their listeners; never recreate domain handlers.
export function regroupProperties(source,host,groups){
 const nodes=[...source.children].filter(n=>n.tagName!=='SUMMARY');
 const panels=new Map(groups.map(([title,open])=>[title,propertyPanel(host,title,open)]));
 for(const node of nodes){const label=node.getAttribute('aria-label')||node.querySelector?.('[aria-label]')?.getAttribute('aria-label')||node.textContent.trim();
  const group=groups.find(([, ,match])=>match(label,node))||groups.at(-1);panels.get(group[0]).append(node);
 }
 source.remove();return panels;
}

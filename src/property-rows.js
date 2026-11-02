// Blender-style Properties rows: right-aligned label column, control column, checkbox text after the box.
// Panels build rows in several shapes (span + control, bare text + control, checkbox before or after text),
// so rows are normalized after they are added rather than in every panel module.
const isControl=n=>n.nodeType===1&&n.tagName!=='MARK'&&!(n.tagName==='SPAN'&&!n.querySelector('input,select,textarea,button,output'));

function layoutRow(row){
  if(row.dataset.layout){
    // Late additions to an already normalized row belong in the control cell.
    const control=row.querySelector(':scope>.property-control');
    for(const n of [...row.childNodes])if(n!==control&&!n.classList?.contains('property-label'))control.append(n);
    return;
  }
  let text='';const controls=[];
  for(const n of [...row.childNodes]){
    if(n.nodeType===3)text+=n.textContent;
    else if(n.nodeType===1&&!isControl(n)&&!controls.length&&!text.trim())text+=n.textContent;
    else if(n.nodeType===1)controls.push(n);
  }
  text=text.trim();
  if(!controls.length)return;
  const label=document.createElement('span');label.className='property-label';
  const control=document.createElement('span');control.className='property-control';
  if(controls.length===1&&controls[0].matches('input[type=checkbox]')){
    row.classList.add('property-check');
    const caption=document.createElement('span');caption.className='property-check-text';caption.textContent=text||controls[0].getAttribute('aria-label')||'';
    control.append(controls[0],caption);
  }else{
    label.textContent=text;control.append(...controls);
  }
  row.replaceChildren(label,control);
  if(row.classList.contains('check-row'))row.classList.add('field-row');
  row.dataset.layout='columns';
}

export function layoutPropertyRows(root){
  const apply=()=>{for(const row of root.querySelectorAll('.field-row,.check-row'))layoutRow(row);};
  apply();
  new MutationObserver(apply).observe(root,{childList:true,subtree:true});
}

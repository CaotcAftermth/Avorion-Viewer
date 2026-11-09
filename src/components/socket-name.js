// Match library-card naming: double-click, double-tap, F2 or Enter to edit.
export function mountSocketName(host,socket,save,{editable=true,error=()=>{}}={}){
 const row=document.createElement('div');row.className='field-row';const caption=document.createElement('span');caption.textContent='Name';
 const name=document.createElement('span');name.className='socket-name-value';name.textContent=socket.name;name.tabIndex=editable?0:-1;name.setAttribute('aria-label','Socket name');name.title=editable?'Double-click or double-tap to rename; F2 or Enter also renames':'Generated socket';row.append(caption,name);host.append(row);
 let editing=false,lastTap=0;
 const rename=()=>{
  if(editing||!editable)return;editing=true;const input=document.createElement('input');input.value=socket.name;input.maxLength=100;input.setAttribute('aria-label','Rename socket');name.replaceWith(input);input.focus();input.select();let finished=false;
  const finish=async cancel=>{if(finished)return;finished=true;const value=input.value.trim();if(cancel||!value||value===socket.name){input.replaceWith(name);editing=false;name.focus();return;}
   input.disabled=true;try{await save(value);name.textContent=value;if(input.isConnected)input.replaceWith(name);editing=false;}catch(e){error(e.message);if(input.isConnected)input.replaceWith(name);editing=false;}
  };
  input.onkeydown=e=>{if(e.key==='Enter'||e.key==='Escape'){e.preventDefault();e.stopPropagation();finish(e.key==='Escape');}};input.onblur=()=>finish(false);
 };
 name.ondblclick=rename;name.onkeydown=e=>{if(e.key==='Enter'||e.key==='F2'){e.preventDefault();rename();}};
 name.onpointerup=e=>{if(e.pointerType==='touch'){const now=performance.now();if(lastTap&&now-lastTap<400)rename();lastTap=now;}};
}

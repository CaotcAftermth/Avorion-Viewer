// Screen-space hysteresis prevents nearby sockets from stealing a stable target.
export function choosePlacementTarget(sockets,x,y,currentId,{radius=24,releaseRadius=34,switchMargin=8}={}){
 const distance=s=>Math.hypot(s.screen[0]-x,s.screen[1]-y);
 const eligible=sockets.filter(s=>s.exposed!==false&&!s.invalid),nearest=eligible.filter(s=>distance(s)<=radius).sort((a,b)=>distance(a)-distance(b))[0];
 const current=eligible.find(s=>s.id===currentId);
 if(current&&distance(current)<=releaseRadius&&(!nearest||distance(nearest)+switchMargin>=distance(current)))return current;
 return nearest||null;
}
export function createPlacementStrip(host,{preview,commit,cancelled}){
 const strip=document.createElement('div');strip.className='attachment-placement-strip';strip.setAttribute('role','group');strip.setAttribute('aria-label','Attachment placement');
 Object.assign(strip.style,{position:'absolute',bottom:'32px',left:'50%',transform:'translateX(-50%)',zIndex:8,display:'none',background:'#262626',padding:'8px',border:'1px solid #777',borderRadius:'5px',maxWidth:'95%'});
 const status=document.createElement('span');status.setAttribute('role','status');strip.append(status);let state=null,busy=false;
 const number=(label,step,update)=>{const wrapper=document.createElement('label');wrapper.textContent=label+' ';const input=document.createElement('input');input.type='number';input.step=step;input.style.width='70px';input.setAttribute('aria-label',label);wrapper.append(input);strip.append(wrapper);input.oninput=()=>{if(!state||!input.value||!Number.isFinite(input.valueAsNumber))return;update(input.valueAsNumber);preview(state);};return input;};
 const size=number('Size / scale',.5,value=>state.size=value),twist=number('Mount rotation',15,value=>state.twist=value);
 const snap=document.createElement('label');snap.textContent='Snap ';const check=document.createElement('input');check.type='checkbox';check.checked=true;check.setAttribute('aria-label','Snap placement rotation');snap.append(check);strip.append(snap);
 twist.onchange=()=>{if(state&&check.checked){state.twist=Math.round(state.twist/15)*15;twist.value=state.twist;preview(state);}};
 const button=(label,action)=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=action;strip.append(b);return b;};
 const confirm=button('Place',()=>accept());button('Cancel',()=>cancel());host.append(strip);
 function update(){if(!state)return;status.textContent=state.socket?(state.occupied?'Replace occupied socket · ':'')+state.asset.name+' · '+state.socket.name+' ':state.asset.name+' · Choose a socket ';confirm.textContent=state.occupied?'Replace':'Place';confirm.disabled=busy||!state.socket;size.step=state.kind==='turret'?.5:.05;size.value=state.size??1;twist.value=state.twist??0;}
 async function accept(){if(!state?.socket||busy)return;busy=true;update();try{await commit(state);busy=false;cancel(false);}catch(error){status.textContent=error.message;}finally{busy=false;if(state)update();}}
 function cancel(notify=true){if(busy)return false;state=null;strip.style.display='none';if(notify)cancelled();return true;}
 return {start(value){state={twist:0,...value};strip.style.display='flex';update();preview(state);},target(socket,occupied=false){if(!state||busy)return;state.socket=socket;state.occupied=occupied;update();preview(state);},accept,cancel,get state(){return state;},dispose(){state=null;strip.remove();}};
}

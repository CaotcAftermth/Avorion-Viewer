// Full-resolution modal viewer. Native dialog supplies focus containment and Escape handling.
const viewer=document.createElement('dialog');viewer.className='manual-image-viewer';viewer.setAttribute('aria-labelledby','image-viewer-title');
viewer.innerHTML='<div class="image-viewer-inner"><header><h2 id="image-viewer-title">Image</h2><button type="button" data-fit>Expand image</button><button type="button" data-close autofocus aria-label="Close image">×</button></header><div class="image-viewer-scroll" tabindex="0" aria-label="Full-resolution image"><div class="image-viewer-stage"><img alt=""></div></div><p class="image-viewer-caption"></p></div>';
document.body.append(viewer);let trigger;
const image=viewer.querySelector('img'),caption=viewer.querySelector('.image-viewer-caption'),stage=viewer.querySelector('.image-viewer-stage'),fit=viewer.querySelector('[data-fit]');
function addHighlight(container,annotation){
 const box=document.createElement('span');box.className='image-focus';box.setAttribute('aria-hidden','true');container.append(box);
 const target=container.querySelector('img');const update=()=>{const frame=target.getBoundingClientRect(),parent=container.getBoundingClientRect();const [x,y,w,h]=annotation.rect;Object.assign(box.style,{left:(frame.left-parent.left+x*frame.width)+'px',top:(frame.top-parent.top+y*frame.height)+'px',width:(w*frame.width)+'px',height:(h*frame.height)+'px'});};
 const observer=new ResizeObserver(update);observer.observe(target);target.addEventListener('load',update);update();
 return ()=>{observer.disconnect();target.removeEventListener('load',update);box.remove();};
}
let removeModalHighlight;
function sizeModalImage(){
 if(!viewer.open||!image.naturalWidth||!image.naturalHeight)return;
 const scroll=viewer.querySelector('.image-viewer-scroll'),density=Math.max(1,devicePixelRatio||1),limit=(image.classList.contains('manual-bar-image')?1226:800)/density;
 const expanded=viewer.classList.contains('full-size');
 const scale=Math.min(1/density,limit/image.naturalWidth,(800/density)/image.naturalHeight,Math.max(1,Math.min(innerWidth*.96,1500)-32)/image.naturalWidth,expanded?Infinity:innerHeight*.68/image.naturalHeight);
 stage.style.width=image.naturalWidth*scale+'px';stage.style.height=image.naturalHeight*scale+'px';viewer.style.width=Math.min(innerWidth*.96,Math.max(360,image.naturalWidth*scale+32))+'px';
}
viewer.querySelector('[data-close]').onclick=()=>viewer.close();viewer.addEventListener('click',event=>{if(event.target===viewer)viewer.close();});
image.onload=sizeModalImage;window.addEventListener('resize',sizeModalImage);
fit.onclick=()=>{const full=viewer.classList.toggle('full-size');fit.textContent=full?'Fit image':'Expand image';sizeModalImage();};
viewer.addEventListener('close',()=>{image.removeAttribute('src');removeModalHighlight?.();removeModalHighlight=null;trigger?.focus();});
let annotations={};const base=new URL('./',document.currentScript.src);
const ready=fetch(new URL('image-annotations.json',base)).then(r=>r.ok?r.json():{}).then(value=>annotations=value).catch(()=>{});
document.querySelectorAll('article figure img, article .inline-control-image img').forEach(thumbnail=>{
 let link=thumbnail.closest('a');if(!link){link=document.createElement('a');link.href=thumbnail.currentSrc||thumbnail.src;thumbnail.replaceWith(link);link.append(thumbnail);}link.classList.add('image-open');link.title='Open image';
 const figure=thumbnail.closest('figure')||thumbnail.closest('td')||thumbnail.parentElement,focusKey=[...figure.classList,...thumbnail.classList].find(c=>c.startsWith('focus-'))?.slice(6);
 ready.then(()=>{if(!focusKey||!annotations[focusKey])return;const holder=document.createElement('span');holder.className='annotated-image';link.replaceWith(holder);holder.append(link);addHighlight(holder,annotations[focusKey]);});
 link.addEventListener('click',async event=>{if(event.button||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;event.preventDefault();await ready;trigger=link;viewer.classList.remove('full-size');fit.textContent='Expand image';const annotation=annotations[focusKey];image.style.removeProperty('--image-pixel-width');image.classList.toggle('manual-bar-image',thumbnail.classList.contains('manual-bar-image'));image.src=link.href;image.alt=thumbnail.alt;caption.textContent=(annotation?'Highlighted: '+annotation.label+'. ':'')+(figure.querySelector('figcaption')?.textContent?.replace(/¶/g,'').trim()||thumbnail.alt);removeModalHighlight?.();removeModalHighlight=null;viewer.showModal();sizeModalImage();if(annotation)removeModalHighlight=addHighlight(stage,annotation);});
});

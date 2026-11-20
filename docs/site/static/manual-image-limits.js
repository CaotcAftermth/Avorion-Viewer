// Keep large documentation images within 800 screen pixels, including zoom/display scaling.
let densityQuery;
function updateImageLimit(){
 document.documentElement.style.setProperty('--manual-bar-limit',(1226/Math.max(1,window.devicePixelRatio||1))+'px');
 document.documentElement.style.setProperty('--manual-image-limit',(800/Math.max(1,window.devicePixelRatio||1))+'px');
 densityQuery?.removeEventListener('change',updateImageLimit);
 densityQuery=matchMedia('(resolution: '+(window.devicePixelRatio||1)+'dppx)');
 densityQuery.addEventListener('change',updateImageLimit);
}
updateImageLimit();window.addEventListener('resize',updateImageLimit);

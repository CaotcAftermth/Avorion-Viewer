import {icon} from './icons.js';
import {APP_VERSION} from './version.js';

export function createWelcome({preferences,wireInputStyles,openModel,openProject,openTextures,feedback,openSettings=()=>{},trackpadFallback=false}) {
  const dialog=document.createElement('dialog');
  dialog.id='welcome-dialog';dialog.setAttribute('aria-labelledby','welcome-title');
  dialog.innerHTML=`
    <div class="welcome-scene" aria-hidden="true"><canvas class="welcome-nebula"></canvas><div class="welcome-orbit"></div><div class="welcome-planet"></div><div class="welcome-stars"></div></div>
    <div class="welcome-shell">
    <div class="dialog-heading"><button type="button" class="icon-button" aria-label="Close welcome">×</button></div>
    <section data-welcome-home>
      <div class="welcome-emblem" aria-hidden="true"></div>
      <div class="welcome-brand" data-no-translate>AVORION <span>VIEWER</span></div>
      <div class="welcome-release"><span data-version></span><span class="welcome-beta">Beta release</span></div>
      <h1 id="welcome-title">Welcome</h1>
      <p class="welcome-intro">A fast, lightweight 3D viewer for Avorion ship designs.</p>
      <ul class="welcome-features">
        <li>${icon('boxOutline')}<span>Inspect Ships</span></li>
        <li>${icon('brushOutline')}<span>Repaint &amp; Edit</span></li>
        <li>${icon('crosshair')}<span>Turrets &amp; Coverage</span></li>
        <li>${icon('exportModel')}<span>Export Models</span></li>
      </ul>
      <button type="button" class="primary welcome-enter" data-enter autofocus>${icon('folder')}<span>Open Viewer</span>${icon('chevron')}</button>
      <div class="welcome-load"><button type="button" data-open>Open Avorion XML…</button><button type="button" data-textures>Load texture folder…</button></div>
      <nav class="welcome-links" aria-label="Getting started">
        <button type="button" data-guide>${icon('bookOpen')}<span>Quick Start Guide</span></button>
        <button type="button" data-settings>${icon('settings')}<span>Settings</span></button>
      </nav>
      <details class="welcome-input"><summary>Input style</summary><div class="welcome-input-body">
        <div class="input-style-options">
          <button type="button" data-style="blender"><b>Blender</b><span>Mouse + numpad</span></button>
          <button type="button" data-style="laptop"><b>Laptop</b><span>Alt-drag + number row</span></button>
          <button type="button" data-style="trackpad"><b>Trackpad</b><span>Scroll, pinch + edge panels</span></button>
        </div>
        <p class="welcome-controls" aria-live="polite"></p>
        <p id="welcome-trackpad-note" class="welcome-note">Two-finger scroll pans; pinch zooms; Shift+scroll orbits. Tap an edge to show editors.</p>
        <p class="welcome-fallback" role="status" hidden>Trackpad controls were selected previously. Switched to Laptop while trackpad support is being fixed.</p>
      </div></details>
      <footer class="welcome-footer"><button type="button" data-feedback>Send feedback</button><span aria-hidden="true">·</span><a class="coffee-button" href="https://www.buymeacoffee.com/CaotcAftermth" target="_blank" rel="noopener noreferrer">Buy me a coffee <span aria-hidden="true">↗</span></a></footer>
    </section>

    <section data-welcome-guide hidden><button type="button" data-back>← Back to Welcome</button><h1 id="welcome-guide-title" tabindex="-1">Quick Start Guide</h1><article class="welcome-guide-content" data-no-translate></article></section></div>`;
  const logo=document.querySelector('#topbar .brand svg');
  if(logo)dialog.querySelector('.welcome-emblem').append(logo.cloneNode(true));
  document.body.append(dialog);
  let skyTask;
  const prepareSky=()=>{if(skyTask)return;skyTask=import('./welcomeSky.js').then(({paintWelcomeSky})=>paintWelcomeSky(dialog.querySelector('.welcome-nebula'),preferences.value,()=>dialog.open)).then(painted=>{if(painted)dialog.querySelector('.welcome-scene').classList.add('has-sky');else skyTask=null;}).catch(()=>{skyTask=null;});};
  const home=dialog.querySelector('[data-welcome-home]'),guide=dialog.querySelector('[data-welcome-guide]'),article=dialog.querySelector('article');
  dialog.querySelector('[data-version]').textContent=`v${APP_VERSION}`;
  dialog.querySelector('.welcome-fallback').hidden=!trackpadFallback;
  if(trackpadFallback)dialog.querySelector('.welcome-input').open=true;
  const sync=()=>{
    wireInputStyles(dialog);
    dialog.querySelector('.welcome-controls').textContent=preferences.value.inputStyle==='trackpad'?'Two-finger scroll pans · Pinch zooms':preferences.value.inputStyle==='laptop'?'Alt + left-drag rotates · Alt + Shift + left-drag pans · Wheel zooms':'Middle-drag rotates · Shift + middle-drag pans · Wheel zooms';
  };
  preferences.subscribe(sync);
  const showHome=()=>{home.hidden=false;guide.hidden=true;dialog.setAttribute('aria-labelledby','welcome-title');dialog.classList.remove('reading-guide');dialog.querySelector('.welcome-shell').scrollTop=0;};
  dialog.querySelector('.icon-button').onclick=()=>dialog.close();
  dialog.addEventListener('click',event=>{
    if(event.target.closest('.welcome-shell'))return;
    if(!guide.hidden){showHome();dialog.querySelector('[data-guide]').focus();}

  });
  const modelButton=dialog.querySelector('[data-open]');
  modelButton.onclick=openModel;
  const projectButton=modelButton.cloneNode();
  projectButton.removeAttribute('data-open');
  projectButton.classList.remove('primary');
  projectButton.textContent='Open Project…';
  projectButton.onclick=openProject;
  modelButton.after(projectButton);
  dialog.querySelector('[data-textures]').onclick=openTextures;
  dialog.querySelector('[data-feedback]').onclick=feedback;
  dialog.querySelector('[data-enter]').onclick=()=>dialog.close();
  dialog.querySelector('[data-settings]').onclick=openSettings;
  dialog.querySelector('[data-back]').onclick=()=>{showHome();dialog.querySelector('[data-guide]').focus();};
  let loaded=false;
  dialog.querySelector('[data-guide]').onclick=async()=>{
    home.hidden=true;guide.hidden=false;dialog.classList.add('reading-guide');dialog.setAttribute('aria-labelledby','welcome-guide-title');dialog.querySelector('.welcome-shell').scrollTop=0;
    dialog.querySelector('#welcome-guide-title').focus();
    if(loaded)return;
    article.textContent='Loading guide…';
    try {
      const response=await fetch(new URL('./getting-started.html',import.meta.url));
      if(!response.ok)throw new Error('Guide unavailable');
      // This is a bundled, authored HTML fragment, never imported ship or user content.
      article.innerHTML=await response.text();loaded=true;
    } catch { article.textContent='The guide could not be loaded. Go back and choose Read guide to retry.'; }
  };
  return {open(){showHome();sync();if(!dialog.open)dialog.showModal();requestAnimationFrame(()=>requestAnimationFrame(prepareSky));},close(){if(dialog.open)dialog.close();}};
}

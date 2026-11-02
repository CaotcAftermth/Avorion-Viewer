import {APP_VERSION} from './version.js';

export function createWelcome({preferences,wireInputStyles,openModel,openTextures,feedback,trackpadFallback=false}) {
  const dialog=document.createElement('dialog');
  dialog.id='welcome-dialog';dialog.setAttribute('aria-labelledby','welcome-title');
  dialog.innerHTML=`
    <div class="dialog-heading"><span class="eyebrow">AVORION VIEWER <span data-version></span></span><button type="button" class="icon-button" aria-label="Close welcome">×</button></div>
    <section data-welcome-home>
      <span class="welcome-beta">Beta release</span>
      <h1 id="welcome-title">A Project of Love for a Fantastic Community</h1>
      <p class="welcome-intro">Avorion Viewer is a lightweight 3D viewer that runs in your browser and is built for Avorion ship designs. From your game XML, you can inspect any block, browse the ship's structure in a Blender-style outliner, repaint it with the game's color palette, check turret sockets/coverage, and more!</p>
      <div class="welcome-load"><button type="button" class="primary" data-open>Open Avorion XML…</button><button type="button" data-textures>Load texture folder…</button></div>
      <p class="welcome-note">Drop a ship XML onto the viewport anytime. Textures are optional.</p>
      <section class="welcome-input" aria-labelledby="welcome-input-title">
        <h2 id="welcome-input-title">Input style</h2>
        <div class="input-style-options">
          <button type="button" data-style="blender"><b>Blender</b><span>Mouse + numpad</span></button>
          <button type="button" data-style="laptop"><b>Laptop</b><span>Alt-drag + number row</span></button>
          <button type="button" data-style="trackpad" disabled aria-describedby="welcome-trackpad-note"><b>Trackpad</b><span>Unavailable</span></button>
        </div>
        <p class="welcome-controls" aria-live="polite"></p>
        <p id="welcome-trackpad-note" class="welcome-note">Trackpad support is being fixed.</p>
        <p class="welcome-fallback" role="status" hidden>Trackpad controls were selected previously. Switched to Laptop while trackpad support is being fixed.</p>
      </section>
      <section class="welcome-guide-card"><div><h2>Quick Start Guide</h2><p>Modes, paint, turrets, and exports.</p></div><button type="button" data-guide>Read guide</button></section>
      <footer class="welcome-footer"><div><span>Found a bug or have an idea?</span><button type="button" data-feedback>Send feedback</button></div><div><span>Support development</span><a class="coffee-button" href="https://www.buymeacoffee.com/CaotcAftermth" target="_blank" rel="noopener noreferrer">Buy me a coffee <span aria-hidden="true">↗</span></a></div></footer>
    </section>
    <section data-welcome-guide hidden><button type="button" data-back>← Back to Welcome</button><h1 id="welcome-guide-title" tabindex="-1">Quick Start Guide</h1><article class="welcome-guide-content" data-no-translate></article></section>`;
  document.body.append(dialog);
  const home=dialog.querySelector('[data-welcome-home]'),guide=dialog.querySelector('[data-welcome-guide]'),article=dialog.querySelector('article');
  dialog.querySelector('[data-version]').textContent=`v${APP_VERSION}`;
  dialog.querySelector('.welcome-fallback').hidden=!trackpadFallback;
  const sync=()=>{
    wireInputStyles(dialog);
    dialog.querySelector('.welcome-controls').textContent=preferences.value.inputStyle==='laptop'?'Alt + left-drag rotates · Alt + Shift + left-drag pans · Wheel zooms':'Middle-drag rotates · Shift + middle-drag pans · Wheel zooms';
  };
  preferences.subscribe(sync);
  const showHome=()=>{home.hidden=false;guide.hidden=true;dialog.setAttribute('aria-labelledby','welcome-title');dialog.classList.remove('reading-guide');dialog.scrollTop=0;};
  dialog.querySelector('.icon-button').onclick=()=>dialog.close();
  dialog.querySelector('[data-open]').onclick=openModel;
  dialog.querySelector('[data-textures]').onclick=openTextures;
  dialog.querySelector('[data-feedback]').onclick=feedback;
  dialog.querySelector('[data-back]').onclick=()=>{showHome();dialog.querySelector('[data-guide]').focus();};
  let loaded=false;
  dialog.querySelector('[data-guide]').onclick=async()=>{
    home.hidden=true;guide.hidden=false;dialog.classList.add('reading-guide');dialog.setAttribute('aria-labelledby','welcome-guide-title');dialog.scrollTop=0;
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
  return {open(){showHome();sync();if(!dialog.open)dialog.showModal();},close(){if(dialog.open)dialog.close();}};
}

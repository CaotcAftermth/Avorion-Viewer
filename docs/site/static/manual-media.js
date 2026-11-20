document.querySelectorAll('figure[data-animation]').forEach(figure=>{
 const image=figure.querySelector('img'),button=figure.querySelector('button'),note=figure.querySelector('[role=status]');let playing=false;
 button.hidden=false;
 button.addEventListener('click',()=>{playing=!playing;image.src=playing?image.dataset.animation:image.dataset.poster;button.textContent=playing?'Stop animation':'Play animation';button.setAttribute('aria-pressed',String(playing));note.textContent=playing?'Animation playing.':'Static image shown.';});
 // Never autoplay, including for reduced-motion users. The caption remains available in either state.
});

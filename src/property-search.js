// Properties editor search: finds labels, panel titles and current values across every Properties tab,
// hides what does not match, highlights the hits and lets Enter step through them.

// Case- and accent-insensitive text, with a map back to the original character positions for highlighting.
export function foldText(text){
  let folded='';const map=[];const source=String(text??'');
  for(let i=0;i<source.length;i++){
    const part=source[i].normalize('NFKD').replace(/[̀-ͯ]/g,'').toLowerCase();
    for(let j=0;j<part.length;j++){folded+=part[j];map.push(i);}
  }
  map.push(source.length);
  return {folded,map};
}
export const fold=text=>foldText(text).folded;

// Whitespace separates terms; every term must be found. Quotes keep a phrase together ("primary color").
export function searchTerms(query){
  const terms=[],source=fold(query).slice(0,200);
  for(const match of source.matchAll(/"([^"]+)"|(\S+)/g)){const term=(match[1]??match[2]).trim();if(term&&!terms.includes(term))terms.push(term);}
  return terms.slice(0,12);
}
export const matchesAll=(text,terms)=>{const folded=fold(text);return terms.every(term=>folded.includes(term));};
export const matchesAny=(text,terms)=>{const folded=fold(text);return terms.some(term=>folded.includes(term));};

// Merged [start,end) ranges of every term occurrence in the original text.
export function matchRanges(text,terms){
  const {folded,map}=foldText(text),ranges=[];
  for(const term of terms){let at=folded.indexOf(term);while(at!==-1){ranges.push([map[at],map[at+term.length-1]+1]);at=folded.indexOf(term,at+term.length);}}
  ranges.sort((a,b)=>a[0]-b[0]);
  const merged=[];for(const range of ranges){const last=merged.at(-1);if(last&&range[0]<=last[1])last[1]=Math.max(last[1],range[1]);else merged.push([...range]);}
  return merged;
}

const ROW='.field-row,.check-row,.preference-row,.property-vector';
const PANEL='details.panel,details.preferences-panel';
// Context that only makes sense next to the full tab, not in a result list.
const CHROME='.property-breadcrumb,.property-datablock,.preferences-footer,.preferences-searchbar,.preferences-content>h2,.preferences-empty';
const VALUE='input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=button]),select,textarea,output';

// Visible text without the unselected options of a <select>.
function visibleText(el){
  let text='';const walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT,{acceptNode:node=>node.parentElement?.closest('select,option,textarea,script,style')?NodeFilter.FILTER_REJECT:NodeFilter.FILTER_ACCEPT});
  while(walker.nextNode())text+=walker.currentNode.textContent+' ';
  return text;
}
function controlValue(control){
  if(control.tagName==='SELECT')return control.selectedOptions[0]?.textContent||'';
  if(control.tagName==='OUTPUT')return '';
  return control.value||'';
}
// Everything a unit can be found by: its label, current values and accessible names.
// Tooltip descriptions are left out so results only show rows whose visible text or value matches.
function unitText(el){
  const parts=[visibleText(el)];
  for(const node of [el,...el.querySelectorAll('*')]){
    if(node.matches(VALUE))parts.push(controlValue(node));
    if(node.hasAttribute('aria-label'))parts.push(node.getAttribute('aria-label'));
  }
  return parts.join(' ');
}

function highlightText(el,terms){
  const walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT,{acceptNode:node=>node.parentElement?.closest('select,option,textarea,script,style,mark')||!node.textContent.trim()?NodeFilter.FILTER_REJECT:NodeFilter.FILTER_ACCEPT});
  const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
  let hits=0;
  for(const node of nodes){
    const ranges=matchRanges(node.textContent,terms);if(!ranges.length)continue;
    const fragment=document.createDocumentFragment();let at=0;
    for(const [start,end] of ranges){
      if(start>at)fragment.append(node.textContent.slice(at,start));
      const mark=document.createElement('mark');mark.className='property-search-hit';mark.textContent=node.textContent.slice(start,end);fragment.append(mark);at=end;hits++;
    }
    if(at<node.textContent.length)fragment.append(node.textContent.slice(at));
    node.replaceWith(fragment);
  }
  for(const control of el.querySelectorAll(VALUE)){const hit=matchesAny(controlValue(control),terms);control.classList.toggle('property-search-value',hit);if(hit)hits++;}
  return hits;
}

export function clearPropertySearch(root){
  for(const mark of root.querySelectorAll('mark.property-search-hit')){const parent=mark.parentNode;mark.replaceWith(mark.textContent);parent.normalize();}
  for(const el of root.querySelectorAll('.property-search-value,.property-search-match,.property-search-current'))el.classList.remove('property-search-value','property-search-match','property-search-current');
  for(const el of root.querySelectorAll('[data-search-hidden]')){el.hidden=false;delete el.dataset.searchHidden;}
}

const hide=(el,hidden)=>{if(hidden){if(!el.hidden){el.hidden=true;el.dataset.searchHidden='';}}else if(el.dataset.searchHidden!==undefined){el.hidden=false;delete el.dataset.searchHidden;}};

// Rows inside a container; wrappers that only hold rows are opened up so each row matches on its own.
function units(container,wrappers){
  const out=[];
  for(const child of container.children){
    if(child.tagName==='SUMMARY')continue;
    if(!child.matches(ROW)&&child.querySelector(ROW)){wrappers.push(child);out.push(...units(child,wrappers));}
    else out.push(child);
  }
  return out;
}

function searchPanel(panel,terms,context){
  const summary=panel.querySelector(':scope>summary'),title=summary?.textContent||'';
  const wrappers=[],rows=units(panel,wrappers);
  const whole=matchesAll(context+' '+title,terms);
  const matches=[];
  for(const row of rows){
    const hit=whole||matchesAll(context+' '+title+' '+unitText(row),terms);
    hide(row,!hit);
    if(!hit)continue;
    highlightText(row,terms);
    // A matching panel title is one result; otherwise every matching row is.
    if(!whole){row.classList.add('property-search-match');matches.push(row);}
  }
  for(const wrapper of wrappers)hide(wrapper,!units(wrapper,[]).some(row=>!row.hidden));
  const shown=whole||matches.length>0;
  hide(panel,!shown);
  if(shown){panel.open=true;if(summary)highlightText(summary,terms);}
  if(whole&&summary){summary.classList.add('property-search-match');matches.unshift(summary);}
  return matches;
}

// Walks a tab's content: panels are searched row by row, loose notes and buttons on their own text.
function searchContainer(container,terms,context){
  let matches=[];
  for(const child of [...container.children]){
    if(child.matches(PANEL)){matches.push(...searchPanel(child,terms,context));continue;}
    if(child.matches(CHROME)){hide(child,true);continue;}
    if(child.querySelector(PANEL)){
      matches.push(...searchContainer(child,terms,context));
      hide(child,![...child.querySelectorAll(PANEL)].some(panel=>!panel.hidden));continue;
    }
    const text=unitText(child),hit=matchesAll(context+' '+text,terms)&&matchesAny(text,terms);
    hide(child,!hit);
    if(hit){highlightText(child,terms);child.classList.add('property-search-match');matches.push(child);}
  }
  return matches;
}

// Filters one search group (a tab's mounted content). The label is the tab name, so "shaders" finds the whole tab.
export function applyPropertySearch(root,query,label=''){
  clearPropertySearch(root);
  const terms=searchTerms(query);
  if(!terms.length)return [];
  if(matchesAll(label,terms)){
    for(const chrome of root.querySelectorAll(CHROME))hide(chrome,true);
    const panels=[...root.querySelectorAll(PANEL)];for(const panel of panels)panel.open=true;
    return panels.map(panel=>panel.querySelector(':scope>summary')).filter(Boolean);
  }
  return searchContainer(root,terms,label);
}

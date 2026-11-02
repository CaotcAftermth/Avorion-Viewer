export const VARIANTS=['Base','Star','Eternal','Infinity','Solar'];

export const HARMONIES={Complementary:[180],Analogous:[-30,30],'Split Complementary':[150,210],Triadic:[120,240],Tetradic:[60,180,240]};

export function hsl([r,g,b]){

  r/=255;g/=255;b/=255;const max=Math.max(r,g,b),min=Math.min(r,g,b),delta=max-min,l=(max+min)/2;

  if(!delta)return {h:0,s:0,l};

  const h=60*(max===r?((g-b)/delta+6)%6:max===g?(b-r)/delta+2:(r-g)/delta+4);

  return {h,s:delta/(1-Math.abs(2*l-1)),l};

}

// Linear sRGB to OKLab (Björn Ottosson); OKLCH chroma is hypot(a, b).

export function perceptual([r,g,b]){

 const linear=v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;};

 [r,g,b]=[r,g,b].map(linear);

 const l=Math.cbrt(.4122214708*r+.5363325363*g+.0514459929*b);

 const m=Math.cbrt(.2119034982*r+.6806995451*g+.1073969566*b);

 const s=Math.cbrt(.0883024619*r+.2817188376*g+.6299787005*b);

 const L=.2104542553*l+.793617785*m-.0040720468*s;

 const a=1.9779984951*l-2.428592205*m+.4505937099*s;

 const bb=.0259040371*l+.7827717662*m-.808675766*s;

 return {L,a,b:bb,C:Math.hypot(a,bb)};

}

export function similarityOrder(colors){

 const remaining=[...colors].sort((a,b)=>a.ok.L-b.ok.L||a.row-b.row),ordered=[];

 while(remaining.length){const next=remaining.shift();ordered.push(next);remaining.sort((a,b)=>{

  const distance=c=>(c.ok.L-next.ok.L)**2+(c.ok.a-next.ok.a)**2+(c.ok.b-next.ok.b)**2;

  return distance(a)-distance(b)||a.row-b.row;

 });}return ordered;

}

function category(name,{h,s,l}){

  if(/white|gr[ae]y|black|snow|gainsboro/i.test(name)||s<.1)return 'Whites / Grays';

  if(/beige|ivory|lace|linen|almond|bisque|peach puff|navajo|moccasin|cornsilk|chiffon|seashell|papaya|wheat/i.test(name))return 'Beiges / Creams';

  if(/brown|sienna|peru|chocolate|burlywood|^tan$/i.test(name))return 'Browns';

  if(s<.25&&l>.8)return 'Soft Neutrals';

  return h<15||h>=345?'Reds':h<45?'Oranges':h<70?'Yellows / Golds':h<165?'Greens':h<195?'Turquoises':h<255?'Blues':h<290?'Purples':'Pinks';

}

export function parsePalette(text){

  const colors=[];

  text.split(/\r?\n/).forEach((line,index)=>{

    if(!line.trim())return;

    const match=line.match(/^\s*(\d+)\s+(\d+)\s+(\d+)\s+(.+?)\s*$/);

    if(!match)throw Error(`Invalid palette row ${index+1}`);

    const rgb=match.slice(1,4).map(Number);if(rgb.some(n=>n>255))throw Error(`Invalid RGB on row ${index+1}`);

    const name=match[4],prefix=name.match(/^(Star|Eternal|Infinity|Solar) (.+)$/);

    colors.push({id:name,name,rgb,hex:'#'+rgb.map(n=>n.toString(16).padStart(2,'0')).join('').toUpperCase(),row:index+1,variant:prefix?.[1]||'Base',baseName:prefix?.[2]||name,...hsl(rgb),ok:perceptual(rgb)});

  });

  const byId=new Map(colors.map(c=>[c.id,c]));if(byId.size!==colors.length)throw Error('Duplicate palette names');

  const bases=colors.filter(c=>c.variant==='Base');

  for(const base of bases){base.category=category(base.name,base);if(base.ok.C<.08)base.category=base.ok.L>=.88?'Pale / Near-white':'Muted / Neutrals';base.wheel=!['Whites / Grays','Beiges / Creams','Soft Neutrals','Browns','Pale / Near-white','Muted / Neutrals'].includes(base.category);base.variants=VARIANTS.map(v=>colors.find(c=>c.baseName===base.name&&c.variant===v)).filter(Boolean);}

  for(const color of colors){const base=byId.get(color.baseName);if(!base||base.variant!=='Base')throw Error(`Variant has no verified base: ${color.name}`);color.category=base.category;}

  return {colors,bases,byId,wheel:bases.filter(b=>b.wheel).sort((a,b)=>a.h-b.h||a.row-b.row),categories:[...new Set(bases.map(b=>b.category))]};

}

export const hueDistance=(a,b)=>Math.min(Math.abs(a-b)%360,360-Math.abs(a-b)%360);

// Twelve hue families, separated by gutters, each with three angular columns.

// Four tones increase in lightness outward. Sparse ranges repeat real bases.

export const WHEEL_BANDS=4;

export function wheelCells(palette){

  const cells=[],tones=[.24,.42,.60,.78],sectors=36,gutter=3;

  for(let sector=0;sector<sectors;sector++){

    const family=Math.floor(sector/3),column=sector%3,start=family*30+gutter/2+column*9,end=start+9;

    const hue=(start+end)/2,nearest=Math.min(...palette.wheel.map(c=>hueDistance(c.h,hue)));

    const candidates=palette.wheel.filter(c=>hueDistance(c.h,hue)<=Math.max(12,nearest+3)).sort((a,b)=>a.l-b.l||a.row-b.row);

    let costs=candidates.map(()=>({score:0,path:[]}));

    for(const tone of tones){

      costs=candidates.map((c,i)=>{

        const previous=costs.slice(0,i+1).reduce((a,b)=>a.score<=b.score?a:b);

        const score=(hueDistance(c.h,hue)/12)**2+((c.l-tone)/.18)**2+(1-c.s)*.2;

        return {score:previous.score+score,path:[...previous.path,c]};

      });

    }

    const best=costs.reduce((a,b)=>a.score<=b.score?a:b);

    best.path.forEach((color,band)=>cells.push({color,band,sector,family,hue,start,end}));

  }

  return cells;

}

export function harmony(palette,base,mode){

  if(!base?.wheel)return [];

  return (HARMONIES[mode]||[]).map(offset=>{

    const target=(base.h+offset+360)%360;

    const candidates=palette.wheel.filter(c=>c.id!==base.id);

    const nearest=Math.min(...candidates.map(c=>hueDistance(c.h,target)));

    // Preserve the hue relationship; balance appearance within an 8-degree window.

    const ranked=candidates.map(c=>({base:c,error:hueDistance(c.h,target),score:

      (hueDistance(c.h,target)/20)**2+((c.ok.L-base.ok.L)/.25)**2+((c.ok.C-base.ok.C)/.12)**2

    })).filter(c=>c.error<=nearest+8).sort((a,b)=>a.score-b.score||a.error-b.error||a.base.row-b.base.row);

    return {...ranked[0],target,offset};

  });

}

// Default material paint swatches supplied in Avorion_Material_Colors.xml.
// Keep source ARGB for provenance; painting retains the existing channel alpha policy.
export const MATERIAL_COLORS = [
  ['Iron', 'FFBFAEA3'], ['Titanium', 'BFBFBFBF'], ['Naonite', 'FFA3BFA3'],
  ['Trinium', 'FFA3AFBF'], ['Xanion', 'FFBFBFA3'], ['Ogonite', 'FFBFADA3'],
  ['Avorion', 'FFBC9F9F']
];

export function addMaterialColors(palette){
  const materials = MATERIAL_COLORS.map(([name, sourceArgb], index) => {
    const rgb = [2,4,6].map(offset => parseInt(sourceArgb.slice(offset,offset+2),16));
    const color = {id:name,name,baseName:name,variant:'Base',rgb,hex:'#'+sourceArgb.slice(2),
      sourceArgb,source:'Avorion_Material_Colors.xml',materialIndex:index,row:null,
      category:'Materials',wheel:false,...hsl(rgb),ok:perceptual(rgb)};
    color.variants=[color];return color;
  });
  return {...palette,materials,colors:[...palette.colors,...materials],bases:[...palette.bases,...materials],
    byId:new Map([...palette.byId,...materials.map(color=>[color.id,color])]),categories:[...palette.categories,'Materials']};
}

let pending;

export function loadPalette(){return pending??=fetch(new URL('./data/avorion-rgb.txt',import.meta.url)).then(r=>{if(!r.ok)throw Error('Local Avorion palette could not be loaded.');return r.text();}).then(parsePalette).then(addMaterialColors).catch(error=>{pending=null;throw error;});}



// Match a grayscale target to real off-wheel base colors; never synthesize paint values.

export function nearestNeutral(palette,level){

  const value=Math.max(0,Math.min(255,Number(level)||0)),target=perceptual([value,value,value]);

  return palette.bases.filter(isGrayscale).reduce((best,c)=>{

    const distance=color=>(color.ok.L-target.L)**2+(color.ok.a-target.a)**2+(color.ok.b-target.b)**2;

    return !best||distance(c)<distance(best)?c:best;

  },null);

}


export function isGrayscale(color){return color.rgb[0]===color.rgb[1]&&color.rgb[1]===color.rgb[2];}

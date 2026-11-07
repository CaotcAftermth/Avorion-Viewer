import {readFile,writeFile} from 'node:fs/promises';
const root=new URL('../src/assets/cursors/',import.meta.url),svgs={};
const files={select:'select',orbit:'orbit','pan-open':'pan','pan-closed':'pan',frame:'frame-all',eyedropper:'eyedrop',replace:'replace-color-with-selected',fill:'connected-fill',restore:'restore',brush:'brush'};
for(const [name,file] of Object.entries(files))svgs[name]=(await readFile(new URL(file+'.svg',root),'utf8')).replace('width="128" height="128"','width="40" height="40"');
const paths=s=>[...s.matchAll(/<path d="([^"]+)" fill="([^"]+)"[^>]*\/>/g)].map(([,d,fill])=>({d,fill}));
const orbit=paths(svgs.orbit),black=orbit[0].d.split(/Z/i).filter(x=>x.trim());
// Orbit's second black contour contains its arrow and the left orbit arc.
// Clip out that arc, retaining the exact arrow and its white interior.
svgs.select='<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 256 256"><defs><clipPath id="arrow"><rect x="101" y="60" width="85" height="130"/></clipPath></defs><g clip-path="url(#arrow)"><path d="'+black[1]+'Z" fill="'+orbit[0].fill+'" fill-rule="evenodd"/><path d="'+orbit.at(-1).d+'" fill="'+orbit.at(-1).fill+'" fill-rule="evenodd"/></g></svg>';
// Socket cursor uses the supplied plate and the exact Select / Orbit arrow.
const plate=await readFile(new URL('socket-plate.svg',root),'utf8');
const arrow=svgs.select.replace(/^<svg[^>]*>/,'').replace(/<\/svg>$/,'');
svgs.sockets=plate.trim().replace('</svg>',arrow+'</svg>');
svgs['brush-icon']=svgs.brush;
const brush=paths(svgs.brush),parts=brush[0].d.split(/Z/i).filter(x=>x.trim());
if(parts.length!==3)throw Error('Unexpected v4 brush contours');
const ring=[{...brush[0],d:parts.slice(0,2).join('Z')+'Z'},brush[1]];
svgs.brush='<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="29 29 198 198"><path d="'+parts[2]+'Z" fill="'+brush[0].fill+'"/><path d="'+brush[2].d+'" fill="'+brush[2].fill+'"/></svg>';
await writeFile(new URL('../src/assets/cursors/traced-cursors.js',import.meta.url),'// Generated from supplied v4 SVGs.\nexport const cursorSVGs='+JSON.stringify(svgs,null,2)+';\nexport const brushRingPaths='+JSON.stringify(ring,null,2)+';\n');

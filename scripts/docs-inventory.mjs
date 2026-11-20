import {readFile,writeFile} from 'node:fs/promises';
const pages=JSON.parse(await readFile('docs/site/navigation.json','utf8'));
const rows=[];
for(const page of pages){const text=await readFile(`docs/site/content/${page.id}.md`,'utf8');for(const [i,m]of [...text.matchAll(/^## (.+)$/gm)].entries())rows.push([`${page.id}-${i+1}`,m[1],page.id,page.status,page.source]);}
const quote=value=>'"'+value.replaceAll('"','""')+'"';
await writeFile('docs/FEATURE_COVERAGE.csv','feature_id,topic,page_id,status,source\n'+rows.map(r=>r.map(quote).join(',')).join('\n')+'\n');
console.log(`${rows.length} documentation section groups inventoried; individual-control verification remains tracked in page status.`);

import {createReadStream,createWriteStream} from 'node:fs';
import {link,mkdir,rm,stat,statfs,writeFile} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {basename,dirname,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {pipeline} from 'node:stream/promises';
import {parseArgs} from 'node:util';
import {fixtureOptions,planFixture,readHullStream,serializeFixture,presets,valueOptions} from '../src/stress-xml.js';
export {presets,translate} from '../src/stress-xml.js';

export const help=`Usage: node scripts/generate-stress-xml.mjs --profile PROFILE (--preset SIZE | --blocks N) [options]

Profiles: station-replica, canonical (alias canonical-mixed), canonical-uniform, adversarial
Presets: ${Object.entries(presets).map(([k,v])=>k+'='+v).join(', ')}
--source FILE              Required for station-replica; one native hull plan
--output FILE              Default: output/stress/PROFILE-COUNT.xml
--seed UINT32              Default: 42
--types INDEX:WEIGHT,...   Procedural canonical families
--materials INDEX:WEIGHT,...
--orientations LOOK/UP:WEIGHT,...
--dimensions MIN:MAX       Procedural dimensions before shape variation (default .5:1.5)
--pitch NUMBER             Procedural lattice pitch (default 4)
--module-side INTEGER      Procedural plate width and height (default 32)
--gap INTEGER              Station copy spacing, in native units (default 16)
--unsupported-percent P    Adversarial unsupported family share, 0–100 (default 15)
--help                     Show this help

Existing output files are protected. The companion manifest uses FILE.manifest.json.`;

export function options(argv){
  const {values}=parseArgs({args:argv,options:{...Object.fromEntries(valueOptions.map(n=>[n,{type:'string'}])),help:{type:'boolean'}}});
  if(values.help)return null;
  const config=fixtureOptions(values,argv);
  return {...config,source:config.source&&resolve(config.source),output:resolve(config.output)};
}

export function readHull(file,{hash,signal}={}){
  return readHullStream(createReadStream(file,{signal}),{onBytes:chunk=>hash?.update(chunk)});
}

export function createPlan(config,signal){
  const hash=createHash('sha256');
  return planFixture(config,config.source&&readHull(config.source,{hash,signal}),
    ()=>({name:basename(config.source),sha256:hash.digest('hex')}));
}

export async function generate(config,{signal,progress=()=>{}}={}){
  const started=performance.now(),output=config.output,manifestPath=output+'.manifest.json';
  await mkdir(dirname(output),{recursive:true});
  for(const file of [output,manifestPath])if(await stat(file).then(()=>true,e=>{if(e.code!=='ENOENT')throw e;return false;}))throw Error('Output already exists: '+file);
  const plan=await createPlan(config,signal);
  const disk=await statfs(dirname(output));
  if(disk.bavail*disk.bsize<config.blocks*(config.source?400:260))throw Error('Insufficient free space for fixture.');
  const temporary=output+'.'+randomUUID()+'.tmp',tempManifest=temporary+'.json';
  const fixture=serializeFixture(config,plan,{signal,progress}),hash=createHash('sha256');
  let xmlBytes=0,published=false,manifestPublished=false;
  async function* chunks(){
    for await(const text of fixture.chunks()){
      const bytes=Buffer.from(text);hash.update(bytes);xmlBytes+=bytes.length;yield bytes;
    }
  }
  try{
    await pipeline(chunks(),createWriteStream(temporary,{flags:'wx'}),{signal});
    const manifest=fixture.manifest(basename(output,'.xml'),{xmlBytes,generationMs:Math.round(performance.now()-started),sha256:hash.digest('hex')});
    await writeFile(tempManifest,JSON.stringify(manifest,null,2)+'\n',{flag:'wx',signal});
    // Publish with exclusive same-volume links so concurrent runs cannot overwrite.
    signal?.throwIfAborted();
    await link(temporary,output);published=true;
    await link(tempManifest,manifestPath);manifestPublished=true;
    return manifest;
  }finally{
    if(published&&!manifestPublished)await rm(output,{force:true});
    await Promise.all([rm(temporary,{force:true}),rm(tempManifest,{force:true})]);
  }
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const controller=new AbortController();
  const cancel=()=>controller.abort();
  process.once('SIGINT',cancel);process.once('SIGTERM',cancel);
  try{
    const config=options(process.argv.slice(2));
    if(!config)console.log(help);
    else{
      const manifest=await generate(config,{signal:controller.signal,progress:n=>console.error('Generated '+n.toLocaleString()+' / '+config.blocks.toLocaleString())});
      console.log(JSON.stringify({output:config.output,blocks:manifest.actualBlocks,bytes:manifest.xmlBytes,ms:manifest.generationMs,sha256:manifest.sha256}));
    }
  }catch(error){console.error(error.message);process.exitCode=controller.signal.aborted?130:1;}
  finally{process.removeListener('SIGINT',cancel);process.removeListener('SIGTERM',cancel);}
}

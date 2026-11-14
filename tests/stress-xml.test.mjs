import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,readdir,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {generate,options,readHull,translate} from '../scripts/generate-stress-xml.mjs';
import {modelFile} from '../scripts/model-stress-xml.mjs';

async function workspace(t){
  const dir=await mkdtemp(join(tmpdir(),'avorion-stress-'));
  t.after(()=>rm(dir,{recursive:true,force:true}));
  return dir;
}
async function rows(file){const items=[];for await(const b of readHull(file))items.push(b);return items;}
const item=(i,parent,x)=>`<item index="${i}" parent="${parent}"><block index="100" material="5" look="5" up="3" color="ffaabbcc" secondaryColor="00000000" lx="${x}" ly="0" lz="0" ux="${x+1}" uy="2" uz="3"/></item>`;
const sourceXml=items=>'<ship_design><plan>'+items.join('')+'</plan></ship_design>';

test('procedural fixtures stream exact counts and hashes with deterministic seed',async t=>{
  const dir=await workspace(t);
  const produce=(name,seed)=>generate(options(['--profile','adversarial','--blocks','2049','--seed',String(seed),'--output',join(dir,name+'.xml')]));
  const a=await produce('a',42),b=await produce('b',42),c=await produce('c',43);
  const xml=await readFile(a.generationOptions.output);
  assert.equal(a.sha256,b.sha256);
  assert.notEqual(a.sha256,c.sha256);
  assert.equal(a.sha256,createHash('sha256').update(xml).digest('hex'));
  assert.equal(a.xmlBytes,xml.length);
  assert.equal(a.unsupportedFamilyBlocks,307);
  const blocks=await rows(a.generationOptions.output);
  assert.equal(blocks.length,2049);
  blocks.forEach((b,i)=>{assert.equal(b.index,i);assert.ok(i?b.parent>=0&&b.parent<i:b.parent===-1);});
  const modeled=await modelFile(a.generationOptions.output);
  assert.equal(modeled.expandedBlocks+modeled.canonicalInstances+modeled.legacyInstances,2049);
  assert.ok(modeled.canonicalInstances>0);
  await assert.rejects(produce('a',42),/already exists/);
});

test('station replication remaps native parents and keeps an ancestor-closed remainder',async t=>{
  const dir=await workspace(t),source=join(dir,'source.xml'),output=join(dir,'copy.xml');
  await writeFile(source,sourceXml([item(30,20,4),item(10,-1,0),item(20,10,2)]));
  const report=await generate(options(['--profile','station-replica','--source',source,'--blocks','8','--output',output]));
  const blocks=await rows(output);
  assert.deepEqual(blocks.map(b=>b.parent),[-1,0,1,0,3,4,0,6]);
  assert.deepEqual(blocks.map(b=>+b.bounds[0]),[0,2,4,21,23,25,42,44]);
  assert.ok(blocks.every(b=>b.bounds[3]-b.bounds[0]===1&&b.look===5&&b.up===3&&b.secondary==='00000000'));
  assert.equal(report.replication.partialBlocks,2);
  assert.equal(report.replication.fullModules,2);
  assert.equal(translate('-1.52587891e-005',407),'406.9999847412109');
});

test('invalid configuration and cyclic or missing source parents fail without publishing',async t=>{
  const dir=await workspace(t),source=join(dir,'source.xml'),output=join(dir,'copy.xml');
  for(const args of [['--blocks','0'],['--profile','alien'],['--profile','station-replica'],['--preset','smoke','--blocks','9']])
    assert.throws(()=>options(args));
  const cfg=options(['--profile','station-replica','--source',source,'--blocks','8','--output',output]);
  await writeFile(source,sourceXml([item(10,-1,0),item(20,30,2),item(30,20,4)]));
  await assert.rejects(generate(cfg),/cycle/);
  await writeFile(source,sourceXml([item(10,-1,0),item(20,30,2)]));
  await assert.rejects(generate(cfg),/Missing parent/);
  assert.deepEqual(await readdir(dir),['source.xml']);
});

test('an aborted stream removes temporary files and leaves no finished fixture',async t=>{
  const dir=await workspace(t),controller=new AbortController();
  const cfg=options(['--blocks','110000','--output',join(dir,'aborted.xml')]);
  await assert.rejects(generate(cfg,{signal:controller.signal,progress:()=>controller.abort()}),{name:'AbortError'});
  assert.deepEqual(await readdir(dir),[]);
});

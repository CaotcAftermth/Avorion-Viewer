import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

// Exercise the actual github-script body, including its client selection.
const workflow=readFileSync(new URL('../.github/workflows/pages.yml',import.meta.url),'utf8');
const body=workflow.match(/          script: \|\r?\n([\s\S]+?)      - name: Deploy/)[1].replace(/^            /gm,'');
const run=new (async()=>{}).constructor('require','process','core','setTimeout',body);
async function check(responses){
 let calls=0;const delays=[],messages=[];
 await run(path=>{
  assert.equal(path,'/runner-temp/pages-artifact-client/node_modules/@actions/artifact');
  return {DefaultArtifactClient:class{async listArtifacts(...args){assert.deepEqual(args,[]);return {artifacts:responses[Math.min(calls++,responses.length-1)]};}}};
 },{env:{RUNNER_TEMP:'/runner-temp',PAGES_ARTIFACT_NAME:'pages-current'}},{info:message=>messages.push(message)},(resolve,ms)=>{delays.push(ms);resolve();});
 return {calls,delays,messages};
}
const artifact={id:42,name:'pages-current'};
test('Pages wait uses the deployment client and waits past unrelated artifacts',async()=>{
 const result=await check([[],[{id:1,name:'pages-old'}],[artifact]]);
 assert.equal(result.calls,3);assert.deepEqual(result.delays,[5000,5000]);assert.match(result.messages.at(-1),/artifact 42 is visible/);
});
test('Pages wait proceeds immediately when the matching artifact is ready',async()=>{
 const result=await check([[artifact]]);assert.equal(result.calls,1);assert.deepEqual(result.delays,[]);
});
test('Pages wait rejects duplicate artifacts',async()=>{
 await assert.rejects(check([[artifact,artifact]]),/Multiple Pages artifacts/);
});
test('Pages wait fails clearly after bounded checks when the backend stays empty',async()=>{
 await assert.rejects(check([[]]),/after 12 checks/);
});

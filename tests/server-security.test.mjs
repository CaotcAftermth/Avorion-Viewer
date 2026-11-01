import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {viewerHandler} from '../scripts/serve.mjs';
test('local server serves app assets but rejects private paths and foreign origins',async()=>{
 const server=http.createServer(viewerHandler('.'));await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const request=(path,headers={},method='GET')=>new Promise((resolve,reject)=>{const req=http.request({hostname:'127.0.0.1',port:server.address().port,path,method,headers:{Host:'127.0.0.1:5173',...headers}},res=>{let body='';res.on('data',v=>body+=v);res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body}));});req.on('error',reject);req.end();});
 try{
  assert.equal((await request('/')).status,200);
  assert.equal((await request('/src/app.js')).status,200);
  for(const path of ['/.git/config','/.env','/viewer-server.log','/package-lock.json','/src/%2e%2e/.env','/src/%5c..%5c.env','/src/app.js:secret','/src/.env'])assert.equal((await request(path)).status,403,path);
  assert.equal((await request('/src/app.js',{Origin:'https://example.com'})).status,403);
  assert.equal((await request('/',{},'POST')).status,405);
  const head=await request('/',{},'HEAD');assert.equal(head.status,200);assert.equal(head.body,'');assert.equal(head.headers['x-content-type-options'],'nosniff');
  assert.equal((await request('/',{Host:'localhost:5173'})).headers.location,'http://127.0.0.1:5173/');
 }finally{await new Promise(r=>server.close(r));}
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {Store} from '../server/store.mjs';
import {createApp} from '../server/index.mjs';
import {contentBackup,operationsStatus} from '../server/operations.mjs';

test('content exports include only the explicit content scope and never keys, accounts or sessions',()=>{
 const store=new Store();try{const admin=store.setPreviewRole(store.session(),'admin');
 store.db.prepare('INSERT OR REPLACE INTO config VALUES(?,?)').run('unlisted_secret','DO_NOT_EXPORT');
 store.db.prepare('INSERT OR REPLACE INTO config VALUES(?,?)').run('board_posts',JSON.stringify([{id:'board-test',title:'Public draft'}]));
 assert.throws(()=>contentBackup(store,store.session()),/FORBIDDEN/);
 const data=contentBackup(store,admin), serialized=JSON.stringify(data);
 assert.equal(data.format,'nowro-content-backup');assert.equal(data.version,1);assert.equal(data.config.board_posts[0].title,'Public draft');
 assert.ok(!serialized.includes(store.secret));assert.ok(!serialized.includes(admin.id));assert.ok(!serialized.includes('DO_NOT_EXPORT'));
 assert.equal(data.users,undefined);assert.equal(data.auth_tokens,undefined);
 }finally{store.close();}
});

test('operations status distinguishes configured integrations from unverified backup and persistence',()=>{
 const store=new Store();try{const admin=store.setPreviewRole(store.session(),'admin');
 const report=operationsStatus(store,admin,{enabled:true});assert.equal(report.checks.find(c=>c.id==='auth').ready,true);
 for(const id of ['storage','backup','mail','billing','hosting'])assert.equal(report.checks.find(c=>c.id===id).ready,false);
 assert.throws(()=>operationsStatus(store,store.session(),{enabled:true}),/FORBIDDEN/);
 }finally{store.close();}
});

test('operator readiness and content export deny guest access and disable response caching',async()=>{
 const store=new Store(),admin=store.setPreviewRole(store.session(),'admin'),server=createApp(store,{auth:{resolve:async s=>s,account:()=>null,enabled:false}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{const base=`http://127.0.0.1:${server.address().port}/api/operator/`;
 for(const path of ['operations','content-backup']){assert.equal((await fetch(base+path)).status,403);const response=await fetch(base+path,{headers:{Cookie:'nowro='+admin.id}});assert.equal(response.status,200);assert.equal(response.headers.get('Cache-Control'),'no-store');const body=await response.json();assert.ok(path==='operations'?body.checks.length>0:body.format==='nowro-content-backup');}
 }finally{await new Promise(r=>server.close(r));store.close();}
});

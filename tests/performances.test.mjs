import test from 'node:test';
import assert from 'node:assert/strict';
import { Store } from '../server/store.mjs';
import { createApp } from '../server/index.mjs';
test('performance configuration is admin-only, validates IDs, enforces CSRF and permits an empty public feed', async()=>{
 const store=new Store();
 const admin=store.setPreviewRole(store.session(),'admin');
 const server=createApp(store,{auth:{resolve:async s=>s,account:()=>null}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base=`http://127.0.0.1:${server.address().port}/api/`;
 const post=(ids,adminCookie=true,csrf=true)=>fetch(base+'operator/performance-ids',{method:'POST',headers:{'Content-Type':'application/json',...(adminCookie?{Cookie:'nowro='+admin.id}:{}),...(csrf?{'X-NOWRO-Request':'1'}:{})},body:JSON.stringify({ids})});
 try {
  const empty=await (await fetch(base+'performances')).json();
  assert.equal(empty.status,'setup_required'); assert.deepEqual(empty.items,[]);
  assert.equal((await fetch(base+'operator/performance-ids')).status,403);
  assert.equal((await post(['123'],false)).status,403);
  assert.equal((await post(['123'],true,false)).status,403);
  assert.equal((await post(['bad-id'])).status,400);
  assert.equal((await post(['1','2','3','4','5','6'])).status,400);
  assert.equal((await post(['123','123'])).status,200);
  const saved=await (await fetch(base+'operator/performance-ids',{headers:{Cookie:'nowro='+admin.id}})).json();
  assert.deepEqual(saved.ids,['123']);
  assert.equal((await post([])).status,200);
 } finally { await new Promise(resolve=>server.close(resolve)); store.close(); }
});

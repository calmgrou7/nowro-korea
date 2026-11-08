import test from 'node:test';
import assert from 'node:assert/strict';
import { Store } from '../server/store.mjs';
import { boardPosts, saveBoardPost } from '../server/boards.mjs';
test('boards enforce admin writes, published-only reads and reversible unpublishing',()=>{
 const store=new Store();
 try {
  const guest=store.session(),admin=store.setPreviewRole(store.session(),'admin');
  const input={board:'guide',title:'Guide',body:'Body',image:'',published:false};
  assert.throws(()=>saveBoardPost(store,guest,input),/FORBIDDEN/);
  const post=saveBoardPost(store,admin,input);
  assert.equal(boardPosts(store).length,0);
  assert.equal(boardPosts(store,true).length,1);
  saveBoardPost(store,admin,{...post,published:true});
  assert.equal(boardPosts(store).length,1);
  saveBoardPost(store,admin,{...post,published:false});
  assert.equal(boardPosts(store).length,0);
  assert.throws(()=>saveBoardPost(store,admin,{...input,image:'javascript:alert(1)'}),/INVALID_IMAGE/);
 } finally {store.close();}
});

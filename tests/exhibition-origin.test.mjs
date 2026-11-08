import test from 'node:test';
import assert from 'node:assert/strict';
import {parseExhibitionOrigin,loadExhibitionsWithFallback} from '../server/exhibition-origin.mjs';
import {readExhibitionOrigin} from '../server/exhibition-origin-https.mjs';
const item=id=>`<li><a href="javascript:fn_view('${id}','140');"><span class="date-end"><span>0일 후 종료</span></span><img src="/images/contents/noimg5.jpg"><h3 class="tit ellipsis">전시 &amp; 이야기</h3><span class="date">2026.11.01~2026.11.08</span><span class="where">부산 전시장</span></a></li>`;
const html=(id='2026080025',total=1)=>`총 ${total}건 <ul class="boardlist type1">${item(id)}</ul>`;
test('official exhibition listing extracts dates rather than countdown badges and rejects changed markup',()=>{
 const [p]=parseExhibitionOrigin(html()).items;assert.equal(p.op_ed_dt,'2026-11-08');assert.equal(p.title,'전시 & 이야기');assert.equal(p.MAIN_IMG_NORMAL,'');assert.match(p.sourceUrl,/res_no=2026080025/);assert.ok(!p.sourceUrl.includes('jsessionid'));
 const poster=html().replace('/images/contents/noimg5.jpg','/images/contents/play_img_42.jpg');assert.match(parseExhibitionOrigin(poster).items[0].MAIN_IMG_NORMAL,/play_img_42.jpg$/);
 assert.equal(parseExhibitionOrigin(html().replace('/images/contents/noimg5.jpg','https://evil.test/a.jpg')).items[0].MAIN_IMG_NORMAL,'');
 assert.throws(()=>parseExhibitionOrigin('총 1건 <ul class="boardlist type1"></ul>'));
 assert.throws(()=>parseExhibitionOrigin('<html>maintenance</html>'));
});
test('failed primary API uses official pages with explicit provenance and pagination',async()=>{
 const original=globalThis.fetch;globalThis.fetch=async()=>new Response('<OpenAPI_ServiceResponse><returnReasonCode>05</returnReasonCode></OpenAPI_ServiceResponse>',{status:504});const pages=[];
 try{const f=await loadExhibitionsWithFallback('test-only',{readOrigin:async u=>{const page=Number(u.searchParams.get('page'));pages.push(page);return html('20260800'+String(page).padStart(2,'0'),21);}});assert.equal(f.status,'ok');assert.equal(f.transport,'official_portal');assert.equal(f.primary.reason,'upstream_timeout');assert.equal(f.primary.providerCode,'05');assert.deepEqual(pages,[1,2,3]);assert.equal(f.items.length,3);assert.equal(f.partial,true);assert.ok(!JSON.stringify(f).includes('test-only'));}finally{globalThis.fetch=original;}
});
test('authentication rejection is not hidden by the public-source fallback',async()=>{
 const original=globalThis.fetch;globalThis.fetch=async()=>new Response('<OpenAPI_ServiceResponse><returnReasonCode>20</returnReasonCode></OpenAPI_ServiceResponse>',{status:403});let called=false;
 try{await assert.rejects(loadExhibitionsWithFallback('test-only',{readOrigin:async()=>{called=true;return html();}}),e=>e.reason==='upstream_rejected');assert.equal(called,false);}finally{globalThis.fetch=original;}
});
test('healthy API remains primary and origin reader rejects other destinations before network access',async()=>{
 const original=globalThis.fetch;globalThis.fetch=async()=>new Response(JSON.stringify({response:{header:{resultCode:'00'},body:{totalCount:0,items:[]}}}));let called=false;
 try{const feed=await loadExhibitionsWithFallback('test-only',{readOrigin:async()=>{called=true;return html();}});assert.equal(feed.status,'ok');assert.equal(feed.transport,undefined);assert.equal(called,false);}finally{globalThis.fetch=original;}
 for(const url of ['http://busandabom.net/play/list.nm','https://example.com/play/list.nm','https://busandabom.net/private'])assert.throws(()=>readExhibitionOrigin(new URL(url)));
});

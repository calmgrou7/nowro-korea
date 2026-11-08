import test from 'node:test';
import assert from 'node:assert/strict';
import {parseExhibitionResponse,loadExhibitions} from '../server/exhibitions.mjs';
const row={res_no:'202611001',title:'전시 & 이야기',op_st_dt:'2026-11-01',op_ed_dt:'2026-12-01',op_at:'N',place_nm:'부산 전시장',pay_at:'N'};
const xml='<response><header><resultCode>00</resultCode></header><body><totalCount>1</totalCount><items><item><res_no>202611001</res_no><title><![CDATA[전시 & 이야기]]></title><op_st_dt>2026-11-01</op_st_dt><op_ed_dt>2026-12-01</op_ed_dt><op_at>N</op_at><place_nm>부산 전시장</place_nm><pay_at>N</pay_at></item></items></body></response>';
test('exhibition JSON and XML yield matching official fields, single rows and genuinely empty feeds',()=>{
 assert.deepEqual(parseExhibitionResponse(xml).items,[row]);
 assert.deepEqual(parseExhibitionResponse(JSON.stringify({response:{header:{resultCode:'00'},body:{totalCount:1,items:{item:row}}}})).items,[row]);
 assert.deepEqual(parseExhibitionResponse('<response><header><resultCode>00</resultCode></header><body><totalCount>0</totalCount><items/></body></response>').items,[]);
 assert.equal(parseExhibitionResponse(xml.replace('<![CDATA[전시 & 이야기]]>','전시 &amp; 이야기')).items[0].title,row.title);
});
test('provider timeout and auth failures are distinguished from empty results and invalid formats',()=>{
 const error=code=>`<OpenAPI_ServiceResponse><cmmMsgHeader><returnReasonCode>${code}</returnReasonCode></cmmMsgHeader></OpenAPI_ServiceResponse>`;
 assert.throws(()=>parseExhibitionResponse(error('05'),504),e=>e.reason==='upstream_timeout'&&e.providerCode==='05'&&e.httpStatus===504);
 assert.throws(()=>parseExhibitionResponse(error('20'),401),e=>e.reason==='upstream_rejected'&&e.providerCode==='20');
 for(const bad of ['<html>error</html>','<!DOCTYPE response>'+xml,xml.slice(0,-11),JSON.stringify({resultCode:'00'}),JSON.stringify({response:{header:{resultCode:'00'},body:{totalCount:1,items:[]}}})])assert.throws(()=>parseExhibitionResponse(bad));
});
test('exhibition request uses only documented parameters and reads an XML response',async()=>{
 const original=globalThis.fetch;
 globalThis.fetch=async url=>{const u=new URL(url);assert.equal(u.pathname,'/6260000/BusanCultureExhibitService/getBusanCultureExhibit');assert.deepEqual([...u.searchParams.keys()].sort(),['ServiceKey','numOfRows','pageNo']);assert.equal(u.searchParams.get('ServiceKey'),'test-only');return new Response(xml,{headers:{'content-type':'application/xml'}});};
 try{const feed=await loadExhibitions('test-only');assert.equal(feed.status,'ok');assert.equal(feed.format,'xml');assert.equal(feed.items[0].res_no,row.res_no);assert.ok(!JSON.stringify(feed).includes('test-only'));}finally{globalThis.fetch=original;}
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {parseKopis,kopisPerformances,kopisDetail} from '../server/kopis.mjs';
test('KOPIS XML decoding and external entity rejection',()=>{
 assert.equal(parseKopis('<dbs><db><prfnm><![CDATA[A & B]]></prfnm><fcltynm>공연장 &amp; 홀</fcltynm></db></dbs>')[0].fcltynm,'공연장 & 홀');
 assert.throws(()=>parseKopis('<!DOCTYPE x><dbs></dbs>'));
 assert.throws(()=>parseKopis('<error>invalid key</error>'));
 assert.deepEqual(parseKopis('<dbs/>'),[]);
 assert.deepEqual(parseKopis('<dbs />'),[]);
});
test('KOPIS uses Busan list filters, secure posters, detail venue lookup and cache',async()=>{
 const original=globalThis.fetch,token=process.env.KOPIS_API_KEY;process.env.KOPIS_API_KEY='test-only';let calls=0;
 globalThis.fetch=async url=>{calls++;const u=new URL(url);assert.equal(u.protocol,'https:');assert.equal(u.searchParams.get('service'),'test-only');
 if(u.pathname.endsWith('/pblprfr')){assert.equal(u.searchParams.get('signgucode'),'26');assert.equal(u.searchParams.get('rows'),'100');const parse=v=>Date.parse(v.slice(0,4)+'-'+v.slice(4,6)+'-'+v.slice(6,8));assert.equal((parse(u.searchParams.get('eddate'))-parse(u.searchParams.get('stdate')))/86400000,30);return new Response('<dbs><db><mt20id>PF123</mt20id><prfnm>Test show</prfnm><prfpdfrom>2026.11.08</prfpdfrom><prfpdto>2099.12.31</prfpdto><poster>http://www.kopis.or.kr/upload/photo.jpg</poster></db></dbs>');}
 if(u.pathname.includes('/prfplc/'))return new Response('<dbs><db><adres>부산광역시 수영구</adres><la>35.153</la><lo>129.118</lo></db></dbs>');
 return new Response('<dbs><db><mt20id>PF123</mt20id><mt10id>FC123</mt10id><prfnm>Test show</prfnm><fcltynm>Hall</fcltynm><pcseguidance>무료</pcseguidance></db></dbs>');};
 try{const feed=await kopisPerformances();assert.equal(feed.status,'ok');assert.equal(feed.items.length,1);assert.match(feed.items[0].MAIN_IMG_NORMAL,/^https:/);await kopisPerformances();assert.equal(calls,1);const detail=await kopisDetail('PF123');assert.equal(detail.items[0].ADDR1,'부산광역시 수영구');assert.equal(detail.items[0].LAT,'35.153');assert.equal((await kopisDetail('../../secret')).status,'invalid_id');assert.equal(calls,3);}finally{globalThis.fetch=original;if(token===undefined)delete process.env.KOPIS_API_KEY;else process.env.KOPIS_API_KEY=token;}
});

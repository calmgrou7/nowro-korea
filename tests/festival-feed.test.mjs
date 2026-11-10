import test from 'node:test';
import assert from 'node:assert/strict';
import {tourFestivals,combinedFestivals,normalizeTourFestival} from '../server/festival-feed.mjs';
import {showEvent} from '../shared/visitor-content.ts';
const row={contentid:'123',title:'부산국제매직페스티벌',addr1:'부산광역시 해운대구 수영강변대로 120',mapy:'35.17',mapx:'129.12',eventstartdate:'20260628',eventenddate:'20261226',firstimage:'https://example.org/poster.jpg'};
const response=(items,total=items.length)=>Response.json({response:{header:{resultCode:'0000'},body:{totalCount:total,items:{item:items}}}});
test('festival search uses Busan legal region, reads every page, and preserves dates, posters and district',async()=>{
 const urls=[];const result=await tourFestivals('test',{now:new Date('2026-11-10'),fetcher:async u=>{urls.push(new URL(u));return response([row],urls.length===1?101:101);}});
 assert.equal(urls.length,2);assert.equal(urls[0].searchParams.get('lDongRegnCd'),'26');assert.equal(urls[0].searchParams.has('areaCode'),false);assert.match(urls[0].pathname,/searchFestival2$/);assert.equal(urls[1].searchParams.get('pageNo'),'2');
 const item=result.items[0];assert.equal(item.eventEnd,'2026-12-26');assert.equal(item.GUGUN_NM,'해운대구');assert.equal(item.MAIN_IMG_NORMAL,row.firstimage);assert.equal(showEvent(item,'festivals',false,new Date('2026-11-10')),true);
 assert.equal(showEvent({...item,eventEnd:'2025-12-26'},'festivals',false,new Date('2026-11-10')),false);
 const upcoming=normalizeTourFestival({...row,eventstartdate:'20261114',eventenddate:'20261114'});assert.equal(showEvent(upcoming,'festivals',false,new Date('2026-11-10')),true);
});
test('combined festival feed retains one provider on failure and deduplicates matching dated editions',async()=>{
 const tour=normalizeTourFestival(row),busan={...tour,UC_SEQ:20,MAIN_TITLE:row.title+'(한,영)'};
 const feed=await combinedFestivals(async()=>({status:'ok',items:[busan]}),'test',{fetcher:async()=>response([row])});assert.equal(feed.items.length,1);assert.equal(feed.items[0].UC_SEQ,'tour-ko-123');assert.equal(feed.partial,false);
 const fallback=await combinedFestivals(async()=>({status:'ok',items:[busan]}),'test',{fetcher:async()=>{throw Error('timeout');}});assert.equal(fallback.items.length,1);assert.equal(fallback.partial,true);
 await assert.rejects(combinedFestivals(async()=>{throw Error('timeout');},'test',{fetcher:async()=>Response.json({response:{header:{resultCode:'30'}}})}),/FESTIVAL_PROVIDERS_UNAVAILABLE/);
});

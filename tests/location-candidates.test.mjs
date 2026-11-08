import test from 'node:test';
import assert from 'node:assert/strict';
import {locationCandidates} from '../server/location-candidates.mjs';
test('official reference candidates match the normalized event identity without inventing coordinates',async()=>{
 const original=globalThis.fetch,keys=['BUSAN_FESTIVAL_API_KEY','BUSAN_MARITIME_API_KEY','KTO_KOREAN_API_KEY'],previous=keys.map(k=>process.env[k]);keys.forEach(k=>process.env[k]='test-only');
 globalThis.fetch=async url=>new Response(JSON.stringify({response:{header:{resultCode:'0000'},body:{items:{item:String(url).includes('FestivalService')?[{UC_SEQ:440,MAIN_TITLE:'해운대 빛축제(한,영,일)',ADDR1:'부산광역시 해운대구 해운대해변로 264',GUGUN_NM:'해운대구',LAT:35.15849,LNG:129.15987},{UC_SEQ:441,MAIN_TITLE:'해운대 빛축제',LAT:0,LNG:0}]:[]}}}}));
 try{const feed=await locationCandidates('제13회 해운대빛축제');assert.equal(feed.items.length,1);assert.equal(feed.items[0].district,'해운대구');assert.equal(feed.items[0].reference,true);assert.equal((await locationCandidates('다른 빛축제')).items.length,0);assert.equal((await locationCandidates('')).items.length,0);}finally{globalThis.fetch=original;keys.forEach((k,i)=>{if(previous[i]===undefined)delete process.env[k];else process.env[k]=previous[i];});}
});

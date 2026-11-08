import test from 'node:test';
import assert from 'node:assert/strict';
import { Store, areas } from '../server/store.mjs';
import { nearbyShops } from '../server/nearby.mjs';
test('nearby shops validate coordinates, constrain distance and persist route-ready places',async()=>{
 const store=new Store(), originalFetch=globalThis.fetch, token=process.env.KTO_KOREAN_API_KEY;
 let calls=0;process.env.KTO_KOREAN_API_KEY='test-only';
 globalThis.fetch=async url=>{calls++;const type=new URL(url).searchParams.get('contentTypeId');return new Response(JSON.stringify({response:{header:{resultCode:'0000'},body:{items:{item:[{contentid:'test-'+type,title:'주변 상점',addr1:'부산광역시 수영구',mapy:'35.153',mapx:'129.118',contenttypeid:type},{contentid:'far',title:'먼 상점',mapy:'35.5',mapx:'129.4',contenttypeid:type}]}}}}));};
 try {
  assert.equal((await nearbyShops(store,areas,0,0)).status,'location_unavailable');assert.equal(calls,0);
  const feed=await nearbyShops(store,areas,35.153,129.118);assert.equal(feed.status,'ok');assert.equal(feed.items.length,2);assert.ok(feed.items.every(p=>p.distanceKm<=2));
  assert.ok(store.catalog().some(p=>p.id==='kto-test-39'&&p.planningEstimate));
  await nearbyShops(store,areas,35.153,129.118);assert.equal(calls,2);
 } finally {globalThis.fetch=originalFetch;if(token===undefined)delete process.env.KTO_KOREAN_API_KEY;else process.env.KTO_KOREAN_API_KEY=token;store.close();}
});

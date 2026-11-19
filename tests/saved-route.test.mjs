import test from 'node:test';
import assert from 'node:assert/strict';
import {savedRouteStatus} from '../shared/saved-route.ts';
import {Store} from '../server/store.mjs';
const now=new Date('2026-11-11T00:00:00Z');
const place={id:'busan-festivals-1',published:true,category:'event',point:{lat:35.15,lng:129.12},availableUntil:'2026-11-20'};
test('TourAPI festival identities reconnect and upcoming dates are not reported as missing location',()=>{
 const festival={...place,id:'busan-festivals-tour-ko-3437916',availableFrom:'2026-11-26',availableUntil:'2026-12-25'};
 for(const item of [{ktoContentId:'3437916'},{UC_SEQ:'festivals-tour-ko-3437916'},{routePlaceId:festival.id}]){
  const status=savedRouteStatus(item,[festival],now);
  assert.equal(status.reason,'upcoming');assert.equal(status.startDate,'2026-11-26');
  assert.equal(savedRouteStatus(item,[festival],new Date('2026-11-26T00:00:00Z')).reason,null);
 }
});
test('revalidated catalog resolves old saved flags and exhibition identities',()=>{
 const current={...place,id:'busan-exhibitions-123',category:'culture',checkedAt:now.toISOString()};
 assert.equal(savedRouteStatus({res_no:'123',locationNeedsReview:true},[current],now).reason,null);
 assert.equal(savedRouteStatus({res_no:'123',eventEnd:'2020-01-01'},[current],now).reason,null);
 assert.equal(savedRouteStatus({res_no:'123'},[{...current,point:{lat:0,lng:0}}],now).reason,'location');
});
test('bulk route removal is scoped to owner, deduplicated and repeatable',()=>{
 const store=new Store();const a=store.session(),b=store.session();
 try{
  const add=store.db.prepare('INSERT INTO trips VALUES (?,?,?,?)');
  add.run('a',a.user_id,'{}',now.toISOString());add.run('b',b.user_id,'{}',now.toISOString());
  assert.equal(store.deleteTrips(a,['a','a','b']).deleted,1);
  assert.equal(store.db.prepare('SELECT id FROM trips WHERE id=?').get('b').id,'b');
  assert.equal(store.deleteTrips(a,['a']).deleted,0);
  assert.throws(()=>store.deleteTrips(a,[]));
 }finally{store.db.close();}
});
test('legacy saved identity reconnects to the current canonical catalog without deleting bookmarks',()=>{
 assert.equal(savedRouteStatus({UC_SEQ:'festivals-1'},[place],now).place.id,place.id);
 assert.equal(savedRouteStatus({kopisId:'A1'},[{...place,id:'kopis-A1'}],now).place.id,'kopis-A1');
 assert.equal(savedRouteStatus({contentid:'12'},[{...place,id:'kto-12'}],now).reason,null);
});
test('saved route diagnostics distinguish ended, location, schedule and unavailable records',()=>{
 const item={routePlaceId:place.id};
 assert.equal(savedRouteStatus(item,[{...place,availableUntil:'2026-11-10'}],now).reason,'ended');
 assert.equal(savedRouteStatus(item,[{...place,point:{lat:0,lng:0}}],now).reason,'location');
 assert.equal(savedRouteStatus(item,[{...place,availableUntil:undefined}],now).reason,'schedule');
 assert.equal(savedRouteStatus(item,[],now).reason,'unavailable');
 assert.equal(savedRouteStatus({...item,GUGUN_NM:'수영구',ADDR1:'부산광역시 사상구 삼락동'},[place],now).reason,'location');
});
test('permanent venues need no event end date and mixed selections retain only verified candidates',()=>{
 const cafe={...place,id:'kto-cafe',category:'cafe',availableUntil:undefined};
 const items=[{routePlaceId:cafe.id},{routePlaceId:'missing'},{routePlaceId:place.id}];
 const before=JSON.stringify(items);const results=items.map(i=>savedRouteStatus(i,[cafe,place],now));
 assert.deepEqual(results.flatMap(r=>r.place?[r.place.id]:[]),['kto-cafe',place.id]);assert.equal(JSON.stringify(items),before);
});

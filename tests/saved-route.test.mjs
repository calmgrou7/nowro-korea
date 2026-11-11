import test from 'node:test';
import assert from 'node:assert/strict';
import {savedRouteStatus} from '../shared/saved-route.ts';
const now=new Date('2026-11-11T00:00:00Z');
const place={id:'busan-festivals-1',published:true,category:'event',point:{lat:35.15,lng:129.12},availableUntil:'2026-11-20'};
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

import test from 'node:test';
import assert from 'node:assert/strict';
import {recommendationResponse} from '../server/recommendation.mjs';
import {places,areas} from '../shared/catalog.ts';
const conditions={areaId:'gwangalli',origin:areas[1].point,minutes:360,budget:160000,interests:['sea','cafe'],transport:'walk',companion:'solo',startAt:'2026-10-05T10:00:00+09:00',returnPoint:null,deadline:null,children:false,accessible:false,diet:'',tripStart:'',tripEnd:''};
test('recommendation includes the exact place snapshot needed to render every stop',()=>{
 const result=recommendationResponse(conditions,places);
 assert.ok(result.routes.length);
 assert.equal(result.diagnostic,null);
 for(const route of result.routes)for(const stop of route.stops)assert.ok(result.places.some(p=>p.id===stop.placeId));
 assert.ok(result.places.every(p=>result.routes.some(r=>r.stops.some(s=>s.placeId===p.id))));
});
test('missing selected stop has an actionable reason instead of an unexplained empty result',()=>{
 const result=recommendationResponse({...conditions,requiredPlaceId:'missing'},places);
 assert.deepEqual(result.routes,[]);
 assert.equal(result.diagnostic,'selected_place_unavailable');
});
test('eight expired candidates do not crowd out an available ninth place',()=>{
 const suitable=places.find(p=>p.id===recommendationResponse(conditions,places).routes[0].stops[0].placeId);
 const catalog=Array.from({length:8},(_,i)=>({...suitable,id:`expired-${i}`,availableUntil:'2020-01-01'}));
 catalog.push({...suitable,id:'available'});
 const result=recommendationResponse(conditions,catalog);
 assert.ok(result.routes.length);
 assert.ok(result.routes.every(r=>r.stops.every(s=>s.placeId==='available')));
});

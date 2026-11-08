import test from 'node:test';
import assert from 'node:assert/strict';
import {recommendationResponse} from '../server/recommendation.mjs';
import {calculate} from '../shared/engine.ts';
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
test('nearby stops across district boundaries can share a recommended route',()=>{
 const template=places.find(p=>p.id===recommendationResponse(conditions,places).routes[0].stops[0].placeId);
 const catalog=[{...template,id:'start',areaId:conditions.areaId,point:conditions.origin},{...template,id:'neighbor',areaId:'neighboring-district',point:{lat:conditions.origin.lat+.001,lng:conditions.origin.lng}}];
 const result=recommendationResponse({...conditions,requiredPlaceIds:['start','neighbor']},catalog);
 assert.ok(result.routes.length);
 assert.ok(result.routes.every(r=>['start','neighbor'].every(id=>r.stops.some(s=>s.placeId===id))));
 assert.ok(calculate(['start','neighbor'],conditions,catalog));
 assert.equal(calculate(['start','neighbor'],{...conditions,minutes:30},catalog),null);
 assert.equal(calculate(['start','neighbor'],{...conditions,budget:0},catalog),null);
});
test('a farther neighboring stop becomes eligible with transit, while remote stops stay excluded',()=>{
 const template=places.find(p=>p.id===recommendationResponse(conditions,places).routes[0].stops[0].placeId);
 const nearby={...template,id:'neighbor',areaId:'neighboring-district',point:{lat:conditions.origin.lat+.04,lng:conditions.origin.lng}};
 const catalog=[nearby,{...nearby,id:'remote',point:{lat:conditions.origin.lat+.5,lng:conditions.origin.lng}}];
 const selected={...conditions,requiredPlaceId:'neighbor'};
 assert.equal(recommendationResponse(selected,catalog).diagnostic,'selected_place_too_far');
 assert.ok(recommendationResponse({...selected,transport:'transit'},catalog).routes.length);
 assert.equal(recommendationResponse({...selected,transport:'transit',requiredPlaceId:'remote'},catalog).diagnostic,'selected_place_too_far');
});

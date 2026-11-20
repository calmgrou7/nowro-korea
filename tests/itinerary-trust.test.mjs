import test from 'node:test';
import assert from 'node:assert/strict';
import { areas, places } from '../shared/catalog.ts';
import { calculate, recommend } from '../shared/engine.ts';
import { officialPricing, placePricing } from '../shared/pricing.ts';
import { visitHoursStatus } from '../shared/visit-hours.ts';
import { recommendationResponse } from '../server/recommendation.mjs';
import { itineraryCostText, itineraryHoursText, itineraryPlaceTitle } from '../src/itinerary-display.ts';

const area = areas.find(a=>a.id==='gwangalli');
const conditions = {areaId:area.id,origin:area.point,minutes:120,budget:60000,interests:['sea','cafe'],transport:'walk',companion:'solo',startAt:'2026-11-20T20:22:00+09:00',returnPoint:null,deadline:null,children:false,accessible:false,diet:'',tripStart:'',tripEnd:'',allowPlanningEstimates:true};
const friday = (open,close,lastEntry)=>[{day:5,open,close,lastEntry}];
const makePlace = (id, override={})=>({...places[0], id, areaId:area.id, point:area.point, category:'cafe',sample:false,stay:50,wait:0,planningEstimate:true,hoursStatus:'published',hours:friday(1080,1320,1260),...officialPricing({USAGE_AMOUNT:'6,000원'}),...override});
const fakeAllDay = Array.from({length:7},(_,day)=>({day,open:0,close:1440,lastEntry:1380}));

test('Suyeong 20:22 KST / two hours / Ocean and Coffee: prioritize the known-open stop and reject both closed and unverified hours',()=>{
 const open=makePlace('open');
 const closed=makePlace('closed',{hours:friday(1080,1200,1170)});
 const unknown=makePlace('legacy-ocean',{category:'sea',hours:fakeAllDay,hoursStatus:undefined,priceStatus:undefined,costMin:0,costMax:0});
 const catalog=[closed,unknown,open];
 assert.equal(visitHoursStatus(unknown),'unknown');
 assert.match(itineraryHoursText(open,'en'),/Fri 18:00–22:00 \(last entry 21:00\)/);
 assert.match(itineraryHoursText(unknown,'en'),/Hours unverified/);
 assert.doesNotMatch(itineraryHoursText(unknown,'en'),/00:00|24:00/);
 assert.equal(calculate([closed.id],conditions,catalog),null);
 assert.equal(calculate([unknown.id],conditions,catalog),null);
 assert.equal(calculate([open.id],conditions,catalog).stops[0].hoursStatus,'published');
 assert.deepEqual(recommend(conditions,catalog).map(r=>r.stops.map(s=>s.placeId)),[[open.id]]);
 assert.deepEqual(recommend({...conditions,allowPlanningEstimates:false},catalog).map(r=>r.stops.map(s=>s.placeId)),[[open.id]]);
 assert.equal(recommendationResponse(conditions,[closed,unknown]).diagnostic,'hours_unverified_at_night');
 assert.equal(recommendationResponse({...conditions,mode:'selected',requiredPlaceIds:[unknown.id]},catalog).diagnostic,'hours_unverified_at_night');
});

test('daytime unknown-hours options need opt-in and may not extend into the night',()=>{
 const p=makePlace('unknown',{hoursStatus:'unknown',hours:[]});
 const c={...conditions,startAt:'2026-11-20T18:15:00+09:00'};
 assert.equal(calculate([p.id],{...c,allowPlanningEstimates:false},[p]),null);
 assert.equal(calculate([p.id],c,[p]).stops[0].hoursStatus,'unknown');
 assert.equal(calculate([p.id],{...c,startAt:'2026-11-20T19:12:00+09:00'},[p]),null);
 assert.equal(calculate([p.id],{...c,startAt:'2026-11-20T05:45:00+09:00'},[p]),null);
 const priced=makePlace('known');
 const free=makePlace('free',{...officialPricing({USAGE_AMOUNT:'무료'})});
 const unpriced=makePlace('unpriced',{...officialPricing({USAGE_AMOUNT:'문의'})});
 assert.ok(recommend(c,[p,unpriced,free,priced])[0].stops.every(s=>s.hoursStatus==='published'&&s.priceStatus!=='unknown'));
});

test('route costs separate published fees, confirmed free, partial and all-unknown without a false zero',()=>{
 const unknown=makePlace('unknown',{priceStatus:undefined,costMin:0,costMax:0});
 const free=makePlace('free',{...officialPricing({USAGE_AMOUNT:'무료'})});
 const paid=makePlace('paid');
 assert.equal(placePricing(unknown).unknown,true);
 assert.equal(placePricing(free).unknown,false);
 assert.equal(placePricing({...paid,costMin:0,costMax:0}).unknown,true);
 const c={...conditions,startAt:'2026-11-20T18:10:00+09:00',minutes:180};
 const r=ids=>calculate(ids,c,[unknown,free,paid]);
 assert.match(itineraryCostText(r([unknown.id]),'en').summary,/Total cost unknown/);
 assert.doesNotMatch(itineraryCostText(r([free.id,unknown.id]),'en').summary,/\b0\b|Free/i);
 const partial=itineraryCostText(r([unknown.id,paid.id]),'en');
 assert.match(partial.summary,/Known subtotal.*6,000 KRW/);
 assert.match(partial.warning,/1 unpriced stop excluded/);
 assert.match(itineraryCostText(r([free.id]),'en').summary,/No listed fees/);
 assert.match(itineraryCostText(r([paid.id]),'en').summary,/6,000 KRW/);
});

test('English itinerary displays exact source title, labels Korean fallbacks, and keeps IDs out of titles',()=>{
 assert.equal(itineraryPlaceTitle({ko:'광안리 해변',en:'Gwangalli Beach'},'en'),'Gwangalli Beach');
 assert.equal(itineraryPlaceTitle({ko:'광안리 해변',en:'광안리 해변'},'en'),'광안리 해변 (Korean name)');
 assert.equal(itineraryPlaceTitle({ko:'스타벅스 수영점',en:'Starbucks 수영점'},'en'),'스타벅스 수영점 (Korean name)');
 assert.equal(itineraryPlaceTitle({ko:'수영 카페'},'en'),'수영 카페 (Korean name)');
 assert.equal(itineraryPlaceTitle({ko:'광안리 해변',en:'Gwangalli Beach'},'ko'),'광안리 해변');
 assert.equal(itineraryPlaceTitle({},'en'),'Place name unavailable');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {Store,areas} from '../server/store.mjs';
import {syncTourismCatalog,ingestPublicContent} from '../server/tourism-catalog.mjs';
import {locationNeedsReview} from '../shared/location-quality.ts';

test('conflicting address districts are withheld and removed from previously imported route candidates',()=>{
 const store=new Store(),area=areas.find(a=>a.name.ko==='수영구');
 try {const item={UC_SEQ:90001,MAIN_TITLE:'검수 체험',ADDR1:'부산광역시 수영구 해변로 1',GUGUN_NM:'수영구',LAT:area.point.lat,LNG:area.point.lng};
 assert.equal(locationNeedsReview(item),false);ingestPublicContent(store,areas,'ocean',[item]);assert.ok(store.catalog().some(p=>p.id==='busan-ocean-90001'));
 const result=ingestPublicContent(store,areas,'ocean',[{...item,ADDR1:'부산광역시 사상구 삼락동 1'}]);assert.equal(result[0].locationNeedsReview,true);assert.equal(result[0].routePlaceId,null);assert.ok(!store.catalog().some(p=>p.id==='busan-ocean-90001'));
 assert.equal(locationNeedsReview({ADDR1:'부산광역시 사상구 삼락동',GUGUN_NM:'부산'}),false);
 assert.equal(locationNeedsReview({ADDR1:'수영구 광안리 해운대구 해변',GUGUN_NM:'수영구'}),true);
 }finally{store.close();}
});
import {calculate} from '../shared/engine.ts';
import {recommendationResponse} from '../server/recommendation.mjs';
import {koreaInput,koreaISO} from '../shared/korea-time.ts';
test('a stalled provider does not delay a second official provider with located places',{timeout:1000},async()=>{
 const store=new Store(),area=areas[1];try{await syncTourismCatalog(store,areas,async type=>type==='kor'?new Promise(()=>{}):{status:'ok',items:[{UC_SEQ:22,MAIN_TITLE:'공식 해양체험',GUGUN_NM:area.name.ko,LAT:area.point.lat,LNG:area.point.lng}]});assert.ok(store.catalog().some(p=>p.id==='busan-ocean-22'));}finally{store.close();}
});
test('Korea time inputs accept minute and second formats and reject invalid dates without crashing',()=>{
 assert.equal(koreaISO('2026-11-09T10:00'),'2026-11-09T01:00:00.000Z');assert.equal(koreaISO('2026-11-09T10:00:00'),'2026-11-09T01:00:00.000Z');assert.equal(koreaInput('2026-11-09T01:00:00.000Z'),'2026-11-09T10:00');assert.equal(koreaISO('2026-02-30T10:00'),'');assert.equal(koreaInput('invalid'),'');
});
test('a tourism-provider timeout keeps officially located marine places available without demo data',async()=>{
 const store=new Store(),area=areas[1],requested=[];
 try{await syncTourismCatalog(store,areas,async type=>{requested.push(type);return type==='kor'?{status:'temporarily_unavailable',items:[]}:{status:'ok',items:[{UC_SEQ:10,MAIN_TITLE:'공식 해양체험',ADDR1:area.name.ko+' 해변',GUGUN_NM:area.name.ko,LAT:area.point.lat,LNG:area.point.lng}]};});
 const places=store.catalog();assert.ok(requested.includes('kor')&&requested.includes('ocean'));assert.ok(places.some(p=>p.id==='busan-ocean-10'&&p.planningEstimate&&!p.sample));assert.ok(places.every(p=>!p.sample));
 }finally{store.close();}
});
test('undated real events never enter a route even when planning estimates are allowed',()=>{
 const store=new Store();try{const template=store.catalog()[0],p={...template,id:'unconfirmed-event',category:'event',sample:false,published:true,planningEstimate:true,availableUntil:undefined};
 const conditions={areaId:p.areaId,origin:p.point,minutes:240,budget:100000,interests:['event'],transport:'walk',companion:'solo',startAt:'2026-11-08T10:00:00+09:00',returnPoint:null,deadline:null,children:false,accessible:false,diet:'',tripStart:'',tripEnd:'',allowPlanningEstimates:true,requiredPlaceId:p.id};
 assert.equal(calculate([p.id],conditions,[p]),null);assert.equal(recommendationResponse(conditions,[p]).diagnostic,'selected_event_unconfirmed');
 }finally{store.close();}
});

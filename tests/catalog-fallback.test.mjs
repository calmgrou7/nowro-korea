import test from 'node:test';
import assert from 'node:assert/strict';
import {Store,areas} from '../server/store.mjs';
import {syncTourismCatalog} from '../server/tourism-catalog.mjs';
import {calculate} from '../shared/engine.ts';
import {recommendationResponse} from '../server/recommendation.mjs';
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

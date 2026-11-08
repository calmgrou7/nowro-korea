import test from 'node:test';
import assert from 'node:assert/strict';
import {Store,areas} from '../server/store.mjs';
import {ingestPublicContent} from '../server/tourism-catalog.mjs';
import {calculate} from '../shared/engine.ts';
test('public events retain route identity, district, period and explicit estimate opt-in',()=>{
 const store=new Store();
 try{
  const input={UC_SEQ:71,MAIN_TITLE:'행사',GUGUN_NM:'수영구',LAT:35.153,LNG:129.118,USAGE_DAY_WEEK_AND_TIME:'2026. 11. 8. ~ 11. 10.'};
  const [item]=ingestPublicContent(store,areas,'festivals',[input]);
  assert.equal(item.routePlaceId,'busan-festivals-71');
  ingestPublicContent(store,areas,'festivals',[input]);
  const place=store.catalog().find(p=>p.id===item.routePlaceId);
  assert.equal(store.catalog().filter(p=>p.id===item.routePlaceId).length,1);
  assert.equal(place.availableUntil,'2026-11-10');
  const c={areaId:place.areaId,origin:place.point,minutes:240,budget:100000,interests:['event'],transport:'walk',companion:'solo',startAt:'2026-11-09T10:00:00+09:00',returnPoint:null,deadline:null,children:false,accessible:false,diet:'',tripStart:'',tripEnd:''};
  assert.equal(calculate([place.id],c,[place]),null);
  assert.ok(calculate([place.id],{...c,allowPlanningEstimates:true},[place]));
  assert.equal(calculate([place.id],{...c,allowPlanningEstimates:true,startAt:'2026-11-11T10:00:00+09:00'},[place]),null);
  assert.equal(calculate([place.id],{...c,allowPlanningEstimates:true,startAt:'2026-11-07T10:00:00+09:00'},[place]),null);
  assert.equal(ingestPublicContent(store,areas,'festivals',[{...input,UC_SEQ:72,LAT:0}])[0].routePlaceId,undefined);
 }finally{store.close();}
});

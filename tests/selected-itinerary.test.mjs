import test from 'node:test';
import assert from 'node:assert/strict';
import {recommend,estimate} from '../shared/engine.ts';
import {places} from '../shared/catalog.ts';
test('chosen-stop mode compares every order without current location, time or budget filters',()=>{
 const ps=[0,1,2].map((n)=>({...places[0],id:'selected-'+n,point:{lat:35.1,lng:129+n*.05},published:true,planningEstimate:true,category:'culture',availableFrom:undefined,availableUntil:undefined}));
 const c={mode:'selected',areaId:ps[0].areaId,origin:{lat:37,lng:127},minutes:30,budget:0,interests:[],transport:'walk',companion:'solo',startAt:'2026-11-19T10:00:00+09:00',returnPoint:{lat:37,lng:127},deadline:'2026-11-19T10:01:00+09:00',children:false,accessible:false,diet:'',tripStart:'',tripEnd:'',allowPlanningEstimates:true,requiredPlaceIds:ps.map(p=>p.id)};
 const [r]=recommend(c,ps);assert.ok(r);assert.equal(r.stops.length,3);assert.equal(r.stops[0].travel,0);assert.equal(r.returnMinutes,0);
 assert.equal(r.stops.reduce((n,s)=>n+s.travel,0),estimate(ps[0].point,ps[1].point,'walk')+estimate(ps[1].point,ps[2].point,'walk'));
 assert.deepEqual(recommend({...c,mode:'recommended'},ps),[]);
 assert.deepEqual(recommend(c,ps.map(p=>({...p,availableUntil:'2020-01-01'}))),[]);
});

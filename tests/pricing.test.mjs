import test from 'node:test';
import assert from 'node:assert/strict';
import {officialPricing,placePricing} from '../shared/pricing.ts';
import {calculate} from '../shared/engine.ts';
import {places} from '../shared/catalog.ts';
test('dedicated official fee fields separate free, published prices and unknown conditions',()=>{
 assert.equal(officialPricing({USAGE_AMOUNT:'무료'}).priceStatus,'free');
 assert.equal(officialPricing({pay_at:'N'}).priceStatus,'free');
 assert.equal(officialPricing({pay_at:'Y'}).priceStatus,'unknown');
 const price=officialPricing({pcseguidance:'R석 50,000원, S석 30,000원'});
 assert.equal(price.costMin,30000);assert.equal(price.costMax,50000);
 for(const text of ['', '일부 무료','성인 20,000원, 어린이 무료','10,000원부터','2인 패키지 50,000원','문의','5,000원 / 시간','성인 1.5만원'])assert.equal(officialPricing({USAGE_AMOUNT:text}).priceStatus,'unknown',text);
 assert.equal(officialPricing({ITEMCNTNTS:'무료 전시'}).priceStatus,'unknown');
 assert.equal(placePricing({planningEstimate:true,costMin:0,costMax:20000}).unknown,true);
});
test('unknown fees are excluded from subtotal and surfaced rather than treated as verified free',()=>{
 const p={...places[0],sample:false,category:'culture',planningEstimate:true,priceStatus:'unknown',costMax:20000};
 const c={areaId:p.areaId,origin:p.point,minutes:360,budget:0,interests:['culture'],transport:'walk',companion:'solo',startAt:'2026-11-19T10:00:00+09:00',returnPoint:null,deadline:null,children:false,accessible:false,diet:'',tripStart:'',tripEnd:'',allowPlanningEstimates:true};
 const r=calculate([p.id],c,[p]);assert.ok(r);assert.equal(r.costMax,0);assert.equal(r.unknownPriceCount,1);assert.equal(r.stops[0].priceStatus,'unknown');
 assert.equal(calculate([p.id],c,[{...p,...officialPricing({USAGE_AMOUNT:'20,000원'})}]),null);
 const free=calculate([p.id],c,[{...p,...officialPricing({USAGE_AMOUNT:'무료'})}]);assert.equal(free.unknownPriceCount,0);
 const paid=calculate([p.id],{...c,budget:30000,transport:'transit',origin:{lat:p.point.lat+.01,lng:p.point.lng}},[{...p,...officialPricing({USAGE_AMOUNT:'20,000원'})}]);
 assert.equal(paid.venueCostMax,20000);assert.equal(paid.transportCost,3000);assert.equal(paid.costMax,23000);
});

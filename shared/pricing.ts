export type Pricing = { priceStatus: 'free'|'published'|'unknown'; priceText: string; costMin: number; costMax: number };
// Parse only dedicated fee fields. Conditional/group/package prices need human review.
export function officialPricing(item: Record<string, unknown>): Pricing {
 const priceText=String(item.USAGE_AMOUNT||item.pcseguidance||item.usefee||item.usetimefestival||'').replace(/<[^>]*>/g,' ').replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim().slice(0,2000);
 const unknown:Pricing={priceStatus:'unknown',priceText,costMin:0,costMax:0};
 if(!priceText && item.pay_at==='N')return {...unknown,priceStatus:'free',priceText:'무료'};
 if(!priceText && item.pay_at==='Y')return {...unknown,priceText:'유료 · 금액 미제공'};
 if(/^(?:무료|무료입장|입장료\s*무료|관람료\s*무료|전석\s*무료|free|free admission|0\s*원)[.!]?$/i.test(priceText))return {...unknown,priceStatus:'free'};
 if(!priceText||/무료|할인|부터|이상|별도|문의|단체|패키지|대여|시간당|시간 당|인 기준|인권|변동|free|discount|from|group|package/i.test(priceText))return unknown;
 const amounts=[...priceText.matchAll(/(?<![\d.,])(?:\d{1,3}(?:,\d{3})+|\d+)\s*원/g)].map(m=>Number(m[0].replace(/[^\d]/g,'')));
 const remainder=priceText.replace(/(?:\d{1,3}(?:,\d{3})+|\d+)\s*원/g,'').replace(/VIP석|[RSAB]석|전석|성인|일반|대인|청소년|어린이|소인|입장료|관람료|이용료|티켓|가격|요금|좌석/gi,'').replace(/[\s:：,;/()\[\]~–—-]/g,'');
 if(remainder||!amounts.some(n=>n>0)||amounts.some(n=>!Number.isFinite(n)||n<0||n>10000000))return unknown;
 return {priceStatus:'published',priceText,costMin:Math.min(...amounts),costMax:Math.max(...amounts)};
}
export type PriceEvidence = {planningEstimate?:boolean;sample?:boolean;priceStatus?:string;costMin:number;costMax:number};
export function placePricing(p: PriceEvidence) {
 const valid=Number.isFinite(p.costMin)&&Number.isFinite(p.costMax)&&p.costMin>=0&&p.costMax>=p.costMin;
 const known=valid&&(p.priceStatus==='free'?p.costMax===0:p.priceStatus==='published'?p.costMax>0:!p.priceStatus&&p.sample===true&&!p.planningEstimate);
 return {unknown:!known,costMin:known?p.costMin:0,costMax:known?p.costMax:0};
}

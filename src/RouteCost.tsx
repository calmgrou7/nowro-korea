import type {Route} from '../shared/types';
import {visitorText} from './visitor-copy';
import {placePricing, type PriceEvidence} from '../shared/pricing';
import {costRange,itineraryCostDetails,itineraryCostText} from './itinerary-display';
export function feeLabel(p:PriceEvidence,lang:string){
 if(placePricing(p).unknown)return visitorText(lang,'요금 미확인','Price unverified');
 if(p.priceStatus==='free')return visitorText(lang,'무료 · 공식 안내','Free · official listing');
 if(p.sample&&p.costMax===0)return visitorText(lang,'샘플 · 요금 미확인','Sample · price unverified');
 return costRange(p.costMin,p.costMax);
}
export function RouteCost({route:r,lang,detail=false}:{route:Route;lang:string;detail?:boolean}){
 const t=(ko:string,en:string)=>visitorText(lang,ko,en);
 const c=itineraryCostDetails(r), text=itineraryCostText(r,lang);
 if(!c)return <span>{text.summary}</span>;
 return <div className="route-cost-summary">
  <strong>{text.summary}</strong>
  {text.warning&&<p role="status">{text.warning}</p>}
  {detail&&<><p>{t('장소 요금','Venue fees')}: {c.venueMax>0?costRange(c.venueMin,c.venueMax):c.unknown?t('미확인 요금 있음','Some fees unknown'):t('확인된 장소 요금 없음','No listed venue fees')}{c.venueMax>0&&c.unknown>0&&` · ${t('미확인 요금 제외','excludes unpriced stops')}`}</p>
   <p>{t('예상 이동비','Estimated transport')}: {c.transport>0?`${costRange(c.transport,c.transport)} · ${t('실제 운임 조회 아님','not a live fare quote')}`:t('예상 이동비 없음','No estimated transport charge')}</p></>}
 </div>;
}

import type {Route} from '../shared/types';
import {visitorText} from './visitor-copy';
import {placePricing} from '../shared/pricing';
const won=(n:number)=>new Intl.NumberFormat('ko-KR').format(n)+' KRW';
export function feeLabel(p:{planningEstimate?:boolean;priceStatus?:string;costMin:number;costMax:number},lang:string){
 if(placePricing(p).unknown)return visitorText(lang,'요금 미확인','Price unverified');
 if(p.priceStatus==='free')return visitorText(lang,'무료 · 공식 안내','Free · official listing');
 return p.costMin===p.costMax?won(p.costMax):`${won(p.costMin)}–${won(p.costMax)}`;
}
export function RouteCost({route:r,lang,detail=false}:{route:Route;lang:string;detail?:boolean}){
 const t=(ko:string,en:string)=>visitorText(lang,ko,en);
 if(r.unknownPriceCount===undefined)return <span>{t('이전 계산 금액 · 코스를 다시 계산해주세요','Previous estimate · recalculate this route')}</span>;
 return <div className="route-cost-summary">
  <strong>{t('확인 요금 + 예상 이동비','Listed fees + estimated transport')}: {r.costMin===r.costMax?won(r.costMax):`${won(r.costMin)}–${won(r.costMax)}`}</strong>
  {!!r.unknownPriceCount&&<p role="status">{t(`요금 미확인 ${r.unknownPriceCount}곳 별도 · 예산 내 방문 보장 아님`,`${r.unknownPriceCount} unpriced stops excluded · budget not guaranteed`)}</p>}
  {detail&&<><p>{t('장소 요금','Venue fees')}: {won(r.venueCostMin||0)}–{won(r.venueCostMax||0)} · {t('미확인 요금 제외','excludes unpriced stops')}</p>
   <p>{t('예상 이동비','Estimated transport')}: {won(r.transportCost)} · {t('실제 운임 조회 아님','not a live fare quote')}</p></>}
 </div>;
}

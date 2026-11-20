import type { Lang, Localized, Place, Route } from '../shared/types.ts';
import { placePricing } from '../shared/pricing.ts';
import { validVisitWindows, visitHoursStatus } from '../shared/visit-hours.ts';

const hasHangul = (text: string) => /\p{Script=Hangul}/u.test(text);

// Source/provider-supplied names are used as-is. Never invent or romanize a place name.
export function itineraryPlaceTitle(name: Partial<Localized>, lang: Lang) {
  const ko = name.ko?.trim() || '';
  const en = name.en?.trim() || '';
  if (lang !== 'en') return name[lang]?.trim() || en || ko || (lang === 'ko' ? '장소 이름 확인 필요' : 'Place name unavailable');
  if (en && !hasHangul(en)) return en;
  const source = ko || en;
  if (!source) return 'Place name unavailable';
  return `${source} (${hasHangul(source) ? 'Korean name' : 'source name'})`;
}

export function itineraryHoursText(place: Place, lang: Lang) {
  const status=visitHoursStatus(place), ko=lang==='ko';
  if(status==='unknown')return ko?'운영시간 미확인 · 방문 전 확인':'Hours unverified · confirm before visiting';
  if(status==='sample')return ko?'샘플 운영시간 · 실제 운영 미확인':'Sample hours · not confirmed';
  const minute=(value:number)=>`${String(Math.floor(value/60)).padStart(2,'0')}:${String(value%60).padStart(2,'0')}`;
  const weekdays=ko?['일','월','화','수','목','금','토']:['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const groups=new Map<string,Set<number>>();
  for (const h of validVisitWindows(place)) {
    const range=`${minute(h.open)}–${minute(h.close)}${h.lastEntry<h.close?` (${ko?'마지막 입장':'last entry'} ${minute(h.lastEntry)})`:''}`;
    if(!groups.has(range))groups.set(range,new Set());
    groups.get(range)!.add(h.day);
  }
  return [...groups].map(([range,days])=>`${days.size===7?(ko?'매일':'Daily'):[...days].sort().map(d=>weekdays[d]).join(', ')} ${range}`).join(' · ');
}

export function itineraryCostDetails(route: Route) {
  if (route.unknownPriceCount === undefined || !Number.isFinite(route.transportCost) || route.transportCost < 0) return null;
  const prices = route.stops.map(s => placePricing({...s, sample:s.sample ?? route.sample}));
  const unknown = Math.max(route.unknownPriceCount, prices.filter(p => p.unknown).length);
  const venueMin = prices.reduce((sum,p) => sum + p.costMin, 0);
  const venueMax = prices.reduce((sum,p) => sum + p.costMax, 0);
  return {unknown, venueMin, venueMax, transport:route.transportCost, min:venueMin+route.transportCost,max:venueMax+route.transportCost};
}

const won = (n:number) => new Intl.NumberFormat('ko-KR').format(n)+' KRW';
export const costRange = (min:number,max:number) => min===max?won(max):`${won(min)}–${won(max)}`;

export function itineraryCostText(route: Route, lang: string) {
  const t=(ko:string,en:string)=>lang==='ko'?ko:en;
  const costs=itineraryCostDetails(route);
  if(!costs)return {summary:t('이전 계산 금액 · 코스를 다시 계산해주세요','Previous estimate · recalculate this route'),warning:''};
  const {unknown,min,max}=costs;
  const warning=unknown?t(`요금 미확인 ${unknown}곳 별도 · 예산 내 방문 보장 아님`,`${unknown} unpriced ${unknown===1?'stop':'stops'} excluded · budget not guaranteed`):'';
  if(unknown&&max===0)return {summary:t('총비용 미확인','Total cost unknown'),warning};
  if(unknown)return {summary:`${t('확인 요금 + 예상 이동비 소계','Known subtotal: listed fees + estimated transport')}: ${costRange(min,max)}`,warning};
  if(max===0)return {summary:t('확인된 요금 및 예상 이동비 없음','No listed fees or estimated transport charges'),warning};
  return {summary:`${t('확인 요금 + 예상 이동비','Listed fees + estimated transport')}: ${costRange(min,max)}`,warning};
}

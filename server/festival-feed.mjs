import {distinctEvents} from '../shared/event-identity.ts';
const date=v=>/^\d{8}$/.test(String(v))?`${String(v).slice(0,4)}-${String(v).slice(4,6)}-${String(v).slice(6,8)}`:'';
export function normalizeTourFestival(x){
 const address=String(x.addr1||'');
 return {UC_SEQ:'tour-ko-'+x.contentid,ktoContentId:String(x.contentid),MAIN_TITLE:x.title,
 ADDR1:address,MAIN_PLACE:x.addr2||x.title,GUGUN_NM:address.match(/(?:부산광역시|부산)\s+(\S+[구군])(?:\s|$)/)?.[1]||'',
 LAT:x.mapy,LNG:x.mapx,MAIN_IMG_NORMAL:x.firstimage||x.firstimage2||'',
 eventStart:date(x.eventstartdate),eventEnd:date(x.eventenddate),
 USAGE_DAY_WEEK_AND_TIME:[date(x.eventstartdate),date(x.eventenddate)].filter(Boolean).join(' – '),
 ITEMCNTNTS:'',CNTCT_TEL:x.tel||'',sourceLabel:'한국관광공사 TourAPI',sourceUrl:'https://www.data.go.kr/data/15101578/openapi.do'};
}
export async function tourFestivals(key,{fetcher=fetch,now=new Date()}={}){
 if(!key)return {items:[],status:'not_configured'};
 const rows=[];
 for(let page=1;page<=5;page++){
  const query=new URLSearchParams({serviceKey:key.trim(),MobileOS:'ETC',MobileApp:'NOWRO',_type:'json',numOfRows:'100',pageNo:String(page),eventStartDate:String(now.getUTCFullYear()-1)+'0101',lDongRegnCd:'26'});
  const response=await fetcher('https://apis.data.go.kr/B551011/KorService2/searchFestival2?'+query,{signal:AbortSignal.timeout(12000)});
  if(!response.ok)throw Error('TOUR_FESTIVAL_UNAVAILABLE');
  const payload=await response.json(),header=payload.response?.header,body=payload.response?.body;
  if(!['00','0000'].includes(String(header?.resultCode)))throw Error('TOUR_FESTIVAL_REJECTED');
  const raw=body?.items?.item,items=Array.isArray(raw)?raw:raw&&typeof raw==='object'?[raw]:[];
  rows.push(...items.filter(x=>x.contentid&&x.title).map(normalizeTourFestival));
  if(!items.length||page*100>=Number(body.totalCount||0))return {items:rows,status:'ok',partial:false};
 }
 return {items:rows,status:'ok',partial:true};
}
export async function combinedFestivals(loadBusan,key,options={}){
 const results=await Promise.allSettled([tourFestivals(key,options),loadBusan()]);
 const feeds=results.filter(r=>r.status==='fulfilled').map(r=>r.value);
 if(!feeds.some(f=>f.status==='ok'))throw Error('FESTIVAL_PROVIDERS_UNAVAILABLE');
 const items=distinctEvents(feeds.flatMap(f=>f.items||[]));
 items.sort((a,b)=>String(a.eventStart||'9999').localeCompare(String(b.eventStart||'9999')));
 return {items,status:'ok',partial:results.some(r=>r.status==='rejected')||feeds.some(f=>f.status!=='ok'||f.partial),updatedAt:new Date().toISOString()};
}

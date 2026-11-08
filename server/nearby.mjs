import { distance } from '../shared/engine.ts';
import { ingestTourismPlaces } from './tourism-catalog.mjs';
const cache = new Map();
export async function nearbyShops(store, areas, lat, lng) {
 if(!Number.isFinite(lat)||!Number.isFinite(lng)||lat<34||lat>36||lng<128||lng>130) return {items:[],status:'location_unavailable'};
 const key=lat.toFixed(3)+','+lng.toFixed(3);
 if(cache.has(key)&&Date.now()-cache.get(key).at<3600000) {const items=cache.get(key).items; ingestTourismPlaces(store,areas,items);return {items,status:'ok'};}
 const token=process.env.KTO_KOREAN_API_KEY;
 if(!token)return {items:[],status:'not_configured'};
 const results=await Promise.allSettled(['39','38','28'].map(async contentTypeId=>{
  const query=new URLSearchParams({serviceKey:token,MobileOS:'ETC',MobileApp:'NOWRO',_type:'json',pageNo:'1',numOfRows:'50',mapX:String(lng),mapY:String(lat),radius:'2000',contentTypeId,arrange:'E'});
  const response=await fetch('https://apis.data.go.kr/B551011/KorService2/locationBasedList2?'+query,{signal:AbortSignal.timeout(12000)});
  if(!response.ok)throw Error('NEARBY_UNAVAILABLE');
  const value=await response.json();if(!['0000','00'].includes(String(value.response?.header?.resultCode)))throw Error('NEARBY_UNAVAILABLE');
  const rows=value.response?.body?.items?.item||[];return Array.isArray(rows)?rows:[rows];
 }));
 const rows=results.flatMap(r=>r.status==='fulfilled'?r.value:[]).filter(p=>p.title&&Number(p.mapy)&&Number(p.mapx)).map(p=>({...p,distanceKm:distance({lat,lng},{lat:Number(p.mapy),lng:Number(p.mapx)})})).filter(p=>p.distanceKm<=2).sort((a,b)=>a.distanceKm-b.distanceKm);
 const group=p=>String(p.contenttypeid)==='28'?'experience':String(p.contenttypeid)==='38'?'shopping':p.cat3==='A05020900'?'cafe':'food';
 const items=['food','cafe','shopping','experience'].flatMap(type=>rows.filter(p=>group(p)===type).slice(0,8)).sort((a,b)=>a.distanceKm-b.distanceKm);
 ingestTourismPlaces(store,areas,items);
 if(results.every(r=>r.status==='fulfilled')){if(cache.size>=100)cache.delete(cache.keys().next().value);cache.set(key,{at:Date.now(),items});}
 return {items,status:results.some(r=>r.status==='fulfilled')?'ok':'temporarily_unavailable',partial:results.some(r=>r.status==='rejected')};
}

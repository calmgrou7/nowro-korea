import { useEffect, useState } from 'react';
import { api } from './api';
import { savePlace, readSavedPlaces } from './SavedPlaces';
export function NearbyShops({item,lang,onPlan}:{item:any;lang:string;onPlan?:(item:any)=>void}){
 const lat=Number(item.mapy||item.LAT),lng=Number(item.mapx||item.LNG);
 const [items,setItems]=useState<any[]>([]),[status,setStatus]=useState('loading'),[saved,setSaved]=useState<string[]>(()=>readSavedPlaces().map(p=>String(p.UC_SEQ||p.contentid)));
 useEffect(()=>{const update=()=>setSaved(readSavedPlaces().map(p=>String(p.UC_SEQ||p.contentid)));window.addEventListener('nowro-saved',update);return()=>window.removeEventListener('nowro-saved',update);},[]);
 const [filter,setFilter]=useState('all');
 const group=(p:any)=>String(p.contenttypeid)==='38'?'shopping':p.cat3==='A05020900'?'cafe':'food';
 const visible=items.filter(p=>filter==='all'||group(p)===filter);
 const L=(ko:string,en:string)=>lang==='ko'?ko:en;
 useEffect(()=>{let active=true;setItems([]);setStatus('loading');if(!lat||!lng){setStatus('location_unavailable');return;}api('nearby?lat='+lat+'&lng='+lng).then(v=>{if(active){setItems(v.items||[]);setStatus(v.status);}}).catch(()=>{if(active)setStatus('temporarily_unavailable');});return()=>{active=false;};},[lat,lng]);
 return <section className="nearby-shops"><h3>{L('근처 맛집·카페·쇼핑','Nearby food, cafés and shopping')}</h3><p className="muted">{L('반경 2km · 직선거리 기준 · 영업상태 및 판매 상품은 미확인입니다.','Within 2 km, straight-line distance. Opening status and product availability are unverified.')}</p>
 <div className="quick-categories">{[['all','전체','All'],['food','음식점','Dining'],['cafe','카페·찻집','Cafés'],['shopping','쇼핑','Shopping']].map(([id,ko,en])=><button key={id} aria-pressed={filter===id} onClick={()=>setFilter(id)}>{L(ko,en)}</button>)}</div>
 {status==='loading'?<p role="status">{L('주변 장소를 찾고 있습니다.','Finding nearby places…')}</p>:status!=='ok'?<p>{L('주변 정보를 확인할 수 없습니다. 지도에서 확인해주세요.','Nearby information is unavailable. Please check the map.')}</p>:!visible.length?<p>{L('현재 제공된 주변 상점 정보가 없습니다.','No nearby shop information available.')}</p>:<div className="nearby-shop-list">{visible.map(p=>{const entry={...p,UC_SEQ:'nearby-'+p.contentid,routePlaceId:'kto-'+p.contentid,MAIN_TITLE:p.title,SUBTITLE:p.addr1,MAIN_IMG_NORMAL:p.firstimage};return <article key={p.contentid}><h4>{p.title}</h4><p>{p.addr1}</p><small>{Math.round(p.distanceKm*1000)}m · {group(p)==='shopping'?L('쇼핑 장소','Shopping'):group(p)==='cafe'?L('카페·전통찻집','Café / tea house'):L('음식점','Dining')}</small><div className="tourism-actions"><button aria-pressed={saved.includes(String(entry.UC_SEQ))} aria-label={saved.includes(String(entry.UC_SEQ))?L('저장 취소','Unsave place'):L('장소 저장','Save place')} onClick={()=>savePlace(entry)}>{saved.includes(String(entry.UC_SEQ))?L('저장됨 ✓','Saved ✓'):L('저장','Save')}</button>{onPlan&&<button onClick={()=>onPlan(entry)}>{L('코스 포함','Add to route')}</button>}</div><a href={'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(p.addr1||p.title)} target="_blank" rel="noreferrer">{L('지도 보기','View map')} ↗</a></article>})}</div>}
 <small className="muted">{L('출처: 한국관광공사 · 공식 업종 분류 기준','Source: Korea Tourism Organization · official category codes')}</small></section>;
}

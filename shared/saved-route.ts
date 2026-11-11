import type {Place} from './types';
import {eventExpired} from './event-dates.ts';
import {locationNeedsReview} from './location-quality.ts';
export function savedRouteStatus(item:any,places:Place[],now=new Date()):{place?:Place;reason:'ended'|'location'|'schedule'|'unavailable'|null} {
 if(eventExpired(item,now))return {reason:'ended'};
 if(item.locationNeedsReview||locationNeedsReview(item))return {reason:'location'};
 const legacy=String(item.UC_SEQ||'').match(/^(festivals|ocean|exhibitions)-(\d+)$/);
 const ids=[item.routePlaceId,item.contentid?'kto-'+item.contentid:null,item.kopisId?'kopis-'+item.kopisId:null,legacy?'busan-'+legacy[1]+'-'+legacy[2]:null,item.UC_SEQ].filter(Boolean);
 const place=places.find(p=>ids.includes(p.id)&&p.published!==false);
 if(!place)return {reason:'unavailable'};
 if(!Number.isFinite(place.point?.lat)||!Number.isFinite(place.point?.lng)||place.point.lat<34||place.point.lat>36||place.point.lng<128||place.point.lng>130)return {reason:'location'};
 if(place.availableUntil&&place.availableUntil<new Date(now.getTime()+9*3600000).toISOString().slice(0,10))return {reason:'ended'};
 if(place.category==='event'&&!place.availableUntil)return {reason:'schedule'};
 return {place,reason:null};
}

import { useState } from 'react';
import { MapPin, Copy } from 'lucide-react';
import { visitorText } from './visitor-copy';
export function PlaceMaps({item,lang}:{item:any;lang:string}) {
 const [copied,setCopied]=useState(false);
 const title=item.MAIN_TITLE||item.title||item.name?.ko||'';
 const address=item.SUBTITLE||item.addr1||item.ADDR1||item.address||'';
 const lat=Number(item.LAT||item.mapy||item.point?.lat),lng=Number(item.LNG||item.mapx||item.point?.lng);
 const located=Number.isFinite(lat)&&Number.isFinite(lng)&&lat>=34&&lat<=39&&lng>=124&&lng<=132;
 const search=[title,address].filter(Boolean).join(' ');
 return <div className="place-map-links">
  <a className="action-link" href={'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(located?`${lat},${lng}`:search)} target="_blank" rel="noreferrer"><MapPin size={16}/>Google Maps ↗</a>
  <a className="action-link" href={'https://map.naver.com/p/search/'+encodeURIComponent(search)} target="_blank" rel="noreferrer"><MapPin size={16}/>Naver Map ↗</a>
  {address && <button className="action-link" onClick={()=>navigator.clipboard.writeText(address).then(()=>setCopied(true)).catch(()=>setCopied(false))}><Copy size={16}/>{visitorText(lang,copied?'주소가 복사되었습니다':'주소 복사',copied?'Address copied':'Copy address')}</button>}
  <span className="sr-only" role="status">{copied?visitorText(lang,'주소가 복사되었습니다','Address copied'):''}</span>
 </div>;
}

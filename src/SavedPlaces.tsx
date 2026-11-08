import { useEffect, useState } from 'react';
const KEY = 'nowro-saved-places-v1';
export function readSavedPlaces(): any[] { try { const value = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(value) ? value : []; } catch { return []; } }
// Bookmark buttons toggle membership and notify every visible saved-place view.
export function savePlace(item: any) { const id = String(item.UC_SEQ || item.contentid); const current = readSavedPlaces(); const exists = current.some(p => String(p.UC_SEQ || p.contentid) === id); const next = current.filter(p => String(p.UC_SEQ || p.contentid) !== id); localStorage.setItem(KEY, JSON.stringify(exists ? next : [...next, item])); window.dispatchEvent(new Event('nowro-saved')); }
export function SavedPlaces({lang, onPlan}: {lang:string; onPlan:(items:any[])=>void}) {
 const [items,setItems] = useState<any[]>(readSavedPlaces); const [checked,setChecked] = useState<string[]>([]);
 useEffect(() => { const update=()=>{const next=readSavedPlaces();setItems(next);setChecked(v=>v.filter(id=>next.some(p=>String(p.UC_SEQ||p.contentid)===id)));}; window.addEventListener('nowro-saved',update); return ()=>window.removeEventListener('nowro-saved',update); },[]);
 const L=(ko:string,en:string)=>lang==='ko'?ko:en;
 return <section className="panel"><h2>{L('저장한 장소로 나만의 코스 만들기','Create a route from your saved places')}</h2><p className="muted">{L('이 기기에 저장됩니다. 같은 지역의 장소를 최대 4개 선택해 코스를 만드세요.','Saved on this device. Select up to four places in the same district for a route.')}</p>
 {!items.length && <p>{L('탐색에서 마음에 드는 장소나 행사를 저장해주세요.','Save a place or event from Explore.')}</p>}
 {items.map(item=>{const id=String(item.UC_SEQ||item.contentid); return <div className="saved-place-row" key={id}><label><input type="checkbox" checked={checked.includes(id)} onChange={e=>setChecked(v=>e.target.checked ? [...v,id] : v.filter(x=>x!==id))}/><span><strong>{item.MAIN_TITLE||item.title}</strong><small>{item.SUBTITLE||item.ADDR1||item.addr1}</small></span></label><button className="text-btn" onClick={()=>{localStorage.setItem(KEY,JSON.stringify(items.filter(x=>String(x.UC_SEQ||x.contentid)!==id))); setChecked(v=>v.filter(x=>x!==id)); window.dispatchEvent(new Event('nowro-saved'));}}>{L('삭제','Remove')}</button></div>})}
 <button className="primary" disabled={!checked.length||checked.length>4} onClick={()=>onPlan(items.filter(x=>checked.includes(String(x.UC_SEQ||x.contentid))))}>{L('선택한 장소로 코스 만들기','Plan with selected places')} ({checked.length}/4)</button></section>;
}

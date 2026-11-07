import { useEffect, useState } from 'react';
import { api } from './api';
export function OfficialPlaces({ lang }: { lang: string }) {
  const [items, setItems] = useState<any[]>([]);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  useEffect(() => { let active = true; setItems([]); setLoading(true); setFailed(false); api('openapi/' + (lang === 'ko' ? 'kor' : 'eng')).then(v => { if(active) { setItems(Array.isArray(v.items) ? v.items : []); setFailed(v.status === 'temporarily_unavailable'); } }).catch(() => { if(active) setFailed(true); }).finally(() => { if(active) setLoading(false); }); return () => { active = false; }; }, [lang]);
  return <section className="data-sources"><h2>{lang === 'ko' ? '부산 공식 관광정보' : 'Explore Busan'}</h2>
    <p>{lang === 'ko' ? '출처: 한국관광공사' : 'Source: Korea Tourism Organization'}</p>
    {loading && <p role="status">{lang === 'ko' ? '관광정보를 불러오는 중입니다.' : 'Loading places…'}</p>}
    {failed && <p role="status">{lang === 'ko' ? '정보를 불러오지 못했습니다. 잠시 후 다시 방문해주세요.' : 'Information is temporarily unavailable.'}</p>}
    <div className="source-grid">{items.map((original) => { const item = { ...original, UC_SEQ: original.contentid, MAIN_TITLE: original.title, SUBTITLE: original.addr1, MAIN_IMG_NORMAL: original.firstimage, ITEMCNTNTS: original.addr2 }; return <article className="source-card" key={item.UC_SEQ}>
      {/^https?:\/\//.test(item.MAIN_IMG_NORMAL || '') ? <img src={item.MAIN_IMG_NORMAL.replace(/^http:\/\/tong.visitkorea.or.kr\//, 'https://tong.visitkorea.or.kr/')} alt={item.MAIN_TITLE || item.TITLE} loading="lazy" onError={e => { e.currentTarget.style.display = 'none'; }} style={{ width: '100%', aspectRatio: '16/10', objectFit: 'cover', borderRadius: 10 }} /> : <span className="muted">{lang === 'ko' ? '공식 제공 사진 없음' : 'No official photo available'}</span>}
      <h3>{item.MAIN_TITLE || item.TITLE}</h3><p>{item.SUBTITLE || item.PLACE}</p>
      {item.ITEMCNTNTS && <p>{item.ITEMCNTNTS}</p>}
      <a href={'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(original.addr1 || original.title)} target="_blank" rel="noreferrer">{lang === 'ko' ? '지도에서 보기' : 'View on map'} ↗</a>
    </article>; })}</div></section>;
}

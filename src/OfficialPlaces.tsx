import { useEffect, useState } from 'react';
import { api } from './api';
export function OfficialPlaces({ lang }: { lang: string }) {
  const [items, setItems] = useState<any[]>([]);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('places');
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(6);
  const [retry, setRetry] = useState(0);
  useEffect(() => { setQuery(''); setLimit(6); }, [category, lang]);
  const matched = items.filter(item => [item.title, item.MAIN_TITLE, item.addr1, item.ADDR1, item.GUGUN_NM, item.PLACE].join(' ').toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  useEffect(() => { let active = true; setItems([]); setLoading(true); setFailed(false); api('openapi/' + (category === 'places' ? (lang === 'ko' ? 'kor' : 'eng') : category)).then(v => { if(active) { setItems(Array.isArray(v.items) ? v.items : []); setFailed(v.status === 'temporarily_unavailable'); } }).catch(() => { if(active) setFailed(true); }).finally(() => { if(active) setLoading(false); }); return () => { active = false; }; }, [lang, category, retry]);
  return <section className="data-sources"><h2>{lang === 'ko' ? '부산 공식 관광정보' : 'Explore Busan'}</h2>
    <div className="quick-categories">{[['places','관광지','Places'],['foodie','푸디투어','Food tours'],['ocean','체험','Experiences'],['festivals','축제 안내','Festival guide']].map(([id,ko,en]) => <button key={id} aria-pressed={category === id} onClick={() => setCategory(id)}>{lang === 'ko' ? ko : en}</button>)}</div>
    <p>{category === 'places' ? (lang === 'ko' ? '출처: 한국관광공사' : 'Source: Korea Tourism Organization') : (lang === 'ko' ? '출처: 부산광역시 · 공식 원문' : 'Source: Busan Metropolitan City · Korean original')}</p>
    {category === 'festivals' && <p className="notice">{lang === 'ko' ? '축제 소개 자료입니다. 지난 연도 일정이 포함될 수 있으므로 올해 개최 일정은 주최기관에서 확인해주세요.' : 'Festival reference guide. Dates may refer to past editions; confirm current dates with the organizer.'}</p>}
    {loading && <p role="status">{lang === 'ko' ? '관광정보를 불러오는 중입니다.' : 'Loading places…'}</p>}
    <label>{lang === 'ko' ? '이 목록에서 장소·지역 찾기' : 'Find a place or neighborhood in this list'}<input type="search" value={query} onChange={e => { setQuery(e.target.value); setLimit(6); }} /></label>
    {failed && <div role="status"><p>{lang === 'ko' ? '정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.' : 'Information is temporarily unavailable. Please try again shortly.'}</p><button onClick={() => setRetry(v => v + 1)}>{lang === 'ko' ? '다시 불러오기' : 'Try again'}</button></div>}
    {!loading && !failed && !items.length && <p>{lang === 'ko' ? '현재 제공된 정보가 없습니다.' : 'No information is currently available.'}</p>}
    {!loading && items.length > 0 && !matched.length && <p role="status">{lang === 'ko' ? '검색 결과가 없습니다.' : 'No matching places.'}</p>}
    <div className="source-grid">{matched.slice(0, limit).map((original) => { const item = { ...original, UC_SEQ: original.contentid || original.UC_SEQ, MAIN_TITLE: original.title || original.MAIN_TITLE, SUBTITLE: original.addr1 || original.ADDR1 || original.PLACE, MAIN_IMG_NORMAL: original.firstimage || original.MAIN_IMG_NORMAL, ITEMCNTNTS: original.ITEMCNTNTS || original.addr2 }; return <article className="source-card" key={item.UC_SEQ}>
      {/^https?:\/\//.test(item.MAIN_IMG_NORMAL || '') ? <img src={item.MAIN_IMG_NORMAL.replace(/^http:\/\/tong.visitkorea.or.kr\//, 'https://tong.visitkorea.or.kr/')} alt={item.MAIN_TITLE || item.TITLE} loading="lazy" onError={e => { e.currentTarget.style.display = 'none'; }} style={{ width: '100%', aspectRatio: '16/10', objectFit: 'cover', borderRadius: 10 }} /> : <span className="muted">{lang === 'ko' ? '공식 제공 사진 없음' : 'No official photo available'}</span>}
      <h3>{item.MAIN_TITLE || item.TITLE}</h3><p>{item.SUBTITLE || item.PLACE}</p>
      {item.ITEMCNTNTS && <details><summary>{lang === 'ko' ? '소개 보기' : 'Read description'}</summary><p>{item.ITEMCNTNTS}</p></details>}
      <a href={'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(item.SUBTITLE || item.MAIN_TITLE)} target="_blank" rel="noreferrer">{lang === 'ko' ? '지도에서 보기' : 'View on map'} ↗</a>
    </article>; })}</div>{matched.length > limit && <button onClick={() => setLimit(v => v + 6)}>{lang === 'ko' ? '더 보기' : 'Show more'} ({Math.min(limit, matched.length)}/{matched.length})</button>}</section>;
}

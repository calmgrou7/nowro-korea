import { useEffect, useState } from 'react';
import { api } from './api';
import { Modal } from './Modal';
function TourismImage({ src, title, lang }: { src?: string; title: string; lang: string }) {
  const valid = /^https?:\/\//.test(src || '') || /^\/images\//.test(src || '');
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  const fallback = !valid || failed;
  return <figure className="tourism-image"><img src={fallback ? '/images/gwangalli.webp' : src!.replace(/^http:\/\/tong.visitkorea.or.kr\//, 'https://tong.visitkorea.or.kr/')} alt={fallback ? (lang === 'ko' ? '부산 광안리 대표 풍경' : 'Reference scenery of Gwangalli, Busan') : title} loading="lazy" onError={() => { if (!fallback) setFailed(true); }} />{fallback && <figcaption>{lang === 'ko' ? '부산 대표 이미지 · 해당 장소 사진 아님' : 'Busan reference image · not a venue photo'}</figcaption>}</figure>;
}
export function OfficialPlaces({ lang }: { lang: string }) {
  const [items, setItems] = useState<any[]>([]);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('places');
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(6);
  const [retry, setRetry] = useState(0);
  const [selected, setSelected] = useState<any>(null);
  const [listings, setListings] = useState<any[]>([]);
  useEffect(() => { api('listings').then(v => setListings(v.listings || [])).catch(() => {}); }, []);
  useEffect(() => { setQuery(''); setLimit(6); }, [category, lang]);
  const extra = listings.filter(v => category === 'festivals' ? v.data.kind === 'event' : category === 'ocean' ? v.data.kind === 'experience' || v.data.kind === 'service' : false).map(v => ({ UC_SEQ: v.id, MAIN_TITLE: lang === 'ko' ? v.data.titleKo : v.data.titleEn, ADDR1: v.data.address, ITEMCNTNTS: lang === 'ko' ? v.data.descriptionKo : v.data.descriptionEn, MAIN_IMG_NORMAL: v.data.images[0], USAGE_DAY_WEEK_AND_TIME: v.data.eventStart ? v.data.eventStart + ' – ' + v.data.eventEnd : v.data.hours, sourceLabel: 'NOWRO · ' + v.data.businessName }));
  const matched = [...items, ...extra].filter(item => [item.title, item.MAIN_TITLE, item.addr1, item.ADDR1, item.GUGUN_NM, item.PLACE].join(' ').toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  useEffect(() => { let active = true; setItems([]); setLoading(true); setFailed(false); api('openapi/' + (category === 'places' ? (lang === 'ko' ? 'kor' : 'eng') : category)).then(v => { if(active) { setItems(Array.isArray(v.items) ? v.items : []); setFailed(v.status === 'temporarily_unavailable'); } }).catch(() => { if(active) setFailed(true); }).finally(() => { if(active) setLoading(false); }); return () => { active = false; }; }, [lang, category, retry]);
  return <section className="data-sources"><h2>{lang === 'ko' ? '어디를 찾아볼까요?' : 'Find your next stop'}</h2>
    <div className="quick-categories">{[['places','관광지','Places'],['foodie','푸디투어','Food tours'],['ocean','체험','Experiences'],['festivals','축제 안내','Festival guide']].map(([id,ko,en]) => <button key={id} aria-pressed={category === id} onClick={() => setCategory(id)}>{lang === 'ko' ? ko : en}</button>)}</div>
    {category === 'festivals' && <p className="notice">{lang === 'ko' ? '축제 소개 자료입니다. 지난 연도 일정이 포함될 수 있으므로 올해 개최 일정은 주최기관에서 확인해주세요.' : 'Festival reference guide. Dates may refer to past editions; confirm current dates with the organizer.'}</p>}
    {loading && <p role="status">{lang === 'ko' ? '관광정보를 불러오는 중입니다.' : 'Loading places…'}</p>}
    <label>{lang === 'ko' ? '이 목록에서 장소·지역 찾기' : 'Find a place or neighborhood in this list'}<input type="search" value={query} onChange={e => { setQuery(e.target.value); setLimit(6); }} /></label>
    {failed && <div role="status"><p>{lang === 'ko' ? '정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.' : 'Information is temporarily unavailable. Please try again shortly.'}</p><button onClick={() => setRetry(v => v + 1)}>{lang === 'ko' ? '다시 불러오기' : 'Try again'}</button></div>}
    {!loading && !failed && !items.length && <p>{lang === 'ko' ? '현재 제공된 정보가 없습니다.' : 'No information is currently available.'}</p>}
    {!loading && items.length > 0 && !matched.length && <p role="status">{lang === 'ko' ? '검색 결과가 없습니다.' : 'No matching places.'}</p>}
    <div className="source-grid">{matched.slice(0, limit).map((original) => { const item = { ...original, UC_SEQ: original.contentid || original.UC_SEQ, MAIN_TITLE: original.title || original.MAIN_TITLE, SUBTITLE: original.addr1 || original.ADDR1 || original.PLACE, MAIN_IMG_NORMAL: original.firstimage || original.MAIN_IMG_NORMAL, ITEMCNTNTS: original.ITEMCNTNTS || original.addr2 }; return <article className="source-card" key={item.UC_SEQ}>
      <TourismImage src={item.MAIN_IMG_NORMAL} title={item.MAIN_TITLE || item.TITLE} lang={lang} />
      <h3>{item.MAIN_TITLE || item.TITLE}</h3><p>{item.SUBTITLE || item.PLACE}</p>
      <button onClick={() => setSelected(item)}>{lang === 'ko' ? '상세 정보 보기' : 'View details'}</button>
      {item.ITEMCNTNTS && <details><summary>{lang === 'ko' ? '소개 보기' : 'Read description'}</summary><p>{item.ITEMCNTNTS}</p></details>}
      {original.USAGE_DAY_WEEK_AND_TIME && <details><summary>{lang === 'ko' ? '운영시간·일정' : 'Hours and dates'}</summary><p>{original.USAGE_DAY_WEEK_AND_TIME}</p></details>}
      <a href={'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(item.SUBTITLE || item.MAIN_TITLE)} target="_blank" rel="noreferrer">{lang === 'ko' ? '지도에서 보기' : 'View on map'} ↗</a>
    </article>; })}</div>{matched.length > limit && <button onClick={() => setLimit(v => v + 6)}>{lang === 'ko' ? '더 보기' : 'Show more'} ({Math.min(limit, matched.length)}/{matched.length})</button>}<p><small className="muted">{category === 'places' ? (lang === 'ko' ? '출처: 한국관광공사' : 'Source: Korea Tourism Organization') : (lang === 'ko' ? '출처: 부산광역시 · 공식 원문 / NOWRO 등록 콘텐츠' : 'Source: Busan Metropolitan City / NOWRO listings')}</small></p>
    {selected && <Modal title={selected.MAIN_TITLE} close={() => setSelected(null)}>
      <TourismImage src={selected.MAIN_IMG_NORMAL} title={selected.MAIN_TITLE} lang={lang} />
      <p style={{whiteSpace:'pre-line'}}>{selected.ITEMCNTNTS || (lang === 'ko' ? '상세 소개가 제공되지 않았습니다.' : 'A detailed description is not available.')}</p>
      <h3>{lang === 'ko' ? '위치' : 'Location'}</h3><p>{selected.SUBTITLE || (lang === 'ko' ? '주소 확인 필요' : 'Address to be confirmed')}</p>
      <h3>{lang === 'ko' ? '운영시간·일정' : 'Hours and dates'}</h3><p>{selected.USAGE_DAY_WEEK_AND_TIME || (lang === 'ko' ? '방문 전 운영기관에 확인해주세요.' : 'Confirm with the venue before visiting.')}</p>
      {selected.CNTCT_TEL && <p>{selected.CNTCT_TEL}</p>}
      <a href={'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(selected.SUBTITLE || selected.MAIN_TITLE)} target="_blank" rel="noreferrer">{lang === 'ko' ? '지도·길찾기' : 'Map and directions'} ↗</a>
      <p><small className="muted">{selected.sourceLabel || (category === 'places' ? 'Korea Tourism Organization' : 'Busan Metropolitan City')}</small></p>
    </Modal>}
    </section>;
}

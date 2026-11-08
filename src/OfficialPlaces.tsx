import { useEffect, useState } from 'react';
import { api } from './api';
import { Modal } from './Modal';
import { savePlace, readSavedPlaces } from './SavedPlaces';
function TourismImage({ src, title, lang }: { src?: string; title: string; lang: string }) {
  const valid = /^https?:\/\//.test(src || '') || /^\/images\//.test(src || '');
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  const fallback = !valid || failed;
  return <figure className={'tourism-image' + (fallback ? ' tourism-image-placeholder' : '')}>{fallback ? <div className="tourism-placeholder" role="img" aria-label={lang === 'ko' ? '장소 사진 준비 중' : 'Venue photo unavailable'}><img src="/brand/logo.webp" alt="NOWRO" /></div> : <img src={src!.replace(/^http:\/\/tong.visitkorea.or.kr\//, 'https://tong.visitkorea.or.kr/')} alt={title} loading="lazy" onError={() => setFailed(true)} />}</figure>;
}
export function OfficialPlaces({ lang, onPlan }: { lang: string; onPlan?: (item?: any) => void }) {
  const [items, setItems] = useState<any[]>([]);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('places');
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(6);
  const [retry, setRetry] = useState(0);
  const [savedIds, setSavedIds] = useState<string[]>(() => readSavedPlaces().map(p => String(p.UC_SEQ || p.contentid)));
  useEffect(() => { const update = () => setSavedIds(readSavedPlaces().map(p => String(p.UC_SEQ || p.contentid))); window.addEventListener('nowro-saved', update); return () => window.removeEventListener('nowro-saved', update); }, []);
  const [selected, setSelected] = useState<any>(null);
  const [listings, setListings] = useState<any[]>([]);
  useEffect(() => { api('listings').then(v => setListings(v.listings || [])).catch(() => {}); }, []);
  useEffect(() => { setQuery(''); setLimit(6); }, [category, lang]);
  const extra = listings.filter(v => category === 'festivals' ? v.data.kind === 'event' : category === 'ocean' ? v.data.kind === 'experience' || v.data.kind === 'service' : false).map(v => ({ UC_SEQ: v.id, MAIN_TITLE: lang === 'ko' ? v.data.titleKo : v.data.titleEn, ADDR1: v.data.address, ITEMCNTNTS: lang === 'ko' ? v.data.descriptionKo : v.data.descriptionEn, MAIN_IMG_NORMAL: v.data.images[0], USAGE_DAY_WEEK_AND_TIME: v.data.eventStart ? v.data.eventStart + ' – ' + v.data.eventEnd : v.data.hours, sourceLabel: 'NOWRO · ' + v.data.businessName }));
  const matched = [...items, ...extra].filter(item => [item.title, item.MAIN_TITLE, item.addr1, item.ADDR1, item.GUGUN_NM, item.PLACE].join(' ').toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  useEffect(() => {
    let active = true; setItems([]); setLoading(true); setFailed(false);
    const tourism = lang === 'ko' ? 'kor' : 'eng';
    const food = (item: any) => ['39','82'].includes(String(item.contenttypeid));
    const paths = category === 'foodie' ? ['foodie',tourism] : [category === 'places' ? tourism : category];
    Promise.allSettled(paths.map(path => api('openapi/' + path))).then(results => {
      if (!active) return;
      const feeds = results.filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled').map(r=>r.value);
      const rows = feeds.flatMap(v => Array.isArray(v.items) ? v.items : []);
      const filtered = category === 'places' ? rows.filter(item=>!food(item)) : category === 'foodie' ? rows.filter(item=>!item.contenttypeid || food(item)) : rows;
      setItems(filtered); setFailed(!feeds.some(v=>v.status === 'ok') && !filtered.length);
    }).finally(()=>{if(active)setLoading(false);});
    return ()=>{active=false;};
  }, [lang, category, retry]);
  return <section className="data-sources"><div className="section-heading"><h2>{lang === 'ko' ? '어디를 찾아볼까요?' : 'Find your next stop'}</h2>{onPlan && <button className="primary" onClick={() => onPlan()}>{lang === 'ko' ? '코스' : 'Routes'}</button>}</div>
    <div className="quick-categories">{[['places','관광지','Places'],['foodie','푸디투어','Food tours'],['ocean','체험','Experiences'],['festivals','축제 안내','Festival guide']].map(([id,ko,en]) => <button key={id} aria-pressed={category === id} onClick={() => setCategory(id)}>{lang === 'ko' ? ko : en}</button>)}</div>
    {category === 'festivals' && <p className="notice">{lang === 'ko' ? '축제 소개 자료입니다. 지난 연도 일정이 포함될 수 있으므로 올해 개최 일정은 주최기관에서 확인해주세요.' : 'Festival reference guide. Dates may refer to past editions; confirm current dates with the organizer.'}</p>}
    {loading && <p role="status">{lang === 'ko' ? '관광정보를 불러오는 중입니다.' : 'Loading places…'}</p>}
    <label>{lang === 'ko' ? '이 목록에서 장소·지역 찾기' : 'Find a place or neighborhood in this list'}<input type="search" value={query} onChange={e => { setQuery(e.target.value); setLimit(6); }} /></label>
    {failed && <div role="status"><p>{lang === 'ko' ? '정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.' : 'Information is temporarily unavailable. Please try again shortly.'}</p><button onClick={() => setRetry(v => v + 1)}>{lang === 'ko' ? '다시 불러오기' : 'Try again'}</button></div>}
    {!loading && !failed && !items.length && <p>{lang === 'ko' ? '현재 제공된 정보가 없습니다.' : 'No information is currently available.'}</p>}
    {!loading && items.length > 0 && !matched.length && <p role="status">{lang === 'ko' ? '검색 결과가 없습니다.' : 'No matching places.'}</p>}
    <div className="source-grid">{matched.slice(0, limit).map((original) => { const item = { ...original, UC_SEQ: category + '-' + (original.contentid || original.UC_SEQ), routePlaceId: original.contentid ? 'kto-' + original.contentid : null, MAIN_TITLE: original.title || original.MAIN_TITLE, SUBTITLE: original.addr1 || original.ADDR1 || original.PLACE, MAIN_IMG_NORMAL: original.firstimage || original.MAIN_IMG_NORMAL, ITEMCNTNTS: original.ITEMCNTNTS || original.addr2 }; return <article className="source-card tourism-card" key={item.UC_SEQ}>
      <TourismImage src={item.MAIN_IMG_NORMAL} title={item.MAIN_TITLE || item.TITLE} lang={lang} />
      <button className="tourism-save" aria-label={lang === 'ko' ? '장소 저장' : 'Save place'} aria-pressed={savedIds.includes(String(item.UC_SEQ))} onClick={() => savePlace(item)}>{savedIds.includes(String(item.UC_SEQ)) ? '✓' : '♡'}</button>
      <span className="tourism-district">{original.GUGUN_NM || String(item.SUBTITLE || '').match(/[가-힣]+[구군](?=\s|$)|[A-Za-z]+-(?:gu|gun)/)?.[0] || (lang === 'ko' ? '부산' : 'Busan')}</span>
      <h3 title={item.MAIN_TITLE || item.TITLE}>{item.MAIN_TITLE || item.TITLE}</h3>
      <p className="tourism-address" title={item.SUBTITLE || item.PLACE}>{item.SUBTITLE || item.PLACE || (lang === 'ko' ? '주소 확인 필요' : 'Address unverified')}</p>
      <p className="tourism-schedule" title={original.USAGE_DAY_WEEK_AND_TIME}>{original.USAGE_DAY_WEEK_AND_TIME || (lang === 'ko' ? '일정·운영시간 확인 필요' : 'Check dates and opening hours')}</p>
      <div className="tourism-actions"><button onClick={() => setSelected(item)}>{lang === 'ko' ? '상세보기' : 'Details'}</button>{onPlan && <button onClick={() => onPlan(item)}>{lang === 'ko' ? '이 장소 코스 포함' : 'Add to route'}</button>}</div>
    </article>; })}</div>{matched.length > limit && <button onClick={() => setLimit(v => v + 6)}>{lang === 'ko' ? '더 보기' : 'Show more'} ({Math.min(limit, matched.length)}/{matched.length})</button>}<p><small className="muted">{category === 'places' ? (lang === 'ko' ? '출처: 한국관광공사' : 'Source: Korea Tourism Organization') : (lang === 'ko' ? '출처: 부산광역시 · 공식 원문 / NOWRO 등록 콘텐츠' : 'Source: Busan Metropolitan City / NOWRO listings')}</small></p>
    {selected && <Modal title={selected.MAIN_TITLE} close={() => setSelected(null)}>
      <TourismImage src={selected.MAIN_IMG_NORMAL} title={selected.MAIN_TITLE} lang={lang} />
      <h3>{lang === 'ko' ? '위치' : 'Location'}</h3><p>{selected.SUBTITLE || (lang === 'ko' ? '주소 확인 필요' : 'Address to be confirmed')}</p>
      <h3>{lang === 'ko' ? '운영시간·일정' : 'Hours and dates'}</h3><p>{selected.USAGE_DAY_WEEK_AND_TIME || (lang === 'ko' ? '방문 전 운영기관에 확인해주세요.' : 'Confirm with the venue before visiting.')}</p>
      <h3>{lang === 'ko' ? '소개' : 'About'}</h3><p style={{whiteSpace:'pre-line'}}>{selected.ITEMCNTNTS || (lang === 'ko' ? '상세 소개가 제공되지 않았습니다.' : 'A detailed description is not available.')}</p>
      {selected.CNTCT_TEL && <p>{selected.CNTCT_TEL}</p>}
      <a href={'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(selected.SUBTITLE || selected.MAIN_TITLE)} target="_blank" rel="noreferrer">{lang === 'ko' ? '지도·길찾기' : 'Map and directions'} ↗</a>
      <p><small className="muted">{selected.sourceLabel || (category === 'places' ? 'Korea Tourism Organization' : 'Busan Metropolitan City')}</small></p>
    </Modal>}
    </section>;
}

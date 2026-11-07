import { useEffect, useState } from 'react';
import { api } from './api';
export function OfficialPlaces({ lang }: { lang: string }) {
  const [items, setItems] = useState<any[]>([]);
  const [failed, setFailed] = useState(false);
  useEffect(() => { api('openapi/foodie').then(v => setItems(v.items || [])).catch(() => setFailed(true)); }, []);
  return <section className="data-sources"><h2>{lang === 'ko' ? '부산 공식 푸디투어' : 'Busan Foodie Tour'}</h2>
    <p>{lang === 'ko' ? '부산광역시 제공 · 원문은 한국어입니다.' : 'Source: Busan Metropolitan City · Original content in Korean.'}</p>
    {failed && <p role="status">{lang === 'ko' ? '정보를 불러오지 못했습니다. 잠시 후 다시 방문해주세요.' : 'Information is temporarily unavailable.'}</p>}
    <div className="source-grid">{items.map((item) => <article className="source-card" key={item.UC_SEQ}>
      {item.MAIN_IMG_NORMAL?.startsWith('https://') && <img src={item.MAIN_IMG_NORMAL} alt={item.MAIN_TITLE || item.TITLE} loading="lazy" style={{ width: '100%', aspectRatio: '16/10', objectFit: 'cover', borderRadius: 10 }} />}
      <h3>{item.MAIN_TITLE || item.TITLE}</h3><p>{item.SUBTITLE || item.PLACE}</p>
      <details><summary>{lang === 'ko' ? '상세 소개' : 'Read original description'}</summary><p style={{whiteSpace:'pre-line'}}>{item.ITEMCNTNTS}</p></details>
      <a href="https://www.visitbusan.net/" target="_blank" rel="noreferrer">Visit Busan ↗</a>
    </article>)}</div></section>;
}

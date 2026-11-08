import { fetchOpenApi } from './busan-openapi.mjs';
export async function syncTourismCatalog(store, areas) {
  const feed = await fetchOpenApi('kor');
  if (feed.status !== 'ok' || !feed.items.length) return;
  const places = feed.items.flatMap(item => {
    const lat = Number(item.mapy), lng = Number(item.mapx);
    const area = areas.find(a => String(item.addr1 || '').includes(a.name.ko));
    if (!area || !item.contentid || !Number.isFinite(lat) || !Number.isFinite(lng) || lat < 34 || lat > 36 || lng < 128 || lng > 130) return [];
    const category = ({12:'culture',14:'culture',15:'event',28:'experience',38:'shopping',39:'food'})[item.contenttypeid];
    if (!category) return [];
    const localized = Object.fromEntries(['ko','en','ja','zh-CN','zh-TW'].map(lang => [lang, item.title]));
    return [{ id: 'kto-' + item.contentid, areaId: area.id, name: localized, description: Object.fromEntries(Object.keys(localized).map(lang => [lang, '한국관광공사 제공 · 운영시간·요금·체류시간은 방문 전 확인이 필요한 계획용 예상 정보입니다.'])), address: item.addr1, point:{lat,lng}, category, tags:[category], costMin:0, costMax: category === 'food' ? 30000 : 20000, stay:40, wait:10, hours:Array.from({length:7},(_,day)=>({day,open:0,close:1440,lastEntry:1380})), reservation:false, sample:false, source:'https://www.visitkorea.or.kr/', checkedAt:new Date().toISOString(), children:null, accessible:null, diet:[], stamp:false, art:category, published:true, planningEstimate:true, image: String(item.firstimage || '').replace(/^http:/,'https:') }];
  });
  if (places.length) store.db.prepare('INSERT OR REPLACE INTO config(key,value) VALUES(?,?)').run('tourism_catalog', JSON.stringify(places));
}

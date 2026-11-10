import { loadExhibitionsWithFallback } from './exhibition-origin.mjs';
import {combinedFestivals} from './festival-feed.mjs';
const SOURCES = {
  foodie: { name: "Busan Foodie Tour", endpoint: "https://apis.data.go.kr/6260000/FoodieService", key: "BUSAN_FOODIE_API_KEY" },
  exhibitions: { name: "Busan Culture Exhibitions", endpoint: "https://apis.data.go.kr/6260000/BusanCultureExhibitService", key: "BUSAN_EXHIBIT_API_KEY" },
  ocean: { name: "Busan Marine Experiences", endpoint: "https://apis.data.go.kr/6260000/MarintimeService", key: "BUSAN_MARITIME_API_KEY" },
  theatre: { name: "Busan Culture Theatre", endpoint: "https://apis.data.go.kr/6260000/BusanCulturePlayDetailService", key: "BUSAN_THEATRE_API_KEY" },
  festivals: { name: "Busan Festivals", endpoint: "https://apis.data.go.kr/6260000/FestivalService", key: "BUSAN_FESTIVAL_API_KEY" },
  kor: { name: "Korea Tourism (Korean)", endpoint: "https://apis.data.go.kr/B551011/KorService2", key: "KTO_KOREAN_API_KEY" },
  eng: { name: "Korea Tourism (English)", endpoint: "https://apis.data.go.kr/B551011/EngService2", key: "KTO_ENGLISH_API_KEY" },
};

export function openApiSources() {
  return Object.entries(SOURCES).map(([id, source]) => ({ id, name: source.name, endpoint: source.endpoint, website: ({foodie:'https://www.data.go.kr/data/15063507/openapi.do',exhibitions:'https://www.data.go.kr/data/15063737/openapi.do',ocean:'https://www.data.go.kr/data/15063564/openapi.do',festivals:'https://www.data.go.kr/data/15063500/openapi.do',theatre:'https://busandabom.net/',kor:'https://korean.visitkorea.or.kr/',eng:'https://english.visitkorea.or.kr/'}[id]), configured: Boolean(process.env[source.key]) }));
}

const cache = new Map();
const pending = new Map();
export async function festivalHero() {
 return {image:'/images/busan-fireworks.webp',title:'Busan Fireworks Festival',source:'https://www.data.go.kr/data/15063500/openapi.do',archival:true,checkedAt:'2026-11-08T00:00:00.000Z'};
}
export async function fetchOpenApi(type, params = {}) {
  if (type === 'theatre') {
    if (!/^\d{1,20}$/.test(params.res_no || '')) return { items: [], status: 'performance_id_required', configured: Boolean(process.env.BUSAN_THEATRE_API_KEY) };
    return loadOpenApi(type, { res_no: params.res_no }).catch(() => ({ items: [], status: 'temporarily_unavailable' }));
  }
  const cached = cache.get(type);
  if (cached && Date.now() - cached.at < (cached.value.status === 'ok' ? 3600000 : 60000)) return cached.value;
  if (pending.has(type)) return pending.get(type);
  const request = loadOpenApi(type).then(value => {
    if (value.status === 'ok') cache.set(type, { at: Date.now(), value });
    return value;
  }).catch(error => {
    const reason = error.reason || (error.name === 'TimeoutError' ? 'upstream_timeout' : error.message === 'OPEN_API_REQUEST_REJECTED' ? 'upstream_rejected' : 'upstream_unavailable');
    if (cached?.value.status === 'ok') return { ...cached.value, stale: true };
    const value = { items: [], status: 'temporarily_unavailable', reason, ...(error.providerCode?{providerCode:error.providerCode}:{}),...(error.httpStatus?{upstreamHttpStatus:error.httpStatus}:{}), configured: Boolean(process.env[SOURCES[type]?.key]) };
    cache.set(type, { at: Date.now(), value });
    return value;
  }).finally(() => pending.delete(type));
  pending.set(type, request);
  return request;
}
async function loadOpenApi(type, params = {}) {
  if(type==='festivals')return combinedFestivals(()=>loadOpenApi('busan-festivals'),process.env.KTO_KOREAN_API_KEY);
  if(type==='busan-festivals')type='festivals';
  const source = SOURCES[type];
  if (!source) throw new Error("UNKNOWN_OPEN_API");
  const serviceKey = process.env[source.key];
  if (!serviceKey) return { source: { id: type, name: source.name, endpoint: source.endpoint, configured: false }, items: [], configured: false };
  if(type==='exhibitions')return loadExhibitionsWithFallback(serviceKey);
  const operations = { theatre: 'getBusanCulturePlayDetail', foodie: 'getFoodieKr', ocean: 'getMaritimeKr', festivals: 'getFestivalKr', exhibitions: 'getBusanCultureExhibit', kor: 'areaBasedList2', eng: 'areaBasedList2' };
  if (!operations[type]) return { source: { id: type, name: source.name }, items: [], configured: true, status: 'verification_pending' };
  const tourism = type === 'kor' || type === 'eng';
  const query = new URLSearchParams({ [tourism ? 'serviceKey' : 'ServiceKey']: serviceKey, numOfRows: tourism || type === 'festivals' ? "100" : "30", pageNo: "1", ...(tourism ? { MobileOS: 'ETC', MobileApp: 'NOWRO', _type: 'json', areaCode: '6' } : { resultType: 'json' }) });
  if (params.res_no) query.set('res_no', params.res_no);
  const response = await fetch(`${source.endpoint}/${operations[type]}?${query}`, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`OPEN_API_${response.status}`);
  const payload = await response.json();
  const code = payload.resultCode || payload.response?.header?.resultCode;
  if (code && !['00', '0000'].includes(String(code))) throw new Error('OPEN_API_REQUEST_REJECTED');
  const body = payload?.response?.body || Object.values(payload)[0] || payload;
  const items = body?.items?.item || body?.items || body?.item || [];
  return { source: { id: type, name: source.name, endpoint: source.endpoint, configured: true }, items: Array.isArray(items) ? items : [items], configured: true, status: 'ok', updatedAt: new Date().toISOString() };
}

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
  return Object.entries(SOURCES).map(([id, source]) => ({ id, name: source.name, endpoint: source.endpoint, configured: Boolean(process.env[source.key]) }));
}

const cache = new Map();
const pending = new Map();
let heroCache;
export async function festivalHero() {
  if (heroCache && Date.now() - heroCache.at < 3600000) return heroCache.value;
  const feed = await fetchOpenApi('festivals');
  for (const item of (feed.items || []).filter(item => /부산불꽃축제/.test(item.MAIN_TITLE || ''))) {
    try {
      const url = new URL(item.MAIN_IMG_NORMAL, 'https://www.visitbusan.net');
      if (url.protocol !== 'https:' || url.hostname !== 'www.visitbusan.net') continue;
      const response = await fetch(url, { redirect:'error', signal:AbortSignal.timeout(4000) });
      const reader = response.body?.getReader();
      const first = await reader?.read();
      const bytes = first?.value;
      const valid = response.ok && bytes && ((bytes[0] === 255 && bytes[1] === 216) || (bytes[0] === 137 && bytes[1] === 80) || (bytes[0] === 82 && bytes[1] === 73));
      await reader?.cancel();
      if (!valid) continue;
      const value = { image: url.href, title: item.MAIN_TITLE, source:'https://www.visitbusan.net/', checkedAt:new Date().toISOString(), archival:true };
      heroCache = {at:Date.now(),value}; return value;
    } catch {}
  }
  return {image:null};
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
    const reason = error.name === 'TimeoutError' ? 'upstream_timeout' : error.message === 'OPEN_API_REQUEST_REJECTED' ? 'upstream_rejected' : 'upstream_unavailable';
    if (cached?.value.status === 'ok') return { ...cached.value, stale: true };
    const value = { items: [], status: 'temporarily_unavailable', reason, configured: Boolean(process.env[SOURCES[type]?.key]) };
    cache.set(type, { at: Date.now(), value });
    return value;
  }).finally(() => pending.delete(type));
  pending.set(type, request);
  return request;
}
async function loadOpenApi(type, params = {}) {
  const source = SOURCES[type];
  if (!source) throw new Error("UNKNOWN_OPEN_API");
  const serviceKey = process.env[source.key];
  if (!serviceKey) return { source: { id: type, name: source.name, endpoint: source.endpoint, configured: false }, items: [], configured: false };
  const operations = { theatre: 'getBusanCulturePlayDetail', foodie: 'getFoodieKr', ocean: 'getMaritimeKr', festivals: 'getFestivalKr', exhibitions: 'getBusanCultureExhibit', kor: 'areaBasedList2', eng: 'areaBasedList2' };
  if (!operations[type]) return { source: { id: type, name: source.name }, items: [], configured: true, status: 'verification_pending' };
  const tourism = type === 'kor' || type === 'eng';
  const query = new URLSearchParams({ [tourism ? 'serviceKey' : 'ServiceKey']: serviceKey, numOfRows: tourism ? "100" : "30", pageNo: "1", ...(tourism ? { MobileOS: 'ETC', MobileApp: 'NOWRO', _type: 'json', areaCode: '6' } : { resultType: 'json' }) });
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

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

export async function fetchOpenApi(type, params = {}) {
  const source = SOURCES[type];
  if (!source) throw new Error("UNKNOWN_OPEN_API");
  const serviceKey = process.env[source.key];
  if (!serviceKey) return { source: { id: type, name: source.name, endpoint: source.endpoint, configured: false }, items: [], configured: false };
  const query = new URLSearchParams({ serviceKey, resultType: "json", numOfRows: "100", pageNo: "1", ...params });
  const response = await fetch(`${source.endpoint}?${query}`);
  if (!response.ok) throw new Error(`OPEN_API_${response.status}`);
  const payload = await response.json();
  const body = payload?.getFoodieInfo?.body || payload?.getFestivalInfo?.body || payload?.response?.body || payload;
  const items = body?.items?.item || body?.items || [];
  return { source: { id: type, name: source.name, endpoint: source.endpoint, configured: true }, items: Array.isArray(items) ? items : [items], configured: true };
}

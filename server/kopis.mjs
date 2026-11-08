const cache = new Map();
const pending = new Map();
const decode = (value) =>
  value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#(x[0-9a-f]+|\d+);/gi, (_, n) => {
      const code =
        n[0].toLowerCase() === "x" ? parseInt(n.slice(1), 16) : Number(n);
      return code <= 0x10ffff ? String.fromCodePoint(code) : "";
    })
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
export function parseKopis(xml) {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml) || !/<dbs(?:\s|>)/.test(xml))
    throw new Error("INVALID_XML");
  return [...xml.matchAll(/<db>([\s\S]*?)<\/db>/g)].map(([, row]) =>
    Object.fromEntries(
      [...row.matchAll(/<([a-z][a-z0-9]*)>([\s\S]*?)<\/\1>/gi)].map(
        ([, key, value]) => [key, decode(value.trim())],
      ),
    ),
  );
}
const date = (value) => (value || "").replace(/\./g, "-");
function normalize(p) {
  return {
    UC_SEQ: "kopis-" + p.mt20id,
    kopisId: p.mt20id,
    facilityId: p.mt10id,
    MAIN_TITLE: p.prfnm,
    ADDR1: p.adres || p.fcltynm,
    PLACE: p.fcltynm,
    LAT: p.la,
    LNG: p.lo,
    CNTCT_TEL: p.telno,
    MAIN_IMG_NORMAL: (p.poster || "").replace(
      /^http:\/\/www.kopis.or.kr/,
      "https://www.kopis.or.kr",
    ),
    USAGE_DAY_WEEK_AND_TIME: [date(p.prfpdfrom), date(p.prfpdto)]
      .filter(Boolean)
      .join(" – "),
    ITEMCNTNTS: [
      p.genrenm,
      p.prfstate,
      p.prfruntime,
      p.prfage,
      p.pcseguidance,
      p.dtguidance?.replace(/<[^>]+>/g, " "),
    ]
      .filter(Boolean)
      .join("\n"),
    sourceLabel: "KOPIS · 공연예술통합전산망",
    sourceUrl:
      "https://www.kopis.or.kr/por/db/pblprfr/pblprfrView.do?mt20Id=" +
      encodeURIComponent(p.mt20id),
  };
}
async function request(path, params = {}) {
  if (!process.env.KOPIS_API_KEY)
    return { status: "setup_required", items: [] };
  const key = path + JSON.stringify(params),
    cached = cache.get(key);
  if (cached && Date.now() - cached.at < cached.ttl) return cached.value;
  if (pending.has(key)) return pending.get(key);
  const task = (async () => {
    try {
      const url = new URL("https://kopis.or.kr/openApi/restful/" + path);
      url.searchParams.set("service", process.env.KOPIS_API_KEY);
      for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
      const response = await fetch(url, {
        signal: AbortSignal.timeout(15000),
        redirect: "error",
      });
      if (!response.ok) throw new Error("UPSTREAM");
      const xml = await response.text();
      if (xml.length > 3000000) throw new Error("SIZE");
      const rows = parseKopis(xml);
      const value = { status: "ok", items: rows.map(normalize) };
      cache.set(key, { at: Date.now(), ttl: 3600000, value });
      while (cache.size > 150) cache.delete(cache.keys().next().value);
      return value;
    } catch {
      const value =
        cached?.value?.status === "ok"
          ? { ...cached.value, stale: true }
          : { status: "temporarily_unavailable", items: [] };
      cache.set(key, { at: Date.now(), ttl: 60000, value });
      return value;
    } finally {
      pending.delete(key);
    }
  })();
  pending.set(key, task);
  return task;
}
export async function kopisPerformances() {
  const now = new Date(Date.now() + 9 * 3600000),
    start = now.toISOString().slice(0, 10);
  now.setUTCDate(now.getUTCDate() + 90);
  const end = now.toISOString().slice(0, 10);
  const feed = await request("pblprfr", {
    stdate: start.replaceAll("-", ""),
    eddate: end.replaceAll("-", ""),
    cpage: "1",
    rows: "100",
    signgucode: "26",
  });
  return {
    ...feed,
    items: feed.items.filter(
      (p) => p.USAGE_DAY_WEEK_AND_TIME.slice(-10) >= start,
    ),
    limit: 100,
  };
}
export async function kopisDetail(id) {
  if (!/^PF\d{1,12}$/.test(id || ""))
    return Promise.resolve({ status: "invalid_id", items: [] });
  const feed = await request("pblprfr/" + id);
  const p = feed.items[0];
  if (p && /^FC\d{1,12}$/.test(p.facilityId || "")) {
    const venue = (await request("prfplc/" + p.facilityId)).items[0];
    if (venue)
      return {
        ...feed,
        items: [
          {
            ...p,
            ADDR1: venue.ADDR1 || p.ADDR1,
            LAT: venue.LAT,
            LNG: venue.LNG,
            CNTCT_TEL: venue.CNTCT_TEL,
          },
        ],
      };
  }
  return feed;
}

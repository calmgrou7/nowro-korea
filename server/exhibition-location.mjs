import { readExhibitionOrigin } from "./exhibition-origin-https.mjs";
const cache = new Map(),
  pending = new Map();
const text = (v) =>
  v
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
const district = (address) =>
  address.match(
    /부산(?:광역시)?\s+(중구|서구|동구|영도구|부산진구|동래구|남구|북구|해운대구|사하구|금정구|강서구|연제구|수영구|사상구|기장군)/,
  )?.[1];
export function parseExhibitionLocation(html) {
  const table = [...html.matchAll(/<table\b[^>]*>[\s\S]*?<\/table>/gi)]
    .map((m) => m[0])
    .find(
      (t) => /<th\b[^>]*>\s*주소\s*<\/th>/.test(t) && /placeinfo\/view/.test(t),
    );
  if (!table) return null;
  const venues = [...table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].flatMap(
    ([, row]) => {
      const cells = [...row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(
        (m) => m[1],
      );
      if (!cells.length) return [];
      const name = text(
        cells[0].match(/<a\b[^>]*>([\s\S]*?)<\/a>/i)?.[1] || "",
      );
      const address = text(cells.at(-1));
      return name && district(address)
        ? [{ name, address, district: district(address) }]
        : [];
    },
  );
  const point = html.match(
    /(?:var\s+)?cltrLatLng\s*=\s*new\s+kakao\.maps\.LatLng\(\s*["']?([\d.]+)["']?\s*,\s*["']?([\d.]+)["']?\s*\)/,
  );
  const mapName = text(
    html.match(/var\s+place_nm\s*=\s*["']([^"']+)["']/)?.[1] || "",
  );
  const chosen =
    venues.length === 1 ? venues[0] : venues.find((v) => v.name === mapName);
  const lat = Number(point?.[1]),
    lng = Number(point?.[2]);
  if (
    !chosen ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < 34 ||
    lat > 36 ||
    lng < 128 ||
    lng > 130
  )
    return null;
  return {
    ADDR1: chosen.address,
    GUGUN_NM: chosen.district,
    LAT: lat,
    LNG: lng,
    venueName: chosen.name,
    locationBasis: "official_linked_venue",
    locationChecked: true,
    venueCount: venues.length,
  };
}
export async function exhibitionLocation(id) {
  if (!/^\d{1,20}$/.test(id || "")) return { status: "invalid_id" };
  const previous = cache.get(id);
  if (previous && Date.now() - previous.at < previous.ttl)
    return previous.value;
  if (pending.has(id)) return pending.get(id);
  const task = (async () => {
    try {
      const url = new URL("https://busandabom.net/play/view.nm");
      url.search = new URLSearchParams({
        menuCd: "8",
        lang: "ko",
        url: "play",
        res_no: id,
      });
      const location = parseExhibitionLocation(await readExhibitionOrigin(url));
      const value = location
        ? {
            status: "ok",
            location: { ...location, locationSourceUrl: url.href },
          }
        : { status: "location_unavailable" };
      cache.set(id, {
        at: Date.now(),
        ttl: location ? 86400000 : 300000,
        value,
      });
      while (cache.size > 200) cache.delete(cache.keys().next().value);
      return value;
    } catch {
      return { status: "temporarily_unavailable" };
    } finally {
      pending.delete(id);
    }
  })();
  pending.set(id, task);
  return task;
}

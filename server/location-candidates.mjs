import { fetchOpenApi } from "./busan-openapi.mjs";
import { locationNeedsReview } from "../shared/location-quality.ts";
const normalize = (v) =>
  String(v || "")
    .replace(/\([^)]*\)/g, "")
    .replace(/제\s*\d+\s*회/g, "")
    .replace(/20\d{2}년?/g, "")
    .replace(/[^가-힣a-z0-9]/gi, "")
    .toLowerCase();
export async function locationCandidates(title) {
  if (
    typeof title !== "string" ||
    title.length > 200 ||
    normalize(title).length < 3
  )
    return { items: [], status: "location_unavailable" };
  const rows = (
    await Promise.all(
      ["festivals", "ocean", "kor"].map((type) => fetchOpenApi(type)),
    )
  ).flatMap((f) => f.items || []);
  const items = rows
    .filter((p) => normalize(p.MAIN_TITLE || p.title) === normalize(title))
    .flatMap((p) => {
      if (locationNeedsReview(p)) return [];
      const lat = Number(p.LAT || p.mapy),
        lng = Number(p.LNG || p.mapx);
      if (
        !Number.isFinite(lat) ||
        !Number.isFinite(lng) ||
        lat < 34 ||
        lat > 36 ||
        lng < 128 ||
        lng > 130
      )
        return [];
      return [
        {
          id: String(p.UC_SEQ || p.contentid),
          title: p.MAIN_TITLE || p.title,
          address: p.ADDR1 || p.addr1 || p.PLACE,
          district: p.GUGUN_NM || "",
          lat,
          lng,
          source: "부산광역시·한국관광공사 공식 관광정보",
          reference: true,
        },
      ];
    });
  return {
    status: items.length ? "ok" : "location_unavailable",
    items: [
      ...new Map(items.map((p) => [p.lat + "," + p.lng, p])).values(),
    ].slice(0, 4),
  };
}

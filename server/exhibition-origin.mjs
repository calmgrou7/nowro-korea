import { loadExhibitions } from "./exhibitions.mjs";
import { readExhibitionOrigin } from "./exhibition-origin-https.mjs";
export const exhibitionOriginUrl =
  "https://busandabom.net/play/list.nm?menuCd=8&lang=ko&url=play&prg_cd=140";
const text = (value) =>
  value
    .replace(/<[^>]+>/g, " ")
    .replace(/&#(x[0-9a-f]+|\d+);/gi, (_, n) => {
      const code =
        n[0].toLowerCase() === "x" ? parseInt(n.slice(1), 16) : Number(n);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : "";
    })
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
const field = (html, tag, cls) =>
  text(
    html.match(
      new RegExp(
        `<${tag}\\b[^>]*class=["'](?:[^"']*\\s)?${cls}(?:\\s[^"']*)?["'][^>]*>([\\s\\S]*?)<\\/${tag}>`,
        "i",
      ),
    )?.[1] || "",
  );
export function parseExhibitionOrigin(html) {
  if (typeof html !== "string" || html.length > 2000000)
    throw Error("EXHIBITION_ORIGIN_INVALID");
  const list = html.match(
    /<ul\b[^>]*class=["'][^"']*\bboardlist\b[^"']*["'][^>]*>([\s\S]*?)<\/ul>/i,
  )?.[1];
  const total = html.match(/총\s*([\d,]+)\s*건/)?.[1];
  if (list === undefined || total === undefined)
    throw Error("EXHIBITION_ORIGIN_INVALID");
  const items = [...list.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)].flatMap(
    ([, row]) => {
      const id = row.match(/fn_view\(\s*'(\d{1,20})'\s*,\s*'140'\s*\)/)?.[1];
      const title = field(row, "h3", "tit"),
        dates = field(row, "span", "date"),
        venue = field(row, "span", "where");
      if (!id || !title || !venue) return [];
      const matches = [...dates.matchAll(/(20\d{2})\.(\d{1,2})\.(\d{1,2})/g)];
      const normalize = (m) =>
        `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
      const openrun = dates.includes("오픈런") || dates.includes("상설");
      if (!matches.length && !openrun) return [];
      let image = "";
      for (const [, src] of row.matchAll(/<img\b[^>]*src=["']([^"']+)["']/gi)) {
        const url = new URL(text(src), "https://busandabom.net");
        if (
          url.protocol === "https:" &&
          ["busandabom.net", "www.busandabom.net"].includes(url.hostname) &&
          !url.username &&
          !url.password &&
          /\.(?:jpe?g|png|webp)$/i.test(url.pathname) &&
          !/(?:noimg|\/img\/common\/)/i.test(url.pathname)
        ) {
          image = url.href;
          break;
        }
      }
      const sourceUrl = new URL("https://busandabom.net/play/view.nm");
      sourceUrl.search = new URLSearchParams({
        menuCd: "8",
        lang: "ko",
        url: "play",
        res_no: id,
      });
      return [
        {
          res_no: id,
          title,
          op_st_dt: matches[0] ? normalize(matches[0]) : "",
          op_ed_dt: openrun
            ? ""
            : matches.length
              ? normalize(matches.at(-1))
              : "",
          op_at: openrun ? "Y" : "N",
          place_nm: venue,
          MAIN_IMG_NORMAL: image,
          ITEMCNTNTS:
            "부산문화포털 공개 전시 일정입니다. 상세 관람 안내와 입장료는 공식 원문에서 확인해주세요.",
          sourceUrl: sourceUrl.href,
          sourceLabel: "부산문화포털 다봄 · 공식 전시 일정",
        },
      ];
    },
  );
  const totalCount = Number(total.replaceAll(",", ""));
  if (totalCount > 0 && !items.length) throw Error("EXHIBITION_ORIGIN_INVALID");
  return { items, totalCount };
}
async function originPage(page, readOrigin) {
  const url = new URL(exhibitionOriginUrl);
  url.searchParams.set("page", String(page));
  return parseExhibitionOrigin(await readOrigin(url));
}
export async function loadExhibitionsWithFallback(
  serviceKey,
  { readOrigin = readExhibitionOrigin } = {},
) {
  let primary;
  try {
    return await loadExhibitions(serviceKey, { timeoutMs: 5000 });
  } catch (error) {
    if (error.reason === "upstream_rejected") throw error;
    primary = {
      status: "temporarily_unavailable",
      reason:
        error.reason ||
        (error.name === "TimeoutError"
          ? "upstream_timeout"
          : "upstream_unavailable"),
      ...(error.providerCode ? { providerCode: error.providerCode } : {}),
    };
  }
  try {
    const first = await originPage(1, readOrigin),
      pages = Math.min(10, Math.ceil(first.totalCount / 10)),
      rows = [...first.items];
    let partial = first.totalCount > 100;
    for (let page = 2; page <= pages; page += 3) {
      const batch = await Promise.allSettled(
        Array.from({ length: Math.min(3, pages - page + 1) }, (_, i) =>
          originPage(page + i, readOrigin),
        ),
      );
      for (const result of batch) {
        if (result.status === "fulfilled") rows.push(...result.value.items);
        else partial = true;
      }
    }
    const items = [...new Map(rows.map((p) => [p.res_no, p])).values()];
    if (items.length < Math.min(first.totalCount, 100)) partial = true;
    return {
      items,
      totalCount: first.totalCount,
      status: "ok",
      configured: true,
      transport: "official_portal",
      primary,
      partial,
      updatedAt: new Date().toISOString(),
      source: {
        id: "exhibitions",
        name: "Busan Culture Portal · official exhibition listings",
        endpoint: exhibitionOriginUrl,
        configured: true,
      },
    };
  } catch {
    const error = new Error("EXHIBITION_UNAVAILABLE");
    Object.assign(error, primary);
    throw error;
  }
}

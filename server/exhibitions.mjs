const endpoint =
  "https://apis.data.go.kr/6260000/BusanCultureExhibitService/getBusanCultureExhibit";
function failure(reason, providerCode, httpStatus) {
  const error = new Error("EXHIBITION_PROVIDER_ERROR");
  Object.assign(error, { reason, providerCode, httpStatus });
  return error;
}
function checkCode(code, httpStatus) {
  if (code === undefined || code === null || code === "")
    throw failure("upstream_invalid_response", undefined, httpStatus);
  if (code === 0) code = "00";
  code = String(code || "").trim();
  if (code === "00" || code === "0000") return;
  const reason =
    code === "05"
      ? "upstream_timeout"
      : ["20", "22", "23", "29", "30", "31"].includes(code)
        ? "upstream_rejected"
        : "upstream_unavailable";
  throw failure(reason, code || undefined, httpStatus);
}
function decode(value) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#(x[0-9a-f]+|\d+);/gi, (_, n) => {
      const code =
        n[0].toLowerCase() === "x" ? parseInt(n.slice(1), 16) : Number(n);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : "";
    })
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}
// This is a bounded reader for this provider's flat item fields, not a general XML interpreter.
export function parseExhibitionResponse(raw, httpStatus = 200) {
  if (typeof raw !== "string" || raw.length > 3000000)
    throw failure("upstream_invalid_response", undefined, httpStatus);
  const text = raw.replace(/^\uFEFF/, "").trim();
  if (text.startsWith("{")) {
    let payload;
    try {
      payload = JSON.parse(text);
    } catch {
      throw failure("upstream_invalid_response", undefined, httpStatus);
    }
    const root = payload.response || payload.getBusanCultureExhibit || payload;
    checkCode(
      root.header?.resultCode ?? root.resultCode ?? payload.resultCode,
      httpStatus,
    );
    if (httpStatus < 200 || httpStatus >= 300)
      throw failure("upstream_unavailable", undefined, httpStatus);
    const body = root.body || root;
    if (
      !["items", "item", "totalCount"].some((key) => Object.hasOwn(body, key))
    )
      throw failure("upstream_invalid_response", undefined, httpStatus);
    const rows = body.items?.item ?? body.items ?? body.item ?? [];
    const items = (
      Array.isArray(rows)
        ? rows
        : rows && typeof rows === "object"
          ? [rows]
          : []
    ).filter(
      (item) =>
        item &&
        typeof item === "object" &&
        item.res_no &&
        typeof item.title === "string",
    );
    if (!items.length && Number(body.totalCount) > 0)
      throw failure("upstream_invalid_response", undefined, httpStatus);
    return {
      items,
      totalCount: Number(body.totalCount) || items.length,
      format: "json",
    };
  }
  if (!text.startsWith("<") || /<!DOCTYPE|<!ENTITY/i.test(text))
    throw failure("upstream_invalid_response", undefined, httpStatus);
  const code = text.match(
    /<(?:\w+:)?(?:resultCode|returnReasonCode)>\s*([^<]*)</,
  )?.[1];
  checkCode(code, httpStatus);
  if (httpStatus < 200 || httpStatus >= 300)
    throw failure("upstream_unavailable", undefined, httpStatus);
  if (
    !/<(?:\w+:)?(?:response|getBusanCultureExhibit)(?:\s|>)/.test(text) ||
    !/<\/(?:\w+:)?(?:response|getBusanCultureExhibit)>\s*$/.test(text) ||
    !/<(?:\w+:)?(?:items|item)(?:\s|\/|>)/.test(text)
  )
    throw failure("upstream_invalid_response", undefined, httpStatus);
  const fields = [
    "res_no",
    "title",
    "op_st_dt",
    "op_ed_dt",
    "op_at",
    "place_nm",
    "pay_at",
  ];
  const items = [
    ...text.matchAll(/<(?:\w+:)?item(?:\s[^>]*)?>([\s\S]*?)<\/(?:\w+:)?item>/g),
  ]
    .map(([, item]) =>
      Object.fromEntries(
        fields.map((field) => {
          const match = item.match(
            new RegExp(
              "<(?:\\w+:)?" +
                field +
                "(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:\\w+:)?" +
                field +
                ">",
            ),
          );
          return [field, decode(match?.[1]?.trim() || "")];
        }),
      ),
    )
    .filter((item) => item.res_no && item.title);
  const totalCount =
    Number(text.match(/<(?:\w+:)?totalCount>\s*(\d+)\s*</)?.[1]) ||
    items.length;
  if (!items.length && totalCount > 0)
    throw failure("upstream_invalid_response", undefined, httpStatus);
  return { items, totalCount, format: "xml" };
}
export async function loadExhibitions(serviceKey,{timeoutMs=15000}={}) {
  const url = new URL(endpoint);
  url.search = new URLSearchParams({
    ServiceKey: serviceKey,
    pageNo: "1",
    numOfRows: "30",
  });
  const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  const data = parseExhibitionResponse(await response.text(), response.status);
  return {
    ...data,
    status: "ok",
    configured: true,
    updatedAt: new Date().toISOString(),
    source: {
      id: "exhibitions",
      name: "Busan Culture Exhibitions",
      endpoint: endpoint.slice(0, endpoint.lastIndexOf("/")),
      configured: true,
    },
  };
}

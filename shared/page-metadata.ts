export function pageMetadata(url: URL) {
  const tab = url.searchParams.get("tab") || "NOW";
  const entries: Record<string, [string, string]> = {
    NOW: [
      "NOWRO Korea — Your Korea. Right Now.",
      "Discover Busan festivals, performances, exhibitions, experiences and local travel guides in Korean and English.",
    ],
    MAP: [
      "부산 지역별 가이드 · Local guides | NOWRO Korea",
      "Explore attractions, dining and neighborhoods across Busan’s 16 districts with NOWRO Korea.",
    ],
    ROUTES: ['여행코스 · Route planner | NOWRO Korea','Plan your Busan route around selected places, available time, budget and travel preferences.'],
    ABOUT: [
      "나우로 소개 · About NOWRO | NOWRO Korea",
      "Discover NOWRO Korea, learn how to plan your trip, explore Busan and become a local partner.",
    ],
  };
  const boards: Record<string, [string, string]> = {
    guide: [
      "NOWRO 이용가이드 · Travel guide | NOWRO Korea",
      "Learn how to discover places, save favorites and plan your own route with NOWRO Korea.",
    ],
    busan: [
      "부산여행을 시작하세요 · Visit Busan | NOWRO Korea",
      "Start exploring Busan events, neighborhoods, attractions and local dining with NOWRO Korea.",
    ],
    partners: [
      "파트너를 구합니다 · Become a partner | NOWRO Korea",
      "Learn how local businesses, experience creators and event organizers can participate in NOWRO Korea.",
    ],
  };
  const board = url.searchParams.get("board") || "";
  const [title, description] =
    tab === "ABOUT" && boards[board]
      ? boards[board]
      : entries[tab] || entries.NOW;
  const canonical = new URL("https://nowrokorea.com/");
  if (tab === "MAP" || tab === "ABOUT" || tab === 'ROUTES') canonical.searchParams.set("tab", tab);
  if (tab === "ABOUT" && boards[board])
    canonical.searchParams.set("board", board);
  const noindex =
    !entries[tab] ||
    ["token", "token_hash", "code", "error"].some((key) =>
      url.searchParams.has(key),
    );
  return { title, description, canonical: canonical.href, noindex };
}
export function renderPageMetadata(html: string, url: URL) {
  const meta = pageMetadata(url),
    escape = (s: string) =>
      s
        .replaceAll("&", "&amp;")
        .replaceAll('"', "&quot;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");
  return html
    .replace(
      /<title>[^<]*<\/title>/,
      "<title>" + escape(meta.title) + "</title>",
    )
    .replace(
      /(<meta\s+name="description"\s+content=")[^"]*/,
      "$1" + escape(meta.description),
    )
    .replace(
      /(<link\s+rel="canonical"\s+href=")[^"]*/,
      "$1" + escape(meta.canonical),
    )
    .replace(
      /(<meta\s+property="og:title"\s+content=")[^"]*/,
      "$1" + escape(meta.title),
    )
    .replace(
      /(<meta\s+property="og:description"\s+content=")[^"]*/,
      "$1" + escape(meta.description),
    )
    .replace(
      /(<meta\s+property="og:url"\s+content=")[^"]*/,
      "$1" + escape(meta.canonical),
    )
    .replace(
      "</head>",
      `<meta name="robots" content="${meta.noindex ? "noindex,nofollow" : "index,follow"}" /></head>`,
    );
}
export function syncPageMetadata() {
  const meta = pageMetadata(new URL(location.href));
  document.title = meta.title;
  for (const [selector, value] of [
    ['meta[name="description"]', meta.description],
    ['meta[property="og:title"]', meta.title],
    ['meta[property="og:description"]', meta.description],
    ['meta[property="og:url"]', meta.canonical],
    ['meta[name="robots"]', meta.noindex ? "noindex,nofollow" : "index,follow"],
  ])
    document.querySelector(selector)?.setAttribute("content", value);
  document
    .querySelector('link[rel="canonical"]')
    ?.setAttribute("href", meta.canonical);
}

export const publicTabs = ["NOW", "MAP", "ROUTES", "ABOUT"];
const xml = (v: string) =>
  v
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
export function publicSearchContent(url: URL, posts: any[] = []) {
  const tab = url.searchParams.get("tab") || "NOW";
  if (!publicTabs.includes(tab)) return "";
  const en = url.searchParams.get("lang") !== "ko";
  const headings: Record<string, [string, string]> = {
    NOW: [
      "나우로 코리아와 부산 여행을 시작하세요",
      "Discover Busan with NOWRO Korea",
    ],
    MAP: [
      "부산 지역별 관광·미식 가이드",
      "Busan district guides: attractions and dining",
    ],
    ROUTES: [
      "가까운 장소로 나만의 부산 여행코스",
      "Plan your Busan route with nearby stops",
    ],
    ABOUT: [
      "나우로 코리아 소개와 이용가이드",
      "About NOWRO Korea and travel guides",
    ],
  };
  const title = headings[tab][en ? 1 : 0];
  const introductions: Record<string, [string, string]> = {
    NOW: [
      "부산 축제·공연·전시·체험을 찾아보고, 지역별 관광지와 맛집을 살펴보세요. 마음에 드는 장소를 저장한 뒤 여행코스를 만들 수 있습니다.",
      "Find Busan festivals, performances, exhibitions and local experiences. Save places and plan your trip.",
    ],
    MAP: [
      "해운대구·수영구·영도구·중구·기장군 등 부산 16개 구·군의 관광지와 음식점 정보를 살펴보세요. 상세페이지에서 지도와 주변 장소를 확인할 수 있습니다.",
      "Explore attractions and dining in all 16 Busan districts, including Haeundae, Suyeong, Yeongdo, Jung-gu and Gijang. Open maps and discover nearby places.",
    ],
    ROUTES: [
      "저장한 장소를 최대 4개 고르거나 출발 위치에서 시작하세요. 인접 구·군의 장소도 함께 묶어 시간·예산·이동수단에 맞는 계획용 코스를 계산합니다.",
      "Choose up to four saved places or start from your departure point. Include nearby districts and calculate a planning route for your time, budget and transport.",
    ],
    ABOUT: [
      "나우로는 부산에서 시작하는 한국 여행 정보 웹앱입니다. 이용가이드, 부산 여행 소식, 파트너 참여 안내를 제공합니다.",
      "NOWRO is a Korea travel information web app starting with Busan. Learn how to use it, read travel news and discover partner opportunities.",
    ],
  };
  const intro = introductions[tab][en ? 1 : 0];
  const labels = en
    ? ["Home", "Local guides", "Routes", "About NOWRO"]
    : ["홈", "지역가이드", "여행코스", "나우로 소개"];
  const links = publicTabs
    .map(
      (v, i) =>
        `<a href="/?lang=${en ? "en" : "ko"}${v === "NOW" ? "" : "&amp;tab=" + v}">${labels[i]}</a>`,
    )
    .join(" · ");
  const post = posts.find(
    (p) =>
      p.published &&
      p.board === url.searchParams.get("board") &&
      p.id === url.searchParams.get("post"),
  );
  const article = post
    ? `<article><h2>${xml(post.title)}</h2><p style="white-space:pre-line">${xml(post.body)}</p><p>${xml(post.updated?.slice(0, 10) || "")}</p></article>`
    : "";
  const summaries = en
    ? [
        [
          "What can I find?",
          "Festivals, performances, exhibitions and experiences are on Home. Local guides cover attractions and dining across all 16 Busan districts.",
        ],
        [
          "How do routes work?",
          "Choose up to four nearby places. Routes use estimated travel times and costs, including nearby districts. Confirm hours, prices and reservations with each venue.",
        ],
        [
          "How current is the information?",
          "Listings combine public tourism data, official cultural listings and approved provider submissions. Past events are hidden by default. Undated listings are not confirmation of this year’s event.",
        ],
      ]
    : [
        [
          "어떤 정보를 볼 수 있나요?",
          "홈에서는 축제·공연·전시·체험을, 지역가이드에서는 부산 16개 구·군의 관광지와 음식점 정보를 볼 수 있습니다.",
        ],
        [
          "여행코스는 어떻게 만드나요?",
          "가까운 장소를 최대 4개 선택하고 시간·예산·이동수단을 설정하세요. 구·군이 달라도 가까운 장소를 함께 묶으며, 이동시간과 비용은 계획용 예상치입니다.",
        ],
        [
          "정보는 어떤 기준으로 제공하나요?",
          "한국관광공사와 부산시 공공데이터, 공식 문화 일정 및 승인된 업체 등록 자료를 활용합니다. 지난 행사는 기본으로 숨기며 일정 미확인 자료를 올해 행사로 보장하지 않습니다.",
        ],
      ];
  const boardLinks = posts
    .filter((p) => p.published)
    .slice(0, 100)
    .map(
      (p) =>
        `<li><a href="/?tab=ABOUT&amp;board=${encodeURIComponent(p.board)}&amp;post=${encodeURIComponent(p.id)}">${xml(p.title)}</a></li>`,
    )
    .join("");
  return `<main style="max-width:1080px;margin:32px auto;padding:24px;font-family:Arial,sans-serif;line-height:1.7"><nav>${links}</nav><h1>${title}</h1><p>${intro}</p>${article}${summaries.map(([h, p]) => `<section><h2>${h}</h2><p>${p}</p></section>`).join("")}${boardLinks ? "<h2>" + (en ? "Latest guides" : "최신 가이드") + "</h2><ul>" + boardLinks + "</ul>" : ""}<p>${en ? "English and Korean travel information, starting with Busan." : "부산에서 시작해 한국 여행 정보를 연결합니다."}</p></main>`;
}
export function searchSitemap(posts: any[] = []) {
  const pages = [
    "/",
    "/?tab=MAP",
    "/?tab=ROUTES",
    "/?tab=ABOUT",
    "/?tab=ABOUT&board=guide",
    "/?tab=ABOUT&board=busan",
    "/?tab=ABOUT&board=partners",
  ];
  const rows = pages.flatMap((path) =>
    ["", "ko", "en"].map((lang) => {
      const u = new URL(path, "https://nowrokorea.com");
      if (lang) u.searchParams.set("lang", lang);
      return `<url><loc>${xml(u.href)}</loc></url>`;
    }),
  );
  for (const p of posts.filter((p) => p.published))
    rows.push(
      `<url><loc>${xml("https://nowrokorea.com/?tab=ABOUT&board=" + encodeURIComponent(p.board) + "&post=" + encodeURIComponent(p.id))}</loc>${/^\d{4}-\d{2}-\d{2}T/.test(p.updated || "") ? "<lastmod>" + xml(p.updated) + "</lastmod>" : ""}</url>`,
    );
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${rows.join("")}</urlset>`;
}
export function searchRss(posts: any[] = []) {
  const items = posts
    .filter((p) => p.published)
    .slice(0, 30)
    .map((p) => {
      const link =
        "https://nowrokorea.com/?tab=ABOUT&board=" +
        encodeURIComponent(p.board) +
        "&post=" +
        encodeURIComponent(p.id);
      return `<item><title>${xml(p.title)}</title><link>${xml(link)}</link><guid isPermaLink="true">${xml(link)}</guid><description>${xml(p.body)}</description></item>`;
    })
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>NOWRO Korea 여행 소식</title><link>https://nowrokorea.com/</link><description>부산 여행 가이드와 나우로 소식</description>${items}</channel></rss>`;
}

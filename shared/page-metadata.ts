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
  let [title, description] =
    tab === "ABOUT" && boards[board]
      ? boards[board]
      : entries[tab] || entries.NOW;
  const localized:Record<string,Record<string,[string,string]>>={
    ko:{NOW:['부산 여행·축제·공연·코스 | 나우로 코리아','부산의 축제·공연·전시·체험과 지역별 관광·맛집 정보를 찾고, 저장한 장소로 여행코스를 만들어보세요.'],MAP:['부산 지역별 관광·맛집 가이드 | 나우로 코리아','부산 16개 구·군의 관광지와 음식점 정보를 찾아보고 지도·주변 장소를 확인하세요.'],ROUTES:['부산 여행코스 만들기 | 나우로 코리아','가까운 장소를 골라 시간·예산·이동수단에 맞는 부산 여행코스를 계획하세요.'],ABOUT:['나우로 코리아 소개·이용가이드','부산에서 시작하는 한국 여행 정보, 이용가이드와 파트너 참여 안내를 확인하세요.']},
    en:{NOW:['Busan travel, events & routes | NOWRO Korea','Discover Busan festivals, performances, exhibitions and experiences. Explore local guides and plan a route with nearby stops.'],MAP:['Busan attractions & dining by district | NOWRO Korea','Explore attractions and dining across all 16 Busan districts. Find nearby places and open maps for your trip.'],ROUTES:['Plan your Busan travel route | NOWRO Korea','Choose nearby places and plan a Busan route around your available time, budget and transport.'],ABOUT:['About NOWRO Korea & travel guides','Meet NOWRO Korea, learn how to plan a Busan trip and find local partner information.']}
  };
  if(!boards[board]&&localized[url.searchParams.get('lang')||'']?.[tab]) [title,description]=localized[url.searchParams.get('lang')!][tab];
  const canonical = new URL("https://nowrokorea.com/");
  if (tab === "MAP" || tab === "ABOUT" || tab === 'ROUTES') canonical.searchParams.set("tab", tab);
  if (tab === "ABOUT" && boards[board])
    canonical.searchParams.set("board", board);
  const language=url.searchParams.get('lang');
  if(language==='ko'||language==='en')canonical.searchParams.set('lang',language);
  const post=url.searchParams.get('post');
  if(tab==='ABOUT'&&boards[board]&&post&&/^[a-zA-Z0-9_-]{1,100}$/.test(post))canonical.searchParams.set('post',post);
  const noindex =
    !entries[tab] ||
    ["token", "token_hash", "code", "error"].some((key) =>
      url.searchParams.has(key),
    );
  return { title, description, canonical: canonical.href, noindex };
}
export function renderPageMetadata(html: string, url: URL, options:{posts?:any[];growth?:any}={}) {
  const meta = pageMetadata(url),
    escape = (s: string) =>
      s
        .replaceAll("&", "&amp;")
        .replaceAll('"', "&quot;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");
  const locale=url.searchParams.get('lang')==='ko'?'ko':'en';
  const post=options.posts?.find(p=>p.published&&p.board===url.searchParams.get('board')&&p.id===url.searchParams.get('post'));
  if(url.searchParams.has('post')&&!post)meta.noindex=true;
  if(post){meta.title=post.title+' | NOWRO Korea';meta.description=post.body.replace(/\s+/g,' ').slice(0,160);const canonical=new URL(meta.canonical);canonical.searchParams.set('post',post.id);meta.canonical=canonical.href;}
  const structured:any[]=[{'@context':'https://schema.org','@type':'WebSite',name:'NOWRO Korea',url:'https://nowrokorea.com/',description:meta.description,inLanguage:['ko','en']},{'@context':'https://schema.org','@type':'Organization',name:'NOWRO Korea',url:'https://nowrokorea.com/',logo:'https://nowrokorea.com/brand/logo.webp'}];
  if(post)structured.push({'@context':'https://schema.org','@type':'Article',headline:post.title,dateModified:post.updated,mainEntityOfPage:meta.canonical,author:{'@type':'Organization',name:'NOWRO Korea'}});
  const growth=options.growth||{};
  let extras='';
  for(const [name,value]of [['naver-site-verification',growth.naverVerification],['google-site-verification',growth.googleVerification],['msvalidate.01',growth.bingVerification]])if(value&&/^[A-Za-z0-9_-]{8,200}$/.test(value))extras+=`<meta name="${name}" content="${escape(value)}" />`;
  if(!meta.noindex){
    extras+='<script type="application/ld+json">'+JSON.stringify(structured).replaceAll('<','\\u003c')+'</script>';
    if(!post)for(const language of ['ko','en','x-default']){const alt=new URL(meta.canonical);if(language==='x-default')alt.searchParams.delete('lang');else alt.searchParams.set('lang',language);extras+=`<link rel="alternate" hreflang="${language}" href="${escape(alt.href)}" />`;}
    extras+='<link rel="alternate" type="application/rss+xml" title="NOWRO Korea" href="https://nowrokorea.com/feed.xml" />';
  }
  return html.replace('<html lang="en">',`<html lang="${locale}">`)
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
      `<meta name="robots" content="${meta.noindex ? "noindex,nofollow" : "index,follow"}" />${extras}</head>`,
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

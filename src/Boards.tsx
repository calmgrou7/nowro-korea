import { visitorText } from "./visitor-copy";
import {analyticsPage,track} from './analytics';
import { useEffect, useState } from "react";
import { api } from "./api";
import { syncPageMetadata } from '../shared/page-metadata';
import { ArrowRight, Compass } from 'lucide-react';
const boards = [
  {
    id: "guide",
    title: "NOWRO 이용가이드",
    en: "NOWRO guide",
    description: "탐색부터 저장, 나만의 코스까지",
    enDescription: "Discover, save and build your own route.",
    image: "/brand/logo.webp",
    body: "1. 홈과 지역가이드에서 찾기\n홈에서는 축제·공연·전시·체험을, 지역가이드에서는 동네별 관광지·음식점·미식 이야기를 찾아보세요. 종료일이 확인된 행사는 기본 목록에서 제외되며, 지난 행사 포함을 켜면 종료된 자료도 볼 수 있습니다.\n\n2. 상세정보 확인하기\n장소의 주소와 일정, 이용 안내를 확인하세요. 주변 맛집·카페·쇼핑은 좌우로 넘겨볼 수 있습니다. 공식 안내와 지도에서 방문 정보를 다시 확인해주세요.\n\n3. 장소 저장하기\n북마크를 누르면 저장되고, 다시 누르면 취소됩니다. 하단 저장 메뉴에서 모아둔 장소를 확인하세요. 장소 저장은 현재 브라우저에 보관되므로 기기 변경이나 브라우저 데이터 삭제 시 유지되지 않을 수 있습니다.\n\n4. 코스 만들고 저장하기\n코스 메뉴에서 바로 조건을 입력하거나, 저장한 장소와 상세페이지의 주변 장소를 골라 시작하세요. 가까운 인접 구·군의 장소를 함께 최대 4개 선택할 수 있습니다. 출발점 기준 도보 3km, 대중교통·차량 8km 내에서 추천하며 실제 시간·예산 조건을 함께 계산합니다. 지역·여행 날짜·시간·예산·이동수단을 확인하고 코스를 계산하세요. 결과에서 방문 순서와 예상 시간·비용을 살펴본 뒤 마음에 드는 코스를 저장할 수 있습니다. 저장 화면에서는 저장한 장소와 저장한 코스를 구분해 확인합니다.\n\n5. 방문 전 확인하기\n추천은 계획용 예상 정보이며 예약이나 실제 영업을 보장하지 않습니다. 운영시간·입장료·예약 필요 여부는 공식 안내에서 확인하고, 지도·길찾기로 이동하세요.\n\n6. 향후 쿠폰·할인 혜택\n코스 화면의 코스 주변 혜택 영역에 사용 조건이 확인된 쿠폰·할인행사를 연결할 예정입니다. 현재 연결된 혜택은 없으며, 할인 금액이 자동 적용되지 않습니다.",
    enBody:
      "1. Discover on Home and Local guides\nBrowse festivals, performances, exhibitions and experiences on Home. Use Local guides for neighborhood attractions and dining. Events with confirmed end dates are hidden after they end; turn on Include past events to view them.\n\n2. Check the details\nReview the address, dates and visitor information. Swipe through nearby dining, cafés and shops. Check official sources and maps before visiting.\n\n3. Save places\nTap the bookmark to save, and tap again to remove. Open Saved to see your collection. Places are stored in this browser and may not carry over to another device or survive cleared browser data.\n\n4. Build and save a route\nOpen Routes to start with your preferences, or choose saved places and nearby stops from a detail page. Select up to four nearby stops across district boundaries. Recommendations search within 3 km on foot or 8 km by transit/car from your start and check estimated time and budget. Check your dates, available time, budget and transport, then calculate a route. Review the order, estimated travel time and costs before saving. Saved separates your places from your saved routes.\n\n5. Check before visiting\nRoutes are planning estimates, not reservations or confirmation that a venue is open. Confirm hours, prices and reservations with the official venue, then use maps for directions.\n\n6. Future coupons and promotions\nVerified offers will be connected to Offers along your route in the future. There are no connected offers yet and no discount is automatically deducted.",
  },
  {
    id: "busan",
    title: "부산여행을 시작하세요",
    en: "Start your Busan trip",
    description: "부산의 동네와 여행 소식을 만나보세요",
    enDescription: "Find your neighborhood and your next experience.",
    image: "/images/gwangalli.webp",
    body: "바다와 골목, 오늘의 부산.\n나우로는 부산을 시작으로 한국의 여행 정보를 연결합니다.\n\n오늘의 행사부터\n홈에서 축제·공연·전시·체험을 살펴보고 여행 날짜에 맞는 일정을 확인해보세요.\n\n동네를 더 깊이\n지역별가이드에서 부산 16개 구·군의 관광지와 음식점, 미식 여행 이야기를 찾아보세요.\n\n여행 동선을 함께\n상세페이지의 지도와 주변 맛집·카페·쇼핑 정보를 참고해 이동을 계획하세요. 주변 장소는 좌표와 공공데이터 제공 범위에 따라 표시됩니다.\n\n정보의 기준\n공공 관광정보와 직접 등록된 콘텐츠를 함께 소개합니다. 각 상세페이지 하단의 출처와 공식 안내를 확인하세요.",
    enBody:
      "By the sea and through the neighborhoods of Busan.\nNOWRO connects travel information across Korea, starting with Busan.\n\nStart with events\nExplore festivals, performances, exhibitions and experiences on Home. Check the dates for your visit.\n\nExplore locally\nLocal guides introduce attractions, dining and food stories across Busan’s 16 districts.\n\nConnect your stops\nUse maps and nearby dining, cafés and shopping on detail pages. Availability depends on coordinates and the public data provided.\n\nKnow your sources\nWe feature public tourism information and contributed content. Check the source and official link on each detail page.",
  },
  {
    id: "partners",
    title: "파트너를 구합니다",
    en: "Become a partner",
    description: "지역의 매력을 함께 소개할 파트너",
    enDescription: "Help travelers discover your local story.",
    image: "/brand/logo.webp",
    body: "부산의 매력을 함께 소개해주세요.\n음식점·카페·상점 운영자, 체험 크리에이터, 문화시설과 행사 담당자를 기다립니다.\n\n어떤 내용을 등록하나요?\n방문객에게 필요한 장소 소개, 주소, 일정, 이용 안내와 사용 권한이 있는 사진을 준비해주세요. 외국인 여행객도 이해할 수 있는 영문 설명을 함께 준비하면 좋습니다.\n\n어떻게 참여하나요?\n로그인 후 전문가·상점 등록 메뉴에서 업체 승인 신청을 진행하세요. 담당자 및 업체 확인 후 제공되는 관리 화면에서 콘텐츠를 등록하고 심사를 요청할 수 있습니다.\n\n게시 전 확인\n신청과 콘텐츠 등록은 즉시 공개를 의미하지 않습니다. 관리자 검토 및 승인 후 노출됩니다. 변경된 영업정보나 종료된 행사는 담당자가 최신 정보로 관리해주세요.\n\n앞으로의 연결\n상점 상품·예약·광고 서비스는 단계적으로 준비하는 기능입니다. 현재 이 안내는 입점 계약이나 유료 광고 신청을 대신하지 않습니다.",
    enBody:
      "Share your local story with travelers.\nWe welcome restaurant, café and shop owners, experience creators, cultural venues and event organizers.\n\nPrepare your information\nAdd a useful description, address, dates, visitor information and photos you have permission to use. English descriptions help international travelers.\n\nApply to participate\nSign in and apply through the expert / business registration menu. After ownership review, use the management area to submit content for approval.\n\nBefore publication\nApplications and submissions are reviewed before they appear publicly. Keep opening information and event dates up to date.\n\nFuture services\nProducts, reservations and advertising are planned in stages. This guide is not an entry contract or a paid advertising application.",
  },
];
export function Boards({
  lang,
  page = false,
}: {
  lang: string;
  page?: boolean;
}) {
  const [posts, setPosts] = useState<any[]>([]),
    [failed, setFailed] = useState(false),
    [loading, setLoading] = useState(true);
  const [query, setQuery] = useState(
    () => new URLSearchParams(location.search),
  );
  const L = (ko: string, en: string) => visitorText(lang, ko, en);
  useEffect(()=>{if(page)syncPageMetadata();},[query,page]);
  useEffect(() => {
    const back = () => setQuery(new URLSearchParams(location.search));
    addEventListener("popstate", back);
    return () => removeEventListener("popstate", back);
  }, []);
  useEffect(() => {
    let active = true;
    api("boards")
      .then((v) => {
        if (active) setPosts(v.posts || []);
      })
      .catch(() => {
        if (active) setFailed(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  const board = page
    ? boards.find((b) => b.id === query.get("board"))
    : undefined;
  const selected = posts.find(
    (p) => p.board === board?.id && p.id === query.get("post"),
  );
  useEffect(()=>{if(page){analyticsPage();if(selected)track('view_item','post-'+selected.id);}},[page,query.toString(),selected?.id]);
  const go = (id?: string, post?: string) => {
    const url = new URL(location.href);
    url.searchParams.set("tab", "ABOUT");
    url.searchParams.delete("board");
    url.searchParams.delete("post");
    if (id) url.searchParams.set("board", id);
    if (post) url.searchParams.set("post", post);
    history.pushState(null, "", url);
    setQuery(new URLSearchParams(url.search));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const cards = (
    <div className="source-grid">
      {boards.map((b) => (
        <a
          key={b.id}
          className="board-card"
          href={"?tab=ABOUT&board=" + b.id}
          onClick={
            page
              ? (e) => {
                  e.preventDefault();
                  go(b.id);
                }
              : undefined
          }
        >
          <div
            className={"board-cover " + (b.id !== "busan" ? "board-logo" : "")}
          >
            <img src={b.image} alt="" />
          </div>
          <div>
            <h3>{L(b.title, b.en)}</h3>
            <p>{L(b.description, b.enDescription)}</p>
            <span className="board-card-action">{L("게시판 보기", "Open board")}<ArrowRight size={15} aria-hidden="true"/></span>
          </div>
        </a>
      ))}
    </div>
  );
  if (!page)
    return (
      <section id="about-nowro" className="section boards-section">
        <div className="section-heading">
          <h2>{L("나우로 소개", "About NOWRO")}</h2>
          <a className="action-link" href="?tab=ABOUT"><Compass size={16} aria-hidden="true"/>{L("나우로 알아보기", "Meet NOWRO")}<ArrowRight size={15} aria-hidden="true"/></a>
        </div>
        {cards}
      </section>
    );
  return (
    <section className="section about-page">
      <nav
        className="about-breadcrumb"
        aria-label={L("현재 위치", "Breadcrumb")}
      >
        <a href="?">{L("홈", "Home")}</a>
        <span>/</span>
        {board ? (
          <>
            <button className="text-btn" onClick={() => go()}>
              {L("나우로 소개", "About NOWRO")}
            </button>
            <span>/</span>
            <span>{L(board.title, board.en)}</span>
          </>
        ) : (
          <span>{L("나우로 소개", "About NOWRO")}</span>
        )}
      </nav>
      {!board ? (
        <>
          <div className="about-hero">
            <span className="eyebrow">YOUR KOREA. RIGHT NOW.</span>
            <h1>
              {L(
                "한국의 오늘을, 나만의 여행으로.",
                "Your Korea. Your next discovery.",
              )}
            </h1>
            <p>
              {L(
                "나우로는 지금 만날 수 있는 행사와 동네의 매력을 발견하고, 마음에 드는 장소를 모아 나만의 여행 동선을 만드는 여행 가이드입니다.",
                "NOWRO helps you discover local events and neighborhoods, save places you love and plan your own journey.",
              )}
            </p>
            <span>
              {L(
                "부산에서 시작해, 한국 곳곳으로.",
                "Starting in Busan. Growing across Korea.",
              )}
            </span>
          </div>
          <div className="about-values">
            {[
              [
                L("발견", "Discover"),
                L(
                  "축제·공연·전시·체험을 한곳에서",
                  "Events, exhibitions and experiences in one place",
                ),
              ],
              [
                L("연결", "Connect"),
                L(
                  "동네의 관광지부터 주변 맛집과 카페까지",
                  "From local sights to nearby dining and cafés",
                ),
              ],
              [
                L("나만의 여행", "Make it yours"),
                L(
                  "저장한 장소와 시간에 맞춘 코스",
                  "Saved places and routes that fit your time",
                ),
              ],
            ].map(([title, body]) => (
              <article key={title}>
                <h2>{title}</h2>
                <p>{body}</p>
              </article>
            ))}
          </div>
          <h2>{L("나우로와 함께 시작하기", "Start with NOWRO")}</h2>
          {cards}
        </>
      ) : (
        <>
          <header className="board-heading">
            <span className="eyebrow">NOWRO JOURNAL</span>
            <h1>{L(board.title, board.en)}</h1>
            <p>{L(board.description, board.enDescription)}</p>
          </header>
          <nav
            className="quick-categories"
            aria-label={L("게시판 선택", "Choose a board")}
          >
            {boards.map((b) => (
              <button
                key={b.id}
                aria-pressed={b.id === board.id}
                onClick={() => go(b.id)}
              >
                {L(b.title, b.en)}
              </button>
            ))}
          </nav>
          {selected ? (
            <article className="about-post">
              <button className="text-btn" onClick={() => go(board.id)}>
                {L("← 글 목록", "← Posts")}
              </button>
              <h2>{selected.title}</h2>
              <time>{selected.updated?.slice(0, 10)}</time>
              {selected.image && <img src={selected.image} alt="" />}
              <p>{selected.body}</p>
            </article>
          ) : (
            <>
              <article className="about-post">
                <span className="board-pinned">
                  {L("기본 안내", "Getting started")}
                </span>
                <h2>{L(board.title, board.en)}</h2>
                <p>{L(board.body, board.enBody)}</p>
              </article>
              <h2>{L("게시판 소식", "Board updates")}</h2>
              {loading ? (
                <p role="status">
                  {L("게시글을 불러오고 있습니다.", "Loading posts…")}
                </p>
              ) : failed ? (
                <p role="alert">
                  {L(
                    "추가 게시글을 불러오지 못했습니다. 새로고침해주세요.",
                    "Unable to load additional posts. Please reload.",
                  )}
                </p>
              ) : posts.some((p) => p.board === board.id) ? (
                posts
                  .filter((p) => p.board === board.id)
                  .map((p) => (
                    <a
                      className="board-post-row"
                      key={p.id}
                      href={
                        "?tab=ABOUT&board=" +
                        board.id +
                        "&post=" +
                        encodeURIComponent(p.id)
                      }
                      onClick={(e) => {
                        e.preventDefault();
                        go(board.id, p.id);
                      }}
                    >
                      <strong>{p.title}</strong>
                      <time>{p.updated?.slice(0, 10)}</time>
                    </a>
                  ))
              ) : (
                <p className="muted">
                  {L(
                    "새로운 소식이 등록되면 이곳에서 확인할 수 있습니다.",
                    "New updates will appear here when published.",
                  )}
                </p>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}
const empty = {
  id: "",
  board: "guide",
  title: "",
  body: "",
  image: "",
  published: false,
};
export function BoardAdmin() {
  const [posts, setPosts] = useState<any[]>([]),
    [form, setForm] = useState(empty),
    [message, setMessage] = useState("");
  const load = () => api("operator/boards").then((v) => setPosts(v.posts));
  useEffect(() => {
    load().catch(() => setMessage("게시판을 불러오지 못했습니다."));
  }, []);
  return (
    <section className="panel">
      <h2>나우로 소개 · 게시판 관리</h2>
      <button onClick={() => setForm(empty)}>새 글 작성</button>
      <div>
        {posts.map((p) => (
          <button
            className="board-post-row"
            key={p.id}
            onClick={() => setForm(p)}
          >
            {p.title} · {p.published ? "게시 중" : "초안"}
          </button>
        ))}
      </div>
      <label>
        게시판
        <select
          value={form.board}
          onChange={(e) => setForm({ ...form, board: e.target.value })}
        >
          {boards.map((b) => (
            <option key={b.id} value={b.id}>
              {b.title}
            </option>
          ))}
        </select>
      </label>
      <label>
        제목
        <input
          value={form.title}
          maxLength={150}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
        />
      </label>
      <label>
        본문
        <textarea
          rows={8}
          value={form.body}
          maxLength={12000}
          onChange={(e) => setForm({ ...form, body: e.target.value })}
        />
      </label>
      <label>
        이미지 주소 (선택)
        <input
          value={form.image}
          onChange={(e) => setForm({ ...form, image: e.target.value })}
          placeholder="https://..."
        />
      </label>
      <label>
        <input
          type="checkbox"
          checked={form.published}
          onChange={(e) => setForm({ ...form, published: e.target.checked })}
        />
        공개 게시 (해제하면 비공개)
      </label>
      <button
        className="primary"
        onClick={async () => {
          try {
            await api("operator/boards/save", {
              ...form,
              id: form.id || undefined,
            });
            await load();
            setForm(empty);
            setMessage("저장되었습니다.");
          } catch {
            setMessage(
              "저장 실패: 제목·본문·이미지 주소와 관리자 로그인을 확인해주세요.",
            );
          }
        }}
      >
        저장
      </button>
      <p role="status">{message}</p>
    </section>
  );
}

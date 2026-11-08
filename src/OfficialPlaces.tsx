import { useEffect, useState } from "react";
import { api } from "./api";
import { Modal } from "./Modal";
import { MapPin, Clock3, Bookmark, Check, Route } from "lucide-react";
import { savePlace, readSavedPlaces, savedPlaceId } from "./SavedPlaces";
import { NearbyShops } from "./NearbyShops";
import { eventExpired } from "../shared/event-dates";
function TourismImage({
  src,
  title,
  lang,
}: {
  src?: string;
  title: string;
  lang: string;
}) {
  const valid = /^https?:\/\//.test(src || "") || /^\/images\//.test(src || "");
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  const fallback = !valid || failed;
  return (
    <figure
      className={
        "tourism-image" + (fallback ? " tourism-image-placeholder" : "")
      }
    >
      {fallback ? (
        <div
          className="tourism-placeholder"
          role="img"
          aria-label={
            lang === "ko" ? "장소 사진 준비 중" : "Venue photo unavailable"
          }
        >
          <img src="/brand/logo.webp" alt="NOWRO" />
        </div>
      ) : (
        <img
          src={src!.replace(
            /^http:\/\/tong.visitkorea.or.kr\//,
            "https://tong.visitkorea.or.kr/",
          )}
          alt={title}
          loading="lazy"
          onError={() => setFailed(true)}
        />
      )}
    </figure>
  );
}
export function OfficialPlaces({
  lang,
  onPlan,
  onPlanMany,
  districtNames = [],
  onClearDistrict,
  regional = false,
}: {
  lang: string;
  onPlan?: (item?: any) => void | boolean | Promise<void | boolean>;
  onPlanMany?: (items: any[]) => void | boolean | Promise<void | boolean>;
  districtNames?: string[];
  onClearDistrict?: () => void;
  regional?: boolean;
}) {
  const [items, setItems] = useState<any[]>([]);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [feedReason, setFeedReason] = useState("");
  const [originFallback, setOriginFallback] = useState(false);
  const [originPartial, setOriginPartial] = useState(false);
  const [category, setCategory] = useState(regional ? "places" : "festivals");
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(6);
  useEffect(() => setLimit(6), [districtNames.join("|")]);
  const [retry, setRetry] = useState(0);
  const [includePast, setIncludePast] = useState(false);
  const [today, setToday] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setToday(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);
  const eventCategory = [
    "festivals",
    "performances",
    "exhibitions",
    "ocean",
  ].includes(category);
  const [savedIds, setSavedIds] = useState<string[]>(() =>
    readSavedPlaces().map(savedPlaceId),
  );
  useEffect(() => {
    const update = () => setSavedIds(readSavedPlaces().map(savedPlaceId));
    window.addEventListener("nowro-saved", update);
    return () => window.removeEventListener("nowro-saved", update);
  }, []);
  const [selected, setSelected] = useState<any>(null);
  const [routeBusy, setRouteBusy] = useState(false);
  const [detailMessage, setDetailMessage] = useState("");
  useEffect(() => setDetailMessage(""), [selected?.UC_SEQ]);
  useEffect(() => {
    if (!selected?.kopisId) return;
    let active = true;
    const id = selected.kopisId;
    api("performance-detail?id=" + encodeURIComponent(id))
      .then((feed) => {
        const detail = feed.items?.[0];
        if (active && detail)
          setSelected((previous: any) =>
            previous?.kopisId === id
              ? {
                  ...previous,
                  ...detail,
                  SUBTITLE: detail.ADDR1 || previous.SUBTITLE,
                }
              : previous,
          );
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [selected?.kopisId]);
  const [listings, setListings] = useState<any[]>([]);
  useEffect(() => {
    api("listings")
      .then((v) => setListings(v.listings || []))
      .catch(() => {});
  }, []);
  useEffect(() => {
    setQuery("");
    setLimit(6);
  }, [category, lang]);
  const extra = listings
    .filter((v) =>
      category === "festivals"
        ? v.data.kind === "event"
        : category === "ocean"
          ? v.data.kind === "experience" || v.data.kind === "service"
          : false,
    )
    .map((v) => ({
      UC_SEQ: v.id,
      MAIN_TITLE: lang === "ko" ? v.data.titleKo : v.data.titleEn,
      ADDR1: v.data.address,
      ITEMCNTNTS: lang === "ko" ? v.data.descriptionKo : v.data.descriptionEn,
      MAIN_IMG_NORMAL: v.data.images[0],
      USAGE_DAY_WEEK_AND_TIME: v.data.eventStart
        ? v.data.eventStart + " – " + v.data.eventEnd
        : v.data.hours,
      sourceLabel: "NOWRO · " + v.data.businessName,
    }));
  const expiredCount = [...items, ...extra].filter(
    (item) => eventCategory && eventExpired(item, today),
  ).length;
  const matched = [...items, ...extra].filter((item) => {
    const text = [
      item.title,
      item.MAIN_TITLE,
      item.addr1,
      item.ADDR1,
      item.GUGUN_NM,
      item.PLACE,
    ]
      .join(" ")
      .toLocaleLowerCase();
    const compact = (v: string) => v.toLocaleLowerCase().replace(/[\s-]/g, "");
    return (
      (!eventCategory || includePast || !eventExpired(item, today)) &&
      text.includes(query.trim().toLocaleLowerCase()) &&
      (!districtNames.length ||
        districtNames
          .filter(Boolean)
          .some((name) => compact(text).includes(compact(name))))
    );
  });
  useEffect(() => {
    let active = true;
    setItems([]);
    setLoading(true);
    setFailed(false);
    setFeedReason("");
    setOriginFallback(false);
    setOriginPartial(false);
    const tourism = lang === "ko" ? "kor" : "eng";
    const food = (item: any) =>
      ["39", "82"].includes(String(item.contenttypeid));
    const paths = [
      category === "places" || category === "foodie"
        ? tourism
        : category === "localguides"
          ? "foodie"
          : category,
    ];
    Promise.allSettled(
      paths.map((path) =>
        api(path === "performances" ? "performances" : "openapi/" + path),
      ),
    )
      .then((results) => {
        if (!active) return;
        const feeds = results
          .filter(
            (r): r is PromiseFulfilledResult<any> => r.status === "fulfilled",
          )
          .map((r) => r.value);
        setFeedReason(feeds.find((v) => v.reason)?.reason || "");
        setOriginFallback(feeds.some((v) => v.transport === "official_portal"));
        setOriginPartial(feeds.some((v) => v.partial));
        const rows = feeds
          .flatMap((v) => (Array.isArray(v.items) ? v.items : []))
          .map((item) =>
            item.res_no
              ? {
                  ...item,
                  UC_SEQ: item.res_no,
                  MAIN_TITLE: item.title,
                  ADDR1: item.place_nm,
                  USAGE_DAY_WEEK_AND_TIME: [item.op_st_dt, item.op_ed_dt]
                    .filter(Boolean)
                    .join(" – "),
                  ITEMCNTNTS:
                    item.ITEMCNTNTS ||
                    [item.showtime, item.rating, item.price, item.casting]
                      .filter(Boolean)
                      .join("\n"),
                  sourceLabel: item.sourceLabel || "부산문화포털 다봄",
                }
              : item,
          );
        const filtered =
          category === "places"
            ? rows.filter((item) => !food(item))
            : category === "foodie"
              ? rows.filter(food)
              : rows;
        setItems(filtered);
        setFailed(!feeds.some((v) => v.status === "ok") && !filtered.length);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [lang, category, retry]);
  return (
    <section className="data-sources">
      <div className="section-heading">
        <h2>
          {regional
            ? lang === "ko"
              ? "동네의 장소와 미식"
              : "Places and dining by district"
            : lang === "ko"
              ? "어디를 찾아볼까요?"
              : "Find your next stop"}
        </h2>
        {onPlan && (
          <button className="primary" onClick={() => onPlan()}>
            {lang === "ko" ? "코스" : "Routes"}
          </button>
        )}
      </div>
      {!!districtNames.length && (
        <div className="event-filter">
          <strong>
            {lang === "ko"
              ? districtNames[0]
              : districtNames[1] || districtNames[0]}
          </strong>
          <button className="text-btn" onClick={onClearDistrict}>
            {lang === "ko" ? "전체 지역 보기" : "All districts"}
          </button>
        </div>
      )}
      <div className="quick-categories">
        {(regional
          ? [
              ["places", "관광지", "Places"],
              ["foodie", "음식점", "Restaurants"],
              ["localguides", "미식 여행 가이드", "Food travel guides"],
            ]
          : [
              ["festivals", "축제", "Festivals"],
              ["performances", "공연", "Performances"],
              ["exhibitions", "전시", "Exhibitions"],
              ["ocean", "체험", "Experiences"],
            ]
        ).map(([id, ko, en]) => (
          <button
            key={id}
            aria-pressed={category === id}
            onClick={() => setCategory(id)}
          >
            {lang === "ko" ? ko : en}
          </button>
        ))}
      </div>
      {category === "festivals" && (
        <p className="notice">
          {lang === "ko"
            ? "축제 소개 자료입니다. 지난 연도 일정이 포함될 수 있으므로 올해 개최 일정은 주최기관에서 확인해주세요."
            : "Festival reference guide. Dates may refer to past editions; confirm current dates with the organizer."}
        </p>
      )}
      {category === "exhibitions" && originFallback && (
        <p className="notice">
          {lang === "ko"
            ? "전시 API 응답 지연으로 부산문화포털의 공식 공개 일정을 자동으로 보완해 보여드립니다."
            : "The exhibition API is delayed. Listings are supplemented automatically from the official Busan Culture Portal."}
          {originPartial &&
            (lang === "ko"
              ? " 일부 일정만 불러왔습니다. 전체 일정은 공식 원문에서 확인해주세요."
              : " Some listings could not be loaded. Check the official portal for the full schedule.")}
        </p>
      )}
      {loading && (
        <p role="status">
          {lang === "ko" ? "관광정보를 불러오는 중입니다." : "Loading places…"}
        </p>
      )}
      {eventCategory && (
        <div className="event-filter">
          <label>
            <input
              type="checkbox"
              checked={includePast}
              onChange={(e) => {
                setIncludePast(e.target.checked);
                setLimit(6);
              }}
            />
            {lang === "ko" ? "지난 행사 포함" : "Include past events"}
          </label>
          <small className="muted">
            {lang === "ko"
              ? `부산 시간 기준 · 종료 일정 ${expiredCount}건 · 종료일 미확인 정보는 포함됩니다.`
              : `Busan time · ${expiredCount} ended · Listings without a confirmed end date remain visible.`}
          </small>
        </div>
      )}
      <label>
        {lang === "ko"
          ? "이 목록에서 장소·지역 찾기"
          : "Find a place or neighborhood in this list"}
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setLimit(6);
          }}
        />
      </label>
      {failed && (
        <div role="status">
          <p>
            {feedReason === "upstream_timeout"
              ? lang === "ko"
                ? "자료 제공처의 응답이 지연되고 있습니다. 잠시 후 다시 확인해주세요."
                : "The data provider is taking longer to respond. Please try again later."
              : lang === "ko"
                ? "정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요."
                : "Information is temporarily unavailable. Please try again shortly."}
          </p>
          <button onClick={() => setRetry((v) => v + 1)}>
            {lang === "ko" ? "다시 불러오기" : "Try again"}
          </button>
          {category === "exhibitions" && (
            <a
              className="action-link"
              href="https://busandabom.net/play/list.nm?menuCd=8&lang=ko&url=play&prg_cd=140"
              target="_blank"
              rel="noreferrer"
            >
              {lang === "ko"
                ? "부산문화포털에서 확인"
                : "Visit Busan Culture Portal"}{" "}
              ↗
            </a>
          )}
        </div>
      )}
      {!loading && !failed && !items.length && (
        <p>
          {lang === "ko"
            ? "현재 제공된 정보가 없습니다."
            : "No information is currently available."}
        </p>
      )}
      {!loading && items.length > 0 && !matched.length && (
        <p role="status">
          {lang === "ko" ? "검색 결과가 없습니다." : "No matching places."}
        </p>
      )}
      <div className="source-grid">
        {matched.slice(0, limit).map((original) => {
          const item = {
            ...original,
            UC_SEQ: category + "-" + (original.contentid || original.UC_SEQ),
            routePlaceId: original.contentid
              ? "kto-" + original.contentid
              : original.routePlaceId || null,
            MAIN_TITLE: original.title || original.MAIN_TITLE,
            SUBTITLE: original.addr1 || original.ADDR1 || original.PLACE,
            MAIN_IMG_NORMAL: original.firstimage || original.MAIN_IMG_NORMAL,
            ITEMCNTNTS: original.ITEMCNTNTS || original.addr2,
          };
          return (
            <article className="source-card tourism-card" key={item.UC_SEQ}>
              <div className="tourism-card-media">
                <TourismImage
                  src={item.MAIN_IMG_NORMAL}
                  title={item.MAIN_TITLE || item.TITLE}
                  lang={lang}
                />
                <button
                  className="tourism-save"
                  aria-label={
                    savedIds.includes(savedPlaceId(item))
                      ? lang === "ko"
                        ? "저장 취소"
                        : "Unsave place"
                      : lang === "ko"
                        ? "장소 저장"
                        : "Save place"
                  }
                  aria-pressed={savedIds.includes(savedPlaceId(item))}
                  onClick={() => savePlace(item)}
                >
                  {savedIds.includes(savedPlaceId(item)) ? (
                    <Check size={17} aria-hidden="true" />
                  ) : (
                    <Bookmark size={17} aria-hidden="true" />
                  )}
                </button>
                <span className="tourism-district">
                  <MapPin size={12} aria-hidden="true" />
                  {original.GUGUN_NM ||
                    String(item.SUBTITLE || "").match(
                      /[가-힣]+[구군](?=\s|$)|[A-Za-z]+-(?:gu|gun)/,
                    )?.[0] ||
                    (lang === "ko" ? "부산" : "Busan")}
                </span>
              </div>
              {eventCategory && eventExpired(item, today) && (
                <span className="event-ended">
                  {lang === "ko" ? "종료된 일정" : "Event ended"}
                </span>
              )}
              <h3 title={item.MAIN_TITLE || item.TITLE}>
                {item.MAIN_TITLE || item.TITLE}
              </h3>
              <p
                className="tourism-address"
                title={item.SUBTITLE || item.PLACE}
              >
                <MapPin size={14} aria-hidden="true" />
                <span>
                  {item.SUBTITLE ||
                    item.PLACE ||
                    (lang === "ko" ? "주소 확인 필요" : "Address unverified")}
                </span>
              </p>
              {item.ITEMCNTNTS && (
                <p className="tourism-summary">
                  {String(item.ITEMCNTNTS)
                    .replace(/<[^>]*>/g, " ")
                    .replace(/\s+/g, " ")
                    .trim()}
                </p>
              )}
              {original.USAGE_DAY_WEEK_AND_TIME && (
                <p
                  className="tourism-schedule"
                  title={original.USAGE_DAY_WEEK_AND_TIME}
                >
                  <Clock3 size={14} aria-hidden="true" />
                  <span>{original.USAGE_DAY_WEEK_AND_TIME}</span>
                </p>
              )}
              <div className="tourism-actions">
                <button onClick={() => setSelected(item)}>
                  {lang === "ko" ? "상세보기 ›" : "Details ›"}
                </button>
                {onPlan && (
                  <button
                    disabled={eventCategory && eventExpired(item, today)}
                    onClick={() => onPlan(item)}
                  >
                    {lang === "ko" ? "이 장소 포함 코스 ＋" : "Add to route ＋"}
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>
      {matched.length > limit && (
        <button onClick={() => setLimit((v) => v + 6)}>
          {lang === "ko" ? "더 보기" : "Show more"} (
          {Math.min(limit, matched.length)}/{matched.length})
        </button>
      )}
      <p>
        <small className="muted">
          {category === "exhibitions" && originFallback
            ? lang === "ko"
              ? "출처: 부산문화포털 다봄 · 공식 전시 일정"
              : "Source: Busan Culture Portal · official exhibition listings"
            : category === "performances"
              ? "출처: KOPIS · 공연예술통합전산망 / 부산문화포털"
              : category === "places" || category === "foodie"
                ? lang === "ko"
                  ? "출처: 한국관광공사"
                  : "Source: Korea Tourism Organization"
                : lang === "ko"
                  ? "출처: 부산광역시 · 공식 원문 / NOWRO 등록 콘텐츠"
                  : "Source: Busan Metropolitan City / NOWRO listings"}
        </small>
      </p>
      {selected && (
        <Modal title={selected.MAIN_TITLE} close={() => setSelected(null)}>
          {eventCategory && eventExpired(selected, today) && (
            <p className="event-ended">
              {lang === "ko"
                ? "종료된 일정입니다. 지난 행사 자료로 확인해주세요."
                : "This event has ended. This listing is for reference."}
            </p>
          )}
          <TourismImage
            src={selected.MAIN_IMG_NORMAL}
            title={selected.MAIN_TITLE}
            lang={lang}
          />
          <h3>{lang === "ko" ? "위치" : "Location"}</h3>
          <p>
            {selected.SUBTITLE ||
              (lang === "ko" ? "주소 확인 필요" : "Address to be confirmed")}
          </p>
          <h3>{lang === "ko" ? "운영시간·일정" : "Hours and dates"}</h3>
          <p>
            {selected.USAGE_DAY_WEEK_AND_TIME ||
              (lang === "ko"
                ? "방문 전 운영기관에 확인해주세요."
                : "Confirm with the venue before visiting.")}
          </p>
          <h3>{lang === "ko" ? "소개" : "About"}</h3>
          <p style={{ whiteSpace: "pre-line" }}>
            {selected.ITEMCNTNTS ||
              (lang === "ko"
                ? "상세 소개가 제공되지 않았습니다."
                : "A detailed description is not available.")}
          </p>
          {selected.CNTCT_TEL && <p>{selected.CNTCT_TEL}</p>}
          <div
            className="detail-primary-actions"
            aria-label={
              lang === "ko"
                ? "현재 장소 저장 및 코스 선택"
                : "Save this place or select it for a route"
            }
          >
            <button
              className="detail-save"
              aria-pressed={savedIds.includes(savedPlaceId(selected))}
              onClick={() => savePlace(selected)}
            >
              {savedIds.includes(savedPlaceId(selected)) ? (
                <Check size={18} aria-hidden="true" />
              ) : (
                <Bookmark size={18} aria-hidden="true" />
              )}
              {savedIds.includes(savedPlaceId(selected))
                ? lang === "ko"
                  ? "저장됨 · 취소"
                  : "Saved · remove"
                : lang === "ko"
                  ? "저장"
                  : "Save"}
            </button>
            {onPlan && (
              <button
                className="detail-plan"
                disabled={
                  routeBusy || (eventCategory && eventExpired(selected, today))
                }
                aria-busy={routeBusy}
                onClick={async () => {
                  setRouteBusy(true);
                  setDetailMessage("");
                  try {
                    const ok = await onPlan(selected);
                    if (ok !== false) setSelected(null);
                    else
                      setDetailMessage(
                        lang === "ko"
                          ? "현재 장소의 위치·일정 확인이 필요해 코스에 연결하지 못했습니다."
                          : "This place needs verified location or schedule information before it can be added.",
                      );
                  } catch {
                    setDetailMessage(
                      lang === "ko"
                        ? "코스 연결에 실패했습니다. 잠시 후 다시 시도해주세요."
                        : "Unable to connect this place to a route. Please try again.",
                    );
                  } finally {
                    setRouteBusy(false);
                  }
                }}
              >
                <Route size={18} aria-hidden="true" />
                {routeBusy
                  ? lang === "ko"
                    ? "연결 중…"
                    : "Connecting…"
                  : lang === "ko"
                    ? "코스 선택"
                    : "Select for route"}
              </button>
            )}
          </div>
          {detailMessage && (
            <p className="notice" role="status">
              {detailMessage}
            </p>
          )}
          <NearbyShops
            item={selected}
            lang={lang}
            onPlan={async (item) => {
              const ok = await onPlan?.(item);
              if (ok !== false) setSelected(null);
            }}
            onPlanMany={
              onPlanMany
                ? async (items) => {
                    const ok = await onPlanMany(items);
                    if (ok !== false) setSelected(null);
                  }
                : undefined
            }
          />
          <a
            className="action-link"
            href={
              "https://www.google.com/maps/search/?api=1&query=" +
              encodeURIComponent(selected.SUBTITLE || selected.MAIN_TITLE)
            }
            target="_blank"
            rel="noreferrer"
          >
            <MapPin size={16} aria-hidden="true" />
            {lang === "ko" ? "지도·길찾기" : "Map and directions"} ↗
          </a>
          <p>
            <small className="muted">
              {["https://www.kopis.or.kr/", "https://busandabom.net/"].some(
                (prefix) => selected.sourceUrl?.startsWith(prefix),
              ) ? (
                <a href={selected.sourceUrl} target="_blank" rel="noreferrer">
                  {selected.sourceLabel} ↗
                </a>
              ) : (
                selected.sourceLabel ||
                (category === "places"
                  ? "Korea Tourism Organization"
                  : "Busan Metropolitan City")
              )}
            </small>
          </p>
        </Modal>
      )}
    </section>
  );
}

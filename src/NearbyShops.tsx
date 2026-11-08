import { useEffect, useState } from "react";
import { api } from "./api";
import { savePlace, readSavedPlaces, savedPlaceId } from "./SavedPlaces";
import {
  MapPin,
  Route,
  Bookmark,
  Check,
  Utensils,
  Coffee,
  ShoppingBag,
  Sparkles,
} from "lucide-react";
export function NearbyShops({
  item,
  lang,
  onPlan,
  onPlanMany,
}: {
  item: any;
  lang: string;
  onPlan?: (item: any) => void;
  onPlanMany?: (items: any[]) => void;
}) {
  const originalLat = Number(item.mapy || item.LAT),
    originalLng = Number(item.mapx || item.LNG);
  const hasOriginalPoint =
    Number.isFinite(originalLat) &&
    Number.isFinite(originalLng) &&
    originalLat >= 34 &&
    originalLat <= 36 &&
    originalLng >= 128 &&
    originalLng <= 130;
  const [reference, setReference] = useState<any>(null),
    [candidates, setCandidates] = useState<any[]>([]),
    [locating, setLocating] = useState(false),
    [partial, setPartial] = useState(false);
  const lat = hasOriginalPoint ? originalLat : Number(reference?.lat || 0),
    lng = hasOriginalPoint ? originalLng : Number(reference?.lng || 0);
  useEffect(() => {
    let active = true;
    setReference(null);
    setCandidates([]);
    if (hasOriginalPoint) {
      setLocating(false);
      return;
    }
    setLocating(true);
    api(
      "location-candidates?title=" +
        encodeURIComponent(
          item.lookupTitle || item.MAIN_TITLE || item.title || "",
        ),
    )
      .then((v) => {
        if (active) {
          setCandidates(v.items || []);
          if (v.items?.length === 1) setReference(v.items[0]);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLocating(false);
      });
    return () => {
      active = false;
    };
  }, [hasOriginalPoint, item.UC_SEQ, item.lookupTitle, item.MAIN_TITLE]);
  const [items, setItems] = useState<any[]>([]),
    [status, setStatus] = useState("loading"),
    [saved, setSaved] = useState<string[]>(() =>
      readSavedPlaces().map(savedPlaceId),
    );
  useEffect(() => {
    const update = () => setSaved(readSavedPlaces().map(savedPlaceId));
    window.addEventListener("nowro-saved", update);
    return () => window.removeEventListener("nowro-saved", update);
  }, []);
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState<string[]>([]);
  const [includeCurrent, setIncludeCurrent] = useState(!!item.routePlaceId);
  useEffect(() => {
    setSelected([]);
    setIncludeCurrent(!!item.routePlaceId);
  }, [item.UC_SEQ, item.routePlaceId, lat, lng]);
  const entry = (p: any) => ({
    ...p,
    UC_SEQ: "nearby-" + p.contentid,
    routePlaceId: "kto-" + p.contentid,
    MAIN_TITLE: p.title,
    SUBTITLE: p.addr1,
    MAIN_IMG_NORMAL: p.firstimage,
  });
  const count = selected.length + (includeCurrent ? 1 : 0);
  const group = (p: any) =>
    String(p.contenttypeid) === "28"
      ? "experience"
      : String(p.contenttypeid) === "38"
        ? "shopping"
        : p.cat3 === "A05020900"
          ? "cafe"
          : "food";
  const visible = items.filter((p) => filter === "all" || group(p) === filter);
  const L = (ko: string, en: string) => (lang === "ko" ? ko : en);
  useEffect(() => {
    let active = true;
    setItems([]);
    setStatus("loading");
    setPartial(false);
    if (!lat || !lng) {
      setStatus("location_unavailable");
      return;
    }
    api("nearby?lat=" + lat + "&lng=" + lng)
      .then((v) => {
        if (active) {
          setItems(
            (v.items || []).filter(
              (p: any) => "kto-" + p.contentid !== item.routePlaceId,
            ),
          );
          setStatus(v.status);
          setPartial(!!v.partial);
        }
      })
      .catch(() => {
        if (active) setStatus("temporarily_unavailable");
      });
    return () => {
      active = false;
    };
  }, [lat, lng, item.routePlaceId]);
  return (
    <section className="nearby-shops">
      <h3>
        {L(
          "근처 맛집·카페·체험·쇼핑",
          "Nearby food, cafés, experiences and shopping",
        )}
      </h3>
      {locating && (
        <p role="status">
          {L(
            "공식 관광자료에서 기준 위치를 확인하고 있습니다.",
            "Checking the reference location in official tourism data…",
          )}
        </p>
      )}
      {!hasOriginalPoint && reference && (
        <p className="notice">
          <MapPin size={15} />
          {L(
            "공식 관광정보의 대표 지점 기준: ",
            "Official tourism reference point: ",
          )}
          {reference.title} · {reference.address}
          <br />
          {L(
            "현재 콘텐츠의 확정 좌표가 아닙니다. 실제 방문할 행사장 위치를 지도에서 확인해주세요.",
            "This is a reference point, not a confirmed location for this listing. Check the venue you will visit on the map.",
          )}
        </p>
      )}
      {!hasOriginalPoint && candidates.length > 1 && (
        <label>
          {L("주변 검색 기준 장소", "Choose the location for nearby search")}
          <select
            value={reference?.id || ""}
            onChange={(e) =>
              setReference(
                candidates.find((p) => p.id === e.target.value) || null,
              )
            }
          >
            <option value="">
              {L("기준 장소 선택", "Choose a reference location")}
            </option>
            {candidates.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title} · {p.address}
              </option>
            ))}
          </select>
        </label>
      )}
      <p className="muted">
        {L(
          "반경 2km · 직선거리 기준 · 영업상태 및 판매 상품은 미확인입니다.",
          "Within 2 km, straight-line distance. Opening status and product availability are unverified.",
        )}
      </p>
      <div className="quick-categories">
        {[
          ["all", "전체", "All"],
          ["food", "음식점", "Dining"],
          ["cafe", "카페·찻집", "Cafés"],
          ["experience", "체험·레저", "Experiences"],
          ["shopping", "쇼핑", "Shopping"],
        ].map(([id, ko, en]) => (
          <button
            key={id}
            aria-pressed={filter === id}
            onClick={() => setFilter(id)}
          >
            {L(ko, en)}
          </button>
        ))}
      </div>
      {locating ? null : status === "loading" ? (
        <p role="status">
          {L("주변 장소를 찾고 있습니다.", "Finding nearby places…")}
        </p>
      ) : status !== "ok" ? (
        <p>
          {L(
            status === "location_unavailable"
              ? "확인된 좌표가 없어 주변 장소를 조회할 수 없습니다. 공식 원문에서 행사장 위치를 확인해주세요."
              : "주변 정보를 확인할 수 없습니다. 잠시 후 다시 확인해주세요.",
            status === "location_unavailable"
              ? "Nearby search needs a confirmed location or reference point. Check the official venue listing."
              : "Nearby information is temporarily unavailable. Please try again.",
          )}
        </p>
      ) : !visible.length ? (
        <p>
          {L(
            "현재 제공된 이 분류의 주변 장소 정보가 없습니다.",
            "No nearby places are available in this category.",
          )}
        </p>
      ) : (
        <div className="nearby-shop-list">
          {visible.map((p) => {
            const place = entry(p),
              chosen = selected.includes(String(p.contentid)),
              isSaved = saved.includes(savedPlaceId(place));
            const Icon =
              group(p) === "shopping"
                ? ShoppingBag
                : group(p) === "experience"
                  ? Sparkles
                  : group(p) === "cafe"
                    ? Coffee
                    : Utensils;
            return (
              <article
                key={p.contentid}
                className={chosen ? "nearby-selected" : ""}
              >
                <h4>
                  <Icon size={16} aria-hidden="true" />
                  {p.title}
                </h4>
                <p>
                  <MapPin size={14} aria-hidden="true" />
                  {p.addr1}
                </p>
                <small>
                  {Math.round(p.distanceKm * 1000)}m ·{" "}
                  {group(p) === "shopping"
                    ? L("쇼핑 장소", "Shopping")
                    : group(p) === "experience"
                      ? L("체험·레저", "Experience / leisure")
                      : group(p) === "cafe"
                        ? L("카페·전통찻집", "Café / tea house")
                        : L("음식점", "Dining")}
                </small>
                <div className="tourism-actions">
                  <button
                    aria-pressed={isSaved}
                    aria-label={
                      isSaved
                        ? L("저장 취소", "Unsave place")
                        : L("장소 저장", "Save place")
                    }
                    onClick={() => savePlace(place)}
                  >
                    {isSaved ? <Check size={15} /> : <Bookmark size={15} />}{" "}
                    {isSaved ? L("저장됨", "Saved") : L("저장", "Save")}
                  </button>
                  {(onPlanMany || onPlan) && (
                    <button
                      aria-pressed={chosen}
                      disabled={!chosen && count >= 4}
                      onClick={() =>
                        onPlanMany
                          ? setSelected((v) =>
                              chosen
                                ? v.filter((id) => id !== String(p.contentid))
                                : [...v, String(p.contentid)],
                            )
                          : onPlan?.(place)
                      }
                    >
                      <Route size={15} />
                      {chosen
                        ? L("선택 취소", "Deselect")
                        : L("코스 선택", "Select for route")}
                    </button>
                  )}
                </div>
                <a
                  className="action-link nearby-map"
                  href={
                    "https://www.google.com/maps/search/?api=1&query=" +
                    encodeURIComponent(p.addr1 || p.title)
                  }
                  target="_blank"
                  rel="noreferrer"
                >
                  <MapPin size={15} aria-hidden="true" />
                  {L("지도 보기", "View map")}
                  <span aria-hidden="true">↗</span>
                </a>
              </article>
            );
          })}
        </div>
      )}
      {partial && (
        <p className="muted">
          {L(
            "일부 주변 자료의 응답이 지연돼 조회된 장소만 표시합니다.",
            "Some providers are delayed; only successfully loaded places are shown.",
          )}
        </p>
      )}
      {onPlanMany && items.length > 0 && (
        <div className="nearby-route-builder">
          <h4>
            <Route size={17} />
            {L(
              "같이 방문할 장소로 코스 만들기",
              "Plan a route with your selected stops",
            )}
          </h4>
          <label>
            <input
              type="checkbox"
              checked={includeCurrent}
              disabled={!item.routePlaceId || (!includeCurrent && count >= 4)}
              onChange={(e) => setIncludeCurrent(e.target.checked)}
            />
            {L("현재 보고 있는 장소 포함", "Include the current place")}
          </label>
          {!item.routePlaceId && (
            <small className="muted">
              {L(
                "현재 장소는 코스용 위치·일정 확인이 필요합니다. 주변 장소끼리 먼저 코스를 만들 수 있습니다.",
                "The current place is not route-ready yet. You can plan with nearby places instead.",
              )}
            </small>
          )}
          <p className="muted">
            {L(
              "가까운 장소를 최대 4개까지 선택하세요. 인접 구·군도 함께 선택할 수 있습니다.",
              "Choose up to four nearby stops, including neighboring districts.",
            )}{" "}
            ({count}/4)
          </p>
          <button
            className="primary"
            disabled={!selected.length || count > 4}
            onClick={() =>
              onPlanMany([
                ...(includeCurrent ? [item] : []),
                ...items
                  .filter((p) => selected.includes(String(p.contentid)))
                  .map(entry),
              ])
            }
          >
            <Route size={16} />
            {L(
              "선택한 장소로 코스 만들기",
              "Build a route with selected places",
            )}
          </button>
        </div>
      )}
      <small className="muted">
        {L(
          "출처: 한국관광공사 · 공식 업종 분류 기준",
          "Source: Korea Tourism Organization · official category codes",
        )}
      </small>
    </section>
  );
}

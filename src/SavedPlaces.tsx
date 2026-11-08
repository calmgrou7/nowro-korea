import { visitorText } from "./visitor-copy";
import {track} from './analytics';
import { useEffect, useState } from "react";
import { eventExpired } from "../shared/event-dates";
const KEY = "nowro-saved-places-v1";
export function savedPlaceId(item: any): string {
  const legacy = String(item.UC_SEQ || "").match(
    /^(festivals|ocean|exhibitions)-(\d+)$/,
  );
  return String(
    item.contentid
      ? "kto-" + item.contentid
      : item.kopisId
        ? "kopis-" + item.kopisId
        : item.routePlaceId ||
          (legacy ? "busan-" + legacy[1] + "-" + legacy[2] : item.UC_SEQ) ||
          "",
  );
}
export function readSavedPlaces(): any[] {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(value)
      ? [
          ...new Map(
            value
              .filter((p) => p && typeof p === "object" && savedPlaceId(p))
              .map((p) => [savedPlaceId(p), p]),
          ).values(),
        ]
      : [];
  } catch {
    return [];
  }
}
// Bookmark buttons toggle membership and notify every visible saved-place view.
export function savePlace(item: any) {
  const id = savedPlaceId(item);
  if (!id) return;
  const current = readSavedPlaces();
  const exists = current.some((p) => savedPlaceId(p) === id);
  const next = current.filter((p) => savedPlaceId(p) !== id);
  localStorage.setItem(KEY, JSON.stringify(exists ? next : [...next, item]));
  window.dispatchEvent(new Event("nowro-saved"));
  track(exists?'remove_saved_place':'save_place',id);
}
export function SavedPlaces({
  lang,
  onPlan,
}: {
  lang: string;
  onPlan: (items: any[]) => void;
}) {
  const [items, setItems] = useState<any[]>(readSavedPlaces);
  const [checked, setChecked] = useState<string[]>([]);
  useEffect(() => {
    const update = () => {
      const next = readSavedPlaces();
      setItems(next);
      setChecked((v) =>
        v.filter((id) => next.some((p) => savedPlaceId(p) === id)),
      );
    };
    window.addEventListener("nowro-saved", update);
    return () => window.removeEventListener("nowro-saved", update);
  }, []);
  const L = (ko: string, en: string) => visitorText(lang, ko, en);
  return (
    <section className="panel">
      <h2>
        {L(
          "저장한 장소로 나만의 코스 만들기",
          "Create a route from your saved places",
        )}
      </h2>
      <p className="muted">
        {L(
          "이 기기에 저장됩니다. 가까운 장소를 최대 4개 선택하세요. 인접 구·군도 함께 코스로 만들 수 있습니다.",
          "Saved on this device. Select up to four nearby places, including stops across district boundaries.",
        )}
      </p>
      {!items.length && (
        <p>
          {L(
            "홈이나 지역가이드에서 마음에 드는 장소·행사를 저장해주세요.",
            "Save a place or event from Home or Local guides.",
          )}
        </p>
      )}
      {items.map((item) => {
        const id = savedPlaceId(item);
        return (
          <div className="saved-place-row" key={id}>
            <label>
              <input
                type="checkbox"
                disabled={eventExpired(item)}
                checked={checked.includes(id)}
                onChange={(e) =>
                  setChecked((v) =>
                    e.target.checked ? [...v, id] : v.filter((x) => x !== id),
                  )
                }
              />
              <span>
                <strong>{item.MAIN_TITLE || item.title}</strong>
                <small>{item.SUBTITLE || item.ADDR1 || item.addr1}</small>
                {eventExpired(item) && (
                  <small className="event-ended">
                    {L("종료된 일정", "Event ended")}
                  </small>
                )}
              </span>
            </label>
            <button
              className="text-btn"
              onClick={() => {
                localStorage.setItem(
                  KEY,
                  JSON.stringify(items.filter((x) => savedPlaceId(x) !== id)),
                );
                setChecked((v) => v.filter((x) => x !== id));
                window.dispatchEvent(new Event("nowro-saved"));
              }}
            >
              {L("삭제", "Remove")}
            </button>
          </div>
        );
      })}
      <button
        className="primary"
        disabled={!checked.length || checked.length > 4}
        onClick={() =>
          onPlan(items.filter((x) => checked.includes(savedPlaceId(x))))
        }
      >
        {L("선택한 장소로 코스 만들기", "Plan with selected places")} (
        {checked.length}/4)
      </button>
    </section>
  );
}

import { visitorText } from "./visitor-copy";
import {track} from './analytics';
import { useEffect, useState } from "react";
import {savedRouteStatus} from '../shared/saved-route';
import type {Place} from '../shared/types';
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
function SavedPlaceImage({item}:{item:any}) {
  const candidate=[item.MAIN_IMG_NORMAL,item.firstimage,item.firstimage2,item.image,item.poster,item.data?.photos?.[0]].find(v=>typeof v==='string'&&v.length);
  const src=String(candidate||'').replace(/^http:\/\/tong.visitkorea.or.kr\//,'https://tong.visitkorea.or.kr/');
  const [failed,setFailed]=useState(false);
  useEffect(()=>setFailed(false),[src]);
  const valid=/^https?:\/\//.test(src)||/^\/images\//.test(src)||/^data:image\/(jpeg|png|webp);base64,/.test(src);
  return <span className={'saved-place-thumbnail'+(!valid||failed?' is-placeholder':'')}>
    <img src={!valid||failed?'/brand/logo.webp':src} alt={item.MAIN_TITLE||item.title||'NOWRO'} loading="lazy" onError={()=>setFailed(true)} />
  </span>;
}
export function SavedPlaces({
  lang,
  onPlan,
  places,
  onRefresh,
}: {
  lang: string;
  onPlan: (items: any[]) => void;
  places: Place[];
  onRefresh: (items:any[])=>Promise<void>;
}) {
  const [items, setItems] = useState<any[]>(readSavedPlaces);
  const [checked, setChecked] = useState<string[]>([]);
  const [refreshing,setRefreshing]=useState(false),[refreshMessage,setRefreshMessage]=useState('');
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
  const selectedItems=items.filter(item=>checked.includes(savedPlaceId(item)));
  const readyItems=selectedItems.filter(item=>!savedRouteStatus(item,places).reason);
  const excluded=selectedItems.length-readyItems.length;
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
      {!!items.length&&<><button className="secondary" disabled={refreshing} onClick={async()=>{setRefreshing(true);try{await onRefresh(items);setRefreshMessage(L('공식 자료 조회를 마쳤습니다. 확인되지 않은 항목은 계속 보관되며, 아래 카드에서 상태를 확인하세요.','Official lookup completed. Unverified items remain saved; check each card for its current status.'));}catch{setRefreshMessage(L('정보를 다시 확인하지 못했습니다. 잠시 후 다시 시도해주세요.','Could not refresh information. Please try again shortly.'));}finally{setRefreshing(false);}}}>{refreshing?L('확인 중…','Checking…'):L('공식 정보 다시 확인','Recheck official information')}</button><p className="muted" role="status">{refreshMessage}</p></>}
      {!items.length && (
        <p>
          {L(
            "홈이나 지역가이드에서 마음에 드는 장소·행사를 저장해주세요.",
            "Save a place or event from Home or Local guides.",
          )}
        </p>
      )}
      <div className="saved-places-grid">{items.map((item) => {
        const id = savedPlaceId(item);
        const reason=savedRouteStatus(item,places).reason;
        return (
          <div className={"saved-place-row"+(checked.includes(id)?" is-selected":"")} key={id}>
            <label>
              <input
                type="checkbox"
                checked={checked.includes(id)}
                onChange={(e) =>
                  setChecked((v) =>
                    e.target.checked ? [...v, id] : v.filter((x) => x !== id),
                  )
                }
              />
              <SavedPlaceImage item={item} />
              <span className="saved-place-copy">
                <strong>{item.MAIN_TITLE || item.title}</strong>
                <small>{item.SUBTITLE || item.ADDR1 || item.addr1}</small>
                {reason && (
                  <small className="event-ended">
                    {reason==='ended'?L('종료된 행사 · 코스 제외','Event ended · excluded from route'):reason==='location'?L('위치 확인 필요 · 코스 제외','Location needs verification · excluded'):reason==='schedule'?L('행사 일정 확인 필요 · 코스 제외','Event dates need verification · excluded'):L('최신 장소 정보 확인 필요 · 코스 제외','Updated place information needed · excluded')}
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
      })}</div>
      {excluded>0&&<p className="notice" role="status">{L(`선택한 ${selectedItems.length}곳 중 ${excluded}곳은 확인이 필요합니다. 보관 목록에 남겨두고, 확인된 ${readyItems.length}곳으로 코스를 만듭니다.`,`Of ${selectedItems.length} selected places, ${excluded} need verification. They remain saved; the route will use ${readyItems.length} verified places.`)}</p>}
      <button
        className="primary"
        disabled={refreshing || !readyItems.length || readyItems.length > 4}
        onClick={() =>
          onPlan(readyItems)
        }
      >
        {excluded?L('가능한 장소로 코스 만들기','Plan with verified places'):L("선택한 장소로 코스 만들기", "Plan with selected places")} (
        {readyItems.length}/4)
      </button>
    </section>
  );
}

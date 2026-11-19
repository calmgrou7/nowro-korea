import { visitorText } from "./visitor-copy";
import {track} from './analytics';
import { useEffect, useState } from "react";
import {savedRouteStatus} from '../shared/saved-route';
import type {Place} from '../shared/types';
let currentPlaces:any[]=[];
let currentOwner='guest';
try{localStorage.removeItem('nowro-saved-places-v1');localStorage.removeItem('nowro-saved-places-v1-backup');}catch{/* Private browsing may block storage. This visit uses memory only. */}
export function resetSavedPlaceSession(owner:string){
 if(currentOwner===undefined){currentOwner=owner;return false;}
 if(currentOwner!==owner){currentOwner=owner;writeSavedPlaces([]);return true;}return false;
}
export function savedPlaceId(item: any): string {
  const legacy = String(item.UC_SEQ || "").match(
    /^(festivals|ocean|exhibitions)-(\d+)$/,
  );
  return String(
    item.contentid
      ? "kto-" + item.contentid
      : item.kopisId
        ? "kopis-" + item.kopisId
        : item.routePlaceId || (item.res_no ? 'busan-exhibitions-'+item.res_no : '') ||
          (legacy ? "busan-" + legacy[1] + "-" + legacy[2] : item.UC_SEQ) ||
          "",
  );
}
export function readSavedPlaces():any[]{return [...currentPlaces];}
export function writeSavedPlaces(next:any[]):boolean {
 currentPlaces=[...new Map(next.filter(p=>p&&savedPlaceId(p)).map(p=>[savedPlaceId(p),p])).values()];
 window.dispatchEvent(new Event('nowro-saved'));return true;
}
export function savePlace(item: any) {
  const id = savedPlaceId(item);
  if (!id) return;
  const current = readSavedPlaces();
  const exists = current.some((p) => savedPlaceId(p) === id);
  const next = current.filter((p) => savedPlaceId(p) !== id);
  if (!writeSavedPlaces(exists ? next : [...next, item])) return false;
  track(exists?'remove_saved_place':'save_place',id);
  return true;
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
  onPlan: (items: any[]) => Promise<boolean>;
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
          "코스에 넣을 장소 고르기",
          "Choose saved places",
        )}
      </h2>
      <p className="muted">
        {L(
          "이번 방문에 담은 장소입니다. 최대 4곳을 고르면 지금부터 방문할 이동 순서를 비교합니다. 새로고침·재접속·로그인·로그아웃하면 목록이 초기화됩니다.",
          "Pick up to four places from this visit. We compare visit orders starting now. Refreshing, returning or signing in/out clears this list.",
        )}
      </p>
      {!!items.length&&<><button className="secondary" disabled={refreshing} onClick={async()=>{setRefreshing(true);try{await onRefresh(items);setRefreshMessage(L('공식 자료 조회를 마쳤습니다. 확인되지 않은 항목은 계속 보관되며, 아래 카드에서 상태를 확인하세요.','Official lookup completed. Unverified items remain saved; check each card for its current status.'));}catch{setRefreshMessage(L('정보를 다시 확인하지 못했습니다. 잠시 후 다시 시도해주세요.','Could not refresh information. Please try again shortly.'));}finally{setRefreshing(false);}}}>{refreshing?L('확인 중…','Checking…'):L('공식 정보 다시 확인','Recheck official information')}</button><p className="muted" role="status">{refreshMessage}</p></>}
      {!items.length && (
        <p>
          {L(
            "홈이나 지역가이드에서 마음에 드는 장소·행사를 저장해주세요.",
            "Save a place or event from Home or Local guides.",
          )} <a className="action-link" href="?tab=MAP">{L("지역가이드 열기", "Open local guides")}</a>
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
                disabled={refreshing || (!checked.includes(id) && checked.length >= 4)}
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
                if (!writeSavedPlaces(items.filter((x) => savedPlaceId(x) !== id))) return;
                setChecked((v) => v.filter((x) => x !== id));
              }}
            >
              {L("삭제", "Remove")}
            </button>
          </div>
        );
      })}</div>
      {excluded>0&&<p className="notice" role="status">{L(`선택한 ${selectedItems.length}곳 중 ${excluded}곳은 확인이 필요합니다. 코스 만들기를 누르면 최신 정보를 다시 조회합니다.`,`Of ${selectedItems.length} selected places, ${excluded} need verification. We will check the latest information before planning.`)}</p>}
      <button
        className="primary"
        disabled={refreshing || !selectedItems.length}
        onClick={async () => {
          setRefreshing(true);
          try { await onPlan(selectedItems); } catch { setRefreshMessage(L('정보를 확인하지 못했습니다. 선택은 유지됩니다. 다시 시도해주세요.', 'Could not verify these places. Your selection is unchanged. Please try again.')); } finally { setRefreshing(false); }
        }}
      >
        {refreshing?L('확인 중…','Checking…'):excluded?L('다시 확인하고 코스 만들기','Check stops and plan'):L("내 장소 동선 만들기", "Order my selected stops")} (
        {selectedItems.length}/4)
      </button>
    </section>
  );
}

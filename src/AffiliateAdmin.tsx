import { useEffect, useState } from "react";
import { api } from "./api";
const empty = {
  provider: "klook",
  product_id: "",
  url: "",
  title_i18n: { ko: "", en: "" },
  price_from: "",
  currency: "KRW",
  placement: "activity",
  areaIds: [] as string[],
  categoryIds: [] as string[],
  placeIds: [] as string[],
  keywords: [] as string[],
  trackingParam: "",
  validUntil: "",
};
export function AffiliateAdmin() {
  const [data, setData] = useState<any>({
      offers: [],
      matches: [],
      areas: [],
      places: [],
    }),
    [draft, setDraft] = useState<any>(empty),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [reviewed, setReviewed] = useState(false),
    [limit, setLimit] = useState(20);
  const load = () => api("operator/affiliates").then(setData);
  useEffect(() => {
    load().catch(() => setMessage("제휴 관리 자료를 불러오지 못했습니다."));
  }, []);
  const change = (key: string, value: any) =>
    setDraft((v: any) => ({ ...v, [key]: value }));
  async function act(path: string, body: any) {
    if (busy) return;
    setBusy(true);
    try {
      await api("operator/affiliates/" + path, body);
      await load();
      setMessage("저장했습니다. 미승인 상품·연결 후보는 공개되지 않습니다.");
      if (path === "save") setDraft(empty);
    } catch (e: any) {
      setMessage(
        e.message === "STALE_OFFER"
          ? "다른 수정이 있어 다시 불러와야 합니다."
          : "링크·필수 항목·관리자 권한을 확인해주세요. 승인 버튼은 검수 확인 후 사용할 수 있습니다.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel affiliate-admin">
      <h3>제휴 상품·연결 승인</h3>
      <p className="muted">
        제휴사 가입·승인과 공개 상품 링크를 받은 뒤 등록하세요. 상품과 장소
        연결을 각각 승인해야 노출됩니다. 광고는 일반 추천 점수에 영향을 주지
        않습니다. 현재 결제·매출 정산은 연결되지 않았습니다.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          act("save", draft);
        }}
      >
        <div className="operator-grid">
          <label>
            제휴사
            <select
              value={draft.provider}
              onChange={(e) => change("provider", e.target.value)}
            >
              {[
                "klook",
                "kkday",
                "trip",
                "getyourguide",
                "viator",
                "creatrip",
                "agoda",
                "booking",
                "expedia",
                "airalo",
                "wowpass",
              ].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
          <label>
            노출 영역
            <select
              value={draft.placement}
              onChange={(e) => change("placement", e.target.value)}
            >
              <option value="activity">장소·코스의 관련 상품</option>
              <option value="stay">선택한 코스 지역의 숙소</option>
              <option value="preparation">여행 준비 상품</option>
            </select>
          </label>
          <label>
            상품명(한국어)
            <input
              required
              maxLength={150}
              value={draft.title_i18n.ko}
              onChange={(e) =>
                change("title_i18n", {
                  ...draft.title_i18n,
                  ko: e.target.value,
                })
              }
            />
          </label>
          <label>
            상품명(영어)
            <input
              required
              maxLength={150}
              value={draft.title_i18n.en}
              onChange={(e) =>
                change("title_i18n", {
                  ...draft.title_i18n,
                  en: e.target.value,
                })
              }
            />
          </label>
          <label>
            제휴사가 발급한 HTTPS 링크
            <input
              required
              type="url"
              value={draft.url}
              onChange={(e) => change("url", e.target.value)}
              placeholder="https://제휴사공식도메인/..."
            />
          </label>
          <label>
            상품 번호(선택)
            <input
              maxLength={100}
              value={draft.product_id}
              onChange={(e) => change("product_id", e.target.value)}
            />
          </label>
          <label>
            확인된 최저가(모르면 공란)
            <input
              type="number"
              min="0"
              value={draft.price_from ?? ""}
              onChange={(e) => change("price_from", e.target.value)}
            />
          </label>
          <label>
            통화
            <select
              value={draft.currency}
              onChange={(e) => change("currency", e.target.value)}
            >
              {["KRW", "USD", "JPY", "EUR", "CNY", "TWD"].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
          <label>
            지역 규칙
            <select
              value={draft.areaIds[0] || ""}
              onChange={(e) =>
                change("areaIds", e.target.value ? [e.target.value] : [])
              }
            >
              <option value="">지역 제한 없음</option>
              {data.areas.map((a: any) => (
                <option value={a.id} key={a.id}>
                  {a.name.ko}
                </option>
              ))}
            </select>
          </label>
          <label>
            카테고리 규칙
            <select
              value={draft.categoryIds[0] || ""}
              onChange={(e) =>
                change("categoryIds", e.target.value ? [e.target.value] : [])
              }
            >
              <option value="">카테고리 제한 없음</option>
              {Object.entries({
                sea: "바다",
                cafe: "카페",
                food: "음식점",
                culture: "관광·문화",
                shopping: "쇼핑",
                experience: "체험",
                wellness: "웰니스",
                event: "행사",
              }).map(([id, label]) => (
                <option value={id} key={id}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            특정 장소만 연결(선택 시 규칙보다 우선)
            <select
              value={draft.placeIds[0] || ""}
              onChange={(e) =>
                change("placeIds", e.target.value ? [e.target.value] : [])
              }
            >
              <option value="">자동 연결 규칙 사용</option>
              {data.places.map((p: any) => (
                <option value={p.id} key={p.id}>
                  {p.name.ko} ·{" "}
                  {data.areas.find((a: any) => a.id === p.areaId)?.name.ko}
                </option>
              ))}
            </select>
          </label>
          <label>
            사용 종료일(선택)
            <input
              type="date"
              value={draft.validUntil}
              onChange={(e) => change("validUntil", e.target.value)}
            />
          </label>
          <label>
            장소명 키워드(선택·쉼표 구분)
            <input
              value={draft.keywords.join(", ")}
              onChange={(e) =>
                change(
                  "keywords",
                  e.target.value
                    .split(",")
                    .map((v) => v.trim())
                    .filter(Boolean),
                )
              }
              placeholder="요트, SUP"
            />
            <small>
              지역·카테고리 조건과 함께 적용됩니다. 결과는 승인 대기입니다.
            </small>
          </label>
          <label>
            제휴사 추가 추적 변수
            <select
              value={draft.trackingParam}
              onChange={(e) => change("trackingParam", e.target.value)}
            >
              <option value="">링크 원형 유지(기본)</option>
              {["sub_id", "subid", "aff_sub", "sid"].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
            <small>
              제휴사가 허용한 변수만 선택하세요. 이미 있는 링크 값은 덮어쓰지
              않습니다.
            </small>
          </label>
        </div>
        <div className="modal-actions">
          <button className="primary" disabled={busy}>
            상품 초안 저장
          </button>
          <button type="button" disabled={busy} onClick={() => setDraft(empty)}>
            입력 초기화
          </button>
        </div>
      </form>
      <p role="status">{message}</p>
      <label className="checkbox">
        <input
          type="checkbox"
          checked={reviewed}
          onChange={(e) => setReviewed(e.target.checked)}
        />
        제휴 프로그램 승인, 링크 대상, 실제 상품·언어·요금·취소 조건을
        확인했습니다.
      </label>
      <button disabled={busy} onClick={() => act("suggest", {})}>
        규칙으로 연결 후보 생성
      </button>
      {!data.offers.length && (
        <p className="muted">
          등록된 제휴 상품이 없습니다. 고객 화면에는 빈 제휴 영역을 표시하지
          않습니다.
        </p>
      )}
      <div className="affiliate-admin-list">
        {data.offers.map((o: any) => (
          <article key={o.id}>
            <strong>{o.title_i18n.ko}</strong>
            <small>
              {o.provider} ·{" "}
              {o.status === "approved" && o.active
                ? "상품 승인됨"
                : o.status === "paused"
                  ? "중지"
                  : "초안 · 비공개"}
            </small>
            <div className="modal-actions">
              <button
                disabled={busy}
                onClick={() => {
                  setDraft(o);
                  setReviewed(false);
                }}
              >
                편집
              </button>
              <button
                disabled={busy || !reviewed}
                onClick={() =>
                  act("review", {
                    action: "approve_offer",
                    offerId: o.id,
                    revision: o.revision,
                    confirmed: true,
                  })
                }
              >
                상품 검수 승인
              </button>
              <button
                disabled={busy}
                onClick={() =>
                  act("review", {
                    action: "pause_offer",
                    offerId: o.id,
                    revision: o.revision,
                  })
                }
              >
                노출 중지
              </button>
            </div>
          </article>
        ))}
      </div>
      <h4>
        장소 연결 후보{" "}
        {data.matches.filter((m: any) => m.status === "pending").length}건 대기
      </h4>
      <div className="affiliate-admin-list">
        {data.matches.slice(0, limit).map((m: any) => {
          const offer = data.offers.find((o: any) => o.id === m.offerId),
            place = data.places.find((p: any) => p.id === m.placeId);
          return (
            <article key={m.id}>
              <strong>{place?.name.ko || "현재 자료에 없는 장소"}</strong>
              <span>
                {offer?.title_i18n.ko} ·{" "}
                {m.status === "approved"
                  ? "연결 승인됨"
                  : m.status === "rejected"
                    ? "연결 제외"
                    : "승인 대기"}
              </span>
              <small>{place?.address}</small>
              <div className="modal-actions">
                <button
                  disabled={busy || !reviewed || !place}
                  onClick={() =>
                    act("review", {
                      action: "approve_match",
                      offerId: m.offerId,
                      revision: offer?.revision,
                      matchId: m.id,
                    })
                  }
                >
                  이 장소 연결 승인
                </button>
                <button
                  disabled={busy}
                  onClick={() =>
                    act("review", {
                      action: "reject_match",
                      offerId: m.offerId,
                      revision: offer?.revision,
                      matchId: m.id,
                    })
                  }
                >
                  연결 제외
                </button>
              </div>
            </article>
          );
        })}
      </div>
      {data.matches.length > limit && (
        <button onClick={() => setLimit((v) => v + 20)}>후보 더 보기</button>
      )}
    </section>
  );
}

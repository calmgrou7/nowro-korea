import { useEffect, useState } from "react";
import { api } from "./api";
import type { Lang } from "../shared/types";
export function Shop({ lang }: { lang: Lang }) {
  const ko = lang === "ko";
  const [links, setLinks] = useState<Record<string, string | null>>({});
  useEffect(() => {
    api("shop")
      .then(setLinks)
      .catch(() => setLinks({}));
  }, []);
  return (
    <section className="panel">
      <span className="eyebrow">NOWRO SHOP</span>
      <h2>{ko ? "혜택 & 굿즈 쇼핑" : "Offers & goods shop"}</h2>
      <p className="muted">
        {ko
          ? "쇼핑몰 연결 준비 중입니다. 연결 후 할인권 구매·등록과 굿즈 구매가 가능합니다."
          : "Store connection is coming soon. Buy or register discount tickets, and shop NOWRO goods here."}
      </p>
      <div className="shop-menu">
        {[
          ["discount", ko ? "할인권 구매" : "Buy discount tickets"],
          ["register", ko ? "할인권 등록" : "Register a ticket"],
          ["goods", ko ? "굿즈 구매" : "Shop goods"],
        ].map(([id, title]) => (
          <div key={id}>
            {links[id] ? (
              <a
                className="primary"
                href={links[id]!}
                target="_blank"
                rel="noopener noreferrer"
              >
                {title} ↗
              </a>
            ) : (
              <button className="secondary full" disabled>
                {title}
              </button>
            )}
            <small>
              {links[id]
                ? ko
                  ? "쇼핑몰 열기"
                  : "Open store"
                : ko
                  ? "연결 준비 중"
                  : "Coming soon"}
            </small>
          </div>
        ))}
      </div>
    </section>
  );
}
export function CompletionRewards({
  lang,
  version,
  authenticated,
}: {
  lang: Lang;
  version: number;
  authenticated: boolean;
}) {
  const ko = lang === "ko";
  const [progress, setProgress] = useState<any>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [accepted, setAccepted] = useState(false),
    [choice, setChoice] = useState("goods"),
    [goodsId, setGoodsId] = useState("tote");
  const [shipping, setShipping] = useState({
    recipient: "",
    country: "KR",
    postalCode: "",
    address1: "",
    address2: "",
    city: "",
    region: "",
    phone: "",
    email: "",
    consent: false,
  });
  const refresh = async () => {
    try {
      setProgress(await api("rewards"));
      setError("");
    } catch {
      setError(
        ko
          ? "보상 정보를 불러오지 못했습니다. 다시 확인해주세요."
          : "Unable to load rewards. Please retry.",
      );
    }
  };
  useEffect(() => {
    setProgress(null);
    void refresh();
  }, [version]);
  const statuses: Record<string, string> = ko
    ? {
        requested: "배송 신청 접수",
        processing: "배송 준비 중",
        shipped: "발송 완료",
        delivered: "배송 완료",
        discount_requested: "할인 보상 신청 접수",
        discount_ready: "할인권 준비 완료",
        discount_used: "할인권 사용 완료",
      }
    : {
        requested: "Request received",
        processing: "Preparing shipment",
        shipped: "Shipped",
        delivered: "Delivered",
        discount_requested: "Discount requested",
        discount_ready: "Discount ready",
        discount_used: "Discount used",
      };
  return (
    <section className="panel completion-rewards">
      <span className="eyebrow">COMPLETE BUSAN · CHOOSE YOUR REWARD</span>
      <h2>{ko ? "부산 4개 지역 완주 보상" : "Your Busan completion reward"}</h2>
      <p>
        {ko
          ? "각 지역에서 결제 후 QR 스탬프를 1개 이상 받으면, 굿즈 배송 또는 할인 보상 중 하나를 선택하세요."
          : "Collect a paid-visit QR stamp in each of the four areas, then choose goods delivery or a discount reward."}
      </p>
      <p className="muted">
        {ko
          ? "현재는 테스트 신청입니다. 실제 굿즈, 할인 조건, 배송비 및 결제·배송 연동은 운영 시작 전에 확정됩니다."
          : "Requests are currently for testing. Goods, discount terms, shipping fees and payment/delivery connections will be confirmed before launch."}
      </p>
      {error && <p role="alert">{error}</p>}
      {error && (
        <button className="secondary" onClick={() => void refresh()}>
          {ko ? "신청 내역 다시 확인" : "Reload reward status"}
        </button>
      )}
      {!progress && !error && <p>{ko ? "불러오는 중…" : "Loading…"}</p>}
      {progress && (
        <>
          <strong>
            {progress.completedAreas.length} / 4{" "}
            {ko ? "지역 완주" : "areas completed"}
          </strong>
          <progress
            max={4}
            value={progress.completedAreas.length}
            aria-label={ko ? "완주 진행률" : "Completion progress"}
          />
          {progress.order ? (
            <div className="reward-status">
              <h3>
                {statuses[progress.order.status] || progress.order.status}
              </h3>
              <p>
                {progress.order.choice === "goods"
                  ? progress.goods.find(
                      (g: any) => g.id === progress.order.goodsId,
                    )?.[ko ? "ko" : "en"]
                  : ko
                    ? "할인 보상"
                    : "Discount reward"}
              </p>
              {progress.order.status === "discount_ready" && (
                <code>{progress.order.discountCode}</code>
              )}
              {progress.order.tracking && (
                <p>
                  {progress.order.carrier} · {progress.order.tracking}
                </p>
              )}
              <small>
                {ko
                  ? "보상은 캠페인당 한 번만 선택할 수 있습니다."
                  : "One reward choice per campaign."}
              </small>
            </div>
          ) : accepted ? (
            <p role="status">
              {ko
                ? "신청은 접수되었습니다. 신청 내역을 다시 확인해주세요."
                : "Your request was received. Reload the reward status to see it."}
            </p>
          ) : (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                setError("");
                try {
                  await api("rewards/claim", { choice, goodsId, shipping });
                  setAccepted(true);
                  setShipping({
                    recipient: "",
                    country: "KR",
                    postalCode: "",
                    address1: "",
                    address2: "",
                    city: "",
                    region: "",
                    phone: "",
                    email: "",
                    consent: false,
                  });
                  await refresh();
                } catch (e) {
                  setError(
                    (e as Error).message === "REWARD_ALREADY_CLAIMED"
                      ? ko
                        ? "이미 보상을 신청했습니다."
                        : "Reward already requested."
                      : ko
                        ? "신청을 완료하지 못했습니다. 완주 및 입력 정보를 확인해주세요."
                        : "Request failed. Check completion and shipping details.",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              <fieldset disabled={!progress.eligible || busy}>
                <legend>
                  {ko ? "보상 선택 · 둘 중 하나" : "Choose one reward"}
                </legend>
                <label className="reward-choice">
                  <input
                    type="radio"
                    name="reward"
                    checked={choice === "goods"}
                    onChange={() => setChoice("goods")}
                  />
                  {ko
                    ? "굿즈 배송 · 국내 / 해외"
                    : "Goods delivery · Korea / international"}
                </label>
                <label className="reward-choice">
                  <input
                    type="radio"
                    name="reward"
                    checked={choice === "discount"}
                    onChange={() => setChoice("discount")}
                  />
                  {ko ? "할인 보상" : "Discount reward"}
                </label>
                {choice === "goods" && progress.eligible && (
                  <>
                    <label>
                      {ko
                        ? "굿즈 선택 (예시)"
                        : "Choose goods (sample catalogue)"}
                      <select
                        value={goodsId}
                        onChange={(e) => setGoodsId(e.target.value)}
                      >
                        {progress.goods.map((g: any) => (
                          <option key={g.id} value={g.id}>
                            {g[ko ? "ko" : "en"]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="shipping-fields">
                      {[
                        ["recipient", ko ? "받는 분" : "Recipient"],
                        [
                          "country",
                          ko
                            ? "국가 코드 (KR, US, JP 등)"
                            : "Country code (KR, US, JP…)",
                        ],
                        ["postalCode", ko ? "우편번호" : "Postal code"],
                        ["city", ko ? "도시" : "City"],
                        [
                          "region",
                          ko ? "주 / 도 (선택)" : "State / province (optional)",
                        ],
                        ["address1", ko ? "주소" : "Address"],
                        [
                          "address2",
                          ko ? "상세 주소 (선택)" : "Address line 2 (optional)",
                        ],
                        [
                          "phone",
                          ko
                            ? "연락처 (국가번호 포함)"
                            : "Phone (with country code)",
                        ],
                        ["email", ko ? "이메일" : "Email"],
                      ].map(([key, title]) => (
                        <label key={key}>
                          {title}
                          <input
                            type={
                              key === "email"
                                ? "email"
                                : key === "phone"
                                  ? "tel"
                                  : "text"
                            }
                            required={!["address2", "region"].includes(key)}
                            maxLength={key === "country" ? 2 : 300}
                            value={
                              shipping[key as keyof typeof shipping] as string
                            }
                            onChange={(e) =>
                              setShipping({
                                ...shipping,
                                [key]:
                                  key === "country"
                                    ? e.target.value.toUpperCase()
                                    : e.target.value,
                              })
                            }
                          />
                        </label>
                      ))}
                    </div>
                    <label className="reward-choice">
                      <input
                        type="checkbox"
                        required
                        checked={shipping.consent}
                        onChange={(e) =>
                          setShipping({
                            ...shipping,
                            consent: e.target.checked,
                          })
                        }
                      />
                      {ko
                        ? "배송 신청을 위한 주소·연락처 수집에 동의합니다. "
                        : "I consent to address/contact collection for delivery requests. "}
                      {authenticated
                        ? ko
                          ? "회원 신청 정보는 계정에 보관됩니다. 운영 전 보관 기간과 삭제 절차가 확정되어야 합니다."
                          : "Member requests stay with your account. Retention and deletion procedures must be finalized before launch."
                        : ko
                          ? "비회원 신청 정보는 게스트 세션 만료 시 정리됩니다(최대 7일)."
                          : "Guest request data is cleaned up when the guest session expires (up to 7 days)."}
                    </label>
                  </>
                )}
                <button className="primary" type="submit">
                  {busy
                    ? ko
                      ? "신청 중…"
                      : "Submitting…"
                    : ko
                      ? "보상 신청"
                      : "Request reward"}
                </button>
              </fieldset>
              {!progress.eligible && (
                <p className="muted">
                  {ko
                    ? "4개 지역을 완주하면 신청할 수 있습니다."
                    : "Complete all four areas to unlock your reward."}
                </p>
              )}
            </form>
          )}
        </>
      )}
    </section>
  );
}
export function AdminRewards({ lang }: { lang: Lang }) {
  const ko = lang === "ko";
  const [orders, setOrders] = useState<any[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const refresh = () =>
    api("operator/rewards")
      .then((d) => setOrders(d.orders))
      .catch(() =>
        setError(
          ko ? "신청 목록을 불러오지 못했습니다." : "Unable to load requests.",
        ),
      );
  useEffect(() => {
    void refresh();
  }, []);
  const next: Record<string, string> = {
    requested: "processing",
    processing: "shipped",
    shipped: "delivered",
    discount_requested: "discount_ready",
    discount_ready: "discount_used",
  };
  return (
    <section className="panel">
      <h2>{ko ? "완주 보상 신청 관리" : "Completion reward requests"}</h2>
      <p className="muted">
        {ko
          ? "테스트 운영 화면 · 실제 운송사 접수와 할인권 발급은 별도 연동이 필요합니다."
          : "Test operations · carrier booking and discount fulfilment require service connections."}
      </p>
      {error && <p role="alert">{error}</p>}
      {!orders.length && (
        <p>{ko ? "신청 내역이 없습니다." : "No requests yet."}</p>
      )}
      {orders.map((o) => (
        <form
          className="reward-status"
          key={o.id}
          onSubmit={async (e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            setBusy(true);
            try {
              await api("operator/rewards/update", {
                id: o.id,
                status: next[o.status],
                carrier: data.get("carrier"),
                tracking: data.get("tracking"),
              });
              await refresh();
            } catch {
              setError(
                ko
                  ? "처리하지 못했습니다. 상태와 운송장을 확인해주세요."
                  : "Update failed. Check status and tracking.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <strong>
            {o.choice} · {o.status}
          </strong>
          <small>{o.id}</small>
          {o.choice === "goods" && (
            <details>
              <summary>
                {ko ? "배송 정보 보기" : "View delivery details"}
              </summary>
              <p>
                {Object.values(o.shipping)
                  .filter((v) => typeof v === "string")
                  .join(" · ")}
              </p>
            </details>
          )}
          {o.status === "processing" && (
            <div className="shipping-fields">
              <label>
                {ko ? "택배사" : "Carrier"}
                <input name="carrier" maxLength={100} required />
              </label>
              <label>
                {ko ? "운송장" : "Tracking number"}
                <input name="tracking" maxLength={100} required />
              </label>
            </div>
          )}
          {next[o.status] && (
            <button className="secondary" disabled={busy}>
              {next[o.status]}
            </button>
          )}
        </form>
      ))}
    </section>
  );
}

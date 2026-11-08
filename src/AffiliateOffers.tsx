import { useEffect, useState } from "react";
import { api } from "./api";
import { affiliateLink, type AffiliateOffer } from "../shared/affiliates";
import { track } from "./analytics";
const words: Record<string, [string, string, string, string]> = {
  ko: [
    "제휴 상품",
    "지역 숙소 상품",
    "부산 여행 준비",
    "이 링크로 예약·구매하면 나우로가 수수료를 받을 수 있습니다. 가격·재고·취소 조건은 제휴사에서 확인하세요.",
  ],
  en: [
    "Related booking options",
    "Accommodation in this area",
    "Prepare for Busan",
    "NOWRO may earn a commission through these links. Confirm prices, availability and cancellation terms with the provider.",
  ],
  ja: [
    "提携商品",
    "このエリアの宿泊商品",
    "釜山旅行の準備",
    "リンク経由の予約・購入でNOWROが手数料を受け取る場合があります。料金・空き状況・キャンセル条件は提供元でご確認ください。",
  ],
  "zh-CN": [
    "合作商品",
    "本地区住宿商品",
    "釜山旅行准备",
    "通过这些链接预订或购买，NOWRO可能获得佣金。价格、库存和取消条款请向提供方确认。",
  ],
  "zh-TW": [
    "合作商品",
    "本地區住宿商品",
    "釜山旅行準備",
    "透過這些連結預訂或購買，NOWRO可能獲得佣金。價格、庫存和取消條款請向提供方確認。",
  ],
};
export function AffiliateOffers({
  lang,
  placeIds = [],
  placement = "activity",
  page = "detail",
}: {
  lang: string;
  placeIds?: string[];
  placement?: "activity" | "stay" | "preparation";
  page?: string;
}) {
  const [offers, setOffers] = useState<AffiliateOffer[]>([]);
  const ids = placeIds.slice(0, 8).join(",");
  useEffect(() => {
    let active = true;
    setOffers([]);
    if (!ids && placement !== "preparation") return;
    api(
      "affiliate-offers?placement=" +
        placement +
        "&places=" +
        encodeURIComponent(ids),
    )
      .then((v) => {
        if (active) setOffers(v.offers || []);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [ids, placement]);
  if (!offers.length) return null;
  const w = words[lang] || words.en;
  return (
    <section className="affiliate-offers">
      <h3>
        {w[placement === "stay" ? 1 : placement === "preparation" ? 2 : 0]}{" "}
        <small>{lang === "ko" ? "제휴" : "Affiliate"}</small>
      </h3>
      <p className="muted">{w[3]}</p>
      <div className="affiliate-grid">
        {offers.map((o) => {
          let href = "";
          try {
            href = affiliateLink(o, lang, page, (o.matched_place_id || placeIds[0]));
          } catch {
            return null;
          }
          const price =
            o.price_from == null
              ? ""
              : new Intl.NumberFormat(lang, {
                  style: "currency",
                  currency: o.currency,
                  maximumFractionDigits:
                    o.currency === "KRW" || o.currency === "JPY" ? 0 : 2,
                }).format(o.price_from);
          return (
            <article key={o.id}>
              <small>{o.provider}</small>
              <strong>
                {o.title_i18n[lang] || o.title_i18n.en || o.title_i18n.ko}
              </strong>
              {price && (
                <span>
                  {lang === "ko"
                    ? "표시 최저가: "
                    : lang === "ja"
                      ? "掲載最低料金："
                      : lang.startsWith("zh")
                        ? "标示起价："
                        : "Listed from: "}
                  {price}
                </span>
              )}
              <a
                className="action-link"
                href={href}
                target="_blank"
                rel="sponsored noopener noreferrer"
                onClick={() =>
                  track("click_affiliate", o.id, {
                    provider: o.provider,
                    place_id: (o.matched_place_id || placeIds[0]) || "global",
                    lang,
                    page,
                  })
                }
              >
                {lang === "ko"
                  ? "제휴사에서 상품 확인"
                  : lang === "ja"
                    ? "提供元で商品を見る"
                    : lang.startsWith("zh")
                      ? "前往合作方查看"
                      : "View on provider"}{" "}
                ↗
              </a>
              {o.checkedAt && (
                <small>
                  {lang === "ko" ? "검토일" : "Reviewed"}{" "}
                  {o.checkedAt.slice(0, 10)}
                </small>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

import { Ticket, MapPin, Clock3 } from "lucide-react";
export type RouteBenefit = {
  id: string;
  placeId: string;
  title: string;
  type: "coupon" | "promotion";
  validFrom: string;
  validUntil: string;
  terms: string;
  sponsored: boolean;
  redemption: "onsite" | "qr" | "reservation";
  status: "active" | "paused" | "sold_out" | "ended";
  minimumSpend?: number;
  days?: number[];
  startsAt?: string;
  endsAt?: string;
};
export function RouteBenefits({
  lang,
  hasRoutes,
}: {
  lang: string;
  hasRoutes: boolean;
}) {
  const ko = lang === "ko";
  return (
    <section
      className="route-benefits panel"
      aria-labelledby="route-benefits-title"
    >
      <div className="section-heading">
        <h2 id="route-benefits-title">
          <Ticket size={21} />
          {ko ? "코스 주변 혜택" : "Offers along your route"}
        </h2>
        <span className="board-pinned">{ko ? "준비 중" : "Coming later"}</span>
      </div>
      <p>
        {hasRoutes
          ? ko
            ? "현재 이 코스에 연결된 쿠폰·할인행사는 없습니다. 혜택이 연결되면 이곳에서 사용 조건을 확인하고 방문할 장소를 선택할 수 있습니다."
            : "No coupons or promotions are connected to these routes yet. Future offers will appear here with their conditions."
          : ko
            ? "코스를 만든 뒤 주변 장소의 쿠폰·할인행사를 확인할 수 있는 공간입니다. 현재 혜택 서비스는 준비 중입니다."
            : "This is where future coupons and promotions near your route will appear. Offers are not available yet."}
      </p>
      <details>
        <summary>
          {ko
            ? "혜택은 어떻게 코스에 연결되나요?"
            : "How will offers connect to a route?"}
        </summary>
        <ol>
          <li>
            <Ticket size={16} />
            {ko
              ? "유효기간·사용시간·최소 결제금액 확인"
              : "Check validity dates, hours and minimum spend"}
          </li>
          <li>
            <MapPin size={16} />
            {ko
              ? "혜택 장소 추가 또는 기존 장소와 교체"
              : "Add an offer location or replace a stop"}
          </li>
          <li>
            <Clock3 size={16} />
            {ko
              ? "추가 이동시간과 예상 비용을 비교하고 코스 재계산"
              : "Compare extra travel time and estimated costs, then recalculate"}
          </li>
        </ol>
        <small className="muted">
          {ko
            ? "적용 조건이 확인된 혜택만 할인 후 예상 비용에 반영하며, 광고·제휴는 일반 추천과 구분합니다."
            : "Discounts will affect estimates only when eligibility is confirmed. Sponsored placements will be labeled separately."}
        </small>
      </details>
    </section>
  );
}

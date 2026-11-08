import { Ticket } from "lucide-react";
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
export type PartnerCouponDraft = {
  partner_id: string;
  place_id: string;
  title_i18n: Record<string, string>;
  discount: { type: "percent" | "amount"; value: number };
  valid_from: string;
  valid_to: string;
  geo: { lat: number; lng: number };
  redeem_code_type: "qr" | "pin";
  status: "draft" | "pending" | "active" | "paused" | "ended";
};
export function RouteBenefits({
  lang,
  hasRoutes,
  benefits = [],
  placeIds = [],
}: {
  lang: string;
  hasRoutes: boolean;
  benefits?: RouteBenefit[];
  placeIds?: string[];
}) {
  const today = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
  const valid = benefits.filter(
    (b) =>
      b.status === "active" &&
      placeIds.includes(b.placeId) &&
      b.validFrom <= today &&
      b.validUntil >= today,
  );
  if (!hasRoutes || !valid.length) return null;
  return (
    <section className="route-benefits panel">
      <h3>
        <Ticket size={18} />
        {lang === "ko" ? "코스 주변 혜택" : "Offers along your route"}
      </h3>
      {valid.map((b) => (
        <article key={b.id}>
          <strong>{b.title}</strong>
          <p>{b.terms}</p>
          <small>
            {b.validFrom} – {b.validUntil}
          </small>
        </article>
      ))}
    </section>
  );
}

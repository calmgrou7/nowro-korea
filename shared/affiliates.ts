export type AffiliateOffer = {
  id: string;
  provider: string;
  product_id: string;
  url: string;
  title_i18n: Record<string, string>;
  price_from: number | null;
  currency: string;
  placement: "activity" | "stay" | "preparation";
  trackingParam: string;
  checkedAt?: string;
  matched_place_id?: string|null;
};
export function affiliateLink(
  offer: AffiliateOffer,
  lang: string,
  page: string,
  placeId = "",
) {
  const url = new URL(offer.url);
  if (url.protocol !== "https:" || url.username || url.password)
    throw Error("INVALID_LINK");
  const safe = (value: string) =>
    value.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 60);
  if (
    ["sub_id", "subid", "aff_sub", "sid"].includes(offer.trackingParam) &&
    !url.searchParams.has(offer.trackingParam)
  )
    url.searchParams.set(
      offer.trackingParam,
      [safe(page), safe(lang), safe(placeId) || "global"].join("_"),
    );
  return url.href;
}

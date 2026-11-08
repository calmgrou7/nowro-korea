import { randomUUID } from "node:crypto";
import { ServiceError, areas } from "./store.mjs";
const domains = {
  klook: ["klook.com"],
  kkday: ["kkday.com"],
  trip: ["trip.com"],
  getyourguide: ["getyourguide.com"],
  viator: ["viator.com"],
  creatrip: ["creatrip.com"],
  agoda: ["agoda.com"],
  booking: ["booking.com"],
  expedia: ["expedia.com"],
  airalo: ["airalo.com"],
  wowpass: ["wowpass.io"],
};
const categories = [
  "sea",
  "cafe",
  "food",
  "culture",
  "shopping",
  "experience",
  "wellness",
  "event",
];
export function affiliateConfig(store) {
  return JSON.parse(
    store.db
      .prepare("SELECT value FROM config WHERE key='affiliate_config'")
      .get()?.value || '{"offers":[],"matches":[]}',
  );
}
function write(store, s, data, action, id) {
  store.db
    .prepare("INSERT OR REPLACE INTO config(key,value) VALUES(?,?)")
    .run("affiliate_config", JSON.stringify(data));
  store.audit(s.user_id, action, { id });
}
function admin(s) {
  if (s.role !== "admin") throw new ServiceError("FORBIDDEN", 403);
}
function cleanText(value, max = 200) {
  return String(value || "")
    .trim()
    .slice(0, max);
}
function validDate(value) {
  return (
    !value ||
    (/^20\d{2}-\d{2}-\d{2}$/.test(value) &&
      !Number.isNaN(Date.parse(value)) &&
      new Date(value).toISOString().slice(0, 10) === value)
  );
}
export function saveAffiliate(store, s, input) {
  admin(s);
  if (!input || typeof input !== "object")
    throw new ServiceError("INVALID_OFFER", 400);
  const data = affiliateConfig(store),
    previous = data.offers.find((o) => o.id === input.id);
  if (input.id && !previous) throw new ServiceError("NOT_FOUND", 404);
  if (previous && input.revision !== previous.revision)
    throw new ServiceError("STALE_OFFER", 409);
  if (!previous && data.offers.length >= 200)
    throw new ServiceError("OFFER_LIMIT", 400);
  const provider = cleanText(input.provider, 30);
  let url;
  try {
    url = new URL(input.url);
  } catch {
    throw new ServiceError("INVALID_OFFER_URL", 400);
  }
  if (
    !domains[provider] ||
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.port ||
    !domains[provider].some(
      (d) => url.hostname === d || url.hostname.endsWith("." + d),
    ) ||
    url.href.length > 2000
  )
    throw new ServiceError("INVALID_OFFER_URL", 400);
  const title_i18n = Object.fromEntries(
    ["ko", "en", "ja", "zh-CN", "zh-TW"].map((l) => [
      l,
      cleanText(input.title_i18n?.[l], 150),
    ]),
  );
  const price_from =
    input.price_from === "" || input.price_from == null
      ? null
      : Number(input.price_from);
  const areaIds = Array.isArray(input.areaIds)
      ? [...new Set(input.areaIds)]
      : [],
    categoryIds = Array.isArray(input.categoryIds)
      ? [...new Set(input.categoryIds)]
      : [],
    placeIds = Array.isArray(input.placeIds)
      ? [...new Set(input.placeIds)]
      : [],
    keywords = Array.isArray(input.keywords)
      ? input.keywords.map((v) => cleanText(v, 40)).filter(Boolean)
      : [];
  const places = store.catalog().filter((p) => p.published && !p.sample);
  const validUntil = cleanText(input.validUntil, 10),
    trackingParam = cleanText(input.trackingParam, 30),
    placement = input.placement || "activity";
  if (
    !title_i18n.ko ||
    !title_i18n.en ||
    !["activity", "stay", "preparation"].includes(placement) ||
    !["KRW", "USD", "JPY", "EUR", "CNY", "TWD"].includes(input.currency) ||
    (price_from !== null &&
      (!Number.isFinite(price_from) ||
        price_from < 0 ||
        price_from > 10000000)) ||
    areaIds.some((id) => !areas.some((a) => a.id === id)) ||
    categoryIds.some((id) => !categories.includes(id)) ||
    placeIds.length > 20 ||
    placeIds.some((id) => !places.some((p) => p.id === id)) ||
    keywords.length > 10 ||
    !validDate(validUntil) ||
    !["", "sub_id", "subid", "aff_sub", "sid"].includes(trackingParam)
  )
    throw new ServiceError("INVALID_OFFER", 400);
  const offer = {
    id: previous?.id || randomUUID(),
    revision: randomUUID(),
    provider,
    product_id: cleanText(input.product_id, 100),
    url: url.href,
    title_i18n,
    price_from,
    currency: input.currency,
    placement,
    areaIds,
    categoryIds,
    placeIds,
    keywords,
    trackingParam,
    validUntil,
    status: "draft",
    active: false,
    updated: new Date().toISOString(),
  };
  data.offers = [offer, ...data.offers.filter((o) => o.id !== offer.id)];
  data.matches = data.matches.filter((m) => m.offerId !== offer.id);
  write(store, s, data, "affiliate_saved", offer.id);
  return offer;
}
export function suggestAffiliateMatches(store, s) {
  admin(s);
  const data = affiliateConfig(store),
    places = store.catalog().filter((p) => p.published && !p.sample);
  let added = 0;
  for (const o of data.offers) {
    if (
      o.placement === "preparation" ||
      (!o.placeIds.length &&
        !o.areaIds.length &&
        !o.categoryIds.length &&
        !o.keywords.length)
    )
      continue;
    for (const p of places) {
      const text = [p.name.ko, p.name.en, ...p.tags].join(" ").toLowerCase();
      const matches = o.placeIds.length
        ? o.placeIds.includes(p.id)
        : (!o.areaIds.length || o.areaIds.includes(p.areaId)) &&
          (!o.categoryIds.length || o.categoryIds.includes(p.category)) &&
          (!o.keywords.length ||
            o.keywords.some((k) => text.includes(k.toLowerCase())));
      if (
        matches &&
        !data.matches.some((m) => m.offerId === o.id && m.placeId === p.id)
      ) {
        if (data.matches.length >= 2000) break;
        data.matches.push({
          id: randomUUID(),
          offerId: o.id,
          offerRevision: o.revision,
          placeId: p.id,
          status: "pending",
        });
        added++;
      }
    }
  }
  write(store, s, data, "affiliate_suggestions_generated", String(added));
  return { added, ...data };
}
export function reviewAffiliate(store, s, input) {
  admin(s);
  const data = affiliateConfig(store),
    offer = data.offers.find((o) => o.id === input.offerId);
  if (!offer) throw new ServiceError("NOT_FOUND", 404);
  if (input.revision !== offer.revision)
    throw new ServiceError("STALE_OFFER", 409);
  if (input.action === "approve_offer") {
    if (input.confirmed !== true)
      throw new ServiceError("REVIEW_CONFIRMATION_REQUIRED", 400);
    offer.status = "approved";
    offer.active = true;
    offer.checkedAt = new Date().toISOString();
  } else if (input.action === "pause_offer") {
    offer.status = "paused";
    offer.active = false;
  } else if (["approve_match", "reject_match"].includes(input.action)) {
    const match = data.matches.find(
      (m) =>
        m.id === input.matchId &&
        m.offerId === offer.id &&
        m.offerRevision === offer.revision,
    );
    if (!match) throw new ServiceError("STALE_MATCH", 409);
    match.status = input.action === "approve_match" ? "approved" : "rejected";
  } else throw new ServiceError("INVALID_REVIEW", 400);
  write(store, s, data, "affiliate_" + input.action, offer.id);
  return data;
}
export function publicAffiliateOffers(
  store,
  placeIds = [],
  placement = "activity",
) {
  if (
    !Array.isArray(placeIds) ||
    placeIds.length > 8 ||
    placeIds.some((id) => typeof id !== "string" || id.length > 100) ||
    !["activity", "stay", "preparation"].includes(placement)
  )
    throw new ServiceError("INVALID_QUERY", 400);
  const data = affiliateConfig(store),
    today = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10),
    published = new Set(
      store
        .catalog()
        .filter(
          (p) =>
            p.published &&
            !p.sample &&
            (!p.availableUntil || p.availableUntil >= today),
        )
        .map((p) => p.id),
    );
  return data.offers
    .filter(
      (o) =>
        o.status === "approved" &&
        o.active &&
        o.placement === placement &&
        (!o.validUntil || o.validUntil >= today) &&
        (placement === "preparation" ||
          data.matches.some(
            (m) =>
              m.offerId === o.id &&
              m.offerRevision === o.revision &&
              m.status === "approved" &&
              placeIds.includes(m.placeId) &&
              published.has(m.placeId),
          )),
    )
    .slice(0, 8)
    .map(
      ({
        id,
        revision,
        provider,
        product_id,
        url,
        title_i18n,
        price_from,
        currency,
        placement,
        trackingParam,
        checkedAt,
      }) => ({
        id,
        provider,
        product_id,
        url,
        title_i18n,
        price_from,
        currency,
        placement,
        trackingParam,
        checkedAt,
        matched_place_id: data.matches.find(m=>m.offerId===id&&m.offerRevision===revision&&m.status==='approved'&&placeIds.includes(m.placeId)&&published.has(m.placeId))?.placeId||null,
      }),
    );
}

import test from "node:test";
import assert from "node:assert/strict";
import { Store, areas } from "../server/store.mjs";
import { createApp } from "../server/index.mjs";
import {
  affiliateConfig,
  saveAffiliate,
  suggestAffiliateMatches,
  reviewAffiliate,
  publicAffiliateOffers,
} from "../server/affiliates.mjs";
import { affiliateLink } from "../shared/affiliates.ts";
function setup() {
  const store = new Store(),
    admin = store.setPreviewRole(store.session(), "admin");
  const original = store.catalog()[0];
  const places = [
    {
      ...original,
      id: "official-a",
      sample: false,
      published: true,
      areaId: areas[0].id,
      category: "experience",
    },
    {
      ...original,
      id: "official-b",
      sample: false,
      published: true,
      areaId: areas[1].id,
      category: "food",
    },
  ];
  store.catalog = () => places;
  return { store, admin, places };
}
const input = {
  provider: "klook",
  url: "https://www.klook.com/activity/123-example/?aff=approved-code",
  title_i18n: { ko: "로컬 테스트 상품", en: "Local test product" },
  price_from: null,
  currency: "KRW",
  placement: "activity",
  categoryIds: ["experience"],
};
test("affiliate offers and automatic matches stay private until separately reviewed; edits invalidate approvals and pause hides immediately", () => {
  const { store, admin, places } = setup();
  try {
    const offer = saveAffiliate(store, admin, input);
    assert.equal(publicAffiliateOffers(store, ["official-a"]).length, 0);
    assert.equal(suggestAffiliateMatches(store, admin).added, 1);
    assert.equal(suggestAffiliateMatches(store, admin).added, 0);
    assert.throws(
      () =>
        reviewAffiliate(store, admin, {
          offerId: offer.id,
          revision: offer.revision,
          action: "approve_offer",
        }),
      /REVIEW_CONFIRMATION_REQUIRED/,
    );
    reviewAffiliate(store, admin, {
      offerId: offer.id,
      revision: offer.revision,
      action: "approve_offer",
      confirmed: true,
    });
    assert.equal(publicAffiliateOffers(store, ["official-a"]).length, 0);
    const match = affiliateConfig(store).matches[0];
    reviewAffiliate(store, admin, {
      offerId: offer.id,
      revision: offer.revision,
      action: "approve_match",
      matchId: match.id,
    });
    assert.equal(publicAffiliateOffers(store, ["official-a"]).length, 1);
    assert.equal(publicAffiliateOffers(store,['official-b','official-a'])[0].matched_place_id,'official-a');
    assert.equal(publicAffiliateOffers(store, ["official-b"]).length, 0);
    places[0].published = false;
    assert.equal(publicAffiliateOffers(store, ["official-a"]).length, 0);
    places[0].published = true;
    reviewAffiliate(store, admin, {
      offerId: offer.id,
      revision: offer.revision,
      action: "pause_offer",
    });
    assert.equal(publicAffiliateOffers(store, ["official-a"]).length, 0);
    const updated = saveAffiliate(store, admin, {
      ...offer,
      title_i18n: { ko: "수정 상품", en: "Edited product" },
    });
    assert.notEqual(updated.revision, offer.revision);
    assert.equal(publicAffiliateOffers(store, ["official-a"]).length, 0);
    assert.equal(affiliateConfig(store).matches.length, 0);
    assert.throws(
      () =>
        reviewAffiliate(store, admin, {
          offerId: offer.id,
          revision: offer.revision,
          action: "approve_offer",
          confirmed: true,
        }),
      /STALE_OFFER/,
    );
  } finally {
    store.close();
  }
});
test("affiliate rules respect district and manual targets; expired products stay hidden and hostile URLs are rejected", () => {
  const { store, admin } = setup();
  try {
    for (const url of [
      "http://www.klook.com/",
      "https://klook.com.evil.example/",
      "https://user:secret@www.klook.com/",
      "https://127.0.0.1/",
    ])
      assert.throws(
        () => saveAffiliate(store, admin, { ...input, url }),
        /INVALID_OFFER_URL/,
      );
    assert.throws(
      () => saveAffiliate(store, { role: "partner" }, input),
      /FORBIDDEN/,
    );
    saveAffiliate(store, admin, { ...input, areaIds: [areas[1].id] });
    assert.equal(suggestAffiliateMatches(store, admin).added, 0);
    const o = saveAffiliate(store, admin, {
      ...input,
      placeIds: ["official-b"],
      validUntil: "2020-01-01",
    });
    suggestAffiliateMatches(store, admin);
    const m = affiliateConfig(store).matches.find((m) => m.offerId === o.id);
    assert.equal(m.placeId, "official-b");
    reviewAffiliate(store, admin, {
      offerId: o.id,
      revision: o.revision,
      action: "approve_offer",
      confirmed: true,
    });
    reviewAffiliate(store, admin, {
      offerId: o.id,
      revision: o.revision,
      action: "approve_match",
      matchId: m.id,
    });
    assert.equal(publicAffiliateOffers(store, ["official-b"]).length, 0);
  } finally {
    store.close();
  }
});
test("affiliate tracking is opt-in per provider, preserves existing signed query values, and includes no user identity", () => {
  assert.equal(
    affiliateLink(
      { ...input, id: "o", trackingParam: "" },
      "en",
      "route",
      "official-a",
    ),
    input.url,
  );
  const url = new URL(
    affiliateLink(
      { ...input, id: "o", trackingParam: "sub_id" },
      "ja",
      "route",
      "official-a",
    ),
  );
  assert.equal(url.searchParams.get("aff"), "approved-code");
  assert.equal(url.searchParams.get("sub_id"), "route_ja_official-a");
  const existing = input.url + "&sid=provider-existing";
  assert.equal(
    affiliateLink(
      { ...input, id: "o", url: existing, trackingParam: "sid" },
      "en",
      "route",
      "official-a",
    ),
    existing,
  );
});
test("affiliate HTTP routes enforce roles and CSRF and never expose draft offers", async () => {
  const { store, admin } = setup(),
    server = createApp(store, {
      auth: { resolve: async (s) => s, account: () => null },
    });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}/api/`;
  const post = (cookie = true, csrf = true) =>
    fetch(base + "operator/affiliates/save", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(cookie ? { Cookie: "nowro=" + admin.id } : {}),
        ...(csrf ? { "X-NOWRO-Request": "1" } : {}),
      },
      body: JSON.stringify(input),
    });
  try {
    assert.equal((await fetch(base + "operator/affiliates")).status, 403);
    assert.equal((await post(false)).status, 403);
    assert.equal((await post(true, false)).status, 403);
    assert.equal((await post()).status, 200);
    assert.deepEqual(
      await (await fetch(base + "affiliate-offers?places=official-a")).json(),
      { offers: [] },
    );
  } finally {
    await new Promise((r) => server.close(r));
    store.close();
  }
});

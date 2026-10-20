import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Store } from "../server/store.mjs";
import { createApp } from "../server/index.mjs";
import { areas } from "../shared/catalog.ts";
import {
  ownBusiness,
  submitBusiness,
  listBusinesses,
  reviewBusiness,
} from "../server/businesses.mjs";
import {
  saveListing,
  publicListings,
  reviewListing,
} from "../server/listings.mjs";

const data = {
  businessName: "Review workshop",
  areaId: "gwangalli",
  address: "Busan Suyeong-gu sample address",
  contactName: "Sample owner",
  contactEmail: "owner@example.com",
  contactPhone: "+82 10 1234 5678",
  website: "https://example.com",
  description:
    "A sample workshop. Ownership can be checked through the business contact.",
  consent: true,
};
function member(store, email = "owner@example.com") {
  const s = store.session();
  store.db
    .prepare("INSERT INTO auth_accounts VALUES (?,?,?)")
    .run(crypto.randomUUID(), s.user_id, email);
  return s;
}
const decision = (application) => ({
  id: application.id,
  revision: application.revision,
  action: "approve",
  note: "Ownership independently checked with the business.",
  verificationMethod: "business-contact",
  ownershipVerified: true,
});
const photo =
  "data:image/png;base64," +
  readFileSync(new URL("../public/icon-192.png", import.meta.url)).toString(
    "base64",
  );
const listing = {
  ...data,
  kind: "experience",
  category: "experience",
  titleKo: "체험 상품",
  titleEn: "Workshop visit",
  summaryKo: "체험 소개",
  summaryEn: "Workshop introduction",
  descriptionKo: "체험 상세",
  descriptionEn: "Workshop details",
  contact: "Public inquiries",
  bookingUrl: "https://example.com",
  priceMin: 1000,
  priceMax: 2000,
  duration: 40,
  hours: "10:00–18:00",
  inclusions: "Materials",
  exclusions: "Transport",
  cancellation: "Contact us",
  promotion: "",
  images: [photo],
  imageRights: true,
};

test("Only verified members apply; application identity cannot be chosen by the client and all 16 districts validate", () => {
  const store = new Store();
  try {
    const guest = store.session(),
      first = member(store),
      second = member(store, "second@example.com");
    assert.throws(
      () => submitBusiness(store, guest, { data }),
      /SIGN_IN_REQUIRED/,
    );
    assert.throws(
      () => submitBusiness(store, first, null),
      /INVALID_BUSINESS_APPLICATION/,
    );
    assert.throws(
      () => submitBusiness(store, first, { data: { ...data, consent: false } }),
      /BUSINESS_CONSENT_REQUIRED/,
    );
    assert.throws(
      () =>
        submitBusiness(store, first, {
          data: { ...data, website: "javascript:alert(1)" },
        }),
      /INVALID_BUSINESS_WEBSITE/,
    );
    const a = submitBusiness(store, first, {
      data,
      owner_id: second.user_id,
      role: "partner",
      status: "approved",
    });
    assert.equal(a.status, "pending");
    assert.equal(store.session(first.id).role, "traveler");
    assert.equal(ownBusiness(store, second), null);
    assert.equal(ownBusiness(store, first).id, a.id);
    assert.throws(
      () => submitBusiness(store, first, { data }),
      /BUSINESS_ALREADY_SUBMITTED/,
    );
    assert.throws(() => listBusinesses(store, first), /FORBIDDEN/);
    assert.throws(() => reviewBusiness(store, first, decision(a)), /FORBIDDEN/);
    for (const area of areas)
      assert.equal(
        submitBusiness(store, member(store, `${area.id}@example.com`), {
          data: { ...data, areaId: area.id },
        }).data.areaId,
        area.id,
      );
  } finally {
    store.close();
  }
});

test("Human ownership confirmation, stale-review protection, rejection and resubmission are enforced", () => {
  const store = new Store();
  try {
    const owner = member(store),
      admin = store.setPreviewRole(store.session(), "admin");
    const a = submitBusiness(store, owner, { data });
    assert.throws(
      () =>
        reviewBusiness(store, admin, {
          ...decision(a),
          ownershipVerified: false,
        }),
      /BUSINESS_VERIFICATION_REQUIRED/,
    );
    assert.throws(
      () => reviewBusiness(store, admin, { ...decision(a), note: "yes" }),
      /BUSINESS_REVIEW_REQUIRED/,
    );
    assert.equal(store.session(owner.id).role, "traveler");
    const rejected = reviewBusiness(store, admin, {
      ...decision(a),
      action: "reject",
    });
    assert.equal(rejected.status, "rejected");
    const revised = submitBusiness(store, owner, {
      data: { ...data, description: data.description + " Updated." },
    });
    assert.equal(revised.id, a.id);
    assert.ok(revised.revision > rejected.revision);
    assert.throws(
      () => reviewBusiness(store, admin, decision(a)),
      /BUSINESS_REVIEW_STALE/,
    );
    const approved = reviewBusiness(store, admin, decision(revised));
    assert.equal(approved.status, "approved");
    assert.equal(store.session(owner.id).role, "partner");
    assert.equal(store.session(owner.id).place_id, null);
    assert.throws(
      () => reviewBusiness(store, admin, decision(revised)),
      /BUSINESS_REVIEW_STALE/,
    );
    assert.equal(
      store.operator(store.session(owner.id)).business.businessName,
      data.businessName,
    );
    assert.deepEqual(store.wallet(store.session(owner.id)).trips, []);
    assert.throws(
      () => store.owned(store.session(owner.id), "g-cafe"),
      /FORBIDDEN/,
    );
    assert.ok(listBusinesses(store, admin)[0].reviewedAt);
  } finally {
    store.close();
  }
});

test("Listings are tied to the approved business; revocation hides published entries and blocks late publication", () => {
  const store = new Store();
  try {
    const owner = member(store),
      other = member(store, "other@example.com"),
      admin = store.setPreviewRole(store.session(), "admin");
    const a = submitBusiness(store, owner, { data });
    const approved = reviewBusiness(store, admin, decision(a));
    const partner = store.session(owner.id);
    assert.throws(
      () =>
        saveListing(store, partner, {
          data: { ...listing, businessName: "Other shop" },
          submit: true,
        }),
      /BUSINESS_IDENTITY_MISMATCH/,
    );
    assert.throws(
      () =>
        saveListing(store, partner, {
          data: { ...listing, areaId: "haeundae" },
          submit: true,
        }),
      /BUSINESS_IDENTITY_MISMATCH/,
    );
    const published = saveListing(store, partner, {
      data: listing,
      submit: true,
    });
    const pending = saveListing(store, partner, {
      data: listing,
      submit: true,
    });
    reviewListing(store, admin, {
      id: published.id,
      approved: true,
      note: "Publication checked",
    });
    assert.equal(publicListings(store.db).length, 1);
    const b = submitBusiness(store, other, {
      data: { ...data, businessName: "Other business" },
    });
    reviewBusiness(store, admin, decision(b));
    assert.throws(
      () =>
        saveListing(store, store.session(other.id), {
          id: published.id,
          data: listing,
        }),
      /NOT_FOUND/,
    );
    reviewBusiness(store, admin, {
      ...decision(approved),
      action: "revoke",
      note: "Business ownership no longer verified.",
    });
    assert.equal(store.session(owner.id).role, "traveler");
    assert.equal(publicListings(store.db).length, 0);
    assert.throws(
      () =>
        reviewListing(store, admin, {
          id: pending.id,
          approved: true,
          note: "Late publication attempt",
        }),
      /BUSINESS_NOT_APPROVED/,
    );
    assert.throws(
      () => saveListing(store, store.session(owner.id), { data: listing }),
      /FORBIDDEN/,
    );
    const resubmitted = submitBusiness(store, store.session(owner.id), {
      data: { ...data, businessName: "Renamed business" },
    });
    reviewBusiness(store, admin, decision(resubmitted));
    assert.throws(
      () =>
        reviewListing(store, admin, {
          id: pending.id,
          approved: true,
          note: "Old identity after rename",
        }),
      /BUSINESS_IDENTITY_MISMATCH/,
    );
    assert.equal(
      publicListings(store.db).length,
      0,
      "Reapproval must not silently republish archived listings",
    );
  } finally {
    store.close();
  }
});

test("Business HTTP routes reject guests, CSRF and non-admin review without leaking contact details", async () => {
  const store = new Store(),
    owner = member(store),
    outsider = member(store, "outsider@example.com");
  const auth = {
    enabled: true,
    redirect: null,
    resolve: async (s) => store.session(s.id),
    account: (s) =>
      store.db
        .prepare("SELECT auth_id,email FROM auth_accounts WHERE user_id=?")
        .get(s.user_id),
  };
  const server = createApp(store, { auth, preview: false });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/`;
  const request = (path, s, body, csrf = true) =>
    fetch(base + path, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        Cookie: `nowro=${s.id}`,
        "Content-Type": "application/json",
        ...(csrf ? { "X-NOWRO-Request": "1" } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  try {
    assert.equal(
      (await request("business/application", store.session(), { data })).status,
      401,
    );
    assert.equal(
      (await request("business/application", owner, { data }, false)).status,
      403,
    );
    const submitted = await request("business/application", owner, { data });
    assert.equal(submitted.status, 200);
    assert.equal((await request("operator/businesses", outsider)).status, 403);
    assert.deepEqual(
      await (await request("business/application", outsider)).json(),
      { application: null },
    );
    assert.equal(
      (
        await request(
          "operator/businesses/review",
          owner,
          decision((await submitted.json()).application),
        )
      ).status,
      403,
    );
    assert.equal(
      (await (await request("listings", outsider)).text()).includes(
        "owner@example.com",
      ),
      false,
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
    store.close();
  }
});

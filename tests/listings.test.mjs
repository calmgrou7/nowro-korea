import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Store } from "../server/store.mjs";
import { updateListingRoute } from "../server/listing-routes.mjs";
import { recommendationResponse } from "../server/recommendation.mjs";
import { createApp } from "../server/index.mjs";
import { areas } from "../shared/catalog.ts";
import {
  operatorListings,
  publicListings as allPublicListings,
  saveListing,
  reviewListing,
  archiveListing,
} from "../server/listings.mjs";
import { curatedEvents } from '../shared/curated-events.ts';
const providerOnly = rows => rows.filter(row => !curatedEvents.some(event => event.id === row.id));
const publicListings = db => providerOnly(allPublicListings(db));
const photo =
  "data:image/png;base64," +
  readFileSync(new URL("../public/icon-192.png", import.meta.url)).toString(
    "base64",
  );
const data = {
  kind: "experience",
  category: "experience",
  areaId: "seomyeon",
  businessName: "Test provider",
  titleKo: "공방 테스트",
  titleEn: "Workshop test",
  summaryKo: "소개",
  summaryEn: "Introduction",
  descriptionKo: "체험 설명",
  descriptionEn: "Workshop description",
  address: "부산 전포",
  contact: "Public inquiry",
  bookingUrl: "https://example.com/booking",
  priceMin: 10000,
  priceMax: 20000,
  duration: 60,
  hours: "Reservation required",
  inclusions: "Materials",
  exclusions: "Transport",
  cancellation: "Contact provider",
  promotion: "Seasonal workshop",
  images: [photo],
  imageRights: true,
};
function setup(fn) {
  const store = new Store();
  try {
    fn(store);
  } finally {
    store.close();
  }
}
test("providers can submit and admins can publish listings in every Busan district", () =>
  setup((s) => {
    const partner = s.setPreviewRole(s.session(), "partner"),
      admin = s.setPreviewRole(s.session(), "admin");
    assert.equal(new Set(areas.map((a) => a.districtId)).size, 16);
    for (const area of areas) {
      const submitted = saveListing(s, partner, {
        data: { ...data, areaId: area.id, address: "부산 " + area.name.ko },
        submit: true,
      });
      reviewListing(s, admin, {
        id: submitted.id,
        approved: true,
        note: "District registration test",
      });
    }
    assert.deepEqual(
      new Set(publicListings(s.db).map((item) => item.data.areaId)),
      new Set(areas.map((a) => a.id)),
    );
  }));
test("provider draft → submission → admin publication → edit hides pending changes", () =>
  setup((s) => {
    const partner = s.setPreviewRole(s.session(), "partner"),
      admin = s.setPreviewRole(s.session(), "admin");
    const draft = saveListing(s, partner, { data, submit: false });
    assert.equal(publicListings(s.db).length, 0);
    const submitted = saveListing(s, partner, {
      id: draft.id,
      data,
      submit: true,
    });
    assert.equal(submitted.status, "pending");
    assert.equal(publicListings(s.db).length, 0);
    assert.throws(
      () =>
        reviewListing(s, partner, { id: draft.id, approved: true, note: "" }),
      /FORBIDDEN/,
    );
    reviewListing(s, admin, { id: draft.id, approved: true, note: "Reviewed" });
    assert.equal(publicListings(s.db)[0].data.titleKo, data.titleKo);
    archiveListing(s, partner, { id: draft.id });
    assert.equal(publicListings(s.db).length, 0);
    assert.equal(operatorListings(s.db, partner)[0].status, "archived");
    saveListing(s, partner, {
      id: draft.id,
      data: { ...data, titleKo: "수정" },
      submit: true,
    });
    assert.equal(publicListings(s.db).length, 0);
    reviewListing(s, admin, {
      id: draft.id,
      approved: false,
      note: "Please clarify price",
    });
    assert.equal(
      operatorListings(s.db, partner)[0].reviewNote,
      "Please clarify price",
    );
    assert.equal(publicListings(s.db).length, 0);
  }));
test("traveler cannot register and providers cannot read or update other provider content", () =>
  setup((s) => {
    const traveler = s.session(),
      partner = s.setPreviewRole(s.session(), "partner");
    const id = saveListing(s, partner, { data, submit: true }).id;
    assert.throws(
      () => saveListing(s, traveler, { data, submit: true }),
      /FORBIDDEN/,
    );
    assert.throws(() => operatorListings(s.db, traveler), /FORBIDDEN/);
    const other = { ...partner, user_id: traveler.user_id };
    assert.equal(operatorListings(s.db, other).length, 0);
    assert.throws(
      () => saveListing(s, other, { id, data, submit: true }),
      /NOT_FOUND/,
    );
    assert.throws(() => archiveListing(s, other, { id }), /NOT_FOUND/);
  }));
test("publication requires bilingual details, photo rights and valid numeric and link fields", () =>
  setup((s) => {
    const p = s.setPreviewRole(s.session(), "partner");
    for (const patch of [
      { titleEn: "" },
      { images: [] },
      { imageRights: false },
      { priceMin: 30000 },
      { duration: NaN },
      { bookingUrl: "javascript:alert(1)" },
      { images: ["data:image/png;base64,aGVsbG8="] },
    ])
      assert.throws(() =>
        saveListing(s, p, { data: { ...data, ...patch }, submit: true }),
      );
    const id = saveListing(s, p, {
      data: { ...data, status: "published", owner_id: "someone" },
      submit: true,
    }).id;
    assert.equal(operatorListings(s.db, p)[0].status, "pending");
    assert.equal(publicListings(s.db).length, 0);
    assert.ok(id);
  }));
test("HTTP listing routes enforce session role, CSRF and validation error status", async () => {
  const store = new Store(),
    server = createApp(store, { preview: true });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const url = `http://127.0.0.1:${server.address().port}/api/`;
  try {
    const initial = await fetch(url + "status");
    const cookie = initial.headers.get("set-cookie").split(";")[0];
    const post = (path, body, csrf = true) =>
      fetch(url + path, {
        method: "POST",
        headers: {
          cookie,
          "Content-Type": "application/json",
          ...(csrf ? { "X-NOWRO-Request": "1" } : {}),
        },
        body: JSON.stringify(body),
      });
    assert.equal(
      (await post("operator/listings/save", { data, submit: true })).status,
      403,
    );
    await post("preview-role", { role: "partner" });
    assert.equal(
      (await post("operator/listings/save", { data, submit: true }, false))
        .status,
      403,
    );
    assert.equal(
      (
        await post("operator/listings/save", {
          data: { ...data, titleEn: "" },
          submit: true,
        })
      ).status,
      400,
    );
    const saved = await (
      await post("operator/listings/save", { data, submit: true })
    ).json();
    assert.ok(saved.id);
    assert.equal(
      providerOnly((await (await fetch(url + "listings")).json()).listings).length,
      0,
    );
    await post("preview-role", { role: "admin" });
    assert.equal(
      (
        await post("operator/listings/review", {
          id: saved.id,
          approved: true,
          note: "",
        })
      ).status,
      200,
    );
    const pub = providerOnly((await (await fetch(url + "listings")).json()).listings);
    assert.equal(pub.length, 1);
    assert.equal(pub[0].owner_id, undefined);
  } finally {
    await new Promise((r) => server.close(r));
    store.close();
  }
});

test('approved route link mixes a partner stop with public data and saved routes retain their snapshot', () =>
  setup(store => {
    const partner = store.setPreviewRole(store.session(), 'partner');
    const admin = store.setPreviewRole(store.session(), 'admin');
    const area = areas.find(area => area.id === data.areaId);
    const { id } = saveListing(store, partner, { data, submit: true });
    reviewListing(store, admin, { id, approved: true, note: '' });
    const { updated } = operatorListings(store.db, admin)[0];
    const payload = { id, updated, mode: 'new', ...area.point, days: [0, 1, 2, 3, 4, 5, 6],
      open: 540, close: 1080, stay: 60, reservation: false };
    const partnerId = 'partner-listing-' + id;
    assert.throws(() => updateListingRoute(store, partner, payload), /FORBIDDEN/);
    assert.throws(() => updateListingRoute(store, admin, { ...payload, days: [] }), /INVALID_ROUTE_PLACE/);
    assert.ok(!store.catalog().some(p => p.id === partnerId));
    updateListingRoute(store, admin, payload);
    const place = store.catalog().find(p => p.id === partnerId);
    assert.equal(place.address, data.address);
    assert.equal(place.contact, undefined);
    const publicPlace = { ...place, id: 'official-test', partnerListingIds: undefined, source: 'TourAPI' };
    store.db.prepare("INSERT INTO config(key,value) VALUES('tourism_catalog',?)").run(JSON.stringify([publicPlace]));
    const conditions = { areaId: area.id, origin: area.point, minutes: 360, budget: 100000, interests: ['experience'],
      transport: 'walk', companion: 'solo', startAt: '2027-01-04T10:00:00+09:00',
      returnPoint: null, deadline: null, children: false, accessible: false, diet: '', tripStart: '', tripEnd: '',
      requiredPlaceIds: ['official-test', partnerId] };
    const result = recommendationResponse(conditions, store.catalog());
    assert.ok(result.routes.some(route => route.stops.length === 2));
    const traveler = store.session();
    const route = result.routes.find(route => route.stops.length === 2);
    const saved = store.save(traveler, { placeIds: route.stops.map(stop => stop.placeId), conditions });
    archiveListing(store, partner, { id });
    assert.ok(!store.catalog().some(p => p.id === partnerId));
    assert.ok(saved.route.placeSnapshots.some(p => p.id === partnerId));
  }));

test('linking the same official place preserves its ID and editing clears the link', () =>
  setup(store => {
    const partner = store.setPreviewRole(store.session(), 'partner');
    const admin = store.setPreviewRole(store.session(), 'admin');
    const { id } = saveListing(store, partner, { data, submit: true });
    reviewListing(store, admin, { id, approved: true, note: '' });
    const { updated } = operatorListings(store.db, admin)[0];
    const official = { ...store.baseCatalog()[0], id: 'official-same', areaId: data.areaId, published: true, sample: false };
    store.db.prepare("INSERT INTO config(key,value) VALUES('tourism_catalog',?)").run(JSON.stringify([official]));
    updateListingRoute(store, admin, { id, updated, mode: 'existing', placeId: official.id });
    assert.deepEqual(store.catalog().find(p => p.id === official.id).partnerListingIds, [id]);
    assert.ok(!store.catalog().some(p => p.id === 'partner-listing-' + id));
    saveListing(store, partner, { id, data: { ...data, titleKo: '수정 체험' }, submit: true });
    reviewListing(store, admin, { id, approved: true, note: '' });
    assert.equal(store.catalog().find(p => p.id === official.id).partnerListingIds, undefined);
  }));

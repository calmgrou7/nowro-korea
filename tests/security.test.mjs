import test from "node:test";
import assert from "node:assert/strict";
import { Store } from "../server/store.mjs";
import { createApp } from "../server/index.mjs";
import { areas } from "../shared/catalog.ts";
import {testPayment} from '../server/rewards.mjs';
const c = {
  areaId: "gwangalli",
  origin: areas[1].point,
  minutes: 120,
  budget: 60000,
  interests: ["sea", "cafe"],
  transport: "walk",
  companion: "solo",
  startAt: "2026-10-05T10:00:00+09:00",
  returnPoint: null,
  deadline: null,
  children: false,
  accessible: false,
  diet: "",
  tripStart: "",
  tripEnd: "",
};
function setup(fn) {
  const store = new Store();
  try {
    fn(store);
  } finally {
    store.close();
  }
}
test("traveler A cannot see or delete traveler B saved routes", () =>
  setup((s) => {
    const a = s.session(),
      b = s.session();
    const trip = s.save(a, { placeIds: ["g-beach", "g-cafe"], conditions: c });
    assert.equal(s.wallet(a).trips.length, 1);
    assert.equal(s.wallet(b).trips.length, 0);
    assert.throws(() => s.deleteTrip(b, trip.id), /NOT_FOUND/);
    assert.equal(s.wallet(a).trips.length, 1);
  }));
test("coupon cap and one per guest enforced server-side", () =>
  setup((s) => {
    const a = s.session();
    s.issue(a, "coffee-g");
    assert.throws(() => s.issue(a, "coffee-g"), /ALREADY_ISSUED/);
    for (let i = 0; i < 29; i++) s.issue(s.session(), "coffee-g");
    assert.throws(() => s.issue(s.session(), "coffee-g"), /SOLD_OUT/);
    assert.equal(s.db.prepare("SELECT count(*) n FROM vouchers").get().n, 30);
  }));
test("traveler cannot redeem; partner cannot redeem other business; minimum and duplicate checked", () =>
  setup((s) => {
    const a = s.session(),
      partner = s.setPreviewRole(s.session(), "partner");
    const g = s.issue(a, "coffee-g"),
      h = s.issue(a, "coffee-h");
    assert.throws(() => s.redeem(a, g.id, 10000), /FORBIDDEN/);
    assert.throws(() => s.redeem(partner, h.id, 10000), /FORBIDDEN/);
    assert.throws(() => s.redeem(partner, g.id, 6000), /MINIMUM_SPEND/);
    s.redeem(partner, g.id, 7000);
    assert.throws(() => s.redeem(partner, g.id, 7000), /ALREADY_REDEEMED/);
    assert.equal(
      s.wallet(a).vouchers.find((v) => v.id === g.id).status,
      "used",
    );
  }));
test("paused coupon blocks issuance and redemption", () =>
  setup((s) => {
    const traveler = s.session(),
      partner = s.setPreviewRole(s.session(), "partner"),
      v = s.issue(traveler, "coffee-g");
    s.toggle(partner, "coffee-g", true);
    assert.throws(() => s.issue(s.session(), "coffee-g"), /COUPON_PAUSED/);
    assert.throws(() => s.redeem(partner, v.id, 7000), /COUPON_PAUSED/);
  }));
test("signed stamp proof is owned, expiring, single-use and one per place", () =>
  setup((s) => {
    const a = s.session(),
      b = s.session(),
      partner = s.setPreviewRole(s.session(), "partner");
    assert.throws(() => s.challenge(a, "g-cafe"), /FORBIDDEN/);
    assert.throws(() => s.challenge(partner, "h-cafe"), /FORBIDDEN/);
    const first = s.challenge(partner, "g-cafe", testPayment(s,partner,{placeId:'g-cafe',reference:'test-1',amount:7000}).id);
    assert.throws(() => s.stamp(a, first.token + "x"), /INVALID_QR/);
    s.stamp(a, first.token);
    assert.throws(() => s.stamp(b, first.token), /REPLAY_QR/);
    const second = s.challenge(partner, "g-cafe", testPayment(s,partner,{placeId:'g-cafe',reference:'test-2',amount:7000}).id);
    assert.throws(() => s.stamp(a, second.token), /ALREADY_STAMPED/);
    s.db.prepare("UPDATE challenges SET expires=1 WHERE used=0").run();
    assert.throws(() => s.stamp(b, second.token), /INVALID_QR|EXPIRED_QR/);
    assert.equal(s.wallet(a).stamps.length, 1);
    assert.equal(s.wallet(b).stamps.length, 0);
  }));
test("partner changes remain pending, other places denied, only admin can approve", () =>
  setup((s) => {
    const partner = s.setPreviewRole(s.session(), "partner"),
      admin = s.setPreviewRole(s.session(), "admin");
    const before = s.catalog().find((p) => p.id === "g-cafe").costMax;
    const proposal = s.proposal(partner, "g-cafe", {
      costMax: 18000,
      stay: 40,
    });
    assert.equal(s.catalog().find((p) => p.id === "g-cafe").costMax, before);
    assert.throws(
      () => s.proposal(partner, "h-cafe", { costMax: 18000, stay: 40 }),
      /FORBIDDEN/,
    );
    assert.throws(() => s.approve(partner, proposal.id, true), /FORBIDDEN/);
    s.approve(admin, proposal.id, true);
    assert.equal(s.catalog().find((p) => p.id === "g-cafe").costMax, 18000);
    assert.ok(!("user_id" in s.operator(partner)));
  }));
test("consent controls optional events and withdrawal purges them", () =>
  setup((s) => {
    const a = s.session();
    s.event(a, "recommend");
    assert.equal(s.db.prepare("SELECT count(*) n FROM events").get().n, 0);
    s.setConsent(a, { analytics: true, location: false });
    s.event(a, "recommend");
    assert.equal(s.db.prepare("SELECT count(*) n FROM events").get().n, 1);
    s.setConsent(a, { analytics: false, location: false });
    assert.equal(s.db.prepare("SELECT count(*) n FROM events").get().n, 0);
  }));
test("expired guest data is purged and sessions rotate", () =>
  setup((s) => {
    const a = s.session();
    s.save(a, { placeIds: ["g-beach"], conditions: c });
    s.db.prepare("UPDATE sessions SET expires=1 WHERE id=?").run(a.id);
    s.purge();
    assert.equal(s.db.prepare("SELECT count(*) n FROM trips").get().n, 0);
    assert.notEqual(s.session(a.id).user_id, a.user_id);
  }));
test("HTTP APIs enforce cookie isolation, CSRF, roles and disabled operator preview", async () => {
  const store = new Store(),
    server = createApp(store, { preview: false });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const url = `http://127.0.0.1:${server.address().port}/api/`;
  try {
    const bootstrap = await fetch(url + "status");
    const cookie = bootstrap.headers.get("set-cookie").split(";")[0];
    assert.ok(cookie);
    assert.equal((await bootstrap.json()).operatorPreview, false);
    assert.equal(
      (
        await fetch(url + "preview-role", {
          method: "POST",
          headers: {
            Cookie: cookie,
            "Content-Type": "application/json",
            "X-NOWRO-Request": "1",
          },
          body: JSON.stringify({ role: "admin" }),
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await fetch(url + "coupons/issue", {
          method: "POST",
          headers: { Cookie: cookie, "Content-Type": "application/json" },
          body: JSON.stringify({ couponId: "coffee-g" }),
        })
      ).status,
      403,
    );
    assert.equal(
      (await fetch(url + "operator", { headers: { Cookie: cookie } })).status,
      403,
    );
    const save = await fetch(url + "trips", {
      method: "POST",
      headers: {
        Cookie: cookie,
        "Content-Type": "application/json",
        "X-NOWRO-Request": "1",
      },
      body: JSON.stringify({ placeIds: ["g-beach"], conditions: c }),
    });
    assert.equal(save.status, 200);
    assert.equal((await (await fetch(url + "wallet")).json()).trips.length, 0);
    assert.equal(
      (
        await (
          await fetch(url + "wallet", { headers: { Cookie: cookie } })
        ).json()
      ).trips.length,
      1,
    );
  } finally {
    await new Promise((r) => server.close(r));
    store.close();
  }
});

import test from "node:test";
import assert from "node:assert/strict";
import { Store } from "../server/store.mjs";
import { createApp } from "../server/index.mjs";
import {
  testPayment,
  rewardProgress,
  claimReward,
  adminRewards,
  updateReward,
} from "../server/rewards.mjs";
function complete(store, user, admin) {
  for (const placeId of ["h-cafe", "g-cafe", "s-cafe", "y-cafe"]) {
    const p = testPayment(store, admin, {
      placeId,
      reference: crypto.randomUUID(),
      amount: 7000,
    });
    store.stamp(user, store.challenge(admin, placeId, p.id).token);
  }
}
test("payment confirmation is required, QR renewal invalidates previous proof, paid receipt is single use", () => {
  const s = new Store();
  try {
    const admin = s.setPreviewRole(s.session(), "admin"),
      u = s.session();
    assert.throws(() => s.challenge(admin, "g-cafe"), /PAYMENT_REQUIRED/);
    const p = testPayment(s, admin, {
      placeId: "g-cafe",
      reference: "receipt-01",
      amount: 7000,
    });
    assert.throws(() => s.challenge(admin, "h-cafe", p.id), /PAYMENT_REQUIRED/);
    const old = s.challenge(admin, "g-cafe", p.id);
    const next = s.challenge(admin, "g-cafe", p.id);
    assert.throws(() => s.stamp(u, old.token), /REPLAY_QR/);
    s.stamp(u, next.token);
    assert.throws(
      () => s.challenge(admin, "g-cafe", p.id),
      /PAYMENT_ALREADY_STAMPED/,
    );
    assert.equal(rewardProgress(s, u).completedAreas.length, 1);
    assert.throws(
      () => claimReward(s, u, { choice: "discount" }),
      /REWARD_LOCKED/,
    );
  } finally {
    s.close();
  }
});
test("four areas unlock exactly one reward; foreign shipping private, admin transitions validated, guest purge removes addresses", () => {
  const s = new Store();
  try {
    const admin = s.setPreviewRole(s.session(), "admin"),
      u = s.session(),
      other = s.session(),
      partner = s.setPreviewRole(s.session(), "partner");
    complete(s, u, admin);
    assert.equal(rewardProgress(s, u).eligible, true);
    assert.throws(
      () =>
        claimReward(s, u, { choice: "goods", goodsId: "tote", shipping: {} }),
      /SHIPPING_CONSENT_REQUIRED/,
    );
    const order = claimReward(s, u, {
      choice: "goods",
      goodsId: "tote",
      shipping: {
        recipient: "Tester",
        country: "US",
        postalCode: "10001",
        address1: "Test address",
        address2: "",
        city: "New York",
        region: "NY",
        phone: "+1 555 123 4567",
        email: "test@example.com",
        consent: true,
      },
    });
    assert.ok(!("shipping" in order));
    assert.equal(rewardProgress(s, other).order, null);
    assert.throws(
      () => claimReward(s, u, { choice: "discount" }),
      /REWARD_ALREADY_CLAIMED/,
    );
    assert.throws(() => adminRewards(s, partner), /FORBIDDEN/);
    assert.equal(adminRewards(s, admin)[0].shipping.country, "US");
    assert.throws(
      () => updateReward(s, admin, { id: order.id, status: "shipped" }),
      /INVALID_REWARD_STATUS/,
    );
    updateReward(s, admin, { id: order.id, status: "processing" });
    assert.throws(
      () => updateReward(s, admin, { id: order.id, status: "shipped" }),
      /TRACKING_REQUIRED/,
    );
    updateReward(s, admin, {
      id: order.id,
      status: "shipped",
      carrier: "Test carrier",
      tracking: "12345",
    });
    assert.equal(rewardProgress(s, u).order.tracking, "12345");
    assert.ok(
      !s.db
        .prepare("SELECT detail FROM audit")
        .all()
        .some((r) => r.detail.includes("Test address")),
    );
    s.db
      .prepare("UPDATE sessions SET expires=0 WHERE guest_id=?")
      .run(u.user_id);
    s.purge();
    assert.equal(adminRewards(s, admin).length, 0);
    assert.equal(
      s.db.prepare("SELECT COUNT(*) n FROM consumed_payments").get().n,
      4,
    );
  } finally {
    s.close();
  }
});
test("discount choice excludes goods and remains requested until operations confirmation", () => {
  const s = new Store();
  try {
    const admin = s.setPreviewRole(s.session(), "admin"),
      u = s.session();
    complete(s, u, admin);
    const o = claimReward(s, u, { choice: "discount" });
    assert.equal(o.status, "discount_requested");
    assert.match(o.discountCode, /^NOWRO-/);
    assert.throws(
      () => claimReward(s, u, { choice: "goods" }),
      /REWARD_ALREADY_CLAIMED/,
    );
    updateReward(s, admin, { id: o.id, status: "discount_ready" });
    assert.equal(rewardProgress(s, u).order.status, "discount_ready");
  } finally {
    s.close();
  }
});
test("public server cannot enable operator roles or confirm test payments", async () => {
  const s = new Store(),
    server = createApp(s, { preview: false });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    for (const path of ["payments/test", "preview-role"]) {
      const r = await fetch(base + "/api/" + path, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-NOWRO-Request": "1" },
        body: JSON.stringify({ role: "admin" }),
      });
      assert.equal(r.status, 403);
      assert.equal((await r.json()).error, "PREVIEW_DISABLED");
    }
  } finally {
    await new Promise((r) => server.close(r));
    s.close();
  }
});

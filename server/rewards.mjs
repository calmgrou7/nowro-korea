import { randomUUID, randomBytes } from "node:crypto";
import { starterStampAreaIds } from "../shared/catalog.ts";
import { ListingError } from "./listings.mjs";
export const campaign = {
  id: "busan-four-areas-v1",
  requiredAreas: starterStampAreaIds,
  oneChoice: true,
};
export const goods = [
  { id: "tote", en: "NOWRO tote bag", ko: "나우로 토트백" },
  { id: "pouch", en: "NOWRO travel pouch", ko: "나우로 여행 파우치" },
  {
    id: "postcards",
    en: "NOWRO Busan postcard set",
    ko: "나우로 부산 엽서 세트",
  },
];
const fail = (code, status = 400) => {
  throw new ListingError(code, status);
};
export function initializeRewards(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS payments(id TEXT PRIMARY KEY,place_id TEXT NOT NULL,actor TEXT NOT NULL,reference TEXT NOT NULL,amount INTEGER NOT NULL,status TEXT NOT NULL,mode TEXT NOT NULL,created TEXT NOT NULL,UNIQUE(place_id,reference));
 CREATE TABLE IF NOT EXISTS paid_challenges(nonce TEXT PRIMARY KEY REFERENCES challenges(nonce) ON DELETE CASCADE,payment_id TEXT NOT NULL REFERENCES payments(id));
 CREATE TABLE IF NOT EXISTS stamp_payments(stamp_id TEXT PRIMARY KEY REFERENCES stamps(id) ON DELETE CASCADE,payment_id TEXT NOT NULL UNIQUE REFERENCES payments(id));
 CREATE TABLE IF NOT EXISTS consumed_payments(payment_id TEXT PRIMARY KEY REFERENCES payments(id));
 CREATE TABLE IF NOT EXISTS reward_orders(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),campaign_id TEXT NOT NULL,choice TEXT NOT NULL,goods_id TEXT,data TEXT NOT NULL,status TEXT NOT NULL,discount_code TEXT,carrier TEXT,tracking TEXT,created TEXT NOT NULL,updated TEXT NOT NULL,UNIQUE(user_id,campaign_id));`);
}
export function testPayment(store, s, b) {
  store.owned(s, b.placeId);
  if (!["partner", "admin"].includes(s.role)) fail("FORBIDDEN", 403);
  if (
    typeof b.reference !== "string" ||
    !/^[A-Za-z0-9가-힣_.-]{3,80}$/.test(b.reference) ||
    !Number.isSafeInteger(b.amount) ||
    b.amount <= 0 ||
    b.amount > 10000000 ||
    !store.catalog().some((p) => p.id === b.placeId && p.stamp)
  )
    fail("INVALID_PAYMENT");
  if (
    store.db
      .prepare("SELECT id FROM payments WHERE place_id=? AND reference=?")
      .get(b.placeId, b.reference)
  )
    fail("DUPLICATE_PAYMENT", 409);
  const id = randomUUID();
  store.db
    .prepare("INSERT INTO payments VALUES(?,?,?,?,?,?,?,?)")
    .run(
      id,
      b.placeId,
      s.user_id,
      b.reference,
      b.amount,
      "paid",
      "test",
      new Date().toISOString(),
    );
  store.audit(s.user_id, "test_payment_confirmed", {
    id,
    placeId: b.placeId,
    amount: b.amount,
  });
  return { id, status: "paid", mode: "test" };
}
export function paidReceipt(store, s, placeId, paymentId) {
  store.owned(s, placeId);
  const payment = store.db
    .prepare(
      "SELECT * FROM payments WHERE id=? AND place_id=? AND status='paid'",
    )
    .get(paymentId ?? "", placeId);
  if (!payment) fail("PAYMENT_REQUIRED", 409);
  if (
    store.db
      .prepare("SELECT payment_id FROM consumed_payments WHERE payment_id=?")
      .get(payment.id)
  )
    fail("PAYMENT_ALREADY_STAMPED", 409);
  return payment;
}
export function rewardProgress(store, s) {
  store.traveler(s);
  const paid = store.db
    .prepare(
      "SELECT st.place_id FROM stamps st JOIN stamp_payments sp ON sp.stamp_id=st.id JOIN payments p ON p.id=sp.payment_id WHERE st.user_id=? AND p.status='paid'",
    )
    .all(s.user_id);
  const visited = [
    ...new Set(
      paid
        .map((st) => store.catalog().find((p) => p.id === st.place_id)?.areaId)
        .filter(Boolean),
    ),
  ];
  const completedAreas = campaign.requiredAreas.filter((id) =>
    visited.includes(id),
  );
  const order = store.db
    .prepare("SELECT * FROM reward_orders WHERE user_id=? AND campaign_id=?")
    .get(s.user_id, campaign.id);
  return {
    campaign,
    completedAreas,
    eligible: completedAreas.length === campaign.requiredAreas.length,
    goods,
    order: order ? publicOrder(order) : null,
  };
}
function publicOrder(row) {
  return {
    id: row.id,
    choice: row.choice,
    goodsId: row.goods_id,
    status: row.status,
    discountCode: row.discount_code,
    carrier: row.carrier,
    tracking: row.tracking,
    created: row.created,
    updated: row.updated,
  };
}
export function claimReward(store, s, b) {
  store.traveler(s);
  return store.tx(() => {
    const progress = rewardProgress(store, s);
    if (!progress.eligible) fail("REWARD_LOCKED", 409);
    if (progress.order) fail("REWARD_ALREADY_CLAIMED", 409);
    if (!["goods", "discount"].includes(b.choice)) fail("INVALID_REWARD");
    let data = {};
    let goodsId = null;
    if (b.choice === "goods") {
      if (!goods.some((g) => g.id === b.goodsId)) fail("INVALID_GOODS");
      goodsId = b.goodsId;
      if (
        !b.shipping ||
        typeof b.shipping !== "object" ||
        b.shipping.consent !== true
      )
        fail("SHIPPING_CONSENT_REQUIRED");
      for (const key of [
        "recipient",
        "country",
        "postalCode",
        "address1",
        "address2",
        "city",
        "region",
        "phone",
        "email",
      ]) {
        if (typeof b.shipping[key] !== "string" || b.shipping[key].length > 300)
          fail("INVALID_SHIPPING");
        data[key] = b.shipping[key].trim();
      }
      if (
        !data.recipient ||
        !data.postalCode ||
        !data.address1 ||
        !data.city ||
        !data.phone ||
        !/^\S+@\S+\.\S+$/.test(data.email) ||
        !/^[A-Z]{2}$/.test(data.country)
      )
        fail("INVALID_SHIPPING");
      data.consentAt = new Date().toISOString();
    }
    const id = randomUUID(),
      now = new Date().toISOString();
    const code =
      b.choice === "discount"
        ? "NOWRO-" + randomBytes(6).toString("hex").toUpperCase()
        : null;
    // Prototype requests need operational confirmation; no real shipment or discount is promised.
    const status = b.choice === "goods" ? "requested" : "discount_requested";
    store.db
      .prepare("INSERT INTO reward_orders VALUES(?,?,?,?,?,?,?,?,?,?,?,?)")
      .run(
        id,
        s.user_id,
        campaign.id,
        b.choice,
        goodsId,
        JSON.stringify(data),
        status,
        code,
        null,
        null,
        now,
        now,
      );
    store.audit(s.user_id, "reward_requested", { id, choice: b.choice });
    return publicOrder(
      store.db.prepare("SELECT * FROM reward_orders WHERE id=?").get(id),
    );
  });
}
export function adminRewards(store, s) {
  if (s.role !== "admin") fail("FORBIDDEN", 403);
  return store.db
    .prepare("SELECT * FROM reward_orders ORDER BY created DESC")
    .all()
    .map((row) => ({ ...publicOrder(row), shipping: JSON.parse(row.data) }));
}
export function updateReward(store, s, b) {
  if (s.role !== "admin") fail("FORBIDDEN", 403);
  const row = store.db
    .prepare("SELECT * FROM reward_orders WHERE id=?")
    .get(b.id);
  if (!row) fail("NOT_FOUND", 404);
  const allowed = {
    requested: ["processing"],
    processing: ["shipped"],
    shipped: ["delivered"],
    discount_requested: ["discount_ready"],
    discount_ready: ["discount_used"],
  };
  if (!allowed[row.status]?.includes(b.status)) fail("INVALID_REWARD_STATUS");
  if (
    b.status === "shipped" &&
    (typeof b.carrier !== "string" ||
      !b.carrier.trim() ||
      b.carrier.length > 100 ||
      typeof b.tracking !== "string" ||
      !b.tracking.trim() ||
      b.tracking.length > 100)
  )
    fail("TRACKING_REQUIRED");
  store.db
    .prepare(
      "UPDATE reward_orders SET status=?,carrier=?,tracking=?,updated=? WHERE id=?",
    )
    .run(
      b.status,
      b.status === "shipped" ? b.carrier.trim() : row.carrier,
      b.status === "shipped" ? b.tracking.trim() : row.tracking,
      new Date().toISOString(),
      row.id,
    );
  store.audit(s.user_id, "reward_status_updated", {
    id: row.id,
    status: b.status,
  });
  return publicOrder(
    store.db.prepare("SELECT * FROM reward_orders WHERE id=?").get(row.id),
  );
}

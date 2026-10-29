import { DatabaseSync } from "node:sqlite";
import {
  randomBytes,
  randomUUID,
  createHmac,
  timingSafeEqual,
} from "node:crypto";
import {
  places as fixtures,
  coupons,
  areas,
  cities,
} from "../shared/catalog.ts";
import { calculate } from "../shared/engine.ts";
import { initializeListings } from "./listings.mjs";
import { initializeRewards, paidReceipt } from "./rewards.mjs";
import { initializeBusinesses } from "./businesses.mjs";
export class ServiceError extends Error {
  constructor(code, status = 400) {
    super(code);
    this.status = status;
  }
}
export class Store {
  constructor(path = ":memory:") {
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;
 CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,role TEXT NOT NULL,place_id TEXT);
 CREATE TABLE IF NOT EXISTS sessions(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),guest_id TEXT NOT NULL,expires INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS auth_accounts(auth_id TEXT PRIMARY KEY,user_id TEXT NOT NULL UNIQUE REFERENCES users(id),email TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS auth_tokens(session_id TEXT PRIMARY KEY REFERENCES sessions(id) ON DELETE CASCADE,data TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS places(id TEXT PRIMARY KEY,data TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS trips(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),data TEXT NOT NULL,created TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS vouchers(id TEXT PRIMARY KEY,coupon_id TEXT NOT NULL,user_id TEXT NOT NULL REFERENCES users(id),status TEXT NOT NULL,created TEXT NOT NULL,redeemed TEXT,UNIQUE(coupon_id,user_id));
 CREATE TABLE IF NOT EXISTS stamps(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),place_id TEXT NOT NULL,created TEXT NOT NULL,UNIQUE(user_id,place_id));
 CREATE TABLE IF NOT EXISTS challenges(nonce TEXT PRIMARY KEY,place_id TEXT NOT NULL,expires INTEGER NOT NULL,used INTEGER NOT NULL DEFAULT 0);
 CREATE TABLE IF NOT EXISTS proposals(id TEXT PRIMARY KEY,place_id TEXT NOT NULL,actor TEXT NOT NULL,data TEXT NOT NULL,status TEXT NOT NULL,created TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS audit(id TEXT PRIMARY KEY,actor TEXT NOT NULL,event TEXT NOT NULL,detail TEXT NOT NULL,created TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS consent(user_id TEXT PRIMARY KEY,version TEXT NOT NULL,analytics INTEGER NOT NULL,location INTEGER NOT NULL,updated TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS events(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,name TEXT NOT NULL,created TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS config(key TEXT PRIMARY KEY,value TEXT NOT NULL);`);
    this.db.exec(`CREATE TABLE IF NOT EXISTS site_content(
      id INTEGER PRIMARY KEY CHECK(id=1), hero_title_en TEXT NOT NULL DEFAULT '',
      hero_title_ko TEXT NOT NULL DEFAULT '', hero_intro_en TEXT NOT NULL DEFAULT '',
      hero_intro_ko TEXT NOT NULL DEFAULT '', hero_image TEXT NOT NULL DEFAULT '',
      updated_by TEXT, updated TEXT NOT NULL
    );`);
    this.db.prepare("INSERT OR IGNORE INTO site_content(id,updated) VALUES(1,?)").run(new Date().toISOString());
    initializeListings(this.db);
    initializeRewards(this.db);
    initializeBusinesses(this.db);
    for (const p of fixtures)
      this.db
        .prepare("INSERT OR IGNORE INTO places VALUES (?,?)")
        .run(p.id, JSON.stringify(p));
    this.db
      .prepare("INSERT OR IGNORE INTO users VALUES (?,?,?)")
      .run("local-partner", "partner", "g-cafe");
    this.db
      .prepare("INSERT OR IGNORE INTO users VALUES (?,?,?)")
      .run("local-admin", "admin", null);
    this.db
      .prepare("INSERT OR IGNORE INTO config VALUES (?,?)")
      .run("qr-secret", randomBytes(32).toString("hex"));
    this.secret = this.db
      .prepare("SELECT value FROM config WHERE key=?")
      .get("qr-secret").value;
  }
  siteContent() {
    return this.db.prepare("SELECT * FROM site_content WHERE id=1").get();
  }
  updateSiteContent(s, patch) {
    if (s.role !== "admin") throw new ServiceError("FORBIDDEN", 403);
    const allowed = ["hero_title_en","hero_title_ko","hero_intro_en","hero_intro_ko","hero_image"];
    const current = this.siteContent();
    const next = Object.fromEntries(allowed.map((k) => [k, typeof patch?.[k] === "string" ? patch[k].slice(0, 2000) : current[k]]));
    this.db.prepare(`UPDATE site_content SET ${allowed.map((k) => `${k}=?`).join(",")},updated_by=?,updated=? WHERE id=1`)
      .run(...allowed.map((k) => next[k]), s.user_id, new Date().toISOString());
    this.audit(s.user_id, "site_content_updated", next);
    return this.siteContent();
  }
  close() {
    this.db.close();
  }
  tx(fn) {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const result = fn();
      this.db.exec("COMMIT");
      return result;
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }
  catalog() {
    return this.db
      .prepare("SELECT data FROM places")
      .all()
      .map((r) => JSON.parse(r.data));
  }
  session(id) {
    const s =
      id &&
      this.db
        .prepare(
          "SELECT s.*,u.role,u.place_id FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.id=? AND s.expires>?",
        )
        .get(id, Date.now());
    if (s) return s;
    const user = randomUUID(),
      sid = randomBytes(32).toString("hex");
    this.db
      .prepare("INSERT INTO users VALUES (?,?,?)")
      .run(user, "traveler", null);
    this.db
      .prepare("INSERT INTO sessions VALUES (?,?,?,?)")
      .run(sid, user, user, Date.now() + 7 * 86400000);
    return this.session(sid);
  }
  setPreviewRole(s, role) {
    if (!["traveler", "partner", "admin"].includes(role))
      throw new ServiceError("INVALID_ROLE");
    this.db
      .prepare("UPDATE sessions SET user_id=? WHERE id=?")
      .run(
        role === "traveler"
          ? s.guest_id
          : role === "partner"
            ? "local-partner"
            : "local-admin",
        s.id,
      );
    return this.session(s.id);
  }
  audit(actor, event, detail) {
    this.db
      .prepare("INSERT INTO audit VALUES (?,?,?,?,?)")
      .run(
        randomUUID(),
        actor,
        event,
        JSON.stringify(detail),
        new Date().toISOString(),
      );
  }
  owned(s, placeId) {
    if (s.role !== "admin" && (s.role !== "partner" || s.place_id !== placeId))
      throw new ServiceError("FORBIDDEN", 403);
  }
  traveler(s) {
    const memberPartner =
      s.role === "partner" &&
      this.db
        .prepare("SELECT auth_id FROM auth_accounts WHERE user_id=?")
        .get(s.user_id);
    if (s.role !== "traveler" && !memberPartner)
      throw new ServiceError("TRAVELER_REQUIRED", 403);
  }
  wallet(s) {
    this.traveler(s);
    return {
      trips: this.db
        .prepare(
          "SELECT id,data,created FROM trips WHERE user_id=? ORDER BY created DESC",
        )
        .all(s.user_id)
        .map((r) => ({ ...r, data: JSON.parse(r.data) })),
      vouchers: this.db
        .prepare("SELECT * FROM vouchers WHERE user_id=?")
        .all(s.user_id)
        .map((v) => ({
          ...v,
          status:
            Date.now() >
              Date.parse(
                coupons.find((c) => c.id === v.coupon_id)?.until +
                  "T23:59:59+09:00",
              ) && v.status === "held"
              ? "expired"
              : v.status,
        })),
      stamps: this.db
        .prepare(
          "SELECT st.id,st.place_id,st.created FROM stamps st JOIN stamp_payments sp ON sp.stamp_id=st.id JOIN payments p ON p.id=sp.payment_id WHERE st.user_id=? AND p.status='paid'",
        )
        .all(s.user_id),
    };
  }
  save(s, body) {
    this.traveler(s);
    const route = calculate(body.placeIds, body.conditions, this.catalog());
    if (!route) throw new ServiceError("INFEASIBLE_ROUTE");
    const id = randomUUID();
    this.db
      .prepare("INSERT INTO trips VALUES (?,?,?,?)")
      .run(id, s.user_id, JSON.stringify(route), new Date().toISOString());
    return { id, route };
  }
  deleteTrip(s, id) {
    this.traveler(s);
    const r = this.db
      .prepare("DELETE FROM trips WHERE id=? AND user_id=?")
      .run(id, s.user_id);
    if (!r.changes) throw new ServiceError("NOT_FOUND", 404);
  }
  issue(s, id) {
    this.traveler(s);
    return this.tx(() => {
      const c = coupons.find((c) => c.id === id);
      if (!c) throw new ServiceError("NOT_FOUND", 404);
      const paused =
        this.db
          .prepare("SELECT value FROM config WHERE key=?")
          .get("paused:" + id)?.value === "true";
      if (paused) throw new ServiceError("COUPON_PAUSED");
      if (
        Date.now() < Date.parse(c.from + "T00:00:00+09:00") ||
        Date.now() > Date.parse(c.until + "T23:59:59+09:00")
      )
        throw new ServiceError("EXPIRED");
      if (
        this.db
          .prepare("SELECT id FROM vouchers WHERE coupon_id=? AND user_id=?")
          .get(id, s.user_id)
      )
        throw new ServiceError("ALREADY_ISSUED", 409);
      if (
        this.db
          .prepare("SELECT count(*) AS n FROM vouchers WHERE coupon_id=?")
          .get(id).n >= c.cap
      )
        throw new ServiceError("SOLD_OUT", 409);
      const voucher = randomBytes(8).toString("hex");
      this.db
        .prepare("INSERT INTO vouchers VALUES (?,?,?,?,?,?)")
        .run(voucher, id, s.user_id, "held", new Date().toISOString(), null);
      this.audit(s.user_id, "coupon_issue", { couponId: id });
      return { id: voucher };
    });
  }
  redeem(s, id, total) {
    return this.tx(() => {
      const v = this.db.prepare("SELECT * FROM vouchers WHERE id=?").get(id);
      if (!v) throw new ServiceError("NOT_FOUND", 404);
      const c = coupons.find((c) => c.id === v.coupon_id);
      this.owned(s, c.placeId);
      if (v.status !== "held") throw new ServiceError("ALREADY_REDEEMED", 409);
      if (Date.now() > Date.parse(c.until + "T23:59:59+09:00"))
        throw new ServiceError("EXPIRED");
      if (
        this.db
          .prepare("SELECT value FROM config WHERE key=?")
          .get("paused:" + c.id)?.value === "true"
      )
        throw new ServiceError("COUPON_PAUSED");
      if (!Number.isFinite(total) || total < c.minimum)
        throw new ServiceError("MINIMUM_SPEND");
      this.db
        .prepare(
          "UPDATE vouchers SET status='used',redeemed=? WHERE id=? AND status='held'",
        )
        .run(new Date().toISOString(), id);
      this.audit(s.user_id, "coupon_redeem", { voucher: id, total });
      return { status: "used" };
    });
  }
  toggle(s, id, paused) {
    const c = coupons.find((c) => c.id === id);
    if (!c) throw new ServiceError("NOT_FOUND", 404);
    this.owned(s, c.placeId);
    this.db
      .prepare("INSERT OR REPLACE INTO config VALUES (?,?)")
      .run("paused:" + id, String(!!paused));
    this.audit(s.user_id, "coupon_pause", { coupon: id, paused: !!paused });
    return { paused: !!paused };
  }
  challenge(s, placeId, paymentId) {
    this.owned(s, placeId);
    if (!this.catalog().find((p) => p.id === placeId && p.stamp))
      throw new ServiceError("STAMP_DISABLED");
    const payment = paidReceipt(this, s, placeId, paymentId);
    this.db
      .prepare(
        "UPDATE challenges SET used=1 WHERE nonce IN (SELECT nonce FROM paid_challenges WHERE payment_id=?)",
      )
      .run(payment.id);
    const nonce = randomBytes(18).toString("hex"),
      expires = Date.now() + 120000;
    this.db
      .prepare("INSERT INTO challenges VALUES (?,?,?,0)")
      .run(nonce, placeId, expires);
    this.db
      .prepare("INSERT INTO paid_challenges VALUES (?,?)")
      .run(nonce, payment.id);
    const payload = Buffer.from(
      JSON.stringify({ nonce, placeId, expires }),
    ).toString("base64url");
    const sig = createHmac("sha256", this.secret)
      .update(payload)
      .digest("base64url");
    this.audit(s.user_id, "stamp_code_create", { placeId });
    return { token: payload + "." + sig, expires };
  }
  stamp(s, token) {
    this.traveler(s);
    if (typeof token !== "string" || token.length > 2000)
      throw new ServiceError("INVALID_QR");
    const [payload, sig, ...extra] = token.split("."),
      expected = createHmac("sha256", this.secret)
        .update(payload || "")
        .digest();
    let signature;
    try {
      signature = Buffer.from(sig || "", "base64url");
    } catch {
      throw new ServiceError("INVALID_QR");
    }
    if (
      extra.length ||
      signature.length !== expected.length ||
      !timingSafeEqual(signature, expected)
    )
      throw new ServiceError("INVALID_QR");
    let data;
    try {
      data = JSON.parse(Buffer.from(payload, "base64url").toString());
    } catch {
      throw new ServiceError("INVALID_QR");
    }
    return this.tx(() => {
      const row = this.db
        .prepare("SELECT * FROM challenges WHERE nonce=?")
        .get(data.nonce);
      if (!row || row.place_id !== data.placeId || row.expires !== data.expires)
        throw new ServiceError("INVALID_QR");
      if (row.expires < Date.now()) throw new ServiceError("EXPIRED_QR");
      if (row.used) throw new ServiceError("REPLAY_QR", 409);
      const payment = this.db
        .prepare(
          "SELECT p.id FROM paid_challenges pc JOIN payments p ON p.id=pc.payment_id WHERE pc.nonce=? AND p.status='paid' AND p.place_id=?",
        )
        .get(row.nonce, row.place_id);
      if (!payment) throw new ServiceError("PAYMENT_REQUIRED", 409);
      if (
        this.db
          .prepare(
            "SELECT payment_id FROM consumed_payments WHERE payment_id=?",
          )
          .get(payment.id)
      )
        throw new ServiceError("PAYMENT_ALREADY_STAMPED", 409);
      if (
        this.db
          .prepare(
            "SELECT st.id FROM stamps st JOIN stamp_payments sp ON sp.stamp_id=st.id WHERE st.user_id=? AND st.place_id=?",
          )
          .get(s.user_id, row.place_id)
      )
        throw new ServiceError("ALREADY_STAMPED", 409);
      const id =
        this.db
          .prepare("SELECT id FROM stamps WHERE user_id=? AND place_id=?")
          .get(s.user_id, row.place_id)?.id || randomUUID();
      this.db
        .prepare(
          "INSERT INTO stamps VALUES (?,?,?,?) ON CONFLICT(user_id,place_id) DO UPDATE SET created=excluded.created",
        )
        .run(id, s.user_id, row.place_id, new Date().toISOString());
      this.db
        .prepare("INSERT INTO stamp_payments VALUES (?,?)")
        .run(id, payment.id);
      this.db
        .prepare("INSERT INTO consumed_payments VALUES (?)")
        .run(payment.id);
      this.db
        .prepare("UPDATE challenges SET used=1 WHERE nonce=?")
        .run(row.nonce);
      this.audit(s.user_id, "stamp_claim", { placeId: row.place_id });
      return { id, placeId: row.place_id };
    });
  }
  proposal(s, placeId, patch) {
    this.owned(s, placeId);
    if (
      !patch ||
      !Number.isFinite(patch.costMax) ||
      patch.costMax < 0 ||
      patch.costMax > 10000000 ||
      !Number.isFinite(patch.stay) ||
      patch.stay < 10 ||
      patch.stay > 240
    )
      throw new ServiceError("INVALID_PLACE");
    const id = randomUUID();
    this.db
      .prepare("INSERT INTO proposals VALUES (?,?,?,?,?,?)")
      .run(
        id,
        placeId,
        s.user_id,
        JSON.stringify({ costMax: patch.costMax, stay: patch.stay }),
        "pending",
        new Date().toISOString(),
      );
    this.audit(s.user_id, "place_proposal", { id, placeId });
    return { id };
  }
  approve(s, id, approved) {
    if (s.role !== "admin") throw new ServiceError("FORBIDDEN", 403);
    return this.tx(() => {
      const p = this.db
        .prepare("SELECT * FROM proposals WHERE id=? AND status='pending'")
        .get(id);
      if (!p) throw new ServiceError("NOT_FOUND", 404);
      if (approved) {
        const place = this.catalog().find((x) => x.id === p.place_id);
        const patch = JSON.parse(p.data);
        Object.assign(place, patch);
        place.costMin = Math.min(place.costMin, place.costMax);
        this.db
          .prepare("UPDATE places SET data=? WHERE id=?")
          .run(JSON.stringify(place), place.id);
      }
      this.db
        .prepare("UPDATE proposals SET status=? WHERE id=?")
        .run(approved ? "approved" : "rejected", id);
      this.audit(s.user_id, "place_review", { id, approved });
      return { approved };
    });
  }
  operator(s) {
    if (!["partner", "admin"].includes(s.role))
      throw new ServiceError("FORBIDDEN", 403);
    const ids =
      s.role === "admin" ? this.catalog().map((p) => p.id) : [s.place_id];
    return {
      business: (() => {
        const row = this.db
          .prepare(
            "SELECT data FROM business_applications WHERE owner_id=? AND status='approved'",
          )
          .get(s.user_id);
        return row ? JSON.parse(row.data) : null;
      })(),
      places: this.catalog().filter((p) => ids.includes(p.id)),
      proposals: this.db
        .prepare("SELECT * FROM proposals ORDER BY created DESC")
        .all()
        .filter((p) => ids.includes(p.place_id))
        .map((p) => ({ ...p, data: JSON.parse(p.data) })),
      coupons: coupons
        .filter((c) => ids.includes(c.placeId))
        .map((c) => ({
          ...c,
          paused:
            this.db
              .prepare("SELECT value FROM config WHERE key=?")
              .get("paused:" + c.id)?.value === "true",
          issued: this.db
            .prepare("SELECT count(*) AS n FROM vouchers WHERE coupon_id=?")
            .get(c.id).n,
          used: this.db
            .prepare(
              "SELECT count(*) AS n FROM vouchers WHERE coupon_id=? AND status='used'",
            )
            .get(c.id).n,
        })),
      audit:
        s.role === "admin"
          ? this.db
              .prepare(
                "SELECT event,detail,created FROM audit ORDER BY created DESC LIMIT 50",
              )
              .all()
          : [],
    };
  }
  setConsent(s, b) {
    this.db
      .prepare("INSERT OR REPLACE INTO consent VALUES (?,?,?,?,?)")
      .run(
        s.user_id,
        "draft-2026-10-05",
        Number(!!b.analytics),
        Number(!!b.location),
        new Date().toISOString(),
      );
    if (!b.analytics)
      this.db.prepare("DELETE FROM events WHERE user_id=?").run(s.user_id);
    return {
      version: "draft-2026-10-05",
      analytics: !!b.analytics,
      location: !!b.location,
    };
  }
  event(s, name) {
    if (!["recommend", "route_save", "place_view", "error"].includes(name))
      throw new ServiceError("INVALID_EVENT");
    if (
      this.db
        .prepare("SELECT analytics FROM consent WHERE user_id=?")
        .get(s.user_id)?.analytics
    )
      this.db
        .prepare("INSERT INTO events VALUES (?,?,?,?)")
        .run(randomUUID(), s.user_id, name, new Date().toISOString());
    return { ok: true };
  }
  report(s, placeId, reason) {
    if (
      !this.catalog().some((p) => p.id === placeId) ||
      typeof reason !== "string" ||
      reason.length < 3 ||
      reason.length > 500
    )
      throw new ServiceError("INVALID_REPORT");
    this.audit(s.user_id, "place_report", { placeId, reason });
    return { ok: true };
  }
  purge() {
    const expired = this.db
      .prepare("SELECT DISTINCT guest_id FROM sessions WHERE expires<?")
      .all(Date.now())
      .map((r) => r.guest_id);
    this.db.prepare("DELETE FROM sessions WHERE expires<?").run(Date.now());
    for (const id of expired) {
      if (this.db.prepare("SELECT id FROM sessions WHERE guest_id=?").get(id))
        continue;
      if (
        this.db
          .prepare("SELECT auth_id FROM auth_accounts WHERE user_id=?")
          .get(id)
      )
        continue;
      for (const t of [
        "reward_orders",
        "trips",
        "vouchers",
        "stamps",
        "consent",
        "events",
      ])
        this.db.prepare(`DELETE FROM ${t} WHERE user_id=?`).run(id);
      this.db.prepare("DELETE FROM users WHERE id=?").run(id);
    }
    this.db
      .prepare("DELETE FROM challenges WHERE expires<?")
      .run(Date.now() - 86400000);
    this.db
      .prepare("DELETE FROM events WHERE created<?")
      .run(new Date(Date.now() - 30 * 86400000).toISOString());
  }
}
export { coupons, areas, cities };

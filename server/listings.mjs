import { randomUUID } from "node:crypto";
import { areas } from "../shared/catalog.ts";

export function initializeListings(db) {
  db.exec(
    `CREATE TABLE IF NOT EXISTS listings(id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id), data TEXT NOT NULL, status TEXT NOT NULL, created TEXT NOT NULL, updated TEXT NOT NULL, review_note TEXT NOT NULL DEFAULT '');`,
  );
}
export class ListingError extends Error {
  constructor(code, status = 400) {
    super(code);
    this.status = status;
  }
}
function fail(code = "INVALID_LISTING", status = 400) {
  throw new ListingError(code, status);
}
function authorized(s) {
  if (!["partner", "admin"].includes(s.role)) fail("FORBIDDEN", 403);
}
function validate(input, submit) {
  if (!input || typeof input !== "object" || Array.isArray(input)) fail();
  const d = {};
  for (const key of [
    "businessName",
    "titleKo",
    "titleEn",
    "summaryKo",
    "summaryEn",
    "descriptionKo",
    "descriptionEn",
    "address",
    "contact",
    "bookingUrl",
    "hours",
    "inclusions",
    "exclusions",
    "cancellation",
    "promotion",
  ]) {
    if (
      typeof input[key] !== "string" ||
      input[key].length > (key.startsWith("description") ? 6000 : 1000)
    )
      fail();
    d[key] = input[key].trim();
  }
  if (
    !["shop", "service", "experience", "attraction", "content"].includes(
      input.kind,
    ) ||
    ![
      "sea",
      "cafe",
      "food",
      "culture",
      "shopping",
      "experience",
      "wellness",
    ].includes(input.category) ||
    !areas.some((a) => a.id === input.areaId)
  )
    fail();
  Object.assign(d, {
    kind: input.kind,
    category: input.category,
    areaId: input.areaId,
  });
  for (const key of ["priceMin", "priceMax", "duration"]) {
    if (
      !Number.isFinite(input[key]) ||
      input[key] < 0 ||
      input[key] > (key === "duration" ? 1440 : 10000000)
    )
      fail();
    d[key] = input[key];
  }
  if (d.priceMin > d.priceMax) fail("INVALID_PRICE_RANGE");
  if (d.bookingUrl) {
    let u;
    try {
      u = new URL(d.bookingUrl);
    } catch {
      fail("INVALID_BOOKING_URL");
    }
    if (u.protocol !== "https:" || u.username || u.password)
      fail("INVALID_BOOKING_URL");
  }
  if (!Array.isArray(input.images) || input.images.length > 3) fail();
  d.images = input.images.map((img) => {
    if (
      typeof img !== "string" ||
      !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(img)
    )
      fail("INVALID_IMAGE");
    const bytes = Buffer.from(img.split(",")[1], "base64");
    const valid = img.startsWith("data:image/png;")
      ? bytes
          .subarray(0, 8)
          .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      : img.startsWith("data:image/jpeg;")
        ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
        : bytes.toString("ascii", 0, 4) === "RIFF" &&
          bytes.toString("ascii", 8, 12) === "WEBP";
    if (!valid || bytes.length > 1048576) fail("INVALID_IMAGE");
    return img;
  });
  d.imageRights = input.imageRights === true;
  if (
    submit &&
    (!d.businessName ||
      !d.titleKo ||
      !d.titleEn ||
      !d.summaryKo ||
      !d.summaryEn ||
      !d.descriptionKo ||
      !d.descriptionEn ||
      !d.address ||
      !d.contact ||
      !d.hours ||
      !d.images.length ||
      !d.imageRights)
  )
    fail("REQUIRED_LISTING_FIELDS");
  return d;
}
function expose(row) {
  return {
    id: row.id,
    status: row.status,
    data: JSON.parse(row.data),
    created: row.created,
    updated: row.updated,
    reviewNote: row.review_note,
  };
}
export function operatorListings(db, s) {
  authorized(s);
  return db
    .prepare(
      s.role === "admin"
        ? "SELECT * FROM listings ORDER BY updated DESC"
        : "SELECT * FROM listings WHERE owner_id=? ORDER BY updated DESC",
    )
    .all(...(s.role === "admin" ? [] : [s.user_id]))
    .map(expose);
}
export function publicListings(db) {
  return db
    .prepare(
      "SELECT * FROM listings WHERE status='published' ORDER BY updated DESC",
    )
    .all()
    .map(expose);
}
export function saveListing(store, s, body) {
  authorized(s);
  const existing = body.id
    ? store.db.prepare("SELECT * FROM listings WHERE id=?").get(body.id)
    : null;
  if (
    body.id &&
    (!existing || (s.role !== "admin" && existing.owner_id !== s.user_id))
  )
    fail("NOT_FOUND", 404);
  const data = validate(body.data, body.submit === true),
    id = existing?.id ?? randomUUID(),
    now = new Date().toISOString(),
    status = body.submit === true ? "pending" : "draft";
  store.db
    .prepare(
      "INSERT INTO listings(id,owner_id,data,status,created,updated,review_note) VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,status=excluded.status,updated=excluded.updated,review_note=excluded.review_note",
    )
    .run(
      id,
      existing?.owner_id ?? s.user_id,
      JSON.stringify(data),
      status,
      existing?.created ?? now,
      now,
      "",
    );
  store.audit(s.user_id, "listing_saved", { id, status });
  return { id, status };
}
export function reviewListing(store, s, body) {
  if (s.role !== "admin") fail("FORBIDDEN", 403);
  if (
    typeof body.approved !== "boolean" ||
    typeof body.note !== "string" ||
    body.note.length > 1000
  )
    fail();
  const row = store.db
    .prepare("SELECT * FROM listings WHERE id=? AND status='pending'")
    .get(body.id);
  if (!row) fail("NOT_FOUND", 404);
  validate(JSON.parse(row.data), true);
  const status = body.approved ? "published" : "rejected";
  store.db
    .prepare("UPDATE listings SET status=?,updated=?,review_note=? WHERE id=?")
    .run(status, new Date().toISOString(), body.note.trim(), row.id);
  store.audit(s.user_id, "listing_reviewed", { id: row.id, status });
  return { id: row.id, status };
}
export function archiveListing(store, s, body) {
  authorized(s);
  const row = store.db
    .prepare("SELECT * FROM listings WHERE id=?")
    .get(body.id);
  if (!row || (s.role !== "admin" && row.owner_id !== s.user_id))
    fail("NOT_FOUND", 404);
  store.db
    .prepare("UPDATE listings SET status='archived',updated=? WHERE id=?")
    .run(new Date().toISOString(), row.id);
  store.audit(s.user_id, "listing_archived", { id: row.id });
  return { id: row.id, status: "archived" };
}

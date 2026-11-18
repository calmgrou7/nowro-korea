import { randomUUID } from "node:crypto";
import { areas } from "../shared/catalog.ts";
import { ListingError } from "./listings.mjs";
const fail = (code, status = 400) => {
  throw new ListingError(code, status);
};
export function initializeBusinesses(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS business_applications(
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL UNIQUE REFERENCES users(id),
    data TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('pending','approved','rejected','revoked')),
    revision INTEGER NOT NULL DEFAULT 1,
    review_note TEXT NOT NULL DEFAULT '',
    verification_method TEXT NOT NULL DEFAULT '',
    reviewed_by TEXT REFERENCES users(id),
    reviewed_at TEXT,
    created TEXT NOT NULL,
    updated TEXT NOT NULL
  );`);
}
function expose(row) {
  return row
    ? {
        id: row.id,
        data: JSON.parse(row.data),
        status: row.status,
        revision: row.revision,
        reviewNote: row.review_note,
        verificationMethod: row.verification_method,
        reviewedAt: row.reviewed_at,
        created: row.created,
        updated: row.updated,
      }
    : null;
}
function requireMember(store, s) {
  if (
    !store.db
      .prepare("SELECT auth_id FROM auth_accounts WHERE user_id=?")
      .get(s.user_id)
  )
    fail("SIGN_IN_REQUIRED", 401);
}
function admin(s) {
  if (s.role !== "admin") fail("FORBIDDEN", 403);
}
function validate(input) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    fail("INVALID_BUSINESS_APPLICATION");
  const data = {};
  for (const [key, min, max] of [
    ["businessName", 2, 120],
    ["address", 5, 300],
    ["contactName", 2, 80],
    ["contactEmail", 3, 254],
    ["contactPhone", 5, 50],
    ["website", 0, 500],
    ["description", 20, 2000],
  ]) {
    if (
      typeof input[key] !== "string" ||
      input[key].trim().length < min ||
      input[key].length > max
    )
      fail("INVALID_BUSINESS_APPLICATION");
    data[key] = input[key].trim();
  }
  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.contactEmail) ||
    !areas.some((a) => a.id === input.areaId)
  )
    fail("INVALID_BUSINESS_APPLICATION");
  if (data.website) {
    let url;
    try {
      url = new URL(data.website);
    } catch {
      fail("INVALID_BUSINESS_WEBSITE");
    }
    if (url.protocol !== "https:" || url.username || url.password)
      fail("INVALID_BUSINESS_WEBSITE");
  }
  if (input.consent !== true) fail("BUSINESS_CONSENT_REQUIRED");
  if (input.schemaVersion === 2) {
    for (const [key,min,max] of [['hours',2,1000],['menu',2,2000],['publicPhone',0,50],['blog',0,500]]) {
      if(typeof input[key]!=='string'||input[key].trim().length<min||input[key].length>max) fail('INVALID_BUSINESS_APPLICATION');
      data[key]=input[key].trim();
    }
    if(data.blog){let u;try{u=new URL(data.blog);}catch{fail('INVALID_BUSINESS_WEBSITE');}if(u.protocol!=='https:'||u.username||u.password)fail('INVALID_BUSINESS_WEBSITE');}
    if(!['food','cafe','shopping','experience','culture','wellness'].includes(input.category))fail('INVALID_BUSINESS_APPLICATION');
    const image=value=>{
      if(typeof value!=='string'||value.length>900000||!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/.test(value))fail('INVALID_BUSINESS_IMAGE');
      const b=Buffer.from(value.split(',')[1],'base64');
      const valid=value.startsWith('data:image/jpeg;')?b[0]===255&&b[1]===216&&b[2]===255:value.startsWith('data:image/png;')?b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):b.toString('ascii',0,4)==='RIFF'&&b.toString('ascii',8,12)==='WEBP';
      if(!valid)fail('INVALID_BUSINESS_IMAGE');return value;
    };
    if(!Array.isArray(input.shopImages)||input.shopImages.length<1||input.shopImages.length>3||input.imageRights!==true)fail('BUSINESS_IMAGES_REQUIRED');
    Object.assign(data,{schemaVersion:2,category:input.category,registrationImage:image(input.registrationImage),shopImages:input.shopImages.map(image),imageRights:true});
  }
  return {
    ...data,
    areaId: input.areaId,
    contactEmail: data.contactEmail.toLowerCase(),
    consent: true,
  };
}
export function ownBusiness(store, s) {
  requireMember(store, s);
  return expose(
    store.db
      .prepare("SELECT * FROM business_applications WHERE owner_id=?")
      .get(s.user_id),
  );
}
export function submitBusiness(store, s, body) {
  requireMember(store, s);
  if (s.role !== "traveler") fail("BUSINESS_ROLE_CONFLICT", 409);
  const data = validate(body?.data);
  return store.tx(() => {
    const old = store.db
      .prepare("SELECT * FROM business_applications WHERE owner_id=?")
      .get(s.user_id);
    if (old && ["pending", "approved"].includes(old.status))
      fail("BUSINESS_ALREADY_SUBMITTED", 409);
    const id = old?.id || randomUUID(),
      now = new Date().toISOString();
    store.db
      .prepare(
        `INSERT INTO business_applications(id,owner_id,data,status,created,updated)
      VALUES(?,?,?,'pending',?,?) ON CONFLICT(owner_id) DO UPDATE SET data=excluded.data,status='pending',
      revision=business_applications.revision+1,review_note='',verification_method='',reviewed_by=NULL,reviewed_at=NULL,updated=excluded.updated`,
      )
      .run(id, s.user_id, JSON.stringify(data), now, now);
    store.audit(s.user_id, "business_submitted", { id });
    return ownBusiness(store, s);
  });
}
export function listBusinesses(store, s) {
  admin(s);
  return store.db
    .prepare("SELECT * FROM business_applications ORDER BY updated DESC")
    .all()
    .map(expose);
}
export function reviewBusiness(store, s, body) {
  admin(s);
  if (
    !["approve", "reject", "revoke"].includes(body?.action) ||
    typeof body.id !== "string" ||
    body.id.length > 100 ||
    !Number.isInteger(body.revision) ||
    typeof body.note !== "string" ||
    body.note.trim().length < 10 ||
    body.note.length > 1000
  )
    fail("BUSINESS_REVIEW_REQUIRED");
  if (
    body.action === "approve" &&
    (body.ownershipVerified !== true ||
      !["business-contact", "onsite", "documents"].includes(
        body.verificationMethod,
      ))
  )
    fail("BUSINESS_VERIFICATION_REQUIRED");
  return store.tx(() => {
    const row = store.db
      .prepare("SELECT * FROM business_applications WHERE id=?")
      .get(body.id);
    if (!row) fail("NOT_FOUND", 404);
    if (
      row.revision !== body.revision ||
      row.status !== (body.action === "revoke" ? "approved" : "pending")
    )
      fail("BUSINESS_REVIEW_STALE", 409);
    if (row.owner_id === s.user_id) fail("FORBIDDEN", 403);
    const owner = store.db
      .prepare("SELECT role FROM users WHERE id=?")
      .get(row.owner_id);
    const expected = body.action === "revoke" ? "partner" : "traveler";
    if (owner?.role !== expected) fail("BUSINESS_ROLE_CONFLICT", 409);
    requireMember(store, { user_id: row.owner_id });
    const status = {
      approve: "approved",
      reject: "rejected",
      revoke: "revoked",
    }[body.action];
    const now = new Date().toISOString();
    store.db
      .prepare(
        `UPDATE business_applications SET status=?,revision=revision+1,review_note=?,verification_method=?,reviewed_by=?,reviewed_at=?,updated=? WHERE id=?`,
      )
      .run(
        status,
        body.note.trim(),
        body.action === "approve"
          ? body.verificationMethod
          : row.verification_method,
        s.user_id,
        now,
        now,
        row.id,
      );
    if (body.action !== "reject") {
      store.db
        .prepare("UPDATE users SET role=?,place_id=NULL WHERE id=?")
        .run(body.action === "approve" ? "partner" : "traveler", row.owner_id);
    }
    const approvedData=JSON.parse(row.data);
    if(body.action==='approve' && approvedData.schemaVersion===2){
      const d=approvedData;
      // Explicit public allowlist: never copy the certificate or review contacts.
      const publicData={kind:'shop',category:d.category,areaId:d.areaId,businessName:d.businessName,
        titleKo:d.businessName,titleEn:d.businessName,summaryKo:d.description.slice(0,180),summaryEn:d.description.slice(0,180),
        descriptionKo:d.description,descriptionEn:d.description,address:d.address,contact:d.publicPhone,
        bookingUrl:d.website,blog:d.blog,hours:d.hours,inclusions:d.menu,menu:d.menu,exclusions:'',cancellation:'',promotion:'',
        eventStart:'',eventEnd:'',images:d.shopImages,imageRights:true,priceMin:0,priceMax:0,priceUnknown:true,duration:0};
      store.db.prepare("INSERT INTO listings(id,owner_id,data,status,created,updated,review_note) VALUES(?,?,?,'published',?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,status='published',updated=excluded.updated,review_note=excluded.review_note")
        .run('business-'+row.id,row.owner_id,JSON.stringify(publicData),now,now,body.note.trim());
    }
    if (body.action === "revoke") {
      store.db
        .prepare(
          "UPDATE listings SET status='archived',updated=? WHERE owner_id=? AND status='published'",
        )
        .run(now, row.owner_id);
    }
    store.audit(s.user_id, "business_reviewed", {
      id: row.id,
      action: body.action,
      revision: row.revision,
    });
    return expose(
      store.db
        .prepare("SELECT * FROM business_applications WHERE id=?")
        .get(row.id),
    );
  });
}

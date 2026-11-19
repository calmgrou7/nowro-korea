import { ListingError } from './listings.mjs';

export function initializeListingRoutes(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS listing_routes(
      listing_id TEXT PRIMARY KEY REFERENCES listings(id) ON DELETE CASCADE,
      settings TEXT NOT NULL
    );
    CREATE TRIGGER IF NOT EXISTS reset_listing_route
    AFTER UPDATE OF data,status ON listings
    WHEN OLD.data <> NEW.data OR OLD.status <> NEW.status
    BEGIN DELETE FROM listing_routes WHERE listing_id=NEW.id; END;
  `);
}

function validDate(value) {
  const date = new Date(value + 'T00:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function updateListingRoute(store, session, body) {
  if (session.role !== 'admin') throw new ListingError('FORBIDDEN', 403);
  if (typeof body.id !== 'string') throw new ListingError('INVALID_LISTING');
  const db = store.db;
  const row = db.prepare("SELECT data,updated FROM listings WHERE id=? AND status='published'").get(body.id);
  if (!row) throw new ListingError('NOT_FOUND', 404);
  if (row.updated !== body.updated) throw new ListingError('LISTING_CHANGED', 409);
  const data = JSON.parse(row.data);
  let settings;
  if (body.mode === 'existing') {
    const target = store.baseCatalog().find(p => p.id === body.placeId && p.published && !p.sample);
    if (!target || target.areaId !== data.areaId || (data.eventStart || data.eventEnd || data.kind === 'event' || data.category === 'event'))
      throw new ListingError('INVALID_ROUTE_PLACE');
    settings = { mode: 'existing', placeId: target.id };
  } else if (body.mode === 'new') {
    const { lat, lng, days, open, close, stay, reservation } = body;
    if (![lat, lng].every(Number.isFinite) || lat < 34 || lat > 39 || lng < 124 || lng > 132 ||
        !Array.isArray(days) || !days.length || !days.every(day => Number.isInteger(day) && day >= 0 && day <= 6) ||
        ![open, close, stay].every(Number.isInteger) || open < 0 || close > 1440 || stay < 10 || stay > 240 ||
        open + stay > close || typeof reservation !== 'boolean' || !data.address ||
        ((data.kind === 'event' || data.category === 'event' || data.eventStart || data.eventEnd) &&
          (!validDate(data.eventStart) || !validDate(data.eventEnd) || data.eventStart > data.eventEnd)))
      throw new ListingError('INVALID_ROUTE_PLACE');
    settings = { mode: 'new', lat, lng, days: [...new Set(days)], open, close, stay, reservation };
  } else if (body.mode !== 'off') throw new ListingError('INVALID_ROUTE_PLACE');

  store.tx(() => {
    if (settings) db.prepare('INSERT OR REPLACE INTO listing_routes(listing_id,settings) VALUES(?,?)').run(body.id, JSON.stringify(settings));
    else db.prepare('DELETE FROM listing_routes WHERE listing_id=?').run(body.id);
    store.audit(session.user_id, 'listing_route_updated', { id: body.id, mode: body.mode });
  });
  return { settings: settings ?? null };
}

export function listingRouteCatalog(db, base, today = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10)) {
  const rows = db.prepare(`
    SELECT l.id,l.data,l.updated,r.settings FROM listing_routes r
    JOIN listings l ON l.id=r.listing_id
    JOIN users u ON u.id=l.owner_id
    LEFT JOIN business_applications b ON b.owner_id=l.owner_id
    WHERE l.status='published' AND u.role IN ('admin','partner')
      AND (b.owner_id IS NULL OR b.status='approved')
    ORDER BY l.id
  `).all();
  const catalog = new Map(base.map(p => [p.id, p]));
  for (const row of rows) {
    const data = JSON.parse(row.data);
    const settings = JSON.parse(row.settings);
    if (data.eventEnd && data.eventEnd < today) continue;
    if (settings.mode === 'existing') {
      const place = catalog.get(settings.placeId);
      if (place?.published && !place.sample)
        catalog.set(place.id, { ...place, partnerListingIds: [...(place.partnerListingIds || []), row.id] });
      continue;
    }
    const { lat, lng, days, open, close, stay, reservation } = settings;
    const localized = (ko, en) => ({ ko, en, ja: en, 'zh-CN': en, 'zh-TW': en });
    const id = 'partner-listing-' + row.id;
    catalog.set(id, {
      id, areaId: data.areaId, address: data.address, point: { lat, lng }, partnerListingIds: [row.id],
      name: localized(data.titleKo, data.titleEn), description: localized(data.descriptionKo, data.descriptionEn),
      category: data.kind === 'event' ? 'event' : data.category, tags: [], published: true, sample: false,
      availableFrom: data.eventStart || undefined, availableUntil: data.eventEnd || undefined,
      priceStatus: data.priceUnknown ? 'unknown' : data.priceMax === 0 ? 'free' : 'published',
      costMin: data.priceUnknown ? 0 : data.priceMin, costMax: data.priceUnknown ? 0 : data.priceMax,
      hours: days.map(day => ({ day, open, close, lastEntry: close - stay })),
      stay, wait: 0, reservation, source: 'NOWRO partner', checkedAt: row.updated,
      children: null, accessible: null, diet: [], stamp: false, art: 'culture',
    });
  }
  return [...catalog.values()];
}

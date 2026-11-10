import { fetchOpenApi } from "./busan-openapi.mjs";
import { eventEndDate } from "../shared/event-dates.ts";
import { locationNeedsReview } from "../shared/location-quality.ts";
export async function syncTourismCatalog(store, areas, load=fetchOpenApi) {
  await Promise.any([
    load('kor').then(feed=>{if(feed.status!=='ok'||!ingestTourismPlaces(store,areas,feed.items||[]).length)throw Error('NO_READY_PLACES');}),
    load('ocean').then(feed=>{if(feed.status!=='ok'||!ingestPublicContent(store,areas,'ocean',feed.items||[]).some(p=>p.routePlaceId))throw Error('NO_READY_PLACES');})
  ]).catch(()=>{});
}
export function ingestTourismPlaces(store, areas, items) {
  const places = items.flatMap((item) => {
    const lat = Number(item.mapy),
      lng = Number(item.mapx);
    const area = areas.find((a) =>
      String(item.addr1 || "").includes(a.name.ko),
    );
    if (
      !area ||
      !item.contentid ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      lat < 34 ||
      lat > 36 ||
      lng < 128 ||
      lng > 130
    )
      return [];
    const category =
      item.cat3 === "A05020900"
        ? "cafe"
        : {
            12: "culture",
            14: "culture",
            15: "event",
            28: "experience",
            38: "shopping",
            39: "food",
          }[item.contenttypeid];
    if (!category) return [];
    const localized = Object.fromEntries(
      ["ko", "en", "ja", "zh-CN", "zh-TW"].map((lang) => [lang, item.title]),
    );
    return [
      {
        id: "kto-" + item.contentid,
        areaId: area.id,
        name: localized,
        description: Object.fromEntries(
          Object.keys(localized).map((lang) => [
            lang,
            "한국관광공사 제공 · 운영시간·요금·체류시간은 방문 전 확인이 필요한 계획용 예상 정보입니다.",
          ]),
        ),
        address: item.addr1,
        point: { lat, lng },
        category,
        tags: [category],
        costMin: 0,
        costMax: category === "food" ? 30000 : 20000,
        stay: 40,
        wait: 10,
        hours: Array.from({ length: 7 }, (_, day) => ({
          day,
          open: 0,
          close: 1440,
          lastEntry: 1380,
        })),
        reservation: false,
        sample: false,
        source: "https://www.visitkorea.or.kr/",
        checkedAt: new Date().toISOString(),
        children: null,
        accessible: null,
        diet: [],
        stamp: false,
        art: category,
        published: true,
        planningEstimate: true,
        image: String(item.firstimage || "").replace(/^http:/, "https:"),
      },
    ];
  });
  if (places.length) {
    const previous = JSON.parse(
      store.db
        .prepare("SELECT value FROM config WHERE key='tourism_catalog'")
        .get()?.value || "[]",
    );
    const merged = [
      ...places,
      ...previous.filter((p) => !places.some((next) => next.id === p.id)),
    ].slice(0, 500);
    store.db
      .prepare("INSERT OR REPLACE INTO config(key,value) VALUES(?,?)")
      .run("tourism_catalog", JSON.stringify(merged));
  }
  return places;
}

// Only server-fetched, known public providers may enter the route catalog.
export function ingestPublicContent(store, areas, type, items) {
  if (!["festivals", "ocean", "exhibitions", "kopis"].includes(type))
    return items;
  return items.map((item) => {
    if (locationNeedsReview(item)) {
      const sourceId = type === 'kopis' ? item.kopisId : item.UC_SEQ;
      const id = type === 'kopis' ? 'kopis-' + sourceId : 'busan-' + type + '-' + sourceId;
      const previous = JSON.parse(store.db.prepare("SELECT value FROM config WHERE key='tourism_catalog'").get()?.value || '[]');
      store.db.prepare('INSERT OR REPLACE INTO config(key,value) VALUES(?,?)').run('tourism_catalog', JSON.stringify(previous.filter(p => p.id !== id)));
      return {...item, routePlaceId: null, locationNeedsReview: true};
    }
    const lat = Number(item.LAT),
      lng = Number(item.LNG);
    const address = String(item.ADDR1 || item.PLACE || "");
    const district = String(item.GUGUN_NM || "");
    const area = areas.find(
      (a) => district === a.name.ko || address.includes(a.name.ko),
    );
    const sourceId = type === "kopis" ? item.kopisId : item.UC_SEQ;
    if (
      !sourceId ||
      !item.MAIN_TITLE ||
      !area ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      lat < 34 ||
      lat > 36 ||
      lng < 128 ||
      lng > 130
    )
      return item;
    const id =
      type === "kopis" ? "kopis-" + sourceId : "busan-" + type + "-" + sourceId;
    const category =
      type === "ocean"
        ? "experience"
        : type === "exhibitions"
          ? "culture"
          : "event";
    const end = eventEndDate(item);
    const start = String(item.USAGE_DAY_WEEK_AND_TIME || "").match(
      /(20\d{2})[.\-/년]\s*(\d{1,2})[.\-/월]\s*(\d{1,2})/,
    );
    const localized = (value) =>
      Object.fromEntries(
        ["ko", "en", "ja", "zh-CN", "zh-TW"].map((lang) => [lang, value]),
      );
    const place = {
      id,
      areaId: area.id,
      name: localized(item.MAIN_TITLE),
      description: localized(
        "Public tourism information. Hours, admission and travel times require confirmation before visiting.",
      ),
      address: address || district,
      point: { lat, lng },
      category,
      tags: [category],
      costMin: 0,
      costMax: 20000,
      stay: 40,
      wait: 10,
      hours: Array.from({ length: 7 }, (_, day) => ({
        day,
        open: 0,
        close: 1440,
        lastEntry: 1380,
      })),
      reservation: false,
      sample: false,
      source: item.sourceUrl || "https://www.visitbusan.net/",
      checkedAt: new Date().toISOString(),
      children: null,
      accessible: null,
      diet: [],
      stamp: false,
      art: category,
      published: true,
      planningEstimate: true,
      image: item.MAIN_IMG_NORMAL || "",
      availableFrom: item.eventStart || (start
        ? `${start[1]}-${start[2].padStart(2, "0")}-${start[3].padStart(2, "0")}`
        : undefined),
      availableUntil: end || undefined,
    };
    const previous = JSON.parse(
      store.db
        .prepare("SELECT value FROM config WHERE key='tourism_catalog'")
        .get()?.value || "[]",
    );
    store.db
      .prepare("INSERT OR REPLACE INTO config(key,value) VALUES(?,?)")
      .run(
        "tourism_catalog",
        JSON.stringify(
          [place, ...previous.filter((p) => p.id !== id)].slice(0, 500),
        ),
      );
    return { ...item, routePlaceId: id };
  });
}

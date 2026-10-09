import type { Conditions, Place, Point, Route, Stop } from "./types.ts";
export function distance(a: Point, b: Point) {
  const r = Math.PI / 180;
  const dlat = (b.lat - a.lat) * r,
    dlng = (b.lng - a.lng) * r;
  return (
    6371 *
    2 *
    Math.asin(
      Math.min(
        1,
        Math.sqrt(
          Math.sin(dlat / 2) ** 2 +
            Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dlng / 2) ** 2,
        ),
      ),
    )
  );
}
export function estimate(a: Point, b: Point, mode: Conditions["transport"]) {
  const km = distance(a, b);
  if (km < 0.03) return 0;
  return (
    Math.ceil(
      ((km * 1.8) / (mode === "walk" ? 3.5 : mode === "transit" ? 12 : 18)) *
        60,
    ) + (mode === "walk" ? 3 : mode === "transit" ? 12 : 10)
  );
}
const pointOK = (p: unknown): p is Point =>
  !!p &&
  typeof p === "object" &&
  Number.isFinite((p as Point).lat) &&
  Number.isFinite((p as Point).lng) &&
  Math.abs((p as Point).lat) <= 90 &&
  Math.abs((p as Point).lng) <= 180;
export function validateConditions(c: Conditions) {
  if (
    !c ||
    typeof c.areaId !== "string" ||
    typeof c.diet !== "string" ||
    typeof c.children !== "boolean" ||
    typeof c.accessible !== "boolean" ||
    !["solo", "couple", "friends", "family"].includes(c.companion) ||
    !pointOK(c.origin) ||
    (c.returnPoint !== null && !pointOK(c.returnPoint)) ||
    !Number.isFinite(c.minutes) ||
    c.minutes < 30 ||
    c.minutes > 720 ||
    !Number.isFinite(c.budget) ||
    c.budget < 0 ||
    c.budget > 10000000 ||
    !["walk", "transit", "car"].includes(c.transport) ||
    !Array.isArray(c.interests) ||
    c.interests.length > 7 ||
    c.interests.some(
      (x) =>
        ![
          "sea",
          "food",
          "cafe",
          "culture",
          "experience",
          "shopping",
          "wellness",
        ].includes(x),
    ) ||
    typeof c.startAt !== "string" ||
    !Number.isFinite(Date.parse(c.startAt)) ||
    (c.deadline && !Number.isFinite(Date.parse(c.deadline))) ||
    (c.tripStart && c.tripEnd && c.tripStart > c.tripEnd)
  )
    throw new Error("INVALID_CONDITIONS");
}
export function localTime(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const v = (t: string) => parts.find((p) => p.type === t)!.value;
  return {
    day: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(
      v("weekday"),
    ),
    minute: Number(v("hour")) * 60 + Number(v("minute")),
  };
}
export function calculate(
  ids: string[],
  c: Conditions,
  catalog: Place[],
): Route | null {
  validateConditions(c);
  if (
    !Array.isArray(ids) ||
    !ids.length ||
    ids.some((id) => typeof id !== "string") ||
    new Set(ids).size !== ids.length ||
    ids.length > 8
  )
    return null;
  const start = new Date(c.startAt),
    limit = Math.min(
      c.minutes,
      c.deadline
        ? (Date.parse(c.deadline) - start.getTime()) / 60000
        : Infinity,
    );
  let now = new Date(start),
    from = c.origin;
  let costMin = 0,
    costMax = 0,
    transportCost = 0;
  const stops: Stop[] = [];
  for (const id of ids) {
    const p = catalog.find((p) => p.id === id && p.published);
    if (
      !p ||
      p.areaId !== c.areaId ||
      p.reservation ||
      (c.children && p.children !== true) ||
      (c.accessible && p.accessible !== true) ||
      (c.diet && !p.diet.includes(c.diet))
    )
      return null;
    const travel = estimate(from, p.point, c.transport);
    if (c.transport !== "walk" && travel > 0)
      transportCost += c.transport === "transit" ? 3000 : 6000;
    now = new Date(now.getTime() + travel * 60000);
    const arrival = now.toISOString();
    const lt = localTime(now),
      h = p.hours.find((h) => h.day === lt.day);
    if (
      !h ||
      lt.minute < h.open ||
      lt.minute > h.lastEntry ||
      lt.minute + p.stay + p.wait > h.close
    )
      return null;
    now = new Date(now.getTime() + (p.stay + p.wait) * 60000);
    stops.push({
      placeId: id,
      travel,
      arrival,
      departure: now.toISOString(),
      stay: p.stay,
      wait: p.wait,
      costMin: p.costMin,
      costMax: p.costMax,
    });
    costMin += p.costMin;
    costMax += p.costMax;
    from = p.point;
  }
  const returnMinutes = c.returnPoint
    ? estimate(from, c.returnPoint, c.transport)
    : 0;
  if (returnMinutes && c.transport !== "walk")
    transportCost += c.transport === "transit" ? 3000 : 6000;
  const buffer = Math.max(
    15,
    Math.ceil(
      ((now.getTime() - start.getTime()) / 60000 + returnMinutes) * 0.15,
    ),
  );
  const minutes =
    (now.getTime() - start.getTime()) / 60000 + returnMinutes + buffer;
  costMin += transportCost;
  costMax += transportCost;
  if (minutes > limit || costMax > c.budget) return null;
  return {
    id: ids.join("~"),
    stops,
    minutes,
    costMin,
    costMax,
    transportCost,
    returnMinutes,
    buffer,
    startAt: c.startAt,
    endAt: new Date(start.getTime() + minutes * 60000).toISOString(),
    estimated: true,
    sample: ids.some((id) => catalog.find((p) => p.id === id)!.sample),
    conditions: c,
  };
}
export function recommend(c: Conditions, catalog: Place[]): Route[] {
  validateConditions(c);
  const candidates = catalog
    .filter(
      (p) =>
        p.published &&
        p.areaId === c.areaId &&
        !p.reservation &&
        distance(c.origin, p.point) < (c.transport === "walk" ? 3 : 8),
    )
    .sort(
      (a, b) =>
        Number(c.interests.includes(b.category)) -
          Number(c.interests.includes(a.category)) ||
        distance(c.origin, a.point) - distance(c.origin, b.point),
    )
    .slice(0, 8);
  const result: Route[] = [];
  function walk(ids: string[]) {
    const route = calculate(ids, c, catalog);
    if (ids.length && !route) return;
    if (route) result.push(route);
    if (ids.length >= 4) return;
    for (const p of candidates) if (!ids.includes(p.id)) walk([...ids, p.id]);
  }
  walk([]);
  return result
    .sort((a, b) => score(b) - score(a))
    .filter(
      (r, i, all) =>
        all.findIndex(
          (x) =>
            [...x.stops.map((s) => s.placeId)].sort().join() ===
            [...r.stops.map((s) => s.placeId)].sort().join(),
        ) === i,
    )
    .slice(0, 3);
  function score(r: Route) {
    return (
      r.stops.reduce(
        (sum, s) =>
          sum +
          (c.interests.includes(
            catalog.find((p) => p.id === s.placeId)!.category,
          )
            ? 60
            : 0) +
          10,
        0,
      ) -
      r.stops.reduce((sum, s) => sum + s.travel, 0) * 0.7
    );
  }
}

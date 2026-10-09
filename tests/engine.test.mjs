import test from "node:test";
import assert from "node:assert/strict";
import { recommend, calculate, estimate, localTime } from "../shared/engine.ts";
import { places, areas } from "../shared/catalog.ts";
const base = {
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
test("all four time modes satisfy time, return, buffer, budget and registered IDs", () => {
  for (const minutes of [120, 240, 360, 540]) {
    const c = { ...base, minutes, returnPoint: base.origin };
    const routes = recommend(c, places);
    assert.ok(routes.length > 0 && routes.length <= 3);
    for (const r of routes) {
      assert.ok(r.minutes <= minutes);
      assert.ok(r.costMax <= c.budget);
      assert.ok(r.buffer >= 15);
      assert.ok(r.returnMinutes >= 0);
      assert.ok(r.estimated);
      for (const stop of r.stops)
        assert.ok(places.some((p) => p.id === stop.placeId));
      assert.equal(
        r.minutes,
        r.stops.reduce((n, s) => n + s.travel + s.stay + s.wait, 0) +
          r.returnMinutes +
          r.buffer,
      );
    }
  }
});
test("unknown or duplicate IDs are rejected", () => {
  assert.equal(calculate(["invented"], base, places), null);
  assert.equal(calculate(["g-beach", "g-beach"], base, places), null);
});
test("zero budget does not receive paid places", () => {
  const routes = recommend({ ...base, budget: 0 }, places);
  assert.ok(routes.length);
  assert.ok(routes.every((r) => r.costMax === 0));
});
test("arrival-time opening and last entry constraints", () => {
  const custom = structuredClone(places);
  const p = custom.find((p) => p.id === "g-beach");
  p.hours = p.hours.map((h) => ({
    ...h,
    open: 600,
    close: 630,
    lastEntry: 610,
  }));
  assert.equal(calculate(["g-beach"], base, custom), null);
  assert.deepEqual(
    recommend({ ...base, startAt: "2026-10-05T23:00:00+09:00" }, places),
    [],
  );
});
test("return deadline may invalidate otherwise feasible route", () => {
  const c = {
    ...base,
    minutes: 240,
    returnPoint: base.origin,
    deadline: "2026-10-05T10:40:00+09:00",
  };
  assert.deepEqual(recommend(c, places), []);
});
test("replacement recalculates full schedule and budget", () => {
  const a = calculate(["g-beach", "g-cafe"], base, places),
    b = calculate(["g-beach", "g-food"], base, places);
  assert.ok(a && b);
  assert.notEqual(a.costMax, b.costMax);
  assert.notEqual(a.endAt, b.endAt);
  assert.equal(
    calculate(["g-beach", "g-food"], { ...base, budget: 12000 }, places),
    null,
  );
});
test("unknown dietary/accessibility/child facts never satisfy verified filters", () => {
  for (const c of [{ children: true }, { accessible: true }, { diet: "halal" }])
    assert.deepEqual(recommend({ ...base, ...c }, places), []);
});
test("reservation-required places are excluded without inventory", () => {
  assert.equal(
    calculate(
      ["s-experience"],
      { ...base, areaId: "seomyeon", origin: areas[2].point, minutes: 540 },
      places,
    ),
    null,
  );
});
test("Seoul timezone and conservative travel work regardless of host timezone", () => {
  assert.deepEqual(localTime(new Date("2026-10-04T23:00:00Z")), {
    day: 1,
    minute: 480,
  });
  assert.ok(estimate(areas[0].point, areas[1].point, "walk") > 30);
});
test("invalid times, coordinates, dates and budgets rejected", () => {
  for (const patch of [
    { minutes: -1 },
    { budget: -10 },
    { origin: { lat: NaN, lng: 1 } },
    { origin: { lat: 35, lng: 181 } },
    { startAt: "garbage" },
    { deadline: "invalid" },
    { tripStart: "2026-10-06", tripEnd: "2026-10-05" },
  ])
    assert.throws(
      () => recommend({ ...base, ...patch }, places),
      /INVALID_CONDITIONS/,
    );
});

import test from "node:test";
import assert from "node:assert/strict";
import {
  enableAnalytics,
  disableAnalytics,
  analyticsPage,
  track,
} from "../src/analytics.ts";
test("analytics stays inactive until enabled, removes private parameters, deduplicates views and stops after withdrawal", () => {
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    location: globalThis.location,
  };
  const scripts = [];
  globalThis.window = {};
  globalThis.location = {
    href: "https://nowrokorea.com/?tab=ROUTES&utm_source=instagram&email=person@example.com&lat=35.1",
    hostname: "nowrokorea.com",
  };
  globalThis.document = {
    referrer: "https://social.example/private/profile?email=private",
    title: "NOWRO routes",
    getElementById: () => scripts[0],
    createElement: () => ({}),
    head: { appendChild: (s) => scripts.push(s) },
  };
  try {
    track("save_route");
    assert.equal(scripts.length, 0);
    enableAnalytics("not-an-id");
    assert.equal(scripts.length, 0);
    enableAnalytics("G-ABC1234567");
    analyticsPage();
    analyticsPage();
    track("generate_route");
    assert.equal(scripts.length, 1);
    assert.equal(
      window.dataLayer.filter((x) => x[0] === "event" && x[1] === "page_view")
        .length,
      1,
    );
    const config = window.dataLayer.find((x) => x[0] === "config")[2];
    assert.ok(
      !config.page_location.includes("email") &&
        !config.page_location.includes("lat="),
    );
    assert.equal(config.page_referrer, "https://social.example");
    assert.equal(config.send_page_view, false);
    const count = window.dataLayer.length;
    location.href = "https://nowrokorea.com/?code=secret";
    track("save_route");
    analyticsPage();
    assert.equal(window.dataLayer.length, count);
    disableAnalytics();
    assert.equal(window["ga-disable-G-ABC1234567"], true);
    track("save_place", "example");
    assert.equal(window.dataLayer.length, count);
  } finally {
    disableAnalytics();
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete globalThis[key];
      else globalThis[key] = value;
    }
  }
});

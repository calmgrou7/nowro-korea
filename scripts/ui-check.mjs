import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
mkdirSync("test-output", { recursive: true });
const browser = await chromium.launch({
  headless: true,
  channel: process.env.PLAYWRIGHT_CHANNEL || "chrome",
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 1050 },
  locale: "en-US",
  permissions: [],
});
const page = await context.newPage();
const failures = [];
page.on("pageerror", (e) => failures.push(e.message));
try {
  await page.goto("http://127.0.0.1:5173/");
  await page.getByRole("heading", { name: "Make this time yours" }).waitFor();
  await page.locator("#area").selectOption("gwangalli");
  await page.screenshot({ path: "test-output/desktop.png", fullPage: true });
  await page.locator("details.advanced summary").click();
  await page.getByLabel("Start time (Korea time)").fill("2026-10-05T10:00");
  await page
    .getByRole("button", { name: "Find my NOWRO", exact: true })
    .click();
  await page.locator(".route-card").first().waitFor();
  assert.ok((await page.locator(".route-card").count()) <= 3);
  await page
    .getByRole("button", { name: "See the route", exact: true })
    .first()
    .click();
  await page.getByRole("dialog").waitFor();
  const replaced = page.waitForResponse((r) =>
    r.url().endsWith("/api/recalculate"),
  );
  await page
    .getByLabel("Replace", { exact: true })
    .nth(1)
    .selectOption("g-culture");
  assert.equal((await replaced).status(), 200);
  await page
    .getByRole("button", { name: "Save this trip", exact: true })
    .click();
  await page.getByRole("status").waitFor();
  await page.keyboard.press("Escape");
  await page
    .locator(".desktop-nav")
    .getByRole("button", { name: "TRIP", exact: true })
    .click();
  await page.locator(".route-card").first().waitFor();
  await page
    .locator(".desktop-nav")
    .getByRole("button", { name: "PASS", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Add to my Pass", exact: true })
    .first()
    .click();
  await page.locator(".voucher-code code").waitFor();
  const voucher = await page.locator(".voucher-code code").innerText();
  // Local preview accounts remain explicitly confined to local development.
  await page
    .getByRole("button", { name: "Travel settings", exact: true })
    .click();
  await page.getByRole("button", { name: "Partner", exact: true }).click();
  await page
    .getByRole("heading", { name: "Coupon confirmation", exact: true })
    .waitFor();
  await page.getByLabel("Voucher code", { exact: true }).fill(voucher);
  await page
    .getByRole("button", { name: "Confirm redemption", exact: true })
    .click();
  await page.getByRole("status").waitFor();
  await page
    .getByRole("button", { name: "Generate signed QR", exact: true })
    .click();
  await page.locator(".qr-box textarea").waitFor();
  const token = await page.locator(".qr-box textarea").inputValue();
  await page.getByRole("button", { name: "Traveler", exact: true }).click();
  await page
    .locator(".desktop-nav")
    .getByRole("button", { name: "PASSPORT", exact: true })
    .click();
  await page.getByLabel("Paste the on-site code", { exact: true }).fill(token);
  await page
    .getByRole("button", { name: "Verify on-site code", exact: true })
    .click();
  await page.locator(".stamp.collected").waitFor();
  await page
    .locator(".desktop-nav")
    .getByRole("button", { name: "PASS", exact: true })
    .click();
  await page.getByText("Used", { exact: true }).waitFor();
  for (const lang of ["en", "ko", "ja", "zh-CN", "zh-TW"]) {
    await page.locator(".language-select select").selectOption(lang);
    await page.waitForTimeout(50);
    assert.equal(await page.locator("html").getAttribute("lang"), lang);
    assert.ok((await page.locator("h1").innerText()).length > 3);
  }
  await page.locator(".language-select select").selectOption("en");
  await page
    .locator(".desktop-nav")
    .getByRole("button", { name: "NOW", exact: true })
    .click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "test-output/mobile.png", fullPage: true });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  // Geolocation permission denied must leave manual selection and input intact.
  await page
    .getByRole("button", { name: "Travel settings", exact: true })
    .click();
  await page
    .getByLabel("Allow location for route planning", { exact: true })
    .check();
  await page.waitForTimeout(250);
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "Use my location", exact: true })
    .click();
  await page
    .getByRole("status")
    .filter({ hasText: "Location unavailable" })
    .waitFor();
  assert.equal(await page.locator("#budget").inputValue(), "60000");
  for (const lang of ["en", "ko", "ja", "zh-CN", "zh-TW"]) {
    await page.locator(".language-select select").selectOption(lang);
    await page
      .locator(".bottom-nav")
      .getByRole("button", { name: "NOW", exact: true })
      .click();
    const generated = page.waitForResponse((r) =>
      r.url().endsWith("/api/recommend"),
    );
    await page.locator(".main-cta").click();
    assert.equal((await generated).status(), 200);
    await page.locator(".route-card").first().waitFor();
    await page
      .locator(".bottom-nav")
      .getByRole("button", { name: "MAP", exact: true })
      .click();
    assert.ok((await page.locator(".place-card").count()) > 0);
    await page
      .locator(".bottom-nav")
      .getByRole("button", { name: "TRIP", exact: true })
      .click();
    assert.ok((await page.locator(".route-card").count()) > 0);
    await page
      .locator(".bottom-nav")
      .getByRole("button", { name: "PASS", exact: true })
      .click();
    assert.equal(await page.locator(".coupon").count(), 2);
    await page
      .locator(".bottom-nav")
      .getByRole("button", { name: "PASSPORT", exact: true })
      .click();
    assert.equal(await page.locator(".stamp.collected").count(), 1);
  }
  await page.locator(".language-select select").selectOption("en");
  await page
    .locator(".bottom-nav")
    .getByRole("button", { name: "MAP", exact: true })
    .click();
  await page.route("**/tile.openstreetmap.org/**", (r) => r.abort());
  await page.getByRole("button", { name: "Map", exact: true }).click();
  await page.locator(".map-panel .notice").waitFor();
  assert.ok((await page.locator(".place-card").count()) > 0);
  await page
    .locator(".bottom-nav")
    .getByRole("button", { name: "NOW", exact: true })
    .click();
  await page.locator("details.natural summary").click();
  await page
    .getByRole("textbox", { name: "Tell us in your own words", exact: true })
    .fill("Gwangalli, 4 hours, coffee");
  await page.route("**/api/ai/extract", (r) =>
    r.fulfill({
      status: 503,
      contentType: "application/json",
      body: '{"error":"AI_UNAVAILABLE"}',
    }),
  );
  await page
    .getByRole("button", { name: "Read my request", exact: true })
    .click();
  await page
    .getByRole("status")
    .filter({ hasText: "Unable to complete" })
    .waitFor();
  assert.equal(await page.locator("#budget").inputValue(), "60000");
  assert.deepEqual(failures, []);
  writeFileSync(
    "test-output/ui-result.json",
    JSON.stringify(
      {
        ok: true,
        checks: [
          "guest route",
          "replacement recalculation",
          "route save",
          "coupon issue",
          "partner redeem",
          "signed QR",
          "passport",
          "five-language core flows",
          "mobile overflow",
          "denied GPS fallback",
          "map failure list fallback",
          "AI failure input retention",
        ],
        pageErrors: failures,
      },
      null,
      2,
    ),
  );
  console.log(
    "UI checks passed: route/replace/save/pass/partner/QR/stamp, five languages, mobile layout, GPS/map/AI failure.",
  );
} catch (error) {
  await page.screenshot({ path: "test-output/ui-failure.png", fullPage: true });
  console.error(
    "UI failure context:",
    await page.locator(".toast,.modal .detail-metrics").allTextContents(),
  );
  throw error;
} finally {
  await browser.close();
}

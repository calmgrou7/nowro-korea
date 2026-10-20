import test from "node:test";
import assert from "node:assert/strict";
import { androidAssociation, androidOrigin } from "../shared/android-app.mjs";
import { readAppTab, appTabUrl } from "../shared/app-navigation.ts";
import { Store } from "../server/store.mjs";
import { createApp } from "../server/index.mjs";

test("Play association validates certificates and cannot emit placeholder trust", () => {
  const fingerprint = Array(32).fill("AB").join(":");
  assert.deepEqual(
    androidAssociation(
      "com.nowro.korea",
      `${fingerprint},${fingerprint.toLowerCase()}`,
    )[0].target.sha256_cert_fingerprints,
    [fingerprint],
  );
  for (const value of ["", "YOUR_SHA256", "AB:CD", "G0:".repeat(32)])
    assert.throws(() => androidAssociation("com.nowro.korea", value));
  assert.throws(() => androidAssociation("com.nowro;bad", fingerprint));
  for (const origin of [
    "http://example.com",
    "https://a.trycloudflare.com",
    "https://example.com/?token=x",
    "https://example.com/path",
    "https://user:pass@example.com",
  ])
    assert.throws(() => androidOrigin(origin));
  assert.equal(
    androidOrigin("https://nowro.example/"),
    "https://nowro.example",
  );
});

test("Android app shortcuts restore valid tabs and retain deep-link parameters", () => {
  assert.equal(readAppTab("?tab=PASSPORT"), "PASSPORT");
  assert.equal(readAppTab("?tab=not-a-page"), "NOW");
  const changed = appTabUrl(
    "https://nowro.example/?listing=abc&tab=MAP",
    "TRIP",
  );
  assert.equal(changed.searchParams.get("listing"), "abc");
  assert.equal(readAppTab(changed.search), "TRIP");
  assert.equal(appTabUrl(changed.href, "NOW").searchParams.has("tab"), false);
});

test("Unconfigured Android association returns JSON 404 instead of SPA HTML", async () => {
  const oldId = process.env.ANDROID_APP_ID,
    oldCert = process.env.ANDROID_SHA256_FINGERPRINTS;
  delete process.env.ANDROID_APP_ID;
  delete process.env.ANDROID_SHA256_FINGERPRINTS;
  const store = new Store();
  const server = createApp(store);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const url = `http://127.0.0.1:${server.address().port}/.well-known/assetlinks.json`;
    const missing = await fetch(url);
    assert.equal(missing.status, 404);
    assert.match(missing.headers.get("content-type"), /application\/json/);
    process.env.ANDROID_APP_ID = "com.nowro.korea";
    process.env.ANDROID_SHA256_FINGERPRINTS = Array(32).fill("12").join(":");
    const configured = await fetch(url);
    assert.equal(configured.status, 200);
    assert.equal(
      (await configured.json())[0].target.package_name,
      "com.nowro.korea",
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
    store.close();
    if (oldId === undefined) delete process.env.ANDROID_APP_ID;
    else process.env.ANDROID_APP_ID = oldId;
    if (oldCert === undefined) delete process.env.ANDROID_SHA256_FINGERPRINTS;
    else process.env.ANDROID_SHA256_FINGERPRINTS = oldCert;
  }
});

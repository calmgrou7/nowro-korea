import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { Store } from "../server/store.mjs";
import { createApp } from "../server/index.mjs";
import {
  campaignUrl,
  safePageUrl,
  privatePage,
} from "../shared/attribution.ts";
import {
  publicSearchContent,
  searchSitemap,
  searchRss,
} from "../shared/search-content.ts";
import { renderPageMetadata } from "../shared/page-metadata.ts";
test("campaign links distinguish channels and posts without accepting arbitrary URLs or emails", () => {
  const first = campaignUrl(
    "ROUTES",
    "instagram",
    "social",
    "winter-2026",
    "reel-1",
  );
  assert.notEqual(
    first,
    campaignUrl("ROUTES", "naver_blog", "referral", "winter-2026", "post-1"),
  );
  assert.equal(new URL(first).searchParams.get("tab"), "ROUTES");
  assert.throws(() =>
    campaignUrl("TRIP", "instagram", "social", "winter", "x"),
  );
  assert.throws(() =>
    campaignUrl("NOW", "person@example.com", "social", "winter", "x"),
  );
  const safe = safePageUrl(
    "https://nowrokorea.com/?tab=ROUTES&token=secret&email=private@example.com&utm_source=instagram&utm_content=reel-1#access_token=secret",
  );
  assert.ok(!safe.includes("secret") && !safe.includes("private"));
  assert.equal(privatePage("https://nowrokorea.com/?tab=TRIP"), true);
  assert.equal(privatePage("https://nowrokorea.com/?code=secret"), true);
});
test("public search content escapes published posts, excludes drafts and emits parseable structured data", () => {
  const posts = [
    {
      id: "public-1",
      board: "guide",
      title: "Guide </script><script>bad()</script>",
      body: "부산 여행 & Busan travel",
      published: true,
      updated: "2026-11-08T00:00:00.000Z",
    },
    {
      id: "draft-1",
      board: "guide",
      title: "Private draft",
      body: "Private body",
      published: false,
    },
  ];
  const url = new URL(
    "https://nowrokorea.com/?tab=ABOUT&board=guide&post=public-1",
  );
  const body = publicSearchContent(url, posts);
  assert.match(body, /&lt;script&gt;/);
  assert.ok(!body.includes("Private body"));
  const html = renderPageMetadata(
    fs.readFileSync(new URL("../index.html", import.meta.url), "utf8"),
    url,
    { posts },
  );
  const structured = JSON.parse(
    html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1],
  );
  assert.equal(
    structured.find((x) => x["@type"] === "Article").headline,
    posts[0].title,
  );
  assert.match(searchSitemap(posts), /post=public-1/);
  assert.ok(!searchSitemap(posts).includes("draft-1"));
  assert.match(searchRss(posts), /부산 여행 &amp; Busan travel/);
  assert.ok(!searchRss(posts).includes("Private"));
  assert.match(publicSearchContent(new URL('https://nowrokorea.com/?tab=ABOUT&board=guide&lang=en')),/Build and save a route/);
  assert.equal((searchRss().match(/<item>/g)||[]).length,3);
  assert.equal(
    publicSearchContent(new URL("https://nowrokorea.com/?tab=TRIP"), posts),
    "",
  );
});
test("growth settings require administrator and CSRF; only validated IDs and verification tokens are published", async () => {
  const store = new Store(),
    admin = store.setPreviewRole(store.session(), "admin");
  const server = createApp(store, {
    auth: { resolve: async (s) => s, account: () => null },
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const root = `http://127.0.0.1:${server.address().port}/api/`;
  const send = (body, cookie = true, csrf = true) =>
    fetch(root + "operator/growth", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(cookie ? { Cookie: "nowro=" + admin.id } : {}),
        ...(csrf ? { "X-NOWRO-Request": "1" } : {}),
      },
      body: JSON.stringify(body),
    });
  try {
    assert.equal((await fetch(root + "operator/growth")).status, 403);
    assert.equal((await send({ enabled: false }, false)).status, 403);
    assert.equal((await send({ enabled: false }, true, false)).status, 403);
    assert.equal(
      (await send({ gaId: "<script>bad</script>", enabled: true })).status,
      400,
    );
    assert.equal(
      (
        await send({
          gaId: "G-ABC1234567",
          enabled: true,
          naverVerification: "<meta>",
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await send({
          gaId: "G-ABC1234567",
          enabled: true,
          naverVerification: "abc123456789",
        })
      ).status,
      200,
    );
    const publicConfig = await (await fetch(root + "growth-config")).json();
    assert.deepEqual(publicConfig, { gaId: "G-ABC1234567", enabled: true });
  } finally {
    await new Promise((resolve) => server.close(resolve));
    store.close();
  }
});

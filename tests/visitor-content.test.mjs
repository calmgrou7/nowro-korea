import test from "node:test";
import assert from "node:assert/strict";
import { showEvent, koreanOnlyDescription } from "../shared/visitor-content.ts";
import { urlLanguage, languagePath } from "../shared/site-language.ts";
import { pageMetadata } from "../shared/page-metadata.ts";
test("festival default excludes expired and undated editions, archive toggle retains research access, and permanent experiences remain visible", () => {
  const now = new Date("2026-11-08T03:00:00Z");
  assert.equal(
    showEvent(
      { USAGE_DAY_WEEK_AND_TIME: "2025.07 ~ 2025.10" },
      "festivals",
      false,
      now,
    ),
    false,
  );
  assert.equal(
    showEvent({ ITEMCNTNTS: "부산의 축제 소개" }, "festivals", false, now),
    false,
  );
  assert.equal(
    showEvent({ ITEMCNTNTS: "부산의 축제 소개" }, "festivals", true, now),
    true,
  );
  assert.equal(
    showEvent({ eventEnd: "2026-12-31" }, "festivals", false, now),
    true,
  );
  assert.equal(
    showEvent({ USAGE_DAY_WEEK_AND_TIME: "상시 운영" }, "ocean", false, now),
    true,
  );
});
test("Korean-only long descriptions fold in foreign modes without hiding Korean-mode content or mostly-English copy", () => {
  const ko =
    "부산의 바다와 골목을 걷고 아름다운 야경과 다양한 문화 체험을 즐길 수 있는 행사입니다.";
  assert.equal(koreanOnlyDescription(ko, "en"), true);
  assert.equal(koreanOnlyDescription(ko, "ja"), true);
  assert.equal(koreanOnlyDescription(ko, "ko"), false);
  assert.equal(
    koreanOnlyDescription(
      "Discover Busan and visit 광안리 for the evening view.",
      "en",
    ),
    false,
  );
});
test("five language routes restore UI language while search alternates stay on verified Korean and English content", () => {
  for (const lang of ["en", "ko", "ja", "zh-CN", "zh-TW"])
    assert.equal(
      urlLanguage(new URL("https://nowrokorea.com" + languagePath(lang))),
      lang,
    );
  const meta = pageMetadata(new URL("https://nowrokorea.com/ko/?tab=MAP"));
  assert.match(meta.title, /부산/);
  assert.equal(new URL(meta.canonical).pathname, "/ko/");
  assert.equal(
    new URL(pageMetadata(new URL("https://nowrokorea.com/ja/")).canonical)
      .pathname,
    "/en/",
  );
  assert.equal(urlLanguage(new URL("https://nowrokorea.com/?lang=ko")), "ko");
});

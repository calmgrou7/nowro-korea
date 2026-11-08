import { ServiceError } from "./store.mjs";
export function growthConfig(store) {
  const fallback = {
    gaId: process.env.GA4_MEASUREMENT_ID || "",
    enabled: process.env.GA4_ENABLED === "true",
    naverVerification: process.env.NAVER_SITE_VERIFICATION || "",
    googleVerification: process.env.GOOGLE_SITE_VERIFICATION || "",
  };
  const value = {
    bingVerification: process.env.BING_SITE_VERIFICATION || "",
    ...fallback,
    ...JSON.parse(
      store.db
        .prepare("SELECT value FROM config WHERE key='growth_config'")
        .get()?.value || "{}",
    ),
  };
  const gaId = /^G-[A-Z0-9]{6,20}$/.test(value.gaId || "") ? value.gaId : "";
  return {
    gaId,
    enabled: value.enabled === true && !!gaId,
    naverVerification: /^[A-Za-z0-9_-]{8,200}$/.test(
      value.naverVerification || "",
    )
      ? value.naverVerification
      : "",
    googleVerification: /^[A-Za-z0-9_-]{8,200}$/.test(
      value.googleVerification || "",
    )
      ? value.googleVerification
      : "",
    bingVerification: /^[A-Za-z0-9_-]{8,200}$/.test(
      value.bingVerification || "",
    )
      ? value.bingVerification
      : "",
  };
}
export function saveGrowthConfig(store, session, input) {
  if (session.role !== "admin") throw new ServiceError("FORBIDDEN", 403);
  if (!input || typeof input.enabled !== "boolean")
    throw new ServiceError("INVALID_GROWTH_CONFIG", 400);
  const clean = {
    gaId: String(input.gaId || "").trim(),
    enabled: input.enabled === true,
    naverVerification: String(input.naverVerification || "").trim(),
    googleVerification: String(input.googleVerification || "").trim(),
    bingVerification: String(input.bingVerification || "").trim(),
  };
  if (
    (clean.gaId && !/^G-[A-Z0-9]{6,20}$/.test(clean.gaId)) ||
    (clean.enabled && !clean.gaId) ||
    [
      clean.naverVerification,
      clean.googleVerification,
      clean.bingVerification,
    ].some((v) => v && !/^[A-Za-z0-9_-]{8,200}$/.test(v))
  )
    throw new ServiceError("INVALID_GROWTH_CONFIG", 400);
  store.db
    .prepare("INSERT OR REPLACE INTO config(key,value) VALUES(?,?)")
    .run("growth_config", JSON.stringify(clean));
  store.audit(session.user_id, "growth_config_updated", {
    enabled: clean.enabled,
    gaConfigured: !!clean.gaId,
    naverConfigured: !!clean.naverVerification,
    googleConfigured: !!clean.googleVerification,
  });
  return clean;
}

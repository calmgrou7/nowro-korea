export function validateAndroidPackage(packageName) {
  if (!/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*){2,}$/.test(packageName || ""))
    throw new Error("INVALID_ANDROID_PACKAGE_NAME");
  return packageName;
}
export function androidAssociation(packageName, fingerprints) {
  validateAndroidPackage(packageName);
  const values = (fingerprints || "")
    .split(",")
    .map((v) => v.trim().toUpperCase())
    .filter(Boolean);
  if (
    !values.length ||
    values.some(
      (v) =>
        !/^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(v) ||
        v === Array(32).fill("00").join(":"),
    )
  )
    throw new Error("INVALID_ANDROID_CERTIFICATE_SHA256");
  return [
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: packageName,
        sha256_cert_fingerprints: [...new Set(values)],
      },
    },
  ];
}

export function androidOrigin(value) {
  const url = new URL(value);
  if (
    !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]*$/.test(
      url.hostname,
    )
  )
    throw new Error("USE_A_STABLE_HTTPS_APP_ORIGIN");
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.port ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    !url.hostname.includes(".") ||
    url.hostname.endsWith(".trycloudflare.com") ||
    url.hostname === "localhost" ||
    /^\d+\.\d+\.\d+\.\d+$/.test(url.hostname)
  )
    throw new Error("USE_A_STABLE_HTTPS_APP_ORIGIN");
  return url.origin;
}

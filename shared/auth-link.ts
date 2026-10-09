export function parseAuthLink(hash: string) {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  if (
    !["access_token", "refresh_token", "error", "error_code"].some((k) =>
      params.has(k),
    )
  )
    return null;
  const access_token = params.get("access_token"),
    refresh_token = params.get("refresh_token");
  const type = params.get("type");
  if (
    params.has("error") ||
    params.has("error_code") ||
    !access_token ||
    !refresh_token ||
    (type && !["signup", "magiclink", "email"].includes(type))
  )
    return { error: true as const };
  return { error: false as const, access_token, refresh_token };
}

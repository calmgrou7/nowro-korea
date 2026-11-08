const tabs = ["NOW", "MAP", "ROUTES", "ABOUT"];
export function safePageUrl(href: string) {
  const input = new URL(href),
    out = new URL(input.pathname, "https://nowrokorea.com");
  if (!/^\/(?:en|ko)?\/?$/.test(out.pathname)) out.pathname = "/";
  const tab = input.searchParams.get("tab");
  if (tab && tabs.includes(tab)) out.searchParams.set("tab", tab);
  const lang = input.searchParams.get("lang");
  if (lang && ["en", "ko", "ja", "zh-CN", "zh-TW"].includes(lang))
    out.searchParams.set("lang", lang);
  const board = input.searchParams.get("board");
  if (board && ["guide", "busan", "partners"].includes(board))
    out.searchParams.set("board", board);
  const post = input.searchParams.get("post");
  if (
    tab === "ABOUT" &&
    board &&
    ["guide", "busan", "partners"].includes(board) &&
    post &&
    /^[a-f0-9]{8}-[a-f0-9-]{27}$/i.test(post)
  )
    out.searchParams.set("post", post);
  for (const key of [
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_content",
  ]) {
    const value = input.searchParams.get(key);
    if (value && /^[a-zA-Z0-9_-]{1,80}$/.test(value))
      out.searchParams.set(key, value);
  }
  return out.href;
}
export function campaignUrl(
  tab: string,
  source: string,
  medium: string,
  campaign: string,
  content: string,
) {
  if (
    !tabs.includes(tab) ||
    ![source, medium, campaign, content].every((v) =>
      /^[a-z0-9_-]{1,80}$/.test(v),
    )
  )
    throw Error("INVALID_CAMPAIGN");
  const url = new URL("https://nowrokorea.com/");
  if (tab !== "NOW") url.searchParams.set("tab", tab);
  for (const [key, value] of Object.entries({
    utm_source: source,
    utm_medium: medium,
    utm_campaign: campaign,
    utm_content: content,
  }))
    url.searchParams.set(key, value);
  return url.href;
}
export function privatePage(href: string) {
  const url = new URL(href);
  return (
    ["token", "token_hash", "code", "error"].some((k) =>
      url.searchParams.has(k),
    ) ||
    !!url.hash ||
    ["TRIP", "PASS", "PASSPORT"].includes(url.searchParams.get("tab") || "")
  );
}

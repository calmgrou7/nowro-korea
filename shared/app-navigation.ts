export const appTabs = ["NOW", "MAP", "TRIP", "PASS", "PASSPORT", "ABOUT"] as const;
export type AppTab = (typeof appTabs)[number];
export function readAppTab(search: string): AppTab {
  const value = new URLSearchParams(search).get("tab");
  return appTabs.includes(value as AppTab) ? (value as AppTab) : "NOW";
}
export function appTabUrl(href: string, tab: AppTab) {
  const url = new URL(href);
  if (tab !== 'ABOUT') { url.searchParams.delete('board'); url.searchParams.delete('post'); }
  if (tab === "NOW") url.searchParams.delete("tab");
  else url.searchParams.set("tab", tab);
  return url;
}

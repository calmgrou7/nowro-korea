import type { Lang } from "./types.ts";
const paths: Record<Lang, string> = {
  en: "/en/",
  ko: "/ko/",
  ja: "/ja/",
  "zh-CN": "/zh-cn/",
  "zh-TW": "/zh-tw/",
};
export function languagePath(lang: Lang) {
  return paths[lang];
}
export function urlLanguage(url: URL): Lang | null {
  const query = url.searchParams.get("lang");
  if (query && Object.hasOwn(paths, query)) return query as Lang;
  const part = url.pathname.split("/")[1].toLowerCase();
  return (
    (Object.entries(paths).find(
      ([, path]) => path.split("/")[1] === part,
    )?.[0] as Lang) || null
  );
}

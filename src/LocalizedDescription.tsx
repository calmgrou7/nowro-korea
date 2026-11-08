import { koreanOnlyDescription } from "../shared/visitor-content";
export function LocalizedDescription({
  text,
  lang,
  compact = false,
}: {
  text?: string;
  lang: string;
  compact?: boolean;
}) {
  if (!text) return null;
  const clean = String(text)
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (koreanOnlyDescription(clean, lang)) {
    const label =
      (
        {
          en: "Description available in Korean · show original",
          ja: "説明は韓国語です・原文を表示",
          "zh-CN": "介绍仅有韩文 · 展开原文",
          "zh-TW": "介紹僅有韓文 · 展開原文",
        } as Record<string, string>
      )[lang] || "Description available in Korean · show original";
    return (
      <details className="description-original">
        <summary>{label}</summary>
        <p lang="ko">{clean}</p>
      </details>
    );
  }
  return (
    <p className={compact ? "tourism-summary" : "description-copy"}>{clean}</p>
  );
}

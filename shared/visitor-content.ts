import { eventEndDate, eventExpired } from "./event-dates.ts";
export function showEvent(
  item: any,
  category: string,
  includeArchive: boolean,
  now = new Date(),
) {
  if (includeArchive) return true;
  if (category === "festivals")
    return !!eventEndDate(item) && !eventExpired(item, now);
  return (
    !["performances", "exhibitions", "ocean"].includes(category) ||
    !eventExpired(item, now)
  );
}
export function koreanOnlyDescription(text: string, lang: string) {
  if (lang === "ko") return false;
  const clean = text.replace(/<[^>]*>/g, " ");
  const korean = (clean.match(/[가-힣]/g) || []).length;
  return (
    korean >= 20 &&
    korean / Math.max(1, (clean.match(/[\p{L}]/gu) || []).length) > 0.35
  );
}

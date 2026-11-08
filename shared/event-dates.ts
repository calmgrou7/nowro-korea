function validDate(year: string, month: string, day: string) {
  const value = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  const parsed = new Date(value + "T00:00:00Z");
  return !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
    ? value
    : null;
}
export function eventEndDate(item: any): string | null {
  if (item.op_at === "Y" || item.openrun === "Y") return null;
  const explicit =
    item.eventenddate || item.eventEnd || item.op_ed_dt || item.endDate;
  const text = String(explicit || item.USAGE_DAY_WEEK_AND_TIME || "");
  const matches = [
    ...text.matchAll(/(20\d{2})[.\-/년]\s*(\d{1,2})[.\-/월]\s*(\d{1,2})/g),
  ];
  const dates = matches
    .map((m) => validDate(m[1], m[2], m[3]))
    .filter((d): d is string => !!d);
  if (dates.length) {
    // A same-year range may omit the year in its second date: 2026.11.8 ~ 11.10.
    const last = matches[matches.length - 1];
    const tail = text.slice((last.index || 0) + last[0].length);
    const range = tail.match(
      /^[\s.()가-힣]*[~～–—-]\s*(\d{1,2})[.\-/월]\s*(\d{1,2})/,
    );
    if (range) {
      let year = last[1];
      if (Number(range[1]) < Number(last[2])) year = String(Number(year) + 1);
      const end = validDate(year, range[1], range[2]);
      if (end) return end;
    }
    return dates.sort().at(-1)!;
  }
  const compact = text.match(/^\s*(20\d{2})(\d{2})(\d{2})\s*$/);
  if(compact)return validDate(compact[1],compact[2],compact[3]);
  // Some festival feeds omit the schedule field but explicitly publish a date range in the description.
  const description=String(item.ITEMCNTNTS||'').replace(/<[^>]*>/g,' ');
  const range=description.match(/20\d{2}[.\-/년]\s*\d{1,2}[.\-/월]\s*\d{1,2}[.일\s]*(?:\([^)]*\))?\s*[~～–—]\s*(?:20\d{2}[.\-/년]\s*)?\d{1,2}[.\-/월]\s*\d{1,2}/);
  return range?eventEndDate({USAGE_DAY_WEEK_AND_TIME:range[0]}):null;
}
export function eventExpired(item: any, now = new Date()) {
  const end = eventEndDate(item);
  const today = new Date(now.getTime() + 9 * 3600000)
    .toISOString()
    .slice(0, 10);
  return !!end && end < today;
}

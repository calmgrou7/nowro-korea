const compact = (value: string) => value.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

export function distinctEvents<T extends Record<string, any>>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter(item => {
    const title = String(item.lookupTitle || item.MAIN_TITLE || item.title || "")
      .replace(/\((?:한|영|중간|중번|일|중)(?:\s*,\s*(?:한|영|중간|중번|일|중))*\)\s*$/, "");
    const names = [title];
    const bilingual = title.match(/^[^가-힣]+\(([^()]*[가-힣][^()]*)\)\s*$/);
    if (bilingual) names.push(bilingual[1]);
    const schedule = String(item.USAGE_DAY_WEEK_AND_TIME ||
      [item.eventStart || item.op_st_dt, item.eventEnd || item.op_ed_dt].filter(Boolean).join(" – "));
    const when = schedule.replace(/(20\d{2})[./년-]\s*(\d{1,2})[./월-]\s*(\d{1,2})/g,
      (_, year, month, day) => year + month.padStart(2,"0") + day.padStart(2,"0")).replace(/[\s~–—-]/g,"");
    const location = compact(String(item.ADDR1 || item.addr1 || item.place_nm || item.PLACE || ""));
    const keys = names.map(compact).filter(Boolean).flatMap(name => {
      const identity = JSON.stringify([name, when]);
      const keys: string[] = [];
      if (location) keys.push(identity + "|address|" + location);
      if (+item.LAT && +item.LNG) keys.push(identity + "|coords|" + Number(item.LAT).toFixed(4) + "," + Number(item.LNG).toFixed(4));
      return keys;
    });
    const id = item.kopisId || item.ktoContentId || item.res_no || item.UC_SEQ;
    if (id) keys.push(JSON.stringify([item.sourceLabel || "", String(id), when]));
    const duplicate = keys.some(key => seen.has(key));
    keys.forEach(key => seen.add(key));
    return !duplicate;
  });
}

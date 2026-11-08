const districts = ['중구','서구','동구','영도구','부산진구','동래구','남구','북구','해운대구','사하구','금정구','강서구','연제구','수영구','사상구','기장군'];
export function locationNeedsReview(item: Record<string, unknown>) {
  const address = String(item.ADDR1 || item.addr1 || item.PLACE || '');
  const found = districts.filter(d => new RegExp(`(?:^|\\s)${d}(?:\\s|$)`).test(address));
  const declared = String(item.GUGUN_NM || '').trim();
  return found.length > 1 || (found.length === 1 && districts.includes(declared) && found[0] !== declared);
}

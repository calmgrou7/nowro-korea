const districts = ['중구','서구','동구','영도구','부산진구','동래구','남구','북구','해운대구','사하구','금정구','강서구','연제구','수영구','사상구','기장군'];
export function locationNeedsReview(item: Record<string, unknown>) {
  const address = String(item.ADDR1 || item.addr1 || item.PLACE || '');
  const found = districts.filter(d => new RegExp(`(?:^|\\s)${d}(?:\\s|$)`).test(address));
  const declared = String(item.GUGUN_NM || '').trim();
  return found.length > 1 || (found.length === 1 && districts.includes(declared) && found[0] !== declared);
}
export function matchesDistrict(item: Record<string, unknown>, names: string[]) {
  if (!names.length) return true;
  const address = String(item.ADDR1 || item.addr1 || '');
  const tokens = (value: string) => value.normalize('NFKC').toLowerCase()
    .replace(/[-‐‑–]/g, '').split(/[^\p{L}\p{N}]+/u);
  const addressTokens = tokens(address);
  const explicit = addressTokens.some(token => districts.includes(token) || /^[a-z]+(?:gu|gun)$/.test(token));
  const candidates = explicit ? addressTokens : tokens(String(item.GUGUN_NM || ''));
  return names.some(name => !!name && candidates.includes(tokens(name).join('')));
}

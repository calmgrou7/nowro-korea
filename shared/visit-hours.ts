import type { Place } from './types.ts';

type HoursEvidence = Pick<Place, 'hours' | 'hoursStatus' | 'planningEstimate' | 'sample'>;

export function visitHoursStatus(place: HoursEvidence): 'published' | 'sample' | 'unknown' {
  // Older imports carried a fabricated seven-day schedule and no provenance flag.
  if (place.hoursStatus === 'unknown' || (place.planningEstimate && place.hoursStatus !== 'published')) return 'unknown';
  if (!validVisitWindows(place).length) return 'unknown';
  return place.sample ? 'sample' : 'published';
}

export const validVisitWindows = ({hours}: Pick<Place,'hours'>) => Array.isArray(hours) ? hours.filter(h => h &&
  Number.isInteger(h.day) && h.day >= 0 && h.day <= 6 &&
  Number.isInteger(h.open) && Number.isInteger(h.close) && Number.isInteger(h.lastEntry) &&
  0 <= h.open && h.open <= h.lastEntry && h.lastEntry <= h.close && h.open < h.close && h.close <= 1440) : [];

export function allowsUnverifiedVisit(arrival: Date, visitMinutes = 0) {
  const dayMillis = 86_400_000;
  const minute = ((arrival.getTime() + 9 * 3_600_000) % dayMillis + dayMillis) % dayMillis / 60_000;
  // Apply to actual arrival and time on site, not just the route's departure.
  return minute >= 6 * 60 && minute < 20 * 60 && minute + visitMinutes <= 20 * 60;
}

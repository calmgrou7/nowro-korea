import type { Conditions } from './types';

// Editing a planned trip must not replace its date or origin with today's state.
export function shortenTrip(conditions: Conditions): Conditions {
  return { ...conditions, minutes: Math.max(30, conditions.minutes - 30) };
}

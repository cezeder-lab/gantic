import { addDays, isWeekend, parseISO, toISO } from './dates';

/** "2w 3d" style label; falls back to plain days for short spans. */
export function formatDuration(days: number): string {
  if (days < 7) return `${days}d`;
  const weeks = Math.floor(days / 7);
  const rest = days % 7;
  return rest === 0 ? `${weeks}w` : `${weeks}w ${rest}d`;
}

/** Adds N working days (Mon-Fri, skipping the given holiday ISO dates) to a date. */
export function addWorkingDays(startDate: string, workingDays: number, holidays: string[] = []): string {
  const holidaySet = new Set(holidays);
  let current = startDate;
  let remaining = workingDays;
  while (remaining > 0) {
    current = addDays(current, 1);
    const d = parseISO(current);
    if (!isWeekend(d) && !holidaySet.has(toISO(d))) {
      remaining -= 1;
    }
  }
  return current;
}

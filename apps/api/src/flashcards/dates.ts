// All scheduling is done on UTC calendar days ("YYYY-MM-DD") so results never depend on the machine timezone.

export function utcToday(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function addDays(day: string, days: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

// Start of a UTC day as an ISO timestamp, for comparing against timestamptz columns.
export function startOfUtcDay(day: string): string {
  return `${day}T00:00:00Z`;
}

// Consecutive days with at least one review, counting back from today. Today is optional:
// a streak that was alive yesterday is not broken until the day ends.
export function currentStreak(reviewDays: ReadonlySet<string>, today: string): number {
  let cursor = reviewDays.has(today) ? today : addDays(today, -1);
  let streak = 0;
  while (reviewDays.has(cursor)) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

// SM-2 spaced repetition (SuperMemo, 1987). Pure: no I/O, no clock.

export const DEFAULT_EASE = 2.5;
// A card whose interval reaches this many days counts as "learned" in deck stats.
export const LEARNED_INTERVAL_DAYS = 21;
export const MIN_EASE = 1.3;
// Keeps interval_days inside the INT column and bounds runaway growth on very long streaks.
export const MAX_INTERVAL_DAYS = 36500;
// Grades offered in the study UI: Again, Hard, Good, Easy.
export const PREVIEW_GRADES = [1, 3, 4, 5] as const;

export interface Schedule {
  intervalDays: number;
  ease: number;
  repetitions: number;
}

export const NEW_SCHEDULE: Schedule = { intervalDays: 0, ease: DEFAULT_EASE, repetitions: 0 };

export function sm2(schedule: Schedule, grade: number): Schedule {
  if (!Number.isInteger(grade) || grade < 0 || grade > 5) {
    throw new RangeError(`grade must be an integer from 0 to 5, got ${grade}`);
  }

  const penalty = 5 - grade;
  const ease = Math.max(MIN_EASE, schedule.ease + (0.1 - penalty * (0.08 + penalty * 0.02)));

  if (grade < 3) return { intervalDays: 1, ease, repetitions: 0 };

  const repetitions = schedule.repetitions + 1;
  const interval =
    repetitions === 1 ? 1 : repetitions === 2 ? 6 : Math.round(schedule.intervalDays * schedule.ease);
  return { intervalDays: Math.min(interval, MAX_INTERVAL_DAYS), ease, repetitions };
}

// Days until the card comes back for each grade the UI offers, so buttons can show the next interval.
export function previewIntervals(schedule: Schedule): Record<(typeof PREVIEW_GRADES)[number], number> {
  return Object.fromEntries(
    PREVIEW_GRADES.map((grade) => [grade, sm2(schedule, grade).intervalDays]),
  ) as Record<(typeof PREVIEW_GRADES)[number], number>;
}

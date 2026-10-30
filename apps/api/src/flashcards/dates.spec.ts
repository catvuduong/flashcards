import { addDays, currentStreak, startOfUtcDay, utcToday } from './dates.js';

describe('utcToday', () => {
  it('uses the UTC calendar day, not the local one', () => {
    // 23:30 on 1 March in UTC-5 is already 04:30 on 2 March in UTC.
    expect(utcToday(new Date('2026-03-01T23:30:00-05:00'))).toBe('2026-03-02');
  });
});

describe('addDays', () => {
  it('crosses month and year boundaries', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
  });

  it('handles leap days', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2027-02-28', 1)).toBe('2027-03-01');
  });
});

describe('startOfUtcDay', () => {
  it('returns an explicit UTC timestamp', () => {
    expect(startOfUtcDay('2026-10-30')).toBe('2026-10-30T00:00:00Z');
  });
});

describe('currentStreak', () => {
  const today = '2026-10-30';

  it('is zero with no reviews', () => {
    expect(currentStreak(new Set(), today)).toBe(0);
  });

  it('counts consecutive days ending today', () => {
    expect(currentStreak(new Set(['2026-10-28', '2026-10-29', '2026-10-30']), today)).toBe(3);
  });

  it('keeps a streak alive until the end of today', () => {
    expect(currentStreak(new Set(['2026-10-28', '2026-10-29']), today)).toBe(2);
  });

  it('stops at the first gap', () => {
    expect(currentStreak(new Set(['2026-10-26', '2026-10-28', '2026-10-29', '2026-10-30']), today)).toBe(3);
  });

  it('is zero once the last review is two or more days ago', () => {
    expect(currentStreak(new Set(['2026-10-27']), today)).toBe(0);
  });
});

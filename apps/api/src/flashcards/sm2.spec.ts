import { DEFAULT_EASE, MAX_INTERVAL_DAYS, MIN_EASE, NEW_SCHEDULE, previewIntervals, sm2 } from './sm2.js';

describe('sm2', () => {
  describe('first review', () => {
    it('schedules a new card for one day on a good grade', () => {
      expect(sm2(NEW_SCHEDULE, 4)).toEqual({ intervalDays: 1, ease: 2.5, repetitions: 1 });
    });

    it('raises ease on a perfect grade', () => {
      const next = sm2(NEW_SCHEDULE, 5);
      expect(next.intervalDays).toBe(1);
      expect(next.ease).toBeCloseTo(2.6, 10);
      expect(next.repetitions).toBe(1);
    });

    it('lowers ease on a hard pass but still counts it as a repetition', () => {
      const next = sm2(NEW_SCHEDULE, 3);
      expect(next.intervalDays).toBe(1);
      expect(next.ease).toBeCloseTo(2.36, 10);
      expect(next.repetitions).toBe(1);
    });
  });

  describe('interval growth', () => {
    it('schedules the second successful review for six days', () => {
      const first = sm2(NEW_SCHEDULE, 4);
      expect(sm2(first, 4)).toEqual({ intervalDays: 6, ease: 2.5, repetitions: 2 });
    });

    it('multiplies the previous interval by the previous ease from the third review on', () => {
      const schedule = { intervalDays: 6, ease: 2.5, repetitions: 2 };
      expect(sm2(schedule, 4).intervalDays).toBe(15);
    });

    it('uses the ease from before this review, not the updated one', () => {
      // A perfect grade raises ease to 2.1, but the interval is still 10 * 2.0 = 20, not 10 * 2.1 = 21.
      const schedule = { intervalDays: 10, ease: 2, repetitions: 3 };
      expect(sm2(schedule, 5).intervalDays).toBe(20);
    });

    it('rounds fractional intervals to whole days', () => {
      const schedule = { intervalDays: 15, ease: 2.36, repetitions: 4 };
      expect(sm2(schedule, 4).intervalDays).toBe(35);
    });
  });

  describe('failure', () => {
    it.each([0, 1, 2])('grade %i resets repetitions and interval to one day', (grade) => {
      const mature = { intervalDays: 40, ease: 2.5, repetitions: 5 };
      const next = sm2(mature, grade);
      expect(next.intervalDays).toBe(1);
      expect(next.repetitions).toBe(0);
    });

    it('lowers ease on a blackout more than on a hard pass', () => {
      const start = { intervalDays: 6, ease: 2.5, repetitions: 2 };
      expect(sm2(start, 0).ease).toBeCloseTo(1.7, 10);
      expect(sm2(start, 2).ease).toBeCloseTo(2.18, 10);
    });

    it('restarts the interval ladder after a lapse', () => {
      const lapsed = sm2({ intervalDays: 40, ease: 2.5, repetitions: 5 }, 1);
      expect(sm2(lapsed, 4)).toMatchObject({ intervalDays: 1, repetitions: 1 });
      expect(sm2(sm2(lapsed, 4), 4)).toMatchObject({ intervalDays: 6, repetitions: 2 });
    });
  });

  describe('ease floor', () => {
    it('never drops below 1.3 on repeated blackouts', () => {
      let schedule = NEW_SCHEDULE;
      for (let i = 0; i < 20; i++) schedule = sm2(schedule, 0);
      expect(schedule.ease).toBe(MIN_EASE);
    });

    it('clamps a hard pass that would dip below the floor', () => {
      expect(sm2({ intervalDays: 6, ease: 1.4, repetitions: 2 }, 3).ease).toBe(MIN_EASE);
    });

    it('keeps ease at the floor for later passes too', () => {
      const next = sm2({ intervalDays: 30, ease: MIN_EASE, repetitions: 4 }, 3);
      expect(next.ease).toBe(MIN_EASE);
      expect(next.intervalDays).toBe(Math.round(30 * MIN_EASE));
    });
  });

  describe('long intervals', () => {
    it('stays a whole number of days', () => {
      let schedule = NEW_SCHEDULE;
      for (let i = 0; i < 12; i++) {
        schedule = sm2(schedule, 4);
        expect(Number.isInteger(schedule.intervalDays)).toBe(true);
      }
    });

    it('grows monotonically on passing grades', () => {
      let schedule = NEW_SCHEDULE;
      let previous = 0;
      for (let i = 0; i < 8; i++) {
        schedule = sm2(schedule, 5);
        expect(schedule.intervalDays).toBeGreaterThanOrEqual(previous);
        previous = schedule.intervalDays;
      }
      expect(previous).toBeGreaterThan(100);
    });

    it('caps the interval at MAX_INTERVAL_DAYS', () => {
      const huge = { intervalDays: 30000, ease: 3, repetitions: 9 };
      expect(sm2(huge, 5).intervalDays).toBe(MAX_INTERVAL_DAYS);
    });
  });

  describe('input validation', () => {
    it.each([-1, 6, 2.5, Number.NaN])('rejects grade %s', (grade) => {
      expect(() => sm2(NEW_SCHEDULE, grade)).toThrow(RangeError);
    });
  });
});

describe('previewIntervals', () => {
  it('reports the next interval for each grade without changing the card', () => {
    const schedule = { intervalDays: 6, ease: DEFAULT_EASE, repetitions: 2 };
    expect(previewIntervals(schedule)).toEqual({ 1: 1, 3: 15, 4: 15, 5: 15 });
    expect(schedule).toEqual({ intervalDays: 6, ease: 2.5, repetitions: 2 });
  });
});

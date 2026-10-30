'use client';

import { ErrorState, LoadingState, PageHeader } from '@/components/states';
import { ReviewsChart } from '@/components/reviews-chart';
import { RetentionRing } from '@/components/retention-ring';
import { plural } from '@/lib/format';
import { useApi } from '@/lib/use-api';
import type { Stats } from '@/lib/types';

export default function StatsPage() {
  const { data: stats, error, loading, retry } = useApi<Stats>('/stats');

  return (
    <>
      <PageHeader title="Stats">Your review activity over the last two weeks.</PageHeader>

      {loading && <LoadingState label="Loading stats" />}
      {error && <ErrorState message={error} onRetry={retry} />}

      {stats && (
        <div className="stack">
          <div className="stat-grid">
            <section className="panel" aria-labelledby="chart-heading">
              <div className="section-title">
                <h2 id="chart-heading">Reviews per day</h2>
                <span className="muted">
                  {plural(stats.reviewsPerDay.reduce((sum, day) => sum + day.count, 0), 'review')}
                </span>
              </div>
              <ReviewsChart days={stats.reviewsPerDay} />
              {stats.reviewsPerDay.every((day) => day.count === 0) && (
                <p className="muted" style={{ marginTop: 8 }}>
                  No reviews in the last two weeks yet. Study a deck to see your activity here.
                </p>
              )}
            </section>

            <section className="panel stat-card" aria-labelledby="streak-heading">
              <h2 id="streak-heading">Study streak</h2>
              <p className="big-number" data-testid="streak">
                {stats.streak}
              </p>
              <p className="muted">
                {stats.streak === 1 ? 'day in a row' : 'days in a row'}
                {stats.streak === 0 && ' · review something today to start one'}
              </p>
            </section>
          </div>

          <section className="panel stat-card" aria-labelledby="retention-heading">
            <h2 id="retention-heading">Retention</h2>
            <RetentionRing rate={stats.retention.rate} windowDays={stats.retention.windowDays} />
            <p className="muted">
              {stats.retention.rate === null
                ? `No reviews in the last ${stats.retention.windowDays} days`
                : `Share of ${plural(stats.retention.reviews, 'review')} recalled in the last ${stats.retention.windowDays} days`}
            </p>
          </section>
        </div>
      )}
    </>
  );
}

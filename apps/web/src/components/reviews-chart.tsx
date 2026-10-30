import { formatDay, plural } from '@/lib/format';

interface Props {
  days: Array<{ date: string; count: number }>;
}

const WIDTH = 640;
const HEIGHT = 260;
const PAD = { top: 16, right: 8, bottom: 32, left: 36 };

// Single-series bars on one count axis. Each column carries a hover title and a value label.
export function ReviewsChart({ days }: Props) {
  const total = days.reduce((sum, day) => sum + day.count, 0);
  const peak = Math.max(4, Math.ceil(Math.max(...days.map((day) => day.count)) * 1.2));
  const innerWidth = WIDTH - PAD.left - PAD.right;
  const innerHeight = HEIGHT - PAD.top - PAD.bottom;
  const slot = innerWidth / days.length;
  const barWidth = Math.min(32, slot * 0.6);
  const yFor = (value: number) => PAD.top + innerHeight - (value / peak) * innerHeight;
  const ticks = [0, Math.round(peak / 2), peak];

  return (
    <figure className="chart" data-testid="stats-chart">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={`Reviews per day over the last ${days.length} days: ${plural(total, 'review')} in total`}
      >
        {ticks.map((tick) => (
          <g key={tick}>
            <line className="chart-grid" x1={PAD.left} x2={WIDTH - PAD.right} y1={yFor(tick)} y2={yFor(tick)} />
            <text className="chart-tick" x={PAD.left - 8} y={yFor(tick)} dy="0.32em" textAnchor="end">
              {tick}
            </text>
          </g>
        ))}
        {days.map((day, i) => {
          const centre = PAD.left + slot * i + slot / 2;
          const isLast = i === days.length - 1;
          const showLabel = (days.length - 1 - i) % 3 === 0;
          return (
            <g key={day.date} className="chart-column">
              <title>{`${formatDay(day.date)}: ${plural(day.count, 'review')}`}</title>
              <rect x={centre - slot / 2} y={PAD.top} width={slot} height={innerHeight} fill="transparent" />
              {day.count > 0 && (
                <>
                  <rect
                    className="chart-bar"
                    x={centre - barWidth / 2}
                    y={yFor(day.count)}
                    width={barWidth}
                    height={(day.count / peak) * innerHeight}
                    rx={4}
                  />
                  <text className="chart-value" x={centre} y={yFor(day.count) - 6} textAnchor="middle">
                    {day.count}
                  </text>
                </>
              )}
              {showLabel && (
                <text className="chart-label" x={centre} y={HEIGHT - 10} textAnchor="middle">
                  {isLast ? 'Today' : formatDay(day.date)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </figure>
  );
}

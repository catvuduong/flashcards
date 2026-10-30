interface Props {
  rate: number | null;
  windowDays: number;
}

const SIZE = 160;
const STROKE = 12;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function RetentionRing({ rate, windowDays }: Props) {
  const percent = rate === null ? null : Math.round(rate * 100);
  const label =
    percent === null
      ? `No retention data in the last ${windowDays} days`
      : `Retention ${percent}% over the last ${windowDays} days`;

  return (
    <div className="ring" data-testid="retention-ring" role="img" aria-label={label}>
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true">
        <circle className="ring-track" cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none" strokeWidth={STROKE} />
        <circle
          className="ring-value"
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          strokeWidth={STROKE}
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - (rate ?? 0))}
          transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
        />
      </svg>
      <span className="ring-label">{percent === null ? '—' : `${percent}%`}</span>
    </div>
  );
}

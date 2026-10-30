// Dates from the API are UTC "YYYY-MM-DD" strings, so formatting pins UTC too.

export function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export function formatDay(day: string): string {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

// Compact interval label for buttons: 1d, 12d, 3mo, 2y.
export function formatInterval(days: number): string {
  if (days < 30) return `${days}d`;
  if (days < 365) return `${Math.round(days / 30)}mo`;
  return `${(days / 365).toFixed(1)}y`;
}

export function dueLabel(dueOn: string, today: string): string {
  const diff = Math.round(
    (Date.parse(`${dueOn}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000,
  );
  if (diff === 0) return 'Due today';
  if (diff < 0) return `Overdue ${-diff}d`;
  return `Due in ${formatInterval(diff)}`;
}

export function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

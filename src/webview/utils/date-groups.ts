export type DateGroup = {
  key: string;
  label: string;
};

export function getDateGroup(timestamp: number, now = new Date()): DateGroup {
  const target = startOfLocalDay(new Date(timestamp));
  const today = startOfLocalDay(now);
  const daysAgo = Math.max(0, Math.floor((today.getTime() - target.getTime()) / DAY_IN_MS));

  if (daysAgo === 0) return { key: 'today', label: 'Today' };
  if (daysAgo === 1) return { key: 'yesterday', label: 'Yesterday' };
  if (daysAgo <= 3) return { key: 'three-days', label: '3 days ago' };
  if (daysAgo <= 7) return { key: 'seven-days', label: '7 days ago' };
  if (daysAgo <= 14) return { key: 'one-week', label: '1 week ago' };
  if (daysAgo <= 30) return { key: 'one-month', label: '1 month ago' };
  if (daysAgo <= 90) return { key: 'three-months', label: '3 months ago' };
  if (daysAgo <= 180) return { key: 'six-months', label: '6 months ago' };
  return { key: 'older', label: 'Older' };
}

export function getLocalDayKey(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

const DAY_IN_MS = 24 * 60 * 60 * 1000;

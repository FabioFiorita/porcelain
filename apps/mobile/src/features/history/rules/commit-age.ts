const second = 1_000;
const minute = 60 * second;
const hour = 60 * minute;
const day = 24 * hour;
const month = 30 * day;
const year = 365 * day;
const units = [
  ['year', year],
  ['month', month],
  ['day', day],
  ['hour', hour],
  ['minute', minute],
  ['second', second],
] as const;
const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'always' });

export function commitAge(timestamp: string, now = Date.now()) {
  const elapsed = new Date(timestamp).getTime() - now;
  if (!Number.isFinite(elapsed)) return 'Unknown time';
  const [unit, length] =
    units.find(([, duration]) => Math.abs(elapsed) >= duration) ??
    (['second', second] as const);
  return formatter.format(
    elapsed <= 0
      ? -Math.round(Math.abs(elapsed) / length)
      : Math.round(elapsed / length),
    unit,
  );
}

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;
const units = [
  ['year', 365 * DAY],
  ['month', 30 * DAY],
  ['day', DAY],
  ['hour', 60 * MINUTE],
  ['minute', MINUTE],
] as const;

export function commitAge(timestamp: string, now: number = Date.now()) {
  const instant = Date.parse(timestamp);
  if (!Number.isFinite(instant)) return 'Unknown time';
  const elapsed = instant - now;
  const magnitude = Math.abs(elapsed);
  const [unit, length] = units.find(([, size]) => magnitude >= size) ?? [
    'second',
    1000,
  ];
  const rounded = Math.round(magnitude / length);
  const label = unit === 'month' && rounded === 12 ? 'year' : unit;
  const amount = label === unit ? rounded : 1;
  const age = `${amount} ${label}${amount === 1 ? '' : 's'}`;
  return elapsed > 0 ? `in ${age}` : `${age} ago`;
}

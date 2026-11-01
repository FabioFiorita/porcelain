import { DateTime, Duration, Option } from 'effect';

const units = [
  ['year', Duration.days(365)],
  ['month', Duration.days(30)],
  ['day', Duration.days(1)],
  ['hour', Duration.hours(1)],
  ['minute', Duration.minutes(1)],
] as const;

export function commitAge(
  timestamp: string,
  now: DateTime.DateTime = DateTime.nowUnsafe(),
) {
  const instant = DateTime.make(timestamp);
  if (Option.isNone(instant)) return 'Unknown time';
  const elapsed = Duration.toMillis(DateTime.distance(now, instant.value));
  const magnitude = Math.abs(elapsed);
  const [unit, duration] =
    units.find(([, length]) => magnitude >= Duration.toMillis(length)) ??
    (['second', Duration.seconds(1)] as const);
  const rounded = Math.round(magnitude / Duration.toMillis(duration));
  const label = unit === 'month' && rounded === 12 ? 'year' : unit;
  const amount = label === unit ? rounded : 1;
  const age = `${amount} ${label}${amount === 1 ? '' : 's'}`;
  return elapsed > 0 ? `in ${age}` : `${age} ago`;
}

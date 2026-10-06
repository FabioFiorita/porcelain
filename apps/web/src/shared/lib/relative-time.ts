import { DateTime, Duration } from 'effect';

const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'always' });

export function relativeTime(
  iso: string,
  now: DateTime.DateTime = DateTime.nowUnsafe(),
): string {
  const instant = DateTime.makeUnsafe(iso);
  const future = DateTime.isGreaterThan(instant, now);
  const [earlier, later] = future ? [now, instant] : [instant, now];
  const elapsed = DateTime.distance(earlier, later);
  const milliseconds = Duration.toMillis(elapsed);
  const zone = DateTime.zoneMakeLocal();
  const calendarDays =
    (milliseconds +
      DateTime.zonedOffset(DateTime.setZone(later, zone)) -
      DateTime.zonedOffset(DateTime.setZone(earlier, zone))) /
    Duration.toMillis(Duration.days(1));
  let unit: Intl.RelativeTimeFormatUnit;
  let amount: number;
  if (milliseconds < Duration.toMillis(Duration.minutes(1))) {
    unit = 'second';
    amount = Math.round(Duration.toSeconds(elapsed));
  } else if (milliseconds < Duration.toMillis(Duration.hours(1))) {
    unit = 'minute';
    amount = Math.round(Duration.toMinutes(elapsed));
  } else if (milliseconds < Duration.toMillis(Duration.days(1))) {
    unit = 'hour';
    amount = Math.round(Duration.toHours(elapsed));
  } else if (calendarDays < 30) {
    unit = 'day';
    amount = Math.round(calendarDays);
  } else if (calendarDays < 365) {
    amount = Math.round(calendarDays / 30);
    unit = amount === 12 ? 'year' : 'month';
    if (unit === 'year') amount = 1;
  } else {
    unit = 'year';
    amount = Math.round(calendarDays / 365);
  }
  return formatter.format(future ? amount : -amount, unit);
}

import {
  RELATIVE_TIME_DAYS_PER_MONTH,
  RELATIVE_TIME_DAYS_PER_YEAR,
  RELATIVE_TIME_MONTHS_PER_YEAR,
} from '../../../config/limits.ts';

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const localOffset = (time: number) =>
  -new Date(time).getTimezoneOffset() * MINUTE;

function age(elapsed: number, calendarDays: number): [number, string] {
  if (elapsed < MINUTE) return [Math.round(elapsed / SECOND), 's'];
  if (elapsed < HOUR) return [Math.round(elapsed / MINUTE), 'm'];
  if (elapsed < DAY) return [Math.round(elapsed / HOUR), 'h'];
  if (calendarDays < RELATIVE_TIME_DAYS_PER_MONTH)
    return [Math.round(calendarDays), 'd'];
  if (calendarDays < RELATIVE_TIME_DAYS_PER_YEAR) {
    const months = Math.round(calendarDays / RELATIVE_TIME_DAYS_PER_MONTH);
    return months === RELATIVE_TIME_MONTHS_PER_YEAR ? [1, 'y'] : [months, 'mo'];
  }
  return [Math.round(calendarDays / RELATIVE_TIME_DAYS_PER_YEAR), 'y'];
}

export function relativeTime(iso: string, now: number): string {
  const instant = Date.parse(iso);
  const future = instant > now;
  const [earlier, later] = future ? [now, instant] : [instant, now];
  const elapsed = later - earlier;
  const calendarDays =
    (elapsed + localOffset(later) - localOffset(earlier)) / DAY;
  const [amount, unit] = age(elapsed, calendarDays);
  return future ? `in ${amount}${unit}` : `${amount}${unit} ago`;
}
